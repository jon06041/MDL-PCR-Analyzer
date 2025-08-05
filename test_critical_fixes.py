#!/usr/bin/env python3
"""
Critical Fixes Validation Test
Tests the actual critical issues found in the expert feedback system
"""

import asyncio
import json
import logging
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

import aiohttp

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CriticalFixTester:
    def __init__(self):
        self.base_url = "http://localhost:5000"
        self.test_results = []
        
    def log_result(self, test_name, success, details=""):
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        logger.info(f"{status}: {test_name} - {details}")
        
    async def test_api_endpoint_fixes(self):
        """Test the corrected API endpoint calls"""
        async with aiohttp.ClientSession() as session:
            # Test the GET endpoint with session ID in URL (fixed endpoint)
            try:
                session_id = "test_session_12345"
                response = await session.get(f"{self.base_url}/api/get-expert-feedback/{session_id}")
                
                if response.status == 200:
                    data = await response.json()
                    expected_format = {"success": True, "feedback": []}
                    
                    if "success" in data and "feedback" in data:
                        self.log_result("API Endpoint Format", True, f"Correct format returned: {type(data['feedback'])}")
                    else:
                        self.log_result("API Endpoint Format", False, f"Wrong format: {list(data.keys())}")
                else:
                    self.log_result("API Endpoint Access", False, f"Status {response.status}")
                    
            except Exception as e:
                self.log_result("API Endpoint Access", False, f"Exception: {str(e)}")
    
    async def test_expert_feedback_submission_and_retrieval(self):
        """Test the complete expert feedback workflow"""
        async with aiohttp.ClientSession() as session:
            try:
                # Submit expert feedback
                session_id = f"test_workflow_{int(datetime.now().timestamp())}"
                feedback_data = {
                    "rfu_data": [100, 200, 400, 800, 1600, 3200],
                    "cycles": [1, 2, 3, 4, 5, 6],
                    "well_data": {
                        "well": "A01",
                        "target": "COVID19",
                        "sample": "Test_Sample_001",
                        "classification": "POSITIVE",
                        "channel": "FAM"
                    },
                    "expert_classification": "POSITIVE",
                    "well_id": "A01_FAM",
                    "session_id": session_id,
                    "existing_metrics": {
                        "r2": 0.95,
                        "steepness": 1.2,
                        "snr": 15.0,
                        "classification": "POSITIVE"
                    }
                }
                
                # Submit feedback
                submit_response = await session.post(
                    f"{self.base_url}/api/ml-submit-feedback",
                    json=feedback_data,
                    headers={"Content-Type": "application/json"}
                )
                
                if submit_response.status == 200:
                    submit_result = await submit_response.json()
                    if submit_result.get("success"):
                        self.log_result("Expert Feedback Submission", True, f"Training samples: {submit_result.get('training_samples', 'N/A')}")
                        
                        # Now test retrieval with the FIXED endpoint
                        await asyncio.sleep(1)  # Brief delay
                        
                        retrieve_response = await session.get(f"{self.base_url}/api/get-expert-feedback/{session_id}")
                        
                        if retrieve_response.status == 200:
                            retrieve_result = await retrieve_response.json()
                            
                            if retrieve_result.get("success") and len(retrieve_result.get("feedback", [])) > 0:
                                feedback_item = retrieve_result["feedback"][0]
                                if feedback_item.get("expert_classification") == "POSITIVE":
                                    self.log_result("Expert Feedback Retrieval", True, f"Retrieved {len(retrieve_result['feedback'])} feedback items")
                                    
                                    # Test data integrity
                                    expected_fields = ["well_key", "expert_classification", "original_classification", "timestamp"]
                                    missing_fields = [f for f in expected_fields if f not in feedback_item]
                                    
                                    if not missing_fields:
                                        self.log_result("Feedback Data Integrity", True, "All expected fields present")
                                    else:
                                        self.log_result("Feedback Data Integrity", False, f"Missing fields: {missing_fields}")
                                else:
                                    self.log_result("Expert Feedback Retrieval", False, f"Wrong classification: {feedback_item.get('expert_classification')}")
                            else:
                                self.log_result("Expert Feedback Retrieval", False, "No feedback found or wrong format")
                        else:
                            self.log_result("Expert Feedback Retrieval", False, f"Retrieve status: {retrieve_response.status}")
                    else:
                        self.log_result("Expert Feedback Submission", False, f"Submit failed: {submit_result}")
                else:
                    self.log_result("Expert Feedback Submission", False, f"Submit status: {submit_response.status}")
                    
            except Exception as e:
                self.log_result("Expert Feedback Workflow", False, f"Exception: {str(e)}")

    def test_javascript_function_exposure(self):
        """Test if the JavaScript functions are properly exposed to global scope"""
        script_js_path = Path("static/script.js")
        
        if not script_js_path.exists():
            self.log_result("JavaScript File Access", False, "script.js not found")
            return
            
        try:
            with open(script_js_path, 'r') as f:
                content = f.read()
                
            # Check for the critical global assignments
            required_assignments = [
                "window.buildModalNavigationList = buildModalNavigationList",
                "window.updateNavigationButtons = updateNavigationButtons", 
                "window.populateResultsTable = populateResultsTable"
            ]
            
            found_assignments = []
            missing_assignments = []
            
            for assignment in required_assignments:
                if assignment in content:
                    found_assignments.append(assignment.split('=')[0].strip())
                else:
                    missing_assignments.append(assignment.split('=')[0].strip())
            
            if not missing_assignments:
                self.log_result("JavaScript Function Exposure", True, f"All {len(found_assignments)} functions exposed")
            else:
                self.log_result("JavaScript Function Exposure", False, f"Missing: {missing_assignments}")
                
            # Check for the API endpoint fix in loadExpertFeedbackFromDatabase
            if "/api/get-expert-feedback/${analysisResults.session_id}" in content:
                self.log_result("API Endpoint Fix in JavaScript", True, "Correct GET endpoint with session ID")
            else:
                self.log_result("API Endpoint Fix in JavaScript", False, "Old POST endpoint still present")
                
        except Exception as e:
            self.log_result("JavaScript File Analysis", False, f"Exception: {str(e)}")

    def test_database_session_id_handling(self):
        """Test if session ID handling is fixed in database operations"""
        try:
            # Check if database exists
            db_path = Path("qpcr_analysis.db")
            if not db_path.exists():
                self.log_result("Database Access", False, "Database file not found")
                return
                
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            
            # Check if well_results table has the correct schema
            cursor.execute("PRAGMA table_info(well_results)")
            columns = {row[1]: row[2] for row in cursor.fetchall()}
            
            if "session_id" in columns:
                session_id_type = columns["session_id"]
                self.log_result("Database Schema", True, f"session_id column type: {session_id_type}")
                
                # Test inserting a string session ID (should work now)
                test_session_id = f"test_string_session_{int(datetime.now().timestamp())}"
                try:
                    cursor.execute("""
                        INSERT INTO well_results (session_id, well_key, expert_classification, original_classification, timestamp)
                        VALUES (?, ?, ?, ?, ?)
                    """, (test_session_id, "TEST_WELL", "POSITIVE", "NEGATIVE", datetime.now().isoformat()))
                    conn.commit()
                    
                    # Verify we can retrieve it
                    cursor.execute("SELECT * FROM well_results WHERE session_id = ?", (test_session_id,))
                    result = cursor.fetchone()
                    
                    if result:
                        self.log_result("String Session ID Support", True, f"Successfully stored and retrieved string session ID")
                        
                        # Clean up test data
                        cursor.execute("DELETE FROM well_results WHERE session_id = ?", (test_session_id,))
                        conn.commit()
                    else:
                        self.log_result("String Session ID Support", False, "Could not retrieve stored string session ID")
                        
                except Exception as e:
                    self.log_result("String Session ID Support", False, f"Error with string session ID: {str(e)}")
            else:
                self.log_result("Database Schema", False, "session_id column not found")
            
            conn.close()
            
        except Exception as e:
            self.log_result("Database Session ID Test", False, f"Exception: {str(e)}")

    async def run_all_tests(self):
        """Run all critical fix tests"""
        logger.info("🚀 Starting Critical Fixes Validation Tests")
        
        # Test 1: JavaScript function exposure
        self.test_javascript_function_exposure()
        
        # Test 2: Database session ID handling  
        self.test_database_session_id_handling()
        
        # Test 3: API endpoint fixes
        await self.test_api_endpoint_fixes()
        
        # Test 4: Complete workflow test
        await self.test_expert_feedback_submission_and_retrieval()
        
        # Results summary
        passed = sum(1 for r in self.test_results if r["success"])
        total = len(self.test_results)
        
        logger.info(f"\n{'='*60}")
        logger.info(f"CRITICAL FIXES TEST SUMMARY: {passed}/{total} tests passed")
        logger.info(f"{'='*60}")
        
        if passed == total:
            logger.info("🎉 ALL CRITICAL FIXES WORKING!")
            return True
        else:
            logger.error("⚠️  SOME CRITICAL FIXES STILL FAILING")
            failed_tests = [r for r in self.test_results if not r["success"]]
            for test in failed_tests:
                logger.error(f"❌ {test['test']}: {test['details']}")
            return False

async def main():
    tester = CriticalFixTester()
    success = await tester.run_all_tests()
    
    # Save results to file
    with open("critical_fixes_test_results.json", "w") as f:
        json.dump(tester.test_results, f, indent=2)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())
