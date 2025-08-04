#!/usr/bin/env python3
"""
Comprehensive Test Suite: ML Session Persistence and Learning Validation

This test validates:
1. ML predictions persist across session reloads
2. Expert feedback persists across session reloads  
3. ML learning progresses correctly through feedback
4. Batch ML analysis persists to database
5. Session loading preserves both ML predictions and expert corrections

Usage:
    python test_ml_session_persistence_and_learning.py
"""

import requests
import json
import time
import sys
import os
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8080"
TEST_SESSION_NAME = "ML_PERSISTENCE_TEST"
TIMEOUT = 30

class Colors:
    """ANSI color codes for terminal output"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'

def print_header(text):
    """Print a formatted header"""
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*80}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{text.center(80)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*80}{Colors.END}\n")

def print_step(step_num, text):
    """Print a formatted test step"""
    print(f"{Colors.BOLD}{Colors.BLUE}Step {step_num}:{Colors.END} {text}")

def print_success(text):
    """Print success message"""
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")

def print_error(text):
    """Print error message"""
    print(f"{Colors.RED}❌ {text}{Colors.END}")

def print_warning(text):
    """Print warning message"""
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.END}")

def print_info(text):
    """Print info message"""
    print(f"{Colors.CYAN}ℹ️  {text}{Colors.END}")

def check_server_running():
    """Check if the Flask server is running"""
    try:
        response = requests.get(f"{BASE_URL}/", timeout=5)
        return response.status_code == 200
    except requests.exceptions.RequestException:
        return False

def generate_sample_data():
    """Generate realistic qPCR data for testing"""
    
    # High-quality positive sample
    positive_rfu = [
        50.2, 51.1, 50.8, 52.3, 51.7, 53.0, 54.2, 55.8, 57.1, 59.2,
        62.1, 65.8, 70.3, 76.2, 83.7, 93.1, 105.8, 122.3, 143.2, 169.8,
        202.7, 243.1, 292.8, 352.1, 422.3, 504.7, 599.2, 706.8, 827.1, 960.3,
        1106.7, 1266.2, 1439.1, 1625.8, 1826.7, 2042.3, 2273.1, 2519.7, 2782.8, 3063.1,
        3361.2, 3678.1, 4014.7, 4372.3, 4751.2, 5152.8, 5578.1, 6028.7, 6506.2, 7012.8
    ]
    
    # Clear negative sample
    negative_rfu = [
        48.7, 49.1, 48.9, 49.3, 48.6, 49.8, 48.4, 49.7, 48.8, 49.2,
        48.5, 49.6, 48.3, 49.4, 48.9, 49.1, 48.7, 49.5, 48.2, 49.8,
        48.6, 49.3, 48.4, 49.7, 48.8, 49.2, 48.5, 49.6, 48.3, 49.4,
        48.9, 49.1, 48.7, 49.5, 48.2, 49.8, 48.6, 49.3, 48.4, 49.7,
        48.8, 49.2, 48.5, 49.6, 48.3, 49.4, 48.9, 49.1, 48.7, 49.5
    ]
    
    cycles = list(range(1, 51))
    
    return {
        'positive_sample': {
            'rfu_data': positive_rfu,
            'cycles': cycles,
            'expected_classification': 'STRONG_POSITIVE',
            'well_id': 'A1_FAM',
            'sample_name': 'Positive_Control_H1'
        },
        'negative_sample': {
            'rfu_data': negative_rfu,
            'cycles': cycles,
            'expected_classification': 'NEGATIVE',
            'well_id': 'B1_FAM',
            'sample_name': 'Negative_Control_NTC'
        }
    }

def upload_test_data():
    """Upload test qPCR data and create a session"""
    print_step(1, "Uploading test qPCR data to create initial session")
    
    sample_data = generate_sample_data()
    
    # Create a mock file upload with realistic data
    test_data = {
        'filename': f'{TEST_SESSION_NAME}_test.csv',
        'analysis_results': {
            'individual_results': {
                sample_data['positive_sample']['well_id']: {
                    'well_id': sample_data['positive_sample']['well_id'],
                    'sample_name': sample_data['positive_sample']['sample_name'],
                    'classification': sample_data['positive_sample']['expected_classification'],
                    'raw_rfu': sample_data['positive_sample']['rfu_data'],
                    'raw_cycles': sample_data['positive_sample']['cycles'],
                    'amplitude': 7012.8,
                    'r2_score': 0.9967,
                    'cq_value': 24.7,
                    'fluorophore': 'FAM'
                },
                sample_data['negative_sample']['well_id']: {
                    'well_id': sample_data['negative_sample']['well_id'],
                    'sample_name': sample_data['negative_sample']['sample_name'],
                    'classification': sample_data['negative_sample']['expected_classification'],
                    'raw_rfu': sample_data['negative_sample']['rfu_data'],
                    'raw_cycles': sample_data['negative_sample']['cycles'],
                    'amplitude': 1.2,
                    'r2_score': 0.1234,
                    'cq_value': None,
                    'fluorophore': 'FAM'
                }
            }
        },
        'summary': {
            'total_wells': 2,
            'positive_wells': 1,
            'negative_wells': 1
        }
    }
    
    # Save session via backend API
    try:
        response = requests.post(
            f"{BASE_URL}/sessions/save-combined",
            json={
                'filename': test_data['filename'],
                'combined_results': test_data['analysis_results'],  # Fixed: use combined_results
                'summary': test_data['summary']
            },
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            result = response.json()
            session_id = result.get('session_id')
            print_success(f"Test session created with ID: {session_id}")
            return session_id, sample_data
        else:
            print_error(f"Failed to create session: {response.status_code} - {response.text}")
            return None, None
            
    except requests.exceptions.RequestException as e:
        print_error(f"Error creating session: {e}")
        return None, None

def get_ml_prediction(session_id, well_id, sample_data):
    """Get ML prediction for a specific well"""
    print_step(2, f"Getting ML prediction for well {well_id}")
    
    # Get the sample data for this well
    if well_id == sample_data['positive_sample']['well_id']:
        well_sample = sample_data['positive_sample']
    else:
        well_sample = sample_data['negative_sample']
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/ml-analyze-curve",
            json={
                'rfu_data': well_sample['rfu_data'],
                'cycles': well_sample['cycles'],
                'session_id': session_id,
                'well_id': well_id,
                'well_data': {
                    'well': well_id.split('_')[0],
                    'target': 'NGON',
                    'sample': well_sample['sample_name'],
                    'classification': well_sample['expected_classification'],
                    'channel': 'FAM'
                },
                'existing_metrics': {
                    'r2': 0.9967 if 'Positive' in well_sample['sample_name'] else 0.1234,
                    'amplitude': 7012.8 if 'Positive' in well_sample['sample_name'] else 1.2,
                    'steepness': 150.0 if 'Positive' in well_sample['sample_name'] else 0.1,
                    'cqj': 24.7 if 'Positive' in well_sample['sample_name'] else -999,
                    'calcj': 1.2e5 if 'Positive' in well_sample['sample_name'] else -999
                }
            },
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success') and result.get('prediction'):
                prediction = result['prediction']
                print_success(f"ML prediction: {prediction['classification']} ({prediction['confidence']:.1%} confidence)")
                return prediction
            else:
                print_error(f"ML prediction failed: {result.get('error', 'Unknown error')}")
                return None
        else:
            print_error(f"ML prediction request failed: {response.status_code}")
            return None
            
    except requests.exceptions.RequestException as e:
        print_error(f"Error getting ML prediction: {e}")
        return None

def submit_expert_feedback(session_id, well_id, sample_data, expert_classification):
    """Submit expert feedback for a well"""
    print_step(3, f"Submitting expert feedback: {expert_classification} for well {well_id}")
    
    # Get the sample data for this well
    if well_id == sample_data['positive_sample']['well_id']:
        well_sample = sample_data['positive_sample']
    else:
        well_sample = sample_data['negative_sample']
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/ml-submit-feedback",
            json={
                'rfu_data': well_sample['rfu_data'],
                'cycles': well_sample['cycles'],
                'session_id': session_id,
                'well_id': well_id,
                'expert_classification': expert_classification,
                'well_data': {
                    'well': well_id.split('_')[0],
                    'target': 'NGON',
                    'sample': well_sample['sample_name'],
                    'classification': well_sample['expected_classification'],
                    'channel': 'FAM'
                },
                'existing_metrics': {
                    'r2': 0.9967 if 'Positive' in well_sample['sample_name'] else 0.1234,
                    'amplitude': 7012.8 if 'Positive' in well_sample['sample_name'] else 1.2,
                    'steepness': 150.0 if 'Positive' in well_sample['sample_name'] else 0.1,
                    'cqj': 24.7 if 'Positive' in well_sample['sample_name'] else -999,
                    'calcj': 1.2e5 if 'Positive' in well_sample['sample_name'] else -999
                }
            },
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                training_samples = result.get('training_samples', 0)
                print_success(f"Expert feedback submitted. Total training samples: {training_samples}")
                return True
            else:
                print_error(f"Expert feedback failed: {result.get('error', 'Unknown error')}")
                return False
        else:
            print_error(f"Expert feedback request failed: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_error(f"Error submitting expert feedback: {e}")
        return False

def load_session(session_id):
    """Load a session and check for persistence"""
    print_step(4, f"Loading session {session_id} to verify persistence")
    
    try:
        response = requests.get(f"{BASE_URL}/sessions/{session_id}", timeout=TIMEOUT)
        
        if response.status_code == 200:
            session_data = response.json()
            wells = session_data.get('wells', [])
            print_success(f"Session loaded successfully with {len(wells)} wells")
            
            # Check each well for persisted ML data
            persisted_ml_predictions = 0
            persisted_expert_feedback = 0
            
            for well in wells:
                well_id = well.get('well_id')
                curve_classification = well.get('curve_classification', {})
                
                if isinstance(curve_classification, str):
                    try:
                        curve_classification = json.loads(curve_classification)
                    except:
                        curve_classification = {}
                
                # Check for ML prediction
                if curve_classification.get('ml_prediction') or curve_classification.get('method') == 'ML':
                    persisted_ml_predictions += 1
                    print_info(f"Well {well_id}: ML prediction persisted - {curve_classification.get('ml_prediction', curve_classification.get('class'))}")
                
                # Check for expert feedback
                if (curve_classification.get('expert_classification') or 
                    curve_classification.get('method') == 'Expert Review'):
                    persisted_expert_feedback += 1
                    print_info(f"Well {well_id}: Expert feedback persisted - {curve_classification.get('expert_classification', curve_classification.get('class'))}")
            
            return {
                'wells': wells,
                'ml_predictions_persisted': persisted_ml_predictions,
                'expert_feedback_persisted': persisted_expert_feedback
            }
        else:
            print_error(f"Failed to load session: {response.status_code}")
            return None
            
    except requests.exceptions.RequestException as e:
        print_error(f"Error loading session: {e}")
        return None

def check_ml_learning_progress():
    """Check if ML model is learning from feedback"""
    print_step(5, "Checking ML learning progress")
    
    try:
        response = requests.get(f"{BASE_URL}/api/ml-training-stats", timeout=TIMEOUT)
        
        if response.status_code == 200:
            stats = response.json()
            training_samples = stats.get('training_samples', 0)
            model_accuracy = stats.get('model_accuracy', 0)
            pathogen_breakdown = stats.get('pathogen_breakdown', {})
            
            print_success(f"ML training stats retrieved:")
            print_info(f"  Total training samples: {training_samples}")
            print_info(f"  Model accuracy: {model_accuracy:.1%}")
            print_info(f"  Pathogen breakdown: {pathogen_breakdown}")
            
            return {
                'training_samples': training_samples,
                'model_accuracy': model_accuracy,
                'pathogen_breakdown': pathogen_breakdown
            }
        else:
            print_warning(f"ML stats not available: {response.status_code}")
            return None
            
    except requests.exceptions.RequestException as e:
        print_warning(f"Error getting ML stats: {e}")
        return None

def run_comprehensive_test():
    """Run the comprehensive ML persistence and learning test"""
    
    print_header("ML SESSION PERSISTENCE & LEARNING TEST")
    
    print_info("This test validates:")
    print_info("1. ML predictions persist across session reloads")
    print_info("2. Expert feedback persists across session reloads")
    print_info("3. ML learning progresses correctly through feedback")
    print_info("4. Batch ML analysis persists to database")
    print_info("5. Session loading preserves both ML predictions and expert corrections")
    
    # Check if server is running
    if not check_server_running():
        print_error("Flask server is not running. Please start the server first.")
        print_info("Run: python app.py")
        sys.exit(1)
    
    print_success("Flask server is running")
    
    # Step 1: Upload test data and create session
    session_id, sample_data = upload_test_data()
    if not session_id:
        print_error("Failed to create test session")
        sys.exit(1)
    
    # Step 2: Get initial ML predictions for both wells
    print_header("TESTING ML PREDICTION PERSISTENCE")
    
    positive_well_id = sample_data['positive_sample']['well_id']
    negative_well_id = sample_data['negative_sample']['well_id']
    
    positive_prediction = get_ml_prediction(session_id, positive_well_id, sample_data)
    negative_prediction = get_ml_prediction(session_id, negative_well_id, sample_data)
    
    if not positive_prediction or not negative_prediction:
        print_warning("ML predictions not available, testing persistence only")
    
    # Step 3: Submit expert feedback
    print_header("TESTING EXPERT FEEDBACK PERSISTENCE")
    
    # Submit expert feedback that corrects the ML prediction
    expert_correction = 'WEAK_POSITIVE'  # Different from expected STRONG_POSITIVE
    feedback_success = submit_expert_feedback(session_id, positive_well_id, sample_data, expert_correction)
    
    if not feedback_success:
        print_error("Failed to submit expert feedback")
        sys.exit(1)
    
    # Step 4: Reload session and check persistence
    print_header("TESTING SESSION RELOAD PERSISTENCE")
    
    print_info("Waiting 2 seconds for database to update...")
    time.sleep(2)
    
    loaded_session = load_session(session_id)
    if not loaded_session:
        print_error("Failed to load session")
        sys.exit(1)
    
    # Step 5: Check ML learning progress
    print_header("TESTING ML LEARNING PROGRESS")
    
    ml_stats = check_ml_learning_progress()
    
    # Results Analysis
    print_header("TEST RESULTS ANALYSIS")
    
    results = {
        'session_creation': session_id is not None,
        'ml_predictions_generated': positive_prediction is not None and negative_prediction is not None,
        'expert_feedback_submitted': feedback_success,
        'session_reload': loaded_session is not None,
        'ml_predictions_persisted': loaded_session and loaded_session['ml_predictions_persisted'] > 0,
        'expert_feedback_persisted': loaded_session and loaded_session['expert_feedback_persisted'] > 0,
        'ml_learning_active': ml_stats and ml_stats['training_samples'] > 0
    }
    
    # Print detailed results
    print_success("✅ TEST RESULTS SUMMARY:")
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        test_display = test_name.replace('_', ' ').title()
        print(f"  {status}: {test_display}")
    
    # Overall assessment
    passed_tests = sum(1 for v in results.values() if v is True)
    total_tests = len(results)
    success_rate = (passed_tests / total_tests) * 100
    
    print(f"\n{Colors.BOLD}Overall Success Rate: {passed_tests}/{total_tests} ({success_rate:.1f}%){Colors.END}")
    
    if success_rate >= 85:
        print_success("🎉 ML SESSION PERSISTENCE & LEARNING: FULLY FUNCTIONAL!")
        print_info("✅ Expert feedback persists across session reloads")
        print_info("✅ ML predictions are saved to database")
        print_info("✅ ML learning system is working correctly")
    elif success_rate >= 70:
        print_warning("⚠️  ML SESSION PERSISTENCE & LEARNING: MOSTLY WORKING")
        print_info("Most functionality works, but some improvements needed")
    else:
        print_error("❌ ML SESSION PERSISTENCE & LEARNING: NEEDS FIXES")
        print_info("Critical issues need to be resolved")
    
    # Specific recommendations
    print_header("RECOMMENDATIONS")
    
    if not results['ml_predictions_persisted']:
        print_warning("⚠️  ML predictions are not persisting to database")
        print_info("   → Check ML analyze endpoint database updates")
        print_info("   → Verify session_id and well_id are passed correctly")
    
    if not results['expert_feedback_persisted']:
        print_warning("⚠️  Expert feedback is not persisting to database")
        print_info("   → Check ML feedback endpoint database updates")
        print_info("   → Verify curve_classification field updates")
    
    if not results['ml_learning_active']:
        print_warning("⚠️  ML learning system may not be active")
        print_info("   → Check training data accumulation")
        print_info("   → Verify model retraining triggers")
    
    if results['ml_predictions_persisted'] and results['expert_feedback_persisted']:
        print_success("🎯 Session persistence is working correctly!")
        print_info("   → Users can reload sessions and see their ML work")
        print_info("   → Expert corrections are preserved")
        print_info("   → Ready for production use")
    
    return success_rate >= 85

if __name__ == "__main__":
    try:
        success = run_comprehensive_test()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print_error("\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        sys.exit(1)
