#!/usr/bin/env python3
"""
MySQL Database Backup and Recovery Manager for MDL-PCR-Analyzer
Provides automatic backups, development resets, and ML model impact tracking
Compatible with MySQL database instead of SQLite
"""

import os
import json
import datetime
import time
import subprocess
from pathlib import Path
import hashlib
import gzip
import logging
from dotenv import load_dotenv
import mysql.connector
from mysql.connector import Error as MySQLError

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MySQLBackupManager:
    def __init__(self):
        self.backup_dir = Path('db_backups')
        self.backup_dir.mkdir(exist_ok=True)
        
        # MySQL configuration from environment
        self.mysql_config = {
            'host': os.getenv('MYSQL_HOST', 'localhost'),
            'port': int(os.getenv('MYSQL_PORT', '3306')),
            'database': os.getenv('MYSQL_DATABASE', 'qpcr_analysis'),
            'user': os.getenv('MYSQL_USER', 'qpcr_user'),
            'password': os.getenv('MYSQL_PASSWORD', 'qpcr_password'),
        }
        
        # Backup configuration
        self.auto_backup_interval = 3600  # 1 hour in seconds
        self.max_backups = 50  # Keep last 50 backups
    
    def _get_db_connection(self):
        """Get MySQL database connection"""
        try:
            connection = mysql.connector.connect(**self.mysql_config)
            return connection
        except MySQLError as e:
            logger.error(f"MySQL connection failed: {e}")
            raise
    
    def _execute_with_retry(self, operation_func, max_retries=3, delay=0.1):
        """Execute database operation with retry logic for handling connection issues"""
        for attempt in range(max_retries):
            try:
                return operation_func()
            except MySQLError as e:
                if attempt < max_retries - 1:
                    logger.warning(f"MySQL operation failed, retrying in {delay} seconds (attempt {attempt + 1}/{max_retries}): {e}")
                    time.sleep(delay)
                    delay *= 2  # Exponential backoff
                    continue
                else:
                    raise e
            except Exception as e:
                # Re-raise non-MySQL exceptions immediately
                raise e
    
    def create_backup(self, backup_type='manual', description=''):
        """Create a timestamped backup of the MySQL database using mysqldump"""
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f'qpcr_analysis_{backup_type}_{timestamp}.sql.gz'
        backup_path = self.backup_dir / backup_filename
        
        try:
            # Construct mysqldump command
            mysqldump_cmd = [
                'mysqldump',
                f'--host={self.mysql_config["host"]}',
                f'--port={self.mysql_config["port"]}',
                f'--user={self.mysql_config["user"]}',
                f'--password={self.mysql_config["password"]}',
                '--protocol=TCP',  # Force TCP connection instead of socket
                '--single-transaction',  # For InnoDB consistency
                '--routines',  # Include stored procedures and functions
                '--triggers',  # Include triggers
                '--events',    # Include events
                '--add-drop-table',  # Add DROP TABLE statements
                '--add-locks',  # Add table locks
                '--disable-keys',  # Faster import
                '--extended-insert',  # More efficient INSERT statements
                self.mysql_config['database']
            ]
            
            # Execute mysqldump and compress the output
            logger.info(f"Creating MySQL backup: {backup_filename}")
            
            with gzip.open(backup_path, 'wb') as gz_file:
                process = subprocess.Popen(
                    mysqldump_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=False  # Binary mode for gzip
                )
                
                # Stream the output to gzip file
                for chunk in iter(lambda: process.stdout.read(8192), b''):
                    gz_file.write(chunk)
                
                # Wait for process to complete
                process.wait()
                
                if process.returncode != 0:
                    error_output = process.stderr.read().decode('utf-8')
                    raise Exception(f"mysqldump failed: {error_output}")
            
            # Get file size for metadata
            backup_size = os.path.getsize(backup_path)
            
            # Create metadata file
            metadata = {
                'backup_type': backup_type,
                'timestamp': timestamp,
                'description': description,
                'database': self.mysql_config['database'],
                'host': self.mysql_config['host'],
                'backup_size': backup_size,
                'compressed': True,
                'md5_hash': self._get_file_hash(backup_path),
                'mysql_version': self._get_mysql_version()
            }
            
            metadata_path = backup_path.with_suffix('.json')
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
                
            logger.info(f"MySQL backup created: {backup_filename} ({backup_size} bytes)")
            
            # Clean up old backups
            self._cleanup_old_backups()
            
            return str(backup_path), metadata
            
        except Exception as e:
            logger.error(f"MySQL backup failed: {e}")
            # Clean up partial backup file if it exists
            if backup_path.exists():
                backup_path.unlink()
            return None, None
    
    def restore_backup(self, backup_path):
        """Restore MySQL database from backup"""
        try:
            backup_path = Path(backup_path)
            
            # Create safety backup first
            safety_backup, _ = self.create_backup('pre_restore', f'Before restoring {backup_path.name}')
            
            # Construct mysql restore command
            mysql_cmd = [
                'mysql',
                f'--host={self.mysql_config["host"]}',
                f'--port={self.mysql_config["port"]}',
                f'--user={self.mysql_config["user"]}',
                f'--password={self.mysql_config["password"]}',
                '--protocol=TCP',  # Force TCP connection instead of socket
                self.mysql_config['database']
            ]
            
            logger.info(f"Restoring MySQL database from: {backup_path}")
            
            # Open backup file (handle both compressed and uncompressed)
            if backup_path.suffix == '.gz':
                with gzip.open(backup_path, 'rb') as gz_file:
                    process = subprocess.Popen(
                        mysql_cmd,
                        stdin=subprocess.PIPE,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=False
                    )
                    
                    # Stream the uncompressed data to mysql
                    for chunk in iter(lambda: gz_file.read(8192), b''):
                        process.stdin.write(chunk)
                    
                    process.stdin.close()
                    process.wait()
            else:
                # Uncompressed SQL file
                with open(backup_path, 'rb') as sql_file:
                    process = subprocess.Popen(
                        mysql_cmd,
                        stdin=sql_file,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE
                    )
                    process.wait()
            
            if process.returncode != 0:
                error_output = process.stderr.read().decode('utf-8')
                raise Exception(f"MySQL restore failed: {error_output}")
            
            logger.info(f"MySQL database restored from: {backup_path}")
            logger.info(f"Safety backup created: {safety_backup}")
            
            return True
            
        except Exception as e:
            logger.error(f"MySQL restore failed: {e}")
            return False
    
    def list_backups(self):
        """List all available backups with metadata"""
        backups = []
        
        for backup_file in self.backup_dir.glob('*.sql.gz'):
            metadata_file = backup_file.with_suffix('.json')
            
            if metadata_file.exists():
                try:
                    with open(metadata_file, 'r') as f:
                        metadata = json.load(f)
                    metadata['file_path'] = str(backup_file)
                    backups.append(metadata)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid metadata file: {metadata_file}")
            else:
                # Backup without metadata
                backups.append({
                    'file_path': str(backup_file),
                    'backup_type': 'unknown',
                    'timestamp': backup_file.stem.split('_')[-1] if '_' in backup_file.stem else 'unknown',
                    'compressed': backup_file.suffix == '.gz',
                    'backup_size': os.path.getsize(backup_file)
                })
        
        # Also check for uncompressed SQL files
        for backup_file in self.backup_dir.glob('*.sql'):
            if not backup_file.with_suffix('.sql.gz').exists():  # Don't duplicate compressed files
                metadata_file = backup_file.with_suffix('.json')
                
                if metadata_file.exists():
                    try:
                        with open(metadata_file, 'r') as f:
                            metadata = json.load(f)
                        metadata['file_path'] = str(backup_file)
                        backups.append(metadata)
                    except json.JSONDecodeError:
                        logger.warning(f"Invalid metadata file: {metadata_file}")
                else:
                    backups.append({
                        'file_path': str(backup_file),
                        'backup_type': 'unknown',
                        'timestamp': backup_file.stem.split('_')[-1] if '_' in backup_file.stem else 'unknown',
                        'compressed': False,
                        'backup_size': os.path.getsize(backup_file)
                    })
                
        return sorted(backups, key=lambda x: x.get('timestamp', ''), reverse=True)
    
    def reset_development_data(self, preserve_structure=True):
        """Reset data for development while preserving schema"""
        backup_path, _ = self.create_backup('pre_dev_reset', 'Before development reset')
        
        def _reset_data():
            conn = self._get_db_connection()
            cursor = conn.cursor()
            
            try:
                if preserve_structure:
                    # Clear data but keep schema
                    tables_to_clear = [
                        'ml_prediction_tracking',
                        'ml_training_history', 
                        'ml_model_performance',
                        'analysis_sessions',
                        'well_results',
                        'experiment_statistics',
                        'ml_validation_tracking',
                        'fda_compliance_audit'
                    ]
                    
                    # Disable foreign key checks temporarily
                    cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
                    
                    for table in tables_to_clear:
                        try:
                            cursor.execute(f"TRUNCATE TABLE {table}")
                            logger.info(f"Cleared table: {table}")
                        except MySQLError as e:
                            logger.warning(f"Could not clear table {table}: {e}")
                    
                    # Re-enable foreign key checks
                    cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
                    
                else:
                    # Drop and recreate database (more aggressive reset)
                    cursor.execute(f"DROP DATABASE IF EXISTS {self.mysql_config['database']}")
                    cursor.execute(f"CREATE DATABASE {self.mysql_config['database']}")
                    cursor.execute(f"USE {self.mysql_config['database']}")
                    
                conn.commit()
                return True
                
            finally:
                cursor.close()
                conn.close()
        
        try:
            success = self._execute_with_retry(_reset_data)
            if success:
                logger.info(f"Development reset completed. Backup created: {backup_path}")
            return success
        except Exception as e:
            logger.error(f"Development reset failed: {e}")
            return False
    
    def _get_file_hash(self, file_path):
        """Calculate MD5 hash of file"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    def _get_mysql_version(self):
        """Get MySQL server version"""
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT VERSION()")
            version = cursor.fetchone()[0]
            cursor.close()
            conn.close()
            return version
        except Exception:
            return "unknown"
    
    def _cleanup_old_backups(self):
        """Remove old backups to maintain max_backups limit"""
        try:
            backups = self.list_backups()
            
            if len(backups) > self.max_backups:
                # Sort by timestamp and remove oldest
                backups_to_remove = backups[self.max_backups:]
                
                for backup in backups_to_remove:
                    backup_path = Path(backup['file_path'])
                    metadata_path = backup_path.with_suffix('.json')
                    
                    # Remove backup file
                    if backup_path.exists():
                        backup_path.unlink()
                        logger.info(f"Removed old backup: {backup_path.name}")
                    
                    # Remove metadata file
                    if metadata_path.exists():
                        metadata_path.unlink()
                        
        except Exception as e:
            logger.warning(f"Failed to cleanup old backups: {e}")
    
    def get_database_stats(self):
        """Get database statistics for monitoring"""
        def _get_stats():
            conn = self._get_db_connection()
            cursor = conn.cursor()
            
            try:
                stats = {}
                
                # Database size
                cursor.execute("""
                    SELECT 
                        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'DB Size in MB'
                    FROM information_schema.tables 
                    WHERE table_schema = %s
                """, (self.mysql_config['database'],))
                
                result = cursor.fetchone()
                stats['database_size_mb'] = result[0] if result[0] else 0
                
                # Table row counts
                cursor.execute("""
                    SELECT table_name, table_rows 
                    FROM information_schema.tables 
                    WHERE table_schema = %s
                    ORDER BY table_rows DESC
                """, (self.mysql_config['database'],))
                
                stats['table_counts'] = {row[0]: row[1] for row in cursor.fetchall()}
                
                # Recent activity (last 24 hours) - fix column name
                try:
                    cursor.execute("""
                        SELECT COUNT(*) FROM analysis_sessions 
                        WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                    """)
                    result = cursor.fetchone()
                    stats['recent_sessions'] = result[0] if result else 0
                except MySQLError:
                    # Try alternative column name if timestamp doesn't exist
                    try:
                        cursor.execute("""
                            SELECT COUNT(*) FROM analysis_sessions 
                            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                        """)
                        result = cursor.fetchone()
                        stats['recent_sessions'] = result[0] if result else 0
                    except MySQLError:
                        # If neither column exists, just set to 0
                        stats['recent_sessions'] = 0
                
                return stats
                
            finally:
                cursor.close()
                conn.close()
        
        try:
            return self._execute_with_retry(_get_stats)
        except Exception as e:
            logger.error(f"Failed to get database stats: {e}")
            return {}


def main():
    """CLI interface for MySQL backup management"""
    import argparse
    
    parser = argparse.ArgumentParser(description='MySQL Database Backup Manager')
    parser.add_argument('action', choices=['backup', 'restore', 'list', 'reset', 'stats'])
    parser.add_argument('--backup-path', help='Path to backup file for restore')
    parser.add_argument('--description', help='Description for backup')
    parser.add_argument('--preserve-structure', action='store_true', help='Preserve schema during reset')
    
    args = parser.parse_args()
    
    backup_manager = MySQLBackupManager()
    
    if args.action == 'backup':
        backup_path, metadata = backup_manager.create_backup('manual', args.description or '')
        if backup_path:
            print(f"Backup created: {backup_path}")
            print(f"Size: {metadata['backup_size']} bytes")
        else:
            print("Backup failed")
            
    elif args.action == 'restore':
        if not args.backup_path:
            print("--backup-path required for restore")
            return
        success = backup_manager.restore_backup(args.backup_path)
        print("Restore successful" if success else "Restore failed")
        
    elif args.action == 'list':
        backups = backup_manager.list_backups()
        print(f"Found {len(backups)} backups:")
        for backup in backups:
            size_mb = backup.get('backup_size', 0) / (1024 * 1024)
            compressed = " (compressed)" if backup.get('compressed', False) else ""
            print(f"  {backup['timestamp']} - {backup['backup_type']} - {size_mb:.1f}MB{compressed}")
            if backup.get('description'):
                print(f"    Description: {backup['description']}")
            
    elif args.action == 'reset':
        success = backup_manager.reset_development_data(args.preserve_structure)
        print("Development reset successful" if success else "Development reset failed")
        
    elif args.action == 'stats':
        stats = backup_manager.get_database_stats()
        print("Database Statistics:")
        print(f"  Size: {stats.get('database_size_mb', 0):.2f} MB")
        print(f"  Recent sessions (24h): {stats.get('recent_sessions', 0)}")
        print("  Table row counts:")
        for table, count in stats.get('table_counts', {}).items():
            print(f"    {table}: {count:,}")


if __name__ == '__main__':
    main()
