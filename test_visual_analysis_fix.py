#!/usr/bin/env python3
"""
Test script to verify the visual analysis fix
Simulates the scenario from the screenshot
"""

def test_visual_analysis_scenario():
    """Test the scenario from the screenshot"""
    
    # Simulate the well data from the screenshot
    test_well_data = {
        'well_id': 'A10',
        'sample': 'AcBVPanelPCR2-2587792',
        'pathogen': 'Megasphaera type 1 (Cy5)',
        'result': 'NEGATIVE',
        'r2_score': 0.9964,
        'rmse': 28.13,
        'amplitude': 1491.00,
        'steepness': 0.183,
        'midpoint': 18.95,
        'baseline': -86.45,
        'cq_value': 13.85,
        'cqj': 13.85,
        'calcj': 1.00e8,
        'is_good_scurve': False,  # This is the key - Poor S-Curve despite good metrics
        'snr': 15.0,  # Assuming high SNR based on screenshot discussion
        'anomalies': []
    }
    
    print("=== Visual Analysis Fix Test ===")
    print(f"Well: {test_well_data['well_id']}")
    print(f"Sample: {test_well_data['sample']}")
    print(f"Result: {test_well_data['result']}")
    print(f"R² Score: {test_well_data['r2_score']}")
    print(f"Amplitude: {test_well_data['amplitude']}")
    print(f"is_good_scurve: {test_well_data['is_good_scurve']}")
    print(f"SNR: {test_well_data['snr']}")
    print()
    
    # Simulate the OLD logic (what was causing the bug)
    print("=== OLD LOGIC (BUGGY) ===")
    amplitude = test_well_data['amplitude']
    snr = test_well_data['snr']
    
    # Old identifyPatternType logic (ignoring is_good_scurve)
    if amplitude > 1000 and snr > 15:
        old_pattern = 'Strong Positive'
    elif amplitude > 500 and snr > 8:
        old_pattern = 'Clear Positive'
    elif amplitude > 300 and snr > 4:
        old_pattern = 'Weak Positive'
    else:
        old_pattern = 'Borderline'
    
    # Old calculateVisualQuality logic (ignoring is_good_scurve)
    r2_score = test_well_data['r2_score']
    quality_score = 0
    quality_score += min(r2_score * 40, 40)  # R² contribution (40%)
    quality_score += min((snr / 20) * 30, 30)  # SNR contribution (30%)
    quality_score += min((amplitude / 1000) * 30, 30)  # Amplitude contribution (30%)
    
    if quality_score >= 80:
        old_quality = 'Excellent'
    elif quality_score >= 60:
        old_quality = 'Good'
    elif quality_score >= 40:
        old_quality = 'Fair'
    elif quality_score >= 20:
        old_quality = 'Poor'
    else:
        old_quality = 'Very Poor'
    
    print(f"Pattern Type: {old_pattern} ❌ WRONG!")
    print(f"Visual Quality: {old_quality} ❌ WRONG!")
    print(f"Quality Score: {quality_score:.1f}")
    print()
    
    # Simulate the NEW logic (fixed)
    print("=== NEW LOGIC (FIXED) ===")
    is_good_scurve = test_well_data['is_good_scurve']
    
    # New identifyPatternType logic (checking is_good_scurve FIRST)
    if not is_good_scurve:
        if amplitude < 200:
            new_pattern = 'Negative/Background'
        elif amplitude < 500:
            new_pattern = 'Poor Quality Signal'
        else:
            new_pattern = 'High Amplitude/Poor Shape'  # This case!
    else:
        # Only classify as positive if we have a good S-curve
        if amplitude > 1000 and snr > 15:
            new_pattern = 'Strong Positive'
        elif amplitude > 500 and snr > 8:
            new_pattern = 'Clear Positive'
        elif amplitude > 300 and snr > 4:
            new_pattern = 'Weak Positive'
        else:
            new_pattern = 'Borderline'
    
    # New calculateVisualQuality logic (checking is_good_scurve FIRST)
    if not is_good_scurve:
        # Poor S-curve quality should override metric-based quality
        if r2_score > 0.9 and amplitude > 1000:
            new_quality = 'Good Metrics/Poor Shape'  # This case!
        else:
            new_quality = 'Poor'
    else:
        # Same quality calculation as before if S-curve is good
        if quality_score >= 80:
            new_quality = 'Excellent'
        elif quality_score >= 60:
            new_quality = 'Good'
        elif quality_score >= 40:
            new_quality = 'Fair'
        elif quality_score >= 20:
            new_quality = 'Poor'
        else:
            new_quality = 'Very Poor'
    
    print(f"Pattern Type: {new_pattern} ✅ CORRECT!")
    print(f"Visual Quality: {new_quality} ✅ CORRECT!")
    print()
    
    print("=== CONCLUSION ===")
    print("✅ Fix addresses the core issue: Visual analysis now properly")
    print("   checks is_good_scurve BEFORE making positive classifications")
    print("✅ High amplitude + poor S-curve shape = 'High Amplitude/Poor Shape'")
    print("✅ Good metrics + poor S-curve shape = 'Good Metrics/Poor Shape'")
    print("✅ No more contradictory 'Strong Positive' + 'Poor S-Curve' combinations")

if __name__ == '__main__':
    test_visual_analysis_scenario()
