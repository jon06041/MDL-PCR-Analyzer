#!/usr/bin/env python3

import json
import sys
import os

# Add the current directory to Python path
sys.path.insert(0, '/workspaces/QPCR-S-Curve-Analyzer')

from app import app
from models import db, AnalysisSession, WellResult

def test_json_conversion():
    """Test JSON conversion for session saving"""
    with app.app_context():
        # Sample well data as it might come from frontend (as objects)
        sample_well_data = {
            'fit_parameters': [1.0, 2.0, 3.0, 4.0],
            'parameter_errors': [0.1, 0.2, 0.3, 0.4],
            'fitted_curve': [{'x': 1, 'y': 100}, {'x': 2, 'y': 200}],
            'anomalies': ['spike_detected'],
            'raw_cycles': [1, 2, 3, 4, 5],
            'raw_rfu': [100, 150, 200, 250, 300],
            'amplitude': 500.0,
            'r2_score': 0.95
        }
        
        print("Original well data:")
        print(f"fit_parameters: {sample_well_data['fit_parameters']} (type: {type(sample_well_data['fit_parameters'])})")
        
        # Test the conversion that should happen in the backend
        try:
            # Simulate what happens in save_combined_session
            fit_params_json = json.dumps(sample_well_data.get('fit_parameters', []))
            parameter_errors_json = json.dumps(sample_well_data.get('parameter_errors', []))
            fitted_curve_json = json.dumps(sample_well_data.get('fitted_curve', []))
            anomalies_json = json.dumps(sample_well_data.get('anomalies', []))
            raw_cycles_json = json.dumps(sample_well_data.get('raw_cycles', []))
            raw_rfu_json = json.dumps(sample_well_data.get('raw_rfu', []))
            
            print("\nAfter JSON.dumps (what should be stored in DB):")
            print(f"fit_parameters: {fit_params_json} (type: {type(fit_params_json)})")
            print(f"parameter_errors: {parameter_errors_json} (type: {type(parameter_errors_json)})")
            
            # Test converting back (what happens in to_dict)
            fit_params_back = json.loads(fit_params_json)
            parameter_errors_back = json.loads(parameter_errors_json)
            
            print("\nAfter JSON.loads (what frontend should receive):")
            print(f"fit_parameters: {fit_params_back} (type: {type(fit_params_back)})")
            print(f"parameter_errors: {parameter_errors_back} (type: {type(parameter_errors_back)})")
            
            print("\nJSON conversion test: PASSED")
            
        except Exception as e:
            print(f"\nJSON conversion test: FAILED - {e}")
            return False
        
        # Test saving a real WellResult
        try:
            print("\nTesting actual database save...")
            
            # Create a test session
            test_session = AnalysisSession()
            test_session.filename = "test_session"
            test_session.total_wells = 1
            test_session.good_curves = 1
            test_session.success_rate = 100.0
            db.session.add(test_session)
            db.session.flush()
            
            # Create a test well result with JSON conversion
            well_result = WellResult()
            well_result.session_id = test_session.id
            well_result.well_id = "A1_TEST"
            well_result.amplitude = float(sample_well_data['amplitude'])
            well_result.r2_score = float(sample_well_data['r2_score'])
            
            # JSON fields - this is the critical part
            well_result.fit_parameters = json.dumps(sample_well_data.get('fit_parameters', []))
            well_result.parameter_errors = json.dumps(sample_well_data.get('parameter_errors', []))
            well_result.fitted_curve = json.dumps(sample_well_data.get('fitted_curve', []))
            well_result.anomalies = json.dumps(sample_well_data.get('anomalies', []))
            well_result.raw_cycles = json.dumps(sample_well_data.get('raw_cycles', []))
            well_result.raw_rfu = json.dumps(sample_well_data.get('raw_rfu', []))
            
            db.session.add(well_result)
            db.session.commit()
            
            print("Database save: SUCCESS")
            
            # Test reading it back
            saved_well = WellResult.query.filter_by(well_id="A1_TEST").first()
            if saved_well:
                well_dict = saved_well.to_dict()
                print(f"Retrieved fit_parameters: {well_dict['fit_parameters']} (type: {type(well_dict['fit_parameters'])})")
                print("Database read back: SUCCESS")
                
                # Clean up
                db.session.delete(saved_well)
                db.session.delete(test_session)
                db.session.commit()
                print("Test cleanup: SUCCESS")
                
            return True
            
        except Exception as e:
            print(f"Database operation: FAILED - {e}")
            db.session.rollback()
            return False

if __name__ == "__main__":
    success = test_json_conversion()
    sys.exit(0 if success else 1)
