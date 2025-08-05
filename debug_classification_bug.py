#!/usr/bin/env python3
"""
Debug the actual curve classification function
"""

from curve_classification import classify_curve

def test_classification_bug():
    print('🔍 TESTING CURVE CLASSIFICATION BUG')
    print('=' * 60)
    
    # Test metrics from our strong positive sample
    r2 = 0.999
    steepness = 0.95  
    snr = 35.0
    midpoint = 5.0
    baseline = 50
    amplitude = 35000
    
    print('Input parameters:')
    print(f'  r2: {r2}')
    print(f'  steepness: {steepness}')
    print(f'  snr: {snr}')
    print(f'  midpoint: {midpoint}')
    print(f'  baseline: {baseline}')
    print(f'  amplitude: {amplitude}')
    print()
    
    # Test each condition step by step
    print('🔍 Step-by-step analysis:')
    print()
    
    # Check the suspicious rule first
    print('1. Testing suspicious rule: amplitude > 500 and (r2 < 0.8 or snr < 3)')
    suspicious_condition = amplitude > 500 and (r2 < 0.8 or snr < 3)
    print(f'   Result: {suspicious_condition}')
    if suspicious_condition:
        print('   ❌ WOULD BE FLAGGED AS SUSPICIOUS')
    else:
        print('   ✅ Passes suspicious check')
    print()
    
    # Check strong positive criteria
    print('2. Testing strong positive: r2 > 0.95 and steepness > 0.4 and snr > 15.0')
    strong_positive = (r2 > 0.95 and steepness > 0.4 and snr > 15.0)
    print(f'   r2 > 0.95: {r2 > 0.95} ({r2})')
    print(f'   steepness > 0.4: {steepness > 0.4} ({steepness})')
    print(f'   snr > 15.0: {snr > 15.0} ({snr})')
    print(f'   Result: {strong_positive}')
    if strong_positive:
        print('   ✅ SHOULD BE STRONG_POSITIVE')
    else:
        print('   ❌ Does not meet strong positive criteria')
    print()
    
    # Now test the actual function
    print('3. Actual function result:')
    result = classify_curve(r2, steepness, snr, midpoint, baseline, amplitude)
    print(f'   Classification: {result["classification"]}')
    print(f'   Reason: {result["reason"]}')
    print(f'   Confidence penalty: {result.get("confidence_penalty", "N/A")}')
    print(f'   Flag for review: {result.get("flag_for_review", "N/A")}')
    print()
    
    # Analysis
    expected = 'STRONG_POSITIVE'
    actual = result['classification']
    
    if actual == expected:
        print(f'✅ CORRECT: Got {actual} as expected')
    else:
        print(f'❌ BUG FOUND: Expected {expected}, got {actual}')
        print(f'   This confirms the rule-based classification has a bug!')
        print(f'   Despite meeting all criteria for strong positive, it returned: {actual}')

if __name__ == "__main__":
    test_classification_bug()
