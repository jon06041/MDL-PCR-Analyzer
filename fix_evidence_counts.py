#!/usr/bin/env python3
"""
Fix Evidence Counts Script
Recalculates and updates evidence counts for all compliance requirements
after cleaning up duplicate records.
"""

import pymysql
import os
import json
from datetime import datetime

def main():
    # MySQL connection
    mysql_config = {
        'host': os.environ.get('MYSQL_HOST', 'localhost'),
        'user': os.environ.get('MYSQL_USER', 'qpcr_user'), 
        'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
        'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis')
    }

    conn = pymysql.connect(**mysql_config)
    cursor = conn.cursor()

    print("🔍 Recalculating evidence counts for all requirements...")

    # Get current evidence counts from compliance_evidence table
    cursor.execute('''
        SELECT requirement_id, COUNT(*) as actual_count
        FROM compliance_evidence 
        GROUP BY requirement_id
        ORDER BY requirement_id
    ''')
    actual_counts = dict(cursor.fetchall())

    print(f"Found evidence for {len(actual_counts)} requirements")

    # Check if unified_compliance_requirements table exists and update counts there
    cursor.execute("SHOW TABLES LIKE 'unified_compliance_requirements'")
    if cursor.fetchone():
        print("📊 Updating unified_compliance_requirements table...")
        
        # Get all requirements that might need count updates
        cursor.execute('SELECT id, evidence_count FROM unified_compliance_requirements')
        requirements = cursor.fetchall()
        
        updates_made = 0
        for req_id, stored_count in requirements:
            actual_count = actual_counts.get(req_id, 0)
            
            if stored_count != actual_count:
                print(f"  {req_id}: {stored_count} → {actual_count}")
                cursor.execute(
                    'UPDATE unified_compliance_requirements SET evidence_count = %s WHERE id = %s',
                    (actual_count, req_id)
                )
                updates_made += 1
        
        if updates_made > 0:
            conn.commit()
            print(f"✅ Updated {updates_made} requirement evidence counts")
        else:
            print("✅ All evidence counts were already correct")

    # Also check compliance_requirements_tracking table
    cursor.execute("SHOW TABLES LIKE 'compliance_requirements_tracking'")
    if cursor.fetchone():
        print("📊 Updating compliance_requirements_tracking table...")
        
        cursor.execute('SELECT requirement_id, evidence_count FROM compliance_requirements_tracking')
        tracking_requirements = cursor.fetchall()
        
        tracking_updates = 0
        for req_id, stored_count in tracking_requirements:
            actual_count = actual_counts.get(req_id, 0)
            
            if stored_count != actual_count:
                print(f"  {req_id}: {stored_count} → {actual_count}")
                cursor.execute(
                    'UPDATE compliance_requirements_tracking SET evidence_count = %s WHERE requirement_id = %s',
                    (actual_count, req_id)
                )
                tracking_updates += 1
        
        if tracking_updates > 0:
            conn.commit()
            print(f"✅ Updated {tracking_updates} tracking evidence counts")
        else:
            print("✅ All tracking evidence counts were already correct")

    # Show summary of current evidence counts
    print("\n📋 Current Evidence Count Summary:")
    for req_id, count in sorted(actual_counts.items()):
        print(f"  {req_id}: {count} evidence records")

    # Clean up any orphaned evidence (requirements not in main tables)
    cursor.execute('''
        SELECT ce.requirement_id, COUNT(*) 
        FROM compliance_evidence ce
        LEFT JOIN unified_compliance_requirements ucr ON ce.requirement_id = ucr.id
        WHERE ucr.id IS NULL
        GROUP BY ce.requirement_id
    ''')
    orphaned = cursor.fetchall()
    
    if orphaned:
        print(f"\n⚠️  Found {len(orphaned)} orphaned evidence groups:")
        for req_id, count in orphaned:
            print(f"  {req_id}: {count} evidence records (no matching requirement)")

    conn.close()
    print("\n✅ Evidence count recalculation completed")

if __name__ == "__main__":
    main()
