#!/usr/bin/env python3
"""
Test script to verify JSON serialization is working correctly
"""
import json
import sys
import os

# Add the current directory to the path so we can import our modules
sys.path.insert(0, os.path.dirname(__file__))

from app import app, db
from models import AnalysisSession, WellResult

def test_json_serialization():
    """Test that JSON serialization/deserialization works correctly"""
    
    with app.app_context():
        # Create tables if they don't exist
        db.create_all()
        
        # Sample data that should be JSON serialized
        sample_data = {
            'fit_parameters': [1.0, 2.0, 3.0, 4.0],
            'fitted_curve': [10.1, 20.2, 30.3, 40.4],
            'anomalies': ['high_noise', 'drift'],
            'raw_cycles': [1, 2, 3, 4, 5],
            'raw_rfu': [100.5, 200.7, 300.9, 400.1, 500.3]
        }
        
        print("Original data:")
        for key, value in sample_data.items():
            print(f"  {key}: {value} (type: {type(value)})")
        
        # Test 1: Create a session and well result
        session = AnalysisSession()
        session.filename = "Test JSON Serialization"
        session.total_wells = 1
        session.good_curves = 1
        session.success_rate = 100.0
        session.cycle_count = 40
        session.cycle_min = 1
        session.cycle_max = 40
        db.session.add(session)
        db.session.flush()
        
        # Test 2: Create well result with JSON serialization (as done in app.py)
        well_result = WellResult()
        well_result.session_id = session.id
        well_result.well_id = "A1_TEST"
        well_result.is_good_scurve = True
        well_result.amplitude = 1000.0
        
        # Apply JSON serialization exactly like in app.py
        well_result.fit_parameters = json.dumps(sample_data.get('fit_parameters', [])) if sample_data.get('fit_parameters') is not None else None
        well_result.fitted_curve = json.dumps(sample_data.get('fitted_curve', [])) if sample_data.get('fitted_curve') is not None else None
        well_result.anomalies = json.dumps(sample_data.get('anomalies', [])) if sample_data.get('anomalies') is not None else None
        well_result.raw_cycles = json.dumps(sample_data.get('raw_cycles', [])) if sample_data.get('raw_cycles') is not None else None
        well_result.raw_rfu = json.dumps(sample_data.get('raw_rfu', [])) if sample_data.get('raw_rfu') is not None else None
        
        print("\nAfter JSON serialization (stored values):")
        print(f"  fit_parameters: {well_result.fit_parameters} (type: {type(well_result.fit_parameters)})")
        print(f"  fitted_curve: {well_result.fitted_curve} (type: {type(well_result.fitted_curve)})")
        print(f"  anomalies: {well_result.anomalies} (type: {type(well_result.anomalies)})")
        print(f"  raw_cycles: {well_result.raw_cycles} (type: {type(well_result.raw_cycles)})")
        print(f"  raw_rfu: {well_result.raw_rfu} (type: {type(well_result.raw_rfu)})")
        
        db.session.add(well_result)
        db.session.commit()
        
        # Test 3: Retrieve the data and check deserialization via to_dict()
        retrieved_well = WellResult.query.filter_by(well_id="A1_TEST").first()
        if retrieved_well:
            well_dict = retrieved_well.to_dict()
            
            print("\nAfter retrieval and to_dict() deserialization:")
            for key in ['fit_parameters', 'fitted_curve', 'anomalies', 'raw_cycles', 'raw_rfu']:
                value = well_dict.get(key)
                print(f"  {key}: {value} (type: {type(value)})")
            
            # Test 4: Verify data integrity
            print("\nData integrity check:")
            for key in ['fit_parameters', 'fitted_curve', 'anomalies', 'raw_cycles', 'raw_rfu']:
                original = sample_data[key]
                retrieved = well_dict.get(key)
                is_equal = original == retrieved
                print(f"  {key}: {'✓ PASS' if is_equal else '✗ FAIL'} (original: {original}, retrieved: {retrieved})")
        
        # Clean up
        db.session.delete(retrieved_well)
        db.session.delete(session)
        db.session.commit()
        
        print("\nTest completed!")

if __name__ == "__main__":
    test_json_serialization()
