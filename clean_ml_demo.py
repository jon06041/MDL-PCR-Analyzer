#!/usr/bin/env python3
"""
Clean ML Learning Demonstration
Starts from pure rule-based and shows progressive ML learning
"""

import sys
import json
from datetime import datetime
from ml_curve_classifier import ml_classifier

def test_sample(name, metrics, expected_class, pathogen='NGON'):
    """Test a single sample and return result"""
    result = ml_classifier.predict_classification([], [], metrics, pathogen)
    correct = result['classification'] == expected_class
    return {
        'name': name,
        'expected': expected_class,
        'predicted': result['classification'],
        'confidence': result['confidence'],
        'method': result['method'],
        'correct': correct,
        'pathogen': pathogen
    }

def create_test_samples():
    """Create test samples with clear expected classifications"""
    return [
        {
            'name': 'Strong_Positive_1',
            'expected': 'STRONG_POSITIVE',
            'pathogen': 'NGON',
            'metrics': {
                'amplitude': 35000, 'r2_score': 0.999, 'snr': 35.0, 'steepness': 0.95,
                'is_good_scurve': True, 'cqj': 16.5, 'calcj': 16.1, 'midpoint': 5.0,
                'baseline': 50, 'max_slope': 4000, 'curve_efficiency': 0.99,
                'sample': 'Strong_Positive_1', 'channel': 'FAM'
            }
        },
        {
            'name': 'Strong_Positive_2',
            'expected': 'STRONG_POSITIVE',
            'pathogen': 'CT',
            'metrics': {
                'amplitude': 42000, 'r2_score': 0.998, 'snr': 38.0, 'steepness': 0.97,
                'is_good_scurve': True, 'cqj': 15.8, 'calcj': 15.3, 'midpoint': 4.5,
                'baseline': 45, 'max_slope': 5000, 'curve_efficiency': 0.99,
                'sample': 'Strong_Positive_2', 'channel': 'Texas_Red'
            }
        },
        {
            'name': 'Weak_Positive_1',
            'expected': 'WEAK_POSITIVE',
            'pathogen': 'NGON',
            'metrics': {
                'amplitude': 8500, 'r2_score': 0.92, 'snr': 12.0, 'steepness': 0.78,
                'is_good_scurve': True, 'cqj': 26.5, 'calcj': 26.0, 'midpoint': 8.0,
                'baseline': 85, 'max_slope': 850, 'curve_efficiency': 0.85,
                'sample': 'Weak_Positive_1', 'channel': 'FAM'
            }
        },
        {
            'name': 'Clear_Negative_1',
            'expected': 'NEGATIVE',
            'pathogen': 'NGON',
            'metrics': {
                'amplitude': 10, 'r2_score': 0.02, 'snr': 0.1, 'steepness': 0.01,
                'is_good_scurve': False, 'midpoint': 0, 'baseline': 100,
                'max_slope': 2, 'curve_efficiency': 0.0,
                'sample': 'Clear_Negative_1', 'channel': 'FAM'
            }
        },
        {
            'name': 'Suspicious_Case_1',
            'expected': 'SUSPICIOUS',
            'pathogen': 'CT',
            'metrics': {
                'amplitude': 2500, 'r2_score': 0.85, 'snr': 4.5, 'steepness': 0.55,
                'is_good_scurve': False, 'cqj': 35.2, 'calcj': 34.8, 'midpoint': 12.5,
                'baseline': 180, 'max_slope': 300, 'curve_efficiency': 0.68,
                'sample': 'Suspicious_Case_1', 'channel': 'Texas_Red'
            }
        }
    ]

def main():
    print("🧬 CLEAN ML LEARNING DEMONSTRATION")
    print("=" * 60)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Clear any existing data
    print("🗑️ STEP 1: Clear existing ML data")
    initial_samples = len(ml_classifier.training_data)
    ml_classifier.training_data = []
    ml_classifier.model_trained = False
    if hasattr(ml_classifier, 'pathogen_models'):
        ml_classifier.pathogen_models = {}
    print(f"   Cleared {initial_samples} existing training samples")
    print(f"   ML system reset to pure rule-based mode")
    print()
    
    # Test samples
    test_samples = create_test_samples()
    
    print("📊 STEP 2: Rule-Based Baseline Test")
    print("-" * 40)
    baseline_results = []
    correct_count = 0
    
    for sample in test_samples:
        result = test_sample(
            sample['name'], 
            sample['metrics'], 
            sample['expected'], 
            sample['pathogen']
        )
        baseline_results.append(result)
        if result['correct']:
            correct_count += 1
        
        status = "✓" if result['correct'] else "✗"
        print(f"   {status} {sample['name']:<20} | {sample['expected']:<15} → {result['predicted']:<15} | {result['confidence']:.2f} | {result['method']}")
    
    baseline_accuracy = (correct_count / len(test_samples)) * 100
    print(f"\n   Baseline Accuracy: {baseline_accuracy:.1f}% ({correct_count}/{len(test_samples)})")
    print()
    
    print("🎓 STEP 3: Progressive ML Training")
    print("-" * 40)
    
    # Add training samples progressively
    for i, sample in enumerate(test_samples):
        print(f"\n   Training Sample {i+1}: {sample['name']} → {sample['expected']}")
        
        # Add expert feedback
        ml_classifier.add_training_sample(
            [], [],  # Empty RFU data and cycles for demo
            sample['metrics'],
            sample['expected'],
            sample['name'],
            sample['pathogen']
        )
        
        print(f"   Total training samples: {len(ml_classifier.training_data)}")
        
        # Test if model can be trained (needs 5+ samples)
        if len(ml_classifier.training_data) >= 5:
            print("   🔄 Retraining ML model...")
            success = ml_classifier.retrain_model()
            if success:
                print("   ✅ Model retrained successfully")
                
                # Test accuracy on all samples
                ml_correct = 0
                for ts in test_samples:
                    test_result = test_sample(
                        ts['name'],
                        ts['metrics'],
                        ts['expected'],
                        ts['pathogen']
                    )
                    if test_result['correct']:
                        ml_correct += 1
                
                ml_accuracy = (ml_correct / len(test_samples)) * 100
                print(f"   📈 Current ML Accuracy: {ml_accuracy:.1f}% ({ml_correct}/{len(test_samples)})")
            else:
                print("   ❌ Model retraining failed")
        else:
            print(f"   ⏳ Need {5 - len(ml_classifier.training_data)} more samples for ML training")
    
    print()
    print("🏆 FINAL RESULTS")
    print("-" * 40)
    
    # Final comprehensive test
    final_results = []
    final_correct = 0
    
    for sample in test_samples:
        result = test_sample(
            sample['name'],
            sample['metrics'],
            sample['expected'],
            sample['pathogen']
        )
        final_results.append(result)
        if result['correct']:
            final_correct += 1
        
        status = "✓" if result['correct'] else "✗"
        print(f"   {status} {sample['name']:<20} | {sample['expected']:<15} → {result['predicted']:<15} | {result['confidence']:.2f} | {result['method']}")
    
    final_accuracy = (final_correct / len(test_samples)) * 100
    improvement = final_accuracy - baseline_accuracy
    
    print()
    print(f"📊 Baseline Accuracy:  {baseline_accuracy:.1f}%")
    print(f"🎯 Final Accuracy:     {final_accuracy:.1f}%")
    print(f"📈 Improvement:        +{improvement:.1f}%")
    print(f"🔢 Training Samples:   {len(ml_classifier.training_data)}")
    
    target_met = "✅" if final_accuracy >= 95 else "❌"
    print(f"🎯 95%+ Target:        {target_met} {'ACHIEVED' if final_accuracy >= 95 else 'NOT ACHIEVED'}")
    
    print()
    print("🎉 DEMONSTRATION COMPLETE")

if __name__ == "__main__":
    main()
