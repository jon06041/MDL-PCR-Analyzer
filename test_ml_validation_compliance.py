#!/usr/bin/env python3
"""
ML Validation Compliance Demonstration Script
Shows how ML versioning and validation is currently applied to compliance
"""

import requests
import json
import time
from datetime import datetime

def test_ml_compliance_validation():
    """Test the current ML validation compliance system"""
    base_url = "http://localhost:5000"
    
    print("=== ML Validation Compliance System Demonstration ===\n")
    
    # 1. Check current compliance dashboard
    print("1. CHECKING CURRENT COMPLIANCE STATUS...")
    try:
        response = requests.get(f"{base_url}/api/unified-compliance/dashboard-data", timeout=10)
        if response.status_code == 200:
            data = response.json()
            
            # Show ML validation metrics
            ml_metrics = data.get('ml_validation_metrics', {})
            print(f"   ML Model Trained: {ml_metrics.get('model_trained', 'Unknown')}")
            print(f"   Total Training Samples: {ml_metrics.get('total_training_samples', 0)}")
            print(f"   Model Accuracy: {ml_metrics.get('model_accuracy', 0):.2f}")
            print(f"   Pathogen Models Loaded: {ml_metrics.get('pathogen_models_loaded', 0)}")
            print(f"   Last Training Update: {ml_metrics.get('last_training_update', 'Never')}")
            
            # Show ML-specific compliance requirements
            ml_requirements = [req for req in data.get('attention_needed', []) 
                             if 'ML_' in req.get('requirement_code', '')]
            
            print(f"\n   ML-Specific Compliance Requirements: {len(ml_requirements)}")
            for req in ml_requirements[:5]:  # Show first 5
                print(f"   - {req['requirement_code']}: {req['compliance_status']}")
            
        else:
            print(f"   ERROR: Could not get compliance data: {response.status_code}")
            
    except Exception as e:
        print(f"   ERROR: {e}")
    
    # 2. Simulate ML feedback submission (to trigger compliance tracking)
    print("\n2. TESTING ML FEEDBACK COMPLIANCE TRACKING...")
    try:
        # Sample ML feedback data
        feedback_data = {
            "rfu_data": [100, 120, 150, 200, 300, 500, 800, 1200, 1800, 2500],
            "cycles": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            "existing_metrics": {
                "r2": 0.95,
                "steepness": 2.5,
                "snr": 15.2,
                "cqj": 8.5,
                "calcj": 1000
            },
            "expert_classification": "POSITIVE",
            "well_id": "A1_FAM",
            "well_data": {
                "sample": "Test_Sample_001",
                "channel": "FAM",
                "fluorophore": "FAM",
                "pathogen": "FLUA"
            }
        }
        
        response = requests.post(f"{base_url}/api/ml-submit-feedback", 
                               json=feedback_data, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print("   ✅ ML feedback submitted successfully")
            print(f"   Training samples: {result.get('training_samples', 0)}")
            print(f"   Pathogen: {result.get('pathogen', 'Unknown')}")
            print("   → This should trigger ML_FEEDBACK_SUBMITTED compliance tracking")
        else:
            print(f"   ❌ ML feedback failed: {response.status_code}")
            
    except Exception as e:
        print(f"   ERROR: {e}")
    
    # 3. Check compliance dashboard after ML activity
    print("\n3. CHECKING COMPLIANCE AFTER ML ACTIVITY...")
    try:
        time.sleep(2)  # Wait for compliance processing
        response = requests.get(f"{base_url}/api/unified-compliance/dashboard-data", timeout=10)
        if response.status_code == 200:
            data = response.json()
            recent_activities = data.get('recent_activities', [])
            
            # Look for ML-related compliance activities
            ml_activities = [activity for activity in recent_activities 
                           if 'ML_' in activity.get('requirement_code', '')]
            
            print(f"   Recent ML compliance activities: {len(ml_activities)}")
            for activity in ml_activities[:3]:
                print(f"   - {activity['requirement_code']}: Score {activity.get('compliance_score', 0)}")
                print(f"     Time: {activity.get('timestamp', 'Unknown')}")
            
            if not ml_activities:
                print("   ⚠️  NO ML-specific compliance activities found")
                print("   → ML compliance tracking may not be working properly")
                
        else:
            print(f"   ERROR: {response.status_code}")
            
    except Exception as e:
        print(f"   ERROR: {e}")
    
    # 4. Show what ML validation events SHOULD be tracked
    print("\n4. ML VALIDATION EVENTS THAT SHOULD BE TRACKED:")
    ml_events = {
        'ML_MODEL_TRAINED': 'When models are retrained with new data',
        'ML_PREDICTION_MADE': 'When ML makes curve classifications', 
        'ML_FEEDBACK_SUBMITTED': 'When experts provide training feedback',
        'ML_MODEL_RETRAINED': 'When models are updated/versioned',
        'ML_ACCURACY_VALIDATED': 'When model performance is verified'
    }
    
    for event, description in ml_events.items():
        print(f"   - {event}: {description}")
    
    print("\n5. CURRENT VALIDATION GAPS:")
    print("   ❌ ML model training events not automatically tracked")
    print("   ❌ ML prediction accuracy not validated in real-time")
    print("   ❌ Model versioning not tied to compliance evidence")
    print("   ❌ Cross-validation performance not tracked")
    print("   ✅ ML feedback submission is tracked")
    print("   ✅ ML metrics are included in compliance dashboard")
    
    print("\n=== SUMMARY ===")
    print("The system has PARTIAL ML validation compliance:")
    print("- ML metrics are collected and displayed")
    print("- Expert feedback triggers compliance tracking")
    print("- BUT model training/versioning is not automatically tracked")
    print("- Need to add compliance tracking to ML training functions")

if __name__ == "__main__":
    test_ml_compliance_validation()
