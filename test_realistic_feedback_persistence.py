#!/usr/bin/env python3
"""
Realistic test for expert feedback persistence using actual MySQL database structure.
Tests the fix with proper session IDs and existing data.
"""

import requests
import json
import time
import sys
from datetime import datetime

BASE_URL = "http://127.0.0.1:5000"

class RealisticFeedbackTest:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.actual_session_id = None
        
    def log_test(self, test_name, passed, details=""):
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"    {details}")
        self.test_results.append({
            'test': test_name,
            'passed': passed,
            'details': details,
            'timestamp': datetime.now().isoformat()
        })
        
    def test_1_get_existing_session(self):
        """Get an actual session ID from the database"""
        try:
            response = self.session.get(f"{BASE_URL}/sessions")
            if response.status_code == 200:
                # Try to parse the sessions from the response
                sessions_html = response.text
                # Look for session links or session data
                import re
                session_matches = re.findall(r'/sessions/(\d+)', sessions_html)
                if session_matches:
                    self.actual_session_id = int(session_matches[0])
                    self.log_test("Get Existing Session", True, f"Found session ID: {self.actual_session_id}")
                    return True
                else:
                    self.log_test("Get Existing Session", False, "No sessions found in database")
                    return False
            else:
                self.log_test("Get Existing Session", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Get Existing Session", False, f"Error: {e}")
            return False
            
    def test_2_submit_feedback_with_real_session(self):
        """Test feedback submission with real session ID"""
        if not self.actual_session_id:
            self.log_test("Submit Feedback (Real Session)", False, "No valid session ID available")
            return False
            
        test_data = {
            "session_id": self.actual_session_id,  # Use actual integer session ID
            "well_key": "A1_FAM",
            "expert_classification": "POSITIVE",
            "well_data": {
                "well_id": "A1",
                "fluorophore": "FAM", 
                "sample_name": "Test Sample Real",
                "classification": "NEGATIVE",
                "raw_rfu": [100, 200, 300, 400, 500],
                "raw_cycles": [1, 2, 3, 4, 5],
                "r2_score": 0.95,
                "amplitude": 1000,
                "snr": 10.5
            },
            "force_save": True
        }
        
        try:
            response = self.session.post(
                f"{BASE_URL}/api/ml-submit-feedback",
                json=test_data,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                result = response.json()
                passed = result.get('success', False)
                details = f"Success: {result.get('success')}, Session: {self.actual_session_id}"
            else:
                passed = False
                details = f"HTTP {response.status_code}: {response.text[:200]}"
                
            self.log_test("Submit Feedback (Real Session)", passed, details)
            return passed
            
        except Exception as e:
            self.log_test("Submit Feedback (Real Session)", False, f"Error: {e}")
            return False
            
    def test_3_retrieve_feedback_with_real_session(self):
        """Test feedback retrieval with real session ID"""
        if not self.actual_session_id:
            self.log_test("Retrieve Feedback (Real Session)", False, "No valid session ID available")
            return False
            
        try:
            response = self.session.get(f"{BASE_URL}/api/get-expert-feedback/{self.actual_session_id}")
            
            if response.status_code == 200:
                result = response.json()
                passed = result.get('success', False)
                feedback_count = len(result.get('feedback', []))
                details = f"Retrieved {feedback_count} feedback entries for session {self.actual_session_id}"
                
                # Look for our test feedback
                if passed and feedback_count > 0:
                    test_feedback = [fb for fb in result['feedback'] 
                                   if fb.get('well_key') == 'A1_FAM' and 
                                      fb.get('expert_classification') == 'POSITIVE']
                    if test_feedback:
                        details += " | ✅ Found our test feedback!"
                    else:
                        details += " | ⚠️ Test feedback not found"
                        
            else:
                passed = False
                details = f"HTTP {response.status_code}: {response.text[:200]}"
                
            self.log_test("Retrieve Feedback (Real Session)", passed, details)
            return passed
            
        except Exception as e:
            self.log_test("Retrieve Feedback (Real Session)", False, f"Error: {e}")
            return False
            
    def test_4_session_id_recovery_mechanism(self):
        """Test the session ID recovery mechanism from well_data"""
        if not self.actual_session_id:
            self.log_test("Session ID Recovery", False, "No valid session ID available")
            return False
            
        # Test submitting without session_id in main body, but in well_data
        test_data = {
            "well_key": "B2_FAM",
            "expert_classification": "NEGATIVE", 
            "well_data": {
                "session_id": self.actual_session_id,  # Session ID in well_data
                "well_id": "B2",
                "fluorophore": "FAM",
                "sample_name": "Recovery Test",
                "classification": "POSITIVE"
            }
        }
        
        try:
            response = self.session.post(
                f"{BASE_URL}/api/ml-submit-feedback",
                json=test_data,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                result = response.json()
                passed = result.get('success', False)
                details = f"Session ID recovery worked: {result.get('message', '')}"
            else:
                passed = False
                details = f"HTTP {response.status_code}"
                
            self.log_test("Session ID Recovery", passed, details)
            return passed
            
        except Exception as e:
            self.log_test("Session ID Recovery", False, f"Error: {e}")
            return False
            
    def test_5_end_to_end_persistence(self):
        """End-to-end test: Submit feedback, then retrieve it"""
        if not self.actual_session_id:
            self.log_test("End-to-End Persistence", False, "No valid session ID available")
            return False
            
        # Submit unique feedback
        unique_well = f"C3_FAM_{int(time.time())}"
        test_data = {
            "session_id": self.actual_session_id,
            "well_key": unique_well,
            "expert_classification": "SUSPICIOUS",
            "well_data": {
                "well_id": unique_well.split('_')[0],
                "fluorophore": "FAM",
                "sample_name": f"EndToEnd Test {unique_well}",
                "classification": "NEGATIVE"
            },
            "force_save": True
        }
        
        try:
            # Submit
            submit_response = self.session.post(
                f"{BASE_URL}/api/ml-submit-feedback",
                json=test_data,
                headers={'Content-Type': 'application/json'}
            )
            
            if submit_response.status_code != 200 or not submit_response.json().get('success'):
                self.log_test("End-to-End Persistence", False, "Submit failed")
                return False
                
            # Wait a moment for database consistency
            time.sleep(1)
            
            # Retrieve
            retrieve_response = self.session.get(f"{BASE_URL}/api/get-expert-feedback/{self.actual_session_id}")
            
            if retrieve_response.status_code == 200:
                result = retrieve_response.json()
                if result.get('success'):
                    feedback_list = result.get('feedback', [])
                    # Look for our unique feedback
                    found_feedback = any(
                        fb.get('well_key') == unique_well and 
                        fb.get('expert_classification') == 'SUSPICIOUS'
                        for fb in feedback_list
                    )
                    
                    if found_feedback:
                        self.log_test("End-to-End Persistence", True, 
                                    f"✅ Successfully persisted and retrieved feedback for {unique_well}")
                        return True
                    else:
                        self.log_test("End-to-End Persistence", False, 
                                    f"Feedback submitted but not found in retrieval ({len(feedback_list)} total)")
                        return False
                else:
                    self.log_test("End-to-End Persistence", False, "Retrieve failed")
                    return False
            else:
                self.log_test("End-to-End Persistence", False, f"Retrieve HTTP {retrieve_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("End-to-End Persistence", False, f"Error: {e}")
            return False
            
    def run_all_tests(self):
        """Run all realistic tests"""
        print("🧪 Starting Realistic Expert Feedback Persistence Tests")
        print("=" * 70)
        
        tests = [
            self.test_1_get_existing_session,
            self.test_2_submit_feedback_with_real_session,
            self.test_3_retrieve_feedback_with_real_session,
            self.test_4_session_id_recovery_mechanism,
            self.test_5_end_to_end_persistence
        ]
        
        passed_tests = 0
        total_tests = len(tests)
        
        for test_func in tests:
            if test_func():
                passed_tests += 1
            print()  # Space between tests
            
        print("=" * 70)
        print(f"REALISTIC TEST RESULTS: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 ALL REALISTIC TESTS PASSED - Expert feedback persistence is working!")
            print("✅ The 'going in circles' issue has been resolved!")
            return True
        else:
            print("⚠️  SOME TESTS FAILED - Review the specific failures above")
            return False

if __name__ == "__main__":
    tester = RealisticFeedbackTest()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
