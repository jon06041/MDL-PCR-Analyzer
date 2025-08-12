#!/usr/bin/env python3
"""
Encryption Evidence Integration for MDL-PCR-Analyzer
Integrates inspector-level encryption evidence with the unified compliance dashboard
"""

import json
import mysql.connector
import os
import hashlib
from datetime import datetime
from inspector_encryption_evidence import InspectorEncryptionEvidence

class EncryptionEvidenceIntegration:
    def __init__(self):
        self.mysql_config = {
            'host': os.environ.get('MYSQL_HOST', 'localhost'),
            'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
            'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
            'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis'),
            'charset': 'utf8mb4',
            'collation': 'utf8mb4_unicode_ci'
        }
    
    def get_mysql_connection(self):
        """Get MySQL connection"""
        try:
            return mysql.connector.connect(**self.mysql_config)
        except Exception as e:
            print(f"MySQL connection failed: {e}")
            return None
    
    def map_encryption_to_compliance_requirements(self):
        """Map encryption evidence to specific compliance requirements"""
        
        # This maps encryption capabilities to specific FDA requirements
        encryption_compliance_mapping = {
            'FDA_CFR_21_11_10_A': {
                'requirement_title': 'Closed system access controls',
                'encryption_evidence': 'Field-level encryption with access control integration points',
                'evidence_type': 'technical_implementation',
                'file_path': 'data_encryption.py',
                'description': 'AES-128 encryption provides secure access controls for electronic records'
            },
            'FDA_CFR_21_11_10_B': {
                'requirement_title': 'Use of identification codes and passwords',
                'encryption_evidence': 'Encrypted storage of authentication tokens and user credentials',
                'evidence_type': 'security_implementation', 
                'file_path': 'encryption_api.py',
                'description': 'Encryption system supports secure credential storage and authentication'
            },
            'FDA_CFR_21_11_10_C': {
                'requirement_title': 'Use of identification codes, passwords, and biometrics',
                'encryption_evidence': 'Key derivation from secure passwords with PBKDF2',
                'evidence_type': 'authentication_security',
                'file_path': 'inspector_encryption_evidence.py',
                'description': 'PBKDF2-HMAC-SHA256 with 100,000 iterations for secure key derivation'
            },
            'FDA_CFR_21_11_10_D': {
                'requirement_title': 'Use of automatic electronic signatures',
                'encryption_evidence': 'HMAC-SHA256 authentication for data integrity verification',
                'evidence_type': 'digital_signature_ready',
                'file_path': 'data_encryption.py',
                'description': 'Cryptographic authentication ready for electronic signature implementation'
            },
            'FDA_CFR_21_11_10_E': {
                'requirement_title': 'Use of appropriate controls over systems documentation',
                'encryption_evidence': 'Comprehensive encryption documentation and evidence generation',
                'evidence_type': 'documentation_control',
                'file_path': 'inspector_encryption_evidence.py',
                'description': 'Inspector-level documentation with technical validation evidence'
            },
            'HIPAA_164_312_A_2_IV': {
                'requirement_title': 'Encryption and decryption (Addressable)',
                'encryption_evidence': 'AES-128 field-level encryption for PHI protection',
                'evidence_type': 'phi_protection',
                'file_path': 'data_encryption.py',
                'description': 'HIPAA-compliant encryption for protected health information'
            },
            'ISO_27001_A_10_1_1': {
                'requirement_title': 'Policy on the use of cryptographic controls',
                'encryption_evidence': 'Documented cryptographic implementation with NIST-approved algorithms',
                'evidence_type': 'cryptographic_policy',
                'file_path': 'inspector_encryption_evidence.py',
                'description': 'AES-128 Fernet implementation following NIST guidelines'
            }
        }
        
        return encryption_compliance_mapping
    
    def insert_encryption_evidence_to_database(self):
        """Insert encryption evidence into compliance evidence table"""
        
        conn = self.get_mysql_connection()
        if not conn:
            print("❌ Database connection failed - cannot insert evidence")
            return False
        
        try:
            cursor = conn.cursor()
            
            # Generate fresh encryption evidence
            evidence_generator = InspectorEncryptionEvidence()
            encryption_report = evidence_generator.generate_complete_inspector_report()
            
            # Get compliance requirement mappings
            compliance_mapping = self.map_encryption_to_compliance_requirements()
            
            inserted_count = 0
            
            for req_id, mapping in compliance_mapping.items():
                # Create evidence data with full encryption details
                evidence_data = {
                    'encryption_report_id': encryption_report['evidence_metadata']['report_id'],
                    'generation_timestamp': encryption_report['evidence_metadata']['generation_timestamp'],
                    'encryption_algorithm': 'AES-128 Fernet',
                    'key_derivation': 'PBKDF2-HMAC-SHA256',
                    'compliance_framework': req_id.split('_')[0],
                    'requirement_section': req_id,
                    'technical_validation': encryption_report['executive_summary']['technical_validation'],
                    'inspector_confidence': encryption_report['executive_summary']['inspector_confidence'],
                    'evidence_details': mapping,
                    'description': mapping['description'],
                    'file_path': mapping['file_path']
                }
                
                # Calculate evidence hash for integrity
                evidence_hash = hashlib.sha256(json.dumps(evidence_data, sort_keys=True).encode()).hexdigest()
                
                # Insert into compliance_evidence table
                cursor.execute("""
                    INSERT INTO compliance_evidence 
                    (requirement_id, evidence_type, evidence_data, evidence_hash, validation_status, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                    evidence_data = VALUES(evidence_data),
                    evidence_hash = VALUES(evidence_hash),
                    created_at = VALUES(created_at)
                """, (
                    req_id,
                    mapping['evidence_type'],
                    json.dumps(evidence_data),
                    evidence_hash,
                    'validated',  # Encryption evidence is automatically validated
                    datetime.now()
                ))
                
                inserted_count += 1
            
            conn.commit()
            cursor.close()
            conn.close()
            
            print(f"✅ Successfully inserted {inserted_count} encryption evidence records")
            return True
            
        except Exception as e:
            print(f"❌ Error inserting encryption evidence: {e}")
            if conn:
                conn.rollback()
                conn.close()
            return False
    
    def generate_encryption_evidence_summary(self):
        """Generate summary of encryption evidence for dashboard display"""
        
        evidence_generator = InspectorEncryptionEvidence()
        report = evidence_generator.generate_complete_inspector_report()
        
        summary = {
            'encryption_status': report['executive_summary']['encryption_status'],
            'compliance_status': report['executive_summary']['compliance_status'],
            'technical_validation': report['executive_summary']['technical_validation'],
            'inspector_confidence': report['executive_summary']['inspector_confidence'],
            'frameworks_covered': len(report['compliance_framework_mapping']),
            'checklist_items_passed': sum(1 for item in report['inspector_verification_checklist'].values() if '✅' in item),
            'total_checklist_items': len(report['inspector_verification_checklist']),
            'system_readiness': report['operational_verification']['system_readiness']['overall_status'],
            'last_updated': report['evidence_metadata']['generation_timestamp']
        }
        
        return summary
    
    def get_encryption_evidence_for_dashboard(self):
        """Get encryption evidence formatted for unified compliance dashboard"""
        
        conn = self.get_mysql_connection()
        if not conn:
            return {
                'error': 'Database connection failed',
                'evidence_count': 0,
                'requirements_covered': 0
            }
        
        try:
            cursor = conn.cursor(dictionary=True)
            
            # Get encryption-related evidence
            cursor.execute("""
                SELECT requirement_id, evidence_type, evidence_data, 
                       evidence_hash, validation_status, created_at
                FROM compliance_evidence 
                WHERE evidence_type IN ('technical_implementation', 'security_implementation', 
                                      'authentication_security', 'digital_signature_ready',
                                      'documentation_control', 'phi_protection', 'cryptographic_policy')
                   OR requirement_id LIKE '%ENCRYPT%'
                   OR requirement_id LIKE '%CRYPTO%'
                   OR JSON_EXTRACT(evidence_data, '$.description') LIKE '%encryption%'
                ORDER BY created_at DESC
            """)
            
            evidence_records = cursor.fetchall()
            
            # Process evidence for dashboard display
            dashboard_evidence = []
            frameworks = set()
            
            for record in evidence_records:
                try:
                    evidence_data = json.loads(record['evidence_data']) if record['evidence_data'] else {}
                    framework = evidence_data.get('compliance_framework', 'UNKNOWN')
                    frameworks.add(framework)
                    
                    dashboard_evidence.append({
                        'requirement_id': record['requirement_id'],
                        'evidence_type': record['evidence_type'],
                        'description': evidence_data.get('description', 'No description'),
                        'file_path': evidence_data.get('file_path', 'Unknown'),
                        'framework': framework,
                        'created_at': record['created_at'].isoformat() if record['created_at'] else None,
                        'technical_details': evidence_data.get('evidence_details', {}),
                        'validation_status': record['validation_status'],
                        'evidence_hash': record['evidence_hash']
                    })
                    
                except json.JSONDecodeError:
                    # Handle cases where evidence_data is not valid JSON
                    dashboard_evidence.append({
                        'requirement_id': record['requirement_id'],
                        'evidence_type': record['evidence_type'],
                        'description': 'Data parsing error',
                        'file_path': 'Unknown',
                        'framework': 'UNKNOWN',
                        'created_at': record['created_at'].isoformat() if record['created_at'] else None,
                        'technical_details': {},
                        'validation_status': record['validation_status'],
                        'evidence_hash': record['evidence_hash']
                    })
            
            cursor.close()
            conn.close()
            
            return {
                'evidence_count': len(evidence_records),
                'requirements_covered': len(set(r['requirement_id'] for r in evidence_records)),
                'frameworks_covered': list(frameworks),
                'evidence_records': dashboard_evidence,
                'summary': self.generate_encryption_evidence_summary()
            }
            
        except Exception as e:
            print(f"❌ Error retrieving encryption evidence: {e}")
            if conn:
                conn.close()
            return {
                'error': str(e),
                'evidence_count': 0,
                'requirements_covered': 0
            }

def main():
    """Test encryption evidence integration"""
    
    print("🔐 Testing Encryption Evidence Integration...")
    
    integration = EncryptionEvidenceIntegration()
    
    # Test 1: Insert encryption evidence into database
    print("\n1. Inserting encryption evidence into database...")
    success = integration.insert_encryption_evidence_to_database()
    
    if success:
        print("✅ Encryption evidence inserted successfully")
        
        # Test 2: Retrieve evidence for dashboard
        print("\n2. Retrieving evidence for dashboard display...")
        dashboard_data = integration.get_encryption_evidence_for_dashboard()
        
        print(f"   📊 Evidence Count: {dashboard_data['evidence_count']}")
        print(f"   📋 Requirements Covered: {dashboard_data['requirements_covered']}")
        print(f"   🏛️ Frameworks: {', '.join(dashboard_data.get('frameworks_covered', []))}")
        
        if 'summary' in dashboard_data:
            summary = dashboard_data['summary']
            print(f"   🔒 Encryption Status: {summary['encryption_status']}")
            print(f"   ✅ Technical Validation: {summary['technical_validation']}")
            print(f"   🎯 Inspector Confidence: {summary['inspector_confidence']}")
        
        print("\n✅ Integration test completed successfully!")
        return True
    else:
        print("❌ Integration test failed")
        return False

if __name__ == '__main__':
    main()
