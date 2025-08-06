#!/usr/bin/env python3
"""
Automated ML Diagnostic Tool
This script will systematically test the ML classification pipeline to identify where the issue occurs.
"""

import sys
import numpy as np
import traceback
from datetime import datetime

def test_rule_based_baseline():
    """Test that rule-based classification works correctly"""
    print("🔍 STEP 1: Testing Rule-Based Classification Baseline")
    try:
        from curve_classification import classify_curve
        
        # Test with clear positive metrics
        test_cases = [
            {
                'name': 'Strong Positive',
                'metrics': (0.98, 0.6, 15.0, 25.0, 50.0, 800.0),
                'expected': 'STRONG_POSITIVE'
            },
            {
                'name': 'Regular Positive', 
                'metrics': (0.90, 0.4, 8.0, 28.0, 60.0, 400.0),
                'expected': 'POSITIVE'
            },
            {
                'name': 'Weak Positive',
                'metrics': (0.82, 0.25, 5.0, 32.0, 70.0, 200.0), 
                'expected': 'WEAK_POSITIVE'
            },
            {
                'name': 'Clear Negative',
                'metrics': (0.60, 0.05, 1.0, 35.0, 80.0, 30.0),
                'expected': 'NEGATIVE'
            }
        ]
        
        for test in test_cases:
            result = classify_curve(*test['metrics'])
            classification = result.get('classification')
            expected = test['expected']
            
            if expected == 'NEGATIVE':
                success = classification == 'NEGATIVE'
            else:
                success = classification in ['POSITIVE', 'STRONG_POSITIVE', 'WEAK_POSITIVE']
            
            status = "✅" if success else "❌"
            print(f"  {status} {test['name']}: {classification} (expected positive type: {expected in ['POSITIVE', 'STRONG_POSITIVE', 'WEAK_POSITIVE']})")
            
        print("✅ Rule-based classification test completed\n")
        return True
        
    except Exception as e:
        print(f"❌ Rule-based test failed: {e}")
        return False

def test_ml_import():
    """Test ML classifier import and basic functionality"""
    print("🔍 STEP 2: Testing ML Classifier Import")
    try:
        from ml_curve_classifier import ml_classifier
        print("✅ ML classifier imported successfully")
        print(f"  Model trained: {ml_classifier.model_trained}")
        print(f"  Feature names: {len(ml_classifier.feature_names)} features")
        print(f"  Classes: {ml_classifier.classes}")
        return True
    except Exception as e:
        print(f"❌ ML classifier import failed: {e}")
        traceback.print_exc()
        return False

def test_feature_extraction():
    """Test feature extraction with known good positive sample"""
    print("🔍 STEP 3: Testing Feature Extraction")
    try:
        from ml_curve_classifier import ml_classifier
        
        # Create clear positive sample
        cycles = list(range(1, 41))
        rfu = [50] * 10 + [60 + i * 15 for i in range(15)] + [300] * 15
        
        # Positive metrics
        existing_metrics = {
            'r2_score': 0.95,
            'steepness': 0.5, 
            'snr': 10.0,
            'midpoint': 25.0,
            'baseline': 50.0,
            'amplitude': 500.0,
            'cqj': 18.5,
            'calcj': 1000.0
        }
        
        features = ml_classifier.extract_advanced_features(rfu, cycles, existing_metrics)
        
        print("✅ Feature extraction successful")
        print(f"  Extracted {len(features)} features")
        print(f"  Key features:")
        print(f"    - R2: {features.get('r2', 'N/A')}")
        print(f"    - Amplitude: {features.get('amplitude', 'N/A')}")
        print(f"    - SNR: {features.get('snr', 'N/A')}")
        print(f"    - CQJ: {features.get('cqj', 'N/A')}")
        print(f"    - CalcJ: {features.get('calcj', 'N/A')}")
        
        return features
        
    except Exception as e:
        print(f"❌ Feature extraction failed: {e}")
        traceback.print_exc()
        return None

def test_ml_prediction_direct():
    """Test direct ML prediction with known positive features"""
    print("🔍 STEP 4: Testing Direct ML Prediction")
    try:
        from ml_curve_classifier import ml_classifier
        
        # Create clear positive sample
        cycles = list(range(1, 41))
        rfu = [50] * 10 + [60 + i * 15 for i in range(15)] + [300] * 15
        
        # Positive metrics that should clearly be positive
        existing_metrics = {
            'r2_score': 0.95,
            'steepness': 0.5,
            'snr': 10.0, 
            'midpoint': 25.0,
            'baseline': 50.0,
            'amplitude': 500.0,
            'cqj': 18.5,
            'calcj': 1000.0
        }
        
        # Test ML prediction
        result = ml_classifier.predict_classification(rfu, cycles, existing_metrics, 'NGON', 'TEST_WELL')
        
        print("✅ ML prediction completed")
        print(f"  Classification: {result.get('classification')}")
        print(f"  Confidence: {result.get('confidence', 'N/A')}")
        print(f"  Method: {result.get('method', 'N/A')}")
        
        # Check if positive sample was correctly classified
        classification = result.get('classification')
        is_positive_classification = classification in ['POSITIVE', 'STRONG_POSITIVE', 'WEAK_POSITIVE']
        confidence = result.get('confidence', 0)
        
        print(f"\n  🎯 DIAGNOSTIC RESULTS:")
        print(f"    Sample Type: Clear Positive (R2=0.95, Amp=500, SNR=10)")
        print(f"    ML Result: {classification}")
        print(f"    Correctly Identified as Positive: {'✅ YES' if is_positive_classification else '❌ NO'}")
        print(f"    Confidence: {confidence}")
        
        if not is_positive_classification:
            print(f"  🚨 PROBLEM IDENTIFIED: ML is misclassifying clear positive as {classification}")
            
        return result
        
    except Exception as e:
        print(f"❌ ML prediction failed: {e}")
        traceback.print_exc()
        return None

def test_batch_pipeline():
    """Test the full batch analysis pipeline"""
    print("🔍 STEP 5: Testing Full Batch Pipeline")
    try:
        from qpcr_analyzer import batch_analyze_wells
        
        # Test data with clear positive
        test_data = {
            'A1_FAM': {
                'cycles': list(range(1, 41)),
                'rfu': [50] * 10 + [60 + i * 15 for i in range(15)] + [300] * 15,
                'fluorophore': 'FAM',
                'test_code': 'NGON'
            }
        }
        
        result = batch_analyze_wells(test_data)
        classification = result['individual_results']['A1_FAM']['curve_classification']
        
        print("✅ Batch pipeline completed")
        print(f"  Classification: {classification.get('classification')}")
        print(f"  Method: {classification.get('method', 'N/A')}")
        
        return result
        
    except Exception as e:
        print(f"❌ Batch pipeline failed: {e}")
        traceback.print_exc()
        return None

def generate_training_data():
    """Generate clean training data for ML model retraining"""
    print("🔍 STEP 6: Generating Clean Training Data")
    try:
        # Generate synthetic but realistic qPCR data
        training_samples = []
        
        # Strong positives
        for i in range(10):
            cycles = list(range(1, 41))
            # Strong S-curve: early start, high amplitude
            baseline = np.random.normal(50, 10)
            amplitude = np.random.normal(800, 100)
            midpoint = np.random.normal(20, 3)
            steepness = np.random.normal(0.6, 0.1)
            
            rfu = []
            for cycle in cycles:
                sigmoid_val = amplitude / (1 + np.exp(-steepness * (cycle - midpoint))) + baseline
                noise = np.random.normal(0, 5)
                rfu.append(max(0, sigmoid_val + noise))
            
            training_samples.append({
                'cycles': cycles,
                'rfu': rfu,
                'label': 'STRONG_POSITIVE',
                'pathogen': 'NGON'
            })
        
        # Regular positives  
        for i in range(15):
            cycles = list(range(1, 41))
            baseline = np.random.normal(60, 15)
            amplitude = np.random.normal(400, 80)
            midpoint = np.random.normal(25, 4)
            steepness = np.random.normal(0.4, 0.08)
            
            rfu = []
            for cycle in cycles:
                sigmoid_val = amplitude / (1 + np.exp(-steepness * (cycle - midpoint))) + baseline
                noise = np.random.normal(0, 8)
                rfu.append(max(0, sigmoid_val + noise))
                
            training_samples.append({
                'cycles': cycles,
                'rfu': rfu, 
                'label': 'POSITIVE',
                'pathogen': 'NGON'
            })
        
        # Weak positives
        for i in range(10):
            cycles = list(range(1, 41))
            baseline = np.random.normal(70, 20)
            amplitude = np.random.normal(200, 50) 
            midpoint = np.random.normal(30, 5)
            steepness = np.random.normal(0.25, 0.05)
            
            rfu = []
            for cycle in cycles:
                sigmoid_val = amplitude / (1 + np.exp(-steepness * (cycle - midpoint))) + baseline
                noise = np.random.normal(0, 10)
                rfu.append(max(0, sigmoid_val + noise))
                
            training_samples.append({
                'cycles': cycles,
                'rfu': rfu,
                'label': 'WEAK_POSITIVE', 
                'pathogen': 'NGON'
            })
        
        # Negatives
        for i in range(15):
            cycles = list(range(1, 41))
            baseline = np.random.normal(80, 25)
            
            rfu = []
            for cycle in cycles:
                # Flat line with noise
                noise = np.random.normal(0, 15)
                rfu.append(max(0, baseline + noise))
                
            training_samples.append({
                'cycles': cycles,
                'rfu': rfu,
                'label': 'NEGATIVE',
                'pathogen': 'NGON'
            })
        
        print(f"✅ Generated {len(training_samples)} training samples")
        print(f"  - Strong Positives: 10")
        print(f"  - Regular Positives: 15") 
        print(f"  - Weak Positives: 10")
        print(f"  - Negatives: 15")
        
        return training_samples
        
    except Exception as e:
        print(f"❌ Training data generation failed: {e}")
        return []

def automated_ml_retraining(training_samples):
    """Retrain the ML model with clean data"""
    print("🔍 STEP 7: Automated ML Model Retraining")
    try:
        from ml_curve_classifier import ml_classifier
        from qpcr_analyzer import analyze_curve_quality
        
        print("  Preparing training data...")
        for sample in training_samples:
            # Get full analysis metrics
            analysis = analyze_curve_quality(sample['cycles'], sample['rfu'])
            if 'error' not in analysis:
                # Add to training
                ml_classifier.add_training_sample(
                    sample['rfu'],
                    sample['cycles'], 
                    analysis,
                    sample['label'],
                    f"training_{len(ml_classifier.training_data)}",
                    sample['pathogen']
                )
        
        print(f"  Added {len(ml_classifier.training_data)} training samples")
        
        # Retrain model
        print("  Retraining ML model...")
        ml_classifier.train_model()
        
        print("✅ ML model retrained successfully")
        print(f"  Training accuracy: {ml_classifier.last_accuracy:.3f}")
        
        return True
        
    except Exception as e:
        print(f"❌ ML retraining failed: {e}")
        traceback.print_exc()
        return False

def main():
    """Run complete automated diagnostic and fix pipeline"""
    print("🤖 AUTOMATED ML DIAGNOSTIC AND TRAINING PIPELINE")
    print("=" * 60)
    print(f"Started at: {datetime.now()}")
    print()
    
    # Step 1: Test rule-based baseline
    if not test_rule_based_baseline():
        print("❌ CRITICAL: Rule-based classification is broken. Fix this first!")
        return
    
    # Step 2: Test ML import
    if not test_ml_import():
        print("❌ CRITICAL: Cannot import ML classifier. Check dependencies!")
        return
    
    # Step 3: Test feature extraction
    features = test_feature_extraction()
    if not features:
        print("❌ CRITICAL: Feature extraction is broken!")
        return
    
    # Step 4: Test ML prediction 
    ml_result = test_ml_prediction_direct()
    if not ml_result:
        print("❌ CRITICAL: ML prediction is completely broken!")
        return
    
    # Check if ML is misclassifying
    classification = ml_result.get('classification')
    is_correct = classification in ['POSITIVE', 'STRONG_POSITIVE', 'WEAK_POSITIVE']
    
    if not is_correct:
        print("\n🚨 PROBLEM CONFIRMED: ML is misclassifying positive samples!")
        print("   Proceeding with automated retraining...")
        
        # Step 5: Generate training data
        training_samples = generate_training_data()
        if not training_samples:
            print("❌ Cannot generate training data!")
            return
        
        # Step 6: Retrain model
        if automated_ml_retraining(training_samples):
            print("\n🔄 Testing retrained model...")
            
            # Test again
            new_result = test_ml_prediction_direct()
            if new_result:
                new_classification = new_result.get('classification') 
                new_is_correct = new_classification in ['POSITIVE', 'STRONG_POSITIVE', 'WEAK_POSITIVE']
                
                if new_is_correct:
                    print("🎉 SUCCESS: Retrained model now correctly classifies positives!")
                else:
                    print("❌ FAILURE: Even after retraining, model still misclassifies!")
        
    else:
        print("✅ ML model is working correctly!")
    
    # Step 7: Test full pipeline
    print("\n🔍 Testing full pipeline...")
    test_batch_pipeline()
    
    print(f"\n✅ Diagnostic completed at: {datetime.now()}")

if __name__ == "__main__":
    main()
