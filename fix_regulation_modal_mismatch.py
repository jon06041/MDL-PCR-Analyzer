#!/usr/bin/env python3
"""
Fix regulation modal mismatch between container and modal displays.

ISSUE: Container shows "FDA_CFR_21" but modal shows individual requirements like "CFR_11_10_B"
ROOT CAUSE: API returns category-level summaries, but evidence is stored at requirement level
"""

import mysql.connector
import os
import json

mysql_config = {
    'host': os.environ.get('MYSQL_HOST', 'localhost'),
    'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
    'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
    'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis')
}

def analyze_container_modal_mismatch():
    """Analyze the mismatch between container categories and individual requirements."""
    print("=== CONTAINER vs MODAL MISMATCH ANALYSIS ===")
    print()
    
    try:
        conn = mysql.connector.connect(**mysql_config)
        cursor = conn.cursor()
        
        # Get category-level groupings (what containers show)
        cursor.execute('''
            SELECT requirement_category, COUNT(*) as total_requirements, 
                   SUM(evidence_count) as total_evidence
            FROM compliance_requirements_tracking
            GROUP BY requirement_category
            ORDER BY requirement_category
        ''')
        
        categories = cursor.fetchall()
        print("📦 CONTAINER LEVEL (Categories):")
        print("CATEGORY | TOTAL_REQS | TOTAL_EVIDENCE")
        print("-" * 50)
        
        category_evidence = {}
        for category, total_reqs, total_evidence in categories:
            print(f"{category} | {total_reqs} | {total_evidence}")
            category_evidence[category] = total_evidence
        
        print()
        print("🔍 INDIVIDUAL REQUIREMENT LEVEL (What modals should show):")
        print("REQUIREMENT_ID | CATEGORY | EVIDENCE_COUNT")
        print("-" * 60)
        
        cursor.execute('''
            SELECT requirement_id, requirement_category, evidence_count
            FROM compliance_requirements_tracking
            ORDER BY requirement_category, requirement_id
        ''')
        
        individual_reqs = cursor.fetchall()
        category_breakdown = {}
        
        for req_id, category, evidence_count in individual_reqs:
            print(f"{req_id} | {category} | {evidence_count}")
            
            if category not in category_breakdown:
                category_breakdown[category] = []
            category_breakdown[category].append((req_id, evidence_count))
        
        print()
        print("🚨 MISMATCH ANALYSIS:")
        print()
        
        for category, total_evidence in category_evidence.items():
            if category in category_breakdown:
                individual_sum = sum(count for _, count in category_breakdown[category])
                
                print(f"📂 {category}:")
                print(f"   Container shows: {total_evidence} total evidence")
                print(f"   Individual sum:  {individual_sum} total evidence")
                print(f"   Individual breakdown:")
                
                for req_id, count in category_breakdown[category]:
                    print(f"     - {req_id}: {count} evidence")
                
                if total_evidence != individual_sum:
                    print(f"   ⚠️  MISMATCH: {total_evidence} vs {individual_sum}")
                else:
                    print(f"   ✅ MATCH")
                print()
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

def propose_modal_fix():
    """Propose how to fix the modal to show correct regulation info."""
    print("=== PROPOSED MODAL FIX ===")
    print()
    
    print("🔧 CURRENT PROBLEM:")
    print("- Container: Shows 'FDA_CFR_21' with total evidence count")
    print("- Modal: Shows individual requirement like 'CFR_11_10_B'")
    print("- User confusion: Can't tell which specific regulation until opening modal")
    print()
    
    print("💡 SOLUTION OPTIONS:")
    print()
    
    print("Option 1: Enhanced Container Display")
    print("- Show: 'FDA_CFR_21 (4 requirements: A, B, C, D)'")
    print("- Evidence: 'Total Evidence (29) - A:4, B:20, C:4, D:1'")
    print("- Modal: List all 4 sub-requirements with individual evidence")
    print()
    
    print("Option 2: Separate Individual Containers")
    print("- Show: Individual containers for CFR_11_10_A, CFR_11_10_B, etc.")
    print("- Group: Under 'FDA CFR 21' section header")
    print("- Modal: Show specific requirement evidence only")
    print()
    
    print("Option 3: Hierarchical Display")
    print("- Container: 'FDA_CFR_21' expandable section")
    print("- Sub-items: CFR_11_10_A (4), CFR_11_10_B (20), etc.")
    print("- Modal: Context-aware based on which item clicked")

def log_for_computer_switch():
    """Log current state for when switching computers."""
    print("\n" + "="*60)
    print("📝 LOG FOR COMPUTER SWITCH")
    print("="*60)
    print()
    
    print("🎯 CURRENT ISSUE STATUS:")
    print("✅ Issue #1: ML duplicate analysis runs - FIXED")
    print("   - Removed 3 duplicate sessions for same base file")
    print("   - ML dashboard now shows 2 pending runs correctly")
    print()
    
    print("🔍 Issue #2: Compliance evidence container/modal mismatch - ANALYZED")
    print("   - Root cause: API returns category summaries, not individual requirements")
    print("   - Container shows: 'FDA_CFR_21' (category)")
    print("   - Modal shows: Individual reqs like 'CFR_11_10_B'")
    print("   - Evidence counts correct at individual level, wrong at category level")
    print()
    
    print("🚨 Issue #3: CFR_11_10_B has 20 duplicate evidence records - IDENTIFIED")
    print("   - Same file (AcBVPanelPCR3_2576724_CFX366953) processed 5 times")
    print("   - Each time created 4 channel records (FAM, HEX, Cy5, Texas Red)")
    print("   - Total: 5 × 4 = 20 duplicate compliance evidence records")
    print()
    
    print("📋 NEXT ACTIONS NEEDED:")
    print("1. Run compliance evidence cleanup for CFR_11_10_B duplicates")
    print("2. Fix container/modal mismatch in dashboard HTML/JavaScript")
    print("3. Decide on display approach (enhanced container vs separate items)")
    print()
    
    print("🛠️  TOOLS READY:")
    print("- fix_comprehensive_duplicates_v2.py --compliance-only")
    print("- duplicate_prevention.py module")
    print("- MySQL queries for evidence analysis")

if __name__ == "__main__":
    print("🔧 REGULATION MODAL MISMATCH ANALYSIS")
    print()
    
    analyze_container_modal_mismatch()
    propose_modal_fix()
    log_for_computer_switch()
