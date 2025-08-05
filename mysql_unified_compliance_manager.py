"""
MySQL Unified Validation & Compliance Manager - Software-Specific Compliance
Tracks only compliance requirements that can be satisfied by running the qPCR analysis software
Focus on auto-trackable requirements that demonstrate real software validation
"""

import mysql.connector
import json
import hashlib
import datetime
from typing import Dict, List, Optional, Any, Tuple
import logging

class MySQLUnifiedComplianceManager:
    def __init__(self, mysql_config: dict):
        """
        Initialize with MySQL configuration
        mysql_config: {'host': str, 'port': int, 'user': str, 'password': str, 'database': str}
        """
        self.mysql_config = mysql_config
        self.logger = logging.getLogger(__name__)
        self.initialize_tables()
        
        # Mapping of system events to SOFTWARE-SPECIFIC compliance requirements
        # Only includes requirements that can be satisfied by using this qPCR software
        self.event_to_requirements_map = {
            # ML Model Validation & Versioning
            'ML_MODEL_TRAINED': ['ML_MODEL_VALIDATION', 'ML_VERSION_CONTROL', 'ML_PERFORMANCE_TRACKING'],
            'ML_PREDICTION_MADE': ['ML_MODEL_VALIDATION', 'ML_AUDIT_TRAIL'],
            'ML_FEEDBACK_SUBMITTED': ['ML_EXPERT_VALIDATION', 'ML_CONTINUOUS_LEARNING'],
            'ML_MODEL_RETRAINED': ['ML_VERSION_CONTROL', 'ML_PERFORMANCE_TRACKING'],
            'ML_ACCURACY_VALIDATED': ['ML_PERFORMANCE_VALIDATION', 'ML_EXPERT_VALIDATION'],
            
            # Core qPCR Analysis Activities
            'ANALYSIS_COMPLETED': ['ANALYSIS_EXECUTION_TRACKING', 'ELECTRONIC_RECORDS_CREATION'],
            'REPORT_GENERATED': ['ELECTRONIC_REPORT_GENERATION', 'DATA_INTEGRITY_TRACKING'],
            'THRESHOLD_ADJUSTED': ['SOFTWARE_CONFIGURATION_CONTROL', 'ANALYSIS_PARAMETER_TRACKING'],
            'DATA_EXPORTED': ['DATA_EXPORT_TRACKING', 'AUDIT_TRAIL_GENERATION'],
            
            # Quality Control Through Software
            'QC_ANALYZED': ['QC_SOFTWARE_EXECUTION', 'CONTROL_SAMPLE_TRACKING'],
            'CONTROL_ANALYZED': ['CONTROL_SAMPLE_VALIDATION', 'QC_SOFTWARE_EXECUTION'],
            'NEGATIVE_CONTROL_VERIFIED': ['NEGATIVE_CONTROL_TRACKING', 'QC_SOFTWARE_EXECUTION'],
            'POSITIVE_CONTROL_VERIFIED': ['POSITIVE_CONTROL_TRACKING', 'QC_SOFTWARE_EXECUTION'],
            
            # System Validation & Software Operation
            'SYSTEM_VALIDATION': ['SOFTWARE_VALIDATION_EXECUTION', 'SYSTEM_PERFORMANCE_VERIFICATION'],
            'SOFTWARE_FEATURE_USED': ['SOFTWARE_FUNCTIONALITY_VALIDATION', 'USER_INTERACTION_TRACKING'],
            'CONFIGURATION_CHANGED': ['SOFTWARE_CONFIGURATION_CONTROL', 'CHANGE_CONTROL_TRACKING'],
            
            # User Training & Competency (Software-Specific)
            'USER_TRAINING': ['SOFTWARE_TRAINING_COMPLETION', 'USER_COMPETENCY_SOFTWARE'],
            'TRAINING_COMPLETED': ['SOFTWARE_TRAINING_TRACKING', 'COMPETENCY_VERIFICATION'],
        }
        
        # SOFTWARE-SPECIFIC compliance requirements with auto-tracking mechanisms
        self.compliance_requirements = {
            # ML Model Validation Requirements
            'ML_MODEL_VALIDATION': {
                'title': 'ML Model Validation',
                'description': 'Validation of machine learning models for qPCR analysis',
                'category': 'ML_VALIDATION',
                'evidence_types': ['model_training_records', 'accuracy_metrics', 'validation_datasets'],
                'auto_trackable': True,
                'tracking_events': ['ML_MODEL_TRAINED', 'ML_PREDICTION_MADE'],
                'validation_criteria': {
                    'min_training_samples': 100,
                    'min_accuracy': 0.85,
                    'cross_validation_required': True
                }
            },
            
            'ML_VERSION_CONTROL': {
                'title': 'ML Model Version Control',
                'description': 'Version control and change management for ML models',
                'category': 'ML_VALIDATION',
                'evidence_types': ['model_versions', 'change_logs', 'deployment_records'],
                'auto_trackable': True,
                'tracking_events': ['ML_MODEL_TRAINED', 'ML_MODEL_RETRAINED'],
                'validation_criteria': {
                    'version_tracking_required': True,
                    'change_documentation_required': True
                }
            },
            
            'ML_EXPERT_VALIDATION': {
                'title': 'Expert Validation of ML Predictions',
                'description': 'Expert review and validation of ML prediction accuracy',
                'category': 'ML_VALIDATION',
                'evidence_types': ['expert_feedback', 'validation_reports', 'accuracy_assessments'],
                'auto_trackable': True,
                'tracking_events': ['ML_FEEDBACK_SUBMITTED', 'ML_ACCURACY_VALIDATED'],
                'validation_criteria': {
                    'expert_review_required': True,
                    'feedback_documentation_required': True
                }
            },
            
            # Core Analysis Requirements
            'ANALYSIS_EXECUTION_TRACKING': {
                'title': 'Analysis Execution Tracking',
                'description': 'Tracking of qPCR analysis execution and parameters',
                'category': 'ANALYSIS_CONTROL',
                'evidence_types': ['analysis_logs', 'parameter_records', 'execution_timestamps'],
                'auto_trackable': True,
                'tracking_events': ['ANALYSIS_COMPLETED'],
                'validation_criteria': {
                    'parameter_documentation_required': True,
                    'timestamp_tracking_required': True
                }
            },
            
            'ELECTRONIC_RECORDS_CREATION': {
                'title': 'Electronic Records Creation',
                'description': 'Creation and management of electronic analysis records',
                'category': 'DATA_INTEGRITY',
                'evidence_types': ['electronic_records', 'metadata', 'digital_signatures'],
                'auto_trackable': True,
                'tracking_events': ['ANALYSIS_COMPLETED', 'REPORT_GENERATED'],
                'validation_criteria': {
                    'metadata_required': True,
                    'integrity_verification_required': True
                }
            },
            
            # Quality Control Requirements
            'QC_SOFTWARE_EXECUTION': {
                'title': 'QC Software Execution',
                'description': 'Quality control processes executed through software',
                'category': 'QUALITY_CONTROL',
                'evidence_types': ['qc_reports', 'control_analysis', 'qc_parameters'],
                'auto_trackable': True,
                'tracking_events': ['QC_ANALYZED', 'CONTROL_ANALYZED'],
                'validation_criteria': {
                    'qc_documentation_required': True,
                    'control_analysis_required': True
                }
            },
            
            # System Validation Requirements
            'SOFTWARE_VALIDATION_EXECUTION': {
                'title': 'Software Validation Execution',
                'description': 'Execution of software validation procedures',
                'category': 'SYSTEM_VALIDATION',
                'evidence_types': ['validation_protocols', 'test_results', 'compliance_reports'],
                'auto_trackable': True,
                'tracking_events': ['SYSTEM_VALIDATION', 'SOFTWARE_FEATURE_USED'],
                'validation_criteria': {
                    'validation_protocol_required': True,
                    'test_documentation_required': True
                }
            }
        }

    def get_connection(self):
        """Get MySQL database connection"""
        return mysql.connector.connect(**self.mysql_config)

    def initialize_tables(self):
        """Create MySQL tables for unified compliance tracking"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Create unified compliance events table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS unified_compliance_events (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    event_type VARCHAR(100) NOT NULL,
                    event_data JSON,
                    user_id VARCHAR(100),
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    session_id VARCHAR(200),
                    compliance_hash VARCHAR(64),
                    validation_status ENUM('pending', 'validated', 'failed') DEFAULT 'pending',
                    INDEX idx_event_type (event_type),
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_user_id (user_id),
                    INDEX idx_session_id (session_id)
                )
            ''')
            
            # Create compliance requirements tracking table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS compliance_requirements_tracking (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    requirement_id VARCHAR(100) NOT NULL,
                    requirement_category VARCHAR(50),
                    compliance_status ENUM('not_started', 'in_progress', 'completed', 'validated') DEFAULT 'not_started',
                    evidence_count INT DEFAULT 0,
                    last_evidence_timestamp DATETIME,
                    validation_criteria JSON,
                    compliance_percentage DECIMAL(5,2) DEFAULT 0.00,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_requirement_id (requirement_id),
                    INDEX idx_category (requirement_category),
                    INDEX idx_status (compliance_status)
                )
            ''')
            
            # Create compliance evidence table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS compliance_evidence (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    requirement_id VARCHAR(100) NOT NULL,
                    event_id INT,
                    evidence_type VARCHAR(100),
                    evidence_data JSON,
                    evidence_hash VARCHAR(64),
                    validation_status ENUM('pending', 'validated', 'rejected') DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    validated_at DATETIME NULL,
                    validator_id VARCHAR(100),
                    FOREIGN KEY (event_id) REFERENCES unified_compliance_events(id),
                    INDEX idx_requirement_id (requirement_id),
                    INDEX idx_evidence_type (evidence_type),
                    INDEX idx_validation_status (validation_status)
                )
            ''')
            
            # Create user access log for compliance tracking
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS unified_user_access_log (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(100),
                    session_id VARCHAR(200),
                    access_type VARCHAR(50),
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    compliance_relevant BOOLEAN DEFAULT TRUE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_access_type (access_type)
                )
            ''')
            
            conn.commit()
            self.logger.info("Unified compliance tables initialized successfully")
            
        except Exception as e:
            self.logger.error(f"Error initializing unified compliance tables: {e}")
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def log_compliance_event(self, event_type: str, event_data: dict, user_id: str = 'system', session_id: str = None):
        """Log a compliance-relevant event"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Create compliance hash for integrity
            event_str = f"{event_type}:{json.dumps(event_data, sort_keys=True)}:{user_id}:{datetime.datetime.now().isoformat()}"
            compliance_hash = hashlib.sha256(event_str.encode()).hexdigest()
            
            cursor.execute('''
                INSERT INTO unified_compliance_events 
                (event_type, event_data, user_id, session_id, compliance_hash)
                VALUES (%s, %s, %s, %s, %s)
            ''', (event_type, json.dumps(event_data), user_id, session_id, compliance_hash))
            
            event_id = cursor.lastrowid
            conn.commit()
            
            # Process compliance requirements triggered by this event
            self._process_compliance_requirements(event_type, event_data, event_id)
            
            self.logger.info(f"Logged compliance event: {event_type} for user {user_id}")
            return event_id
            
        except Exception as e:
            self.logger.error(f"Error logging compliance event: {e}")
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def _process_compliance_requirements(self, event_type: str, event_data: dict, event_id: int):
        """Process compliance requirements triggered by an event"""
        if event_type not in self.event_to_requirements_map:
            return
        
        triggered_requirements = self.event_to_requirements_map[event_type]
        
        for requirement_id in triggered_requirements:
            if requirement_id in self.compliance_requirements:
                self._update_requirement_status(requirement_id, event_data, event_id)
                self._create_compliance_evidence(requirement_id, event_id, event_data)

    def _update_requirement_status(self, requirement_id: str, event_data: dict, event_id: int):
        """Update compliance requirement status"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Check if requirement tracking record exists
            cursor.execute('''
                SELECT id, evidence_count, compliance_status 
                FROM compliance_requirements_tracking 
                WHERE requirement_id = %s
            ''', (requirement_id,))
            
            result = cursor.fetchone()
            requirement_spec = self.compliance_requirements[requirement_id]
            
            if result:
                # Update existing record
                tracking_id, evidence_count, current_status = result
                new_evidence_count = evidence_count + 1
                
                # Calculate compliance percentage based on evidence
                compliance_percentage = min(100.0, (new_evidence_count / 10) * 100)  # Simple calculation
                
                # Update status based on evidence
                new_status = 'in_progress' if compliance_percentage < 100 else 'completed'
                
                cursor.execute('''
                    UPDATE compliance_requirements_tracking 
                    SET evidence_count = %s, compliance_percentage = %s, 
                        compliance_status = %s, last_evidence_timestamp = %s,
                        updated_at = %s
                    WHERE id = %s
                ''', (new_evidence_count, compliance_percentage, new_status, 
                         datetime.datetime.now(), datetime.datetime.now(), tracking_id))
                
            else:
                # Create new tracking record
                cursor.execute('''
                    INSERT INTO compliance_requirements_tracking 
                    (requirement_id, requirement_category, evidence_count, 
                     compliance_percentage, compliance_status, last_evidence_timestamp,
                     validation_criteria)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                ''', (requirement_id, requirement_spec['category'], 1, 10.0, 'in_progress',
                      datetime.datetime.now(), json.dumps(requirement_spec.get('validation_criteria', {}))))
            
            conn.commit()
            
        except Exception as e:
            self.logger.error(f"Error updating requirement status: {e}")
            conn.rollback()
        finally:
            cursor.close()
            conn.close()

    def _create_compliance_evidence(self, requirement_id: str, event_id: int, event_data: dict):
        """Create compliance evidence record"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            requirement_spec = self.compliance_requirements[requirement_id]
            evidence_type = requirement_spec['evidence_types'][0] if requirement_spec['evidence_types'] else 'general_evidence'
            
            # Create evidence hash
            evidence_str = f"{requirement_id}:{event_id}:{json.dumps(event_data, sort_keys=True)}"
            evidence_hash = hashlib.sha256(evidence_str.encode()).hexdigest()
            
            cursor.execute('''
                INSERT INTO compliance_evidence 
                (requirement_id, event_id, evidence_type, evidence_data, evidence_hash)
                VALUES (%s, %s, %s, %s, %s)
            ''', (requirement_id, event_id, evidence_type, json.dumps(event_data), evidence_hash))
            
            conn.commit()
            
        except Exception as e:
            self.logger.error(f"Error creating compliance evidence: {e}")
            conn.rollback()
        finally:
            cursor.close()
            conn.close()

    def get_compliance_dashboard_data(self, days: int = 30):
        """Get compliance dashboard data for the last N days"""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # Get compliance requirements summary
            cursor.execute('''
                SELECT requirement_category, 
                       COUNT(*) as total_requirements,
                       SUM(CASE WHEN compliance_status = 'completed' THEN 1 ELSE 0 END) as completed,
                       AVG(compliance_percentage) as avg_percentage
                FROM compliance_requirements_tracking
                GROUP BY requirement_category
            ''')
            requirements_summary = cursor.fetchall()
            
            # Get recent compliance events
            cursor.execute('''
                SELECT event_type, COUNT(*) as count, DATE(timestamp) as date
                FROM unified_compliance_events
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL %s DAY)
                GROUP BY event_type, DATE(timestamp)
                ORDER BY date DESC, count DESC
                LIMIT 100
            ''', (days,))
            recent_events = cursor.fetchall()
            
            # Get compliance evidence summary
            cursor.execute('''
                SELECT ce.evidence_type, ce.validation_status, COUNT(*) as count
                FROM compliance_evidence ce
                JOIN unified_compliance_events uce ON ce.event_id = uce.id
                WHERE uce.timestamp >= DATE_SUB(NOW(), INTERVAL %s DAY)
                GROUP BY ce.evidence_type, ce.validation_status
            ''', (days,))
            evidence_summary = cursor.fetchall()
            
            # Get overall compliance metrics
            cursor.execute('''
                SELECT 
                    COUNT(DISTINCT requirement_id) as total_requirements,
                    SUM(CASE WHEN compliance_status = 'completed' THEN 1 ELSE 0 END) as completed_requirements,
                    AVG(compliance_percentage) as overall_percentage
                FROM compliance_requirements_tracking
            ''')
            overall_metrics = cursor.fetchone()
            
            return {
                'success': True,
                'requirements_summary': requirements_summary,
                'recent_events': recent_events,
                'evidence_summary': evidence_summary,
                'overall_metrics': overall_metrics,
                'period_days': days,
                'generated_at': datetime.datetime.now().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error getting compliance dashboard data: {e}")
            return {'success': False, 'error': str(e)}
        finally:
            cursor.close()
            conn.close()

    def log_user_access(self, user_id: str, session_id: str, access_type: str, ip_address: str = None, user_agent: str = None):
        """Log user access for compliance tracking"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO unified_user_access_log 
                (user_id, session_id, access_type, ip_address, user_agent)
                VALUES (%s, %s, %s, %s, %s)
            ''', (user_id, session_id, access_type, ip_address, user_agent))
            
            conn.commit()
            
        except Exception as e:
            self.logger.error(f"Error logging user access: {e}")
            conn.rollback()
        finally:
            cursor.close()
            conn.close()

    def get_requirement_details(self, requirement_id: str):
        """Get detailed information about a specific compliance requirement"""
        if requirement_id not in self.compliance_requirements:
            return None
        
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # Get tracking information
            cursor.execute('''
                SELECT * FROM compliance_requirements_tracking 
                WHERE requirement_id = %s
            ''', (requirement_id,))
            tracking_info = cursor.fetchone()
            
            # Get evidence
            cursor.execute('''
                SELECT ce.*, uce.event_type, uce.timestamp as event_timestamp
                FROM compliance_evidence ce
                JOIN unified_compliance_events uce ON ce.event_id = uce.id
                WHERE ce.requirement_id = %s
                ORDER BY ce.created_at DESC
                LIMIT 50
            ''', (requirement_id,))
            evidence_records = cursor.fetchall()
            
            return {
                'requirement_spec': self.compliance_requirements[requirement_id],
                'tracking_info': tracking_info,
                'evidence_records': evidence_records
            }
            
        except Exception as e:
            self.logger.error(f"Error getting requirement details: {e}")
            return None
        finally:
            cursor.close()
            conn.close()
