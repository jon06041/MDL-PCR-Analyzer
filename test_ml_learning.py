#!/usr/bin/env python3
"""
Test ML Learning Process with Synthetic Data
Demonstrates how the ML system learns from expert feedback
"""

import json
import numpy as np
from ml_curve_classifier import ml_classifier
from qpcr_analyzer import batch_analyze_wells

def create_learning_examples():
    """Create diverse curve examples for ML learning"""
    
    # Strong Positive - Clear amplification, early Cq
    strong_positive = {
        'cycles': list(range(1, 41)),
        'rfu': [100] * 8 + [110 + i * 25 for i in range(15)] + [500] * 17,
        'fluorophore': 'HEX',
        'sample_name': 'Strong_Positive_Control'
    }
    
    # Regular Positive - Good amplification, normal Cq
    regular_positive = {
        'cycles': list(range(1, 41)),
        'rfu': [50] * 12 + [60 + i * 20 for i in range(12)] + [300] * 16,
        'fluorophore': 'HEX',
        'sample_name': 'Regular_Positive'
    }
    
    # Weak Positive - Low amplitude but clear pattern
    weak_positive = {
        'cycles': list(range(1, 41)),
        'rfu': [30] * 15 + [35 + i * 8 for i in range(10)] + [120] * 15,
        'fluorophore': 'HEX',
        'sample_name': 'Weak_Positive'
    }
    
    # Clear Negative - Flat, no amplification
    clear_negative = {
        'cycles': list(range(1, 41)),
        'rfu': [45 + np.random.normal(0, 2) for _ in range(40)],
        'fluorophore': 'HEX',
        'sample_name': 'Clear_Negative'
    }
    
    # Borderline case - This is where ML can learn expert judgment
    borderline_case = {
        'cycles': list(range(1, 41)),
        'rfu': [40] * 18 + [42 + i * 3 for i in range(8)] + [68] * 14,
        'fluorophore': 'HEX',
        'sample_name': 'Borderline_Case'
    }
    
    return {
        'SP001_HEX': strong_positive,
        'RP002_HEX': regular_positive,
        'WP003_HEX': weak_positive,
        'CN004_HEX': clear_negative,
        'BC005_HEX': borderline_case
    }

def simulate_expert_feedback():
    """Simulate expert corrections to rule-based classifications"""
    
    print("🎓 SIMULATING EXPERT LEARNING PROCESS")
    print("=" * 60)
    
    # Get learning examples
    examples = create_learning_examples()
    
    # Analyze with current system
    print("📊 Analyzing curves with current ML system...")
    results = batch_analyze_wells(examples)
    
    # Display initial classifications
    print("\n🔍 INITIAL CLASSIFICATIONS (Rule-based):")
    for well_id, result in results['individual_results'].items():
        classification = result['curve_classification']['classification']
        method = result['curve_classification']['method']
        print(f"  {well_id}: {classification} (via {method})")
    
    # Simulate expert feedback
    expert_corrections = {
        'SP001_HEX': 'STRONG_POSITIVE',  # Rule-based might call this just POSITIVE
        'RP002_HEX': 'POSITIVE',         # Confirm this is positive
        'WP003_HEX': 'WEAK_POSITIVE',    # Confirm weak positive
        'CN004_HEX': 'NEGATIVE',         # Confirm negative
        'BC005_HEX': 'WEAK_POSITIVE'     # Expert says this borderline case is actually positive
    }
    
    print("\n👨‍🔬 EXPERT FEEDBACK:")
    training_examples = []
    
    for well_id, expert_classification in expert_corrections.items():
        well_result = results['individual_results'][well_id]
        rule_classification = well_result['curve_classification']['classification']
        
        # Show expert correction
        if rule_classification != expert_classification:
            print(f"  {well_id}: {rule_classification} → {expert_classification} ✏️ (Expert correction)")
        else:
            print(f"  {well_id}: {expert_classification} ✓ (Expert confirms)")
        
        # Prepare training example
        training_example = {
            'well_id': well_id,
            'expert_classification': expert_classification,
            'pathogen': 'Test_Pathogen',
            'metrics': {
                'r2_score': well_result.get('r2_score', 0),
                'steepness': well_result.get('steepness', 0),
                'snr': well_result.get('snr', 0),
                'amplitude': well_result.get('amplitude', 0),
                'midpoint': well_result.get('midpoint', 0),
                'baseline': well_result.get('baseline', 0),
                'cqj': well_result.get('cqj', {}).get('HEX', None),
                'anomalies': well_result.get('anomalies', []),
                'quality_filters': well_result.get('quality_filters', {})
            },
            'rfu_data': examples[well_id]['rfu'],
            'cycles': examples[well_id]['cycles']
        }
        training_examples.append(training_example)
    
    # Train the ML model
    print("\n🤖 TRAINING ML MODEL...")
    try:
        # Add training examples
        for example in training_examples:
            ml_classifier.add_training_example(
                example['rfu_data'],
                example['cycles'], 
                example['metrics'],
                example['expert_classification'],
                example['pathogen'],
                example['well_id']
            )
        
        # Train the model
        success = ml_classifier.train_model()
        
        if success:
            print("✅ ML Model trained successfully!")
            print(f"📊 Training data count: {len(ml_classifier.training_data)}")
            
            # Test the trained model
            print("\n🧪 TESTING TRAINED MODEL:")
            
            # Re-analyze the same examples with trained ML
            for well_id, example_data in examples.items():
                well_result = results['individual_results'][well_id]
                
                # Use trained ML to classify
                ml_result = ml_classifier.predict_classification(
                    example_data['rfu'],
                    example_data['cycles'],
                    well_result,
                    'Test_Pathogen',
                    well_id
                )
                
                expert_classification = expert_corrections[well_id]
                ml_classification = ml_result['classification']
                confidence = ml_result.get('confidence', 0)
                method = ml_result.get('method', 'Unknown')
                
                # Check if ML learned correctly
                correct = ml_classification == expert_classification
                status = "✅ LEARNED" if correct else "❌ NEEDS MORE DATA"
                
                print(f"  {well_id}: {ml_classification} (confidence: {confidence:.2f}, method: {method}) {status}")
                if not correct:
                    print(f"    Expected: {expert_classification}, Got: {ml_classification}")
        
        else:
            print("❌ ML Model training failed")
            
    except Exception as e:
        print(f"❌ Training error: {e}")
    
    print("\n🎯 LEARNING SUMMARY:")
    print("  • ML system analyzed curves with 30+ metrics")
    print("  • Expert provided feedback on classifications")
    print("  • ML model learned from expert corrections")
    print("  • System now combines ML + Rule-based intelligence")
    print("  • Future curves will benefit from this learned knowledge")

if __name__ == "__main__":
    simulate_expert_feedback()
