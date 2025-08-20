"""
Permission decorators for Flask routes
Provides role-based access control for sensitive endpoints
"""

from functools import wraps
from flask import session, jsonify, redirect, url_for, request
import logging
import os

logger = logging.getLogger(__name__)

def require_permission(permission):
    """Decorator to require specific permission for route access"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from unified_auth_manager import UnifiedAuthManager
            
            auth_manager = UnifiedAuthManager()
            session_id = session.get('session_id')
            
            if not session_id:
                logger.warning(f"Unauthorized access attempt to {request.endpoint}")
                if request.is_json:
                    return jsonify({'error': 'Authentication required'}), 401
                return redirect(url_for('auth.login'))
                
            user_data = auth_manager.validate_session(session_id)
            if not user_data:
                logger.warning(f"Invalid session access attempt to {request.endpoint}")
                if request.is_json:
                    return jsonify({'error': 'Invalid session'}), 401
                return redirect(url_for('auth.login'))
                
            if permission not in user_data.get('permissions', []):
                logger.warning(f"Permission denied: {user_data.get('username')} tried to access {request.endpoint} (requires {permission})")
                if request.is_json:
                    return jsonify({'error': f'Insufficient permissions. Required: {permission}'}), 403
                return jsonify({'error': f'Access denied. This feature requires {permission} permission.'}), 403
                
            # Store user info in request context for use in route
            request.current_user = user_data
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def require_any_permission(*permissions):
    """Decorator to require any one of multiple permissions"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from unified_auth_manager import UnifiedAuthManager
            
            auth_manager = UnifiedAuthManager()
            session_id = session.get('session_id')
            
            if not session_id:
                if request.is_json:
                    return jsonify({'error': 'Authentication required'}), 401
                return redirect(url_for('auth.login'))
                
            user_data = auth_manager.validate_session(session_id)
            if not user_data:
                if request.is_json:
                    return jsonify({'error': 'Invalid session'}), 401
                return redirect(url_for('auth.login'))
                
            user_permissions = user_data.get('permissions', [])
            if not any(perm in user_permissions for perm in permissions):
                logger.warning(f"Permission denied: {user_data.get('username')} tried to access {request.endpoint} (requires one of: {permissions})")
                if request.is_json:
                    return jsonify({'error': f'Insufficient permissions. Required: one of {permissions}'}), 403
                return jsonify({'error': f'Access denied. This feature requires one of: {", ".join(permissions)}'}), 403
                
            request.current_user = user_data
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def production_admin_only(f):
    """
        Decorator for routes restricted to administrators.
        Default behavior:
            - Production: require 'database_management' permission
            - Development: also require 'database_management' permission
        Optional override for local debugging:
            - If DEV_RELAXED_ADMIN_ACCESS=1, allow access without auth in development only
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
                current_env = os.getenv('ENVIRONMENT', 'development').lower()
                dev_relaxed = os.getenv('DEV_RELAXED_ADMIN_ACCESS', '0').lower() in ('1','true','yes','y','on')

                if current_env != 'production' and dev_relaxed:
                        # Explicitly relaxed access for dev only
                        logger.info(f"Development relaxed access: Allowing access to {request.endpoint}")
                        return f(*args, **kwargs)
                # Otherwise require admin permission in all environments
                return require_permission('database_management')(f)(*args, **kwargs)
            
    return decorated_function

def require_environment(env_name):
    """
    Decorator to restrict routes to specific environments (dev/staging/production)
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            current_env = os.getenv('ENVIRONMENT', 'development').lower()
            
            if current_env != env_name.lower():
                logger.warning(f"Environment access denied to {request.endpoint}: {current_env} != {env_name}")
                if request.is_json:
                    return jsonify({'error': f'Feature not available in {current_env} environment'}), 404
                return jsonify({'error': 'Feature not available in this environment'}), 404
                
            return f(*args, **kwargs)
        return decorated_function
    return decorator
