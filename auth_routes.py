"""
Authentication routes for MDL-PCR-Analyzer
Handles login, logout, and user management endpoints
"""

from flask import Blueprint, render_template, request, redirect, url_for, session, jsonify, flash
from auth_manager import AuthManager
import logging

logger = logging.getLogger(__name__)

# Create blueprint for auth routes
auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

# Initialize auth manager
auth_manager = AuthManager()

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Handle user login"""
    if request.method == 'GET':
        # Check if already logged in
        session_id = session.get('session_id')
        if session_id and auth_manager.validate_session(session_id):
            return redirect(url_for('index'))
        
        return render_template('auth/login.html')
    
    elif request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        
        if not username or not password:
            flash('Username and password are required', 'error')
            return render_template('auth/login.html')
        
        # Authenticate user
        user_data = auth_manager.authenticate_user(
            username=username,
            password=password,
            ip_address=request.remote_addr,
            user_agent=request.user_agent.string
        )
        
        if user_data:
            # Store session data
            session['session_id'] = user_data['session_id']
            session['user_id'] = user_data['user_id']
            session['username'] = user_data['username']
            session['role'] = user_data['role']
            session['permissions'] = user_data['permissions']
            
            logger.info(f"User '{username}' logged in successfully with role '{user_data['role']}'")
            
            # Redirect to intended page or home
            next_page = request.args.get('next', url_for('index'))
            return redirect(next_page)
        else:
            flash('Invalid username or password', 'error')
            return render_template('auth/login.html')

@auth_bp.route('/logout')
def logout():
    """Handle user logout"""
    session_id = session.get('session_id')
    username = session.get('username', 'Unknown')
    
    if session_id:
        auth_manager.logout_user(session_id)
        logger.info(f"User '{username}' logged out")
    
    session.clear()
    flash('You have been logged out successfully', 'info')
    return redirect(url_for('auth.login'))

@auth_bp.route('/profile')
def profile():
    """User profile page"""
    session_id = session.get('session_id')
    if not session_id:
        return redirect(url_for('auth.login'))
    
    user_data = auth_manager.validate_session(session_id)
    if not user_data:
        session.clear()
        return redirect(url_for('auth.login'))
    
    # Get full user details
    user_details = auth_manager.get_user_by_username(user_data['username'])
    
    return render_template('auth/profile.html', 
                         user=user_details, 
                         permissions=user_data['permissions'])

@auth_bp.route('/api/current-user')
def api_current_user():
    """API endpoint to get current user info"""
    session_id = session.get('session_id')
    if not session_id:
        return jsonify({'authenticated': False}), 401
    
    user_data = auth_manager.validate_session(session_id)
    if not user_data:
        return jsonify({'authenticated': False}), 401
    
    return jsonify({
        'authenticated': True,
        'username': user_data['username'],
        'role': user_data['role'],
        'permissions': user_data['permissions']
    })

@auth_bp.route('/api/check-permission/<permission>')
def api_check_permission(permission):
    """API endpoint to check if current user has specific permission"""
    session_id = session.get('session_id')
    if not session_id:
        return jsonify({'has_permission': False}), 401
    
    user_data = auth_manager.validate_session(session_id)
    if not user_data:
        return jsonify({'has_permission': False}), 401
    
    has_permission = auth_manager.has_permission(user_data['role'], permission)
    
    return jsonify({
        'has_permission': has_permission,
        'role': user_data['role']
    })

# Admin routes (require administrator role)
@auth_bp.route('/admin/users')
def admin_users():
    """Admin user management page"""
    session_id = session.get('session_id')
    if not session_id:
        return redirect(url_for('auth.login'))
    
    user_data = auth_manager.validate_session(session_id)
    if not user_data or user_data['role'] != 'administrator':
        flash('Administrator access required', 'error')
        return redirect(url_for('index'))
    
    return render_template('auth/admin_users.html')

@auth_bp.route('/admin/api/users')
def api_admin_list_users():
    """API endpoint to list all users (admin only)"""
    session_id = session.get('session_id')
    if not session_id:
        return jsonify({'error': 'Authentication required'}), 401
    
    user_data = auth_manager.validate_session(session_id)
    if not user_data or user_data['role'] != 'administrator':
        return jsonify({'error': 'Administrator access required'}), 403
    
    # TODO: Implement user listing
    return jsonify({'users': [], 'message': 'User listing not yet implemented'})

@auth_bp.route('/admin/api/create-user', methods=['POST'])
def api_admin_create_user():
    """API endpoint to create new user (admin only)"""
    session_id = session.get('session_id')
    if not session_id:
        return jsonify({'error': 'Authentication required'}), 401
    
    user_data = auth_manager.validate_session(session_id)
    if not user_data or user_data['role'] != 'administrator':
        return jsonify({'error': 'Administrator access required'}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'JSON data required'}), 400
    
    username = data.get('username', '').strip()
    password = data.get('password', '')
    role = data.get('role', '')
    email = data.get('email', '').strip()
    
    if not all([username, password, role]):
        return jsonify({'error': 'Username, password, and role are required'}), 400
    
    if role not in auth_manager.ROLES:
        return jsonify({'error': 'Invalid role'}), 400
    
    try:
        success = auth_manager.create_user(
            username=username,
            password=password,
            role=role,
            email=email if email else None,
            created_by=user_data['username']
        )
        
        if success:
            return jsonify({'message': f"User '{username}' created successfully"})
        else:
            return jsonify({'error': 'Failed to create user'}), 500
            
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/access-denied')
def access_denied():
    """Access denied page"""
    return render_template('auth/access_denied.html'), 403
