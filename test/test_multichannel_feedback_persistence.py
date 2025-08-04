#!/usr/bin/env python3
"""
Multichannel Expert Feedback Persistence Test

This test specifically validates that expert feedback persists across multichannel analysis:
1. Creates multichannel session (FAM, HEX, Cy5, Texas Red)
2. Runs ML analysis on all channels
3. Submits expert feedback for each channel
4. Verifies that BOTH ML predictions AND expert feedback persist
5. Confirms session reload preserves all multichannel feedback

Usage:
    python test_multichannel_feedback_persistence.py
"""

import requests
import json
import time
import sys
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:5000"
TEST_SESSION_NAME = "MULTICHANNEL_FEEDBACK_TEST"
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

def print_feedback(text):
    print(f"{Colors.YELLOW}💬 {text}{Colors.END}")

def generate_multichannel_feedback_data():
    """Generate multichannel data with specific expert feedback scenarios"""
    
    multichannel_wells = {
        # FAM Channel - Will get POSITIVE feedback (ML predicts STRONG_POSITIVE)
        'A1_FAM': {
            'sample_name': 'Sample_001_H1',
            'fluorophore': 'FAM',
            'pathogen': 'H1',
            'ml_expected': 'STRONG_POSITIVE',
            'expert_feedback': 'POSITIVE',  # Expert corrects to POSITIVE
            'rfu_data': [50.2, 51.1, 50.8, 52.3, 51.7, 53.0, 54.2, 55.8, 57.1, 59.2,
                        62.1, 65.8, 70.3, 76.2, 83.7, 93.1, 105.8, 122.3, 143.2, 169.8,
                        202.7, 243.1, 292.8, 352.1, 422.3, 504.7, 599.2, 706.8, 827.1, 960.3,
                        1106.7, 1266.2, 1439.1, 1625.8, 1826.7, 2042.3, 2273.1, 2519.7, 2782.8, 3063.1,
                        3361.2, 3678.1, 4014.7, 4372.3, 4751.2, 5152.8, 5578.1, 6028.7, 6506.2, 7012.8]
        },
        
        # HEX Channel - Will get WEAK_POSITIVE feedback (ML predicts STRONG_POSITIVE) 
        'A1_HEX': {
            'sample_name': 'Sample_001_H3',
            'fluorophore': 'HEX',
            'pathogen': 'H3',
            'ml_expected': 'STRONG_POSITIVE',
            'expert_feedback': 'WEAK_POSITIVE',  # Expert corrects to WEAK_POSITIVE
            'rfu_data': [48.1, 48.8, 49.2, 49.5, 50.1, 51.3, 52.7, 54.8, 57.2, 60.1,
                        63.8, 68.2, 73.5, 79.8, 87.3, 96.2, 107.1, 120.3, 135.8, 154.2,
                        175.8, 200.9, 229.7, 262.4, 299.8, 342.2, 390.7, 445.8, 508.2, 579.1,
                        659.3, 750.2, 852.8, 968.7, 1098.3, 1243.2, 1404.8, 1584.7, 1785.2, 2007.8,
                        2253.1, 2522.7, 2818.3, 3142.1, 3496.8, 3884.2, 4306.7, 4766.8, 5267.2, 5810.3]
        },
        
        # Cy5 Channel - Will get NEGATIVE feedback (ML predicts STRONG_POSITIVE)
        'A1_Cy5': {
            'sample_name': 'Sample_001_FluB',
            'fluorophore': 'Cy5',
            'pathogen': 'FLUB',
            'ml_expected': 'STRONG_POSITIVE',
            'expert_feedback': 'NEGATIVE',  # Expert disagrees - it's actually negative
            'rfu_data': [47.7, 48.1, 47.9, 48.3, 47.6, 48.8, 47.4, 48.7, 47.8, 48.2,
                        47.5, 48.6, 47.3, 48.4, 47.9, 49.1, 49.7, 50.5, 51.8, 53.3,
                        55.2, 57.7, 60.8, 64.4, 68.8, 74.1, 80.2, 87.3, 95.7, 105.2,
                        116.1, 128.8, 143.2, 159.7, 178.3, 199.4, 223.1, 249.8, 279.7, 313.2,
                        350.8, 392.7, 439.3, 491.2, 548.8, 612.7, 683.4, 761.8, 848.2, 943.7]
        },
        
        # Texas Red Channel - Will get SUSPICIOUS feedback (ML predicts NEGATIVE)
        'A1_TexasRed': {
            'sample_name': 'Sample_001_RSV',
            'fluorophore': 'Texas Red',
            'pathogen': 'RSV',
            'ml_expected': 'NEGATIVE',
            'expert_feedback': 'SUSPICIOUS',  # Expert flags as suspicious
            'rfu_data': [46.7, 47.1, 46.9, 47.3, 46.6, 47.8, 46.4, 47.7, 46.8, 47.2,
                        46.5, 47.6, 46.3, 47.4, 46.9, 47.1, 46.7, 47.5, 46.2, 47.8,
                        46.6, 47.3, 46.4, 47.7, 46.8, 47.2, 46.5, 47.6, 46.3, 47.4,
                        46.9, 47.1, 46.7, 47.5, 46.2, 47.8, 46.6, 47.3, 46.4, 47.7,
                        46.8, 47.2, 46.5, 47.6, 46.3, 47.4, 46.9, 47.1, 46.7, 47.5]
        }
    }
    
    cycles = list(range(1, 51))
    
    # Format for session creation
    session_wells = {}
    for well_id, data in multichannel_wells.items():
        session_wells[well_id] = {
            'well_id': well_id,
            'sample_name': data['sample_name'],
            'classification': 'UNKNOWN',  # Start with unknown
            'raw_rfu': data['rfu_data'],
            'raw_cycles': cycles,
            'amplitude': max(data['rfu_data']) - min(data['rfu_data']),
            'r2_score': 0.9967,
            'cq_value': 24.7,
            'fluorophore': data['fluorophore']
        }
    
    return session_wells, multichannel_wells

def create_multichannel_feedback_session():
    """Create a multichannel session for feedback testing"""
    print_info("Creating multichannel feedback test session...")
    
    session_wells, raw_wells = generate_multichannel_feedback_data()
    
    session_data = {
        'filename': f'{TEST_SESSION_NAME}_feedback.csv',
        'combined_results': {
            'individual_results': session_wells
        },
        'fluorophores': ['FAM', 'HEX', 'Cy5', 'Texas Red'],
        'summary': {
            'total_wells': len(session_wells),
            'positive_wells': 0,
            'negative_wells': 0
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
            print_success(f"Multichannel feedback session created: {session_id}")
            print_info(f"Session contains {len(session_wells)} wells across 4 fluorophores")
            
            # Log the channels and their expected feedback
            for well_id, well_data in raw_wells.items():
                fluorophore = well_data['fluorophore']
                expected_ml = well_data['ml_expected']
                expert_feedback = well_data['expert_feedback']
                print_channel(f"{well_id} ({fluorophore}): ML→{expected_ml}, Expert→{expert_feedback}")
            
            return session_id, raw_wells
        else:
            print_error(f"Failed to create session: {response.status_code}")
            return None, None
            
    except requests.exceptions.RequestException as e:
        print_error(f"Error creating session: {e}")
        return None, None

def run_multichannel_ml_and_feedback(session_id, raw_wells):
    """Run ML analysis and submit expert feedback for all channels"""
    print_info("Running ML analysis and expert feedback across all channels...")
    
    ml_predictions = {}
    feedback_results = {}
    
    for well_id, well_data in raw_wells.items():
        fluorophore = well_data['fluorophore']
        pathogen = well_data['pathogen']
        expected_ml = well_data['ml_expected']
        expert_feedback = well_data['expert_feedback']
        
        print_channel(f"Processing {well_id} ({fluorophore} - {pathogen})...")
        
        # Step 1: Run ML Analysis
        try:
            analysis_data = {
                'rfu_data': well_data['rfu_data'],
                'cycles': list(range(1, 51)),
                'session_id': session_id,
                'well_id': well_id,
                'well_data': {
                    'well': well_id.split('_')[0],
                    'target': pathogen,
                    'sample': well_data['sample_name'],
                    'classification': 'UNKNOWN',
                    'channel': fluorophore,
                    'specific_pathogen': pathogen,
                    'fluorophore': fluorophore
                },
                'existing_metrics': {
                    'r2': 0.9967,
                    'steepness': 150.0,
                    'snr': 20.0,
                    'midpoint': 25.0,
                    'baseline': 50.0,
                    'amplitude': max(well_data['rfu_data']) - min(well_data['rfu_data']),
                    'cqj': 24.7,
                    'calcj': 1.2e5,
                    'classification': 'UNKNOWN'
                },
                'is_batch_request': True
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
                    print_success(f"  ML Analysis: {prediction['classification']} ({prediction['confidence']:.1%})")
                else:
                    print_error(f"  ML Analysis failed")
                    continue
            else:
                print_error(f"  ML Analysis request failed ({response.status_code})")
                continue
                
        except requests.exceptions.RequestException as e:
            print_error(f"  ML Analysis error: {e}")
            continue
        
        # Step 2: Submit Expert Feedback
        try:
            print_feedback(f"  Submitting expert feedback: {expert_feedback}")
            
            # Create comprehensive feedback with hybrid features
            feedback_data = {
                'session_id': session_id,
                'well_id': well_id,
                'expert_classification': expert_feedback,
                'feedback_type': 'expert_classification',
                'well_data': {
                    'well': well_id.split('_')[0],
                    'target': pathogen,
                    'sample': well_data['sample_name'],
                    'classification': expert_feedback,  # Expert's classification
                    'channel': fluorophore,
                    'specific_pathogen': pathogen,
                    'fluorophore': fluorophore
                },
                'curve_data': {
                    'rfu_data': well_data['rfu_data'],
                    'cycles': list(range(1, 51))
                },
                'metrics': {
                    'amplitude': max(well_data['rfu_data']) - min(well_data['rfu_data']),
                    'r2_score': 0.9967,
                    'steepness': 150.0,
                    'snr': 20.0,
                    'midpoint': 25.0,
                    'baseline': 50.0,
                    'cqj': 24.7,
                    'calcj': 1.2e5
                },
                'pathogen_context': {
                    'pathogen': pathogen,
                    'fluorophore': fluorophore,
                    'test_type': 'multichannel_qpcr'
                },
                'feedback_context': {
                    'ml_prediction': prediction['classification'] if well_id in ml_predictions else None,
                    'ml_confidence': prediction['confidence'] if well_id in ml_predictions else None,
                    'expert_reasoning': f'Expert correction for {fluorophore} channel',
                    'disagreement_reason': f'ML predicted {expected_ml}, expert says {expert_feedback}'
                }
            }
            
            response = requests.post(
                f"{BASE_URL}/api/ml-submit-feedback",
                json=feedback_data,
                timeout=TIMEOUT
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    feedback_results[well_id] = {
                        'expert_classification': expert_feedback,
                        'training_added': result.get('training_added', False),
                        'feedback_recorded': True
                    }
                    print_success(f"  Expert feedback submitted: {expert_feedback}")
                    if result.get('training_added'):
                        print_info(f"    Added to training data")
                else:
                    print_error(f"  Expert feedback failed: {result.get('error', 'Unknown error')}")
            else:
                print_error(f"  Expert feedback request failed ({response.status_code})")
                
        except requests.exceptions.RequestException as e:
            print_error(f"  Expert feedback error: {e}")
    
    print_success(f"Multichannel processing complete:")
    print_info(f"  ML predictions: {len(ml_predictions)}/{len(raw_wells)} wells")
    print_info(f"  Expert feedback: {len(feedback_results)}/{len(raw_wells)} wells")
    
    return ml_predictions, feedback_results

def verify_multichannel_feedback_persistence(session_id, ml_predictions, feedback_results, raw_wells):
    """Verify that both ML predictions and expert feedback persisted"""
    print_info("Verifying multichannel ML and feedback persistence...")
    
    # Wait for database updates
    time.sleep(3)
    
    try:
        response = requests.get(f"{BASE_URL}/sessions/{session_id}", timeout=TIMEOUT)
        
        if response.status_code == 200:
            session_data = response.json()
            wells = session_data.get('wells', [])
            
            # Track persistence by channel
            channels = ['FAM', 'HEX', 'Cy5', 'Texas Red']
            persistence_by_channel = {channel: {'ml': 0, 'feedback': 0, 'total': 0} for channel in channels}
            
            for well in wells:
                well_id = well.get('well_id')
                if well_id in raw_wells:
                    fluorophore = raw_wells[well_id]['fluorophore']
                    curve_classification = well.get('curve_classification', {})
                    
                    if isinstance(curve_classification, str):
                        try:
                            curve_classification = json.loads(curve_classification)
                        except:
                            curve_classification = {}
                    
                    persistence_by_channel[fluorophore]['total'] += 1
                    
                    # Check ML prediction persistence
                    has_ml_prediction = (
                        curve_classification.get('ml_prediction') or
                        curve_classification.get('method') == 'ML' or
                        (well_id in ml_predictions and 
                         curve_classification.get('class') == ml_predictions[well_id]['classification'])
                    )
                    
                    if has_ml_prediction:
                        persistence_by_channel[fluorophore]['ml'] += 1
                        print_success(f"  {well_id} ({fluorophore}): ML prediction persisted")
                    else:
                        print_error(f"  {well_id} ({fluorophore}): ML prediction NOT persisted")
                    
                    # Check expert feedback persistence
                    expected_feedback = feedback_results.get(well_id, {}).get('expert_classification')
                    has_expert_feedback = (
                        curve_classification.get('expert_classification') == expected_feedback or
                        curve_classification.get('method') == 'expert_feedback' or
                        curve_classification.get('class') == expected_feedback
                    )
                    
                    if has_expert_feedback and expected_feedback:
                        persistence_by_channel[fluorophore]['feedback'] += 1
                        print_success(f"  {well_id} ({fluorophore}): Expert feedback persisted - {expected_feedback}")
                    elif expected_feedback:
                        print_error(f"  {well_id} ({fluorophore}): Expert feedback NOT persisted - expected {expected_feedback}")
            
            # Calculate and report results
            print_header("MULTICHANNEL FEEDBACK PERSISTENCE RESULTS")
            
            total_ml_persisted = sum(data['ml'] for data in persistence_by_channel.values())
            total_feedback_persisted = sum(data['feedback'] for data in persistence_by_channel.values())
            total_wells = sum(data['total'] for data in persistence_by_channel.values())
            
            all_channels_working = True
            
            for channel in channels:
                if persistence_by_channel[channel]['total'] > 0:
                    ml_rate = (persistence_by_channel[channel]['ml'] / persistence_by_channel[channel]['total']) * 100
                    feedback_rate = (persistence_by_channel[channel]['feedback'] / persistence_by_channel[channel]['total']) * 100
                    
                    if ml_rate >= 100 and feedback_rate >= 100:
                        print_success(f"{channel}: ML {persistence_by_channel[channel]['ml']}/{persistence_by_channel[channel]['total']} ({ml_rate:.0f}%), Feedback {persistence_by_channel[channel]['feedback']}/{persistence_by_channel[channel]['total']} ({feedback_rate:.0f}%) ✅")
                    else:
                        print_error(f"{channel}: ML {persistence_by_channel[channel]['ml']}/{persistence_by_channel[channel]['total']} ({ml_rate:.0f}%), Feedback {persistence_by_channel[channel]['feedback']}/{persistence_by_channel[channel]['total']} ({feedback_rate:.0f}%) ❌")
                        all_channels_working = False
            
            ml_overall_rate = (total_ml_persisted / total_wells) * 100 if total_wells > 0 else 0
            feedback_overall_rate = (total_feedback_persisted / total_wells) * 100 if total_wells > 0 else 0
            
            print_info(f"Overall ML Persistence: {total_ml_persisted}/{total_wells} ({ml_overall_rate:.1f}%)")
            print_info(f"Overall Feedback Persistence: {total_feedback_persisted}/{total_wells} ({feedback_overall_rate:.1f}%)")
            
            return total_ml_persisted, total_feedback_persisted, total_wells, all_channels_working
            
        else:
            print_error(f"Failed to load session: {response.status_code}")
            return 0, 0, len(ml_predictions), False
            
    except requests.exceptions.RequestException as e:
        print_error(f"Error verifying persistence: {e}")
        return 0, 0, len(ml_predictions), False

def run_multichannel_feedback_test():
    """Run the comprehensive multichannel feedback persistence test"""
    
    print_header("MULTICHANNEL EXPERT FEEDBACK PERSISTENCE TEST")
    
    print_info("This test validates:")
    print_info("✓ ML analysis works across multiple fluorophores")
    print_info("✓ Expert feedback can be submitted for each channel")
    print_info("✓ ML predictions persist for ALL channels")
    print_info("✓ Expert feedback persists for ALL channels") 
    print_info("✓ Session reload preserves both ML and feedback data")
    
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
    session_id, raw_wells = create_multichannel_feedback_session()
    if not session_id:
        print_error("Failed to create multichannel feedback session")
        return False
    
    # Step 2: Run ML analysis and submit expert feedback
    ml_predictions, feedback_results = run_multichannel_ml_and_feedback(session_id, raw_wells)
    if not ml_predictions or not feedback_results:
        print_error("Failed to process ML analysis and feedback")
        return False
    
    # Step 3: Verify both ML and feedback persistence
    ml_persisted, feedback_persisted, total_wells, all_channels_working = verify_multichannel_feedback_persistence(
        session_id, ml_predictions, feedback_results, raw_wells
    )
    
    # Final Results
    print_header("MULTICHANNEL FEEDBACK TEST RESULTS")
    
    ml_rate = (ml_persisted / total_wells) * 100 if total_wells > 0 else 0
    feedback_rate = (feedback_persisted / total_wells) * 100 if total_wells > 0 else 0
    
    if all_channels_working and ml_rate >= 95 and feedback_rate >= 95:
        print_success("🎉 MULTICHANNEL FEEDBACK PERSISTENCE: FULLY WORKING!")
        print_info("✅ ML predictions persist across ALL channels")
        print_info("✅ Expert feedback persists across ALL channels")
        print_info("✅ Each channel maintains independent feedback")
        print_info("✅ Session reloading preserves all multichannel data")
        print_info("✅ Ready for production multichannel expert feedback")
        return True
    elif ml_rate >= 80 and feedback_rate >= 80:
        print_error("⚠️  MULTICHANNEL FEEDBACK PERSISTENCE: MOSTLY WORKING")
        print_info(f"   ML: {ml_persisted}/{total_wells} ({ml_rate:.1f}%)")
        print_info(f"   Feedback: {feedback_persisted}/{total_wells} ({feedback_rate:.1f}%)")
        print_info("   Some channels may have persistence issues")
        return False
    else:
        print_error("❌ MULTICHANNEL FEEDBACK PERSISTENCE: NOT WORKING")
        print_info(f"   ML persistence: {ml_rate:.1f}%")
        print_info(f"   Feedback persistence: {feedback_rate:.1f}%")
        print_info("   Check multichannel feedback and database updates")
        return False

if __name__ == "__main__":
    try:
        success = run_multichannel_feedback_test()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print_error("\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        sys.exit(1)
