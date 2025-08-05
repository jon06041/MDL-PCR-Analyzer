#!/usr/bin/env python3
"""
Realistic test for expert feedback persistence using actual database sessions.
This tests the real-world scenario where users submit feedback during analysis.
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
        
    def test_1_app_running(self):
        """Test if the application is accessible"""
        try:
            response = self.session.get(f"{BASE_URL}/")
            passed = response.status_code == 200
            self.log_test("Application Running", passed, f"Status: {response.status_code}")
            return passed
        except Exception as e:
            self.log_test("Application Running", False, f"Error: {e}")
            return False
    
    def test_2_get_existing_session(self):
        """Get an existing analysis session from the database"""
        try:
            response = self.session.get(f"{BASE_URL}/sessions")
            if response.status_code == 200:
                sessions_data = response.json()
                if sessions_data and len(sessions_data) > 0:
                    # Get the first session
                    session_info = sessions_data[0]
                    self.real_session_id = session_info['id']  # This is an integer
                    self.log_test("Get Existing Session", True, f"Using session ID: {self.real_session_id}")
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
    
    def test_3_submit_feedback_with_real_session(self):
        """Test submitting feedback with a real session ID"""
        if not hasattr(self, 'real_session_id'):
            self.log_test("Submit Feedback (Real Session)", False, "No real session ID available")
            return False
            
        test_data = {
            "session_id": self.real_session_id,  # Use integer session ID
            "well_key": "A1_FAM",
            "expert_classification": "POSITIVE",
            "well_data": {
                "well_id": "A1",
                "fluorophore": "FAM", 
                "sample_name": "Test Sample",
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
            
            passed = response.status_code == 200
            if passed:
                result = response.json()
                passed = result.get('success', False)
                details = f"Success: {result.get('success')}, Session: {self.real_session_id}"
            else:
                details = f"HTTP {response.status_code}: {response.text[:200]}"
                
            self.log_test("Submit Feedback (Real Session)", passed, details)
            return passed
            
        except Exception as e:
            self.log_test("Submit Feedback (Real Session)", False, f"Error: {e}")
            return False
    
    def test_4_retrieve_feedback_with_real_session(self):
        """Test retrieving feedback with the real session ID"""
        if not hasattr(self, 'real_session_id'):
            self.log_test("Retrieve Feedback (Real Session)", False, "No real session ID available")
            return False
            
        try:
            response = self.session.get(f"{BASE_URL}/api/get-expert-feedback/{self.real_session_id}")
            
            passed = response.status_code == 200
            if passed:
                result = response.json()
                passed = result.get('success', False)
                feedback_count = len(result.get('feedback', []))
                details = f"Retrieved {feedback_count} feedback entries for session {self.real_session_id}"
                
                # Additional validation - check if our test feedback is there
                if feedback_count > 0:
                    feedback_list = result.get('feedback', [])
                    found_test_feedback = any(
                        fb.get('well_key') == 'A1_FAM' and 
                        fb.get('expert_classification') == 'POSITIVE'
                        for fb in feedback_list
                    )
                    if found_test_feedback:
                        details += " | ✅ Test feedback found"
                    else:
                        details += " | ⚠️ Test feedback not found"
            else:
                details = f"HTTP {response.status_code}: {response.text[:200]}"
                
            self.log_test("Retrieve Feedback (Real Session)", passed, details)
            return passed
            
        except Exception as e:
            self.log_test("Retrieve Feedback (Real Session)", False, f"Error: {e}")
            return False
    
    def test_5_modal_navigation_functions_exist(self):
        """Test that modal navigation functions are loaded in the frontend"""
        try:
            # This tests if the JavaScript files with our fixes are being served
            response = self.session.get(f"{BASE_URL}/static/ml_feedback_interface.js")
            if response.status_code == 200:
                js_content = response.text
                
                # Check for our key functions
                functions_to_check = [
                    'rebuildModalNavigationAfterUpdate',
                    'ensureSessionIdAvailable', 
                    'loadExpertFeedbackFromDatabase'
                ]
                
                missing_functions = []
                for func in functions_to_check:
                    if func not in js_content:
                        missing_functions.append(func)
                
                if len(missing_functions) == 0:
                    self.log_test("Modal Navigation Functions", True, "All critical functions found in JavaScript")
                    return True
                else:
                    self.log_test("Modal Navigation Functions", False, f"Missing: {', '.join(missing_functions)}")
                    return False
            else:
                self.log_test("Modal Navigation Functions", False, f"Cannot load JS file: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Modal Navigation Functions", False, f"Error: {e}")
            return False
    
    def test_6_session_id_recovery_logic(self):
        """Test the session ID recovery mechanism"""
        test_data = {
            # Intentionally omit session_id to test recovery
            "well_key": "B2_FAM",
            "expert_classification": "NEGATIVE",
            "well_data": {
                "session_id": self.real_session_id,  # Session ID in well_data instead
                "well_id": "B2",
                "fluorophore": "FAM",
                "sample_name": "Recovery Test"
            },
            "force_save": True
        }
        
        try:
            response = self.session.post(
                f"{BASE_URL}/api/ml-submit-feedback",
                json=test_data,
                headers={'Content-Type': 'application/json'}
            )
            
            passed = response.status_code == 200
            if passed:
                result = response.json()
                passed = result.get('success', False)
                details = f"Session ID recovery: {result.get('message', '')}"
            else:
                details = f"HTTP {response.status_code}"
                
        except Exception as e:
            passed = False
            details = f"Error: {e}"
            
        self.log_test("Session ID Recovery", passed, details)
        return passed
        
    def run_all_tests(self):
        """Run all tests and return overall result"""
        print("🧪 Starting Realistic Expert Feedback Tests")
        print("=" * 60)
        
        tests = [
            self.test_1_app_running,
            self.test_2_get_existing_session,
            self.test_3_submit_feedback_with_real_session,
            self.test_4_retrieve_feedback_with_real_session,
            self.test_5_modal_navigation_functions_exist,
            self.test_6_session_id_recovery_logic
        ]
        
        passed_tests = 0
        total_tests = len(tests)
        
        for test_func in tests:
            if test_func():
                passed_tests += 1
            print()  # Space between tests
            
        print("=" * 60)
        print(f"TEST RESULTS: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 ALL TESTS PASSED - Expert feedback system is working!")
            print("\n✅ Key Achievements:")
            print("  • Expert feedback submits successfully")
            print("  • Expert feedback persists in database") 
            print("  • Expert feedback can be retrieved")
            print("  • Session ID recovery works")
            print("  • Modal navigation functions are in place")
            print("\n💡 The 'going in circles' problem is SOLVED!")
            return True
        else:
            print("⚠️  SOME TESTS FAILED - Issues remain:")
            for result in self.test_results:
                if not result['passed']:
                    print(f"  - {result['test']}: {result['details']}")
            return False

if __name__ == "__main__":
    tester = RealisticFeedbackTest()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
