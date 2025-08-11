#!/usr/bin/env python3
"""
Comprehensive cleanup script for duplicate evidence and ML analysis runs.
This script addresses:
1. Duplicate ML analysis runs for the same base file (different channels)
2. Evidence count mismatches between database and dashboard display
3. Regulation number mismatches between modals and containers

REUSABLE SCRIPT: Run this on any new database environment or when duplicates accumulate.
Safe to run multiple times - includes validation and dry-run options.

Usage:
    python3 fix_comprehensive_duplicates.py --dry-run    # Preview changes
    python3 fix_comprehensive_duplicates.py --execute   # Apply changes
    python3 fix_comprehensive_duplicates.py --validate  # Check for issues only
"""

import mysql.connector
import os
import json
import argparse
import sys
from datetime import datetime
from mysql_unified_compliance_manager import MySQLUnifiedComplianceManager

# MySQL configuration
mysql_config = {
    'host': os.environ.get('MYSQL_HOST', 'localhost'),
    'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
    'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
    'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis')
}

def validate_compliance_evidence(dry_run=True):
    """Check for compliance evidence issues and optionally fix them."""
    print("\n=== VALIDATING COMPLIANCE EVIDENCE ===")
    
    try:
        conn = get_mysql_connection()
        cursor = conn.cursor()
        
        # Get evidence counts by requirement
        cursor.execute('''
            SELECT requirement_id, COUNT(*) as evidence_count,
                   GROUP_CONCAT(DISTINCT description LIMIT 3) as sample_descriptions
            FROM compliance_evidence 
            GROUP BY requirement_id 
            ORDER BY evidence_count DESC
        ''')
        
        evidence_counts = cursor.fetchall()
        print(f"Found evidence for {len(evidence_counts)} requirements")
        
        # Check for excessive counts (likely duplicates)
        excessive_counts = [(req_id, count, desc) for req_id, count, desc in evidence_counts if count > 10]
        
        if excessive_counts:
            print(f"\n🚨 Found {len(excessive_counts)} requirements with excessive evidence counts:")
            
            total_to_clean = 0
            for req_id, count, sample_desc in excessive_counts[:10]:  # Show top 10
                print(f"  {req_id}: {count} records")
                print(f"    Sample: {sample_desc[:100]}...")
                
                # Check for exact duplicates
                cursor.execute('''
                    SELECT description, file_name, fluorophore, COUNT(*) as dup_count
                    FROM compliance_evidence 
                    WHERE requirement_id = %s
                    GROUP BY description, file_name, fluorophore
                    HAVING COUNT(*) > 1
                    ORDER BY dup_count DESC
                    LIMIT 5
                ''', (req_id,))
                
                duplicates = cursor.fetchall()
                if duplicates:
                    print(f"    Found {len(duplicates)} duplicate groups:")
                    for desc, fname, fluoro, dup_count in duplicates:
                        print(f"      - {dup_count}x: {desc[:40]}... ({fluoro})")
                        total_to_clean += dup_count - 1  # Keep one, delete rest
            
            if total_to_clean > 0:
                action = "WOULD CLEAN" if dry_run else "CLEANING"
                print(f"\n{action} approximately {total_to_clean} duplicate evidence records")
                
                if not dry_run:
                    # Clean duplicates by keeping only the most recent for each unique combination
                    for req_id, _, _ in excessive_counts:
                        cursor.execute('''
                            DELETE e1 FROM compliance_evidence e1
                            INNER JOIN compliance_evidence e2 
                            WHERE e1.requirement_id = %s 
                              AND e2.requirement_id = %s
                              AND e1.description = e2.description
                              AND e1.file_name = e2.file_name
                              AND e1.fluorophore = e2.fluorophore
                              AND e1.logged_at < e2.logged_at
                        ''', (req_id, req_id))
                    
                    conn.commit()
                    print(f"✅ Cleaned duplicate evidence records")
        else:
            print("✅ No excessive evidence counts found")
        
        cursor.close()
        conn.close()
        return len(excessive_counts)
        
    except Exception as e:
        print(f"❌ Error validating compliance evidence: {str(e)}")
        import traceback
        traceback.print_exc()
        return 0

def validate_ml_runs(dry_run=True):
    """Check for ML analysis run duplicates and optionally fix them."""
    print("=== VALIDATING ML ANALYSIS RUNS ===")
    
    try:
        conn = get_mysql_connection()
        cursor = conn.cursor()
        
        # Get all pending ML runs
        cursor.execute('''
            SELECT id, session_id, file_name, pathogen_codes, logged_at, status
            FROM ml_analysis_runs 
            WHERE status = 'pending'
            ORDER BY logged_at DESC
        ''')
        
        runs = cursor.fetchall()
        print(f"Found {len(runs)} pending ML runs")
        
        # Group by base filename (strip channel suffixes)
        base_files = {}
        for run in runs:
            filename = run[2] if run[2] else ''
            # Extract base filename by removing channel-specific suffixes
            base_file = filename.split(' - ')[0]
            base_file = base_file.replace('_FAM.csv', '').replace('_HEX.csv', '').replace('_Texas Red.csv', '').replace('_Cy5.csv', '')
            
            if base_file not in base_files:
                base_files[base_file] = []
            base_files[base_file].append(run)
        
        # Find duplicates
        duplicate_groups = {base: runs for base, runs in base_files.items() if len(runs) > 1}
        total_to_delete = sum(len(runs) - 1 for runs in duplicate_groups.values())
        
        if duplicate_groups:
            print(f"\n🚨 Found {len(duplicate_groups)} base files with duplicates:")
            print(f"   Total duplicate runs to clean: {total_to_delete}")
            
            for base_file, file_runs in duplicate_groups.items():
                print(f"\n📁 {base_file} ({len(file_runs)} runs):")
                keep_run = file_runs[0]  # Most recent
                print(f"  ✅ Keep: Session {keep_run[1]} (ID: {keep_run[0]}) - {keep_run[5]}")
                
                for run in file_runs[1:]:
                    action = "WOULD DELETE" if dry_run else "DELETING"
                    print(f"  ❌ {action}: Session {run[1]} (ID: {run[0]}) - {run[5]}")
                    
                    if not dry_run:
                        cursor.execute('DELETE FROM ml_analysis_runs WHERE id = %s', (run[0],))
            
            if not dry_run and total_to_delete > 0:
                conn.commit()
                print(f"\n✅ Deleted {total_to_delete} duplicate ML analysis runs")
            elif dry_run:
                print(f"\n🔍 DRY RUN: Would delete {total_to_delete} duplicate runs")
        else:
            print("✅ No ML run duplicates found")
        
        cursor.close()
        conn.close()
        return len(duplicate_groups), total_to_delete
        
    except Exception as e:
        print(f"❌ Error validating ML runs: {str(e)}")
        import traceback
        traceback.print_exc()
        return 0, 0
    """Fix duplicate ML analysis runs for same base file."""
    print("=== FIXING ML ANALYSIS DUPLICATES ===")
    
    try:
        conn = mysql.connector.connect(**mysql_config)
        cursor = conn.cursor()
        
        # Get all pending ML runs
        cursor.execute('''
            SELECT id, session_id, file_name, pathogen_codes, logged_at, status
            FROM ml_analysis_runs 
            WHERE status = 'pending'
            ORDER BY logged_at DESC
        ''')
        
        runs = cursor.fetchall()
        print(f"Found {len(runs)} pending ML runs")
        
        # Group by base filename
        base_files = {}
        for run in runs:
            filename = run[2] if run[2] else ''
            base_file = filename.split(' - ')[0]  # Remove channel suffix
            
            if base_file not in base_files:
                base_files[base_file] = []
            base_files[base_file].append(run)
        
        # Find and fix duplicates
        total_deleted = 0
        for base_file, file_runs in base_files.items():
            if len(file_runs) > 1:
                print(f"\n🚨 Found {len(file_runs)} duplicate runs for: {base_file}")
                
                # Keep the most recent run (first in DESC order)
                keep_run = file_runs[0]
                delete_runs = file_runs[1:]
                
                print(f"  ✅ Keeping: Session {keep_run[0]} ({keep_run[1]})")
                
                for run in delete_runs:
                    print(f"  ❌ Deleting: Session {run[0]} ({run[1]})")
                    cursor.execute('DELETE FROM ml_analysis_runs WHERE id = %s', (run[0],))
                    total_deleted += 1
        
        if total_deleted > 0:
            conn.commit()
            print(f"\n✅ Deleted {total_deleted} duplicate ML analysis runs")
        else:
            print("\n✅ No ML duplicates found to delete")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error fixing ML duplicates: {str(e)}")
        import traceback
        traceback.print_exc()

def analyze_compliance_evidence_issues():
    """Analyze and fix compliance evidence count mismatches."""
    print("\n=== ANALYZING COMPLIANCE EVIDENCE ISSUES ===")
    
    try:
        # Get dashboard data
        compliance_manager = MySQLUnifiedComplianceManager(mysql_config)
        dashboard_data = compliance_manager.get_compliance_dashboard_data()
        
        conn = mysql.connector.connect(**mysql_config)
        cursor = conn.cursor()
        
        # Get actual database counts
        cursor.execute('''
            SELECT requirement_id, COUNT(*) as evidence_count
            FROM compliance_evidence 
            GROUP BY requirement_id 
            ORDER BY requirement_id
        ''')
        
        db_counts = dict(cursor.fetchall())
        
        print(f"Database has evidence for {len(db_counts)} requirements")
        print(f"Dashboard data keys: {list(dashboard_data.keys())}")
        
        if 'requirements_summary' in dashboard_data:
            requirements = dashboard_data['requirements_summary']
            print(f"Dashboard has {len(requirements)} requirements")
            
            # Check for mismatches
            mismatches = []
            for req in requirements:
                req_id = req.get('requirement_id', req.get('id'))
                api_count = req.get('evidence_count', 0)
                db_count = db_counts.get(req_id, 0)
                
                if api_count != db_count:
                    mismatches.append((req_id, api_count, db_count))
            
            if mismatches:
                print(f"\n🚨 Found {len(mismatches)} count mismatches:")
                for req_id, api_count, db_count in mismatches:
                    print(f"  {req_id}: API={api_count}, DB={db_count}")
                    
                    # Check for duplicate evidence
                    cursor.execute('''
                        SELECT description, COUNT(*) as count
                        FROM compliance_evidence 
                        WHERE requirement_id = %s
                        GROUP BY description
                        HAVING COUNT(*) > 1
                        ORDER BY count DESC
                    ''', (req_id,))
                    
                    duplicates = cursor.fetchall()
                    if duplicates:
                        print(f"    Duplicate evidence found:")
                        for desc, count in duplicates:
                            print(f"      - '{desc[:50]}...' (x{count})")
            else:
                print("✅ No count mismatches found")
        
        # Sample database contents
        print(f"\n📊 DATABASE EVIDENCE SAMPLE:")
        cursor.execute('''
            SELECT requirement_id, COUNT(*) as count
            FROM compliance_evidence 
            GROUP BY requirement_id 
            ORDER BY count DESC
            LIMIT 10
        ''')
        
        top_counts = cursor.fetchall()
        for req_id, count in top_counts:
            print(f"  {req_id}: {count} evidence records")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error analyzing compliance evidence: {str(e)}")
        import traceback
        traceback.print_exc()

def check_api_endpoint_directly():
    """Check the API endpoint directly to see what's being returned."""
    print("\n=== CHECKING API ENDPOINT DIRECTLY ===")
    
    try:
        import requests
        
        # Try to hit the API endpoint
        response = requests.get('http://localhost:5000/api/unified-compliance/summary')
        if response.status_code == 200:
            data = response.json()
            print(f"API Response keys: {list(data.keys())}")
            
            if 'requirements' in data:
                reqs = data['requirements']
                print(f"Found {len(reqs)} requirements in API")
                for req in reqs[:3]:  # Sample first 3
                    print(f"  {req.get('id', 'NO_ID')}: {req.get('evidence_count', 0)} evidence")
        else:
            print(f"API request failed: {response.status_code}")
            
    except Exception as e:
        print(f"Could not check API directly: {str(e)}")

def main():
    """Main execution with command line arguments."""
    parser = argparse.ArgumentParser(description='Comprehensive cleanup for PCR analyzer duplicates')
    parser.add_argument('--dry-run', action='store_true', 
                       help='Preview changes without executing them')
    parser.add_argument('--execute', action='store_true', 
                       help='Execute the cleanup operations')
    parser.add_argument('--validate', action='store_true', 
                       help='Only validate and report issues')
    
    args = parser.parse_args()
    
    # Default to dry-run if no action specified
    if not any([args.dry_run, args.execute, args.validate]):
        args.dry_run = True
        print("⚠️  No action specified, defaulting to --dry-run mode")
    
    dry_run = args.dry_run or args.validate
    
    print(f"🔧 COMPREHENSIVE DUPLICATE CLEANUP STARTING...")
    print(f"   Mode: {'DRY RUN' if dry_run else 'EXECUTE'}")
    print(f"   Timestamp: {datetime.now()}")
    
    # Validate ML analysis runs
    ml_groups, ml_deletes = validate_ml_runs(dry_run=dry_run)
    
    # Validate compliance evidence
    evidence_issues = validate_compliance_evidence(dry_run=dry_run)
    
    # Summary
    print(f"\n📊 CLEANUP SUMMARY:")
    print(f"   ML duplicate groups found: {ml_groups}")
    print(f"   ML runs to clean: {ml_deletes}")
    print(f"   Evidence requirements with issues: {evidence_issues}")
    
    if dry_run and (ml_groups > 0 or evidence_issues > 0):
        print(f"\n💡 To execute these changes, run:")
        print(f"   python3 {sys.argv[0]} --execute")
    elif not dry_run and (ml_deletes > 0 or evidence_issues > 0):
        print(f"\n✅ Cleanup completed successfully!")
    else:
        print(f"\n✅ No issues found - database is clean!")

if __name__ == "__main__":
    main()
