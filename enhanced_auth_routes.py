"""
Enhanced Authentication Routes for MDL-PCR-Analyzer
Supports both Entra ID (Azure AD) OAuth and local database authentication
Provides seamless authentication experience with fallback options
"""

from flask import Blueprint, render_template, request, redirect, url_for, session, jsonify, flash
from unified_auth_manager import UnifiedAuthManager
import logging
import secrets

logger = logging.getLogger(__name__)

# Create blueprint for enhanced auth routes
enhanced_auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

# Initialize unified auth manager
auth_manager = UnifiedAuthManager()

@enhanced_auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Enhanced login page with Entra ID and local authentication options"""
    # Check if already logged in
    session_id = session.get('session_id')
    if session_id and auth_manager.validate_session(session_id):
        return redirect(url_for('index'))
    
    if request.method == 'GET':
        # Prepare Entra ID authentication if enabled
        entra_enabled = auth_manager.is_entra_enabled()
        backdoor_enabled = auth_manager.is_backdoor_enabled()
        
        entra_auth_url = None
        entra_state = None
        
        if entra_enabled:
            entra_auth_url, entra_state = auth_manager.get_entra_auth_url()
            session['entra_state'] = entra_state
        
        return render_template('auth/enhanced_login.html', 
                             entra_enabled=entra_enabled,
                             backdoor_enabled=backdoor_enabled,
                             entra_auth_url=entra_auth_url)
    
    elif request.method == 'POST':
        # Handle local authentication (backdoor)
        return _handle_local_login()

@enhanced_auth_bp.route('/callback')
def entra_callback():
    """Handle Entra ID OAuth callback"""
    try:
        # Get authorization code and state
        authorization_code = request.args.get('code')
        returned_state = request.args.get('state')
        error = request.args.get('error')
        
        if error:
            logger.error(f"Entra ID OAuth error: {error}")
            flash(f'Authentication error: {error}', 'error')
            return redirect(url_for('auth.login'))
        
        if not authorization_code:
            logger.error("No authorization code received from Entra ID")
            flash('Authentication failed: No authorization code received', 'error')
            return redirect(url_for('auth.login'))
        
        # Verify state to prevent CSRF attacks
        expected_state = session.pop('entra_state', None)
        if not expected_state or returned_state != expected_state:
            logger.error("Invalid or missing state parameter")
            flash('Authentication failed: Invalid state parameter', 'error')
            return redirect(url_for('auth.login'))
        
        # Authenticate with Entra ID
        user_data = auth_manager.authenticate_with_entra(
            authorization_code=authorization_code,
            state=returned_state,
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
            session['auth_method'] = user_data['auth_method']
            session['display_name'] = user_data['display_name']
            session['email'] = user_data['email']
            
            logger.info(f"Entra ID authentication successful for user: {user_data['username']}")
            flash(f"Welcome, {user_data['display_name']}!", 'success')
            
            # Redirect to intended page or home
            next_page = request.args.get('next', url_for('index'))
            return redirect(next_page)
        else:
            logger.error("Entra ID authentication failed")
            flash('Authentication failed. Please try again or contact your administrator.', 'error')
            return redirect(url_for('auth.login'))
            
    except Exception as e:
        logger.error(f"Unexpected error during Entra ID callback: {e}")
        flash('An unexpected error occurred during authentication.', 'error')
        return redirect(url_for('auth.login'))

def _handle_local_login():
    """Handle local database authentication (backdoor)"""
    if not auth_manager.is_backdoor_enabled():
        flash('Local authentication is not available.', 'error')
        return redirect(url_for('auth.login'))
    
    username = request.form.get('username', '').strip()
    password = request.form.get('password', '')
    
    if not username or not password:
        flash('Username and password are required', 'error')
        return redirect(url_for('auth.login'))
    
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
        session['auth_method'] = user_data['auth_method']
        session['display_name'] = user_data['display_name']
        session['email'] = user_data['email']
        
        logger.info(f"Local authentication successful for user: {username}")
        flash(f"Welcome back, {user_data['display_name']}!", 'success')
        
        # Redirect to intended page or home
        next_page = request.args.get('next', url_for('index'))
        return redirect(next_page)
    else:
        flash('Invalid username or password', 'error')
        return redirect(url_for('auth.login'))

@enhanced_auth_bp.route('/logout')
def logout():
    """Handle user logout for both authentication methods"""
    session_id = session.get('session_id')
    username = session.get('username', 'Unknown')
    auth_method = session.get('auth_method', 'unknown')
    
    if session_id:
        auth_manager.logout_user(session_id)
        logger.info(f"User '{username}' logged out (auth method: {auth_method})")
    
    session.clear()
    flash('You have been logged out successfully', 'info')
    return redirect(url_for('auth.login'))

@enhanced_auth_bp.route('/profile')
def profile():
    """Enhanced user profile page"""
    session_id = session.get('session_id')
    if not session_id:
        return redirect(url_for('auth.login'))
    
    user_data = auth_manager.validate_session(session_id)
    if not user_data:
        session.clear()
        return redirect(url_for('auth.login'))
    
    # Enhanced user profile data
    profile_data = {
        'username': user_data['username'],
        'role': user_data['role'],
        'permissions': user_data['permissions'],
        'auth_method': user_data['auth_method'],
        'display_name': session.get('display_name', user_data['username']),
        'email': session.get('email', ''),
        'session_expires': user_data['expires_at']
    }
    
    return render_template('auth/enhanced_profile.html', user=profile_data)

@enhanced_auth_bp.route('/api/current-user')
def api_current_user():
    """Enhanced API endpoint to get current user info"""
    session_id = session.get('session_id')
    if not session_id:
        return jsonify({'authenticated': False}), 401
    
    user_data = auth_manager.validate_session(session_id)
    if not user_data:
        session.clear()
        return jsonify({'authenticated': False}), 401
    
    return jsonify({
        'authenticated': True,
        'user': {
            'username': user_data['username'],
            'role': user_data['role'],
            'permissions': user_data['permissions'],
            'auth_method': user_data['auth_method'],
            'display_name': session.get('display_name', user_data['username']),
            'email': session.get('email', ''),
            'session_expires': user_data['expires_at']
        }
    })

@enhanced_auth_bp.route('/api/auth-status')
def api_auth_status():
    """API endpoint to check authentication system status"""
    return jsonify({
        'entra_enabled': auth_manager.is_entra_enabled(),
        'backdoor_enabled': auth_manager.is_backdoor_enabled(),
        'auth_methods': {
            'entra_id': auth_manager.is_entra_enabled(),
            'local': auth_manager.is_backdoor_enabled()
        }
    })

@enhanced_auth_bp.route('/switch-auth')
def switch_auth():
    """Allow switching between authentication methods"""
    current_method = request.args.get('current', 'entra')
    
    if current_method == 'entra' and auth_manager.is_backdoor_enabled():
        flash('Switching to local authentication mode', 'info')
        return redirect(url_for('auth.login') + '?mode=local')
    elif current_method == 'local' and auth_manager.is_entra_enabled():
        flash('Switching to Entra ID authentication', 'info')
        return redirect(url_for('auth.login') + '?mode=entra')
    else:
        flash('Authentication method not available', 'warning')
        return redirect(url_for('auth.login'))

# Authentication decorator for easy use in routes
def require_auth(permission=None):
    """Decorator to require authentication and optional permission"""
    return auth_manager.require_auth(permission)

# Export commonly used functions
__all__ = ['enhanced_auth_bp', 'require_auth', 'auth_manager']
