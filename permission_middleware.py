"""
Permission Middleware for MDL-PCR-Analyzer
Implements role-based access control (RBAC) with Flask decorators
Enforces permissions on API endpoints and provides frontend permission checks
"""

from functools import wraps
from flask import session, request, jsonify, redirect, url_for
import flask  # use flask.g explicitly to avoid any local shadowing issues
from unified_auth_manager import UnifiedAuthManager
import logging
import os

logger = logging.getLogger(__name__)

# Initialize auth manager
auth_manager = UnifiedAuthManager()

# ---- Temporary, env-gated open test mode (for Railway testing) ----
def _is_open_test_mode() -> bool:
    """Returns True when open test/bypass mode is enabled via env.

    Supported flags (any one):
    - RAILWAY_OPEN_TEST_ALLOW_ALL
    - OPEN_TEST_ALLOW_ALL
    - DEV_RELAXED_ADMIN_ACCESS
    - RAILWAY_OPEN_TEST_MODE (legacy)
    """
    flags = (
        'RAILWAY_OPEN_TEST_ALLOW_ALL',
        'OPEN_TEST_ALLOW_ALL',
        'DEV_RELAXED_ADMIN_ACCESS',
        'RAILWAY_OPEN_TEST_MODE',  # legacy
    )
    for key in flags:
        if os.getenv(key, '0').lower() in ('1', 'true', 'yes', 'on', 'y'):
            return True
    return False

def _is_open_test_allowed_path(path: str) -> bool:
    """Allow only narrowly-scoped endpoints for open test mode."""
    allowed_prefixes = (
        '/analyze',                    # basic analysis upload endpoint
        '/sessions/save-combined',     # save combined session after analysis
        '/api/folder-queue',           # optional: folder queue dev helpers
    )
    return any(path.startswith(p) for p in allowed_prefixes)

def _get_open_test_user():
    """Synthetic user used in open test mode with minimal permissions."""
    # Minimal set to enable uploads and viewing results
    allowed = [
        'upload_files',
        'run_basic_analysis',
        'view_analysis_results',
    ]
    # Allow override via env var (comma-separated)
    override = os.getenv('OPEN_TEST_PERMISSIONS')
    if override:
        allowed = [p.strip() for p in override.split(',') if p.strip()]
    return {
        'username': 'open-test',
        'display_name': 'Open Test User',
        'role': 'qc_technician',  # non-admin role
        'permissions': allowed,
        'auth_method': 'open_test_mode',
    }

def is_development_mode():
    """Check if the application is running in development mode"""
    return os.environ.get('FLASK_ENV', 'development') == 'development'

def get_current_user_permissions():
    """Get permissions for the current user session"""
    session_id = session.get('session_id')
    if not session_id:
        return []
    
    user_data = auth_manager.validate_session(session_id)
    if not user_data:
        session.clear()
        return []
    
    return user_data.get('permissions', [])

def get_current_user_info():
    """Get complete user info for the current session"""
    session_id = session.get('session_id')
    if not session_id:
        return None
    
    user_data = auth_manager.validate_session(session_id)
    if not user_data:
        session.clear()
        return None
    
    return user_data

def require_authentication(f):
    """Decorator to require valid authentication for any endpoint"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Open test mode: allow anonymous access for specific endpoints
        if _is_open_test_mode() and _is_open_test_allowed_path(request.path):
            flask.g.current_user = _get_open_test_user()
            logger.info(f"Open-test mode: granting anonymous access to {request.path}")
            return f(*args, **kwargs)

        session_id = session.get('session_id')
        if not session_id:
            logger.warning(f"Unauthenticated access attempt to {request.endpoint} from {request.remote_addr}")
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Authentication required', 'code': 'AUTH_REQUIRED'}), 401
            else:
                return redirect(url_for('auth.login'))

        user_data = auth_manager.validate_session(session_id)
        if not user_data:
            session.clear()
            logger.warning(f"Invalid session access attempt to {request.endpoint} from {request.remote_addr}")
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Invalid session', 'code': 'INVALID_SESSION'}), 401
            else:
                return redirect(url_for('auth.login'))

        # Store user info in Flask g for use in the request
        flask.g.current_user = user_data
        return f(*args, **kwargs)

    return decorated_function

def require_permission(permission):
    """Decorator to require specific permission for an endpoint"""
    def decorator(f):
        @wraps(f)
        @require_authentication  # First ensure authentication
        def decorated_function(*args, **kwargs):
            # If in open test mode and this endpoint is allowed, grant if permission matches synthetic user's perms
            if _is_open_test_mode() and _is_open_test_allowed_path(request.path):
                user_permissions = getattr(flask.g, 'current_user', {}).get('permissions', [])
                if permission in user_permissions:
                    logger.info(f"Open-test mode: permitting {permission} on {request.path}")
                    return f(*args, **kwargs)

            user_permissions = flask.g.current_user.get('permissions', [])
            
            if permission not in user_permissions:
                logger.warning(f"Permission denied: {flask.g.current_user['username']} attempted {permission} on {request.endpoint}")
                
                # Log to audit trail
                auth_manager._log_auth_event(
                    flask.g.current_user['username'], 
                    flask.g.current_user.get('auth_method', 'unknown'),
                    'permission_denied',
                    request.remote_addr,
                    request.headers.get('User-Agent'),
                    details={'permission': permission, 'endpoint': request.endpoint}
                )
                
                if request.is_json or request.path.startswith('/api/'):
                    return jsonify({
                        'error': 'Insufficient permissions', 
                        'code': 'PERMISSION_DENIED',
                        'required_permission': permission,
                        'user_role': flask.g.current_user['role']
                    }), 403
                else:
                    return redirect(url_for('auth.login', error='insufficient_permissions'))
            
            # Log successful permission check
            logger.info(f"Permission granted: {flask.g.current_user['username']} used {permission} on {request.endpoint}")
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator

def require_role(role):
    """Decorator to require specific role or higher for an endpoint"""
    def decorator(f):
        @wraps(f)
        @require_authentication
        def decorated_function(*args, **kwargs):
            user_role = flask.g.current_user['role']
            required_level = auth_manager.ROLES.get(role, 0)
            user_level = auth_manager.ROLES.get(user_role, 0)
            
            if user_level < required_level:
                logger.warning(f"Role denied: {flask.g.current_user['username']} ({user_role}) attempted {role} access on {request.endpoint}")
                
                # Log to audit trail
                auth_manager._log_auth_event(
                    flask.g.current_user['username'],
                    flask.g.current_user.get('auth_method', 'unknown'),
                    'role_denied',
                    request.remote_addr,
                    request.headers.get('User-Agent'),
                    details={'required_role': role, 'user_role': user_role, 'endpoint': request.endpoint}
                )
                
                if request.is_json or request.path.startswith('/api/'):
                    return jsonify({
                        'error': 'Insufficient role level',
                        'code': 'ROLE_DENIED', 
                        'required_role': role,
                        'user_role': user_role
                    }), 403
                else:
                    return redirect(url_for('auth.login', error='insufficient_role'))
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator

def admin_required(f):
    """Decorator for administrator-only endpoints"""
    return require_role('administrator')(f)

def qc_technician_required(f):
    """Decorator for QC technician level or higher"""
    return require_role('qc_technician')(f)

def compliance_officer_required(f):
    """Decorator for compliance officer level or higher"""  
    return require_role('compliance_officer')(f)

# Permission checking functions for frontend use
def check_permission(permission):
    """Check if current user has specific permission"""
    permissions = get_current_user_permissions()
    return permission in permissions

def check_role(role):
    """Check if current user has specific role or higher"""
    user_info = get_current_user_info()
    if not user_info:
        return False
    
    user_role = user_info['role']
    required_level = auth_manager.ROLES.get(role, 0)
    user_level = auth_manager.ROLES.get(user_role, 0)
    
    return user_level >= required_level

def get_permission_summary():
    """Get summary of current user's permissions and role for frontend"""
    user_info = get_current_user_info()
    if not user_info:
        return {
            'authenticated': False,
            'permissions': [],
            'role': None,
            'username': None
        }
    
    return {
        'authenticated': True,
        'permissions': user_info.get('permissions', []),
        'role': user_info['role'],
        'username': user_info['username'],
        'display_name': user_info.get('display_name', user_info['username']),
        'auth_method': user_info.get('auth_method', 'unknown')
    }

# API endpoint for frontend permission checking
def register_permission_api(app):
    """Register permission checking API endpoints"""
    
    @app.route('/api/permissions/check')
    def api_check_permissions():
        """API endpoint to check current user permissions"""
        return jsonify(get_permission_summary())
    
    @app.route('/api/permissions/validate/<permission>')
    def api_validate_permission(permission):
        """API endpoint to validate specific permission"""
        has_permission = check_permission(permission)
        current = getattr(flask.g, 'current_user', {}) or {}
        return jsonify({
            'permission': permission,
            'granted': has_permission,
            'user_role': current.get('role'),
            'username': current.get('username')
        })

# Permission constants for easy reference
class Permissions:
    # Viewing permissions
    VIEW_ANALYSIS_RESULTS = 'view_analysis_results'
    VIEW_COMPLIANCE_DASHBOARD = 'view_compliance_dashboard' 
    VIEW_ML_STATISTICS = 'view_ml_statistics'
    
    # File operations
    UPLOAD_FILES = 'upload_files'
    EXPORT_DATA = 'export_data'
    
    # Analysis permissions
    RUN_BASIC_ANALYSIS = 'run_basic_analysis'
    RUN_ML_ANALYSIS = 'run_ml_analysis'
    MODIFY_THRESHOLDS = 'modify_thresholds'
    
    # Validation permissions
    VALIDATE_RESULTS = 'validate_results'
    PROVIDE_ML_FEEDBACK = 'provide_ml_feedback'
    
    # Compliance permissions
    MANAGE_COMPLIANCE_EVIDENCE = 'manage_compliance_evidence'
    MANAGE_COMPLIANCE_REQUIREMENTS = 'manage_compliance_requirements'
    
    # Administrative permissions
    AUDIT_ACCESS = 'audit_access'
    MANAGE_USERS = 'manage_users'
    SYSTEM_ADMINISTRATION = 'system_administration'
    DATABASE_MANAGEMENT = 'database_management'

# Role constants for easy reference
class Roles:
    VIEWER = 'viewer'
    LAB_TECHNICIAN = 'lab_technician'
    QC_TECHNICIAN = 'qc_technician'
    RESEARCH_USER = 'research_user'
    COMPLIANCE_OFFICER = 'compliance_officer'
    ADMINISTRATOR = 'administrator'
