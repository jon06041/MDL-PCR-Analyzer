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

def classify_curve(r2, steepness, snr, midpoint, baseline=100, amplitude=None, cq_value=None, **kwargs):
    """
    STRICT qPCR curve classification with clear positive/negative criteria.
    
    POSITIVE CRITERIA (must have ALL):
    - Amplitude ≥ 600 (clear signal above noise)
    - R² ≥ 0.90 (excellent curve fit) 
    - Steepness ≥ 0.3 (good exponential growth)
    - Valid CQJ (5-42 cycles, not N/A)
    - SNR ≥ 4 (signal clearly above noise)
    
    NEGATIVE CRITERIA (any ONE triggers negative):
    - Amplitude < 200 (too weak)
    - R² < 0.70 (poor curve fit)
    - Steepness < 0.1 (flat line)
    - Midpoint > 42 (too late crossing)
    - SNR < 1.5 (too noisy)
    
    CQJ LOGIC:
    - CQJ < 5 with high amplitude = suspicious (possible machine error)
    - CQJ N/A or missing = doesn't automatically make negative
    - Must look at amplitude, curve quality, steepness for negatives
    
    Everything else = EDGE CASE for ML review
    """
    
    # Validate inputs
    if amplitude is None:
        amplitude = 0
    if r2 is None:
        r2 = 0
    if steepness is None:
        steepness = 0
    if snr is None:
        snr = 0
    if midpoint is None:
        midpoint = 50
    
    # Check if CQJ is valid for positive evidence (not N/A and reasonable range)
    has_valid_cqj = False
    cqj_suspicious = False
    
    if cq_value is not None and cq_value != 'N/A' and cq_value != -999:
        try:
            cq_float = float(cq_value)
            if cq_float >= 5:  # Valid CQJ start (no upper limit - pathogen specific)
                has_valid_cqj = True
            elif cq_float < 5:  # Suspiciously early - could be machine error
                cqj_suspicious = True
        except (ValueError, TypeError):
            pass  # Invalid CQJ, treat as no valid CQJ
    
    # DETECT MACHINE ERRORS / ANOMALIES (true SUSPICIOUS cases)
    suspicious_patterns = []
    
    if amplitude > 500 and r2 < 0.5:  # High signal but terrible curve fit
        suspicious_patterns.append("high_amplitude_poor_fit")
    if steepness > 1.0:  # Impossibly steep (machine spike)
        suspicious_patterns.append("impossible_steepness") 
    if snr > 20 and r2 < 0.7:  # Great SNR but poor curve (noise artifact)
        suspicious_patterns.append("snr_curve_contradiction")
    if midpoint < 3 and amplitude > 100:  # Impossibly early crossing
        suspicious_patterns.append("impossible_early_crossing")
    if cqj_suspicious and amplitude > 300:  # Early CQJ with significant amplitude
        suspicious_patterns.append("suspicious_early_cqj")
    if amplitude > 1000 and steepness < 0.05:  # High signal but no growth
        suspicious_patterns.append("high_amp_no_growth")
    
    if suspicious_patterns:
        return {
            'classification': 'SUSPICIOUS',
            'confidence': 0.9,
            'edge_case': True,  # Mark suspicious as edge case for expert review
            'edge_case_reasons': ['suspicious_machine_anomaly'],
            'ml_recommended': True,  # These need expert decisions
            'flag_for_review': True,
            'reason': f"Machine error/anomaly: {', '.join(suspicious_patterns)}"
        }
    
    # STRICT CONFIDENT POSITIVE CRITERIA (ALL must be met)
    confident_positive = (
        amplitude >= 600 and         # Strong signal
        r2 >= 0.90 and             # Excellent curve fit
        steepness >= 0.15 and      # Good exponential growth (LOWERED from 0.3)
        has_valid_cqj and          # Valid CQJ crossing
        midpoint >= 5 and          # Not impossibly early
        not suspicious_patterns    # No anomalies
        # Note: SNR removed - causing incorrect classifications
    )
    
    # STRICT CONFIDENT NEGATIVE CRITERIA (ANY one triggers negative)
    # Focus on curve quality and signal strength, not CQJ timing
    confident_negative = (
        amplitude < 200 or          # Too weak signal
        r2 < 0.70 or               # Poor curve fit  
        steepness < 0.1 or         # Flat line
        snr < 1.5                  # Signal too noisy
        # Note: No CQJ timing limits - pathogen specific
    )
    
    # CLASSIFICATION LOGIC - CHECK POSITIVES FIRST
    if confident_positive:
        # Determine strength based on signal quality
        if amplitude >= 1000 and r2 >= 0.95 and steepness >= 0.25:  # LOWERED from 0.5
            classification = "STRONG_POSITIVE"
            confidence = 0.95
        else:
            classification = "POSITIVE" 
            confidence = 0.90
            
        return {
            'classification': classification,
            'confidence': confidence,
            'edge_case': False,
            'edge_case_reasons': [],
            'ml_recommended': False,
            'flag_for_review': False,
            'reason': f"Confident positive: Amp={amplitude:.0f}, R²={r2:.3f}, Steep={steepness:.3f}, CQJ=valid"
        }
    
    elif confident_negative:
        return {
            'classification': 'NEGATIVE',
            'confidence': 0.90,
            'edge_case': False, 
            'edge_case_reasons': [],
            'ml_recommended': False,
            'flag_for_review': False,
            'reason': f"Confident negative: Amp={amplitude:.0f}, R²={r2:.3f}, Steep={steepness:.3f}, CQJ={'valid' if has_valid_cqj else 'N/A'}"
        }

    # NO CQJ LOGIC - ONLY for samples without valid CQJ
    elif not has_valid_cqj and not cqj_suspicious:
        # Good curve but no CQJ = INDETERMINATE (should have produced CQJ, needs redo)
        if amplitude >= 300 and r2 >= 0.80 and steepness >= 0.15:
            return {
                'classification': 'INDETERMINATE',
                'confidence': 0.70,
                'edge_case': True,
                'edge_case_reasons': ['good_curve_no_cqj'],
                'ml_recommended': True,
                'flag_for_review': False,
                'reason': f"Good curve without CQJ crossing - requires redo: Amp={amplitude:.0f}, R²={r2:.3f}, Steep={steepness:.3f}"
            }
        
        # Poor curve and no CQJ = NEGATIVE (legitimately negative)
        elif confident_negative:
            return {
                'classification': 'NEGATIVE',
                'confidence': 0.90,
                'edge_case': False,
                'edge_case_reasons': [],
                'ml_recommended': False,
                'flag_for_review': False,
                'reason': f"Poor curve quality, no CQJ - negative: Amp={amplitude:.0f}, R²={r2:.3f}, Steep={steepness:.3f}"
            }
        
        # Borderline curve, no CQJ = INDETERMINATE edge case
        else:
            return {
                'classification': 'INDETERMINATE',
                'confidence': 0.60,
                'edge_case': True,
                'edge_case_reasons': ['borderline_curve_no_cqj'],
                'ml_recommended': True,
                'flag_for_review': False,
                'reason': f"Borderline curve without CQJ - indeterminate: Amp={amplitude:.0f}, R²={r2:.3f}, Steep={steepness:.3f}"
            }
    
    else:
        # EDGE CASE - needs ML review
        edge_reasons = []
        
        # Identify specific borderline issues
        if 200 <= amplitude < 600:
            edge_reasons.append("intermediate_amplitude")
        if 0.70 <= r2 < 0.90:
            edge_reasons.append("moderate_curve_quality")
        if 0.1 <= steepness < 0.3:
            edge_reasons.append("moderate_steepness")
        if 1.5 <= snr < 4:
            edge_reasons.append("moderate_snr")
        if has_valid_cqj and amplitude < 600:
            edge_reasons.append("valid_cqj_weak_signal")
        if not has_valid_cqj and amplitude >= 200:
            edge_reasons.append("no_cqj_moderate_signal")
            
        # Default edge case classification
        if amplitude >= 300 and r2 >= 0.75:
            classification = "WEAK_POSITIVE"
        else:
            classification = "INDETERMINATE"
            
        return {
            'classification': classification,
            'confidence': 0.50,
            'edge_case': True,
            'edge_case_reasons': edge_reasons,
            'ml_recommended': True,
            'flag_for_review': False,
            'reason': f"Borderline case requiring ML review: {', '.join(edge_reasons)}"
        }
