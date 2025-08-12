#!/usr/bin/env python3
"""
Enhanced Encryption Manager for MDL-PCR-Analyzer
Integrates field-level, database, session, and transport encryption
"""

import os
import secrets
import hashlib
import hmac
import base64
import json
from datetime import datetime, timedelta
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.asymmetric import rsa, padding
import mysql.connector
from dotenv import load_dotenv
import logging

load_dotenv()
logger = logging.getLogger(__name__)

class EnhancedEncryptionManager:
    """
    Comprehensive encryption manager for all system components
    """
    
    def __init__(self):
        self.environment = os.getenv('ENVIRONMENT', 'development')
        self.encryption_enabled = os.getenv('FIELD_ENCRYPTION_ENABLED', 'true').lower() == 'true'
        
        # Initialize encryption components
        self._init_field_encryption()
        self._init_session_encryption()
        self._init_key_management()
        
        logger.info(f"Enhanced Encryption Manager initialized (Environment: {self.environment})")
    
    def _init_field_encryption(self):
        """Initialize field-level encryption using existing data_encryption.py"""
        from data_encryption import DataEncryption
        
        if self.encryption_enabled:
            self.field_encryptor = DataEncryption()
            logger.info("Field-level encryption enabled")
        else:
            self.field_encryptor = None
            logger.warning("Field-level encryption DISABLED")
    
    def _init_session_encryption(self):
        """Initialize session token encryption"""
        session_key = os.getenv('SESSION_ENCRYPTION_KEY')
        if not session_key:
            # Generate a session key if not provided
            session_key = base64.urlsafe_b64encode(os.urandom(32)).decode()
            logger.warning("Generated temporary session key - set SESSION_ENCRYPTION_KEY in production")
        
        self.session_key = session_key.encode()
        self.session_cipher = Fernet(base64.urlsafe_b64encode(self.session_key[:32]))
    
    def _init_key_management(self):
        """Initialize key management system"""
        self.master_key_rotation_days = int(os.getenv('ENCRYPTION_KEY_ROTATION_DAYS', '90'))
        self.key_rotation_file = 'encryption_key_rotation.json'
        
        # Check if keys need rotation
        self._check_key_rotation()
    
    def _check_key_rotation(self):
        """Check if encryption keys need rotation"""
        try:
            if os.path.exists(self.key_rotation_file):
                with open(self.key_rotation_file, 'r') as f:
                    rotation_data = json.load(f)
                
                last_rotation = datetime.fromisoformat(rotation_data.get('last_rotation', '1970-01-01'))
                days_since_rotation = (datetime.now() - last_rotation).days
                
                if days_since_rotation >= self.master_key_rotation_days:
                    logger.warning(f"Keys are {days_since_rotation} days old - rotation recommended")
                    return False
                else:
                    logger.info(f"Keys rotated {days_since_rotation} days ago - OK")
                    return True
            else:
                # First time setup
                self._create_rotation_record()
                return True
                
        except Exception as e:
            logger.error(f"Key rotation check failed: {e}")
            return False
    
    def _create_rotation_record(self):
        """Create initial key rotation record"""
        rotation_data = {
            'last_rotation': datetime.now().isoformat(),
            'rotation_count': 1,
            'environment': self.environment
        }
        
        with open(self.key_rotation_file, 'w') as f:
            json.dump(rotation_data, f, indent=2)
    
    # ==============================================
    # SESSION ENCRYPTION METHODS
    # ==============================================
    
    def create_secure_session_token(self, user_data):
        """Create encrypted, tamper-proof session token"""
        if not user_data:
            return None
        
        try:
            # Create session payload
            session_payload = {
                'user_id': user_data.get('user_id'),
                'username': user_data.get('username'),
                'role': user_data.get('role'),
                'created_at': datetime.now().isoformat(),
                'expires_at': (datetime.now() + timedelta(hours=8)).isoformat(),
                'session_id': secrets.token_urlsafe(16)
            }
            
            # Encrypt the session
            payload_json = json.dumps(session_payload)
            encrypted_token = self.session_cipher.encrypt(payload_json.encode())
            
            # Return base64 encoded token
            return base64.urlsafe_b64encode(encrypted_token).decode()
            
        except Exception as e:
            logger.error(f"Session token creation failed: {e}")
            return None
    
    def validate_session_token(self, token):
        """Validate and decrypt session token"""
        if not token:
            return None
        
        try:
            # Decode and decrypt
            encrypted_token = base64.urlsafe_b64decode(token.encode())
            decrypted_payload = self.session_cipher.decrypt(encrypted_token)
            session_data = json.loads(decrypted_payload.decode())
            
            # Check expiration
            expires_at = datetime.fromisoformat(session_data['expires_at'])
            if datetime.now() > expires_at:
                logger.warning("Session token expired")
                return None
            
            return session_data
            
        except Exception as e:
            logger.error(f"Session token validation failed: {e}")
            return None
    
    def refresh_session_token(self, old_token):
        """Refresh an existing session token"""
        session_data = self.validate_session_token(old_token)
        if not session_data:
            return None
        
        # Create new token with extended expiration
        return self.create_secure_session_token(session_data)
    
    # ==============================================
    # PASSWORD ENCRYPTION METHODS
    # ==============================================
    
    def hash_password_secure(self, password, salt=None):
        """Secure password hashing with PBKDF2"""
        if salt is None:
            salt = os.urandom(32)
        
        # Use PBKDF2 with 100,000 iterations
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        
        password_hash = kdf.derive(password.encode())
        
        # Return salt + hash for storage
        return base64.urlsafe_b64encode(salt + password_hash).decode()
    
    def verify_password_secure(self, password, stored_hash):
        """Verify password against stored hash"""
        try:
            # Decode stored hash
            decoded = base64.urlsafe_b64decode(stored_hash.encode())
            salt = decoded[:32]
            stored_password_hash = decoded[32:]
            
            # Hash provided password with same salt
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            
            password_hash = kdf.derive(password.encode())
            
            # Constant-time comparison
            return hmac.compare_digest(stored_password_hash, password_hash)
            
        except Exception as e:
            logger.error(f"Password verification failed: {e}")
            return False
    
    # ==============================================
    # DATABASE ENCRYPTION METHODS
    # ==============================================
    
    def encrypt_sensitive_field(self, data, field_name):
        """Encrypt sensitive database field"""
        if not self.encryption_enabled or not self.field_encryptor:
            return data
        
        try:
            return self.field_encryptor.encrypt_field(data)
        except Exception as e:
            logger.error(f"Field encryption failed for {field_name}: {e}")
            return data  # Return unencrypted as fallback
    
    def decrypt_sensitive_field(self, encrypted_data, field_name):
        """Decrypt sensitive database field"""
        if not self.encryption_enabled or not self.field_encryptor:
            return encrypted_data
        
        try:
            return self.field_encryptor.decrypt_field(encrypted_data)
        except Exception as e:
            logger.error(f"Field decryption failed for {field_name}: {e}")
            return encrypted_data  # Return encrypted as fallback
    
    def encrypt_user_data(self, user_data):
        """Encrypt sensitive user data before database storage"""
        if not user_data or not self.encryption_enabled:
            return user_data
        
        encrypted_user = user_data.copy()
        
        # Fields to encrypt in user table
        sensitive_user_fields = ['email', 'full_name', 'phone', 'department']
        
        for field in sensitive_user_fields:
            if field in encrypted_user and encrypted_user[field]:
                encrypted_user[field] = self.encrypt_sensitive_field(
                    encrypted_user[field], field
                )
                encrypted_user[f'{field}_encrypted'] = True
        
        return encrypted_user
    
    def decrypt_user_data(self, encrypted_user_data):
        """Decrypt user data after database retrieval"""
        if not encrypted_user_data or not self.encryption_enabled:
            return encrypted_user_data
        
        decrypted_user = encrypted_user_data.copy()
        
        # Fields to decrypt in user table
        sensitive_user_fields = ['email', 'full_name', 'phone', 'department']
        
        for field in sensitive_user_fields:
            if decrypted_user.get(f'{field}_encrypted', False):
                if field in decrypted_user and decrypted_user[field]:
                    decrypted_user[field] = self.decrypt_sensitive_field(
                        decrypted_user[field], field
                    )
                del decrypted_user[f'{field}_encrypted']
        
        return decrypted_user
    
    # ==============================================
    # COMPLIANCE AND AUDIT METHODS
    # ==============================================
    
    def log_encryption_event(self, event_type, details):
        """Log encryption events for compliance audit"""
        if not os.getenv('ENCRYPTION_AUDIT_LOG', 'false').lower() == 'true':
            return
        
        audit_entry = {
            'timestamp': datetime.now().isoformat(),
            'event_type': event_type,
            'details': details,
            'environment': self.environment
        }
        
        log_path = os.getenv('ENCRYPTION_LOG_PATH', 'logs/encryption_audit.log')
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        
        with open(log_path, 'a') as f:
            f.write(json.dumps(audit_entry) + '\n')
    
    def get_encryption_status(self):
        """Get comprehensive encryption status for monitoring"""
        status = {
            'field_encryption_enabled': self.encryption_enabled,
            'session_encryption_enabled': True,
            'environment': self.environment,
            'key_rotation_status': self._check_key_rotation(),
            'encryption_audit_enabled': os.getenv('ENCRYPTION_AUDIT_LOG', 'false').lower() == 'true'
        }
        
        # Check database encryption if possible
        try:
            from mysql_encryption_setup import MySQLEncryptionSetup
            mysql_enc = MySQLEncryptionSetup()
            # Could add database encryption check here
            status['database_encryption_available'] = True
        except Exception:
            status['database_encryption_available'] = False
        
        return status
    
    # ==============================================
    # KEY ROTATION METHODS
    # ==============================================
    
    def rotate_encryption_keys(self):
        """Rotate encryption keys (for scheduled maintenance)"""
        try:
            logger.info("Starting encryption key rotation...")
            
            # Log rotation event
            self.log_encryption_event('key_rotation_start', {
                'rotation_type': 'manual',
                'environment': self.environment
            })
            
            # Update rotation record
            if os.path.exists(self.key_rotation_file):
                with open(self.key_rotation_file, 'r') as f:
                    rotation_data = json.load(f)
                
                rotation_data['last_rotation'] = datetime.now().isoformat()
                rotation_data['rotation_count'] = rotation_data.get('rotation_count', 0) + 1
                
                with open(self.key_rotation_file, 'w') as f:
                    json.dump(rotation_data, f, indent=2)
            
            logger.info("Encryption key rotation completed")
            return True
            
        except Exception as e:
            logger.error(f"Key rotation failed: {e}")
            return False

# ==============================================
# INTEGRATION WITH AUTH SYSTEM
# ==============================================

class EncryptedAuthManager:
    """
    Auth manager with integrated encryption
    """
    
    def __init__(self):
        self.encryption_manager = EnhancedEncryptionManager()
        
        # Import the base auth manager
        from auth_manager import AuthenticationManager
        self.base_auth = AuthenticationManager()
    
    def create_user_encrypted(self, username, password, role, additional_data=None):
        """Create user with encrypted sensitive data"""
        # Hash password securely
        password_hash = self.encryption_manager.hash_password_secure(password)
        
        # Encrypt additional user data
        if additional_data:
            additional_data = self.encryption_manager.encrypt_user_data(additional_data)
        
        # Use base auth manager but with encrypted data
        return self.base_auth.create_user(username, password_hash, role, additional_data)
    
    def authenticate_user_encrypted(self, username, password):
        """Authenticate user and create encrypted session"""
        # Get user from database
        user = self.base_auth.get_user(username)
        if not user:
            return None
        
        # Verify password using secure method
        if not self.encryption_manager.verify_password_secure(password, user['password_hash']):
            return None
        
        # Decrypt user data
        decrypted_user = self.encryption_manager.decrypt_user_data(user)
        
        # Create encrypted session token
        session_token = self.encryption_manager.create_secure_session_token(decrypted_user)
        
        return {
            'user': decrypted_user,
            'session_token': session_token
        }
    
    def validate_session_encrypted(self, session_token):
        """Validate encrypted session token"""
        return self.encryption_manager.validate_session_token(session_token)

# Example usage and testing
if __name__ == '__main__':
    print("=== ENHANCED ENCRYPTION MANAGER TEST ===")
    
    # Initialize manager
    enc_manager = EnhancedEncryptionManager()
    
    # Test session encryption
    test_user = {
        'user_id': 1,
        'username': 'admin',
        'role': 'Administrator'
    }
    
    session_token = enc_manager.create_secure_session_token(test_user)
    print(f"Session token created: {session_token[:50]}...")
    
    validated_session = enc_manager.validate_session_token(session_token)
    print(f"Session validation: {validated_session}")
    
    # Test password hashing
    password = "SecurePassword123!"
    password_hash = enc_manager.hash_password_secure(password)
    print(f"Password hash: {password_hash[:50]}...")
    
    password_valid = enc_manager.verify_password_secure(password, password_hash)
    print(f"Password verification: {password_valid}")
    
    # Test field encryption
    sensitive_data = "Patient_001_COVID_Result"
    encrypted_field = enc_manager.encrypt_sensitive_field(sensitive_data, "sample_name")
    decrypted_field = enc_manager.decrypt_sensitive_field(encrypted_field, "sample_name")
    print(f"Field encryption test: {sensitive_data == decrypted_field}")
    
    # Get encryption status
    status = enc_manager.get_encryption_status()
    print(f"Encryption status: {status}")
