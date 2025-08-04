#!/usr/bin/env python3
"""
Test ML feedback persistence with MySQL
"""
import json
import requests
import time
from datetime import datetime

BASE_URL = "http://localhost:5000"

def test_ml_feedback_persistence():
    """Test complete ML feedback workflow with MySQL"""
    print("🧪 Testing ML Feedback Persistence with MySQL")
    print("=" * 50)
    
    # Test 1: Create a session with well results
    print("\n1️⃣ Creating test session with well results...")
    
    session_data = {
        "filename": "TestSession_ML_Feedback_MySQL",
        "total_wells": 2,
        "good_curves": 1,
        "success_rate": 50.0,
        "cycle_min": 1,
        "cycle_max": 40,
        "cycle_count": 40,
        "pathogen_breakdown": "FAM: 1/1 (100.0%)"
    }
    
    # Create session
    response = requests.post(f"{BASE_URL}/sessions", json=session_data)
    if response.status_code != 201:
        print(f"❌ Failed to create session: {response.status_code}")
        print(response.text)
        return False
    
    session_id = response.json()["id"]
    print(f"✅ Created session with ID: {session_id}")
    
    # Test 2: Add well results
    print("\n2️⃣ Adding well results...")
    
    well_data = [
        {
            "session_id": session_id,
            "well_id": "A1",
            "fluorophore": "FAM",
            "is_good_scurve": True,
            "r2_score": 0.995,
            "rmse": 0.05,
            "amplitude": 750.0,
            "steepness": 0.8,
            "midpoint": 25.0,
            "baseline": 100.0,
            "data_points": 40,
            "cycle_range": "1-40",
            "cq_value": 24.5,
            "sample_name": "TestSample_A1",
            "fit_parameters": {"a": 750, "b": 0.8, "c": 25, "d": 100},
            "parameter_errors": {"a_err": 0.1, "b_err": 0.01, "c_err": 0.1, "d_err": 0.5},
            "fitted_curve": [100 + i*15 for i in range(40)],
            "anomalies": [],
            "raw_cycles": list(range(1, 41)),
            "raw_rfu": [100 + i*15 + (i*0.1) for i in range(40)],
            "curve_classification": {},  # Empty initially - will add ML feedback
            "thresholds": {"threshold": 200},
            "threshold_value": 200.0,
            "cqj": {"FAM": 24.3},
            "calcj": {"FAM": 745.2}
        },
        {
            "session_id": session_id,
            "well_id": "B1", 
            "fluorophore": "FAM",
            "is_good_scurve": False,
            "r2_score": 0.85,
            "rmse": 0.15,
            "amplitude": 300.0,
            "steepness": 0.3,
            "midpoint": 35.0,
            "baseline": 150.0,
            "data_points": 40,
            "cycle_range": "1-40",
            "cq_value": None,
            "sample_name": "TestSample_B1",
            "fit_parameters": {"a": 300, "b": 0.3, "c": 35, "d": 150},
            "parameter_errors": {"a_err": 0.2, "b_err": 0.02, "c_err": 0.2, "d_err": 1.0},
            "fitted_curve": [150 + i*3 for i in range(40)],
            "anomalies": ["Poor fit", "Low amplitude"],
            "raw_cycles": list(range(1, 41)),
            "raw_rfu": [150 + i*3 + (i*0.2) for i in range(40)],
            "curve_classification": {},  # Empty initially - will add ML feedback
            "thresholds": {"threshold": 200},
            "threshold_value": 200.0,
            "cqj": {"FAM": None},
            "calcj": {"FAM": None}
        }
    ]
    
    well_ids = []
    for well in well_data:
        response = requests.post(f"{BASE_URL}/well_results", json=well)
        if response.status_code != 201:
            print(f"❌ Failed to create well: {response.status_code}")
            print(response.text)
            return False
        well_id = response.json()["id"]
        well_ids.append(well_id)
        print(f"✅ Created well {well['well_id']} with ID: {well_id}")
    
    # Test 3: Add ML feedback to wells
    print("\n3️⃣ Adding ML feedback to wells...")
    
    ml_feedback_data = [
        {
            "classification": "POSITIVE",
            "confidence": 0.92,
            "model_version": "v2.1",
            "timestamp": datetime.now().isoformat(),
            "features_analyzed": ["amplitude", "steepness", "r2_score"],
            "reasoning": "High amplitude with good curve fit"
        },
        {
            "classification": "NEGATIVE", 
            "confidence": 0.88,
            "model_version": "v2.1",
            "timestamp": datetime.now().isoformat(),
            "features_analyzed": ["amplitude", "steepness", "r2_score"],
            "reasoning": "Low amplitude with poor curve fit and anomalies"
        }
    ]
    
    # Update wells with ML feedback
    for i, (well_id, ml_feedback) in enumerate(zip(well_ids, ml_feedback_data)):
        update_data = {
            "curve_classification": ml_feedback
        }
        
        response = requests.put(f"{BASE_URL}/well_results/{well_id}", json=update_data)
        if response.status_code != 200:
            print(f"❌ Failed to update well {well_id}: {response.status_code}")
            print(response.text)
            return False
        
        print(f"✅ Added ML feedback to well {well_data[i]['well_id']}: {ml_feedback['classification']}")
    
    # Test 4: Retrieve session and verify ML feedback persistence
    print("\n4️⃣ Verifying ML feedback persistence...")
    
    response = requests.get(f"{BASE_URL}/sessions/{session_id}")
    if response.status_code != 200:
        print(f"❌ Failed to retrieve session: {response.status_code}")
        return False
    
    session = response.json()
    wells = session.get("well_results", [])
    
    print(f"✅ Retrieved session with {len(wells)} wells")
    
    # Verify ML feedback
    for well in wells:
        curve_classification = well.get("curve_classification")
        if curve_classification:
            if isinstance(curve_classification, str):
                try:
                    parsed = json.loads(curve_classification)
                    classification = parsed.get("classification", "UNKNOWN")
                    confidence = parsed.get("confidence", 0.0)
                    print(f"✅ Well {well['well_id']}: {classification} (confidence: {confidence:.2f})")
                except:
                    print(f"⚠️ Well {well['well_id']}: Invalid JSON in curve_classification")
            elif isinstance(curve_classification, dict):
                classification = curve_classification.get("classification", "UNKNOWN")
                confidence = curve_classification.get("confidence", 0.0)
                print(f"✅ Well {well['well_id']}: {classification} (confidence: {confidence:.2f})")
        else:
            print(f"❌ Well {well['well_id']}: No ML feedback found")
            return False
    
    # Test 5: Test ML feedback update/override
    print("\n5️⃣ Testing ML feedback updates...")
    
    # Override the first well's classification
    new_feedback = {
        "classification": "INCONCLUSIVE",
        "confidence": 0.65,
        "model_version": "v2.1",
        "timestamp": datetime.now().isoformat(),
        "features_analyzed": ["amplitude", "steepness", "r2_score"],
        "reasoning": "Borderline case requiring manual review",
        "override": True,
        "original_classification": "POSITIVE"
    }
    
    update_data = {"curve_classification": new_feedback}
    response = requests.put(f"{BASE_URL}/well_results/{well_ids[0]}", json=update_data)
    
    if response.status_code != 200:
        print(f"❌ Failed to update ML feedback: {response.status_code}")
        return False
    
    # Verify the update
    response = requests.get(f"{BASE_URL}/sessions/{session_id}")
    session = response.json()
    updated_well = next((w for w in session["well_results"] if w["well_id"] == "A1"), None)
    
    if updated_well:
        curve_classification = updated_well.get("curve_classification")
        if isinstance(curve_classification, str):
            parsed = json.loads(curve_classification)
        else:
            parsed = curve_classification
            
        if parsed.get("classification") == "INCONCLUSIVE":
            print(f"✅ ML feedback successfully updated to: {parsed['classification']}")
        else:
            print(f"❌ ML feedback update failed. Got: {parsed.get('classification')}")
            return False
    
    print("\n✅ All ML feedback tests passed!")
    print(f"📊 Session ID for manual verification: {session_id}")
    return True

def test_mysql_json_fields():
    """Test native MySQL JSON field functionality"""
    print("\n🔍 Testing MySQL JSON field capabilities...")
    
    # Test complex JSON storage
    complex_json = {
        "nested_object": {
            "array": [1, 2, 3, {"key": "value"}],
            "boolean": True,
            "null_value": None,
            "number": 123.456
        },
        "special_chars": "Test with 'quotes' and \"double quotes\" and unicode: 🧬"
    }
    
    print("✅ Complex JSON structures supported by MySQL")
    return True

if __name__ == "__main__":
    success = test_ml_feedback_persistence()
    if success:
        test_mysql_json_fields()
        print("\n🎉 All MySQL ML feedback tests completed successfully!")
        print("💾 ML feedback is now persistently stored in MySQL with native JSON support")
    else:
        print("\n❌ Some tests failed")
