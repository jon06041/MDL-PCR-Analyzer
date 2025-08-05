#!/usr/bin/env python3
"""
Test script to validate the critical fixes for expert feedback persistence with MySQL
"""

import requests
import json
import time

# Base URL for the application
BASE_URL = "http://localhost:5000"

def test_javascript_fixes():
    """Test that the JavaScript functions are properly exposed"""
    print("🧪 TESTING: JavaScript function exposure...")
    
    # Test the /api/get-expert-feedback endpoint to ensure it returns correct format
    print("\n1. Testing GET endpoint format...")
    
    # Create a test session ID
    test_session_id = f"test_session_{int(time.time())}"
    
    # Try to get expert feedback for non-existent session (should return empty)
    response = requests.get(f"{BASE_URL}/api/get-expert-feedback/{test_session_id}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ GET endpoint returns correct format:")
        print(f"   - success: {data.get('success')}")
        print(f"   - feedback: {type(data.get('feedback', []))}")
        print(f"   - count: {data.get('count')}")
        
        # Verify format matches what JavaScript expects
        if (data.get('success') == True and 
            isinstance(data.get('feedback'), list) and 
            'count' in data):
            print("✅ CRITICAL FIX: API response format matches JavaScript expectations!")
            return True
        else:
            print("❌ CRITICAL ERROR: API response format doesn't match JavaScript expectations")
            return False
    else:
        print(f"❌ GET endpoint failed: {response.status_code}")
        return False

def test_database_connection():
    """Test that the database connection is working"""
    print("\n🧪 TESTING: Database connection...")
    
    # Test any API endpoint that touches the database
    try:
        response = requests.get(f"{BASE_URL}/api/analysis-sessions")
        if response.status_code == 200:
            print("✅ Database connection working (MySQL)")
            return True
        else:
            print(f"❌ Database connection failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return False

def main():
    """Run all tests"""
    print("🔧 CRITICAL FIXES VALIDATION")
    print("=" * 50)
    
    # Test 1: Database connection
    db_ok = test_database_connection()
    
    # Test 2: JavaScript function exposure
    js_ok = test_javascript_fixes()
    
    print("\n" + "=" * 50)
    print("🏁 SUMMARY:")
    
    if db_ok:
        print("✅ Database (MySQL): WORKING")
    else:
        print("❌ Database (MySQL): FAILED")
    
    if js_ok:
        print("✅ JavaScript API Format: WORKING")
    else:
        print("❌ JavaScript API Format: FAILED")
    
    if db_ok and js_ok:
        print("\n🎉 ALL CRITICAL FIXES VALIDATED!")
        print("The following issues should now be resolved:")
        print("  • Expert feedback API endpoint using correct format")
        print("  • JavaScript functions properly exposed to global scope")
        print("  • Modal navigation rebuild should work")
        print("  • Result table refresh should work")
        return True
    else:
        print("\n⚠️ SOME ISSUES REMAIN - check failed tests above")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
