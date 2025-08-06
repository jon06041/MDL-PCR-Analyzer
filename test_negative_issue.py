#!/usr/bin/env python3
"""
Quick test to diagnose the negative classification issue
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

def test_negative_issue():
    print('🔍 DIAGNOSING NEGATIVE CLASSIFICATION ISSUE')
    print('=' * 60)
    
    try:
        from curve_classification import classify_curve
        print('✅ Successfully imported classify_curve')
        
        # Test case that should definitely be POSITIVE
        print('\n📊 Test Case: Should be STRONG_POSITIVE')
        result = classify_curve(
            r2=0.999,           # Excellent fit
            steepness=0.95,     # Very steep
            snr=35.0,           # High signal
            midpoint=20.0,      # Good midpoint
            baseline=50,        # Low baseline
            amplitude=35000     # High amplitude
        )
        print(f'   Result: {result}')
        
        # Test case that should be POSITIVE
        print('\n📊 Test Case: Should be POSITIVE')
        result = classify_curve(
            r2=0.95,            # Good fit
            steepness=0.5,      # Good steepness
            snr=12.0,           # Good signal
            midpoint=25.0,      # Good midpoint
            baseline=100,       # Low baseline
            amplitude=5000      # Good amplitude
        )
        print(f'   Result: {result}')
        
        # Test case that should be NEGATIVE
        print('\n📊 Test Case: Should be NEGATIVE')
        result = classify_curve(
            r2=0.3,             # Poor fit
            steepness=0.05,     # Low steepness
            snr=1.0,            # Low signal
            midpoint=30.0,      # OK midpoint
            baseline=200,       # Higher baseline
            amplitude=50        # Low amplitude
        )
        print(f'   Result: {result}')
        
        # Check the SNR cutoffs
        from curve_classification import SNR_CUTOFFS
        print(f'\n📊 SNR Cutoffs: {SNR_CUTOFFS}')
        
    except Exception as e:
        print(f'❌ Error testing classification: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_negative_issue()
