#!/usr/bin/env python3

import sqlite3
import sys
import os

# Add the current directory to the path
sys.path.append('/workspaces/MDL-PCR-Analyzer')

def test_evidence_collection():
    try:
        from software_compliance_requirements import SOFTWARE_TRACKABLE_REQUIREMENTS
        
        print("SOFTWARE_TRACKABLE_REQUIREMENTS keys:", list(SOFTWARE_TRACKABLE_REQUIREMENTS.keys()))
        
        # Get all requirements
        all_requirements = []
        for status_reqs in SOFTWARE_TRACKABLE_REQUIREMENTS.values():
            all_requirements.extend(status_reqs)
        
        print(f"Total requirements: {len(all_requirements)}")
        
        if all_requirements:
            first_req = all_requirements[0]
            print(f"First requirement: {first_req['code']}")
            print(f"Tracked by: {first_req['tracked_by']}")
        
        # Test database connection
        conn = sqlite3.connect('/workspaces/MDL-PCR-Analyzer/qpcr_analysis.db')
        cursor = conn.cursor()
        
        # Test a simple query
        cursor.execute("SELECT COUNT(*) FROM system_logs")
        result = cursor.fetchone()
        print(f"system_logs count: {result[0] if result else 'No result'}")
        
        # Test the specific query from the evidence collection
        cursor.execute("""
            SELECT COUNT(*) as count, MAX(created_at) as latest 
            FROM well_results 
            WHERE created_at > date('now', '-30 days')
        """)
        result = cursor.fetchone()
        print(f"well_results query result: {result}")
        print(f"Result type: {type(result)}")
        if result:
            print(f"Count: {result[0]}, Latest: {result[1] if len(result) > 1 else 'N/A'}")
        
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_evidence_collection()
