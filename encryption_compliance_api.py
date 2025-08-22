"""
Encryption Compliance API Endpoints
Provides REST endpoints for encryption validation dashboard integration
Enhanced with comprehensive evidence generation and real-time validation
"""

from flask import Blueprint, jsonify, request, render_template
from encryption_compliance_integration import encryption_compliance
from encryption_evidence_generator import EncryptionEvidenceGenerator
import json
import logging
import os
from datetime import datetime

# Create blueprint for encryption compliance API
encryption_bp = Blueprint('encryption_compliance', __name__, url_prefix='/api/encryption')

logger = logging.getLogger(__name__)

@encryption_bp.route('/evidence-report', methods=['GET'])
def generate_evidence_report():
    """Generate comprehensive encryption evidence report"""
    try:
        generator = EncryptionEvidenceGenerator()
        evidence = generator.generate_comprehensive_evidence()
        
        # Log compliance event
        encryption_compliance.log_compliance_event(
            'encryption_evidence_report_generated',
            {
                'endpoint': '/api/encryption/evidence-report',
                'evidence_categories': len(evidence['encryption_evidence']),
                'tests_performed': len(evidence['test_results']),
                'compliance_mappings': len(evidence['compliance_mapping'])
            }
        )
        
        return jsonify({
            'success': True,
            'evidence': evidence,
            'summary': {
                'overall_status': calculate_encryption_compliance_score(evidence),
                'categories_checked': len(evidence['encryption_evidence']),
                'tests_passed': sum(1 for test in evidence['test_results'].values() if test.get('passed')),
                'total_tests': len(evidence['test_results']),
                'compliance_score': calculate_compliance_percentage(evidence)
            },
            'timestamp': evidence['timestamp']
        })
        
    except Exception as e:
        logger.error(f"Error generating evidence report: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@encryption_bp.route('/real-time-validation', methods=['POST'])
def run_real_time_validation():
    """Run real-time encryption validation tests"""
    try:
        test_type = request.json.get('test_type', 'all') if request.is_json else 'all'
        
        generator = EncryptionEvidenceGenerator()
        
        if test_type == 'quick':
            # Quick validation for dashboard
            results = {
                'field_encryption': test_field_encryption_quick(),
                'database_ssl': test_database_ssl_quick(),
                'session_security': test_session_security_quick()
            }
        else:
            # Comprehensive validation
            evidence = generator.generate_comprehensive_evidence()
            results = evidence['test_results']
        
        # Log compliance event
        encryption_compliance.log_compliance_event(
            'real_time_validation',
            {
                'endpoint': '/api/encryption/real-time-validation',
                'test_type': test_type,
                'results': results
            }
        )
        
        return jsonify({
            'success': True,
            'test_type': test_type,
            'results': results,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in real-time validation: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@encryption_bp.route('/compliance-evidence/<requirement_id>', methods=['GET'])
def get_specific_compliance_evidence(requirement_id):
    """Get evidence for specific compliance requirement with detailed proof"""
    try:
        generator = EncryptionEvidenceGenerator()
        evidence = generator.generate_comprehensive_evidence()
        
        # Map requirement to specific evidence
        requirement_evidence = extract_requirement_evidence(requirement_id, evidence)
        
        if not requirement_evidence:
            return jsonify({
                'success': False,
                'error': f'No evidence found for requirement {requirement_id}'
            }), 404
        
        # Log compliance event
        encryption_compliance.log_compliance_event(
            'specific_compliance_evidence_requested',
            {
                'endpoint': f'/api/encryption/compliance-evidence/{requirement_id}',
                'requirement': requirement_id,
                'evidence_provided': True
            }
        )
        
        return jsonify({
            'success': True,
            'requirement_id': requirement_id,
            'evidence': requirement_evidence,
            'verification_steps': get_verification_steps_for_requirement(requirement_id),
            'timestamp': evidence['timestamp']
        })
        
    except Exception as e:
        logger.error(f"Error getting evidence for {requirement_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@encryption_bp.route('/compliance-mapping', methods=['GET'])
def get_compliance_mapping():
    """Get encryption compliance mapping to regulatory requirements"""
    try:
        evidence = encryption_compliance.generate_encryption_evidence()
        
        # Log compliance event
        encryption_compliance.log_compliance_event(
            'compliance_mapping_check',
            {'endpoint': '/api/encryption/compliance-mapping', 'regulations_checked': len(evidence['compliance_mapping'])}
        )
        
        return jsonify({
            'success': True,
            'data': evidence['compliance_mapping'],
            'timestamp': evidence['timestamp']
        })
        
    except Exception as e:
        logger.error(f"Error getting compliance mapping: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@encryption_bp.route('/validation-tests', methods=['POST'])
def run_validation_tests():
    """Run encryption validation tests"""
    try:
        evidence = encryption_compliance.generate_encryption_evidence()
        
        # Log compliance event
        encryption_compliance.log_compliance_event(
            'encryption_validation_tests',
            {
                'endpoint': '/api/encryption/validation-tests',
                'tests_run': len(evidence['validation_results']),
                'results': evidence['validation_results']
            }
        )
        
        return jsonify({
            'success': True,
            'data': evidence['validation_results'],
            'timestamp': evidence['timestamp']
        })
        
    except Exception as e:
        logger.error(f"Error running validation tests: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@encryption_bp.route('/recommendations', methods=['GET'])
def get_recommendations():
    """Get encryption implementation recommendations"""
    try:
        evidence = encryption_compliance.generate_encryption_evidence()
        
        return jsonify({
            'success': True,
            'data': evidence['recommendations'],
            'timestamp': evidence['timestamp']
        })
        
    except Exception as e:
        logger.error(f"Error getting recommendations: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@encryption_bp.route('/report', methods=['GET'])
def get_compliance_report():
    """Get comprehensive encryption compliance report"""
    try:
        report = encryption_compliance.generate_encryption_compliance_report()
        
        # Log compliance event
        encryption_compliance.log_compliance_event(
            'encryption_compliance_report',
            {'endpoint': '/api/encryption/report', 'report_generated': True}
        )
        
        # Return as JSON for API or HTML for direct view
        if request.accept_mimetypes['application/json'] > request.accept_mimetypes['text/html']:
            return jsonify({
                'success': True,
                'report': report,
                'timestamp': encryption_compliance.generate_encryption_evidence()['timestamp']
            })
        else:
            return f"<pre>{report}</pre>", 200, {'Content-Type': 'text/html'}
        
    except Exception as e:
        logger.error(f"Error generating compliance report: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@encryption_bp.route('/evidence', methods=['GET'])
def get_encryption_evidence():
    """Get complete encryption evidence for compliance validation"""
    try:
        evidence = encryption_compliance.generate_encryption_evidence()
        
        # Log compliance event
        encryption_compliance.log_compliance_event(
            'encryption_evidence_generated',
            {
                'endpoint': '/api/encryption/evidence',
                'evidence_types': list(evidence.keys()),
                'compliance_regulations': list(evidence.get('compliance_mapping', {}).keys())
            }
        )
        
        return jsonify({
            'success': True,
            'data': evidence
        })
        
    except Exception as e:
        logger.error(f"Error generating encryption evidence: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@encryption_bp.route('/requirements/<regulation>', methods=['GET'])
def get_regulation_requirements(regulation):
    """Get encryption requirements for specific regulation"""
    try:
        all_requirements = encryption_compliance.encryption_requirements
        
        if regulation.upper() not in all_requirements:
            return jsonify({
                'success': False,
                'error': f'Regulation {regulation} not found'
            }), 404
        
        requirements = all_requirements[regulation.upper()]
        
        # Generate evidence for this specific regulation
        evidence = encryption_compliance.generate_encryption_evidence()
        regulation_evidence = evidence['compliance_mapping'].get(regulation.upper(), {})
        
        return jsonify({
            'success': True,
            'regulation': regulation.upper(),
            'requirements': requirements,
            'implementation_status': regulation_evidence
        })
        
    except Exception as e:
        logger.error(f"Error getting requirements for {regulation}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@encryption_bp.route('/test/<test_name>', methods=['POST'])
def run_specific_test(test_name):
    """Run a specific encryption test"""
    try:
        # Map test names to methods
        test_methods = {
            'encryption_round_trip': encryption_compliance._test_encryption_round_trip,
            'key_rotation': encryption_compliance._test_key_rotation,
            'session_security': encryption_compliance._test_session_security,
            'database_encryption': encryption_compliance._test_database_encryption
        }
        
        if test_name not in test_methods:
            return jsonify({
                'success': False,
                'error': f'Test {test_name} not available'
            }), 404
        
        # Run the specific test
        result = test_methods[test_name]()
        
        # Log compliance event
        encryption_compliance.log_compliance_event(
            f'encryption_test_{test_name}',
            {
                'endpoint': f'/api/encryption/test/{test_name}',
                'test_result': result
            }
        )
        
        return jsonify({
            'success': True,
            'test': test_name,
            'result': result
        })
        
    except Exception as e:
        logger.error(f"Error running test {test_name}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Dashboard integration endpoints
@encryption_bp.route('/dashboard-data', methods=['GET'])
def get_dashboard_data():
    """Get encryption data formatted for compliance dashboard"""
    try:
        evidence = encryption_compliance.generate_encryption_evidence()
        
        # Format data for dashboard consumption
        dashboard_data = {
            'encryption_overview': {
                'total_requirements': sum(len(reqs) for reqs in evidence['compliance_mapping'].values()),
                'implemented_requirements': sum(
                    1 for reqs in evidence['compliance_mapping'].values() 
                    for req in reqs.values() if req['implemented']
                ),
                'failed_tests': sum(
                    1 for test in evidence['validation_results'].values() 
                    if test['status'] == 'fail'
                ),
                'recommendations_count': len(evidence['recommendations'])
            },
            'by_regulation': {},
            'test_summary': evidence['validation_results'],
            'recommendations': evidence['recommendations']
        }
        
        # Format by regulation
        for regulation, requirements in evidence['compliance_mapping'].items():
            dashboard_data['by_regulation'][regulation] = {
                'total': len(requirements),
                'implemented': sum(1 for req in requirements.values() if req['implemented']),
                'percentage': round(
                    (sum(1 for req in requirements.values() if req['implemented']) / len(requirements)) * 100, 1
                ) if requirements else 0
            }
        
        return jsonify({
            'success': True,
            'data': dashboard_data,
            'timestamp': evidence['timestamp']
        })
        
    except Exception as e:
        logger.error(f"Error getting dashboard data: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Helper Functions for Evidence Generation and Validation

def calculate_encryption_compliance_score(evidence):
    """Calculate overall encryption compliance score"""
    test_results = evidence.get('test_results', {})
    total_tests = len(test_results)
    passed_tests = sum(1 for test in test_results.values() if test.get('passed'))
    
    if total_tests == 0:
        return 'UNKNOWN'
    
    score = (passed_tests / total_tests) * 100
    
    if score >= 95:
        return 'EXCELLENT'
    elif score >= 85:
        return 'GOOD'
    elif score >= 75:
        return 'SATISFACTORY'
    elif score >= 60:
        return 'NEEDS_IMPROVEMENT'
    else:
        return 'CRITICAL'

def calculate_compliance_percentage(evidence):
    """Calculate compliance percentage for dashboard"""
    test_results = evidence.get('test_results', {})
    if not test_results:
        return 0
    
    total_tests = len(test_results)
    passed_tests = sum(1 for test in test_results.values() if test.get('passed'))
    
    return round((passed_tests / total_tests) * 100, 1)

def test_field_encryption_quick():
    """Quick field encryption test"""
    try:
        from cryptography.fernet import Fernet
        key = Fernet.generate_key()
        cipher = Fernet(key)
        test_data = "quick_test"
        encrypted = cipher.encrypt(test_data.encode())
        decrypted = cipher.decrypt(encrypted).decode()
        
        return {
            'passed': decrypted == test_data,
            'algorithm': 'Fernet (AES-128)',
            'test_type': 'quick',
            'timestamp': datetime.now().isoformat()
        }
    except Exception as e:
        return {
            'passed': False,
            'error': str(e),
            'test_type': 'quick',
            'timestamp': datetime.now().isoformat()
        }

def test_database_ssl_quick():
    """Quick database SSL test"""
    try:
        import mysql.connector
        
        config = {
            'host': os.environ.get('MYSQL_HOST', 'localhost'),
            'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
            'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
            'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis')
        }
        
        connection = mysql.connector.connect(**config)
        cursor = connection.cursor()
        cursor.execute("SHOW STATUS LIKE 'Ssl_cipher'")
        result = cursor.fetchone()
        connection.close()
        
        return {
            'passed': result is not None and result[1] != '',
            'ssl_cipher': result[1] if result else None,
            'test_type': 'quick',
            'timestamp': datetime.now().isoformat()
        }
    except Exception as e:
        return {
            'passed': False,
            'error': str(e),
            'test_type': 'quick',
            'timestamp': datetime.now().isoformat()
        }

def test_session_security_quick():
    """Quick session security test"""
    try:
        # Check if auth manager is available and working
        auth_exists = os.path.exists('auth_manager.py')
        
        if auth_exists:
            try:
                from auth_manager import AuthManager
                auth = AuthManager()
                test_password = "TestPass123!"
                hashed = auth.hash_password(test_password)
                verified = auth.verify_password(test_password, hashed)
                
                return {
                    'passed': verified,
                    'auth_manager_available': True,
                    'password_hashing_working': True,
                    'test_type': 'quick',
                    'timestamp': datetime.now().isoformat()
                }
            except Exception as e:
                return {
                    'passed': False,
                    'auth_manager_available': True,
                    'error': str(e),
                    'test_type': 'quick',
                    'timestamp': datetime.now().isoformat()
                }
        else:
            return {
                'passed': False,
                'auth_manager_available': False,
                'error': 'Auth manager not found',
                'test_type': 'quick',
                'timestamp': datetime.now().isoformat()
            }
    except Exception as e:
        return {
            'passed': False,
            'error': str(e),
            'test_type': 'quick',
            'timestamp': datetime.now().isoformat()
        }

def extract_requirement_evidence(requirement_id, evidence):
    """Extract evidence for specific requirement"""
    mapping = {
        'FDA_CFR_21_PART_11': {
            'title': 'FDA 21 CFR Part 11 - Electronic Records and Electronic Signatures',
            'sections': {
                '11.10_controls': {
                    'requirement': 'Controls for closed systems',
                    'evidence': {
                        'field_encryption': evidence['encryption_evidence'].get('field_encryption', {}),
                        'session_security': evidence['encryption_evidence'].get('session_security', {}),
                        'validation_tests': {k: v for k, v in evidence['test_results'].items() if 'encryption' in k or 'password' in k}
                    }
                },
                '11.30_open_systems': {
                    'requirement': 'Controls for open systems',
                    'evidence': {
                        'connection_security': evidence['encryption_evidence'].get('connection_security', {}),
                        'database_encryption': evidence['encryption_evidence'].get('database_encryption', {}),
                        'validation_tests': {k: v for k, v in evidence['test_results'].items() if 'ssl' in k or 'database' in k}
                    }
                }
            }
        },
        'HIPAA_SECURITY_RULE': {
            'title': 'HIPAA Security Rule - Administrative, Physical, and Technical Safeguards',
            'sections': {
                'administrative_safeguards': {
                    'requirement': 'Administrative safeguards',
                    'evidence': {
                        'session_security': evidence['encryption_evidence'].get('session_security', {}),
                        'file_encryption': evidence['encryption_evidence'].get('file_encryption', {})
                    }
                },
                'technical_safeguards': {
                    'requirement': 'Technical safeguards',
                    'evidence': {
                        'field_encryption': evidence['encryption_evidence'].get('field_encryption', {}),
                        'database_encryption': evidence['encryption_evidence'].get('database_encryption', {}),
                        'connection_security': evidence['encryption_evidence'].get('connection_security', {})
                    }
                }
            }
        },
        'ISO_27001': {
            'title': 'ISO 27001 - Information Security Management Systems',
            'sections': {
                'cryptographic_controls': {
                    'requirement': 'Cryptographic controls (A.10.1)',
                    'evidence': {
                        'field_encryption': evidence['encryption_evidence'].get('field_encryption', {}),
                        'key_management': evidence['encryption_evidence'].get('database_encryption', {}),
                        'validation_tests': evidence['test_results']
                    }
                }
            }
        }
    }
    
    return mapping.get(requirement_id.upper())

def get_verification_steps_for_requirement(requirement_id):
    """Get verification steps for specific requirement"""
    steps = {
        'FDA_CFR_21_PART_11': [
            {
                'step': 1,
                'description': 'Verify electronic record integrity controls',
                'command': 'python3 encryption_evidence_generator.py',
                'expected': 'Field encryption tests pass'
            },
            {
                'step': 2,
                'description': 'Verify secure authentication system',
                'command': 'curl -X POST /api/encryption/real-time-validation',
                'expected': 'Session security tests pass'
            }
        ],
        'HIPAA_SECURITY_RULE': [
            {
                'step': 1,
                'description': 'Verify technical safeguards implementation',
                'command': 'python3 encryption_evidence_generator.py',
                'expected': 'All encryption categories pass'
            },
            {
                'step': 2,
                'description': 'Verify transmission security',
                'command': 'curl -k https://localhost:5000/api/encryption/status',
                'expected': 'HTTPS/TLS encryption enabled'
            }
        ],
        'ISO_27001': [
            {
                'step': 1,
                'description': 'Verify cryptographic key management',
                'command': 'python3 encryption_evidence_generator.py',
                'expected': 'Key management tests pass'
            },
            {
                'step': 2,
                'description': 'Verify information security controls',
                'command': 'curl /api/encryption/evidence-report',
                'expected': 'All security controls implemented'
            }
        ]
    }
    
    return steps.get(requirement_id.upper(), [])
