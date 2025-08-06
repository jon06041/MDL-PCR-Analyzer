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

# Conservative starting points for development
SNR_CUTOFFS = {
    'Strong_Positive': 15.0,    # Very clear signals
    'Positive': 8.0,           # Clear signals  
    'Weak_Positive': 4.0,      # Detectable but weak
    'Indeterminate': 2.0,      # Borderline, needs review
    'Negative': 2.0            # Below detection
}

def classify_curve(r2, steepness, snr, midpoint, baseline, amplitude):
    """
    Classifies a qPCR amplification curve based on input metrics.
    Returns a dict with classification, reason, confidence score (0-1), and review flag.
    """
    base_confidence = 0.0
    flag_for_review = False
    
    # Calculate base confidence from key metrics (0-1 scale)
    def calculate_confidence(r2, steepness, snr, classification_type):
        """Calculate realistic confidence based on how well metrics match expected ranges"""
        confidence_factors = []
        
        # R² confidence (exponential curve for diminishing returns)
        if r2 >= 0.99:
            r2_conf = 1.0
        elif r2 >= 0.95:
            r2_conf = 0.9
        elif r2 >= 0.90:
            r2_conf = 0.8
        elif r2 >= 0.85:
            r2_conf = 0.7
        elif r2 >= 0.80:
            r2_conf = 0.6
        elif r2 >= 0.75:
            r2_conf = 0.4
        else:
            r2_conf = 0.2
        confidence_factors.append(r2_conf)
        
        # SNR confidence (varies by classification type)
        if classification_type == "STRONG_POSITIVE":
            snr_optimal = 15.0
            if snr >= snr_optimal:
                snr_conf = 1.0
            elif snr >= 10:
                snr_conf = 0.8 + (snr - 10) / (snr_optimal - 10) * 0.2
            elif snr >= 6:
                snr_conf = 0.6 + (snr - 6) / 4 * 0.2
            else:
                snr_conf = max(0.1, snr / 6 * 0.6)
        elif classification_type in ["POSITIVE"]:
            snr_optimal = 8.0
            if snr >= snr_optimal:
                snr_conf = 1.0
            elif snr >= 5:
                snr_conf = 0.7 + (snr - 5) / (snr_optimal - 5) * 0.3
            elif snr >= 3:
                snr_conf = 0.4 + (snr - 3) / 2 * 0.3
            else:
                snr_conf = max(0.1, snr / 3 * 0.4)
        elif classification_type == "WEAK_POSITIVE":
            snr_optimal = 4.0
            if snr >= snr_optimal:
                snr_conf = 1.0
            elif snr >= 2.5:
                snr_conf = 0.6 + (snr - 2.5) / (snr_optimal - 2.5) * 0.4
            else:
                snr_conf = max(0.1, snr / 2.5 * 0.6)
        else:  # NEGATIVE, INDETERMINATE
            snr_conf = 0.8 if snr < 2 else max(0.2, 1.0 - (snr - 2) / 10)
        confidence_factors.append(snr_conf)
        
        # Steepness confidence
        if steepness >= 0.5:
            steep_conf = 1.0
        elif steepness >= 0.3:
            steep_conf = 0.8
        elif steepness >= 0.2:
            steep_conf = 0.6
        elif steepness >= 0.1:
            steep_conf = 0.4
        else:
            steep_conf = 0.2
        confidence_factors.append(steep_conf)
        
        # Weighted average (R² most important, then SNR, then steepness)
        weights = [0.4, 0.4, 0.2]
        return sum(f * w for f, w in zip(confidence_factors, weights))
    
    # SUSPICIOUS cases - focus on truly anomalous patterns, not just poor curves
    # Rule 1: Very sharp spikes with decent amplitude but low SNR (noise artifacts)
    if steepness > 1.0 and amplitude > 200 and snr < 4:
        return {"classification": "SUSPICIOUS", "reason": "Sharp spike with low SNR - possible artifact", "confidence": 0.3, "flag_for_review": True}
    
    # Rule 2: Extremely high amplitude with contradictory quality metrics (equipment issues)
    if amplitude > 1000 and (r2 < 0.7 or snr < 2):
        return {"classification": "SUSPICIOUS", "reason": "Very high amplitude with poor curve quality - check equipment", "confidence": 0.2, "flag_for_review": True}
    
    # Rule 3: Good fit but impossible biological characteristics (data corruption)
    if r2 > 0.9 and steepness > 0.5 and (midpoint < 5 or midpoint > 50):
        return {"classification": "SUSPICIOUS", "reason": "Good curve fit but impossible Cq value", "confidence": 0.4, "flag_for_review": True}
    
    # Apply confidence modifiers for unusual characteristics
    confidence_modifier = 1.0
    
    # Midpoint should be reasonable for your cycle range
    if midpoint < 10 or midpoint > 45:
        confidence_modifier *= 0.7  # Reduce confidence for unusual Cq values
    
    # Baseline should be relatively low compared to amplitude
    if amplitude != 0:
        baseline_ratio = baseline / amplitude
        if baseline_ratio > 0.3:
            flag_for_review = True  # High baseline suspicious
            confidence_modifier *= 0.8
    else:
        flag_for_review = True  # Avoid division by zero, flag as suspicious
        confidence_modifier *= 0.5

    # Primary filters - must pass these first
    if r2 < 0.75:
        confidence = calculate_confidence(r2, steepness, snr, "NEGATIVE") * confidence_modifier
        return {"classification": "NEGATIVE", "reason": "Poor fit", "confidence": confidence, "flag_for_review": flag_for_review}
    if snr < SNR_CUTOFFS['Indeterminate']:
        confidence = calculate_confidence(r2, steepness, snr, "NEGATIVE") * confidence_modifier
        return {"classification": "NEGATIVE", "reason": "Low signal", "confidence": confidence, "flag_for_review": flag_for_review}

    # Strong positive conditions
    if (r2 > 0.95 and steepness > 0.4 and snr > SNR_CUTOFFS['Strong_Positive']):
        confidence = calculate_confidence(r2, steepness, snr, "STRONG_POSITIVE") * confidence_modifier
        return {"classification": "STRONG_POSITIVE", "reason": "Meets all strong positive criteria", "confidence": confidence, "flag_for_review": flag_for_review}

    # Standard positive conditions
    if (r2 > 0.85 and steepness > 0.3 and snr > SNR_CUTOFFS['Positive']):
        confidence = calculate_confidence(r2, steepness, snr, "POSITIVE") * confidence_modifier
        return {"classification": "POSITIVE", "reason": "Meets positive criteria", "confidence": confidence, "flag_for_review": flag_for_review}

    # Weak positive with compensatory metrics
    if (r2 > 0.80 and steepness > 0.2 and snr > SNR_CUTOFFS['Weak_Positive']):
        confidence = calculate_confidence(r2, steepness, snr, "WEAK_POSITIVE") * confidence_modifier
        return {"classification": "WEAK_POSITIVE", "reason": "Meets weak positive criteria", "confidence": confidence, "flag_for_review": flag_for_review}

    # Special cases - high steepness can compensate for lower SNR
    if (steepness > 0.6 and snr > 3 and r2 > 0.80):
        confidence = calculate_confidence(r2, steepness, snr, "POSITIVE") * confidence_modifier * 0.9  # Slightly lower confidence for compensation
        return {"classification": "POSITIVE", "reason": "Sharp transition", "confidence": confidence, "flag_for_review": flag_for_review}

    # High SNR can compensate for lower steepness
    if (snr > 12 and steepness > 0.15 and r2 > 0.85):
        confidence = calculate_confidence(r2, steepness, snr, "POSITIVE") * confidence_modifier * 0.9  # Slightly lower confidence for compensation
        return {"classification": "POSITIVE", "reason": "Strong signal", "confidence": confidence, "flag_for_review": flag_for_review}

    # Borderline cases
    if (r2 > 0.75 and steepness > 0.1 and snr > 2.5):
        confidence = max(0.2, min(0.6, calculate_confidence(r2, steepness, snr, "WEAK_POSITIVE") * confidence_modifier * 0.7))  # Cap borderline confidence
        return {"classification": "INDETERMINATE", "reason": "Manual review", "confidence": confidence, "flag_for_review": True}

    # Default negative
    confidence = calculate_confidence(r2, steepness, snr, "NEGATIVE") * confidence_modifier
    return {"classification": "NEGATIVE", "reason": "Does not meet criteria", "confidence": confidence, "flag_for_review": flag_for_review}
