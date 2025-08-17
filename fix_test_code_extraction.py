#!/usr/bin/env python3
"""
Fix test_code extraction for existing database records.
Updates well_results table with correct test_code extracted from experiment filename.
"""

import pymysql
import os
import sys

def get_mysql_connection():
    """Get MySQL database connection"""
    mysql_config = {
        'host': os.environ.get('MYSQL_HOST', 'localhost'),
        'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
        'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
        'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis')
    }
    return pymysql.connect(**mysql_config)

def extract_test_code_from_filename(filename):
    """Extract test_code from experiment filename"""
    if not filename:
        return None
        
    # Remove CFX filename suffixes
    base_pattern = filename.replace(' -  Quantification Amplification Results_FAM.csv', '')
    base_pattern = base_pattern.replace(' -  Quantification Amplification Results_HEX.csv', '')
    base_pattern = base_pattern.replace(' -  Quantification Amplification Results_Texas Red.csv', '')
    base_pattern = base_pattern.replace(' -  Quantification Amplification Results_Cy5.csv', '')
    base_pattern = base_pattern.replace(' - Quantification Amplification Results_FAM.csv', '')
    base_pattern = base_pattern.replace(' - Quantification Amplification Results_HEX.csv', '')
    base_pattern = base_pattern.replace(' - Quantification Amplification Results_Texas Red.csv', '')
    base_pattern = base_pattern.replace(' - Quantification Amplification Results_Cy5.csv', '')
    
    # Extract test code (first part before underscore)
    test_code = base_pattern.split('_')[0]
    
    # Remove "Ac" prefix if present
    if test_code.startswith('Ac'):
        test_code = test_code[2:]
        
    return test_code

def fix_test_code_extraction(dry_run=True):
    """Fix test_code for all well_results based on their session's filename"""
    
    print("🔧 Fixing test_code extraction for existing database records")
    print("=" * 60)
    
    conn = get_mysql_connection()
    cursor = conn.cursor()
    
    try:
        # Get all sessions with their filenames
        cursor.execute("""
            SELECT DISTINCT s.id, s.filename 
            FROM analysis_sessions s
            INNER JOIN well_results w ON s.id = w.session_id
            WHERE w.test_code IS NULL OR w.test_code = ''
            ORDER BY s.id
        """)
        
        sessions_to_fix = cursor.fetchall()
        
        print(f"📊 Found {len(sessions_to_fix)} sessions with missing test_code")
        print()
        
        total_wells_updated = 0
        
        for session_id, filename in sessions_to_fix:
            # Extract test_code from filename
            test_code = extract_test_code_from_filename(filename)
            
            if not test_code or test_code == filename:
                print(f"⚠️  Session {session_id}: Could not extract test_code from '{filename}'")
                continue
                
            # Count wells that need updating
            cursor.execute("""
                SELECT COUNT(*) FROM well_results 
                WHERE session_id = %s AND (test_code IS NULL OR test_code = '')
            """, (session_id,))
            
            well_count = cursor.fetchone()[0]
            
            print(f"📁 Session {session_id}: '{filename}'")
            print(f"   → test_code: '{test_code}' ({well_count} wells to update)")
            
            if not dry_run and well_count > 0:
                # Update all wells in this session
                cursor.execute("""
                    UPDATE well_results 
                    SET test_code = %s 
                    WHERE session_id = %s AND (test_code IS NULL OR test_code = '')
                """, (test_code, session_id))
                
                updated_count = cursor.rowcount
                total_wells_updated += updated_count
                print(f"   ✅ Updated {updated_count} wells")
            
            print()
        
        if not dry_run:
            conn.commit()
            print(f"🎉 SUCCESS: Updated test_code for {total_wells_updated} wells across {len(sessions_to_fix)} sessions")
        else:
            # Calculate total wells for dry run
            total_wells_to_update = 0
            for session_id, filename in sessions_to_fix:
                cursor.execute("""
                    SELECT COUNT(*) FROM well_results 
                    WHERE session_id = %s AND (test_code IS NULL OR test_code = '')
                """, (session_id,))
                total_wells_to_update += cursor.fetchone()[0]
                
            print(f"🔍 DRY RUN: Would update test_code for {total_wells_to_update} wells")
            print("💡 Run with --apply to actually update the database")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        conn.close()

def main():
    """Main function"""
    dry_run = True
    
    if len(sys.argv) > 1 and sys.argv[1] == '--apply':
        dry_run = False
        print("⚡ APPLYING CHANGES TO DATABASE")
    else:
        print("🔍 DRY RUN MODE (use --apply to actually update)")
    
    print()
    fix_test_code_extraction(dry_run=dry_run)

if __name__ == "__main__":
    main()
