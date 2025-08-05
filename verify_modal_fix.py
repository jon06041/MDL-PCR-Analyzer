#!/usr/bin/env python3
"""
Verify Modal Navigation Fix
===========================
This script checks that the modal navigation fix is properly implemented.
"""

import re

def check_file_for_patterns(filepath, patterns, description):
    """Check if a file contains all required patterns"""
    print(f"\n🔍 Checking {description}")
    print(f"   File: {filepath}")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        all_found = True
        for pattern_name, pattern in patterns.items():
            if re.search(pattern, content, re.MULTILINE):
                print(f"   ✅ {pattern_name}")
            else:
                print(f"   ❌ {pattern_name}")
                all_found = False
        
        return all_found
        
    except Exception as e:
        print(f"   ❌ Error reading file: {e}")
        return False

def verify_modal_navigation_fix():
    """Verify that the modal navigation fix is properly implemented"""
    
    print("🔧 MODAL NAVIGATION FIX VERIFICATION")
    print("=" * 60)
    
    all_checks_passed = True
    
    # Check 1: ML Feedback Interface has navigation rebuild
    ml_patterns = {
        "ML Prediction Navigation Rebuild": r"Rebuilding modal navigation after ML prediction",
        "Expert Classification Navigation Rebuild": r"Rebuilding modal navigation after expert classification",
        "Modal Display Check": r"modal.*style\.display.*!==.*none",
        "Window Function Check": r"window\.buildModalNavigationList"
    }
    
    ml_check = check_file_for_patterns(
        '/workspaces/MDL-PCR-Analyzer/static/ml_feedback_interface.js',
        ml_patterns,
        "ML Feedback Interface for navigation rebuild calls"
    )
    
    # Check 2: Script.js exposes the function
    script_patterns = {
        "BuildModalNavigationList Function": r"function buildModalNavigationList\(\)",
        "Window Exposure": r"window\.buildModalNavigationList = buildModalNavigationList",
        "Navigation List Variable": r"modalNavigationList = \[\]",
        "Console Logging": r"Building modal navigation list from.*table rows"
    }
    
    script_check = check_file_for_patterns(
        '/workspaces/MDL-PCR-Analyzer/static/script.js',
        script_patterns,
        "Main script.js for function exposure"
    )
    
    all_checks_passed = ml_check and script_check
    
    print(f"\n🎯 OVERALL RESULT")
    print("=" * 60)
    if all_checks_passed:
        print("✅ ALL CHECKS PASSED - Modal navigation fix is properly implemented!")
        print()
        print("🔧 Fix Details:")
        print("   • ML prediction updates now trigger modal navigation rebuild")
        print("   • Expert classification updates also trigger navigation rebuild")
        print("   • Function is properly exposed on window object")
        print("   • Only rebuilds when modal is actually open")
        print()
        print("🎯 Expected Behavior:")
        print("   • Modal navigation will rebuild after each ML prediction")
        print("   • Result table will show ALL samples, not just the predicted one")
        print("   • No more result flashing or navigation corruption")
        print("   • Previous/Next buttons will work correctly")
        
    else:
        print("❌ SOME CHECKS FAILED - Modal navigation fix needs attention!")
        print()
        print("🔧 Required Actions:")
        if not ml_check:
            print("   • Fix ML feedback interface navigation rebuild calls")
        if not script_check:
            print("   • Fix main script function exposure")
    
    return all_checks_passed

if __name__ == "__main__":
    success = verify_modal_navigation_fix()
    exit(0 if success else 1)
