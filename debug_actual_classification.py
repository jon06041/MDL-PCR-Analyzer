#!/usr/bin/env python3
"""
Debug the actual curve classification function to see what's happening
"""

from curve_classification import classify_curve_rule_based

def test_actual_classification():
    print('🔍 TESTING ACTUAL CURVE CLASSIFICATION')
    print('=' * 60)
    
    # Test metrics that should be STRONG_POSITIVE
    metrics = {
        'amplitude': 35000, 
        'r2_score': 0.999, 
        'snr': 35.0, 
        'steepness': 0.95,
        'is_good_scurve': True, 
        'cqj': 16.5, 
        'calcj': 16.1, 
        'midpoint': 5.0,
        'baseline': 50, 
        'max_slope': 4000, 
        'curve_efficiency': 0.99
    }
    
    print('Input metrics:')
    for key, value in metrics.items():
        print(f'  {key}: {value}')
    print()
    
    # Call the actual function
    result = classify_curve_rule_based(metrics)
    
    print('Classification result:')
    print(f'  Classification: {result["classification"]}')
    print(f'  Reason: {result["reason"]}')
    print(f'  Confidence penalty: {result.get("confidence_penalty", "N/A")}')
    print(f'  Flag for review: {result.get("flag_for_review", "N/A")}')
    print()
    
    expected = 'STRONG_POSITIVE'
    actual = result['classification']
    
    if actual == expected:
        print(f'✅ CORRECT: Got {actual} as expected')
    else:
        print(f'❌ INCORRECT: Expected {expected}, got {actual}')
        print(f'   Reason: {result["reason"]}')
        print('   This indicates a bug in the rule-based classification!')

if __name__ == "__main__":
    test_actual_classification()
