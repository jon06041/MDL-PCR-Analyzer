#!/usr/bin/env python3
"""
Better ML Learning Test with Realistic Curve Data
Tests ML learning improvement with curves that will actually use the ML model
"""

import json
import requests
import random
import math
import numpy as np
from datetime import datetime

def generate_realistic_curve(classification='POSITIVE', noise_level=0.1):
    """Generate a realistic PCR curve that won't trigger rule-based fallback"""
    cycles = list(range(1, 41))  # 40 cycles
    
    if classification == 'POSITIVE':
        # Generate sigmoid curve for positive result
        baseline = 100 + random.uniform(-20, 20)
        max_fluorescence = 2000 + random.uniform(-500, 500)
        midpoint = random.uniform(20, 30)  # Ct value
        steepness = random.uniform(1.5, 3.0)
        
        rfu_data = []
        for cycle in cycles:
            # Sigmoid function: y = baseline + (max - baseline) / (1 + exp(-steepness * (x - midpoint)))
            signal = baseline + (max_fluorescence - baseline) / (1 + math.exp(-steepness * (cycle - midpoint)))
            # Add realistic noise
            noise = random.gauss(0, noise_level * signal)
            rfu_data.append(max(0, signal + noise))
            
        # Ensure good R² and other metrics
        amplitude = max(rfu_data) - min(rfu_data)
        
        return {
            'rfu_data': rfu_data,
            'cycles': cycles,
            'expected_metrics': {
                'amplitude': amplitude,
                'r2_score': random.uniform(0.85, 0.98),  # Good fit
                'snr': random.uniform(10, 25),
                'steepness': random.uniform(0.6, 1.0),
                'is_good_scurve': True
            }
        }
        
    elif classification == 'NEGATIVE':
        # Generate flat curve with noise for negative result
        baseline = random.uniform(50, 150)
        
        rfu_data = []
        for cycle in cycles:
            # Mostly flat with slight trend and noise
            trend = random.uniform(-0.5, 0.5) * cycle
            noise = random.gauss(0, baseline * 0.1)
            rfu_data.append(max(0, baseline + trend + noise))
            
        amplitude = max(rfu_data) - min(rfu_data)
        
        return {
            'rfu_data': rfu_data,
            'cycles': cycles,
            'expected_metrics': {
                'amplitude': amplitude,
                'r2_score': random.uniform(0.1, 0.4),  # Poor fit
                'snr': random.uniform(0.5, 3.0),
                'steepness': random.uniform(0.01, 0.2),
                'is_good_scurve': False
            }
        }
        
    else:  # SUSPICIOUS
        # Generate ambiguous curve
        baseline = 100 + random.uniform(-30, 30)
        max_fluorescence = random.uniform(800, 1500)  # Medium amplitude
        midpoint = random.uniform(32, 38)  # Late Ct
        steepness = random.uniform(0.8, 1.5)  # Moderate steepness
        
        rfu_data = []
        for cycle in cycles:
            signal = baseline + (max_fluorescence - baseline) / (1 + math.exp(-steepness * (cycle - midpoint)))
            noise = random.gauss(0, noise_level * signal * 1.5)  # More noise
            rfu_data.append(max(0, signal + noise))
            
        amplitude = max(rfu_data) - min(rfu_data)
        
        return {
            'rfu_data': rfu_data,
            'cycles': cycles,
            'expected_metrics': {
                'amplitude': amplitude,
                'r2_score': random.uniform(0.6, 0.85),  # Moderate fit
                'snr': random.uniform(4, 12),
                'steepness': random.uniform(0.3, 0.7),
                'is_good_scurve': random.choice([True, False])
            }
        }

def test_ml_learning_with_realistic_curves():
    """Test ML learning improvement with realistic curve data"""
    base_url = "http://localhost:5000"
    session_id = f"realistic_ml_test_{int(datetime.now().timestamp())}"
    
    print("🧪 Testing ML Learning with Realistic Curve Data")
    print(f"Session ID: {session_id}")
    print("=" * 60)
    
    # Generate diverse realistic test curves
    test_curves = []
    true_classifications = ['POSITIVE', 'NEGATIVE', 'SUSPICIOUS']
    
    for i in range(30):
        true_class = random.choice(true_classifications)
        curve_data = generate_realistic_curve(true_class)
        
        test_curves.append({
            'well_id': f'REAL_TEST_{i+1:03d}',
            'true_classification': true_class,
            'curve_data': curve_data
        })
    
    print(f"📊 Generated {len(test_curves)} realistic test curves")
    print(f"Distribution: {[curve['true_classification'] for curve in test_curves].count('POSITIVE')} POSITIVE, "
          f"{[curve['true_classification'] for curve in test_curves].count('NEGATIVE')} NEGATIVE, "
          f"{[curve['true_classification'] for curve in test_curves].count('SUSPICIOUS')} SUSPICIOUS")
    
    # Phase 1: Get baseline accuracy with initial predictions
    print("\n🔍 Phase 1: Getting baseline ML predictions...")
    baseline_predictions = []
    baseline_correct = 0
    
    for curve in test_curves:
        # Request ML classification
        ml_request = {
            'rfu_data': curve['curve_data']['rfu_data'],
            'cycles': curve['curve_data']['cycles'],
            'existing_metrics': curve['curve_data']['expected_metrics'],
            'well_data': {
                'well': curve['well_id'],
                'sample': 'Test_Sample',
                'channel': 'General_PCR',
                'fluorophore': 'General_PCR'
            },
            'session_id': session_id,
            'well_id': curve['well_id']
        }
        
        response = requests.post(f"{base_url}/api/ml-classify", json=ml_request)
        
        if response.status_code == 200:
            result = response.json()
            predicted_class = result.get('classification', 'Unknown')
            confidence = result.get('confidence', 0.0)
            method = result.get('method', 'Unknown')
            
            baseline_predictions.append({
                'well_id': curve['well_id'],
                'predicted': predicted_class,
                'true': curve['true_classification'],
                'confidence': confidence,
                'method': method
            })
            
            is_correct = predicted_class == curve['true_classification']
            if is_correct:
                baseline_correct += 1
                
            print(f"  {curve['well_id']}: {predicted_class} (conf: {confidence:.2f}, method: {method}) "
                  f"{'✅' if is_correct else '❌'} (true: {curve['true_classification']})")
        else:
            print(f"  ❌ Failed to get prediction for {curve['well_id']}: {response.status_code}")
    
    baseline_accuracy = baseline_correct / len(test_curves) if test_curves else 0
    print(f"\n📊 Baseline Accuracy: {baseline_accuracy:.1%} ({baseline_correct}/{len(test_curves)})")
    
    # Check how many predictions used ML vs rule-based
    ml_predictions = len([p for p in baseline_predictions if 'ML' in p['method']])
    rule_predictions = len([p for p in baseline_predictions if 'Rule-based' in p['method']])
    print(f"🤖 ML predictions: {ml_predictions}, Rule-based: {rule_predictions}")
    
    # Phase 2: Submit expert feedback for all wrong predictions
    print(f"\n🎓 Phase 2: Submitting expert feedback for wrong predictions...")
    feedback_submitted = 0
    
    for prediction in baseline_predictions:
        if prediction['predicted'] != prediction['true']:
            # Find the original curve data
            curve = next(c for c in test_curves if c['well_id'] == prediction['well_id'])
            
            # Submit expert feedback
            feedback_request = {
                'rfu_data': curve['curve_data']['rfu_data'],
                'cycles': curve['curve_data']['cycles'],
                'existing_metrics': curve['curve_data']['expected_metrics'],
                'expert_classification': curve['true_classification'],
                'well_id': curve['well_id'],
                'well_data': {
                    'well': curve['well_id'],
                    'sample': 'Test_Sample',
                    'channel': 'General_PCR',
                    'fluorophore': 'General_PCR'
                },
                'session_id': session_id
            }
            
            response = requests.post(f"{base_url}/api/ml-submit-feedback", json=feedback_request)
            
            if response.status_code == 200:
                feedback_submitted += 1
                print(f"  ✅ Feedback submitted for {curve['well_id']}: {prediction['predicted']} → {curve['true_classification']}")
            else:
                print(f"  ❌ Failed to submit feedback for {curve['well_id']}: {response.status_code}")
    
    print(f"\n📝 Expert feedback submitted: {feedback_submitted} corrections")
    
    # Phase 3: Test predictions again to measure improvement
    print(f"\n🔍 Phase 3: Testing predictions after expert feedback...")
    improved_predictions = []
    improved_correct = 0
    
    for curve in test_curves:
        # Request ML classification again
        ml_request = {
            'rfu_data': curve['curve_data']['rfu_data'],
            'cycles': curve['curve_data']['cycles'],
            'existing_metrics': curve['curve_data']['expected_metrics'],
            'well_data': {
                'well': curve['well_id'],
                'sample': 'Test_Sample',
                'channel': 'General_PCR',
                'fluorophore': 'General_PCR'
            },
            'session_id': session_id,
            'well_id': curve['well_id']
        }
        
        response = requests.post(f"{base_url}/api/ml-classify", json=ml_request)
        
        if response.status_code == 200:
            result = response.json()
            predicted_class = result.get('classification', 'Unknown')
            confidence = result.get('confidence', 0.0)
            method = result.get('method', 'Unknown')
            
            improved_predictions.append({
                'well_id': curve['well_id'],
                'predicted': predicted_class,
                'true': curve['true_classification'],
                'confidence': confidence,
                'method': method
            })
            
            is_correct = predicted_class == curve['true_classification']
            if is_correct:
                improved_correct += 1
                
            # Compare with baseline
            baseline_pred = next(p for p in baseline_predictions if p['well_id'] == curve['well_id'])
            baseline_was_correct = baseline_pred['predicted'] == curve['true_classification']
            
            status = ""
            if is_correct and not baseline_was_correct:
                status = "🎯 IMPROVED"
            elif not is_correct and baseline_was_correct:
                status = "📉 WORSE"
            elif is_correct:
                status = "✅ STILL CORRECT"
            else:
                status = "❌ STILL WRONG"
                
            print(f"  {curve['well_id']}: {predicted_class} (conf: {confidence:.2f}, method: {method}) {status}")
        else:
            print(f"  ❌ Failed to get prediction for {curve['well_id']}: {response.status_code}")
    
    improved_accuracy = improved_correct / len(test_curves) if test_curves else 0
    improvement = improved_accuracy - baseline_accuracy
    
    print(f"\n" + "=" * 60)
    print(f"📊 RESULTS SUMMARY")
    print(f"=" * 60)
    print(f"Baseline Accuracy:  {baseline_accuracy:.1%} ({baseline_correct}/{len(test_curves)})")
    print(f"Improved Accuracy:  {improved_accuracy:.1%} ({improved_correct}/{len(test_curves)})")
    print(f"Improvement:        {improvement:+.1%}")
    print(f"Expert Corrections: {feedback_submitted}")
    
    # Check prediction methods in final results
    final_ml_predictions = len([p for p in improved_predictions if 'ML' in p['method']])
    final_rule_predictions = len([p for p in improved_predictions if 'Rule-based' in p['method']])
    print(f"Final ML predictions: {final_ml_predictions}, Rule-based: {final_rule_predictions}")
    
    if improvement > 0.01:  # More than 1% improvement
        print(f"🎉 SUCCESS: ML learning is working! Accuracy improved by {improvement:.1%}")
        return True
    elif abs(improvement) < 0.01:
        print(f"⚠️ NO CHANGE: Accuracy remained the same ({improvement:+.1%})")
        if final_ml_predictions == 0:
            print("🔍 DIAGNOSIS: All predictions are rule-based - ML model not being used!")
        return False
    else:
        print(f"📉 REGRESSION: Accuracy got worse by {abs(improvement):.1%}")
        return False

if __name__ == "__main__":
    success = test_ml_learning_with_realistic_curves()
    exit(0 if success else 1)
