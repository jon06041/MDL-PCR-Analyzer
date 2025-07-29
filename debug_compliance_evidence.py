#!/usr/bin/env python3
"""
Debug script to test compliance evidence collection
"""

import sqlite3
import sys
import os

# Add current directory to path
sys.path.insert(0, '/workspaces/MDL-PCR-Analyzer')

try:
    from software_compliance_requirements import SOFTWARE_TRACKABLE_REQUIREMENTS
    print("Successfully imported SOFTWARE_TRACKABLE_REQUIREMENTS")
    print(f"Type: {type(SOFTWARE_TRACKABLE_REQUIREMENTS)}")
    print(f"Keys: {list(SOFTWARE_TRACKABLE_REQUIREMENTS.keys()) if isinstance(SOFTWARE_TRACKABLE_REQUIREMENTS, dict) else 'Not a dict'}")
    
    # Check structure
    print("\n=== Structure Analysis ===")
    for key, value in SOFTWARE_TRACKABLE_REQUIREMENTS.items():
        print(f"Key: {key}")
        print(f"Value type: {type(value)}")
        if isinstance(value, list) and len(value) > 0:
            print(f"First item type: {type(value[0])}")
            if isinstance(value[0], dict):
                print(f"First item keys: {list(value[0].keys())}")
        print("---")

except Exception as e:
    print(f"Import error: {e}")
    import traceback
    traceback.print_exc()

# Test database connection
try:
    conn = sqlite3.connect('/workspaces/MDL-PCR-Analyzer/qpcr_analysis.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    print("\n=== Database Test ===")
    cursor.execute("SELECT COUNT(*) FROM well_results")
    result = cursor.fetchone()
    print(f"well_results count query result: {result}")
    print(f"Result type: {type(result)}")
    print(f"Result[0]: {result[0] if result else 'None'}")
    
    conn.close()
    
except Exception as e:
    print(f"Database error: {e}")
    import traceback
    traceback.print_exc()
