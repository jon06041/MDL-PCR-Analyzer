"""
Authentication and Authorization Manager for MDL-PCR-Analyzer
Handles user authentication, session management, and role-based access control
"""

import hashlib
import secrets
import datetime
from typing import Dict, List, Optional, Tuple
import mysql.connector
from mysql.connector import Error
import os
import logging
from functools import wraps
from flask import session, request, redirect, url_for, jsonify

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AuthManager:
    """Handles authentication and authorization for the MDL-PCR-Analyzer"""
    
    # Role hierarchy (higher number = more permissions)
    ROLES = {
        'viewer': 1,           # Read-Only Access
        'lab_technician': 2,   # Limited Operations
        'qc_technician': 3,    # Analysis + Validation
        'research_user': 3,    # Same level as QC Technician
        'compliance_officer': 4, # Full Access
        'administrator': 5     # Full System Control (Top Level)
    }
    
    # Permission mappings
    PERMISSIONS = {
        'viewer': [
            'view_analysis_results',
            'view_compliance_dashboard',
            'export_data',
            'view_ml_statistics'
        ],
        'lab_technician': [
            'view_analysis_results',
            'upload_files',
            'run_basic_analysis',
            'view_compliance_dashboard',
            'export_data'
        ],
        'qc_technician': [
            'view_analysis_results',
            'upload_files',
            'run_analysis',
            'ml_feedback',
            'threshold_adjustment',
            'view_compliance_dashboard',
            'compliance_actions',
            'export_data',
            'view_ml_statistics',
            'ml_validation'
        ],
        'research_user': [
            'view_analysis_results',
            'upload_files',
            'run_analysis',
            'ml_feedback',
            'threshold_adjustment',
            'view_compliance_dashboard',
            'compliance_actions',
            'export_data',
            'view_ml_statistics',
            'ml_validation'
        ],
        'compliance_officer': [
            'view_analysis_results',
            'upload_files',
            'run_analysis',
            'ml_feedback',
            'threshold_adjustment',
            'view_compliance_dashboard',
            'compliance_actions',
            'compliance_management',
            'export_data',
            'view_ml_statistics',
            'ml_validation',
            'audit_reports',
            'view_all_data'
        ],
        'administrator': [
            'view_analysis_results',
            'upload_files',
            'run_analysis',
            'ml_feedback',
            'threshold_adjustment',
            'view_compliance_dashboard',
            'compliance_actions',
            'compliance_management',
            'export_data',
            'view_ml_statistics',
            'ml_validation',
            'audit_reports',
            'view_all_data',
            'user_management',
            'system_configuration',
            'data_management',
            'ml_config',
            'database_backup'
        ]
    }
    
    def __init__(self, mysql_config=None):
        """Initialize AuthManager with database configuration"""
        self.mysql_config = mysql_config or self._get_default_mysql_config()
        self._ensure_auth_tables()
        self._create_default_admin()
    
    def _get_default_mysql_config(self):
        """Get default MySQL configuration from environment variables"""
        return {
            'host': os.environ.get('MYSQL_HOST', 'localhost'),
            'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
            'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
            'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis'),
            'port': int(os.environ.get('MYSQL_PORT', 3306))
        }
    
    def _get_db_connection(self):
        """Get database connection"""
        try:
            connection = mysql.connector.connect(**self.mysql_config)
            return connection
        except Error as e:
            logger.error(f"Database connection error: {e}")
            raise
    
    def _ensure_auth_tables(self):
        """Create authentication tables if they don't exist"""
        connection = None
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor()
            
            # Users table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(100) UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    salt VARCHAR(32) NOT NULL,
                    role ENUM('viewer', 'lab_technician', 'qc_technician', 'research_user', 'compliance_officer', 'administrator') NOT NULL,
                    active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP NULL,
                    failed_login_attempts INT DEFAULT 0,
                    locked_until TIMESTAMP NULL,
                    created_by VARCHAR(50),
                    entra_id VARCHAR(100) NULL,
                    UNIQUE KEY idx_username (username),
                    KEY idx_role (role),
                    KEY idx_active (active)
                )
            """)
            
            # User sessions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    session_id VARCHAR(128) UNIQUE NOT NULL,
                    user_id INT NOT NULL,
                    username VARCHAR(50) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    active BOOLEAN DEFAULT TRUE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    KEY idx_session_id (session_id),
                    KEY idx_user_id (user_id),
                    KEY idx_active (active),
                    KEY idx_expires (expires_at)
                )
            """)
            
            # Permission audit table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS permission_audit (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT,
                    username VARCHAR(50),
                    action_attempted VARCHAR(100),
                    permission_required VARCHAR(100),
                    access_granted BOOLEAN,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    session_id VARCHAR(128),
                    resource_accessed TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                    KEY idx_user_id (user_id),
                    KEY idx_timestamp (timestamp),
                    KEY idx_action (action_attempted)
                )
            """)
            
            connection.commit()
            logger.info("Authentication tables created/verified successfully")
            
        except Error as e:
            logger.error(f"Error creating auth tables: {e}")
            if connection:
                connection.rollback()
            raise
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()
    
    def _create_default_admin(self):
        """Create default administrator account for development"""
        default_username = "admin"
        default_password = "admin123"  # Development only!
        
        try:
            # Check if admin already exists
            if self.get_user_by_username(default_username):
                logger.info("Default admin user already exists")
                return
            
            # Create default admin
            success = self.create_user(
                username=default_username,
                password=default_password,
                role="administrator",
                email="admin@mdl-pcr-analyzer.com",
                created_by="system"
            )
            
            if success:
                logger.info("Default administrator account created:")
                logger.info("Username: admin")
                logger.info("Password: admin123")
                logger.info("⚠️  CHANGE THESE CREDENTIALS IN PRODUCTION!")
            
        except Exception as e:
            logger.error(f"Error creating default admin: {e}")
    
    def _hash_password(self, password: str, salt: str = None) -> Tuple[str, str]:
        """Hash password with salt"""
        if salt is None:
            salt = secrets.token_hex(16)
        
        password_hash = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000  # iterations
        )
        
        return password_hash.hex(), salt
    
    def _verify_password(self, password: str, password_hash: str, salt: str) -> bool:
        """Verify password against hash"""
        computed_hash, _ = self._hash_password(password, salt)
        return secrets.compare_digest(computed_hash, password_hash)
    
    def create_user(self, username: str, password: str, role: str, email: str = None, created_by: str = None) -> bool:
        """Create a new user"""
        if role not in self.ROLES:
            raise ValueError(f"Invalid role: {role}")
        
        connection = None
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor()
            
            # Hash password
            password_hash, salt = self._hash_password(password)
            
            cursor.execute("""
                INSERT INTO users (username, email, password_hash, salt, role, created_by)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (username, email, password_hash, salt, role, created_by))
            
            connection.commit()
            logger.info(f"User '{username}' created with role '{role}'")
            return True
            
        except Error as e:
            logger.error(f"Error creating user: {e}")
            if connection:
                connection.rollback()
            return False
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()
    
    def authenticate_user(self, username: str, password: str, ip_address: str = None, user_agent: str = None) -> Optional[Dict]:
        """Authenticate user and create session"""
        connection = None
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor(dictionary=True)
            
            # Get user
            cursor.execute("""
                SELECT id, username, password_hash, salt, role, active, failed_login_attempts, locked_until
                FROM users 
                WHERE username = %s
            """, (username,))
            
            user = cursor.fetchone()
            
            if not user:
                self._log_permission_audit(None, username, "login", "valid_user", False, ip_address, user_agent)
                return None
            
            # Check if account is locked
            if user['locked_until'] and user['locked_until'] > datetime.datetime.now():
                self._log_permission_audit(user['id'], username, "login", "account_not_locked", False, ip_address, user_agent)
                return None
            
            # Check if account is active
            if not user['active']:
                self._log_permission_audit(user['id'], username, "login", "active_account", False, ip_address, user_agent)
                return None
            
            # Verify password
            if not self._verify_password(password, user['password_hash'], user['salt']):
                # Increment failed attempts
                cursor.execute("""
                    UPDATE users 
                    SET failed_login_attempts = failed_login_attempts + 1,
                        locked_until = CASE 
                            WHEN failed_login_attempts >= 4 THEN DATE_ADD(NOW(), INTERVAL 30 MINUTE)
                            ELSE locked_until
                        END
                    WHERE id = %s
                """, (user['id'],))
                connection.commit()
                
                self._log_permission_audit(user['id'], username, "login", "valid_password", False, ip_address, user_agent)
                return None
            
            # Reset failed attempts on successful login
            cursor.execute("""
                UPDATE users 
                SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW()
                WHERE id = %s
            """, (user['id'],))
            
            # Create session
            session_id = secrets.token_urlsafe(64)
            expires_at = datetime.datetime.now() + datetime.timedelta(hours=8)  # 8 hour sessions
            
            cursor.execute("""
                INSERT INTO user_sessions (session_id, user_id, username, role, ip_address, user_agent, expires_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (session_id, user['id'], username, user['role'], ip_address, user_agent, expires_at))
            
            connection.commit()
            
            self._log_permission_audit(user['id'], username, "login", "successful_login", True, ip_address, user_agent)
            
            return {
                'user_id': user['id'],
                'username': username,
                'role': user['role'],
                'session_id': session_id,
                'expires_at': expires_at,
                'permissions': self.PERMISSIONS.get(user['role'], [])
            }
            
        except Error as e:
            logger.error(f"Authentication error: {e}")
            return None
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()
    
    def get_user_by_username(self, username: str) -> Optional[Dict]:
        """Get user by username"""
        connection = None
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor(dictionary=True)
            
            cursor.execute("""
                SELECT id, username, email, role, active, created_at, last_login
                FROM users 
                WHERE username = %s
            """, (username,))
            
            return cursor.fetchone()
            
        except Error as e:
            logger.error(f"Error getting user: {e}")
            return None
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()
    
    def validate_session(self, session_id: str) -> Optional[Dict]:
        """Validate session and return user info"""
        connection = None
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor(dictionary=True)
            
            cursor.execute("""
                SELECT s.user_id, s.username, s.role, s.expires_at, u.active
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.session_id = %s AND s.active = TRUE AND s.expires_at > NOW() AND u.active = TRUE
            """, (session_id,))
            
            session_data = cursor.fetchone()
            
            if session_data:
                # Update last activity
                cursor.execute("""
                    UPDATE user_sessions 
                    SET last_activity = NOW() 
                    WHERE session_id = %s
                """, (session_id,))
                connection.commit()
                
                return {
                    'user_id': session_data['user_id'],
                    'username': session_data['username'],
                    'role': session_data['role'],
                    'permissions': self.PERMISSIONS.get(session_data['role'], [])
                }
            
            return None
            
        except Error as e:
            logger.error(f"Session validation error: {e}")
            return None
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()
    
    def logout_user(self, session_id: str) -> bool:
        """Logout user by deactivating session"""
        connection = None
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor()
            
            cursor.execute("""
                UPDATE user_sessions 
                SET active = FALSE 
                WHERE session_id = %s
            """, (session_id,))
            
            connection.commit()
            return cursor.rowcount > 0
            
        except Error as e:
            logger.error(f"Logout error: {e}")
            return False
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()
    
    def has_permission(self, user_role: str, required_permission: str) -> bool:
        """Check if user role has required permission"""
        user_permissions = self.PERMISSIONS.get(user_role, [])
        return required_permission in user_permissions
    
    # Public methods for testing and evidence generation
    def hash_password(self, password: str) -> str:
        """Public method to hash password for testing purposes"""
        password_hash, salt = self._hash_password(password)
        return f"{password_hash}:{salt}"
    
    def verify_password(self, password: str, stored_hash: str) -> bool:
        """Public method to verify password for testing purposes"""
        if ':' in stored_hash:
            password_hash, salt = stored_hash.split(':', 1)
            return self._verify_password(password, password_hash, salt)
        return False
    
    def _log_permission_audit(self, user_id: int, username: str, action: str, permission: str, 
                            granted: bool, ip_address: str = None, user_agent: str = None, 
                            session_id: str = None, resource: str = None):
        """Log permission audit event"""
        connection = None
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor()
            
            cursor.execute("""
                INSERT INTO permission_audit 
                (user_id, username, action_attempted, permission_required, access_granted, 
                 ip_address, user_agent, session_id, resource_accessed)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (user_id, username, action, permission, granted, ip_address, user_agent, session_id, resource))
            
            connection.commit()
            
        except Error as e:
            logger.error(f"Audit logging error: {e}")
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()

# Flask decorators for authentication
def require_auth(permission_required=None):
    """Decorator to require authentication and optionally specific permission"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            session_id = session.get('session_id')
            
            if not session_id:
                if request.is_json:
                    return jsonify({'error': 'Authentication required'}), 401
                return redirect(url_for('login'))
            
            # Initialize auth manager (this would be better injected)
            auth_manager = AuthManager()
            user_data = auth_manager.validate_session(session_id)
            
            if not user_data:
                session.clear()
                if request.is_json:
                    return jsonify({'error': 'Session expired'}), 401
                return redirect(url_for('login'))
            
            # Check permission if required
            if permission_required:
                if not auth_manager.has_permission(user_data['role'], permission_required):
                    auth_manager._log_permission_audit(
                        user_data['user_id'], 
                        user_data['username'], 
                        f.__name__, 
                        permission_required, 
                        False,
                        request.remote_addr,
                        request.user_agent.string,
                        session_id,
                        request.url
                    )
                    if request.is_json:
                        return jsonify({'error': 'Insufficient permissions'}), 403
                    return redirect(url_for('access_denied'))
            
            # Add user data to request context
            request.current_user = user_data
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


def require_role(min_role_level):
    """Decorator to require minimum role level"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(request, 'current_user'):
                return jsonify({'error': 'Authentication required'}), 401
            
            auth_manager = AuthManager()
            user_role_level = auth_manager.ROLES.get(request.current_user['role'], 0)
            
            if user_role_level < min_role_level:
                return jsonify({'error': 'Insufficient role level'}), 403
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator
