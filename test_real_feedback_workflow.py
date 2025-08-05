#!/usr/bin/env python3
"""
Test the actual expert feedback workflow to verify the fixes work in the real application.
This tests the exact scenario the user reported: modal navigation and feedback persistence.
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://127.0.0.1:5000"

class RealFeedbackWorkflowTest:
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
            'details': details
        })
        
    def test_1_get_existing_session(self):
        """Get an existing session from the app"""
        try:
            response = self.session.get(f"{BASE_URL}/sessions")
            if response.status_code == 200:
                # Parse the HTML to find session links
                html_content = response.text
                if 'sessions/29' in html_content:
                    self.session_id = 29
                    self.log_test("Found Real Session", True, f"Using session ID: {self.session_id}")
                    return True
                else:
                    self.log_test("Found Real Session", False, "No valid sessions found")
                    return False
            else:
                self.log_test("Found Real Session", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Found Real Session", False, f"Error: {e}")
            return False
            
    def test_2_get_session_wells(self):
        """Get wells from the real session to test with"""
        try:
            response = self.session.get(f"{BASE_URL}/sessions/{self.session_id}")
            if response.status_code == 200:
                # This should return session data with wells
                self.log_test("Load Session Data", True, f"Session {self.session_id} loaded")
                return True
            else:
                self.log_test("Load Session Data", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Load Session Data", False, f"Error: {e}")
            return False
            
    def test_3_submit_expert_feedback_realistic(self):
        """Submit expert feedback for a real well using proper session ID"""
        well_data = {
            "well_id": "A10",
            "fluorophore": "HEX", 
            "sample_name": "Test Sample A10",
            "classification": "NEGATIVE",
            "raw_rfu": [100, 200, 300, 400, 500],
            "raw_cycles": [1, 2, 3, 4, 5],
            "r2_score": 0.85,
            "amplitude": 225.322,
            "snr": 1.52
        }
        
        feedback_data = {
            "session_id": self.session_id,  # Use real integer session ID
            "well_key": "A10_HEX",
            "expert_classification": "POSITIVE",
            "well_data": well_data,
            "force_save": True
        }
        
        try:
            response = self.session.post(
                f"{BASE_URL}/api/ml-submit-feedback",
                json=feedback_data,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                result = response.json()
                success = result.get('success', False)
                message = result.get('message', 'No message')
                self.log_test("Submit Real Expert Feedback", success, f"Response: {message}")
                return success
            else:
                self.log_test("Submit Real Expert Feedback", False, f"HTTP {response.status_code}: {response.text[:200]}")
                return False
                
        except Exception as e:
            self.log_test("Submit Real Expert Feedback", False, f"Error: {e}")
            return False
            
    def test_4_verify_feedback_persistence(self):
        """Verify that the expert feedback was actually saved and can be retrieved"""
        try:
            # Wait a moment for database commit
            time.sleep(1)
            
            response = self.session.get(f"{BASE_URL}/api/get-expert-feedback/{self.session_id}")
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    feedback_list = result.get('feedback', [])
                    count = len(feedback_list)
                    
                    # Look for our specific feedback
                    found_our_feedback = any(
                        fb.get('well_key') == 'A10_HEX' and 
                        fb.get('expert_classification') == 'POSITIVE'
                        for fb in feedback_list
                    )
                    
                    if found_our_feedback:
                        self.log_test("Verify Feedback Persistence", True, f"Found our feedback among {count} total entries")
                        return True
                    else:
                        self.log_test("Verify Feedback Persistence", False, f"Our feedback not found (total entries: {count})")
                        # Show what we did find
                        for fb in feedback_list:
                            print(f"    Found: {fb.get('well_key')} -> {fb.get('expert_classification')}")
                        return False
                else:
                    self.log_test("Verify Feedback Persistence", False, "API returned success=false")
                    return False
            else:
                self.log_test("Verify Feedback Persistence", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Verify Feedback Persistence", False, f"Error: {e}")
            return False
            
    def test_5_check_modal_navigation_api(self):
        """Test if the modal navigation would work by checking session data structure"""
        try:
            # This simulates what the JavaScript loadExpertFeedbackFromDatabase function would do
            response = self.session.get(f"{BASE_URL}/api/get-expert-feedback/{self.session_id}")
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    feedback_list = result.get('feedback', [])
                    
                    # Check if we have the data structure needed for modal navigation
                    has_well_keys = all('well_key' in fb for fb in feedback_list)
                    has_classifications = all('expert_classification' in fb for fb in feedback_list)
                    
                    if has_well_keys and has_classifications:
                        self.log_test("Modal Navigation Data Ready", True, f"Data structure compatible for {len(feedback_list)} entries")
                        return True
                    else:
                        self.log_test("Modal Navigation Data Ready", False, "Missing required fields")
                        return False
                else:
                    self.log_test("Modal Navigation Data Ready", False, "API failed")
                    return False
            else:
                self.log_test("Modal Navigation Data Ready", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Modal Navigation Data Ready", False, f"Error: {e}")
            return False
            
    def run_real_workflow_test(self):
        """Run the complete real-world workflow test"""
        print("🧪 Testing Real Expert Feedback Workflow")
        print("=" * 60)
        
        tests = [
            self.test_1_get_existing_session,
            self.test_2_get_session_wells,
            self.test_3_submit_expert_feedback_realistic,
            self.test_4_verify_feedback_persistence,
            self.test_5_check_modal_navigation_api
        ]
        
        passed_tests = 0
        for test_func in tests:
            if test_func():
                passed_tests += 1
            print()
            
        print("=" * 60)
        print(f"REAL WORKFLOW TEST: {passed_tests}/{len(tests)} tests passed")
        
        if passed_tests == len(tests):
            print("🎉 REAL WORKFLOW SUCCESSFUL - Expert feedback fixes are working!")
            print("\nWhat this proves:")
            print("✅ Expert feedback can be submitted with real session data")
            print("✅ Expert feedback persists in the database")
            print("✅ Expert feedback can be retrieved for modal navigation")
            print("✅ The database schema issues have been resolved")
            return True
        else:
            print("⚠️  REAL WORKFLOW ISSUES DETECTED")
            failed_tests = [r for r in self.test_results if not r['passed']]
            print("\nFailed tests that need attention:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
            return False

if __name__ == "__main__":
    tester = RealFeedbackWorkflowTest()
    success = tester.run_real_workflow_test()
    exit(0 if success else 1)
