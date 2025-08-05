#!/usr/bin/env python3
"""
ML Learning Progression Test
Demonstrates how the ML system improves from rule-based baseline to trained ML model
"""

import json
import time
from datetime import datetime
from ml_curve_classifier import ml_classifier

class MLLearningTester:
    def __init__(self):
        self.test_results = []
        self.baseline_accuracy = 0.0
        self.final_accuracy = 0.0
        
    def create_test_samples(self):
        """Create diverse test samples representing different curve qualities"""
        return [
            # Strong positive samples
            {
                'name': 'Strong_Positive_1',
                'rfu_data': [50, 100, 300, 800, 1500, 2000, 2100, 2150],
                'cycles': [1, 2, 3, 4, 5, 6, 7, 8],
                'metrics': {
                    'amplitude': 2000,
                    'r2_score': 0.98,
                    'snr': 15,
                    'steepness': 0.8,
                    'is_good_scurve': True,
                    'cqj': 25.5,
                    'calcj': 24.8
                },
                'expected': 'STRONG_POSITIVE',
                'pathogen': 'NGON'
            },
            {
                'name': 'Strong_Positive_2',
                'rfu_data': [40, 80, 250, 700, 1400, 1900, 2000, 2050],
                'cycles': [1, 2, 3, 4, 5, 6, 7, 8],
                'metrics': {
                    'amplitude': 1900,
                    'r2_score': 0.96,
                    'snr': 12,
                    'steepness': 0.75,
                    'is_good_scurve': True,
                    'cqj': 26.2,
                    'calcj': 25.1
                },
                'expected': 'STRONG_POSITIVE',
                'pathogen': 'CT'
            },
            
            # Weak positive samples
            {
                'name': 'Weak_Positive_1',
                'rfu_data': [100, 150, 250, 400, 650, 800, 900, 950],
                'cycles': [1, 2, 3, 4, 5, 6, 7, 8],
                'metrics': {
                    'amplitude': 800,
                    'r2_score': 0.85,
                    'snr': 4,
                    'steepness': 0.3,
                    'is_good_scurve': False,
                    'cqj': 32.5,
                    'calcj': 31.8
                },
                'expected': 'WEAK_POSITIVE',
                'pathogen': 'NGON'
            },
            {
                'name': 'Weak_Positive_2',
                'rfu_data': [80, 120, 200, 350, 550, 700, 780, 820],
                'cycles': [1, 2, 3, 4, 5, 6, 7, 8],
                'metrics': {
                    'amplitude': 700,
                    'r2_score': 0.82,
                    'snr': 3.5,
                    'steepness': 0.25,
                    'is_good_scurve': False,
                    'cqj': 34.1,
                    'calcj': 33.2
                },
                'expected': 'WEAK_POSITIVE',
                'pathogen': 'CT'
            },
            
            # Negative samples
            {
                'name': 'Negative_1',
                'rfu_data': [100, 105, 110, 115, 120, 125, 130, 135],
                'cycles': [1, 2, 3, 4, 5, 6, 7, 8],
                'metrics': {
                    'amplitude': 35,
                    'r2_score': 0.15,
                    'snr': 0.8,
                    'steepness': 0.05,
                    'is_good_scurve': False
                },
                'expected': 'NEGATIVE',
                'pathogen': 'NGON'
            },
            {
                'name': 'Negative_2',
                'rfu_data': [90, 92, 95, 98, 100, 102, 105, 108],
                'cycles': [1, 2, 3, 4, 5, 6, 7, 8],
                'metrics': {
                    'amplitude': 18,
                    'r2_score': 0.08,
                    'snr': 0.5,
                    'steepness': 0.02,
                    'is_good_scurve': False
                },
                'expected': 'NEGATIVE',
                'pathogen': 'CT'
            },
            
            # Suspicious samples (borderline cases)
            {
                'name': 'Suspicious_1',
                'rfu_data': [100, 200, 500, 1000, 1200, 1300, 1350, 1400],
                'cycles': [1, 2, 3, 4, 5, 6, 7, 8],
                'metrics': {
                    'amplitude': 1300,
                    'r2_score': 0.75,
                    'snr': 8,
                    'steepness': 0.4,
                    'is_good_scurve': False,
                    'cqj': 35.5,
                    'calcj': 34.2
                },
                'expected': 'SUSPICIOUS',
                'pathogen': 'NGON'
            },
            {
                'name': 'Suspicious_2',
                'rfu_data': [150, 250, 400, 600, 800, 950, 1000, 1050],
                'cycles': [1, 2, 3, 4, 5, 6, 7, 8],
                'metrics': {
                    'amplitude': 900,
                    'r2_score': 0.70,
                    'snr': 6,
                    'steepness': 0.35,
                    'is_good_scurve': False,
                    'cqj': 36.8,
                    'calcj': 35.9
                },
                'expected': 'SUSPICIOUS',
                'pathogen': 'CT'
            }
        ]
        
    def test_prediction_accuracy(self, test_samples, phase_name):
        """Test prediction accuracy on a set of samples"""
        correct_predictions = 0
        total_predictions = len(test_samples)
        detailed_results = []
        
        for sample in test_samples:
            prediction = ml_classifier.predict_classification(
                rfu_data=sample['rfu_data'],
                cycles=sample['cycles'],
                existing_metrics=sample['metrics'],
                pathogen=sample['pathogen']
            )
            
            predicted_class = prediction.get('classification')
            expected_class = sample['expected']
            is_correct = predicted_class == expected_class
            
            if is_correct:
                correct_predictions += 1
                
            detailed_results.append({
                'sample_name': sample['name'],
                'expected': expected_class,
                'predicted': predicted_class,
                'correct': is_correct,
                'confidence': prediction.get('confidence', 0.0),
                'method': prediction.get('method', 'Unknown'),
                'pathogen': sample['pathogen']
            })
        
        accuracy = (correct_predictions / total_predictions) * 100 if total_predictions > 0 else 0
        
        return {
            'phase': phase_name,
            'accuracy': accuracy,
            'correct': correct_predictions,
            'total': total_predictions,
            'method': detailed_results[0]['method'] if detailed_results else 'Unknown',
            'detailed_results': detailed_results,
            'timestamp': datetime.now().isoformat()
        }
    
    def provide_expert_feedback(self, test_samples):
        """Simulate expert feedback by training on samples with correct classifications"""
        feedback_count = 0
        
        for sample in test_samples:
            # Add expert feedback to train the model
            ml_classifier.add_training_sample(
                rfu_data=sample['rfu_data'],
                cycles=sample['cycles'],
                existing_metrics=sample['metrics'],
                expert_classification=sample['expected'],
                well_id=f"test_{sample['name']}",
                pathogen=sample['pathogen']
            )
            feedback_count += 1
            
        return feedback_count
    
    def run_learning_progression_test(self):
        """Run complete learning progression test"""
        print("🧪 Starting ML Learning Progression Test")
        print("=" * 60)
        
        # Get test samples
        test_samples = self.create_test_samples()
        
        # Phase 1: Test baseline rule-based accuracy
        print("\n📊 Phase 1: Testing Rule-Based Baseline")
        baseline_results = self.test_prediction_accuracy(test_samples, "Rule-Based Baseline")
        self.baseline_accuracy = baseline_results['accuracy']
        self.test_results.append(baseline_results)
        
        print(f"Rule-Based Accuracy: {baseline_results['accuracy']:.1f}%")
        print(f"Method: {baseline_results['method']}")
        
        # Phase 2: Provide expert feedback (training)
        print("\n🎓 Phase 2: Providing Expert Feedback")
        feedback_count = self.provide_expert_feedback(test_samples)
        print(f"Expert feedback provided for {feedback_count} samples")
        
        # Trigger model retraining
        print("🔄 Retraining ML model...")
        retrain_success = ml_classifier.retrain_model()
        print(f"Model retrained successfully: {retrain_success}")
        
        # Phase 3: Test ML model accuracy after training
        print("\n🤖 Phase 3: Testing Trained ML Model")
        ml_results = self.test_prediction_accuracy(test_samples, "Trained ML Model")
        self.final_accuracy = ml_results['accuracy']
        self.test_results.append(ml_results)
        
        print(f"ML Model Accuracy: {ml_results['accuracy']:.1f}%")
        print(f"Method: {ml_results['method']}")
        
        # Calculate improvement
        improvement = self.final_accuracy - self.baseline_accuracy
        improvement_percent = (improvement / self.baseline_accuracy) * 100 if self.baseline_accuracy > 0 else 0
        
        print(f"\n📈 Learning Improvement: {improvement:+.1f}% ({improvement_percent:+.1f}% relative)")
        
        # Generate detailed report
        return self.generate_report()
    
    def generate_report(self):
        """Generate comprehensive test report"""
        report = {
            'test_summary': {
                'test_name': 'ML Learning Progression Test',
                'timestamp': datetime.now().isoformat(),
                'baseline_accuracy': self.baseline_accuracy,
                'final_accuracy': self.final_accuracy,
                'improvement': self.final_accuracy - self.baseline_accuracy,
                'improvement_percent': ((self.final_accuracy - self.baseline_accuracy) / self.baseline_accuracy) * 100 if self.baseline_accuracy > 0 else 0,
                'training_samples': len(ml_classifier.training_data)
            },
            'phase_results': self.test_results,
            'model_stats': ml_classifier.get_model_stats(),
            'recommendations': self.generate_recommendations()
        }
        
        return report
    
    def generate_recommendations(self):
        """Generate recommendations based on test results"""
        recommendations = []
        
        improvement = self.final_accuracy - self.baseline_accuracy
        
        if improvement > 10:
            recommendations.append("✅ Excellent learning progression - ML model significantly outperforms rule-based baseline")
        elif improvement > 0:
            recommendations.append("✅ Positive learning - ML model shows improvement over baseline")
        else:
            recommendations.append("⚠️ Limited learning - Consider more diverse training samples or feature engineering")
            
        if self.final_accuracy > 80:
            recommendations.append("✅ High accuracy achieved - Model ready for production use")
        elif self.final_accuracy > 60:
            recommendations.append("⚠️ Moderate accuracy - Continue training with more expert feedback")
        else:
            recommendations.append("❌ Low accuracy - Requires significant additional training")
            
        return recommendations

def main():
    """Run the ML learning test and save results"""
    tester = MLLearningTester()
    
    # Run the test
    report = tester.run_learning_progression_test()
    
    # Save results to file
    results_file = f"ml_learning_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    with open(results_file, 'w') as f:
        json.dump(report, f, indent=2)
    
    # Print summary
    print("\n" + "=" * 60)
    print("📋 TEST SUMMARY")
    print("=" * 60)
    print(f"Baseline Accuracy: {report['test_summary']['baseline_accuracy']:.1f}%")
    print(f"Final Accuracy: {report['test_summary']['final_accuracy']:.1f}%")
    print(f"Improvement: {report['test_summary']['improvement']:+.1f}%")
    print(f"Training Samples: {report['test_summary']['training_samples']}")
    print(f"Results saved to: {results_file}")
    
    print("\n📝 RECOMMENDATIONS:")
    for rec in report['recommendations']:
        print(f"  {rec}")
    
    return results_file

if __name__ == "__main__":
    main()
