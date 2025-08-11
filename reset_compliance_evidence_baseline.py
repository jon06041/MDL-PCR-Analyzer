#!/usr/bin/env python3
"""
Reset Compliance Evidence to Production Baseline

This script resets the compliance evidence counts to reasonable baseline numbers
suitable for production deployment, removing excessive development testing records.
"""

import os
import sys
sys.path.append('/workspaces/MDL-PCR-Analyzer')

from mysql_unified_compliance_manager import MySQLUnifiedComplianceManager
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s:%(message)s')
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

def main():
    """Reset evidence counts to production baseline"""
    logger.info("🔄 RESETTING COMPLIANCE EVIDENCE TO PRODUCTION BASELINE")
    logger.info("=" * 60)
    
    try:
        # Initialize compliance manager
        mysql_config = get_mysql_config()
        compliance_manager = MySQLUnifiedComplianceManager(mysql_config)
        
        # Get current state
        logger.info("Current evidence state:")
        summary = compliance_manager.get_evidence_summary()
        logger.info(f"  Total evidence records: {summary['total_evidence']}")
        logger.info(f"  Evidence by category: {summary['by_category']}")
        
        # Reset to baseline (max 20 evidence records per requirement)
        logger.info("\nResetting evidence counts to baseline (max 20 per requirement)...")
        removed_count = compliance_manager.reset_evidence_counts_to_baseline(max_evidence_per_requirement=20)
        
        # Get final state
        logger.info("\nFinal evidence state:")
        final_summary = compliance_manager.get_evidence_summary()
        logger.info(f"  Total evidence records: {final_summary['total_evidence']}")
        logger.info(f"  Evidence by category: {final_summary['by_category']}")
        
        logger.info("=" * 60)
        logger.info("✅ EVIDENCE BASELINE RESET COMPLETED")
        logger.info(f"Records removed: {removed_count}")
        logger.info(f"Evidence reduction: {summary['total_evidence']} → {final_summary['total_evidence']}")
        logger.info("\n📋 Next steps:")
        logger.info("1. Refresh the compliance dashboard")
        logger.info("2. Evidence counts should now show realistic numbers")
        logger.info("3. New evidence will have deduplication protection")
        
    except Exception as e:
        logger.error(f"Error resetting evidence baseline: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
