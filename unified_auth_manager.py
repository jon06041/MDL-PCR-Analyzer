"""
Unified Authentication Manager for MDL-PCR-Analyzer
Supports both Entra ID (Azure AD) OAuth and local database authentication
Provides fallback authentication and role-based access control
"""

import hashlib
import secrets
import datetime
import logging
from typing import Dict, List, Optional, Tuple
import mysql.connector
from mysql.connector import Error
import os
from functools import wraps
from flask import session, request, redirect, url_for, jsonify

from entra_auth import EntraAuthManager

logger = logging.getLogger(__name__)

class UnifiedAuthManager:
    """Unified authentication manager supporting Entra ID and local auth"""
    
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
            'run_basic_analysis',
            'run_ml_analysis',
            'modify_thresholds',
            'validate_results',
            'view_compliance_dashboard',
            'manage_compliance_evidence',
            'export_data',
            'view_ml_statistics',
            'provide_ml_feedback',
            'modify_ml_configuration',      # Can modify ML settings
            'pause_ml_training'            # Can pause ML training during exploration
        ],
        'research_user': [
            'view_analysis_results',
            'upload_files',
            'upload_non_standard_files',  # Can upload files without naming conventions
            'manual_file_mapping',        # Can manually specify file types and channels
            'run_basic_analysis',
            'run_ml_analysis',
            'modify_thresholds',
            'view_compliance_dashboard',
            'manage_compliance_evidence',
            'export_data',
            'view_ml_statistics',
            'provide_ml_feedback',
            'experimental_analysis',      # Access to experimental features
            'modify_ml_configuration',    # Can modify ML settings
            'pause_ml_training'          # Can pause ML training during exploration
        ],
        'compliance_officer': [
            'view_analysis_results',
            'upload_files',
            'run_basic_analysis',
            'run_ml_analysis',
            'modify_thresholds',
            'validate_results',
            'view_compliance_dashboard',
            'manage_compliance_evidence',
            'manage_compliance_requirements',
            'export_data',
            'view_ml_statistics',
            'provide_ml_feedback',
            'audit_access'
        ],
        'administrator': [
            # ALL permissions from all other roles
            'view_analysis_results',
            'upload_files',
            'upload_non_standard_files',  # Research user features
            'manual_file_mapping',        # Research user features
            'run_basic_analysis',
            'run_ml_analysis',
            'modify_thresholds',
            'validate_results',
            'view_compliance_dashboard',
            'manage_compliance_evidence',
            'manage_compliance_requirements',
            'export_data',
            'view_ml_statistics',
            'provide_ml_feedback',
            'experimental_analysis',      # Research user features
            'modify_ml_configuration',    # ML configuration access
            'pause_ml_training',          # ML training pause control
            'audit_access',              # Compliance officer features
            # EXCLUSIVE administrative permissions (ADMIN ONLY)
            'manage_users',              # User account management - ADMIN ONLY
            'system_administration',     # System configuration - ADMIN ONLY
            'database_management',       # Database backups/restore - ADMIN ONLY
            'system_reset'              # Emergency reset functionality - ADMIN ONLY
        ]
    }
    
    def __init__(self):
        self.entra_auth = EntraAuthManager()
        self.mysql_config = {
            'host': os.environ.get('MYSQL_HOST', 'localhost'),
            'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
            'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
            'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis'),
            'autocommit': True
        }
        
        # Local admin backdoor credentials (for emergency access)
        self.backdoor_enabled = os.getenv('ENABLE_BACKDOOR_AUTH', 'true').lower() == 'true'
        self.backdoor_username = os.getenv('BACKDOOR_USERNAME', 'admin')
        self.backdoor_password = os.getenv('BACKDOOR_PASSWORD', 'qpcr_admin_2025')
        
        # Session timeout configuration (configurable for dev/prod)
        self.session_timeout_hours = int(os.getenv('SESSION_TIMEOUT_HOURS', '2'))  # Default 2 hours for security
        
        # Initialize database tables
        self._initialize_auth_tables()
    
    def _initialize_auth_tables(self):
        """Initialize authentication-related database tables"""
        connection = None
        try:
            connection = mysql.connector.connect(**self.mysql_config)
            cursor = connection.cursor()
            
            # User sessions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_sessions (
                    session_id VARCHAR(255) PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    username VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    auth_method ENUM('local', 'entra_id') NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    entra_oid VARCHAR(255) NULL,
                    tenant_id VARCHAR(255) NULL,
                    expires_at TIMESTAMP NULL,
                    INDEX idx_user_id (user_id),
                    INDEX idx_username (username),
                    INDEX idx_expires_at (expires_at)
                )
            """)
            
            # Local users table (for backdoor authentication)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS local_users (
                    user_id VARCHAR(255) PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    salt VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    email VARCHAR(255),
                    display_name VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    INDEX idx_username (username)
                )
            """)
            
            # Authentication audit log
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS auth_audit_log (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) NOT NULL,
                    auth_method ENUM('local', 'entra_id') NOT NULL,
                    action ENUM('login_success', 'login_failure', 'logout', 'session_expired') NOT NULL,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    details JSON,
                    INDEX idx_username (username),
                    INDEX idx_timestamp (timestamp)
                )
            """)
            
            connection.commit()
            
            # Create default admin user if backdoor is enabled
            if self.backdoor_enabled:
                self._ensure_backdoor_user()
            
            logger.info("Authentication tables initialized successfully")
            
        except Error as e:
            logger.error(f"Error initializing auth tables: {e}")
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()
    
    def _ensure_backdoor_user(self):
        """Ensure backdoor admin user exists for emergency access"""
        connection = None
        try:
            connection = mysql.connector.connect(**self.mysql_config)
            cursor = connection.cursor()
            
            # Check if backdoor user exists
            cursor.execute("SELECT user_id FROM local_users WHERE username = %s", (self.backdoor_username,))
            if cursor.fetchone():
                logger.info("Backdoor admin user already exists")
                return
            
            # Create backdoor user
            user_id = f"local_{secrets.token_hex(16)}"
            salt = secrets.token_hex(32)
            password_hash = self._hash_password(self.backdoor_password, salt)
            
            cursor.execute("""
                INSERT INTO local_users 
                (user_id, username, password_hash, salt, role, email, display_name, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                user_id, self.backdoor_username, password_hash, salt,
                'administrator', 'admin@localhost', 'System Administrator', True
            ))
            
            connection.commit()
            logger.info(f"Created backdoor admin user: {self.backdoor_username}")
            
        except Error as e:
            logger.error(f"Error creating backdoor user: {e}")
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()
    
    def authenticate_user(self, username: str, password: str, ip_address: str = None, 
                         user_agent: str = None) -> Optional[Dict]:
        """Authenticate user with local credentials (backdoor authentication)"""
        try:
            if not self.backdoor_enabled:
                logger.warning("Local authentication attempted but backdoor is disabled")
                return None
            
            connection = mysql.connector.connect(**self.mysql_config)
            cursor = connection.cursor(dictionary=True)
            
            # Get user from local database
            cursor.execute("""
                SELECT user_id, username, password_hash, salt, role, email, display_name, is_active
                FROM local_users 
                WHERE username = %s AND is_active = TRUE
            """, (username,))
            
            user = cursor.fetchone()
            if not user:
                self._log_auth_event(username, 'local', 'login_failure', ip_address, user_agent,
                                   {'reason': 'user_not_found'})
                return None
            
            # Verify password
            if not self._verify_password(password, user['password_hash'], user['salt']):
                self._log_auth_event(username, 'local', 'login_failure', ip_address, user_agent,
                                   {'reason': 'invalid_password'})
                return None
            
            # Create session
            session_data = self._create_user_session(
                user_id=user['user_id'],
                username=user['username'],
                role=user['role'],
                auth_method='local',
                ip_address=ip_address,
                user_agent=user_agent,
                display_name=user.get('display_name', user['username']),
                email=user.get('email', '')
            )
            
            # Update last login
            cursor.execute("""
                UPDATE local_users 
                SET last_login = CURRENT_TIMESTAMP 
                WHERE user_id = %s
            """, (user['user_id'],))
            
            connection.commit()
            
            self._log_auth_event(username, 'local', 'login_success', ip_address, user_agent,
                               {'role': user['role']})
            
            logger.info(f"Local authentication successful for user: {username}")
            return session_data
            
        except Error as e:
            logger.error(f"Database error during local authentication: {e}")
            return None
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()
    
    def authenticate_with_entra(self, authorization_code: str, state: str, 
                               ip_address: str = None, user_agent: str = None) -> Optional[Dict]:
        """Authenticate user with Entra ID OAuth"""
        try:
            if not self.entra_auth.is_enabled():
                logger.error("Entra ID authentication not configured")
                return None
            
            # Exchange code for tokens
            tokens = self.entra_auth.exchange_code_for_tokens(authorization_code, state)
            if not tokens:
                return None
            
            # Validate ID token
            id_token_payload = self.entra_auth.validate_id_token(tokens['id_token'])
            if not id_token_payload:
                return None
            
            # Get user info and groups
            user_info = self.entra_auth.get_user_info(tokens['access_token'])
            if not user_info:
                return None
            
            groups = self.entra_auth.get_user_groups(tokens['access_token'])
            
            # Create user session data
            entra_user_data = self.entra_auth.create_user_session_data(
                id_token_payload, user_info, groups
            )
            
            # Create session in database
            session_data = self._create_user_session(
                user_id=entra_user_data['user_id'],
                username=entra_user_data['username'],
                role=entra_user_data['role'],
                auth_method='entra_id',
                ip_address=ip_address,
                user_agent=user_agent,
                display_name=entra_user_data['display_name'],
                email=entra_user_data['email'],
                entra_oid=entra_user_data['entra_oid'],
                tenant_id=entra_user_data['tenant_id']
            )
            
            self._log_auth_event(
                entra_user_data['username'], 'entra_id', 'login_success', 
                ip_address, user_agent,
                {'role': entra_user_data['role'], 'groups': groups}
            )
            
            logger.info(f"Entra ID authentication successful for user: {entra_user_data['username']}")
            return session_data
            
        except Exception as e:
            logger.error(f"Error during Entra ID authentication: {e}")
            return None
    
    def _create_user_session(self, user_id: str, username: str, role: str, auth_method: str,
                           ip_address: str = None, user_agent: str = None, 
                           display_name: str = None, email: str = None,
                           entra_oid: str = None, tenant_id: str = None) -> Dict:
        """Create a new user session in the database"""
        try:
            session_id = secrets.token_urlsafe(64)
            expires_at = datetime.datetime.now() + datetime.timedelta(hours=self.session_timeout_hours)
            
            connection = mysql.connector.connect(**self.mysql_config)
            cursor = connection.cursor()
            
            # Clean up expired sessions first
            cursor.execute("DELETE FROM user_sessions WHERE expires_at < NOW()")
            
            # Create new session
            cursor.execute("""
                INSERT INTO user_sessions 
                (session_id, user_id, username, role, auth_method, ip_address, user_agent, 
                 entra_oid, tenant_id, expires_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                session_id, user_id, username, role, auth_method, ip_address, user_agent,
                entra_oid, tenant_id, expires_at
            ))
            
            connection.commit()
            
            return {
                'session_id': session_id,
                'user_id': user_id,
                'username': username,
                'role': role,
                'permissions': self.PERMISSIONS.get(role, []),
                'auth_method': auth_method,
                'display_name': display_name or username,
                'email': email or '',
                'expires_at': expires_at.isoformat()
            }
            
        except Error as e:
            logger.error(f"Error creating user session: {e}")
            return None
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()
    
    def validate_session(self, session_id: str) -> Optional[Dict]:
        """Validate user session and return user data"""
        try:
            connection = mysql.connector.connect(**self.mysql_config)
            cursor = connection.cursor(dictionary=True)
            
            cursor.execute("""
                SELECT session_id, user_id, username, role, auth_method, 
                       entra_oid, tenant_id, expires_at
                FROM user_sessions 
                WHERE session_id = %s AND expires_at > NOW()
            """, (session_id,))
            
            session = cursor.fetchone()
            if not session:
                return None
            
            # Update last activity
            cursor.execute("""
                UPDATE user_sessions 
                SET last_activity = CURRENT_TIMESTAMP 
                WHERE session_id = %s
            """, (session_id,))
            
            connection.commit()
            
            return {
                'session_id': session['session_id'],
                'user_id': session['user_id'],
                'username': session['username'],
                'role': session['role'],
                'permissions': self.PERMISSIONS.get(session['role'], []),
                'auth_method': session['auth_method'],
                'expires_at': session['expires_at'].isoformat()
            }
            
        except Error as e:
            logger.error(f"Error validating session: {e}")
            return None
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()
    
    def logout_user(self, session_id: str) -> bool:
        """Logout user and cleanup session"""
        try:
            connection = mysql.connector.connect(**self.mysql_config)
            cursor = connection.cursor()
            
            # Get session info for logging
            cursor.execute("SELECT username, auth_method FROM user_sessions WHERE session_id = %s", 
                          (session_id,))
            session_info = cursor.fetchone()
            
            # Delete session
            cursor.execute("DELETE FROM user_sessions WHERE session_id = %s", (session_id,))
            connection.commit()
            
            if session_info:
                self._log_auth_event(session_info[0], session_info[1], 'logout', None, None, {})
            
            return True
            
        except Error as e:
            logger.error(f"Error during logout: {e}")
            return False
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()
    
    def _hash_password(self, password: str, salt: str) -> str:
        """Hash password with salt using PBKDF2"""
        return hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
    
    def _verify_password(self, password: str, password_hash: str, salt: str) -> bool:
        """Verify password against hash"""
        return self._hash_password(password, salt) == password_hash
    
    def _log_auth_event(self, username: str, auth_method: str, action: str, 
                       ip_address: str = None, user_agent: str = None, 
                       details: Dict = None):
        """Log authentication events for audit purposes"""
        try:
            connection = mysql.connector.connect(**self.mysql_config)
            cursor = connection.cursor()
            
            cursor.execute("""
                INSERT INTO auth_audit_log 
                (username, auth_method, action, ip_address, user_agent, details)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (username, auth_method, action, ip_address, user_agent, 
                  json.dumps(details) if details else None))
            
            connection.commit()
            
        except Error as e:
            logger.error(f"Error logging auth event: {e}")
        finally:
            if connection and connection.is_connected():
                cursor.close()
                connection.close()
    
    def require_auth(self, required_permission: str = None):
        """Decorator to require authentication and optional permission"""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                session_id = session.get('session_id')
                if not session_id:
                    if request.is_json:
                        return jsonify({'error': 'Authentication required'}), 401
                    return redirect(url_for('auth.login', next=request.url))
                
                user_data = self.validate_session(session_id)
                if not user_data:
                    session.clear()
                    if request.is_json:
                        return jsonify({'error': 'Invalid or expired session'}), 401
                    return redirect(url_for('auth.login', next=request.url))
                
                # Check permission if required
                if required_permission:
                    if required_permission not in user_data['permissions']:
                        if request.is_json:
                            return jsonify({'error': 'Insufficient permissions'}), 403
                        return redirect(url_for('index'))  # Or error page
                
                # Add user data to request context
                request.current_user = user_data
                return func(*args, **kwargs)
            
            return wrapper
        return decorator
    
    def get_entra_auth_url(self) -> Tuple[str, str]:
        """Get Entra ID authorization URL and state"""
        return self.entra_auth.get_authorization_url()
    
    def is_entra_enabled(self) -> bool:
        """Check if Entra ID authentication is enabled"""
        return self.entra_auth.is_enabled()
    
    def is_backdoor_enabled(self) -> bool:
        """Check if backdoor authentication is enabled"""
        return self.backdoor_enabled


# Import json for logging
import json
