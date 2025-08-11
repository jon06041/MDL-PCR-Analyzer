#!/usr/bin/env python3
"""
Clean Up Duplicate File Analysis Evidence

This script removes duplicate evidence records for the same file + fluorophore
combinations, keeping only the most recent analysis for each unique file.
"""

import mysql.connector
import json
import os
import logging
from collections import defaultdict

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

def clean_duplicate_file_analyses():
    """Remove duplicate file analysis evidence, keeping only the most recent"""
    conn = mysql.connector.connect(**get_mysql_config())
    cursor = conn.cursor(dictionary=True)
    
    try:
        logger.info("🧹 CLEANING DUPLICATE FILE ANALYSIS EVIDENCE")
        logger.info("=" * 50)
        
        # Find all analysis evidence with file information
        cursor.execute('''
            SELECT ce.id, ce.requirement_id, ce.created_at,
                   uce.event_data, uce.timestamp
            FROM compliance_evidence ce
            JOIN unified_compliance_events uce ON ce.event_id = uce.id
            WHERE uce.event_type = 'ANALYSIS_COMPLETED'
            AND JSON_EXTRACT(uce.event_data, '$.filename') IS NOT NULL
            AND JSON_EXTRACT(uce.event_data, '$.fluorophore') IS NOT NULL
            ORDER BY uce.timestamp DESC
        ''')
        
        all_analyses = cursor.fetchall()
        
        # Group by requirement + filename + fluorophore
        file_groups = defaultdict(list)
        
        for analysis in all_analyses:
            event_data = json.loads(analysis['event_data'])
            filename = event_data.get('filename', '')
            fluorophore = event_data.get('fluorophore', '')
            key = f"{analysis['requirement_id']}|{filename}|{fluorophore}"
            
            file_groups[key].append({
                'id': analysis['id'],
                'timestamp': analysis['timestamp'],
                'filename': filename,
                'fluorophore': fluorophore,
                'requirement_id': analysis['requirement_id']
            })
        
        total_removed = 0
        
        # For each group, keep only the most recent analysis
        for key, analyses in file_groups.items():
            if len(analyses) > 1:
                # Sort by timestamp (most recent first)
                analyses.sort(key=lambda x: x['timestamp'], reverse=True)
                
                # Keep the first (most recent), remove the rest
                to_keep = analyses[0]
                to_remove = analyses[1:]
                
                ids_to_remove = [a['id'] for a in to_remove]
                
                if ids_to_remove:
                    placeholders = ','.join(['%s'] * len(ids_to_remove))
                    cursor.execute(f'''
                        DELETE FROM compliance_evidence 
                        WHERE id IN ({placeholders})
                    ''', ids_to_remove)
                    
                    removed_count = cursor.rowcount
                    total_removed += removed_count
                    
                    logger.info(f"Removed {removed_count} duplicates for {to_keep['requirement_id']}: {to_keep['filename']} ({to_keep['fluorophore']})")
        
        # Recalculate evidence counts
        cursor.execute('''
            SELECT requirement_id, COUNT(*) as count
            FROM compliance_evidence 
            GROUP BY requirement_id
        ''')
        
        updated_requirements = 0
        for row in cursor.fetchall():
            requirement_id, count = row['requirement_id'], row['count']
            
            cursor.execute('''
                UPDATE compliance_requirements_tracking 
                SET evidence_count = %s,
                    compliance_percentage = %s,
                    updated_at = NOW()
                WHERE requirement_id = %s
            ''', (count, min(100.0, (count / 10) * 100), requirement_id))
            
            if cursor.rowcount > 0:
                updated_requirements += 1
        
        conn.commit()
        
        logger.info("=" * 50)
        logger.info("✅ DUPLICATE FILE CLEANUP COMPLETED")
        logger.info(f"Total duplicate evidence removed: {total_removed}")
        logger.info(f"Requirements updated: {updated_requirements}")
        
        return total_removed
        
    except Exception as e:
        logger.error(f"Error cleaning duplicates: {e}")
        conn.rollback()
        return 0
    finally:
        cursor.close()
        conn.close()

def show_current_evidence_counts():
    """Show current evidence counts after cleanup"""
    conn = mysql.connector.connect(**get_mysql_config())
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT requirement_id, evidence_count
            FROM compliance_requirements_tracking
            WHERE evidence_count > 0
            ORDER BY evidence_count DESC
            LIMIT 10
        ''')
        
        logger.info("\n📊 CURRENT EVIDENCE COUNTS:")
        for requirement_id, count in cursor.fetchall():
            logger.info(f"  {requirement_id}: {count} records")
        
    except Exception as e:
        logger.error(f"Error getting evidence counts: {e}")
    finally:
        cursor.close()
        conn.close()

def main():
    """Main execution"""
    # Clean duplicate file analyses
    removed = clean_duplicate_file_analyses()
    
    # Show current state
    show_current_evidence_counts()
    
    logger.info("\n📋 NEXT STEPS:")
    logger.info("1. Refresh the compliance dashboard")
    logger.info("2. Evidence counts should now show unique file analyses only")
    logger.info("3. Future analyses will prevent file duplicates automatically")

if __name__ == "__main__":
    main()
