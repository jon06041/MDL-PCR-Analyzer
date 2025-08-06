# curve_classification.py
"""
Curve classification logic and SNR cutoffs for qPCR analysis.
"""

# Tough Test Cases to Throw At It:
#
# - Low amplitude, high noise (SNR ~2-3)
# - Late amplification (Cq > 40)
# - Gradual curves (low steepness ~0.1-0.2)
# - High baseline (baseline close to midpoint)
# - Double peaks (secondary amplification)
# - Plateau early (curves that level off quickly)
#
# Use these to challenge and validate the classification logic.

# Conservative starting points for development - ADJUSTED for real-world weak positives
SNR_CUTOFFS = {
    'Strong_Positive': 15.0,    # Very clear signals
    'Positive': 6.0,           # Clear signals (reduced from 8.0)
    'Weak_Positive': 2.5,      # Detectable but weak (reduced from 4.0)  
    'Indeterminate': 1.5,      # Borderline, needs review (reduced from 2.0)
    'Negative': 1.0            # Below detection (reduced from 2.0)
}

def classify_curve(r2, steepness, snr, midpoint, baseline, amplitude):
    """
    Comprehensive weighted classification system considering ~30 criteria.
    Uses weighted scoring instead of hard cutoffs to properly handle real-world samples.
    """
    
    # WEIGHTED SCORING SYSTEM - Each criterion contributes to overall score
    scores = {
        'positive_evidence': 0.0,  # Evidence FOR being positive
        'negative_evidence': 0.0,  # Evidence AGAINST being positive  
        'quality_score': 0.0,      # Overall curve quality
        'confidence_score': 0.0    # How confident we are in the result
    }
    
    # CRITICAL POSITIVE INDICATORS (High Weight)
    # 1. Excellent curve fit (R²) - MOST IMPORTANT
    if r2 >= 0.99:
        scores['positive_evidence'] += 30  # Excellent fit
        scores['confidence_score'] += 25
    elif r2 >= 0.95:
        scores['positive_evidence'] += 25  # Very good fit
        scores['confidence_score'] += 20
    elif r2 >= 0.90:
        scores['positive_evidence'] += 20  # Good fit
        scores['confidence_score'] += 15
    elif r2 >= 0.85:
        scores['positive_evidence'] += 15  # Acceptable fit
        scores['confidence_score'] += 10
    elif r2 >= 0.80:
        scores['positive_evidence'] += 10  # Marginal fit
        scores['confidence_score'] += 5
    elif r2 >= 0.75:
        scores['positive_evidence'] += 5   # Poor but passable
    else:
        scores['negative_evidence'] += 15  # Very poor fit
        
    # 2. Exponential growth pattern (Steepness) - VERY IMPORTANT  
    if steepness >= 0.6:
        scores['positive_evidence'] += 25  # Excellent exponential growth
        scores['confidence_score'] += 20
    elif steepness >= 0.4:
        scores['positive_evidence'] += 20  # Good exponential growth
        scores['confidence_score'] += 15
    elif steepness >= 0.3:
        scores['positive_evidence'] += 15  # Moderate exponential growth
        scores['confidence_score'] += 10
    elif steepness >= 0.2:
        scores['positive_evidence'] += 10  # Weak exponential growth
        scores['confidence_score'] += 5
    elif steepness >= 0.1:
        scores['positive_evidence'] += 5   # Very weak growth
    else:
        scores['negative_evidence'] += 10  # Flat/declining
        
    # 3. Signal amplitude - IMPORTANT (but compensated by other factors)
    if amplitude > 1000:
        scores['positive_evidence'] += 15  # Strong signal
        scores['confidence_score'] += 10
    elif amplitude > 500:
        scores['positive_evidence'] += 12  # Good signal
        scores['confidence_score'] += 8
    elif amplitude > 200:
        scores['positive_evidence'] += 8   # Moderate signal
        scores['confidence_score'] += 5
    elif amplitude > 100:
        scores['positive_evidence'] += 4   # Weak signal
        scores['confidence_score'] += 2
    elif amplitude > 50:
        scores['positive_evidence'] += 2   # Very weak signal
    else:
        scores['negative_evidence'] += 5   # Negligible signal
        
    # 4. Signal-to-Noise Ratio - IMPORTANT (but not absolute)
    if snr > 15:
        scores['positive_evidence'] += 15  # Excellent SNR
        scores['confidence_score'] += 12
    elif snr > 8:
        scores['positive_evidence'] += 12  # Good SNR
        scores['confidence_score'] += 10
    elif snr > 5:
        scores['positive_evidence'] += 8   # Acceptable SNR
        scores['confidence_score'] += 6
    elif snr > 3:
        scores['positive_evidence'] += 4   # Marginal SNR
        scores['confidence_score'] += 3
    elif snr > 2:
        scores['positive_evidence'] += 2   # Poor SNR
        scores['confidence_score'] += 1
    elif snr > 1:
        scores['positive_evidence'] += 0   # Very poor SNR (neutral)
    else:
        scores['negative_evidence'] += 8   # Terrible SNR
        
    # 5. Cycle threshold (Cq/midpoint) - MODERATE IMPORTANCE
    if 15 <= midpoint <= 25:
        scores['positive_evidence'] += 8   # Ideal Cq range
        scores['confidence_score'] += 6
    elif 10 <= midpoint <= 35:
        scores['positive_evidence'] += 6   # Good Cq range
        scores['confidence_score'] += 4
    elif 5 <= midpoint <= 40:
        scores['positive_evidence'] += 3   # Acceptable Cq range
        scores['confidence_score'] += 2
    elif 3 <= midpoint <= 45:
        scores['positive_evidence'] += 1   # Marginal Cq range
    else:
        scores['negative_evidence'] += 8   # Unrealistic Cq
        
    # 6. Baseline quality - MODERATE IMPORTANCE
    if amplitude > 0:
        baseline_ratio = baseline / amplitude
        if baseline_ratio < 0.1:
            scores['positive_evidence'] += 6   # Low baseline (good)
            scores['confidence_score'] += 4
        elif baseline_ratio < 0.2:
            scores['positive_evidence'] += 4   # Acceptable baseline
            scores['confidence_score'] += 2
        elif baseline_ratio < 0.3:
            scores['positive_evidence'] += 2   # Elevated baseline
        else:
            scores['negative_evidence'] += 4   # High baseline (concerning)
            
    # SPECIAL COMBINATION BONUSES - Reward synergistic evidence
    # Excellent curve with good growth
    if r2 >= 0.95 and steepness >= 0.4:
        scores['positive_evidence'] += 10  # Synergy bonus
        scores['confidence_score'] += 8
        
    # High-quality curve shape compensates for lower amplitude
    if r2 >= 0.90 and steepness >= 0.5 and amplitude >= 100:
        scores['positive_evidence'] += 8   # Quality compensates for weak signal
        scores['confidence_score'] += 6
        
    # Strong signal with good shape
    if amplitude >= 500 and r2 >= 0.85 and steepness >= 0.3:
        scores['positive_evidence'] += 6   # Strong evidence convergence
        scores['confidence_score'] += 5
        
    # PENALTY FACTORS - Reduce confidence for concerning patterns
    quality_penalties = 0
    
    # Extremely poor metrics
    if r2 < 0.7:
        quality_penalties += 15
    if steepness < 0.05:
        quality_penalties += 10
    if snr < 1.0:
        quality_penalties += 8
        
    # Apply penalties
    scores['negative_evidence'] += quality_penalties
    scores['confidence_score'] = max(0, scores['confidence_score'] - quality_penalties)
    
    # CALCULATE FINAL SCORES
    net_positive_score = scores['positive_evidence'] - scores['negative_evidence']
    confidence_raw = min(100, scores['confidence_score'])
    confidence_normalized = confidence_raw / 100.0
    
    # CLASSIFICATION THRESHOLDS - Separate signal strength from curve quality
    # Signal strength based on amplitude, SNR, and Cq (concentration indicators)
    signal_strength_score = 0
    if amplitude > 800 and snr > 8 and midpoint < 30:
        signal_strength_score = 3  # Strong signal
    elif amplitude > 400 and snr > 5 and midpoint < 35:
        signal_strength_score = 2  # Moderate signal  
    elif amplitude > 150 and snr > 2.5 and midpoint < 40:
        signal_strength_score = 1  # Weak signal
    else:
        signal_strength_score = 0  # Very weak/no signal
        
    # Curve quality based on R² and steepness (reliability indicators)
    curve_quality_good = r2 >= 0.90 and steepness >= 0.4
    
    # Classification based on both factors
    if net_positive_score >= 40 and confidence_raw >= 20:
        if signal_strength_score >= 2:
            classification = "STRONG_POSITIVE"
            reason = f"Strong signal with excellent curve quality (score: {net_positive_score})"
        else:
            classification = "WEAK_POSITIVE" 
            reason = f"Excellent curve quality but low concentration (score: {net_positive_score})"
    elif net_positive_score >= 25 and confidence_raw >= 15:
        if signal_strength_score >= 2:
            classification = "POSITIVE"
            reason = f"Good signal with solid curve quality (score: {net_positive_score})"
        else:
            classification = "WEAK_POSITIVE"
            reason = f"Good curve quality but low concentration (score: {net_positive_score})"
    elif net_positive_score >= 15 and confidence_raw >= 10:
        classification = "WEAK_POSITIVE"
        reason = f"Weak positive - low concentration (score: {net_positive_score})"
    elif net_positive_score >= 5 or curve_quality_good:
        # IMPORTANT: Don't reject excellent curves due to one poor metric
        classification = "INDETERMINATE"
        reason = f"Borderline evidence (score: {net_positive_score}) - review needed"
    else:
        classification = "NEGATIVE"
        reason = f"Insufficient evidence (score: {net_positive_score})"
        
    # OVERRIDE: Never classify excellent curves as negative
    if r2 >= 0.95 and steepness >= 0.4 and amplitude >= 50:
        if classification == "NEGATIVE":
            classification = "WEAK_POSITIVE"
            reason = "Excellent curve shape overrides other concerns"
            confidence_normalized = max(0.6, confidence_normalized)
    
    # Flag for review if contradictory evidence
    flag_for_review = (
        abs(scores['positive_evidence'] - scores['negative_evidence']) < 10 or
        confidence_raw < 15 or
        (r2 > 0.9 and classification == "NEGATIVE") or
        (amplitude > 800 and classification == "NEGATIVE")
    )
    
    return {
        "classification": classification,
        "reason": reason,
        "confidence": confidence_normalized,
        "flag_for_review": flag_for_review,
        "debug_scores": {
            "positive_evidence": scores['positive_evidence'],
            "negative_evidence": scores['negative_evidence'],
            "net_score": net_positive_score,
            "confidence_raw": confidence_raw
        }
    }
