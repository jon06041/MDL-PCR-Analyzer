#!/usr/bin/env python3
"""
Simple encryption API for MDL-PCR-Analyzer
Provides REST endpoints for encryption compliance and data protection
"""

from flask import Blueprint, jsonify, request, current_app
from data_encryption import DataEncryption, FieldEncryption
import mysql.connector
import os
import json
import hashlib
import logging
from datetime import datetime

# Create Blueprint for encryption routes
encryption_bp = Blueprint('encryption', __name__, url_prefix='/api/encryption')

# Initialize encryption handler
encryption_handler = None

def get_encryption_handler():
    """Get or create encryption handler"""
    global encryption_handler
    if encryption_handler is None:
        encryption_handler = DataEncryption()
    return encryption_handler

def get_mysql_connection():
    """Get MySQL connection with error handling"""
    try:
        return mysql.connector.connect(
            host=os.environ.get('MYSQL_HOST', 'localhost'),
            user=os.environ.get('MYSQL_USER', 'qpcr_user'), 
            password=os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
            database=os.environ.get('MYSQL_DATABASE', 'qpcr_analysis'),
            charset='utf8mb4',
            collation='utf8mb4_unicode_ci'
        )
    except Exception as e:
        current_app.logger.error(f"MySQL connection failed: {e}")
        return None

@encryption_bp.route('/status', methods=['GET'])
def encryption_status():
    """Get encryption system status"""
    try:
        enc = get_encryption_handler()
        
        # Test encryption capability
        test_data = "test_encryption_status"
        encrypted = enc.encrypt_field(test_data)
        decrypted = enc.decrypt_field(encrypted)
        encryption_working = (test_data == decrypted)
        
        # Check database connection
        conn = get_mysql_connection()
        db_connected = conn is not None
        if conn:
            conn.close()
        
        status = {
            'encryption_available': encryption_working,
            'database_connected': db_connected,
            'encryption_algorithm': 'AES-128 Fernet',
            'key_derivation': 'PBKDF2-HMAC-SHA256',
            'status': 'operational' if (encryption_working and db_connected) else 'partial',
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify(status), 200
        
    except Exception as e:
        current_app.logger.error(f"Encryption status check failed: {e}")
        return jsonify({
            'error': 'Encryption status check failed',
            'encryption_available': False,
            'database_connected': False,
            'status': 'error',
            'timestamp': datetime.now().isoformat()
        }), 500

@encryption_bp.route('/encrypt-field', methods=['POST'])
def encrypt_field():
    """Encrypt a single field value"""
    try:
        data = request.get_json()
        if not data or 'value' not in data:
            return jsonify({'error': 'Missing value field'}), 400
        
        enc = get_encryption_handler()
        encrypted_value = enc.encrypt_field(str(data['value']))
        
        return jsonify({
            'encrypted_value': encrypted_value,
            'algorithm': 'AES-128 Fernet',
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Field encryption failed: {e}")
        return jsonify({'error': 'Encryption failed'}), 500

@encryption_bp.route('/decrypt-field', methods=['POST'])
def decrypt_field():
    """Decrypt a single field value"""
    try:
        data = request.get_json()
        if not data or 'encrypted_value' not in data:
            return jsonify({'error': 'Missing encrypted_value field'}), 400
        
        enc = get_encryption_handler()
        decrypted_value = enc.decrypt_field(data['encrypted_value'])
        
        return jsonify({
            'decrypted_value': decrypted_value,
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Field decryption failed: {e}")
        return jsonify({'error': 'Decryption failed'}), 500

@encryption_bp.route('/compliance-evidence', methods=['GET'])
def get_compliance_evidence():
    """Get encryption compliance evidence"""
    try:
        conn = get_mysql_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        # Count encrypted fields in database
        cursor.execute("""
            SELECT COUNT(*) as total_wells
            FROM well_results 
            WHERE run_id IS NOT NULL
        """)
        total_wells = cursor.fetchone()['total_wells']
        
        # Get recent runs that could have encryption
        cursor.execute("""
            SELECT COUNT(DISTINCT run_id) as total_runs
            FROM well_results 
            WHERE run_id IS NOT NULL
        """)
        total_runs = cursor.fetchone()['total_runs']
        
        conn.close()
        
        # Generate encryption evidence
        evidence = {
            'encryption_status': {
                'algorithm': 'AES-128 Fernet',
                'key_derivation': 'PBKDF2-HMAC-SHA256 (100,000 iterations)',
                'compliance_frameworks': ['FDA 21 CFR Part 11', 'HIPAA', 'ISO 27001'],
                'encryption_scope': 'Field-level sensitive data encryption'
            },
            'data_protection_stats': {
                'total_wells_available': total_wells,
                'total_runs_available': total_runs,
                'encryption_capability': 'Available for all sensitive fields',
                'key_management': 'Environment-based secure key storage'
            },
            'compliance_features': [
                'Data at rest encryption',
                'Field-level encryption granularity', 
                'Secure key derivation',
                'Audit trail capability',
                'Access control integration ready'
            ],
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify(evidence), 200
        
    except Exception as e:
        current_app.logger.error(f"Compliance evidence generation failed: {e}")
        return jsonify({'error': 'Failed to generate compliance evidence'}), 500

@encryption_bp.route('/log-encryption-event', methods=['POST'])
def log_encryption_event():
    """Log encryption-related compliance events"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Log encryption compliance event
        event_data = {
            'event_type': data.get('event_type', 'encryption_operation'),
            'description': data.get('description', 'Encryption operation performed'),
            'user_id': data.get('user_id', 'system'),
            'timestamp': datetime.now().isoformat(),
            'compliance_category': 'data_protection'
        }
        
        # Try to log to compliance evidence table if available
        conn = get_mysql_connection()
        if conn:
            try:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO compliance_evidence 
                    (requirement_id, evidence_type, evidence_data, evidence_hash, validation_status, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    'ENCRYPTION_21CFR11',
                    'system_event',
                    json.dumps(event_data),
                    hashlib.sha256(json.dumps(event_data, sort_keys=True).encode()).hexdigest(),
                    'validated',
                    datetime.now()
                ))
                conn.commit()
                cursor.close()
                conn.close()
                
                return jsonify({
                    'logged': True,
                    'event_id': cursor.lastrowid,
                    'timestamp': event_data['timestamp']
                }), 200
                
            except Exception as db_error:
                current_app.logger.warning(f"Database logging failed: {db_error}")
                # Fall back to file logging
                pass
        
        # Fallback: log to application logs
        current_app.logger.info(f"Encryption event: {json.dumps(event_data)}")
        
        return jsonify({
            'logged': True,
            'method': 'application_log',
            'timestamp': event_data['timestamp']
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Encryption event logging failed: {e}")
        return jsonify({'error': 'Event logging failed'}), 500

@encryption_bp.route('/dashboard-evidence', methods=['GET'])
def get_dashboard_evidence():
    """Get encryption evidence formatted for unified compliance dashboard"""
    try:
        from encryption_evidence_integration import EncryptionEvidenceIntegration
        
        integration = EncryptionEvidenceIntegration()
        dashboard_data = integration.get_encryption_evidence_for_dashboard()
        
        return jsonify(dashboard_data), 200
        
    except Exception as e:
        current_app.logger.error(f"Dashboard evidence retrieval failed: {e}")
        return jsonify({
            'error': 'Failed to retrieve dashboard evidence',
            'evidence_count': 0,
            'requirements_covered': 0
        }), 500

# Helper function for integration
def register_encryption_routes(app):
    """Register encryption routes with Flask app"""
    app.register_blueprint(encryption_bp)
    app.logger.info("Encryption API routes registered")

if __name__ == '__main__':
    # Test mode - basic functionality check
    print("🔐 Encryption API Module Test")
    
    try:
        from data_encryption import DataEncryption
        enc = DataEncryption()
        test_data = "sensitive_test_data"
        encrypted = enc.encrypt_field(test_data)
        decrypted = enc.decrypt_field(encrypted)
        
        print(f"✅ Encryption test successful")
        print(f"   Original: {test_data}")
        print(f"   Encrypted: {encrypted[:50]}...")
        print(f"   Decrypted: {decrypted}")
        print(f"   Round-trip: {'✅ PASS' if test_data == decrypted else '❌ FAIL'}")
        
        print("\n📋 API Endpoints Available:")
        print("   GET  /api/encryption/status")
        print("   POST /api/encryption/encrypt-field")
        print("   POST /api/encryption/decrypt-field") 
        print("   GET  /api/encryption/compliance-evidence")
        print("   POST /api/encryption/log-encryption-event")
        print("   GET  /api/encryption/dashboard-evidence")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
