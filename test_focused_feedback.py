#!/usr/bin/env python3
"""
Quick focused test using existing session ID 29 to demonstrate the feedback persistence fix.
"""

import requests
import json
import time

BASE_URL = "http://127.0.0.1:5000"
REAL_SESSION_ID = 29  # From the sessions API response

def test_feedback_with_real_session():
    session = requests.Session()
    
    print("🧪 Testing Expert Feedback Persistence with Real Session")
    print("=" * 60)
    
    # Test 1: Submit feedback with real session ID
    print(f"📤 Submitting feedback for session {REAL_SESSION_ID}...")
    
    test_data = {
        "session_id": REAL_SESSION_ID,
        "well_key": "A10_HEX",  # Using a well from the actual session
        "expert_classification": "POSITIVE",
        "well_data": {
            "well_id": "A10",
            "fluorophore": "HEX",
            "sample_name": "Test Expert Feedback",
            "classification": "NEGATIVE",
            "raw_rfu": [100, 200, 300],
            "raw_cycles": [1, 2, 3],
            "r2_score": 0.85,
            "amplitude": 225.322
        },
        "force_save": True
    }
    
    try:
        response = session.post(
            f"{BASE_URL}/api/ml-submit-feedback",
            json=test_data,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            result = response.json()
            submit_success = result.get('success', False)
            print(f"   ✅ Submit: {submit_success} - {result.get('message', '')}")
        else:
            print(f"   ❌ Submit failed: HTTP {response.status_code}")
            submit_success = False
            
    except Exception as e:
        print(f"   ❌ Submit error: {e}")
        submit_success = False
    
    if not submit_success:
        print("❌ Cannot proceed with retrieval test - submission failed")
        return False
        
    # Wait for database consistency
    time.sleep(2)
    
    # Test 2: Retrieve feedback
    print(f"📥 Retrieving feedback for session {REAL_SESSION_ID}...")
    
    try:
        response = session.get(f"{BASE_URL}/api/get-expert-feedback/{REAL_SESSION_ID}")
        
        if response.status_code == 200:
            result = response.json()
            retrieve_success = result.get('success', False)
            feedback_list = result.get('feedback', [])
            
            print(f"   ✅ Retrieve: {retrieve_success} - Found {len(feedback_list)} feedback entries")
            
            # Look for our specific feedback
            our_feedback = [fb for fb in feedback_list 
                          if fb.get('well_key') == 'A10_HEX' and 
                             fb.get('expert_classification') == 'POSITIVE']
            
            if our_feedback:
                print(f"   🎯 SUCCESS: Found our test feedback!")
                print(f"      Well: {our_feedback[0].get('well_key')}")
                print(f"      Classification: {our_feedback[0].get('expert_classification')}")
                print(f"      Timestamp: {our_feedback[0].get('timestamp')}")
                return True
            else:
                print(f"   ⚠️  Our specific feedback not found (but {len(feedback_list)} others exist)")
                # Print first few to debug
                for i, fb in enumerate(feedback_list[:3]):
                    print(f"      [{i+1}] {fb.get('well_key')} -> {fb.get('expert_classification')}")
                return False
                
        else:
            print(f"   ❌ Retrieve failed: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Retrieve error: {e}")
        return False

if __name__ == "__main__":
    success = test_feedback_with_real_session()
    
    print("\n" + "=" * 60)
    if success:
        print("🎉 EXPERT FEEDBACK PERSISTENCE TEST PASSED!")
        print("✅ The fix is working - feedback is being saved and retrieved correctly!")
        print("✅ The 'going in circles' issue has been resolved!")
    else:
        print("❌ Test failed - need to investigate further")
    
    exit(0 if success else 1)
