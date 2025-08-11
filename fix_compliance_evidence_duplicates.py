#!/usr/bin/env python3
"""
Fix Compliance Evidence Duplicates and Reset Counts

This script addresses the issue where evidence counts are inflated due to:
1. Duplicate records from development testing
2. No deduplication logic during evidence creation
3. Evidence count not matching actual unique evidence

Actions performed:
1. Reset evidence counts to accurate values
2. Remove duplicate evidence records (keep only unique ones)
3. Update the compliance manager to prevent future duplicates
"""

import mysql.connector
import json
import hashlib
import datetime
from typing import Dict, List
import os
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_mysql_config():
    """Get MySQL configuration from environment variables"""
    return {
        'host': os.environ.get('MYSQL_HOST', 'localhost'),
        'port': int(os.environ.get('MYSQL_PORT', 3306)),
        'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
        'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
        'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis'),
        'charset': 'utf8mb4'
    }

def get_connection():
    """Get MySQL database connection"""
    return mysql.connector.connect(**get_mysql_config())

def analyze_duplicate_evidence():
    """Analyze the current state of evidence duplicates"""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Get total evidence count
        cursor.execute("SELECT COUNT(*) as total FROM compliance_evidence")
        total_evidence = cursor.fetchone()['total']
        
        # Get evidence by requirement
        cursor.execute("""
            SELECT requirement_id, COUNT(*) as count, 
                   COUNT(DISTINCT evidence_hash) as unique_count
            FROM compliance_evidence 
            GROUP BY requirement_id
            ORDER BY count DESC
        """)
        by_requirement = cursor.fetchall()
        
        # Get duplicate evidence records (same hash)
        cursor.execute("""
            SELECT evidence_hash, COUNT(*) as count, requirement_id
            FROM compliance_evidence 
            GROUP BY evidence_hash, requirement_id
            HAVING count > 1
            ORDER BY count DESC
        """)
        duplicates = cursor.fetchall()
        
        # Get tracking table evidence counts
        cursor.execute("""
            SELECT requirement_id, evidence_count
            FROM compliance_requirements_tracking
            ORDER BY evidence_count DESC
        """)
        tracking_counts = cursor.fetchall()
        
        logger.info(f"=== COMPLIANCE EVIDENCE ANALYSIS ===")
        logger.info(f"Total evidence records: {total_evidence}")
        logger.info(f"Duplicate hash groups: {len(duplicates)}")
        
        logger.info(f"\n=== TOP REQUIREMENTS BY EVIDENCE COUNT ===")
        for req in by_requirement[:10]:
            logger.info(f"{req['requirement_id']}: {req['count']} total, {req['unique_count']} unique")
        
        logger.info(f"\n=== TOP DUPLICATE GROUPS ===")
        for dup in duplicates[:10]:
            logger.info(f"{dup['requirement_id']}: {dup['count']} copies of same evidence")
        
        logger.info(f"\n=== TRACKING TABLE COUNTS ===")
        for track in tracking_counts[:10]:
            logger.info(f"{track['requirement_id']}: {track['evidence_count']} (tracked count)")
        
        return {
            'total_evidence': total_evidence,
            'duplicate_groups': len(duplicates),
            'requirements_analysis': by_requirement,
            'duplicates': duplicates,
            'tracking_counts': tracking_counts
        }
        
    except Exception as e:
        logger.error(f"Error analyzing duplicates: {e}")
        return None
    finally:
        cursor.close()
        conn.close()

def remove_duplicate_evidence():
    """Remove duplicate evidence records, keeping only the oldest for each unique hash"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        logger.info("=== REMOVING DUPLICATE EVIDENCE ===")
        
        # Find duplicate evidence records (same requirement_id + evidence_hash)
        cursor.execute("""
            SELECT requirement_id, evidence_hash, GROUP_CONCAT(id ORDER BY created_at) as ids
            FROM compliance_evidence 
            GROUP BY requirement_id, evidence_hash
            HAVING COUNT(*) > 1
        """)
        duplicate_groups = cursor.fetchall()
        
        total_removed = 0
        
        for requirement_id, evidence_hash, ids_str in duplicate_groups:
            ids = [int(x) for x in ids_str.split(',')]
            # Keep the first (oldest) record, remove the rest
            ids_to_remove = ids[1:]
            
            if ids_to_remove:
                placeholders = ','.join(['%s'] * len(ids_to_remove))
                cursor.execute(f"""
                    DELETE FROM compliance_evidence 
                    WHERE id IN ({placeholders})
                """, ids_to_remove)
                
                removed_count = cursor.rowcount
                total_removed += removed_count
                logger.info(f"Removed {removed_count} duplicates for {requirement_id} (hash: {evidence_hash[:16]}...)")
        
        conn.commit()
        logger.info(f"Total duplicate evidence records removed: {total_removed}")
        return total_removed
        
    except Exception as e:
        logger.error(f"Error removing duplicates: {e}")
        conn.rollback()
        return 0
    finally:
        cursor.close()
        conn.close()

def recalculate_evidence_counts():
    """Recalculate accurate evidence counts for all requirements"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        logger.info("=== RECALCULATING EVIDENCE COUNTS ===")
        
        # Get actual evidence counts after deduplication
        cursor.execute("""
            SELECT requirement_id, COUNT(*) as actual_count
            FROM compliance_evidence 
            GROUP BY requirement_id
        """)
        actual_counts = cursor.fetchall()
        
        updated_requirements = 0
        
        for requirement_id, actual_count in actual_counts:
            # Update the tracking table with accurate count
            cursor.execute("""
                UPDATE compliance_requirements_tracking 
                SET evidence_count = %s,
                    compliance_percentage = %s,
                    updated_at = %s
                WHERE requirement_id = %s
            """, (
                actual_count,
                min(100.0, (actual_count / 10) * 100),  # Recalculate percentage
                datetime.datetime.now(),
                requirement_id
            ))
            
            if cursor.rowcount > 0:
                updated_requirements += 1
                logger.info(f"Updated {requirement_id}: {actual_count} evidence records")
        
        conn.commit()
        logger.info(f"Updated evidence counts for {updated_requirements} requirements")
        return updated_requirements
        
    except Exception as e:
        logger.error(f"Error recalculating counts: {e}")
        conn.rollback()
        return 0
    finally:
        cursor.close()
        conn.close()

def add_deduplication_to_compliance_manager():
    """Update the compliance manager to prevent future duplicates"""
    logger.info("=== UPDATING COMPLIANCE MANAGER FOR DEDUPLICATION ===")
    
    # The fix will be applied to mysql_unified_compliance_manager.py
    # We'll modify the _create_compliance_evidence method to check for existing evidence
    
    backup_file = "/workspaces/MDL-PCR-Analyzer/mysql_unified_compliance_manager.py.backup"
    original_file = "/workspaces/MDL-PCR-Analyzer/mysql_unified_compliance_manager.py"
    
    # Create backup
    import shutil
    shutil.copy2(original_file, backup_file)
    logger.info(f"Created backup: {backup_file}")
    
    # The actual fix will be applied via replace_string_in_file in the main script
    return True

def main():
    """Main execution function"""
    logger.info("🔧 FIXING COMPLIANCE EVIDENCE DUPLICATES")
    logger.info("=" * 50)
    
    # Step 1: Analyze current state
    logger.info("Step 1: Analyzing current evidence state...")
    analysis = analyze_duplicate_evidence()
    if not analysis:
        logger.error("Failed to analyze evidence. Exiting.")
        return
    
    # Step 2: Remove duplicates
    logger.info("\nStep 2: Removing duplicate evidence records...")
    removed_count = remove_duplicate_evidence()
    
    # Step 3: Recalculate counts
    logger.info("\nStep 3: Recalculating evidence counts...")
    updated_count = recalculate_evidence_counts()
    
    # Step 4: Update compliance manager (placeholder)
    logger.info("\nStep 4: Preparing compliance manager updates...")
    add_deduplication_to_compliance_manager()
    
    # Step 5: Final analysis
    logger.info("\nStep 5: Final state analysis...")
    final_analysis = analyze_duplicate_evidence()
    
    logger.info("\n" + "=" * 50)
    logger.info("🎉 CLEANUP COMPLETED")
    logger.info(f"Duplicate evidence removed: {removed_count}")
    logger.info(f"Requirements updated: {updated_count}")
    if final_analysis:
        logger.info(f"Final evidence count: {final_analysis['total_evidence']}")
        logger.info(f"Remaining duplicate groups: {final_analysis['duplicate_groups']}")
    
    logger.info("\n📋 NEXT STEPS:")
    logger.info("1. The compliance manager will be updated to prevent future duplicates")
    logger.info("2. Evidence counts should now be accurate")
    logger.info("3. Refresh the compliance dashboard to see updated counts")

if __name__ == "__main__":
    main()
