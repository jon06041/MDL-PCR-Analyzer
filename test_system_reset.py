#!/usr/bin/env python3
"""
Test script to verify ML training data reset and rule-based classification
"""

import numpy as np
import json

def test_system_reset():
    print("🧪 Testing system after ML training data reset...")
    
    # Check training data is empty
    try:
        with open('ml_training_data.json', 'r') as f:
            training_data = json.load(f)
        print(f"📊 Training data count: {len(training_data)}")
        if len(training_data) == 0:
            print("✅ Training data successfully cleared")
        else:
            print(f"⚠️  Training data still contains {len(training_data)} entries")
    except FileNotFoundError:
        print("📁 No training data file found (expected after reset)")
    
    # Test curve classification
    print("\n🔍 Testing curve classification...")
    
    # Test 1: Good positive curve
    cycles = list(range(1, 41))
    rfu_positive = [50] * 10 + [60 + i * 15 for i in range(15)] + [300] * 15
    
    from qpcr_analyzer import analyze_curve_quality
    
    print("\n=== POSITIVE CURVE TEST ===")
    analysis_pos = analyze_curve_quality(cycles, rfu_positive)
    print(f"Curve metrics: R²={analysis_pos.get('r2_score', 0):.3f}, Amp={analysis_pos.get('amplitude', 0):.0f}, SNR={analysis_pos.get('snr', 0):.1f}")
    
    try:
        from ml_curve_classifier import ml_classifier
        ml_result_pos = ml_classifier.predict_classification(rfu_positive, cycles, analysis_pos, None, 'test_positive')
        print(f"Classification: {ml_result_pos.get('classification')} via {ml_result_pos.get('method')} (confidence: {ml_result_pos.get('confidence', 0):.3f})")
        
        if ml_result_pos.get('classification') in ['POSITIVE', 'WEAK_POSITIVE', 'STRONG_POSITIVE']:
            print("✅ SUCCESS: Good curve correctly classified as positive!")
        else:
            print("🚨 ISSUE: Good curve not classified as positive")
    except Exception as e:
        print(f"Error in ML classification: {e}")
    
    # Test 2: Flat negative curve  
    rfu_flat = [45 + np.random.normal(0, 1) for _ in range(40)]
    
    print("\n=== FLAT CURVE TEST ===")  
    analysis_flat = analyze_curve_quality(cycles, rfu_flat)
    print(f"Curve metrics: R²={analysis_flat.get('r2_score', 0):.3f}, Amp={analysis_flat.get('amplitude', 0):.0f}, SNR={analysis_flat.get('snr', 0):.1f}")
    
    try:
        ml_result_flat = ml_classifier.predict_classification(rfu_flat, cycles, analysis_flat, None, 'test_flat')
        print(f"Classification: {ml_result_flat.get('classification')} via {ml_result_flat.get('method')} (confidence: {ml_result_flat.get('confidence', 0):.3f})")
        
        if ml_result_flat.get('classification') == 'NEGATIVE':
            print("✅ SUCCESS: Flat curve correctly classified as negative!")
        else:
            print("🚨 ISSUE: Flat curve not classified as negative")
    except Exception as e:
        print(f"Error in ML classification: {e}")
    
    print("\n🎉 SYSTEM STATUS: Ready for clean training data collection")
    print("📝 When you see rule-based classifications that are wrong, use the feedback interface to teach the ML")
    print("🎯 Focus on correcting only obvious errors - let the ML learn the correct patterns")

if __name__ == "__main__":
    test_system_reset()
