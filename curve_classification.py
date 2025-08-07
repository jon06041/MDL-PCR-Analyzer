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

def should_apply_ml_analysis(classification_result):
    """
    Determine if a sample should be included in ML batch analysis.
    Only edge cases and uncertain classifications should use ML.
    
    Args:
        classification_result: Dict with classification, confidence, edge_case, etc.
    
    Returns:
        bool: True if sample should be analyzed with ML
    """
    if not isinstance(classification_result, dict):
        return False
    
    # Always apply ML to edge cases
    if classification_result.get('edge_case', False):
        return True
    
    # Apply ML to samples flagged for ML review
    if classification_result.get('ml_recommended', False):
        return True
    
    # Apply ML to low confidence classifications
    confidence = classification_result.get('confidence', 1.0)
    if confidence < 0.75:
        return True
    
    # Apply ML to INDETERMINATE and SUSPICIOUS classifications
    classification = classification_result.get('classification', '')
    if classification in ['INDETERMINATE', 'SUSPICIOUS']:
        return True
    
    # Apply ML to WEAK_POSITIVE (often borderline cases)
    if classification == 'WEAK_POSITIVE':
        return True
    
    # Skip ML for confident STRONG_POSITIVE, POSITIVE, and NEGATIVE
    if classification in ['STRONG_POSITIVE', 'POSITIVE', 'NEGATIVE'] and confidence >= 0.85:
        return False
    
    # Default to ML for anything else uncertain
    return True


def get_edge_case_summary(classification_result):
    """
    Get a human-readable summary of why a sample is an edge case.
    
    Args:
        classification_result: Dict with classification results
    
    Returns:
        str: Description of edge case reasons
    """
    if not isinstance(classification_result, dict):
        return "Unknown"
    
    edge_reasons = classification_result.get('edge_case_reasons', [])
    if not edge_reasons:
        confidence = classification_result.get('confidence', 1.0)
        classification = classification_result.get('classification', '')
        
        if confidence < 0.75:
            return f"Low confidence ({confidence:.2f})"
        elif classification in ['INDETERMINATE', 'SUSPICIOUS', 'WEAK_POSITIVE']:
            return f"Uncertain classification ({classification})"
        else:
            return "Borderline metrics"
    
    # Convert edge reasons to readable descriptions
    reason_descriptions = {
        'intermediate_amplitude': 'Signal strength between thresholds (200-600 RFU)',
        'moderate_curve_quality': 'Curve fit quality marginal (R² 0.70-0.90)',
        'moderate_steepness': 'Growth rate borderline (0.1-0.2)',
        'moderate_snr': 'Signal-to-noise ratio marginal (1.5-3.0)',
        'valid_cqj_weak_signal': 'Has threshold crossing but weak signal',
        'no_cqj_moderate_signal': 'Moderate signal but no threshold crossing',
        'good_curve_no_cqj': 'Good curve quality but no threshold crossing',
        'borderline_curve_no_cqj': 'Borderline curve without threshold crossing'
    }
    
    descriptions = [reason_descriptions.get(reason, reason) for reason in edge_reasons]
    return "; ".join(descriptions)


def classify_curve(r2, steepness, snr, midpoint, baseline=100, amplitude=None, cq_value=None, **kwargs):
    """
    STRICT qPCR curve classification with clear positive/negative criteria.
    
    POSITIVE CRITERIA (must have ALL):
    - Amplitude ≥ 600 (clear signal above noise)
    - R² ≥ 0.90 (excellent curve fit) 
    - Steepness ≥ 0.2 (good exponential growth - lowered from 0.3)
    - Valid CQJ (5+ cycles, not N/A)
    - Midpoint ≥ 5 (not impossibly early)
    
    NEGATIVE CRITERIA (any ONE triggers negative):
    - Amplitude < 200 (too weak)
    - R² < 0.70 (poor curve fit)
    - Steepness < 0.1 (flat line)
    - Midpoint > 42 (too late crossing)
    
    NOTE: SNR criteria removed due to baseline-subtracted data reliability issues.
    SNR is still used conservatively for edge case detection only.
    
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
    
    # DEBUG: Print CQJ value being received
    print(f"🔍 CQJ Debug: cq_value={cq_value}, type={type(cq_value)}")
    
    if cq_value is not None and cq_value != 'N/A' and cq_value != -999:
        try:
            cq_float = float(cq_value)
            print(f"🔍 CQJ Debug: cq_float={cq_float}, valid check: {cq_float >= 5}")
            if cq_float >= 5:  # Valid CQJ start (no upper limit - pathogen specific)
                has_valid_cqj = True
            elif cq_float < 5:  # Suspiciously early - could be machine error
                cqj_suspicious = True
        except (ValueError, TypeError) as e:
            print(f"🔍 CQJ Debug: Conversion error: {e}")
            pass  # Invalid CQJ, treat as no valid CQJ
    else:
        print(f"🔍 CQJ Debug: CQJ value is None, N/A, or -999")
    
    # DETECT MACHINE ERRORS / ANOMALIES (true SUSPICIOUS cases)
    suspicious_patterns = []
    
    if amplitude > 500 and r2 < 0.5:  # High signal but terrible curve fit
        suspicious_patterns.append("high_amplitude_poor_fit")
    if steepness > 1.0:  # Impossibly steep (machine spike)
        suspicious_patterns.append("impossible_steepness") 
    # NOTE: SNR contradictions removed due to baseline-subtracted data unreliability
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
            'edge_case': False,
            'edge_case_reasons': [],
            'ml_recommended': False,
            'flag_for_review': True,
            'reason': f"Machine error/anomaly: {', '.join(suspicious_patterns)}"
        }
    
    # STRICT CONFIDENT POSITIVE CRITERIA (ALL must be met)
    confident_positive = (
        amplitude >= 600 and         # Strong signal
        r2 >= 0.90 and             # Excellent curve fit
        steepness >= 0.2 and       # Good exponential growth (lowered from 0.3)
        has_valid_cqj and          # Valid CQJ crossing
        midpoint >= 5              # Not impossibly early
        # NOTE: SNR removed from strict criteria due to baseline-subtracted data issues
        # SNR is used separately for edge case detection only
    )
    
    # STRICT CONFIDENT NEGATIVE CRITERIA (ANY one triggers negative)
    # Focus on curve quality and signal strength, not SNR timing
    confident_negative = (
        amplitude < 200 or          # Too weak signal
        r2 < 0.70 or               # Poor curve fit  
        steepness < 0.1 or         # Flat line
        midpoint > 42              # Too late (pathogen specific limit)
        # NOTE: SNR removed due to baseline-subtracted data unreliability
    )
    
    # CLASSIFICATION LOGIC - CHECK POSITIVES FIRST
    if confident_positive:
        # Determine strength based on signal quality
        if amplitude >= 1000 and r2 >= 0.95 and steepness >= 0.5:
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
        
        # Identify specific borderline issues (be careful with SNR due to baseline-subtracted data)
        if 200 <= amplitude < 600:
            edge_reasons.append("intermediate_amplitude")
        if 0.70 <= r2 < 0.90:
            edge_reasons.append("moderate_curve_quality")
        if 0.1 <= steepness < 0.2:  # Updated to match confident_positive threshold
            edge_reasons.append("moderate_steepness")
        # NOTE: SNR edge case detection more conservative due to baseline-subtracted data issues
        if snr < 2.0 and amplitude > 200:  # Only flag very low SNR with decent amplitude
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
