#!/usr/bin/env python3
"""
Test the ML validation tracker directly
"""

import sys
import os
sys.path.append('/workspaces/MDL-PCR-Analyzer')

def test_tracker():
    print("Testing ML validation tracker...")
    
    try:
        from ml_validation_tracker import ml_tracker
        
        print("🔍 Testing get_pathogen_dashboard_data...")
        data = ml_tracker.get_pathogen_dashboard_data()
        print(f"Found {len(data)} pathogen models:")
        
        for pathogen, info in data.items():
            print(f"  📊 {pathogen}:")
            for key, value in info.items():
                print(f"    - {key}: {value}")
            print()
        
        print("🔍 Testing get_expert_teaching_summary...")
        teaching = ml_tracker.get_expert_teaching_summary()
        print(f"Teaching summary: {teaching}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_tracker()
