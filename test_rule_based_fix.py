#!/usr/bin/env python3
"""Test the rule-based only classification fix"""

import numpy as np
from qpcr_analyzer import batch_analyze_wells

# Create test data with a clear positive sample
test_data = {
    'A1_FAM': {
        'cycles': list(range(1, 41)),
        'rfu': [50] * 10 + [60 + i * 15 for i in range(15)] + [300] * 15,
        'fluorophore': 'FAM',
        'test_code': 'NGON'
    }
}

print('=== Testing Rule-Based Only Classification ===')
try:
    result = batch_analyze_wells(test_data)
    classification = result['individual_results']['A1_FAM']['curve_classification']
    print(f'✅ Classification: {classification.get("classification")}')
    print(f'✅ Method: {classification.get("method", "Unknown")}')
    print(f'✅ Reason: {classification.get("reason", "N/A")}')
    print(f'✅ Confidence: {classification.get("confidence", "N/A")}')
    
    # Check if it's positive
    if classification.get("classification") in ['POSITIVE', 'STRONG_POSITIVE', 'WEAK_POSITIVE']:
        print('🎉 SUCCESS: Positive sample correctly classified as positive!')
    else:
        print(f'❌ PROBLEM: Positive sample incorrectly classified as {classification.get("classification")}')
        
except Exception as e:
    print(f'❌ Error: {e}')
    import traceback
    traceback.print_exc()
