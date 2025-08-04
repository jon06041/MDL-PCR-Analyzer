#!/usr/bin/env python3
"""
Quick debug test to see what session save endpoint receives
"""

import requests
import json

BASE_URL = "http://localhost:8080"

# Create a minimal test case
test_data = {
    'filename': 'DEBUG_TEST.csv',
    'combined_results': {
        'individual_results': {
            'A1_FAM': {
                'well_id': 'A1_FAM',
                'sample_name': 'Test_Sample',
                'classification': 'POSITIVE',
                'raw_rfu': [50, 60, 100, 200, 500],
                'raw_cycles': [1, 2, 3, 4, 5],
                'amplitude': 500.0,
                'r2_score': 0.95,
                'cq_value': 25.0,
                'fluorophore': 'FAM'
            }
        }
    },
    'summary': {
        'total_wells': 1,
        'positive_wells': 1,
        'negative_wells': 0
    }
}

print("Sending test session data:")
print(json.dumps(test_data, indent=2))

try:
    response = requests.post(f"{BASE_URL}/sessions/save-combined", json=test_data, timeout=10)
    print(f"\nResponse status: {response.status_code}")
    print(f"Response text: {response.text}")
    
    if response.status_code == 200:
        result = response.json()
        session_id = result.get('session_id')
        print(f"\nSession created with ID: {session_id}")
        
        # Now try to load it back
        load_response = requests.get(f"{BASE_URL}/sessions/{session_id}", timeout=10)
        print(f"\nLoad response status: {load_response.status_code}")
        if load_response.status_code == 200:
            session_data = load_response.json()
            wells = session_data.get('wells', [])
            print(f"Wells loaded: {len(wells)}")
            for well in wells:
                print(f"  Well: {well.get('well_id')} - {well.get('sample_name')}")
        else:
            print(f"Failed to load session: {load_response.text}")
    
except Exception as e:
    print(f"Error: {e}")
