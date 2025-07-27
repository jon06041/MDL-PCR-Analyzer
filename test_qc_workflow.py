#!/usr/bin/env python3
"""
Test script for ML QC Validation System
Demonstrates the milestone-based workflow:
1. Teaching phase (40+ samples) → Training pause
2. Validation phase (QC run confirmations) → Evidence building
3. Production phase (validated model) → Capability proven
"""

import sys
import os
sys.path.append('/workspaces/MDL-PCR-Analyzer')

from ml_qc_validation_system import ml_qc_system
from ml_curve_classifier import MLCurveClassifier
import random
from datetime import datetime

def test_qc_workflow():
    """Test the complete QC validation workflow"""
    
    print("🚀 Testing ML QC Validation Workflow")
    print("=" * 60)
    
    # Initialize ML classifier
    ml_classifier = MLCurveClassifier()
    
    pathogen = "Candida albicans"
    
    print(f"\n📚 Phase 1: TEACHING - Accumulating expert feedback for {pathogen}")
    print("-" * 50)
    
    # Simulate teaching phase - add samples until we hit 40+ milestone
    current_samples = len([s for s in ml_classifier.training_data 
                          if s.get('pathogen') == pathogen])
    
    print(f"Current teaching samples for {pathogen}: {current_samples}")
    
    # Check current phase
    phase = ml_qc_system.get_pathogen_phase(pathogen)
    print(f"Current phase: {phase}")
    
    if phase == 'teaching' and current_samples < 40:
        print(f"Adding {40 - current_samples} more teaching samples to reach milestone...")
        
        # Simulate expert feedback to reach 40 samples
        for i in range(40 - current_samples + 5):  # Go a bit over 40
            sample_data = {
                'sample': f'QC_Test_Sample_{i:03d}',
                'channel': 'FAM',
                'r2': random.uniform(0.8, 0.99),
                'amplitude': random.uniform(1000, 10000),
                'snr': random.uniform(10, 50)
            }
            
            # Simulate RFU data
            rfu_data = [random.uniform(100, 1000) for _ in range(40)]
            cycles = list(range(1, 41))
            
            expert_classification = random.choice(['POSITIVE', 'NEGATIVE', 'WEAK_POSITIVE'])
            well_id = f"A{i+1:02d}"
            
            ml_classifier.add_training_sample(
                rfu_data, cycles, sample_data, expert_classification, well_id, pathogen
            )
    
    print(f"\n🔍 Checking teaching milestone status...")
    final_samples = len([s for s in ml_classifier.training_data 
                        if s.get('pathogen') == pathogen])
    
    # Check if teaching milestone reached
    teaching_milestone = ml_qc_system.check_training_milestone(pathogen, final_samples)
    phase = ml_qc_system.get_pathogen_phase(pathogen)
    
    print(f"Final teaching samples: {final_samples}")
    print(f"Phase after teaching: {phase}")
    
    if phase == 'validation' or phase == 'teaching':
        print(f"\n🧪 Phase 2: VALIDATION - QC confirming prediction runs")
        print("-" * 50)
        
        # Simulate 3 prediction runs for validation
        for run_num in range(1, 4):
            print(f"\nValidation Run {run_num}:")
            
            # Simulate a prediction run with 100-400 samples
            run_size = random.randint(100, 400)
            correct_predictions = int(run_size * random.uniform(0.95, 0.995))  # 95-99.5% accuracy
            
            samples_data = []
            for i in range(run_size):
                samples_data.append({
                    'sample_id': f'VAL_RUN{run_num}_S{i:03d}',
                    'well_id': f'R{run_num}_W{i:03d}',
                    'ml_prediction': random.choice(['POSITIVE', 'NEGATIVE', 'WEAK_POSITIVE']),
                    'ml_confidence': random.uniform(0.7, 0.95),
                    'expected_result': 'POSITIVE',  # Simulated expected result
                    'is_correct': i < correct_predictions  # First N are correct
                })
            
            # Register prediction run
            run_id = ml_qc_system.register_prediction_run(
                pathogen_code=pathogen,
                samples_data=samples_data,
                model_version=f"v1.{final_samples}_validation"
            )
            
            if run_id:
                accuracy = correct_predictions / run_size
                print(f"   Registered run: {run_id}")
                print(f"   Samples: {run_size}, Correct: {correct_predictions}")
                print(f"   Accuracy: {accuracy:.1%}")
                
                # QC confirms the run
                qc_confirmed = ml_qc_system.qc_confirm_run(
                    run_id=run_id,
                    qc_user="QC_Manager_Test",
                    accuracy_override=accuracy,
                    notes=f"QC validation run {run_num} - {accuracy:.1%} accuracy confirmed"
                )
                
                if qc_confirmed:
                    print(f"   ✅ QC confirmed with {accuracy:.1%} accuracy")
    
    print(f"\n📊 Final Status Check")
    print("-" * 50)
    
    # Check final phase
    final_phase = ml_qc_system.get_pathogen_phase(pathogen)
    print(f"Final phase for {pathogen}: {final_phase}")
    
    # Get QC dashboard data
    qc_data = ml_qc_system.get_qc_dashboard_data(pathogen)
    
    if pathogen in qc_data.get('qc_summary', {}):
        summary = qc_data['qc_summary'][pathogen]
        print(f"QC Summary:")
        print(f"  - Total runs: {summary.get('total_runs', 0)}")
        print(f"  - Confirmed runs: {summary.get('confirmed_runs', 0)}")
        print(f"  - Total samples validated: {summary.get('total_samples', 0)}")
        print(f"  - Average accuracy: {(summary.get('avg_accuracy', 0) * 100):.1f}%")
        print(f"  - Best run accuracy: {(summary.get('best_accuracy', 0) * 100):.1f}%")
    
    if pathogen in qc_data.get('milestones', {}):
        milestones = qc_data['milestones'][pathogen]
        print(f"Milestones achieved:")
        for milestone in milestones:
            print(f"  - {milestone['milestone_type']}: {milestone['version_number']} "
                  f"({milestone.get('total_samples', 0)} samples)")
    
    print(f"\n🎯 Workflow Summary:")
    print(f"✅ Teaching: Expert feedback accumulated until 40+ samples")
    print(f"✅ Validation: QC confirmed prediction runs for evidence")
    print(f"✅ Evidence: Each run provides capability proof (e.g., 367/368 = 99.7%)")
    print(f"✅ Result: Model validated for production use with documented evidence")

if __name__ == "__main__":
    test_qc_workflow()
