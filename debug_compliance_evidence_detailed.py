#!/usr/bin/env python3
"""
Debug script to identify the exact issue with compliance evidence collection
"""

import sys
import traceback
from software_compliance_requirements import SOFTWARE_TRACKABLE_REQUIREMENTS

def debug_data_structure():
    """Debug the data structure to understand the issue"""
    print("=== Debugging SOFTWARE_TRACKABLE_REQUIREMENTS structure ===")
    
    print(f"Type of SOFTWARE_TRACKABLE_REQUIREMENTS: {type(SOFTWARE_TRACKABLE_REQUIREMENTS)}")
    print(f"Keys in SOFTWARE_TRACKABLE_REQUIREMENTS: {list(SOFTWARE_TRACKABLE_REQUIREMENTS.keys())}")
    
    # Check each organization
    for org_name, org_data in SOFTWARE_TRACKABLE_REQUIREMENTS.items():
        print(f"\n--- Organization: {org_name} ---")
        print(f"Type of org_data: {type(org_data)}")
        print(f"Keys in org_data: {list(org_data.keys()) if isinstance(org_data, dict) else 'NOT A DICT'}")
        
        if isinstance(org_data, dict) and 'trackable_requirements' in org_data:
            trackable_reqs = org_data['trackable_requirements']
            print(f"Type of trackable_requirements: {type(trackable_reqs)}")
            print(f"Number of trackable requirements: {len(trackable_reqs)}")
            
            # Check first few requirements
            count = 0
            for req_code, req_data in trackable_reqs.items():
                if count >= 3:  # Only show first 3
                    break
                print(f"\n  Requirement {count + 1}: {req_code}")
                print(f"  Type of req_data: {type(req_data)}")
                
                if isinstance(req_data, dict):
                    print(f"  Keys in req_data: {list(req_data.keys())}")
                    print(f"  Code: {req_data.get('code', 'MISSING')}")
                    print(f"  Tracked by: {req_data.get('tracked_by', 'MISSING')}")
                else:
                    print(f"  ERROR: req_data is not a dict! It's: {req_data}")
                count += 1
        else:
            print("  ERROR: No 'trackable_requirements' key found!")

def simulate_evidence_collection():
    """Simulate the evidence collection logic to find the exact error"""
    print("\n=== Simulating Evidence Collection ===")
    
    try:
        # Get all requirements for evidence collection
        all_requirements = []
        for org_name, org_data in SOFTWARE_TRACKABLE_REQUIREMENTS.items():
            if 'trackable_requirements' in org_data:
                for req_code, req_data in org_data['trackable_requirements'].items():
                    all_requirements.append(req_data)
        
        print(f"Total requirements collected: {len(all_requirements)}")
        
        for i, req in enumerate(all_requirements):
            if i >= 5:  # Only check first 5
                break
                
            print(f"\n--- Processing requirement {i + 1} ---")
            print(f"Type of req: {type(req)}")
            
            if not isinstance(req, dict):
                print(f"ERROR: req is not a dict: {type(req)} - {req}")
                continue
                
            req_code = req.get('code', 'UNKNOWN')
            tracked_by = req.get('tracked_by', [])
            
            print(f"Requirement code: {req_code}")
            print(f"Tracked by: {tracked_by}")
            print(f"Type of tracked_by: {type(tracked_by)}")
            
    except Exception as e:
        print(f"ERROR in simulation: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    debug_data_structure()
    simulate_evidence_collection()
