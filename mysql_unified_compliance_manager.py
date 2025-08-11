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
from software_compliance_requirements import SOFTWARE_TRACKABLE_REQUIREMENTS

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
            'ML_MODEL_TRAINED': ['AI_ML_VALIDATION', 'AI_ML_VERSION_CONTROL', 'AI_ML_TRAINING_VALIDATION'],
            'ML_PREDICTION_MADE': ['AI_ML_VALIDATION', 'AI_ML_PERFORMANCE_MONITORING'],
            'ML_FEEDBACK_SUBMITTED': ['AI_ML_VALIDATION', 'AI_ML_AUDIT_COMPLIANCE'],
            'ML_MODEL_RETRAINED': ['AI_ML_VERSION_CONTROL', 'AI_ML_TRAINING_VALIDATION'],
            'ML_ACCURACY_VALIDATED': ['AI_ML_PERFORMANCE_MONITORING', 'AI_ML_VALIDATION'],
            
            # Core qPCR Analysis Activities
            'ANALYSIS_COMPLETED': ['CFR_11_10_A', 'CFR_11_10_C', 'CLIA_493_1251'],
            'REPORT_GENERATED': ['CFR_11_10_C', 'CFR_11_10_D', 'ISO_15189_5_8_2'],
            'THRESHOLD_ADJUSTED': ['CFR_11_10_A', 'CLIA_493_1252'],
            'DATA_EXPORTED': ['CFR_11_10_C', 'CFR_11_10_D', 'ISO_15189_4_14_7'],
            
            # Quality Control Through Software
            'QC_ANALYZED': ['CLIA_493_1251', 'CAP_GEN_43400', 'ISO_15189_5_5_1'],
            'CONTROL_ANALYZED': ['CLIA_493_1252', 'CAP_GEN_43420'],
            'NEGATIVE_CONTROL_VERIFIED': ['CLIA_493_1253', 'CAP_GEN_43400'],
            'POSITIVE_CONTROL_VERIFIED': ['CLIA_493_1253', 'CAP_GEN_43400'],
            
            # System Validation & Software Operation
            'SYSTEM_VALIDATION': ['CFR_11_10_A', 'CAP_GEN_40425'],
            'SOFTWARE_FEATURE_USED': ['CFR_11_10_A', 'CFR_11_10_G'],
            'CONFIGURATION_CHANGED': ['CFR_11_10_A', 'CFR_11_10_E'],
            
            # Data Security & Access Control
            'DATA_ENCRYPTED': ['DATA_ENCRYPTION_TRANSIT', 'DATA_ENCRYPTION_REST'],
            'USER_LOGIN': ['ACCESS_LOGGING', 'ENTRA_SSO_INTEGRATION'],
            'ACCESS_DENIED': ['ACCESS_LOGGING', 'ENTRA_CONDITIONAL_ACCESS'],
            'FILE_UPLOADED': ['CFR_11_10_B', 'DATA_ENCRYPTION_TRANSIT'],
            'DATA_MODIFIED': ['CFR_11_10_B', 'ACCESS_LOGGING'],
            
            # Training & Competency
            'TRAINING_COMPLETED': ['CLIA_493_1281', 'CAP_GEN_43420'],
            'COMPETENCY_ASSESSED': ['CLIA_493_1281'],
        }
        
        # SOFTWARE-SPECIFIC compliance requirements with auto-tracking mechanisms
        # Import software-trackable requirements
        self.compliance_requirements = {}
        self._load_software_trackable_requirements()

    def get_connection(self):
        """Get MySQL database connection"""
        # Ensure charset is specified for proper Unicode handling
        config = self.mysql_config.copy()
        if 'charset' not in config:
            config['charset'] = 'utf8mb4'
        return mysql.connector.connect(**config)

    def initialize_tables(self):
        """Create MySQL tables for unified compliance tracking"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Create unified compliance events table
            try:
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
                self.logger.info("Created unified_compliance_events table")
            except Exception as e:
                self.logger.error(f"Error creating unified_compliance_events table: {e}")
            
            # Create compliance requirements tracking table
            try:
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
                self.logger.info("Created compliance_requirements_tracking table")
            except Exception as e:
                self.logger.error(f"Error creating compliance_requirements_tracking table: {e}")
            
            # Create compliance evidence table (note: this depends on unified_compliance_events)
            try:
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
                        INDEX idx_requirement_id (requirement_id),
                        INDEX idx_event_id (event_id),
                        INDEX idx_evidence_type (evidence_type),
                        INDEX idx_validation_status (validation_status)
                    )
                ''')
                
                # Add foreign key constraint separately to handle dependency issues
                try:
                    cursor.execute('''
                        SELECT COUNT(*) FROM information_schema.table_constraints 
                        WHERE constraint_name = 'fk_compliance_evidence_event_id' 
                        AND table_name = 'compliance_evidence'
                    ''')
                    if cursor.fetchone()[0] == 0:
                        cursor.execute('''
                            ALTER TABLE compliance_evidence 
                            ADD CONSTRAINT fk_compliance_evidence_event_id 
                            FOREIGN KEY (event_id) REFERENCES unified_compliance_events(id)
                        ''')
                except Exception as fk_error:
                    self.logger.warning(f"Could not add foreign key constraint: {fk_error}")
                    
                self.logger.info("Created compliance_evidence table")
            except Exception as e:
                self.logger.error(f"Error creating compliance_evidence table: {e}")
            
            # Create user access log for compliance tracking
            try:
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
                self.logger.info("Created unified_user_access_log table")
            except Exception as e:
                self.logger.error(f"Error creating unified_user_access_log table: {e}")
            
            conn.commit()
            self.logger.info("Unified compliance tables initialization completed")
            
        except Exception as e:
            self.logger.error(f"Error in unified compliance tables initialization: {e}")
            conn.rollback()
            # Don't raise here - allow app to continue even if some tables fail
        finally:
            cursor.close()
            conn.close()

    def _load_software_trackable_requirements(self):
        """Load software-trackable requirements from the imported module"""
        for org_key, org_data in SOFTWARE_TRACKABLE_REQUIREMENTS.items():
            trackable_reqs = org_data.get('trackable_requirements', {})
            
            for req_id, req_spec in trackable_reqs.items():
                # Convert to our internal format
                self.compliance_requirements[req_id] = {
                    'title': req_spec.get('title', req_id),
                    'description': req_spec.get('description', ''),
                    'category': org_key,
                    'evidence_types': [req_spec.get('evidence_type', 'general_evidence')],
                    'auto_trackable': req_spec.get('auto_trackable', False),
                    'tracking_events': req_spec.get('tracked_by', []),
                    'section': req_spec.get('section', ''),
                    'organization': org_data.get('organization', org_key)
                }
        
        self.logger.info(f"Loaded {len(self.compliance_requirements)} software-trackable requirements")
        
        # Initialize all requirements in database
        self._initialize_requirements_in_database()

    def _initialize_requirements_in_database(self):
        """Ensure all compliance requirements are in the database"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            for req_id, req_spec in self.compliance_requirements.items():
                # Check if requirement already exists
                cursor.execute('''
                    SELECT id FROM compliance_requirements_tracking 
                    WHERE requirement_id = %s
                ''', (req_id,))
                
                if not cursor.fetchone():
                    # Create initial tracking record
                    cursor.execute('''
                        INSERT INTO compliance_requirements_tracking 
                        (requirement_id, requirement_category, evidence_count, 
                         compliance_percentage, compliance_status, validation_criteria)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    ''', (req_id, req_spec['category'], 0, 0.0, 'not_started',
                          json.dumps(req_spec.get('validation_criteria', {}))))
            
            conn.commit()
            self.logger.info(f"Initialized {len(self.compliance_requirements)} requirements in database")
            
        except Exception as e:
            self.logger.error(f"Error initializing requirements in database: {e}")
            conn.rollback()
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

    def track_compliance_event(self, event_type: str, event_data: dict, user_id: str = 'system', session_id: str = None):
        """
        Track a compliance event (alias for log_compliance_event for backward compatibility)
        This method exists to maintain compatibility with safe_compliance_tracker calls
        """
        return self.log_compliance_event(event_type, event_data, user_id, session_id)

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
        """Create compliance evidence record with smart deduplication"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            requirement_spec = self.compliance_requirements[requirement_id]
            evidence_type = requirement_spec['evidence_types'][0] if requirement_spec['evidence_types'] else 'general_evidence'
            
            # Create evidence hash for deduplication
            evidence_str = f"{requirement_id}:{event_id}:{json.dumps(event_data, sort_keys=True)}"
            evidence_hash = hashlib.sha256(evidence_str.encode()).hexdigest()
            
            # Smart deduplication: for analysis events, check for same file + fluorophore
            if event_data.get('filename') and event_data.get('fluorophore'):
                # Check if we already have evidence for this file + fluorophore combination
                cursor.execute('''
                    SELECT COUNT(*) FROM compliance_evidence ce
                    JOIN unified_compliance_events uce ON ce.event_id = uce.id
                    WHERE ce.requirement_id = %s 
                    AND JSON_EXTRACT(uce.event_data, '$.filename') = %s
                    AND JSON_EXTRACT(uce.event_data, '$.fluorophore') = %s
                ''', (requirement_id, event_data['filename'], event_data['fluorophore']))
                
                existing_file_count = cursor.fetchone()[0]
                
                if existing_file_count > 0:
                    self.logger.debug(f"Evidence already exists for {requirement_id} with file {event_data['filename']} + {event_data['fluorophore']}")
                    return  # Skip duplicate file analysis
            else:
                # Fallback to hash-based deduplication for non-analysis events
                cursor.execute('''
                    SELECT COUNT(*) FROM compliance_evidence 
                    WHERE requirement_id = %s AND evidence_hash = %s
                ''', (requirement_id, evidence_hash))
                
                existing_count = cursor.fetchone()[0]
                
                if existing_count > 0:
                    self.logger.debug(f"Evidence already exists for {requirement_id} with hash {evidence_hash[:16]}...")
                    return  # Skip duplicate evidence
            
            # Insert new evidence record
            cursor.execute('''
                INSERT INTO compliance_evidence 
                (requirement_id, event_id, evidence_type, evidence_data, evidence_hash)
                VALUES (%s, %s, %s, %s, %s)
            ''', (requirement_id, event_id, evidence_type, json.dumps(event_data), evidence_hash))
            
            conn.commit()
            self.logger.debug(f"Created new evidence for {requirement_id}")
            
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
            # Initialize default values in case queries return empty results
            requirements_summary = []
            recent_events = []
            evidence_summary = []
            overall_metrics = {
                'total_requirements': 0,
                'completed_requirements': 0, 
                'overall_percentage': 0.0
            }
            
            # Get compliance requirements summary - with error handling
            try:
                cursor.execute('''
                    SELECT requirement_category, 
                           COUNT(*) as total_requirements,
                           SUM(CASE WHEN compliance_status = 'completed' THEN 1 ELSE 0 END) as completed,
                           AVG(compliance_percentage) as avg_percentage
                    FROM compliance_requirements_tracking
                    GROUP BY requirement_category
                ''')
                requirements_summary = cursor.fetchall() or []
            except Exception as e:
                self.logger.warning(f"Could not fetch requirements summary: {e}")
                requirements_summary = []
            
            # Get recent compliance events - with error handling
            try:
                cursor.execute('''
                    SELECT event_type, COUNT(*) as count, DATE(timestamp) as date
                    FROM unified_compliance_events
                    WHERE timestamp >= DATE_SUB(NOW(), INTERVAL %s DAY)
                    GROUP BY event_type, DATE(timestamp)
                    ORDER BY date DESC, count DESC
                    LIMIT 100
                ''', (days,))
                recent_events = cursor.fetchall() or []
            except Exception as e:
                self.logger.warning(f"Could not fetch recent events: {e}")
                recent_events = []
            
            # Get compliance evidence summary - with error handling
            try:
                cursor.execute('''
                    SELECT ce.evidence_type, ce.validation_status, COUNT(*) as count
                    FROM compliance_evidence ce
                    JOIN unified_compliance_events uce ON ce.event_id = uce.id
                    WHERE uce.timestamp >= DATE_SUB(NOW(), INTERVAL %s DAY)
                    GROUP BY ce.evidence_type, ce.validation_status
                ''', (days,))
                evidence_summary = cursor.fetchall() or []
            except Exception as e:
                self.logger.warning(f"Could not fetch evidence summary: {e}")
                evidence_summary = []
            
            # Get overall compliance metrics - with error handling
            try:
                cursor.execute('''
                    SELECT 
                        COUNT(DISTINCT requirement_id) as total_requirements,
                        SUM(CASE WHEN compliance_status = 'completed' THEN 1 ELSE 0 END) as completed_requirements,
                        COALESCE(AVG(compliance_percentage), 0.0) as overall_percentage
                    FROM compliance_requirements_tracking
                ''')
                result = cursor.fetchone()
                if result:
                    overall_metrics = result
            except Exception as e:
                self.logger.warning(f"Could not fetch overall metrics: {e}")
            
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

    def get_requirements(self, category=None, status=None, regulation_number=None):
        """Get all compliance requirements with optional filtering"""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # Get tracking info for all requirements
            cursor.execute('''
                SELECT requirement_id, compliance_status, evidence_count, 
                       compliance_percentage, updated_at
                FROM compliance_requirements_tracking
            ''')
            tracking_data = {row['requirement_id']: row for row in cursor.fetchall()}
            
            # Build requirements list
            requirements = []
            for req_id, req_spec in self.compliance_requirements.items():
                tracking_info = tracking_data.get(req_id, {})
                
                requirement = {
                    'id': req_id,
                    'title': req_spec['title'],
                    'description': req_spec['description'],
                    'category': req_spec['category'],
                    'evidence_types': req_spec['evidence_types'],
                    'auto_trackable': req_spec.get('auto_trackable', False),
                    'implementation_status': tracking_info.get('compliance_status', 'not_started'),
                    'evidence_count': tracking_info.get('evidence_count', 0),
                    'compliance_percentage': float(tracking_info.get('compliance_percentage', 0)),
                    'last_updated': tracking_info.get('updated_at')
                }
                
                # Apply filters if provided
                if category and req_spec['category'] != category:
                    continue
                if status and requirement['implementation_status'] != status:
                    continue
                if regulation_number and regulation_number.lower() not in req_id.lower():
                    continue
                
                requirements.append(requirement)
            
            return {'requirements': requirements, 'total_count': len(requirements)}
            
        except Exception as e:
            self.logger.error(f"Error getting requirements: {e}")
            return {'requirements': [], 'total_count': 0}
        finally:
            cursor.close()
            conn.close()

    def get_evidence_summary(self):
        """Get summary of compliance evidence"""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # Get total evidence count
            cursor.execute('SELECT COUNT(*) as total_evidence FROM compliance_evidence')
            total_evidence = cursor.fetchone()['total_evidence']
            
            # Get evidence by type
            cursor.execute('''
                SELECT evidence_type, COUNT(*) as count 
                FROM compliance_evidence 
                GROUP BY evidence_type
            ''')
            by_type = {row['evidence_type']: row['count'] for row in cursor.fetchall()}
            
            # Get evidence by category (based on requirement categories)
            cursor.execute('''
                SELECT rt.requirement_id, COUNT(ce.id) as count
                FROM compliance_requirements_tracking rt
                LEFT JOIN compliance_evidence ce ON rt.requirement_id = ce.requirement_id
                GROUP BY rt.requirement_id
            ''')
            by_category = {}
            for row in cursor.fetchall():
                req_id = row['requirement_id']
                if req_id in self.compliance_requirements:
                    category = self.compliance_requirements[req_id]['category']
                    by_category[category] = by_category.get(category, 0) + row['count']
            
            # Get recent additions
            cursor.execute('''
                SELECT ce.*, uce.event_type, uce.timestamp
                FROM compliance_evidence ce
                JOIN unified_compliance_events uce ON ce.event_id = uce.id
                ORDER BY ce.created_at DESC
                LIMIT 5
            ''')
            recent_additions = cursor.fetchall()
            
            return {
                'total_evidence': total_evidence,
                'by_type': by_type,
                'by_category': by_category,
                'recent_additions': recent_additions
            }
            
        except Exception as e:
            self.logger.error(f"Error getting evidence summary: {e}")
            return {
                'total_evidence': 0,
                'by_type': {},
                'by_category': {},
                'recent_additions': []
            }
        finally:
            cursor.close()
            conn.close()

    def get_compliance_summary(self):
        """Get compliance dashboard summary statistics"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Get total requirements
            total_requirements = len(self.compliance_requirements)
            
            # Get currently tracking (requirements with recent events)
            cursor.execute('''
                SELECT DISTINCT requirement_id 
                FROM compliance_evidence 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            ''')
            currently_tracking = len(cursor.fetchall())
            
            # Get unique event types
            cursor.execute('''
                SELECT DISTINCT event_type 
                FROM unified_compliance_events 
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            ''')
            unique_event_types = len(cursor.fetchall())
            
            # Get total events
            cursor.execute('SELECT COUNT(*) FROM unified_compliance_events')
            total_events = cursor.fetchone()[0]
            
            return {
                'total_requirements': total_requirements,
                'currently_tracking': currently_tracking,
                'unique_event_types': unique_event_types,
                'total_events': total_events
            }
            
        except Exception as e:
            self.logger.error(f"Error getting compliance summary: {e}")
            return {
                'total_requirements': 0,
                'currently_tracking': 0,
                'unique_event_types': 0,
                'total_events': 0
            }
        finally:
            cursor.close()
            conn.close()

    def get_requirements_status(self):
        """Get all compliance requirements with their tracking status"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            requirements_list = []
            for req_id, req_data in self.compliance_requirements.items():
                # Get evidence count from compliance_evidence table
                cursor.execute('''
                    SELECT COUNT(*) FROM compliance_evidence 
                    WHERE requirement_id = %s
                ''', (req_id,))
                event_count = cursor.fetchone()[0]
                
                # Check if currently tracking from compliance_evidence
                cursor.execute('''
                    SELECT COUNT(*) FROM compliance_evidence 
                    WHERE requirement_id = %s 
                    AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                ''', (req_id,))
                recently_tracked = cursor.fetchone()[0] > 0
                
                # ALSO check compliance_requirements_tracking table (Railway compatibility)
                cursor.execute('''
                    SELECT compliance_status, evidence_count 
                    FROM compliance_requirements_tracking 
                    WHERE requirement_id = %s
                ''', (req_id,))
                tracking_result = cursor.fetchone()
                
                if tracking_result:
                    tracking_status, tracking_evidence_count = tracking_result
                    # Use tracking evidence count if higher
                    if tracking_evidence_count and tracking_evidence_count > event_count:
                        event_count = tracking_evidence_count
                    # Railway uses 'in_progress' for actively tracking
                    if tracking_status == 'in_progress':
                        recently_tracked = True
                
                currently_tracking = recently_tracked or event_count > 0
                
                # Determine implementation status - ANY evidence = active tracking
                if event_count > 0 or recently_tracked:
                    implementation_status = 'active'  # ANY evidence shows as currently tracking
                elif req_data.get('auto_trackable', False):
                    implementation_status = 'ready_to_implement'  # Can be auto-tracked
                else:
                    implementation_status = 'planned'  # Future implementation
                elif req_data.get('auto_trackable', False):
                    implementation_status = 'ready_to_implement'  # Can be auto-tracked
                else:
                    implementation_status = 'planned'  # Future implementation
                
                requirements_list.append({
                    'id': req_id,
                    'title': req_data['title'],
                    'category': req_data['category'],
                    'event_count': event_count,
                    'currently_tracking': currently_tracking,
                    'auto_trackable': req_data.get('auto_trackable', False),
                    'implementation_status': implementation_status
                })
            
            return requirements_list
            
        except Exception as e:
            self.logger.error(f"Error getting requirements status: {e}")
            return []
        finally:
            cursor.close()
            conn.close()

    def reset_evidence_counts_to_baseline(self, max_evidence_per_requirement: int = 20):
        """
        Reset evidence counts to reasonable baseline numbers for production
        Keeps only the most recent evidence records for each requirement
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            self.logger.info(f"Resetting evidence counts to baseline (max {max_evidence_per_requirement} per requirement)")
            
            total_removed = 0
            
            # Get all requirements with excessive evidence
            cursor.execute('''
                SELECT requirement_id, COUNT(*) as count
                FROM compliance_evidence 
                GROUP BY requirement_id
                HAVING count > %s
                ORDER BY count DESC
            ''', (max_evidence_per_requirement,))
            
            excessive_requirements = cursor.fetchall()
            
            for requirement_id, current_count in excessive_requirements:
                # Keep only the most recent evidence records
                cursor.execute('''
                    SELECT id FROM compliance_evidence 
                    WHERE requirement_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s, 999999
                ''', (requirement_id, max_evidence_per_requirement))
                
                ids_to_remove = [row[0] for row in cursor.fetchall()]
                
                if ids_to_remove:
                    placeholders = ','.join(['%s'] * len(ids_to_remove))
                    cursor.execute(f'''
                        DELETE FROM compliance_evidence 
                        WHERE id IN ({placeholders})
                    ''', ids_to_remove)
                    
                    removed_count = cursor.rowcount
                    total_removed += removed_count
                    self.logger.info(f"Reduced {requirement_id} from {current_count} to {max_evidence_per_requirement} records ({removed_count} removed)")
            
            # Recalculate evidence counts in tracking table
            cursor.execute('''
                SELECT requirement_id, COUNT(*) as actual_count
                FROM compliance_evidence 
                GROUP BY requirement_id
            ''')
            actual_counts = cursor.fetchall()
            
            for requirement_id, actual_count in actual_counts:
                cursor.execute('''
                    UPDATE compliance_requirements_tracking 
                    SET evidence_count = %s,
                        compliance_percentage = %s,
                        updated_at = %s
                    WHERE requirement_id = %s
                ''', (
                    actual_count,
                    min(100.0, (actual_count / 10) * 100),
                    datetime.datetime.now(),
                    requirement_id
                ))
            
            conn.commit()
            self.logger.info(f"Evidence baseline reset completed. Total records removed: {total_removed}")
            return total_removed
            
        except Exception as e:
            self.logger.error(f"Error resetting evidence baseline: {e}")
            conn.rollback()
            return 0
        finally:
            cursor.close()
            conn.close()

    def get_recent_events(self, limit=10):
        """Get recent compliance events"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT event_type, user_id, timestamp, event_data 
                FROM unified_compliance_events 
                ORDER BY timestamp DESC 
                LIMIT %s
            ''', (limit,))
            
            events = []
            for event_type, user_id, timestamp, event_data in cursor.fetchall():
                events.append({
                    'event_type': event_type,
                    'user_id': user_id,
                    'timestamp': timestamp.isoformat() if timestamp else None,
                    'event_data': json.loads(event_data) if event_data else {}
                })
            
            return events
            
        except Exception as e:
            self.logger.error(f"Error getting recent events: {e}")
            return []
        finally:
            cursor.close()
            conn.close()
