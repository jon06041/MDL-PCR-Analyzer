"""
ML Configuration Management
Handles pathogen-specific ML settings and safe data operations
Uses MySQL exclusively - NO SQLITE
"""

import pymysql
import json
import os
import shutil
from datetime import datetime
from flask import request, jsonify
import logging

logger = logging.getLogger(__name__)

class MLConfigManager:
    def __init__(self, use_mysql=True, mysql_config=None, db_path=None):
        """
        CRITICAL: This system uses MySQL ONLY. SQLite is deprecated.
        
        Args:
            use_mysql: Must be True (SQLite deprecated)
            mysql_config: MySQL connection configuration
            db_path: Ignored - kept for backward compatibility only
        """
        if not use_mysql:
            raise ValueError("CRITICAL ERROR: SQLite is deprecated. This system requires MySQL.")
        
        if not mysql_config:
            raise ValueError("CRITICAL ERROR: MySQL configuration is required. SQLite not supported.")
        
        self.mysql_config = mysql_config
        self.use_mysql = True
        logger.info("✅ ML Config Manager initialized with MySQL (SQLite deprecated)")
        self.init_tables()
        """
        CRITICAL: This system uses MySQL ONLY. SQLite is deprecated.
        
        Args:
            use_mysql: Must be True (SQLite deprecated)
            mysql_config: MySQL connection configuration
            db_path: Ignored - kept for backward compatibility only
        """
        if not use_mysql:
            raise ValueError("CRITICAL ERROR: SQLite is deprecated. This system requires MySQL.")
        
        if not mysql_config:
            raise ValueError("CRITICAL ERROR: MySQL configuration is required. SQLite not supported.")
        
        self.mysql_config = mysql_config
        self.use_mysql = True
        logger.info("✅ ML Config Manager initialized with MySQL (SQLite deprecated)")
        self.init_tables()
    
    def get_db_connection(self):
        """Get MySQL database connection with proper settings"""
        try:
            connection = pymysql.connect(
                host=self.mysql_config['host'],
                port=self.mysql_config.get('port', 3306),
                user=self.mysql_config['user'],
                password=self.mysql_config['password'],
                database=self.mysql_config['database'],
                charset='utf8mb4',
                autocommit=False,
                cursorclass=pymysql.cursors.DictCursor
            )
            return connection
        except Exception as e:
            logger.error(f"Failed to connect to MySQL: {e}")
            raise ConnectionError(f"MySQL connection failed: {e}. Check your database configuration.")
    
    def init_tables(self):
        """Initialize ML configuration tables in MySQL - SQLite deprecated"""
        try:
            conn = self.get_db_connection()
            with conn.cursor() as cursor:
                # Create ml_pathogen_config table for MySQL
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS ml_pathogen_config (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        pathogen_code VARCHAR(50) NOT NULL,
                        fluorophore VARCHAR(20) NOT NULL,
                        ml_enabled BOOLEAN DEFAULT FALSE,
                        confidence_threshold DECIMAL(3,2) DEFAULT 0.7,
                        min_training_samples INT DEFAULT 50,
                        max_training_samples INT DEFAULT 1000,
                        auto_retrain BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        UNIQUE KEY unique_pathogen_fluorophore (pathogen_code, fluorophore)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """)
                
                # Create ml_system_config table for MySQL
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS ml_system_config (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        config_key VARCHAR(100) NOT NULL UNIQUE,
                        config_value TEXT,
                        config_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
                        description TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """)
                
                # Create ml_audit_log table for MySQL
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS ml_audit_log (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        action VARCHAR(100) NOT NULL,
                        pathogen_code VARCHAR(50),
                        fluorophore VARCHAR(20),
                        old_value TEXT,
                        new_value TEXT,
                        user_info TEXT,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_pathogen_action (pathogen_code, action),
                        INDEX idx_timestamp (timestamp)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """)
                
                conn.commit()
                logger.info("✅ ML configuration tables initialized in MySQL")
                
                # Populate from pathogen library after schema setup
                self.populate_from_pathogen_library()
            
            conn.close()
        except Exception as e:
            error_msg = f"CRITICAL: Failed to initialize ML config tables in MySQL: {e}. SQLite is deprecated."
            logger.error(error_msg)
            raise Exception(error_msg)
    
    def get_pathogen_ml_config(self, pathogen_code, fluorophore=None):
        """Get ML configuration for specific pathogen/fluorophore - MySQL only"""
        try:
            conn = self.get_db_connection()
            with conn.cursor() as cursor:
                if fluorophore:
                    cursor.execute(
                        "SELECT * FROM ml_pathogen_config WHERE pathogen_code = %s AND fluorophore = %s",
                        (pathogen_code, fluorophore)
                    )
                else:
                    cursor.execute(
                        "SELECT * FROM ml_pathogen_config WHERE pathogen_code = %s",
                        (pathogen_code,)
                    )
                
                results = cursor.fetchall()
            conn.close()
            return results
        except Exception as e:
            error_msg = f"CRITICAL: Failed to get pathogen ML config from MySQL: {e}. SQLite is deprecated."
            logger.error(error_msg)
            raise Exception(error_msg)
    
    def set_pathogen_ml_enabled(self, pathogen_code, fluorophore, enabled, user_info=None):
        """Enable/disable ML for specific pathogen+fluorophore"""
        try:
            with self.get_db_connection() as conn:
                # Get current state for audit
                cursor = conn.execute(
                    "SELECT ml_enabled FROM ml_pathogen_config WHERE pathogen_code = ? AND fluorophore = ?",
                    (pathogen_code, fluorophore)
                )
                result = cursor.fetchone()
                old_state = result[0] if result else None
                
                # Update or insert configuration
                conn.execute("""
                    INSERT OR REPLACE INTO ml_pathogen_config 
                    (pathogen_code, fluorophore, ml_enabled, updated_at) 
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """, (pathogen_code, fluorophore, enabled))
                
                # Log the change
                self._log_audit_action(
                    conn, 'toggle_ml', pathogen_code, fluorophore,
                    str(old_state), str(enabled), user_info
                )
                
                conn.commit()
                logger.info(f"ML {'enabled' if enabled else 'disabled'} for {pathogen_code}/{fluorophore}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to set pathogen ML config: {e}")
            return False
    
    def is_ml_enabled_for_pathogen(self, pathogen_code, fluorophore):
        """Check if ML is enabled for specific pathogen+fluorophore"""
        try:
            # First check global ML setting
            if not self._is_global_ml_enabled():
                return False
            
            with self.get_db_connection() as conn:
                cursor = conn.execute(
                    "SELECT ml_enabled FROM ml_pathogen_config WHERE pathogen_code = ? AND fluorophore = ?",
                    (pathogen_code, fluorophore)
                )
                result = cursor.fetchone()
                
                # Default to enabled if no specific config found
                return result[0] if result else True
                
        except Exception as e:
            logger.error(f"Failed to check ML enabled status: {e}")
            return False
    
    def get_system_config(self, key):
        """Get system-wide configuration value"""
        try:
            with self.get_db_connection() as conn:
                cursor = conn.execute(
                    "SELECT config_value FROM ml_system_config WHERE config_key = ?",
                    (key,)
                )
                result = cursor.fetchone()
                return result[0] if result else None
        except Exception as e:
            logger.error(f"Failed to get system config {key}: {e}")
            return None
    
    def set_system_config(self, key, value, user_info=None):
        """Set system-wide configuration value"""
        try:
            with self.get_db_connection() as conn:
                # Get old value for audit
                cursor = conn.execute(
                    "SELECT config_value FROM ml_system_config WHERE config_key = ?",
                    (key,)
                )
                result = cursor.fetchone()
                old_value = result[0] if result else None
                
                # Update configuration
                conn.execute("""
                    UPDATE ml_system_config 
                    SET config_value = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE config_key = ?
                """, (value, key))
                
                if conn.total_changes == 0:
                    logger.warning(f"System config key '{key}' not found")
                    return False
                
                # Log the change
                self._log_audit_action(
                    conn, 'update_system_config', None, None,
                    f"{key}:{old_value}", f"{key}:{value}", user_info
                )
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Failed to set system config: {e}")
            return False
    
    def reset_training_data(self, pathogen_code=None, fluorophore=None, user_info=None):
        """
        Reset ML training data (DANGEROUS OPERATION)
        If pathogen_code is None, resets ALL training data
        """
        try:
            # Create backup before reset
            backup_path = self._create_training_backup()
            
            with self.get_db_connection() as conn:
                if pathogen_code:
                    # Reset specific pathogen data
                    if fluorophore:
                        # Specific pathogen+fluorophore
                        conn.execute("""
                            DELETE FROM ml_training_data 
                            WHERE JSON_EXTRACT(metadata, '$.pathogen_code') = ? 
                            AND JSON_EXTRACT(metadata, '$.fluorophore') = ?
                        """, (pathogen_code, fluorophore))
                        target = f"{pathogen_code}/{fluorophore}"
                    else:
                        # All fluorophores for pathogen
                        conn.execute("""
                            DELETE FROM ml_training_data 
                            WHERE JSON_EXTRACT(metadata, '$.pathogen_code') = ?
                        """, (pathogen_code,))
                        target = pathogen_code
                else:
                    # Reset ALL training data
                    conn.execute("DELETE FROM ml_training_data")
                    target = "ALL"
                
                # Log the reset action
                self._log_audit_action(
                    conn, 'reset_training_data', pathogen_code, fluorophore,
                    f"backup:{backup_path}", f"reset:{target}", user_info
                )
                
                conn.commit()
                
                # Also remove model files
                self._remove_model_files(pathogen_code, fluorophore)
                
                logger.warning(f"Training data reset for {target}. Backup: {backup_path}")
                return True, backup_path
                
        except Exception as e:
            logger.error(f"Failed to reset training data: {e}")
            return False, None
    
    def get_all_pathogen_configs(self):
        """Get all pathogen ML configurations"""
        try:
            with self.get_db_connection() as conn:
                cursor = conn.execute("""
                    SELECT pathogen_code, fluorophore, ml_enabled, training_locked, 
                           min_confidence, updated_at
                    FROM ml_pathogen_config 
                    ORDER BY pathogen_code, fluorophore
                """)
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to get all pathogen configs: {e}")
            return []
    
    def get_enabled_pathogen_configs(self):
        """Get only enabled pathogen ML configurations for UI filtering"""
        try:
            with self.get_db_connection() as conn:
                cursor = conn.execute("""
                    SELECT pathogen_code, fluorophore, ml_enabled, min_confidence
                    FROM ml_pathogen_config 
                    WHERE ml_enabled = 1
                    ORDER BY pathogen_code, fluorophore
                """)
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to get enabled pathogen configs: {e}")
            return []
    
    def get_audit_log(self, limit=50):
        """Get recent audit log entries"""
        try:
            with self.get_db_connection() as conn:
                cursor = conn.execute("""
                    SELECT * FROM ml_audit_log 
                    ORDER BY timestamp DESC 
                    LIMIT ?
                """, (limit,))
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to get audit log: {e}")
            return []
    
    def _is_global_ml_enabled(self):
        """Check if ML is globally enabled"""
        value = self.get_system_config('ml_global_enabled')
        return value == 'true' if value else True
    
    def _log_audit_action(self, conn, action, pathogen_code, fluorophore, old_value, new_value, user_info):
        """Log audit trail for sensitive operations"""
        user_id = user_info.get('user_id', 'system') if user_info else 'system'
        user_ip = user_info.get('ip', 'unknown') if user_info else 'unknown'
        notes = user_info.get('notes', '') if user_info else ''
        
        conn.execute("""
            INSERT INTO ml_audit_log 
            (action, pathogen_code, fluorophore, old_value, new_value, user_id, user_ip, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (action, pathogen_code, fluorophore, old_value, new_value, user_id, user_ip, notes))
    
    def _create_training_backup(self):
        """Create backup of training data before destructive operations"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = f"ml_training_backup_{timestamp}.json"
            
            # Export current training data
            with self.get_db_connection() as conn:
                cursor = conn.execute("SELECT * FROM ml_training_data")
                data = [dict(row) for row in cursor.fetchall()]
            
            with open(backup_path, 'w') as f:
                json.dump({
                    'backup_timestamp': timestamp,
                    'training_data': data
                }, f, indent=2)
            
            return backup_path
            
        except Exception as e:
            logger.error(f"Failed to create training backup: {e}")
            return None
    
    def _remove_model_files(self, pathogen_code=None, fluorophore=None):
        """Remove trained model files"""
        try:
            if pathogen_code:
                if fluorophore:
                    pattern = f"ml_model_{pathogen_code}_{fluorophore}_*"
                else:
                    pattern = f"ml_model_{pathogen_code}_*"
            else:
                pattern = "ml_model_*"
            
            # Find and remove matching model files
            import glob
            for file_path in glob.glob(pattern):
                try:
                    os.remove(file_path)
                    logger.info(f"Removed model file: {file_path}")
                except Exception as e:
                    logger.warning(f"Failed to remove model file {file_path}: {e}")
                    
        except Exception as e:
            logger.error(f"Failed to remove model files: {e}")
    
    def populate_from_pathogen_library(self):
        """Populate ML config database from pathogen library JavaScript file"""
        try:
            # Read the pathogen library JavaScript file
            pathogen_lib_path = os.path.join('static', 'pathogen_library.js')
            if not os.path.exists(pathogen_lib_path):
                logger.warning("pathogen_library.js not found, skipping population")
                return False
            
            with open(pathogen_lib_path, 'r') as f:
                content = f.read()
            
            # Extract pathogen library data using simple parsing
            # Look for the PATHOGEN_LIBRARY object
            import re
            
            # Find the PATHOGEN_LIBRARY object
            match = re.search(r'const PATHOGEN_LIBRARY\s*=\s*{(.*?)};', content, re.DOTALL)
            if not match:
                logger.warning("Could not find PATHOGEN_LIBRARY in pathogen_library.js")
                return False
            
            # Parse the pathogen library content
            pathogen_data = {}
            lib_content = match.group(1)
            
            # Simple regex to extract pathogen entries
            pathogen_matches = re.findall(r'"([^"]+)":\s*{([^}]+)}', lib_content)
            
            for pathogen_code, fluorophore_block in pathogen_matches:
                fluorophore_matches = re.findall(r'"([^"]+)":\s*"([^"]+)"', fluorophore_block)
                pathogen_data[pathogen_code] = {}
                for fluorophore, target in fluorophore_matches:
                    pathogen_data[pathogen_code][fluorophore] = target
            
            logger.info(f"Parsed {len(pathogen_data)} pathogens from pathogen library")
            
            # Populate database
            with self.get_db_connection() as conn:
                populated_count = 0
                for pathogen_code, fluorophores in pathogen_data.items():
                    for fluorophore, target in fluorophores.items():
                        try:
                            # Insert or ignore (don't overwrite existing configs)
                            conn.execute("""
                                INSERT OR IGNORE INTO ml_pathogen_config 
                                (pathogen_code, fluorophore, ml_enabled, min_confidence) 
                                VALUES (?, ?, 1, 0.7)
                            """, (pathogen_code, fluorophore))
                            
                            if conn.total_changes > 0:
                                populated_count += 1
                                logger.debug(f"Added ML config: {pathogen_code}/{fluorophore} -> {target}")
                                
                        except Exception as e:
                            logger.warning(f"Failed to insert {pathogen_code}/{fluorophore}: {e}")
                
                conn.commit()
                logger.info(f"✅ Populated {populated_count} new ML configurations from pathogen library")
                return True
                
        except Exception as e:
            logger.error(f"Failed to populate from pathogen library: {e}")
            return False


# Global instance
ml_config_manager = MLConfigManager()
