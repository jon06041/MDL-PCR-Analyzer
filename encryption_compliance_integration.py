"""
Encryption Compliance Integration for MDL-PCR-Analyzer
Ties encryption implementation to FDA/regulatory validation requirements
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from enhanced_encryption_manager import EnhancedEncryptionManager

class EncryptionComplianceIntegration:
    """
    Integrates encryption implementation with compliance validation dashboard
    Tracks encryption requirements and evidence for regulatory validation
    """
    
    def __init__(self):
        self.encryption_manager = EnhancedEncryptionManager()
        self.logger = logging.getLogger(__name__)
        
        # Compliance mapping for encryption requirements
        self.encryption_requirements = {
            # FDA CFR 21 Part 11 - Electronic Records
            'FDA_CFR_21_PART_11': {
                'electronic_signatures': {
                    'requirement': '11.50 - Secure electronic signatures',
                    'encryption_aspect': 'Session token encryption, password hashing',
                    'validation_method': 'verify_session_encryption',
                    'evidence_type': 'encryption_test_results'
                },
                'access_controls': {
                    'requirement': '11.10 - Access control systems',
                    'encryption_aspect': 'Encrypted user credentials, role-based access',
                    'validation_method': 'verify_access_encryption',
                    'evidence_type': 'access_control_encryption'
                },
                'audit_trails': {
                    'requirement': '11.10 - Audit trail protection',
                    'encryption_aspect': 'Encrypted audit logs, tamper-proof records',
                    'validation_method': 'verify_audit_encryption',
                    'evidence_type': 'audit_encryption_evidence'
                }
            },
            
            # ISO 27001 - Information Security
            'ISO_27001': {
                'data_protection': {
                    'requirement': 'A.10.1.1 - Cryptographic controls',
                    'encryption_aspect': 'Data encryption at rest and in transit',
                    'validation_method': 'verify_data_encryption',
                    'evidence_type': 'cryptographic_implementation'
                },
                'key_management': {
                    'requirement': 'A.10.1.2 - Key management',
                    'encryption_aspect': 'Secure key generation, storage, rotation',
                    'validation_method': 'verify_key_management',
                    'evidence_type': 'key_management_procedures'
                }
            },
            
            # HIPAA (if handling any health data)
            'HIPAA_SECURITY': {
                'data_encryption': {
                    'requirement': '164.312(a)(2)(iv) - Encryption/Decryption',
                    'encryption_aspect': 'PHI encryption at rest and in transit',
                    'validation_method': 'verify_phi_encryption',
                    'evidence_type': 'hipaa_encryption_compliance'
                }
            },
            
            # ISO 13485 - Medical Device QMS
            'ISO_13485': {
                'software_validation': {
                    'requirement': '4.1.6 - Software validation',
                    'encryption_aspect': 'Validated encryption implementation',
                    'validation_method': 'verify_encryption_validation',
                    'evidence_type': 'software_encryption_validation'
                }
            }
        }
    
    def generate_encryption_evidence(self) -> Dict[str, Any]:
        """
        Generate comprehensive encryption evidence for compliance validation
        """
        evidence = {
            'timestamp': datetime.now().isoformat(),
            'encryption_status': {},
            'compliance_mapping': {},
            'validation_results': {},
            'recommendations': []
        }
        
        # Test encryption functionality
        try:
            # Database encryption status
            evidence['encryption_status']['database'] = self._check_database_encryption()
            
            # Session encryption status  
            evidence['encryption_status']['sessions'] = self._check_session_encryption()
            
            # API/Transport encryption
            evidence['encryption_status']['transport'] = self._check_transport_encryption()
            
            # Key management status
            evidence['encryption_status']['key_management'] = self._check_key_management()
            
            # Generate compliance mapping
            evidence['compliance_mapping'] = self._map_encryption_to_requirements()
            
            # Run validation tests
            evidence['validation_results'] = self._run_encryption_validation_tests()
            
            # Generate recommendations
            evidence['recommendations'] = self._generate_encryption_recommendations()
            
        except Exception as e:
            self.logger.error(f"Error generating encryption evidence: {e}")
            evidence['error'] = str(e)
        
        return evidence
    
    def _check_database_encryption(self) -> Dict[str, Any]:
        """Check database encryption status"""
        return {
            'tde_enabled': self.encryption_manager.verify_database_encryption(),
            'field_encryption': self.encryption_manager.verify_field_encryption(),
            'connection_ssl': self.encryption_manager.verify_connection_encryption(),
            'backup_encryption': self.encryption_manager.verify_backup_encryption()
        }
    
    def _check_session_encryption(self) -> Dict[str, Any]:
        """Check session encryption status"""
        return {
            'session_tokens_encrypted': self.encryption_manager.verify_session_encryption(),
            'cookie_security': self.encryption_manager.verify_cookie_security(),
            'csrf_protection': self.encryption_manager.verify_csrf_protection()
        }
    
    def _check_transport_encryption(self) -> Dict[str, Any]:
        """Check transport encryption status"""
        return {
            'https_enforced': self.encryption_manager.verify_https_enforcement(),
            'tls_version': self.encryption_manager.get_tls_version(),
            'certificate_valid': self.encryption_manager.verify_certificate(),
            'api_encryption': self.encryption_manager.verify_api_encryption()
        }
    
    def _check_key_management(self) -> Dict[str, Any]:
        """Check key management status"""
        return {
            'key_rotation_enabled': self.encryption_manager.verify_key_rotation(),
            'key_storage_secure': self.encryption_manager.verify_key_storage(),
            'key_generation_secure': self.encryption_manager.verify_key_generation(),
            'key_backup_secure': self.encryption_manager.verify_key_backup()
        }
    
    def _map_encryption_to_requirements(self) -> Dict[str, Any]:
        """Map encryption implementation to specific compliance requirements"""
        mapping = {}
        
        for regulation, requirements in self.encryption_requirements.items():
            mapping[regulation] = {}
            for req_id, req_data in requirements.items():
                mapping[regulation][req_id] = {
                    'requirement': req_data['requirement'],
                    'implemented': self._check_requirement_implementation(req_data),
                    'evidence_generated': True,
                    'validation_status': 'pending'
                }
        
        return mapping
    
    def _check_requirement_implementation(self, requirement_data: Dict) -> bool:
        """Check if specific requirement is implemented"""
        validation_method = requirement_data.get('validation_method')
        if validation_method and hasattr(self.encryption_manager, validation_method):
            method = getattr(self.encryption_manager, validation_method)
            return method()
        return False
    
    def _run_encryption_validation_tests(self) -> Dict[str, Any]:
        """Run comprehensive encryption validation tests"""
        tests = {}
        
        # Test encryption/decryption functionality
        tests['encryption_round_trip'] = self._test_encryption_round_trip()
        
        # Test key rotation
        tests['key_rotation'] = self._test_key_rotation()
        
        # Test session security
        tests['session_security'] = self._test_session_security()
        
        # Test database encryption
        tests['database_encryption'] = self._test_database_encryption()
        
        return tests
    
    def _test_encryption_round_trip(self) -> Dict[str, Any]:
        """Test encryption and decryption works correctly"""
        try:
            test_data = "Test sensitive data for encryption validation"
            encrypted = self.encryption_manager.encrypt_data(test_data)
            decrypted = self.encryption_manager.decrypt_data(encrypted)
            
            return {
                'status': 'pass' if decrypted == test_data else 'fail',
                'test_performed': True,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            return {
                'status': 'fail',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def _test_key_rotation(self) -> Dict[str, Any]:
        """Test key rotation functionality"""
        try:
            # Test key rotation capability
            rotation_result = self.encryption_manager.test_key_rotation()
            
            return {
                'status': 'pass' if rotation_result else 'fail',
                'test_performed': True,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            return {
                'status': 'fail',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def _test_session_security(self) -> Dict[str, Any]:
        """Test session security implementation"""
        try:
            # Test session token generation and validation
            session_result = self.encryption_manager.test_session_security()
            
            return {
                'status': 'pass' if session_result else 'fail',
                'test_performed': True,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            return {
                'status': 'fail',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def _test_database_encryption(self) -> Dict[str, Any]:
        """Test database encryption implementation"""
        try:
            # Test database encryption status
            db_result = self.encryption_manager.test_database_encryption()
            
            return {
                'status': 'pass' if db_result else 'fail',
                'test_performed': True,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            return {
                'status': 'fail',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def _generate_encryption_recommendations(self) -> List[Dict[str, str]]:
        """Generate recommendations for encryption improvements"""
        recommendations = []
        
        # Check current implementation and suggest improvements
        if not self.encryption_manager.verify_database_encryption():
            recommendations.append({
                'priority': 'high',
                'category': 'database',
                'recommendation': 'Enable MySQL Transparent Data Encryption (TDE)',
                'regulation': 'FDA CFR 21 Part 11, ISO 27001'
            })
        
        if not self.encryption_manager.verify_https_enforcement():
            recommendations.append({
                'priority': 'high',
                'category': 'transport',
                'recommendation': 'Enforce HTTPS for all API endpoints',
                'regulation': 'ISO 27001, HIPAA'
            })
        
        if not self.encryption_manager.verify_key_rotation():
            recommendations.append({
                'priority': 'medium',
                'category': 'key_management',
                'recommendation': 'Implement automated key rotation',
                'regulation': 'ISO 27001'
            })
        
        return recommendations
    
    def log_compliance_event(self, event_type: str, details: Dict[str, Any]):
        """Log encryption-related compliance events"""
        try:
            # Import compliance manager if available
            from mysql_unified_compliance_manager import MySQLUnifiedComplianceManager
            
            compliance_manager = MySQLUnifiedComplianceManager()
            
            # Log the encryption compliance event
            compliance_manager.log_compliance_event(
                regulation_number="ENCRYPTION_SECURITY",
                event_type=event_type,
                description=f"Encryption compliance: {event_type}",
                details=details,
                file_path=__file__
            )
            
        except Exception as e:
            self.logger.error(f"Failed to log compliance event: {e}")
    
    def generate_encryption_compliance_report(self) -> str:
        """Generate comprehensive encryption compliance report"""
        evidence = self.generate_encryption_evidence()
        
        report = f"""
# Encryption Compliance Report
Generated: {evidence['timestamp']}

## Encryption Status Summary
- Database Encryption: {'✅' if evidence['encryption_status']['database']['tde_enabled'] else '❌'}
- Session Security: {'✅' if evidence['encryption_status']['sessions']['session_tokens_encrypted'] else '❌'}
- Transport Security: {'✅' if evidence['encryption_status']['transport']['https_enforced'] else '❌'}
- Key Management: {'✅' if evidence['encryption_status']['key_management']['key_rotation_enabled'] else '❌'}

## Regulatory Compliance Mapping
"""
        
        for regulation, requirements in evidence['compliance_mapping'].items():
            report += f"\n### {regulation}\n"
            for req_id, req_data in requirements.items():
                status = '✅' if req_data['implemented'] else '❌'
                report += f"- {status} {req_data['requirement']}\n"
        
        report += "\n## Validation Test Results\n"
        for test_name, test_result in evidence['validation_results'].items():
            status = '✅' if test_result['status'] == 'pass' else '❌'
            report += f"- {status} {test_name.replace('_', ' ').title()}\n"
        
        if evidence['recommendations']:
            report += "\n## Recommendations\n"
            for rec in evidence['recommendations']:
                report += f"- **{rec['priority'].upper()}**: {rec['recommendation']} ({rec['regulation']})\n"
        
        return report

# Global instance for easy access
encryption_compliance = EncryptionComplianceIntegration()
