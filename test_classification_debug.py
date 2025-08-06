#!/usr/bin/env python3
"""
Quick test to check if the classification logic is working correctly
"""

from curve_classification import classify_curve

def test_classification_logic():
    print('🔍 TESTING CLASSIFICATION LOGIC')
    print('=' * 60)
    
    # Test case 1: Should be STRONG_POSITIVE
    print('\n📊 Test 1: Strong Positive Sample')
    print('Input metrics: High amplitude, excellent curve quality')
    result = classify_curve(
        r2=0.999,           # Excellent fit
        steepness=0.95,     # Very steep
        snr=35.0,           # High signal
        midpoint=20.0,      # Good midpoint
        baseline=50,        # Low baseline
        amplitude=35000     # High amplitude
    )
    print(f'   Result: {result["classification"]} - {result["reason"]}')
    
    # Test case 2: Should be POSITIVE
    print('\n📊 Test 2: Clear Positive Sample')
    print('Input metrics: Good amplitude, good curve quality')
    result = classify_curve(
        r2=0.95,            # Good fit
        steepness=0.5,      # Good steepness
        snr=12.0,           # Good signal
        midpoint=25.0,      # Good midpoint
        baseline=100,       # Low baseline
        amplitude=5000      # Good amplitude
    )
    print(f'   Result: {result["classification"]} - {result["reason"]}')
    
    # Test case 3: Should be NEGATIVE
    print('\n📊 Test 3: Clear Negative Sample')
    print('Input metrics: Low amplitude, poor curve quality')
    result = classify_curve(
        r2=0.3,             # Poor fit
        steepness=0.05,     # Low steepness
        snr=1.0,            # Low signal
        midpoint=30.0,      # OK midpoint
        baseline=200,       # Higher baseline
        amplitude=50        # Low amplitude
    )
    print(f'   Result: {result["classification"]} - {result["reason"]}')
    
    # Test case 4: Edge case that might be problematic
    print('\n📊 Test 4: Edge Case - Medium Amplitude')
    print('Input metrics: Medium amplitude, borderline quality')
    result = classify_curve(
        r2=0.8,             # Borderline fit
        steepness=0.25,     # Medium steepness
        snr=5.0,            # Medium signal
        midpoint=28.0,      # OK midpoint
        baseline=150,       # Medium baseline
        amplitude=800       # Medium amplitude
    )
    print(f'   Result: {result["classification"]} - {result["reason"]}')
    
    print('\n' + '=' * 60)
    print('✅ Classification logic test complete')

if __name__ == "__main__":
    test_classification_logic()
