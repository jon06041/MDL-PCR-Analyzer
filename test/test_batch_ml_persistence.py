#!/usr/bin/env python3
"""
Quick Batch ML Analysis Persistence Test

This focused test specifically validates that batch ML analysis results
persist to     try:
        response = requests.post(
            f"{BASE_URL}/sessions/save-combined",
            json={
                'filename': session_data['filename'],
                'combined_results': session_data['analysis_results'],  # Fixed: use combined_results
                'summary': session_data['summary']
            },
            timeout=TIMEOUT
        )se when sessions are reloaded.

Usage:
    python test_batch_ml_persistence.py
"""

import requests
import json
import time
import sys
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8080"
TEST_SESSION_NAME = "BATCH_ML_TEST"
TIMEOUT = 30

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{text.center(60)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.END}\n")

def print_success(text):
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")

def print_error(text):
    print(f"{Colors.RED}❌ {text}{Colors.END}")

def print_info(text):
    print(f"{Colors.CYAN}ℹ️  {text}{Colors.END}")

def generate_batch_test_data():
    """Generate realistic batch qPCR data for testing"""
    
    # Multiple wells with different patterns
    test_wells = {
        'A1_FAM': {
            'sample_name': 'Sample_001_H1',
            'rfu_data': [50.2, 51.1, 50.8, 52.3, 51.7, 53.0, 54.2, 55.8, 57.1, 59.2,
                        62.1, 65.8, 70.3, 76.2, 83.7, 93.1, 105.8, 122.3, 143.2, 169.8,
                        202.7, 243.1, 292.8, 352.1, 422.3, 504.7, 599.2, 706.8, 827.1, 960.3,
                        1106.7, 1266.2, 1439.1, 1625.8, 1826.7, 2042.3, 2273.1, 2519.7, 2782.8, 3063.1,
                        3361.2, 3678.1, 4014.7, 4372.3, 4751.2, 5152.8, 5578.1, 6028.7, 6506.2, 7012.8],
            'expected_class': 'STRONG_POSITIVE'
        },
        'A2_FAM': {
            'sample_name': 'Sample_002_H3',
            'rfu_data': [49.1, 49.8, 50.2, 50.5, 51.1, 52.3, 53.7, 55.8, 58.2, 61.1,
                        64.8, 69.2, 74.5, 80.8, 88.3, 97.2, 108.1, 121.3, 136.8, 155.2,
                        176.8, 201.9, 230.7, 263.4, 300.8, 343.2, 391.7, 446.8, 509.2, 580.1,
                        660.3, 751.2, 853.8, 969.7, 1099.3, 1244.2, 1405.8, 1585.7, 1786.2, 2008.8],
            'expected_class': 'MODERATE_POSITIVE'
        },
        'A3_FAM': {
            'sample_name': 'Sample_003_WEAK',
            'rfu_data': [48.7, 49.1, 48.9, 49.3, 48.6, 49.8, 48.4, 49.7, 48.8, 49.2,
                        48.5, 49.6, 48.3, 49.4, 48.9, 50.1, 50.7, 51.5, 52.8, 54.3,
                        56.2, 58.7, 61.8, 65.4, 69.8, 75.1, 81.2, 88.3, 96.7, 106.2,
                        117.1, 129.8, 144.2, 160.7, 179.3, 200.4, 224.1, 250.8, 280.7, 314.2],
            'expected_class': 'WEAK_POSITIVE'
        },
        'B1_FAM': {
            'sample_name': 'NTC_001',
            'rfu_data': [48.7, 49.1, 48.9, 49.3, 48.6, 49.8, 48.4, 49.7, 48.8, 49.2,
                        48.5, 49.6, 48.3, 49.4, 48.9, 49.1, 48.7, 49.5, 48.2, 49.8,
                        48.6, 49.3, 48.4, 49.7, 48.8, 49.2, 48.5, 49.6, 48.3, 49.4,
                        48.9, 49.1, 48.7, 49.5, 48.2, 49.8, 48.6, 49.3, 48.4, 49.7,
                        48.8, 49.2, 48.5, 49.6, 48.3, 49.4, 48.9, 49.1, 48.7, 49.5],
            'expected_class': 'NEGATIVE'
        }
    }
    
    cycles = list(range(1, 51))
    
    # Format for batch analysis
    batch_data = []
    for well_id, data in test_wells.items():
        batch_data.append({
            'well_id': well_id,
            'sample_name': data['sample_name'],
            'rfu_data': data['rfu_data'],
            'cycles': cycles,
            'well_data': {
                'well': well_id.split('_')[0],
                'target': 'NGON',
                'sample': data['sample_name'],
                'classification': data['expected_class'],
                'channel': 'FAM'
            },
            'existing_metrics': {
                'r2': 0.9967 if 'POSITIVE' in data['expected_class'] else 0.1234,
                'amplitude': 7012.8 if 'STRONG' in data['expected_class'] else 
                           2008.8 if 'MODERATE' in data['expected_class'] else
                           314.2 if 'WEAK' in data['expected_class'] else 1.2,
                'steepness': 150.0 if 'POSITIVE' in data['expected_class'] else 0.1,
                'cqj': 24.7 if 'STRONG' in data['expected_class'] else
                      28.3 if 'MODERATE' in data['expected_class'] else
                      34.1 if 'WEAK' in data['expected_class'] else -999,
                'calcj': 1.2e5 if 'POSITIVE' in data['expected_class'] else -999
            }
        })
    
    return batch_data, test_wells

def create_test_session():
    """Create a test session with sample data"""
    print_info("Creating test session for batch ML analysis...")
    
    batch_data, test_wells = generate_batch_test_data()
    
    # Create session data
    session_data = {
        'filename': f'{TEST_SESSION_NAME}_batch.csv',
        'analysis_results': {
            'individual_results': {}
        },
        'summary': {
            'total_wells': len(batch_data),
            'positive_wells': 3,
            'negative_wells': 1
        }
    }
    
    # Add each well to session
    for well_data in batch_data:
        well_id = well_data['well_id']
        session_data['analysis_results']['individual_results'][well_id] = {
            'well_id': well_id,
            'sample_name': well_data['sample_name'],
            'classification': test_wells[well_id]['expected_class'],
            'raw_rfu': well_data['rfu_data'],
            'raw_cycles': well_data['cycles'],
            'amplitude': well_data['existing_metrics']['amplitude'],
            'r2_score': well_data['existing_metrics']['r2'],
            'cq_value': well_data['existing_metrics']['cqj'] if well_data['existing_metrics']['cqj'] != -999 else None,
            'fluorophore': 'FAM'
        }
    
    try:
        response = requests.post(
            f"{BASE_URL}/sessions/save-combined",
            json={
                'filename': session_data['filename'],
                'combined_results': session_data['analysis_results'],
                'summary': session_data['summary']
            },
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            result = response.json()
            session_id = result.get('session_id')
            print_success(f"Test session created: {session_id}")
            return session_id, batch_data
        else:
            print_error(f"Failed to create session: {response.status_code}")
            return None, None
            
    except requests.exceptions.RequestException as e:
        print_error(f"Error creating session: {e}")
        return None, None

def run_batch_ml_analysis(session_id, batch_data):
    """Run batch ML analysis on all wells"""
    print_info("Running batch ML analysis...")
    
    batch_predictions = {}
    
    for well_data in batch_data:
        well_id = well_data['well_id']
        print_info(f"Analyzing well {well_id}...")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/ml-analyze-curve",
                json={
                    'rfu_data': well_data['rfu_data'],
                    'cycles': well_data['cycles'],
                    'session_id': session_id,
                    'well_id': well_id,
                    'well_data': well_data['well_data'],
                    'existing_metrics': well_data['existing_metrics'],
                    'is_batch_request': True
                },
                timeout=TIMEOUT
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success') and result.get('prediction'):
                    prediction = result['prediction']
                    batch_predictions[well_id] = prediction
                    print_success(f"  {well_id}: {prediction['classification']} ({prediction['confidence']:.1%})")
                else:
                    print_error(f"  {well_id}: ML prediction failed")
            else:
                print_error(f"  {well_id}: Request failed ({response.status_code})")
                
        except requests.exceptions.RequestException as e:
            print_error(f"  {well_id}: Error - {e}")
    
    print_success(f"Batch analysis complete: {len(batch_predictions)}/{len(batch_data)} wells analyzed")
    return batch_predictions

def verify_persistence(session_id, batch_predictions):
    """Verify that batch ML predictions persisted to database"""
    print_info("Verifying batch ML predictions persisted to database...")
    
    # Wait for database updates
    time.sleep(2)
    
    try:
        response = requests.get(f"{BASE_URL}/sessions/{session_id}", timeout=TIMEOUT)
        
        if response.status_code == 200:
            session_data = response.json()
            wells = session_data.get('wells', [])
            
            persisted_count = 0
            total_count = len(batch_predictions)
            
            for well in wells:
                well_id = well.get('well_id')
                if well_id in batch_predictions:
                    curve_classification = well.get('curve_classification', {})
                    
                    if isinstance(curve_classification, str):
                        try:
                            curve_classification = json.loads(curve_classification)
                        except:
                            curve_classification = {}
                    
                    # Check if ML prediction is persisted
                    has_ml_prediction = (
                        curve_classification.get('ml_prediction') or
                        curve_classification.get('method') == 'ML' or
                        curve_classification.get('class') == batch_predictions[well_id]['classification']
                    )
                    
                    if has_ml_prediction:
                        persisted_count += 1
                        print_success(f"  {well_id}: ML prediction persisted")
                    else:
                        print_error(f"  {well_id}: ML prediction NOT persisted")
            
            success_rate = (persisted_count / total_count) * 100 if total_count > 0 else 0
            print_info(f"Persistence rate: {persisted_count}/{total_count} ({success_rate:.1f}%)")
            
            return persisted_count, total_count
            
        else:
            print_error(f"Failed to load session: {response.status_code}")
            return 0, len(batch_predictions)
            
    except requests.exceptions.RequestException as e:
        print_error(f"Error verifying persistence: {e}")
        return 0, len(batch_predictions)

def run_batch_persistence_test():
    """Run the focused batch ML persistence test"""
    
    print_header("BATCH ML ANALYSIS PERSISTENCE TEST")
    
    # Check server
    try:
        response = requests.get(f"{BASE_URL}/", timeout=5)
        if response.status_code != 200:
            print_error("Flask server not responding correctly")
            return False
    except:
        print_error("Flask server is not running")
        print_info("Please start the server: python app.py")
        return False
    
    print_success("Flask server is running")
    
    # Step 1: Create test session
    session_id, batch_data = create_test_session()
    if not session_id:
        print_error("Failed to create test session")
        return False
    
    # Step 2: Run batch ML analysis
    batch_predictions = run_batch_ml_analysis(session_id, batch_data)
    if not batch_predictions:
        print_error("No ML predictions generated")
        return False
    
    # Step 3: Verify persistence
    persisted_count, total_count = verify_persistence(session_id, batch_predictions)
    
    # Results
    print_header("TEST RESULTS")
    
    success_rate = (persisted_count / total_count) * 100 if total_count > 0 else 0
    
    if success_rate >= 90:
        print_success("🎉 BATCH ML PERSISTENCE: FULLY WORKING!")
        print_info("✅ All batch ML predictions persist to database")
        print_info("✅ Session reloading preserves ML analysis results")
        print_info("✅ Ready for production batch analysis")
        return True
    elif success_rate >= 70:
        print_error("⚠️  BATCH ML PERSISTENCE: PARTIALLY WORKING")
        print_info(f"   {persisted_count}/{total_count} predictions persisted")
        print_info("   Some batch predictions are being lost")
        return False
    else:
        print_error("❌ BATCH ML PERSISTENCE: NOT WORKING")
        print_info("   Batch ML predictions are not persisting to database")
        print_info("   Database updates in ML analyze endpoint may be failing")
        return False

if __name__ == "__main__":
    try:
        success = run_batch_persistence_test()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print_error("\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        sys.exit(1)
