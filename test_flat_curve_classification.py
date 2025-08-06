#!/usr/bin/env python3
"""
Test script to verify that flat/poor curves are correctly classified as NEGATIVE
and not SUSPICIOUS after the rule updates.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from curve_classification import classify_curve

def test_flat_curve_classification():
    """Test that flat/poor curves are classified as NEGATIVE, not SUSPICIOUS"""
    
    print("Testing flat/poor curve classification...")
    print("=" * 60)
    
    # Test case 1: Completely flat curve (no amplification)
    result1 = classify_curve(
        r2=0.3,            # Poor fit (noisy flat)
        steepness=0.02,    # Very low steepness (flat)
        snr=1.5,           # Low SNR (flat)
        midpoint=25,       # Reasonable midpoint
        baseline=70,       # Baseline
        amplitude=50       # Low amplitude
    )
    print(f"Test 1 - Completely flat curve:")
    print(f"  Metrics: SNR=1.5, Steepness=0.02, R²=0.3")
    print(f"  Result: {result1['classification']} - {result1['reason']}")
    print(f"  Expected: NEGATIVE")
    print(f"  ✅ PASS" if result1['classification'] == 'NEGATIVE' else f"  ❌ FAIL")
    print()
    
    # Test case 2: Poor curve with some noise
    result2 = classify_curve(
        r2=0.45,           # Poor fit
        steepness=0.08,    # Low steepness
        snr=2.8,           # Low but not zero SNR
        midpoint=30,       # Reasonable midpoint
        baseline=100,      # Baseline
        amplitude=80       # Low amplitude
    )
    print(f"Test 2 - Poor/noisy curve:")
    print(f"  Metrics: SNR=2.8, Steepness=0.08, R²=0.45")
    print(f"  Result: {result2['classification']} - {result2['reason']}")
    print(f"  Expected: NEGATIVE")
    print(f"  ✅ PASS" if result2['classification'] == 'NEGATIVE' else f"  ❌ FAIL")
    print()
    
    # Test case 3: Verify a true positive still works
    result3 = classify_curve(
        r2=0.92,           # Excellent fit
        steepness=0.45,    # Good steepness
        snr=15.2,          # High SNR
        midpoint=28,       # Good midpoint
        baseline=400,      # Baseline
        amplitude=800      # High amplitude
    )
    print(f"Test 3 - Clear positive curve:")
    print(f"  Metrics: SNR=15.2, Steepness=0.45, R²=0.92")
    print(f"  Result: {result3['classification']} - {result3['reason']}")
    print(f"  Expected: POSITIVE or STRONG_POSITIVE")
    print(f"  ✅ PASS" if 'POSITIVE' in result3['classification'] else f"  ❌ FAIL")
    print()
    
    # Test case 4: Verify suspicious rules still catch true anomalies
    result4 = classify_curve(
        r2=0.6,            # Poor fit
        steepness=1.2,     # Very high steepness (spike)
        snr=2.5,           # Low SNR
        midpoint=25,       # Reasonable midpoint
        baseline=200,      # Baseline
        amplitude=300      # Decent amplitude
    )
    print(f"Test 4 - Truly suspicious curve (spike artifact):")
    print(f"  Metrics: SNR=2.5, Steepness=1.2, R²=0.6")
    print(f"  Result: {result4['classification']} - {result4['reason']}")
    print(f"  Expected: SUSPICIOUS")
    print(f"  ✅ PASS" if result4['classification'] == 'SUSPICIOUS' else f"  ❌ FAIL")
    print()
    
    # Summary
    print("=" * 60)
    print("SUMMARY:")
    all_passed = (
        result1['classification'] == 'NEGATIVE' and
        result2['classification'] == 'NEGATIVE' and
        'POSITIVE' in result3['classification'] and
        result4['classification'] == 'SUSPICIOUS'
    )
    
    if all_passed:
        print("✅ ALL TESTS PASSED - Flat curves correctly classified as NEGATIVE!")
    else:
        print("❌ SOME TESTS FAILED - Review classification logic")
    
    return all_passed

if __name__ == "__main__":
    test_flat_curve_classification()
