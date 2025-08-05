#!/usr/bin/env python3
"""
Test the ML classifier's fallback with the exact same metrics
"""

from ml_curve_classifier import ml_classifier

def test_ml_fallback():
    print('🔍 TESTING ML FALLBACK CLASSIFICATION')
    print('=' * 60)
    
    # Clear ML to force fallback
    ml_classifier.training_data = []
    ml_classifier.model_trained = False
    if hasattr(ml_classifier, 'pathogen_models'):
        ml_classifier.pathogen_models = {}
    
    # Test metrics - these should be STRONG_POSITIVE
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
        'curve_efficiency': 0.99,
        'sample': 'Test_Strong_Positive',
        'channel': 'FAM'
    }
    
    print('Input metrics:')
    for key, value in metrics.items():
        print(f'  {key}: {value}')
    print()
    
    # Call the ML classifier prediction (should use fallback)
    result = ml_classifier.predict_classification([], [], metrics, 'NGON')
    
    print('ML Classifier result:')
    print(f'  Classification: {result["classification"]}')
    print(f'  Confidence: {result["confidence"]}')
    print(f'  Method: {result["method"]}')
    print(f'  Reason: {result.get("reason", "N/A")}')
    print()
    
    expected = 'STRONG_POSITIVE'
    actual = result['classification']
    
    if actual == expected:
        print(f'✅ CORRECT: ML fallback returned {actual}')
    else:
        print(f'❌ BUG: Expected {expected}, got {actual}')
        print('   The ML fallback is not working correctly!')

if __name__ == "__main__":
    test_ml_fallback()
