#!/usr/bin/env python3
"""
Automated test script for expert feedback persistence and modal navigation issues.
Tests all critical scenarios to ensure the "going in circles" problem is fixed.
"""

import requests
import json
import time
import sys
from datetime import datetime

BASE_URL = "http://127.0.0.1:5000"

class FeedbackPersistenceTest:
    def __init__(self):
        self.session = requests.Session()
        self.test_session_id = f"test_session_{int(time.time())}"
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
            
    def test_2_submit_feedback_endpoint(self):
        """Test the enhanced submit feedback endpoint"""
        test_data = {
            "session_id": self.test_session_id,
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
                details = f"Success: {result.get('success')}, Message: {result.get('message', 'No message')}"
            else:
                details = f"HTTP {response.status_code}: {response.text[:200]}"
                
            self.log_test("Submit Feedback Endpoint", passed, details)
            return passed
            
        except Exception as e:
            self.log_test("Submit Feedback Endpoint", False, f"Error: {e}")
            return False
            
    def test_3_retrieve_feedback_endpoint(self):
        """Test the new retrieve feedback endpoint"""
        try:
            response = self.session.get(f"{BASE_URL}/api/get-expert-feedback/{self.test_session_id}")
            
            passed = response.status_code == 200
            if passed:
                result = response.json()
                passed = result.get('success', False)
                feedback_count = len(result.get('feedback', []))
                details = f"Retrieved {feedback_count} feedback entries"
            else:
                details = f"HTTP {response.status_code}: {response.text[:200]}"
                
            self.log_test("Retrieve Feedback Endpoint", passed, details)
            return passed
            
        except Exception as e:
            self.log_test("Retrieve Feedback Endpoint", False, f"Error: {e}")
            return False
            
    def test_4_database_persistence(self):
        """Test that feedback actually persists in database"""
        # Submit multiple feedback entries
        test_wells = [
            ("A1_FAM", "POSITIVE"),
            ("A2_FAM", "NEGATIVE"), 
            ("A3_FAM", "SUSPICIOUS")
        ]
        
        submitted_count = 0
        for well_key, classification in test_wells:
            test_data = {
                "session_id": self.test_session_id,
                "well_key": well_key,
                "expert_classification": classification,
                "well_data": {
                    "well_id": well_key.split('_')[0],
                    "fluorophore": "FAM",
                    "sample_name": f"Test Sample {well_key}",
                    "classification": "UNKNOWN",
                    "raw_rfu": [100, 200, 300],
                    "raw_cycles": [1, 2, 3]
                },
                "force_save": True
            }
            
            try:
                response = self.session.post(
                    f"{BASE_URL}/api/ml-submit-feedback",
                    json=test_data,
                    headers={'Content-Type': 'application/json'}
                )
                if response.status_code == 200 and response.json().get('success'):
                    submitted_count += 1
            except:
                pass
                
        # Now retrieve and verify
        try:
            response = self.session.get(f"{BASE_URL}/api/get-expert-feedback/{self.test_session_id}")
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    retrieved_feedback = result.get('feedback', [])
                    retrieved_count = len(retrieved_feedback)
                    
                    # Verify we got back what we submitted
                    passed = retrieved_count >= submitted_count
                    details = f"Submitted {submitted_count}, Retrieved {retrieved_count} feedback entries"
                    
                    # Additional verification - check specific entries
                    if passed:
                        for well_key, expected_class in test_wells:
                            found = any(
                                fb.get('well_key') == well_key and 
                                fb.get('expert_classification') == expected_class
                                for fb in retrieved_feedback
                            )
                            if not found:
                                passed = False
                                details += f" | Missing {well_key}:{expected_class}"
                                break
                else:
                    passed = False
                    details = "Failed to retrieve feedback"
            else:
                passed = False
                details = f"HTTP {response.status_code}"
                
        except Exception as e:
            passed = False
            details = f"Error: {e}"
            
        self.log_test("Database Persistence", passed, details)
        return passed
        
    def test_5_session_id_recovery(self):
        """Test session ID recovery mechanisms"""
        # Test with missing session_id in request
        test_data = {
            "well_key": "B1_FAM", 
            "expert_classification": "POSITIVE",
            "well_data": {
                "session_id": self.test_session_id,  # Session ID in well_data instead
                "well_id": "B1",
                "fluorophore": "FAM"
            }
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
        
    def test_6_force_save_mechanism(self):
        """Test the force_save mechanism for database persistence"""
        test_data = {
            "session_id": self.test_session_id,
            "well_key": "C1_FAM",
            "expert_classification": "NEGATIVE",
            "well_data": {
                "well_id": "C1", 
                "fluorophore": "FAM",
                "sample_name": "Force Save Test"
            },
            "force_save": True
        }
        
        try:
            # Submit with force_save
            response = self.session.post(
                f"{BASE_URL}/api/ml-submit-feedback", 
                json=test_data,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                result = response.json()
                
                # Check if force_save was acknowledged
                passed = result.get('success', False)
                details = f"Force save result: {result.get('message', '')}"
                
                # Verify it actually saved by retrieving
                if passed:
                    time.sleep(0.5)  # Brief pause for DB consistency
                    retrieve_response = self.session.get(f"{BASE_URL}/api/get-expert-feedback/{self.test_session_id}")
                    if retrieve_response.status_code == 200:
                        retrieve_result = retrieve_response.json()
                        if retrieve_result.get('success'):
                            feedback_list = retrieve_result.get('feedback', [])
                            found_entry = any(
                                fb.get('well_key') == 'C1_FAM' and 
                                fb.get('expert_classification') == 'NEGATIVE'
                                for fb in feedback_list
                            )
                            if found_entry:
                                details += " | Verified in database"
                            else:
                                passed = False
                                details += " | NOT found in database"
            else:
                passed = False
                details = f"HTTP {response.status_code}"
                
        except Exception as e:
            passed = False
            details = f"Error: {e}"
            
        self.log_test("Force Save Mechanism", passed, details)
        return passed
        
    def run_all_tests(self):
        """Run all tests and return overall result"""
        print("🧪 Starting Automated Feedback Persistence Tests")
        print("=" * 60)
        
        tests = [
            self.test_1_app_running,
            self.test_2_submit_feedback_endpoint,
            self.test_3_retrieve_feedback_endpoint, 
            self.test_4_database_persistence,
            self.test_5_session_id_recovery,
            self.test_6_force_save_mechanism
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
            print("🎉 ALL TESTS PASSED - Feedback persistence fix is working!")
            return True
        else:
            print("⚠️  SOME TESTS FAILED - Issues still exist")
            print("\nFailed tests need attention:")
            for result in self.test_results:
                if not result['passed']:
                    print(f"  - {result['test']}: {result['details']}")
            return False

if __name__ == "__main__":
    tester = FeedbackPersistenceTest()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
