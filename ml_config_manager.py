"""
ML Configuration Management
Handles pathogen-specific ML settings and safe data operations
Uses MySQL exclusively - NO SQLITE
"""

import pymysql
import json
import re
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
        """Populate or upsert ML config rows from static/pathogen_library.js (MySQL only).
        - Reads the canonical JS library, strips comments, parses object, and inserts missing (pathogen_code, fluorophore) pairs.
        - Idempotent: uses ON DUPLICATE KEY UPDATE to avoid duplicates; won't flip ml_enabled flags.
        """
        try:
            # Discover repository root and JS path (works in dev container and prod)
            repo_root = os.path.dirname(os.path.abspath(__file__))
            js_path = os.path.join(repo_root, 'static', 'pathogen_library.js')
            if not os.path.exists(js_path):
                # Fallback: try parent (when file layout differs)
                alt = os.path.join(os.getcwd(), 'static', 'pathogen_library.js')
                js_path = alt if os.path.exists(alt) else js_path

            library = self._load_pathogen_library(js_path)
            if not library:
                logger.warning("⚠️ PATHOGEN_LIBRARY could not be loaded; skipping auto-population.")
                return

            # Upsert all entries
            conn = self.get_db_connection()
            try:
                inserted = 0
                with conn.cursor() as cursor:
                    for pathogen_code, channels in library.items():
                        if not isinstance(channels, dict):
                            continue
                        for fluorophore, target in channels.items():
                            if not fluorophore or fluorophore == 'Unknown':
                                continue
                            try:
                                cursor.execute(
                                    """
                                    INSERT INTO ml_pathogen_config
                                        (pathogen_code, fluorophore, ml_enabled, confidence_threshold, min_training_samples, max_training_samples, auto_retrain)
                                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                                    ON DUPLICATE KEY UPDATE
                                        pathogen_code = VALUES(pathogen_code),
                                        fluorophore = VALUES(fluorophore)
                                    """,
                                    (pathogen_code, fluorophore, False, 0.70, 50, 1000, True)
                                )
                                inserted += cursor.rowcount
                            except Exception as ie:
                                # Continue on individual insert errors
                                logger.debug(f"Skip/dup for {pathogen_code}/{fluorophore}: {ie}")
                    conn.commit()
                logger.info(f"✅ ML pathogen config synced from pathogen_library.js (upserts applied)")
            finally:
                conn.close()
        except Exception as e:
            logger.warning(f"⚠️ Auto-populate from pathogen library failed (non-critical): {e}")
            # Non-fatal; UI can still function with existing rows

    def _load_pathogen_library(self, js_path: str):
        """Load PATHOGEN_LIBRARY object from a JS file by stripping comments and JSON-parsing."""
        try:
            if not js_path or not os.path.exists(js_path):
                return None
            with open(js_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Remove /* ... */ block comments
            content = re.sub(r"/\*.*?\*/", "", content, flags=re.DOTALL)
            # Remove // line comments (not robust for // inside strings; acceptable for our file)
            content = re.sub(r"(^|\s)//.*$", "", content, flags=re.MULTILINE)

            # Extract the object literal assigned to PATHOGEN_LIBRARY
            m = re.search(r"const\s+PATHOGEN_LIBRARY\s*=\s*({[\s\S]*?});", content)
            if not m:
                return None
            obj_text = m.group(1)

            # JSON parse (keys/values are already quoted in our JS)
            data = json.loads(obj_text)
            # Normalize keys (ensure strings)
            norm = {}
            for k, v in data.items():
                try:
                    norm[str(k)] = v
                except Exception:
                    norm[k] = v
            return norm
        except Exception as e:
            logger.debug(f"PATHOGEN_LIBRARY parse error: {e}")
            return None
    
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
    
    def reset_training_data(self, pathogen_code=None, fluorophore=None, user_info=None):
        """Reset ML training flags (disable) for a pathogen (and optional fluorophore).
        Returns (success: bool, backup_path: Optional[str]) to match app.py expectations.
        """
        try:
            conn = self.get_db_connection()
            try:
                with conn.cursor() as cursor:
                    # Create backup timestamp
                    backup_timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    backup_path = None  # Reserved for future file-based training backups

                    if pathogen_code:
                        if fluorophore:
                            cursor.execute(
                                """
                                UPDATE ml_pathogen_config
                                SET ml_enabled = FALSE, updated_at = CURRENT_TIMESTAMP
                                WHERE pathogen_code = %s AND fluorophore = %s
                                """,
                                (pathogen_code, fluorophore)
                            )
                            self._log_audit_action(
                                cursor, 'reset_training', pathogen_code, fluorophore,
                                None, f'Reset at {backup_timestamp}', user_info
                            )
                            target = f"{pathogen_code}/{fluorophore}"
                        else:
                            cursor.execute(
                                """
                                UPDATE ml_pathogen_config
                                SET ml_enabled = FALSE, updated_at = CURRENT_TIMESTAMP
                                WHERE pathogen_code = %s
                                """,
                                (pathogen_code,)
                            )
                            self._log_audit_action(
                                cursor, 'reset_training', pathogen_code, None,
                                None, f'Reset at {backup_timestamp}', user_info
                            )
                            target = pathogen_code
                        message = f"Training data reset for {target}"
                    else:
                        # Reset all pathogens
                        cursor.execute(
                            """
                            UPDATE ml_pathogen_config
                            SET ml_enabled = FALSE, updated_at = CURRENT_TIMESTAMP
                            """
                        )
                        self._log_audit_action(
                            cursor, 'reset_training', None, None,
                            None, f'Global reset at {backup_timestamp}', user_info
                        )
                        message = "All training data reset"

                    conn.commit()
                    logger.info(f"✅ {message}")
                    return True, backup_path

            finally:
                conn.close()

        except Exception as e:
            logger.error(f"❌ Failed to reset training data: {e}")
            return False, None
    
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

    def get_enabled_pathogen_configs(self):
        """Return all pathogen/fluorophore configs where ml_enabled is TRUE."""
        try:
            conn = self.get_db_connection()
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT * FROM ml_pathogen_config
                        WHERE ml_enabled = TRUE
                        ORDER BY pathogen_code, fluorophore
                        """
                    )
                    return cursor.fetchall()
            finally:
                conn.close()
        except Exception as e:
            logger.error(f"❌ Failed to get enabled pathogen configs: {e}")
            return []

    def backfill_audit_users_admin_or_system(self) -> dict:
        """Backfill ml_config_audit_log.user_info so UI shows 'admin' or 'system'.
        - If user_info JSON missing or empty -> set {'user_id': 'system'}
        - If user_info has any non-empty identifier -> set user_id 'admin' and preserve original in 'original_user'
        - Heuristic: if session_id/ip_address present (manually set later) treat as 'admin'; else 'system' when unknown.
        Returns a summary dict with counts changed.
        """
        summary = {"updated": 0, "skipped": 0, "errors": 0}
        try:
            conn = self.get_db_connection()
            try:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT id, user_info, session_id, ip_address FROM ml_config_audit_log ORDER BY id ASC")
                    rows = cursor.fetchall() or []
                    for row in rows:
                        try:
                            uid = None
                            original = None
                            ui_raw = row.get('user_info') if isinstance(row, dict) else row[1]
                            if ui_raw:
                                try:
                                    ui = json.loads(ui_raw) if isinstance(ui_raw, str) else (ui_raw if isinstance(ui_raw, dict) else {})
                                except Exception:
                                    ui = {}
                                # Derive existing identifier if present
                                original = ui.get('user_id') or ui.get('username') or ui.get('display_name')
                            # Heuristic based on presence of metadata
                            has_session_meta = False
                            try:
                                has_session_meta = bool(row.get('session_id') or row.get('ip_address')) if isinstance(row, dict) else bool(row[2] or row[3])
                            except Exception:
                                has_session_meta = False

                            if original:
                                # Collapse all real users to 'admin'
                                uid = 'admin'
                            elif has_session_meta:
                                uid = 'admin'
                            else:
                                uid = 'system'

                            # Build new JSON preserving original when present
                            new_info = {"user_id": uid}
                            if original and original not in ('admin', 'system'):
                                new_info['original_user'] = original

                            # Only update when changed or when user_info is not normalized
                            should_update = True
                            if ui_raw:
                                try:
                                    if isinstance(ui_raw, str):
                                        parsed = json.loads(ui_raw)
                                    elif isinstance(ui_raw, dict):
                                        parsed = ui_raw
                                    else:
                                        parsed = {}
                                    if parsed.get('user_id') in ('admin', 'system') and (original is None or parsed.get('original_user')):
                                        should_update = False
                                except Exception:
                                    should_update = True

                            if should_update:
                                cursor.execute(
                                    "UPDATE ml_config_audit_log SET user_info = %s WHERE id = %s",
                                    (json.dumps(new_info), row.get('id') if isinstance(row, dict) else row[0])
                                )
                                summary["updated"] += 1
                            else:
                                summary["skipped"] += 1
                        except Exception:
                            summary["errors"] += 1
                    conn.commit()
            finally:
                conn.close()
        except Exception as e:
            logger.error(f"❌ Backfill audit users failed: {e}")
            summary["errors"] += 1
        return summary

# For backward compatibility, create a global instance when imported
ml_config_manager = None

def get_ml_config_manager():
    """Get the global ML config manager instance"""
    global ml_config_manager
    if ml_config_manager is None:
        raise RuntimeError("❌ ML Config Manager not initialized. Call app initialization first.")
    return ml_config_manager
