"""
MySQL Database Manager
Handles database operations using MySQL exclusively
"""

import pymysql
import logging
import os
from datetime import datetime
from ml_validation_tracker import MLValidationTracker

logger = logging.getLogger(__name__)

class MySQLDatabaseManager:
    def __init__(self, mysql_config=None):
        """Initialize with MySQL configuration"""
        self.mysql_config = mysql_config or {
            'host': os.environ.get('MYSQL_HOST', 'localhost'),
            'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
            'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
            'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis'),
            'port': int(os.environ.get('MYSQL_PORT', 3306))
        }
        self.ml_tracker = MLValidationTracker()
        logger.info("✅ MySQL Database Manager initialized")
    
    def get_connection(self):
        """Get MySQL database connection"""
        return pymysql.connect(**self.mysql_config)
    
    def test_connection(self):
        """Test MySQL database connectivity"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            
            return {
                'success': True,
                'database_type': 'MySQL',
                'status': 'connected',
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            return {
                'success': False,
                'database_type': 'MySQL',
                'status': 'error',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def get_database_stats(self):
        """Get MySQL database statistics"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Get table count and sizes
            cursor.execute("""
                SELECT 
                    table_name,
                    table_rows,
                    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
                FROM information_schema.tables 
                WHERE table_schema = %s
                ORDER BY size_mb DESC
            """, (self.mysql_config['database'],))
            
            tables = cursor.fetchall()
            cursor.close()
            conn.close()
            
            return {
                'success': True,
                'database_type': 'MySQL',
                'tables': tables,
                'total_tables': len(tables),
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def get_ml_validation_stats(self):
        """Get ML validation statistics"""
        try:
            return self.ml_tracker.get_validation_summary()
        except Exception as e:
            logger.error(f"Error getting ML validation stats: {e}")
            return {'error': str(e)}

# Backwards compatibility
DatabaseBackupManager = MySQLDatabaseManager