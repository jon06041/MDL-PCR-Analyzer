#!/usr/bin/env python3
"""
Critical Fixes Validation Test - Simplified Version
Tests the actual critical issues found in the expert feedback system
"""

import json
import logging
import sqlite3
import sys
import urllib.request
import urllib.parse
from datetime import datetime
from pathlib import Path

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
            elif "/api/get-expert-feedback/" in content and "${" in content:
                self.log_result("API Endpoint Fix in JavaScript", True, "GET endpoint with dynamic session ID found")
            else:
                self.log_result("API Endpoint Fix in JavaScript", False, "Old POST endpoint still present or no GET endpoint")
                
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

    def test_ml_feedback_interface_functions(self):
        """Test if the ML feedback interface has the correct function calls"""
        ml_interface_path = Path("static/ml_feedback_interface.js")
        
        if not ml_interface_path.exists():
            self.log_result("ML Interface File Access", False, "ml_feedback_interface.js not found")
            return
            
        try:
            with open(ml_interface_path, 'r') as f:
                content = f.read()
                
            # Check for critical function calls in submitFeedback
            critical_calls = [
                "this.rebuildModalNavigationAfterUpdate()",
                "this.updateResultsTableAfterFeedback(",
                "window.buildModalNavigationList",
                "window.populateResultsTable"
            ]
            
            found_calls = []
            missing_calls = []
            
            for call in critical_calls:
                if call in content:
                    found_calls.append(call)
                else:
                    missing_calls.append(call)
            
            if not missing_calls:
                self.log_result("ML Interface Function Calls", True, f"All {len(found_calls)} critical function calls found")
            else:
                self.log_result("ML Interface Function Calls", False, f"Missing calls: {missing_calls}")
                
        except Exception as e:
            self.log_result("ML Interface File Analysis", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all critical fix tests"""
        logger.info("🚀 Starting Critical Fixes Validation Tests")
        
        # Test 1: JavaScript function exposure
        self.test_javascript_function_exposure()
        
        # Test 2: Database session ID handling  
        self.test_database_session_id_handling()
        
        # Test 3: ML feedback interface function calls
        self.test_ml_feedback_interface_functions()
        
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

def main():
    tester = CriticalFixTester()
    success = tester.run_all_tests()
    
    # Save results to file
    with open("critical_fixes_test_results.json", "w") as f:
        json.dump(tester.test_results, f, indent=2)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
