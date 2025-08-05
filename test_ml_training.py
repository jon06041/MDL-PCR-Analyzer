#!/usr/bin/env python3
"""
Test ML classifier training with realistic data to verify it learns properly
"""

import numpy as np
from ml_curve_classifier import ml_classifier

def test_ml_training():
    print("🧪 TESTING ML CLASSIFIER TRAINING")
    print("=" * 50)
    
    # Check current state
    print(f"Initial training samples: {len(ml_classifier.training_data)}")
    print(f"Model trained: {ml_classifier.model_trained}")
    
    # Create test samples with realistic PCR curve data
    test_samples = [
        {
            'name': 'Strong_Positive_Test',
            'pathogen': 'NGON',
            'rfu_data': list(range(100, 50000, 1200)),  # Strong exponential growth
            'cycles': list(range(1, 41)),
            'metrics': {
                'amplitude': 45000, 'r2_score': 0.999, 'snr': 35.0, 'steepness': 0.98,
                'is_good_scurve': True, 'cqj': 15.2, 'calcj': 14.8, 'midpoint': 4.5,
                'baseline': 50, 'max_slope': 5500, 'curve_efficiency': 0.99,
                'sample': 'Strong_Positive_Test', 'channel': 'FAM'
            },
            'expert_class': 'STRONG_POSITIVE'
        },
        {
            'name': 'Weak_Positive_Test', 
            'pathogen': 'CT',
            'rfu_data': [100] * 25 + list(range(100, 8000, 300)),  # Late, weak growth
            'cycles': list(range(1, 41)),
            'metrics': {
                'amplitude': 7500, 'r2_score': 0.92, 'snr': 12.0, 'steepness': 0.75,
                'is_good_scurve': True, 'cqj': 28.5, 'calcj': 27.8, 'midpoint': 9.2,
                'baseline': 95, 'max_slope': 850, 'curve_efficiency': 0.82,
                'sample': 'Weak_Positive_Test', 'channel': 'Texas_Red'
            },
            'expert_class': 'WEAK_POSITIVE'
        },
        {
            'name': 'Negative_Test',
            'pathogen': 'NGON', 
            'rfu_data': [100 + np.random.normal(0, 5) for _ in range(40)],  # Flat noise
            'cycles': list(range(1, 41)),
            'metrics': {
                'amplitude': 25, 'r2_score': 0.02, 'snr': 0.15, 'steepness': 0.01,
                'is_good_scurve': False, 'midpoint': 0, 'baseline': 100, 
                'max_slope': 5, 'curve_efficiency': 0.0,
                'sample': 'Negative_Test', 'channel': 'FAM'
            },
            'expert_class': 'NEGATIVE'
        },
        {
            'name': 'Suspicious_Test',
            'pathogen': 'CT',
            'rfu_data': [150] * 30 + [150 + i*50 for i in range(10)],  # Late suspicious rise
            'cycles': list(range(1, 41)),
            'metrics': {
                'amplitude': 650, 'r2_score': 0.75, 'snr': 4.2, 'steepness': 0.45,
                'is_good_scurve': False, 'cqj': 35.8, 'calcj': 35.2, 'midpoint': 12.5,
                'baseline': 140, 'max_slope': 75, 'curve_efficiency': 0.62,
                'sample': 'Suspicious_Test', 'channel': 'Texas_Red'
            },
            'expert_class': 'SUSPICIOUS'
        },
        {
            'name': 'Another_Strong_Positive',
            'pathogen': 'NGON',
            'rfu_data': list(range(80, 38000, 950)),  # Another strong positive
            'cycles': list(range(1, 41)),
            'metrics': {
                'amplitude': 37500, 'r2_score': 0.998, 'snr': 32.0, 'steepness': 0.96,
                'is_good_scurve': True, 'cqj': 17.1, 'calcj': 16.7, 'midpoint': 5.1,
                'baseline': 75, 'max_slope': 4200, 'curve_efficiency': 0.97,
                'sample': 'Another_Strong_Positive', 'channel': 'FAM'
            },
            'expert_class': 'STRONG_POSITIVE'
        }
    ]
    
    print(f"\n🎯 Adding {len(test_samples)} expert-labeled training samples...")
    
    # Add training samples one by one and observe the training process
    for i, sample in enumerate(test_samples, 1):
        print(f"\n--- Adding Sample {i}: {sample['name']} ({sample['expert_class']}) ---")
        
        ml_classifier.add_training_sample(
            rfu_data=sample['rfu_data'],
            cycles=sample['cycles'], 
            existing_metrics=sample['metrics'],
            expert_classification=sample['expert_class'],
            well_id=sample['name'],
            pathogen=sample['pathogen']
        )
        
        print(f"✅ Sample added. Total samples: {len(ml_classifier.training_data)}")
        print(f"   Model trained: {ml_classifier.model_trained}")
        
        if ml_classifier.model_trained:
            print(f"   Model accuracy: {ml_classifier.last_accuracy:.3f}")
            
    print(f"\n🎉 TRAINING COMPLETE!")
    print(f"Final training samples: {len(ml_classifier.training_data)}")
    print(f"Model trained: {ml_classifier.model_trained}")
    print(f"Final accuracy: {ml_classifier.last_accuracy:.3f}")
    
    # Test predictions on new data
    print(f"\n🔍 TESTING PREDICTIONS ON NEW DATA")
    print("-" * 40)
    
    test_cases = [
        {
            'name': 'Unknown_Strong_Positive',
            'pathogen': 'NGON',
            'rfu_data': list(range(90, 42000, 1050)),
            'cycles': list(range(1, 41)),
            'metrics': {
                'amplitude': 41000, 'r2_score': 0.997, 'snr': 34.0, 'steepness': 0.97,
                'is_good_scurve': True, 'cqj': 16.5, 'calcj': 16.1, 'midpoint': 4.8,
                'baseline': 85, 'max_slope': 4800, 'curve_efficiency': 0.98
            },
            'expected': 'STRONG_POSITIVE'
        },
        {
            'name': 'Unknown_Negative',
            'pathogen': 'CT',
            'rfu_data': [120 + np.random.normal(0, 3) for _ in range(40)],
            'cycles': list(range(1, 41)),
            'metrics': {
                'amplitude': 15, 'r2_score': 0.01, 'snr': 0.08, 'steepness': 0.005,
                'is_good_scurve': False, 'midpoint': 0, 'baseline': 118,
                'max_slope': 3, 'curve_efficiency': 0.0
            },
            'expected': 'NEGATIVE'
        }
    ]
    
    for test_case in test_cases:
        prediction = ml_classifier.predict_classification(
            rfu_data=test_case['rfu_data'],
            cycles=test_case['cycles'],
            existing_metrics=test_case['metrics'],
            pathogen=test_case['pathogen']
        )
        
        print(f"Sample: {test_case['name']}")
        print(f"  Expected: {test_case['expected']}")
        print(f"  Predicted: {prediction['classification']} (confidence: {prediction['confidence']:.3f})")
        print(f"  Method: {prediction['method']}")
        print(f"  ✅ Correct!" if prediction['classification'] == test_case['expected'] else "❌ Incorrect")
        print()

if __name__ == "__main__":
    test_ml_training()
