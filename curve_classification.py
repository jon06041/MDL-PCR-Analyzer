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
    Returns a dict with classification, reason, confidence penalty, and review flag if any.
    """
    confidence_penalty = 0.0
    flag_for_review = False
    # Sharp curves with low SNR might be noise
    if steepness > 0.8 and snr < 5:
        return {"classification": "SUSPICIOUS", "reason": "Possible noise spike", "confidence_penalty": confidence_penalty, "flag_for_review": True}
    # Midpoint should be reasonable for your cycle range
    if midpoint < 10 or midpoint > 45:
        confidence_penalty = 0.5  # Reduce confidence
    # Baseline should be relatively low compared to amplitude
    if amplitude != 0:
        baseline_ratio = baseline / amplitude
        if baseline_ratio > 0.3:
            flag_for_review = True  # High baseline suspicious
    else:
        flag_for_review = True  # Avoid division by zero, flag as suspicious

    # Primary filters - must pass these first
    if r2 < 0.75:
        return {"classification": "NEGATIVE", "reason": "Poor fit", "confidence_penalty": confidence_penalty, "flag_for_review": flag_for_review}
    if snr < SNR_CUTOFFS['Indeterminate']:
        return {"classification": "NEGATIVE", "reason": "Low signal", "confidence_penalty": confidence_penalty, "flag_for_review": flag_for_review}

    # Strong positive conditions
    if (r2 > 0.95 and steepness > 0.4 and snr > SNR_CUTOFFS['Strong_Positive']):
        return {"classification": "STRONG_POSITIVE", "reason": "Meets all strong positive criteria", "confidence_penalty": confidence_penalty, "flag_for_review": flag_for_review}

    # Standard positive conditions
    if (r2 > 0.85 and steepness > 0.3 and snr > SNR_CUTOFFS['Positive']):
        return {"classification": "POSITIVE", "reason": "Meets positive criteria", "confidence_penalty": confidence_penalty, "flag_for_review": flag_for_review}

    # Weak positive with compensatory metrics
    if (r2 > 0.80 and steepness > 0.2 and snr > SNR_CUTOFFS['Weak_Positive']):
        return {"classification": "WEAK_POSITIVE", "reason": "Meets weak positive criteria", "confidence_penalty": confidence_penalty, "flag_for_review": flag_for_review}

    # Special cases - high steepness can compensate for lower SNR
    if (steepness > 0.6 and snr > 3 and r2 > 0.80):
        return {"classification": "POSITIVE", "reason": "Sharp transition", "confidence_penalty": confidence_penalty, "flag_for_review": flag_for_review}

    # High SNR can compensate for lower steepness
    if (snr > 12 and steepness > 0.15 and r2 > 0.85):
        return {"classification": "POSITIVE", "reason": "Strong signal", "confidence_penalty": confidence_penalty, "flag_for_review": flag_for_review}

    # Borderline cases
    if (r2 > 0.75 and steepness > 0.1 and snr > 2.5):
        return {"classification": "INDETERMINATE", "reason": "Manual review", "confidence_penalty": confidence_penalty, "flag_for_review": flag_for_review}

    return {"classification": "NEGATIVE", "reason": "Does not meet criteria", "confidence_penalty": confidence_penalty, "flag_for_review": flag_for_review}
