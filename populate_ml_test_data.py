#!/usr/bin/env python3
"""
Test script to populate ML validation tracking data
This demonstrates how the enhanced ML validation system works
"""

import sys
import os
sys.path.append('/workspaces/MDL-PCR-Analyzer')

from ml_validation_tracker import ml_tracker
import random
from datetime import datetime, timedelta

def populate_test_data():
    """Populate test ML validation tracking data"""
    
    print("🚀 Populating test ML validation tracking data...")
    
    # Test pathogens
    pathogens = [
        'Candida albicans', 'Candida glabrata', 'Chlamydia trachomatis',
        'Neisseria gonorrhea', 'Mycoplasma genitalium', 'General_PCR'
    ]
    
    # Sample classifications
    classifications = ['POSITIVE', 'NEGATIVE', 'WEAK_POSITIVE', 'INDETERMINATE']
    
    # Create pathogen-specific model versions
    for pathogen in pathogens:
        if pathogen != 'General_PCR':
            accuracy = random.uniform(0.85, 0.98)
            training_samples = random.randint(10, 50)
            version = f"1.{training_samples}"
            
            print(f"  📊 Creating model version for {pathogen}")
            ml_tracker.update_pathogen_model_version(
                pathogen=pathogen,
                version=version,
                accuracy=accuracy,
                training_samples=training_samples,
                deployment_status='active'
            )
            
            # Track training event
            ml_tracker.track_training_event(
                pathogen=pathogen,
                training_samples=training_samples,
                accuracy=accuracy,
                model_version=version,
                trigger_reason="initial_pathogen_model_training",
                user_id='ml_system'
            )
    
    # Generate sample predictions and expert decisions
    print("  🔮 Generating sample predictions and expert decisions...")
    
    for i in range(100):  # 100 sample predictions
        pathogen = random.choice(pathogens)
        well_id = f"well_{i:03d}"
        
        # ML prediction
        ml_prediction = random.choice(classifications)
        confidence = random.uniform(0.6, 0.95)
        
        # Track prediction
        ml_tracker.track_model_prediction(
            well_id=well_id,
            pathogen=pathogen,
            prediction=ml_prediction,
            confidence=confidence,
            features_used={
                'r2': random.uniform(0.8, 0.99),
                'amplitude': random.uniform(100, 10000),
                'snr': random.uniform(5, 50)
            },
            model_version=f"{pathogen}_1.0",
            user_id='ml_system'
        )
        
        # Sometimes expert provides feedback (30% of the time)
        if random.random() < 0.3:
            # Expert decision - sometimes agrees, sometimes corrects
            if random.random() < 0.8:  # 80% agreement rate
                expert_decision = ml_prediction
            else:  # 20% correction rate
                expert_decision = random.choice([c for c in classifications if c != ml_prediction])
            
            # Track expert decision
            ml_tracker.track_expert_decision(
                well_id=well_id,
                original_prediction=ml_prediction,
                expert_correction=expert_decision,
                pathogen=pathogen,
                confidence=confidence,
                features_used={
                    'r2': random.uniform(0.8, 0.99),
                    'amplitude': random.uniform(100, 10000),
                    'snr': random.uniform(5, 50)
                },
                user_id=f'expert_{random.randint(1, 3)}'
            )
    
    print("✅ Test data population complete!")
    
    # Show summary
    print("\n📈 Summary of populated data:")
    
    # Get dashboard data
    pathogen_data = ml_tracker.get_pathogen_dashboard_data()
    teaching_summary = ml_tracker.get_expert_teaching_summary()
    
    print(f"  🦠 Pathogen models created: {len(pathogen_data)}")
    for pathogen, data in pathogen_data.items():
        print(f"    - {pathogen}: {data['training_samples']} samples, {data['accuracy']:.1%} accuracy")
    
    print(f"  👨‍🔬 Expert teaching summary:")
    print(f"    - Total decisions: {teaching_summary.get('total_decisions', 0)}")
    print(f"    - Confirmations: {teaching_summary.get('confirmations', 0)}")
    print(f"    - Corrections: {teaching_summary.get('corrections', 0)}")
    print(f"    - New knowledge: {teaching_summary.get('new_knowledge', 0)}")
    print(f"    - Teaching score: {(teaching_summary.get('avg_improvement', 0) * 100):.1f}%")

if __name__ == "__main__":
    populate_test_data()
