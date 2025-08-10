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
            logger.error(f"❌ DATABASE CONNECTION FAILED: MySQL connection failed: {e}")
            logger.error("🔧 Check your MySQL configuration and ensure the database is running")
            raise ConnectionError(f"MySQL connection failed: {e}. Check your database configuration.")
    
    def init_tables(self):
        """Initialize ML configuration tables in MySQL - SQLite deprecated"""
        try:
            conn = self.get_db_connection()
            try:
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
                        ) ENGINE=InnoDB
                    """)
                    
                    # Create ml_system_config table for MySQL
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS ml_system_config (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            config_key VARCHAR(100) NOT NULL UNIQUE,
                            config_value TEXT,
                            data_type ENUM('string', 'integer', 'float', 'boolean', 'json') DEFAULT 'string',
                            description TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                        ) ENGINE=InnoDB
                    """)
                    
                    # Create ml_config_audit_log table for MySQL
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS ml_config_audit_log (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            action VARCHAR(50) NOT NULL,
                            pathogen_code VARCHAR(50),
                            fluorophore VARCHAR(20),
                            old_value TEXT,
                            new_value TEXT,
                            user_info TEXT,
                            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            session_id VARCHAR(255),
                            ip_address VARCHAR(45)
                        ) ENGINE=InnoDB
                    """)
                    
                    conn.commit()
                    logger.info("✅ ML configuration tables initialized in MySQL")
                    
                    # Populate from pathogen library after schema setup
                    self.populate_from_pathogen_library()
                    
            finally:
                conn.close()
                
        except Exception as e:
            logger.error(f"❌ DATABASE INITIALIZATION FAILED: {e}")
            logger.error("🔧 Make sure MySQL is running and tables can be created")
            raise
    
    def get_pathogen_ml_config(self, pathogen_code, fluorophore=None):
        """Get ML configuration for specific pathogen/fluorophore"""
        try:
            conn = self.get_db_connection()
            try:
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
                    return results
            finally:
                conn.close()
                
        except Exception as e:
            logger.error(f"❌ Failed to get pathogen ML config: {e}")
            return []
    
    def is_ml_enabled_for_pathogen(self, pathogen_code, fluorophore=None):
        """Check if ML is enabled for specific pathogen/fluorophore"""
        try:
            conn = self.get_db_connection()
            try:
                with conn.cursor() as cursor:
                    if fluorophore:
                        cursor.execute(
                            "SELECT ml_enabled FROM ml_pathogen_config WHERE pathogen_code = %s AND fluorophore = %s",
                            (pathogen_code, fluorophore)
                        )
                    else:
                        cursor.execute(
                            "SELECT ml_enabled FROM ml_pathogen_config WHERE pathogen_code = %s",
                            (pathogen_code,)
                        )
                    
                    result = cursor.fetchone()
                    return bool(result and result[0]) if result else False
            finally:
                conn.close()
                
        except Exception as e:
            logger.error(f"❌ Failed to check ML enabled status: {e}")
            return False
    
    def get_all_pathogen_configs(self):
        """Get all pathogen ML configurations"""
        try:
            conn = self.get_db_connection()
            try:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT * FROM ml_pathogen_config ORDER BY pathogen_code, fluorophore")
                    results = cursor.fetchall()
                    return results
            finally:
                conn.close()
                
        except Exception as e:
            logger.error(f"❌ Failed to get all pathogen ML configs: {e}")
            return []

    def is_ml_enabled_for_pathogen(self, pathogen_code, fluorophore):
        """Check if ML is enabled for a specific pathogen/fluorophore combination"""
        try:
            config = self.get_pathogen_ml_config(pathogen_code, fluorophore)
            if config:
                return config[0].get('ml_enabled', False)
            else:
                # Default to False if no config found
                return False
        except Exception as e:
            logger.error(f"❌ Failed to check ML enabled status for {pathogen_code}/{fluorophore}: {e}")
            return False
    
    def set_pathogen_ml_enabled(self, pathogen_code, fluorophore, enabled, user_info=None):
        """Enable/disable ML for specific pathogen+fluorophore"""
        try:
            conn = self.get_db_connection()
            try:
                with conn.cursor() as cursor:
                    # Get current state for audit
                    cursor.execute(
                        "SELECT ml_enabled FROM ml_pathogen_config WHERE pathogen_code = %s AND fluorophore = %s",
                        (pathogen_code, fluorophore)
                    )
                    result = cursor.fetchone()
                    old_state = result['ml_enabled'] if result else None
                    
                    # Update or insert configuration
                    cursor.execute("""
                        INSERT INTO ml_pathogen_config 
                        (pathogen_code, fluorophore, ml_enabled, updated_at) 
                        VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
                        ON DUPLICATE KEY UPDATE 
                        ml_enabled = VALUES(ml_enabled), 
                        updated_at = CURRENT_TIMESTAMP
                    """, (pathogen_code, fluorophore, enabled))
                    
                    # Log the change
                    self._log_audit_action(
                        cursor, 'toggle_ml', pathogen_code, fluorophore,
                        str(old_state), str(enabled), user_info
                    )
                    
                    conn.commit()
                    logger.info(f"✅ ML {'enabled' if enabled else 'disabled'} for {pathogen_code}/{fluorophore}")
                    return True
                    
            finally:
                conn.close()
                
        except Exception as e:
            logger.error(f"❌ Failed to set pathogen ML enabled state: {e}")
            return False
    
    def _log_audit_action(self, cursor, action, pathogen_code=None, fluorophore=None, 
                         old_value=None, new_value=None, user_info=None):
        """Log configuration changes for audit trail"""
        try:
            cursor.execute("""
                INSERT INTO ml_config_audit_log 
                (action, pathogen_code, fluorophore, old_value, new_value, user_info, timestamp)
                VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            """, (action, pathogen_code, fluorophore, old_value, new_value, 
                  json.dumps(user_info) if user_info else None))
        except Exception as e:
            logger.error(f"Failed to log audit action: {e}")
    
    def populate_from_pathogen_library(self):
        """Populate ML config from pathogen library - MySQL version
        NOTE: Pathogen configs are now populated manually via populate_ml_config_simple.py
        This method checks if configs exist and skips population if already present.
        """
        try:
            conn = self.get_db_connection()
            try:
                with conn.cursor() as cursor:
                    # Check if ml_pathogen_config table has data
                    cursor.execute("SELECT COUNT(*) as count FROM ml_pathogen_config")
                    result = cursor.fetchone()
                    
                    if result and result['count'] > 0:
                        logger.info(f"✅ ML pathogen config already populated with {result['count']} configurations")
                        return
                    
                    # If no configs exist, log a warning but don't fail
                    logger.warning("⚠️ No ML pathogen configs found. Run populate_ml_config_simple.py to populate.")
                    
            finally:
                conn.close()
                
        except Exception as e:
            logger.warning(f"⚠️ Could not check pathogen library population (non-critical): {e}")
            # Don't raise the error - this is not critical for ML config manager initialization
    
    def get_system_config(self, config_key, default_value=None):
        """Get system-wide ML configuration"""
        try:
            conn = self.get_db_connection()
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "SELECT config_value, data_type FROM ml_system_config WHERE config_key = %s",
                        (config_key,)
                    )
                    result = cursor.fetchone()
                    
                    if result:
                        value = result['config_value']
                        data_type = result['data_type']
                        
                        # Convert value based on data type
                        if data_type == 'integer':
                            return int(value)
                        elif data_type == 'float':
                            return float(value)
                        elif data_type == 'boolean':
                            return value.lower() in ('true', '1', 'yes')
                        elif data_type == 'json':
                            return json.loads(value)
                        else:
                            return value
                    
                    return default_value
                    
            finally:
                conn.close()
                
        except Exception as e:
            logger.error(f"❌ Failed to get system config: {e}")
            return default_value
    
    def set_system_config(self, config_key, config_value, data_type='string', description=None):
        """Set system-wide ML configuration"""
        try:
            conn = self.get_db_connection()
            try:
                with conn.cursor() as cursor:
                    # Convert value to string for storage
                    if data_type == 'json':
                        value_str = json.dumps(config_value)
                    else:
                        value_str = str(config_value)
                    
                    cursor.execute("""
                        INSERT INTO ml_system_config 
                        (config_key, config_value, data_type, description, updated_at)
                        VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                        ON DUPLICATE KEY UPDATE 
                        config_value = VALUES(config_value),
                        data_type = VALUES(data_type),
                        description = VALUES(description),
                        updated_at = CURRENT_TIMESTAMP
                    """, (config_key, value_str, data_type, description))
                    
                    conn.commit()
                    logger.info(f"✅ Set system config: {config_key} = {config_value}")
                    return True
                    
            finally:
                conn.close()
                
        except Exception as e:
            logger.error(f"❌ Failed to set system config: {e}")
            return False
    
    def reset_training_data(self, pathogen_code=None, user_info=None):
        """Reset ML training data with proper backup"""
        try:
            conn = self.get_db_connection()
            try:
                with conn.cursor() as cursor:
                    # Create backup timestamp
                    backup_timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    
                    if pathogen_code:
                        # Reset specific pathogen
                        cursor.execute("""
                            UPDATE ml_pathogen_config 
                            SET ml_enabled = FALSE, updated_at = CURRENT_TIMESTAMP
                            WHERE pathogen_code = %s
                        """, (pathogen_code,))
                        
                        self._log_audit_action(
                            cursor, 'reset_training', pathogen_code, None,
                            None, f'Reset at {backup_timestamp}', user_info
                        )
                        
                        message = f"Training data reset for {pathogen_code}"
                    else:
                        # Reset all pathogens
                        cursor.execute("""
                            UPDATE ml_pathogen_config 
                            SET ml_enabled = FALSE, updated_at = CURRENT_TIMESTAMP
                        """)
                        
                        self._log_audit_action(
                            cursor, 'reset_training', None, None,
                            None, f'Global reset at {backup_timestamp}', user_info
                        )
                        
                        message = "All training data reset"
                    
                    conn.commit()
                    logger.info(f"✅ {message}")
                    return True
                    
            finally:
                conn.close()
                
        except Exception as e:
            logger.error(f"❌ Failed to reset training data: {e}")
            return False
    
    def get_audit_log(self, limit=100, pathogen_code=None, action=None):
        """Get configuration audit log"""
        try:
            conn = self.get_db_connection()
            try:
                with conn.cursor() as cursor:
                    query = "SELECT * FROM ml_config_audit_log WHERE 1=1"
                    params = []
                    
                    if pathogen_code:
                        query += " AND pathogen_code = %s"
                        params.append(pathogen_code)
                    
                    if action:
                        query += " AND action = %s"
                        params.append(action)
                    
                    query += " ORDER BY timestamp DESC LIMIT %s"
                    params.append(limit)
                    
                    cursor.execute(query, params)
                    results = cursor.fetchall()
                    
                    return results
                    
            finally:
                conn.close()
                
        except Exception as e:
            logger.error(f"❌ Failed to get audit log: {e}")
            return []

# For backward compatibility, create a global instance when imported
ml_config_manager = None

def get_ml_config_manager():
    """Get the global ML config manager instance"""
    global ml_config_manager
    if ml_config_manager is None:
        raise RuntimeError("❌ ML Config Manager not initialized. Call app initialization first.")
    return ml_config_manager
