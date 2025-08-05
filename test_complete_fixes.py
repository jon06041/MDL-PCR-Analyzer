#!/usr/bin/env python3
"""
Complete Fix Validation Test
Tests both the expert feedback fixes and the unified compliance dashboard
"""

import requests
import json
import time

# Base URL for the application
BASE_URL = "http://localhost:5000"

def test_expert_feedback_fixes():
    """Test that the expert feedback fixes are working"""
    print("\n🧪 TESTING: Expert Feedback Fixes...")
    
    # Test the GET endpoint format
    test_session_id = f"test_session_{int(time.time())}"
    
    response = requests.get(f"{BASE_URL}/api/get-expert-feedback/{test_session_id}")
    
    if response.status_code == 200:
        data = response.json()
        if (data.get('success') == True and 
            isinstance(data.get('feedback'), list) and 
            'count' in data):
            print("✅ Expert feedback API format: WORKING")
            return True
        else:
            print("❌ Expert feedback API format: FAILED")
            return False
    else:
        print(f"❌ Expert feedback API endpoint: FAILED ({response.status_code})")
        return False

def test_unified_compliance_dashboard():
    """Test that the unified compliance dashboard is working"""
    print("\n🧪 TESTING: Unified Compliance Dashboard...")
    
    # Test dashboard page
    try:
        response = requests.get(f"{BASE_URL}/unified-compliance-dashboard")
        if response.status_code == 200:
            print("✅ Unified compliance dashboard page: ACCESSIBLE")
            dashboard_ok = True
        else:
            print(f"❌ Unified compliance dashboard page: FAILED ({response.status_code})")
            dashboard_ok = False
    except Exception as e:
        print(f"❌ Unified compliance dashboard page: ERROR ({e})")
        dashboard_ok = False
    
    # Test dashboard API
    try:
        response = requests.get(f"{BASE_URL}/api/unified-compliance/dashboard-data")
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ Unified compliance API: WORKING")
                print(f"   - Requirements tracked: {len(data.get('requirements_summary', []))}")
                print(f"   - Recent events: {len(data.get('recent_events', []))}")
                api_ok = True
            else:
                print(f"❌ Unified compliance API: FAILED - {data.get('error', 'Unknown error')}")
                api_ok = False
        else:
            print(f"❌ Unified compliance API: FAILED ({response.status_code})")
            if response.status_code == 503:
                print("   (Manager not available - this is expected if MySQL compliance manager failed to initialize)")
            api_ok = False
    except Exception as e:
        print(f"❌ Unified compliance API: ERROR ({e})")
        api_ok = False
    
    return dashboard_ok and api_ok

def test_mysql_connection():
    """Test that MySQL is working"""
    print("\n🧪 TESTING: MySQL Connection...")
    
    # Test any endpoint that would use the database
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print("✅ Application with MySQL: RUNNING")
            return True
        else:
            print(f"❌ Application: FAILED ({response.status_code})")
            return False
    except Exception as e:
        print(f"❌ Application connection: ERROR ({e})")
        return False

def main():
    """Run all tests"""
    print("🔧 COMPLETE FIX VALIDATION TEST")
    print("=" * 60)
    
    # Test 1: MySQL connection
    mysql_ok = test_mysql_connection()
    
    # Test 2: Expert feedback fixes
    feedback_ok = test_expert_feedback_fixes()
    
    # Test 3: Unified compliance dashboard
    compliance_ok = test_unified_compliance_dashboard()
    
    print("\n" + "=" * 60)
    print("🏁 SUMMARY:")
    
    if mysql_ok:
        print("✅ MySQL Application: WORKING")
    else:
        print("❌ MySQL Application: FAILED")
    
    if feedback_ok:
        print("✅ Expert Feedback Fixes: WORKING")
    else:
        print("❌ Expert Feedback Fixes: FAILED")
    
    if compliance_ok:
        print("✅ Unified Compliance Dashboard: WORKING")
    else:
        print("❌ Unified Compliance Dashboard: FAILED")
    
    total_working = sum([mysql_ok, feedback_ok, compliance_ok])
    
    if total_working == 3:
        print("\n🎉 ALL SYSTEMS WORKING!")
        print("Ready to test:")
        print("  • Expert feedback submission and persistence")
        print("  • Modal navigation rebuild after feedback")
        print("  • Result table refresh showing all wells")
        print("  • Unified compliance tracking and dashboard")
        return True
    else:
        print(f"\n⚠️ {total_working}/3 systems working - check failed tests above")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
