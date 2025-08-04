#!/usr/bin/env python3
"""
Multichannel ML Analysis Persistence Test

This test specifically validates multichannel ML analysis persistence:
1. Creates a session with multiple fluorophores (FAM, HEX, Cy5, Texas Red)
2. Runs ML analysis on wells across different channels
3. Verifies that ML predictions persist for ALL channels
4. Confirms session reload preserves multichannel ML results

Usage:
    python test_multichannel_ml_persistence.py
"""

import requests
import json
import time
import sys
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:5000"
TEST_SESSION_NAME = "MULTICHANNEL_ML_TEST"
TIMEOUT = 30

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{text.center(70)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*70}{Colors.END}\n")

def print_success(text):
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")

def print_error(text):
    print(f"{Colors.RED}❌ {text}{Colors.END}")

def print_info(text):
    print(f"{Colors.CYAN}ℹ️  {text}{Colors.END}")

def print_channel(text):
    print(f"{Colors.MAGENTA}🔬 {text}{Colors.END}")

def generate_multichannel_data():
    """Generate realistic multichannel qPCR data with different fluorophores"""
    
    # Define different pathogen targets for each channel
    multichannel_wells = {
        # FAM Channel - Influenza A H1
        'A1_FAM': {
            'sample_name': 'Sample_001_H1',
            'fluorophore': 'FAM',
            'pathogen': 'H1',
            'expected_class': 'STRONG_POSITIVE',
            'rfu_data': [50.2, 51.1, 50.8, 52.3, 51.7, 53.0, 54.2, 55.8, 57.1, 59.2,
                        62.1, 65.8, 70.3, 76.2, 83.7, 93.1, 105.8, 122.3, 143.2, 169.8,
                        202.7, 243.1, 292.8, 352.1, 422.3, 504.7, 599.2, 706.8, 827.1, 960.3,
                        1106.7, 1266.2, 1439.1, 1625.8, 1826.7, 2042.3, 2273.1, 2519.7, 2782.8, 3063.1,
                        3361.2, 3678.1, 4014.7, 4372.3, 4751.2, 5152.8, 5578.1, 6028.7, 6506.2, 7012.8]
        },
        
        # HEX Channel - Influenza A H3
        'A1_HEX': {
            'sample_name': 'Sample_001_H3',
            'fluorophore': 'HEX',
            'pathogen': 'H3',
            'expected_class': 'MODERATE_POSITIVE',
            'rfu_data': [48.1, 48.8, 49.2, 49.5, 50.1, 51.3, 52.7, 54.8, 57.2, 60.1,
                        63.8, 68.2, 73.5, 79.8, 87.3, 96.2, 107.1, 120.3, 135.8, 154.2,
                        175.8, 200.9, 229.7, 262.4, 299.8, 342.2, 390.7, 445.8, 508.2, 579.1,
                        659.3, 750.2, 852.8, 968.7, 1098.3, 1243.2, 1404.8, 1584.7, 1785.2, 2007.8,
                        2253.1, 2522.7, 2818.3, 3142.1, 3496.8, 3884.2, 4306.7, 4766.8, 5267.2, 5810.3]
        },
        
        # Cy5 Channel - Influenza B
        'A1_Cy5': {
            'sample_name': 'Sample_001_FluB',
            'fluorophore': 'Cy5',
            'pathogen': 'FLUB',
            'expected_class': 'WEAK_POSITIVE',
            'rfu_data': [47.7, 48.1, 47.9, 48.3, 47.6, 48.8, 47.4, 48.7, 47.8, 48.2,
                        47.5, 48.6, 47.3, 48.4, 47.9, 49.1, 49.7, 50.5, 51.8, 53.3,
                        55.2, 57.7, 60.8, 64.4, 68.8, 74.1, 80.2, 87.3, 95.7, 105.2,
                        116.1, 128.8, 143.2, 159.7, 178.3, 199.4, 223.1, 249.8, 279.7, 313.2,
                        350.8, 392.7, 439.3, 491.2, 548.8, 612.7, 683.4, 761.8, 848.2, 943.7]
        },
        
        # Texas Red Channel - RSV
        'A1_TexasRed': {
            'sample_name': 'Sample_001_RSV',
            'fluorophore': 'Texas Red',
            'pathogen': 'RSV',
            'expected_class': 'NEGATIVE',
            'rfu_data': [46.7, 47.1, 46.9, 47.3, 46.6, 47.8, 46.4, 47.7, 46.8, 47.2,
                        46.5, 47.6, 46.3, 47.4, 46.9, 47.1, 46.7, 47.5, 46.2, 47.8,
                        46.6, 47.3, 46.4, 47.7, 46.8, 47.2, 46.5, 47.6, 46.3, 47.4,
                        46.9, 47.1, 46.7, 47.5, 46.2, 47.8, 46.6, 47.3, 46.4, 47.7,
                        46.8, 47.2, 46.5, 47.6, 46.3, 47.4, 46.9, 47.1, 46.7, 47.5]
        },
        
        # Second sample with different pattern
        'B1_FAM': {
            'sample_name': 'Sample_002_H1',
            'fluorophore': 'FAM',
            'pathogen': 'H1',
            'expected_class': 'NEGATIVE',
            'rfu_data': [49.2, 49.6, 49.4, 49.8, 49.1, 50.3, 49.0, 50.2, 49.3, 49.7,
                        49.0, 50.1, 48.8, 49.9, 49.4, 49.6, 49.2, 50.0, 48.7, 50.3,
                        49.1, 49.8, 48.9, 50.2, 49.3, 49.7, 49.0, 50.1, 48.8, 49.9,
                        49.4, 49.6, 49.2, 50.0, 48.7, 50.3, 49.1, 49.8, 48.9, 50.2,
                        49.3, 49.7, 49.0, 50.1, 48.8, 49.9, 49.4, 49.6, 49.2, 50.0]
        },
        
        'B1_HEX': {
            'sample_name': 'Sample_002_H3',
            'fluorophore': 'HEX',
            'pathogen': 'H3',
            'expected_class': 'STRONG_POSITIVE',
            'rfu_data': [48.5, 49.2, 48.9, 49.6, 49.1, 50.4, 51.8, 53.9, 56.7, 60.3,
                        64.8, 70.5, 77.8, 86.9, 98.3, 112.7, 130.8, 153.2, 180.7, 214.2,
                        254.8, 303.7, 362.3, 432.1, 515.8, 615.2, 732.8, 872.3, 1037.1, 1230.8,
                        1458.2, 1723.7, 2032.8, 2391.2, 2805.7, 3283.2, 3831.8, 4460.7, 5180.2, 6001.8,
                        6938.7, 8005.2, 9217.8, 10595.2, 12159.7, 13936.2, 15952.8, 18241.7, 20839.2, 23786.8]
        }
    }
    
    cycles = list(range(1, 51))
    
    # Format for session creation
    session_wells = {}
    for well_id, data in multichannel_wells.items():
        session_wells[well_id] = {
            'well_id': well_id,
            'sample_name': data['sample_name'],
            'classification': data['expected_class'],
            'raw_rfu': data['rfu_data'],
            'raw_cycles': cycles,
            'amplitude': max(data['rfu_data']) - min(data['rfu_data']),
            'r2_score': 0.9967 if 'POSITIVE' in data['expected_class'] else 0.1234,
            'cq_value': 24.7 if 'STRONG' in data['expected_class'] else 
                       28.3 if 'MODERATE' in data['expected_class'] else
                       34.1 if 'WEAK' in data['expected_class'] else None,
            'fluorophore': data['fluorophore']
        }
    
    return session_wells, multichannel_wells

def create_multichannel_session():
    """Create a multichannel test session"""
    print_info("Creating multichannel test session...")
    
    session_wells, raw_wells = generate_multichannel_data()
    
    # Create session data
    session_data = {
        'filename': f'{TEST_SESSION_NAME}_multichannel.csv',
        'combined_results': {
            'individual_results': session_wells
        },
        'fluorophores': ['FAM', 'HEX', 'Cy5', 'Texas Red'],
        'summary': {
            'total_wells': len(session_wells),
            'positive_wells': 4,
            'negative_wells': 2
        }
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/sessions/save-combined",
            json=session_data,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            result = response.json()
            session_id = result.get('session_id')
            print_success(f"Multichannel session created: {session_id}")
            print_info(f"Session contains {len(session_wells)} wells across 4 fluorophores")
            
            # Log the channels
            channels = {}
            for well_id, well_data in session_wells.items():
                fluorophore = well_data['fluorophore']
                if fluorophore not in channels:
                    channels[fluorophore] = []
                channels[fluorophore].append(well_id)
            
            for fluorophore, wells in channels.items():
                print_channel(f"{fluorophore}: {', '.join(wells)}")
            
            return session_id, raw_wells
        else:
            print_error(f"Failed to create session: {response.status_code}")
            return None, None
            
    except requests.exceptions.RequestException as e:
        print_error(f"Error creating session: {e}")
        return None, None

def run_multichannel_ml_analysis(session_id, raw_wells):
    """Run ML analysis on all multichannel wells"""
    print_info("Running ML analysis on all multichannel wells...")
    
    ml_predictions = {}
    
    for well_id, well_data in raw_wells.items():
        print_channel(f"Analyzing {well_id} ({well_data['fluorophore']} - {well_data['pathogen']})...")
        
        try:
            # Use the same structure as analyzeSingleWellWithML
            analysis_data = {
                'rfu_data': well_data['rfu_data'],
                'cycles': list(range(1, 51)),
                'session_id': session_id,
                'well_id': well_id,
                'well_data': {
                    'well': well_id.split('_')[0],
                    'target': well_data['pathogen'],
                    'sample': well_data['sample_name'],
                    'classification': well_data['expected_class'],
                    'channel': well_data['fluorophore'],
                    'specific_pathogen': well_data['pathogen'],
                    'fluorophore': well_data['fluorophore']
                },
                'existing_metrics': {
                    'r2': 0.9967 if 'POSITIVE' in well_data['expected_class'] else 0.1234,
                    'steepness': 150.0 if 'POSITIVE' in well_data['expected_class'] else 0.1,
                    'snr': 20.0 if 'POSITIVE' in well_data['expected_class'] else 1.0,
                    'midpoint': 25.0 if 'POSITIVE' in well_data['expected_class'] else 0,
                    'baseline': 50.0,
                    'amplitude': max(well_data['rfu_data']) - min(well_data['rfu_data']),
                    'cqj': 24.7 if 'STRONG' in well_data['expected_class'] else 
                          28.3 if 'MODERATE' in well_data['expected_class'] else
                          34.1 if 'WEAK' in well_data['expected_class'] else -999,
                    'calcj': 1.2e5 if 'POSITIVE' in well_data['expected_class'] else -999,
                    'classification': well_data['expected_class']
                },
                'is_batch_request': True  # Multichannel uses batch pathway
            }
            
            response = requests.post(
                f"{BASE_URL}/api/ml-analyze-curve",
                json=analysis_data,
                timeout=TIMEOUT
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success') and result.get('prediction'):
                    prediction = result['prediction']
                    ml_predictions[well_id] = prediction
                    print_success(f"  {well_id}: {prediction['classification']} ({prediction['confidence']:.1%})")
                else:
                    print_error(f"  {well_id}: ML prediction failed")
            else:
                print_error(f"  {well_id}: Request failed ({response.status_code})")
                
        except requests.exceptions.RequestException as e:
            print_error(f"  {well_id}: Error - {e}")
    
    print_success(f"Multichannel ML analysis complete: {len(ml_predictions)}/{len(raw_wells)} wells analyzed")
    
    # Group results by channel
    by_channel = {}
    for well_id, prediction in ml_predictions.items():
        fluorophore = raw_wells[well_id]['fluorophore']
        if fluorophore not in by_channel:
            by_channel[fluorophore] = []
        by_channel[fluorophore].append((well_id, prediction))
    
    print_info("Results by channel:")
    for fluorophore, results in by_channel.items():
        print_channel(f"{fluorophore}: {len(results)} wells analyzed")
        for well_id, prediction in results:
            print(f"    {well_id}: {prediction['classification']}")
    
    return ml_predictions

def verify_multichannel_persistence(session_id, ml_predictions, raw_wells):
    """Verify that multichannel ML predictions persisted to database"""
    print_info("Verifying multichannel ML predictions persisted...")
    
    # Wait for database updates
    time.sleep(2)
    
    try:
        response = requests.get(f"{BASE_URL}/sessions/{session_id}", timeout=TIMEOUT)
        
        if response.status_code == 200:
            session_data = response.json()
            wells = session_data.get('wells', [])
            
            # Group verification by channel
            persisted_by_channel = {}
            total_by_channel = {}
            
            for well_id in ml_predictions.keys():
                fluorophore = raw_wells[well_id]['fluorophore']
                if fluorophore not in persisted_by_channel:
                    persisted_by_channel[fluorophore] = 0
                    total_by_channel[fluorophore] = 0
                total_by_channel[fluorophore] += 1
            
            for well in wells:
                well_id = well.get('well_id')
                if well_id in ml_predictions:
                    fluorophore = raw_wells[well_id]['fluorophore']
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
                        curve_classification.get('class') == ml_predictions[well_id]['classification']
                    )
                    
                    if has_ml_prediction:
                        persisted_by_channel[fluorophore] += 1
                        print_success(f"  {well_id} ({fluorophore}): ML prediction persisted")
                    else:
                        print_error(f"  {well_id} ({fluorophore}): ML prediction NOT persisted")
            
            # Calculate and report results by channel
            print_header("MULTICHANNEL PERSISTENCE RESULTS")
            
            total_persisted = sum(persisted_by_channel.values())
            total_wells = sum(total_by_channel.values())
            overall_rate = (total_persisted / total_wells) * 100 if total_wells > 0 else 0
            
            all_channels_working = True
            for fluorophore in ['FAM', 'HEX', 'Cy5', 'Texas Red']:
                if fluorophore in total_by_channel:
                    persisted = persisted_by_channel.get(fluorophore, 0)
                    total = total_by_channel[fluorophore]
                    rate = (persisted / total) * 100 if total > 0 else 0
                    
                    if rate >= 100:
                        print_success(f"{fluorophore}: {persisted}/{total} ({rate:.1f}%) ✅")
                    else:
                        print_error(f"{fluorophore}: {persisted}/{total} ({rate:.1f}%) ❌")
                        all_channels_working = False
            
            print_info(f"Overall: {total_persisted}/{total_wells} ({overall_rate:.1f}%)")
            
            return total_persisted, total_wells, all_channels_working
            
        else:
            print_error(f"Failed to load session: {response.status_code}")
            return 0, len(ml_predictions), False
            
    except requests.exceptions.RequestException as e:
        print_error(f"Error verifying persistence: {e}")
        return 0, len(ml_predictions), False

def run_multichannel_test():
    """Run the comprehensive multichannel ML persistence test"""
    
    print_header("MULTICHANNEL ML ANALYSIS PERSISTENCE TEST")
    
    print_info("This test validates:")
    print_info("✓ ML analysis works across multiple fluorophores (FAM, HEX, Cy5, Texas Red)")
    print_info("✓ Each channel can have different pathogen targets (H1, H3, FluB, RSV)")
    print_info("✓ ML predictions persist for ALL channels in database")
    print_info("✓ Session reload preserves multichannel ML results")
    
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
    
    # Step 1: Create multichannel session
    session_id, raw_wells = create_multichannel_session()
    if not session_id:
        print_error("Failed to create multichannel session")
        return False
    
    # Step 2: Run ML analysis across all channels
    ml_predictions = run_multichannel_ml_analysis(session_id, raw_wells)
    if not ml_predictions:
        print_error("No ML predictions generated")
        return False
    
    # Step 3: Verify persistence across all channels
    persisted_count, total_count, all_channels_working = verify_multichannel_persistence(session_id, ml_predictions, raw_wells)
    
    # Final Results
    print_header("MULTICHANNEL TEST RESULTS")
    
    overall_rate = (persisted_count / total_count) * 100 if total_count > 0 else 0
    
    if all_channels_working and overall_rate >= 95:
        print_success("🎉 MULTICHANNEL ML PERSISTENCE: FULLY WORKING!")
        print_info("✅ All fluorophore channels support ML analysis")
        print_info("✅ ML predictions persist across ALL channels")
        print_info("✅ Each channel can have different pathogen targets")
        print_info("✅ Session reloading preserves all multichannel ML results")
        print_info("✅ Ready for production multichannel analysis")
        return True
    elif overall_rate >= 80:
        print_error("⚠️  MULTICHANNEL ML PERSISTENCE: MOSTLY WORKING")
        print_info(f"   {persisted_count}/{total_count} predictions persisted")
        print_info("   Some channels may have persistence issues")
        return False
    else:
        print_error("❌ MULTICHANNEL ML PERSISTENCE: NOT WORKING")
        print_info("   Multichannel ML predictions are not persisting properly")
        print_info("   Check channel-specific ML analysis and database updates")
        return False

if __name__ == "__main__":
    try:
        success = run_multichannel_test()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print_error("\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        sys.exit(1)
