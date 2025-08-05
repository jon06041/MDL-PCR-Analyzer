#!/usr/bin/env python3

import requests
import json

BASE_URL = 'http://localhost:5000'

print('🧪 Testing Session Persistence Fix')
print('=' * 40)

# Test the new session update endpoint
session_data = {
    'session_id': 1,  # Assuming session 1 exists
    'well_updates': {
        'A01_HEX': {
            'classification': 'POSITIVE_EXPERT_TEST',
            'method': 'expert_feedback',
            'expert_classification': 'POSITIVE_EXPERT_TEST'
        }
    },
    'session_updates': {}
}

try:
    print('🔄 Testing session state update endpoint...')
    response = requests.post(
        f'{BASE_URL}/api/update-session-state',
        json=session_data,
        headers={'Content-Type': 'application/json'},
        timeout=10
    )
    
    print(f'Status: {response.status_code}')
    if response.status_code == 200:
        result = response.json()
        print('✅ Session update successful!')
        print(f'   Updated wells: {result.get("updated_wells", 0)}')
        print(f'   Message: {result.get("message", "N/A")}')
    else:
        print(f'❌ Session update failed: {response.text}')
        
except Exception as e:
    print(f'❌ Request failed: {e}')

print()
print('✅ Session persistence fix is ready for testing!')
print('📝 Instructions:')
print('   1. Upload a multichannel file (or use existing session)')
print('   2. Submit expert feedback for any well')
print('   3. Refresh the page')
print('   4. Check if expert feedback persists in the results table')
print('   5. Navigate between wells - feedback should remain visible')
