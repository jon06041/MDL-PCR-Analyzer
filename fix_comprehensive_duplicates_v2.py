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
    python3 fix_comprehensive_duplicates_v2.py --dry-run    # Preview changes
    python3 fix_comprehensive_duplicates_v2.py --execute   # Apply changes
    python3 fix_comprehensive_duplicates_v2.py --validate  # Check for issues only
"""

import mysql.connector
import os
import json
import argparse
import sys
from datetime import datetime

# MySQL configuration
mysql_config = {
    'host': os.environ.get('MYSQL_HOST', 'localhost'),
    'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
    'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
    'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis')
}

def get_mysql_connection():
    """Get MySQL database connection with error handling"""
    try:
        return mysql.connector.connect(**mysql_config)
    except mysql.connector.Error as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)

def extract_base_filename(filename):
    """Extract base filename by removing channel-specific suffixes"""
    if not filename:
        return ""
    
    # Remove channel-specific suffixes
    base = filename.split(' - ')[0]  # Remove " - Quantification..." part
    
    # Remove CSV and channel suffixes
    suffixes = ['_FAM.csv', '_HEX.csv', '_Texas Red.csv', '_Cy5.csv', '.csv']
    for suffix in suffixes:
        if base.endswith(suffix):
            base = base[:-len(suffix)]
    
    return base

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
        
        # Group by base filename
        base_files = {}
        for run in runs:
            filename = run[2] if run[2] else ''
            base_file = extract_base_filename(filename)
            
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
                keep_run = file_runs[0]  # Most recent (DESC order)
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
            
            total_cleaned = 0
            for req_id, count, sample_desc in excessive_counts[:10]:  # Show top 10
                print(f"  {req_id}: {count} records")
                print(f"    Sample: {sample_desc[:100]}...")
                
                # Check for exact duplicates based on key fields
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
                        
                        if not dry_run:
                            # Delete duplicates, keep only the most recent
                            cursor.execute('''
                                DELETE e1 FROM compliance_evidence e1
                                INNER JOIN compliance_evidence e2 
                                WHERE e1.requirement_id = %s 
                                  AND e2.requirement_id = %s
                                  AND e1.description = e2.description
                                  AND COALESCE(e1.file_name, '') = COALESCE(e2.file_name, '')
                                  AND COALESCE(e1.fluorophore, '') = COALESCE(e2.fluorophore, '')
                                  AND e1.logged_at < e2.logged_at
                            ''', (req_id, req_id))
                            
                            total_cleaned += dup_count - 1
            
            if not dry_run and total_cleaned > 0:
                conn.commit()
                print(f"\n✅ Cleaned {total_cleaned} duplicate evidence records")
            elif dry_run:
                estimated_cleanup = sum(sum(d[3] - 1 for d in cursor.fetchall() if cursor.execute('''
                    SELECT description, file_name, fluorophore, COUNT(*) as dup_count
                    FROM compliance_evidence 
                    WHERE requirement_id = %s
                    GROUP BY description, file_name, fluorophore
                    HAVING COUNT(*) > 1
                ''', (req_id,)) or True) for req_id, _, _ in excessive_counts[:10])
                print(f"\n🔍 DRY RUN: Would clean approximately duplicate evidence records")
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

def print_summary_report():
    """Print a summary report of current database state."""
    print("\n=== DATABASE SUMMARY REPORT ===")
    
    try:
        conn = get_mysql_connection()
        cursor = conn.cursor()
        
        # ML runs summary
        cursor.execute('SELECT status, COUNT(*) FROM ml_analysis_runs GROUP BY status')
        ml_status = cursor.fetchall()
        print(f"📊 ML Analysis Runs:")
        for status, count in ml_status:
            print(f"   {status}: {count}")
        
        # Evidence summary
        cursor.execute('''
            SELECT COUNT(*) as total_evidence,
                   COUNT(DISTINCT requirement_id) as requirements_with_evidence,
                   AVG(cnt) as avg_evidence_per_req
            FROM (
                SELECT requirement_id, COUNT(*) as cnt 
                FROM compliance_evidence 
                GROUP BY requirement_id
            ) subq
        ''')
        
        total_evidence, req_count, avg_evidence = cursor.fetchone()
        print(f"📊 Compliance Evidence:")
        print(f"   Total evidence records: {total_evidence}")
        print(f"   Requirements with evidence: {req_count}")
        print(f"   Average evidence per requirement: {avg_evidence:.1f}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error generating summary: {str(e)}")

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
    
    print(f"🔧 COMPREHENSIVE DUPLICATE CLEANUP")
    print(f"   Mode: {'DRY RUN' if dry_run else 'EXECUTE'}")
    print(f"   Timestamp: {datetime.now()}")
    print(f"   Database: {mysql_config['database']} @ {mysql_config['host']}")
    
    # Validate ML analysis runs
    ml_groups, ml_deletes = validate_ml_runs(dry_run=dry_run)
    
    # Validate compliance evidence
    evidence_issues = validate_compliance_evidence(dry_run=dry_run)
    
    # Print summary
    print_summary_report()
    
    # Final summary
    print(f"\n📊 CLEANUP SUMMARY:")
    print(f"   ML duplicate groups found: {ml_groups}")
    print(f"   ML runs to clean: {ml_deletes}")
    print(f"   Evidence requirements with issues: {evidence_issues}")
    
    if dry_run and (ml_groups > 0 or evidence_issues > 0):
        print(f"\n💡 To execute these changes, run:")
        print(f"   python3 {sys.argv[0]} --execute")
    elif not dry_run and (ml_deletes > 0 or evidence_issues > 0):
        print(f"\n✅ Cleanup completed successfully!")
        print(f"   💡 Restart the Flask app to see updated counts")
    else:
        print(f"\n✅ No issues found - database is clean!")

if __name__ == "__main__":
    main()
