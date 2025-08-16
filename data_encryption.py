#!/usr/bin/env python3
"""
Data Encryption Module for MDL-PCR-Analyzer
Provides field-level encryption for sensitive patient and test data
"""

import os
import base64
import json
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import logging

logger = logging.getLogger(__name__)

class FieldEncryption:
    """Simplified field encryption class for evidence testing"""
    
    def __init__(self):
        """Initialize with a default key for testing"""
        self.key = Fernet.generate_key()
        self.cipher = Fernet(self.key)
    
    def encrypt_field(self, data):
        """Encrypt a field value"""
        if isinstance(data, str):
            data = data.encode()
        return self.cipher.encrypt(data)
    
    def decrypt_field(self, encrypted_data):
        """Decrypt a field value"""
        decrypted = self.cipher.decrypt(encrypted_data)
        return decrypted.decode()

class DataEncryption:
    def __init__(self, password=None):
        """
        Initialize encryption with key derived from password or environment
        """
        if password is None:
            password = os.getenv('ENCRYPTION_PASSWORD', 'default_dev_password_change_in_production')
        
        # Derive key from password using PBKDF2
        salt = os.getenv('ENCRYPTION_SALT', 'mdl_pcr_salt_2025').encode()
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        self.cipher_suite = Fernet(key)
        
    def encrypt_field(self, data):
        """Encrypt a single data field"""
        if data is None or data == '':
            return None
        
        try:
            # Convert to string and encrypt
            data_str = json.dumps(data) if not isinstance(data, str) else data
            encrypted_bytes = self.cipher_suite.encrypt(data_str.encode())
            return base64.urlsafe_b64encode(encrypted_bytes).decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise
    
    def decrypt_field(self, encrypted_data):
        """Decrypt a single data field"""
        if encrypted_data is None or encrypted_data == '':
            return None
            
        try:
            # Decode and decrypt
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted_bytes = self.cipher_suite.decrypt(encrypted_bytes)
            decrypted_str = decrypted_bytes.decode()
            
            # Try to parse as JSON, fallback to string
            try:
                return json.loads(decrypted_str)
            except json.JSONDecodeError:
                return decrypted_str
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise
    
    def encrypt_well_data(self, well_data):
        """Encrypt sensitive fields in well data"""
        if not well_data:
            return well_data
            
        encrypted_data = well_data.copy()
        
        # Fields that should be encrypted for privacy/compliance
        sensitive_fields = [
            'sample_name',           # Patient identifier
            'raw_rfu',              # Raw test data
            'raw_cycles',           # Raw test data
            'curve_classification', # Test results
            'cqj',                  # Quantification results
            'calcj',                # Calculated results
            'fit_parameters',       # Analysis parameters
            'anomalies',            # Test anomalies
            'thresholds'            # Test thresholds
        ]
        
        for field in sensitive_fields:
            if field in encrypted_data and encrypted_data[field] is not None:
                encrypted_data[field] = self.encrypt_field(encrypted_data[field])
                encrypted_data[f'{field}_encrypted'] = True
        
        return encrypted_data
    
    def decrypt_well_data(self, encrypted_well_data):
        """Decrypt sensitive fields in well data"""
        if not encrypted_well_data:
            return encrypted_well_data
            
        decrypted_data = encrypted_well_data.copy()
        
        # Fields that should be decrypted
        sensitive_fields = [
            'sample_name',
            'raw_rfu',
            'raw_cycles', 
            'curve_classification',
            'cqj',
            'calcj',
            'fit_parameters',
            'anomalies',
            'thresholds'
        ]
        
        for field in sensitive_fields:
            if f'{field}_encrypted' in decrypted_data and decrypted_data.get(f'{field}_encrypted'):
                if field in decrypted_data and decrypted_data[field] is not None:
                    decrypted_data[field] = self.decrypt_field(decrypted_data[field])
                    # Remove encryption flag
                    del decrypted_data[f'{field}_encrypted']
        
        return decrypted_data

class EncryptedWellResultsManager:
    """
    Manager for encrypted well results database operations
    """
    def __init__(self, db_connection, encryption_enabled=True):
        self.db = db_connection
        self.encryption_enabled = encryption_enabled
        self.encryptor = DataEncryption() if encryption_enabled else None
    
    def insert_well_result(self, well_data):
        """Insert well result with encryption"""
        if self.encryption_enabled and self.encryptor:
            encrypted_data = self.encryptor.encrypt_well_data(well_data)
        else:
            encrypted_data = well_data
            
        # Standard database insert
        cursor = self.db.cursor()
        # ... database insert logic with encrypted_data
        
    def get_well_result(self, well_id):
        """Retrieve and decrypt well result"""
        cursor = self.db.cursor()
        # ... database select logic
        raw_data = cursor.fetchone()
        
        if raw_data and self.encryption_enabled and self.encryptor:
            return self.encryptor.decrypt_well_data(raw_data)
        return raw_data

def create_encrypted_backup_manager():
    """
    Enhanced backup manager with encryption support
    """
    class EncryptedBackupManager:
        def __init__(self):
            from mysql_backup_manager import MySQLBackupManager
            self.base_manager = MySQLBackupManager()
            self.encryptor = DataEncryption()
            
        def create_encrypted_backup(self, backup_type='manual', description=''):
            """Create encrypted database backup"""
            # Create standard backup first
            backup_path, metadata = self.base_manager.create_backup(backup_type, description)
            
            if not backup_path:
                return None, None
                
            # Encrypt the backup file
            try:
                encrypted_path = f"{backup_path}.encrypted"
                
                with open(backup_path, 'rb') as infile:
                    data = infile.read()
                    encrypted_data = self.encryptor.cipher_suite.encrypt(data)
                    
                with open(encrypted_path, 'wb') as outfile:
                    outfile.write(encrypted_data)
                
                # Remove unencrypted backup
                os.remove(backup_path)
                
                # Update metadata
                metadata['encrypted'] = True
                metadata['encryption_method'] = 'Fernet_AES256'
                metadata['backup_size'] = os.path.getsize(encrypted_path)
                
                # Update metadata file
                metadata_path = backup_path.replace('.sql.gz', '.json')
                with open(metadata_path, 'w') as f:
                    json.dump(metadata, f, indent=2)
                
                logger.info(f"Encrypted backup created: {encrypted_path}")
                return encrypted_path, metadata
                
            except Exception as e:
                logger.error(f"Backup encryption failed: {e}")
                return backup_path, metadata  # Return unencrypted backup as fallback
        
        def restore_encrypted_backup(self, encrypted_backup_path):
            """Restore from encrypted backup"""
            try:
                # Decrypt backup first
                decrypted_path = encrypted_backup_path.replace('.encrypted', '')
                
                with open(encrypted_backup_path, 'rb') as infile:
                    encrypted_data = infile.read()
                    decrypted_data = self.encryptor.cipher_suite.decrypt(encrypted_data)
                    
                with open(decrypted_path, 'wb') as outfile:
                    outfile.write(decrypted_data)
                
                # Use standard restore process
                result = self.base_manager.restore_backup(decrypted_path)
                
                # Clean up decrypted file
                os.remove(decrypted_path)
                
                return result
                
            except Exception as e:
                logger.error(f"Encrypted backup restore failed: {e}")
                return False
    
    return EncryptedBackupManager()

# Example usage and testing
if __name__ == '__main__':
    # Test encryption/decryption
    encryptor = DataEncryption()
    
    # Test data
    test_data = {
        'sample_name': 'Patient_001_H1N1',
        'raw_rfu': [50.2, 51.1, 52.3, 55.8, 62.1, 70.3, 83.7, 105.8],
        'curve_classification': {'class': 'POSITIVE', 'confidence': 0.95},
        'cqj': 24.7
    }
    
    print("=== ENCRYPTION TEST ===")
    print(f"Original: {test_data}")
    
    # Encrypt
    encrypted = encryptor.encrypt_well_data(test_data)
    print(f"Encrypted: {encrypted}")
    
    # Decrypt
    decrypted = encryptor.decrypt_well_data(encrypted)
    print(f"Decrypted: {decrypted}")
    
    # Verify
    print(f"Match: {test_data == decrypted}")
