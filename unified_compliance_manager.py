"""
Unified Validation & Compliance Manager - Software-Specific Compliance
Tracks only compliance requirements that can be satisfied by running the qPCR analysis software
Focus on auto-trackable requirements that demonstrate real software validation
"""

import sqlite3
import json
import hashlib
import datetime
from typing import Dict, List, Optional, Any, Tuple
import logging

class UnifiedComplianceManager:
    def __init__(self, db_path: str = 'qpcr_analysis.db'):
        self.db_path = db_path
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
            
            # Security & Access Control (When Implemented)
            'USER_LOGIN': ['ACCESS_CONTROL_SOFTWARE', 'USER_AUTHENTICATION_TRACKING'],
            'USER_LOGOUT': ['SESSION_MANAGEMENT_SOFTWARE', 'ACCESS_AUDIT_TRAIL'],
            'ROLE_ASSIGNED': ['ROLE_BASED_ACCESS_CONTROL', 'USER_PERMISSION_MANAGEMENT'],
            'PERMISSION_CHANGED': ['ACCESS_CONTROL_SOFTWARE', 'PERMISSION_AUDIT_TRAIL'],
            'DATA_ENCRYPTED': ['ENCRYPTION_SOFTWARE_IMPLEMENTATION', 'DATA_SECURITY_TRACKING'],
            'ALGORITHM_VALIDATED': ['ENCRYPTION_ALGORITHM_VALIDATION', 'CRYPTO_SOFTWARE_VALIDATION'],
            'ACCESS_DENIED': ['ACCESS_CONTROL_SOFTWARE', 'SECURITY_EVENT_TRACKING'],
            'SESSION_TIMEOUT': ['SESSION_MANAGEMENT_SOFTWARE', 'TIMEOUT_POLICY_ENFORCEMENT'],
            'PASSWORD_CHANGED': ['PASSWORD_POLICY_ENFORCEMENT', 'SECURITY_TRACKING'],
            
            # Data Integrity & Electronic Records
            'DATA_MODIFIED': ['DATA_MODIFICATION_TRACKING', 'AUDIT_TRAIL_GENERATION'],
            'FILE_UPLOADED': ['FILE_INTEGRITY_TRACKING', 'DATA_INPUT_VALIDATION'],
            'CALCULATION_PERFORMED': ['CALCULATION_VALIDATION', 'ALGORITHM_VERIFICATION'],
            'RESULT_VERIFIED': ['RESULT_VERIFICATION_TRACKING', 'QUALITY_ASSURANCE_SOFTWARE']
        }
    
    def initialize_tables(self):
        """Initialize all compliance-related database tables"""
        with self.get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Create compliance_requirements table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS compliance_requirements (
                    requirement_code TEXT PRIMARY KEY,
                    requirement_name TEXT NOT NULL,
                    requirement_title TEXT NOT NULL,
                    category TEXT NOT NULL,
                    compliance_category TEXT NOT NULL,
                    description TEXT NOT NULL,
                    compliance_status TEXT DEFAULT 'not_implemented',
                    target_score INTEGER DEFAULT 95,
                    current_score INTEGER DEFAULT 0,
                    last_assessment DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_assessed_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    validation_method TEXT DEFAULT 'automated',
                    priority_level TEXT DEFAULT 'medium',
                    criticality_level TEXT DEFAULT 'medium',
                    regulation_source TEXT DEFAULT 'CFR_Title_21',
                    section_number TEXT DEFAULT '211.68',
                    frequency TEXT DEFAULT 'monthly',
                    auto_trackable INTEGER DEFAULT 1,
                    next_assessment_date DATE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create compliance_evidence table (if not exists)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS compliance_evidence (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    requirement_code TEXT NOT NULL,
                    evidence_type TEXT NOT NULL,
                    evidence_source TEXT NOT NULL,
                    evidence_data TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    compliance_score INTEGER NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (requirement_code) REFERENCES compliance_requirements(requirement_code)
                )
            """)
            
            # Create compliance_status_log table (if not exists)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS compliance_status_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    requirement_code TEXT NOT NULL,
                    old_status TEXT,
                    new_status TEXT NOT NULL,
                    change_reason TEXT,
                    user_id TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (requirement_code) REFERENCES compliance_requirements(requirement_code)
                )
            """)
            
            # Create compliance_gaps table (if not exists)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS compliance_gaps (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    requirement_code TEXT NOT NULL,
                    gap_description TEXT NOT NULL,
                    gap_category TEXT DEFAULT 'general',
                    gap_severity TEXT DEFAULT 'medium',
                    priority_level TEXT DEFAULT 'medium',
                    resolution_status TEXT DEFAULT 'open',
                    status TEXT DEFAULT 'open',
                    target_resolution_date DATE,
                    created_by TEXT DEFAULT 'system',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    resolved_at DATETIME,
                    resolution_notes TEXT,
                    FOREIGN KEY (requirement_code) REFERENCES compliance_requirements(requirement_code)
                )
            """)
            
            # Initialize basic compliance requirements
            self._initialize_basic_requirements(cursor)
            
            conn.commit()
            self.logger.info("Compliance tables initialized successfully")
    
    def _initialize_basic_requirements(self, cursor):
        """Initialize basic compliance requirements"""
        basic_requirements = [
            ('ML_MODEL_VALIDATION', 'ML Model Validation', 'ML Model Validation', 'ml_validation', 'ml_validation', 'Machine learning models must be validated', 'CFR_Title_21_Part_211', '211.68', 'high'),
            ('ML_VERSION_CONTROL', 'ML Version Control', 'ML Version Control', 'ml_validation', 'ml_validation', 'Version control for ML models', 'CFR_Title_21_Part_211', '211.68', 'high'),
            ('ML_PERFORMANCE_TRACKING', 'ML Performance Tracking', 'ML Performance Tracking', 'ml_validation', 'ml_validation', 'Track ML model performance', 'CFR_Title_21_Part_211', '211.68', 'high'),
            ('ANALYSIS_EXECUTION_TRACKING', 'Analysis Execution Tracking', 'Analysis Execution Tracking', 'qpcr_analysis', 'qpcr_analysis', 'Track qPCR analysis execution', 'CFR_Title_21_Part_820', '820.70', 'high'),
            ('ELECTRONIC_RECORDS_CREATION', 'Electronic Records Creation', 'Electronic Records Creation', 'data_integrity', 'data_integrity', 'Creation of electronic records', 'CFR_Title_21_Part_11', '11.10', 'critical'),
            ('QC_SOFTWARE_EXECUTION', 'QC Software Execution', 'QC Software Execution', 'quality_control', 'quality_control', 'Quality control through software', 'CFR_Title_21_Part_820', '820.70', 'high'),
            ('SOFTWARE_VALIDATION_EXECUTION', 'Software Validation', 'Software Validation', 'system_validation', 'system_validation', 'Software validation execution', 'CFR_Title_21_Part_820', '820.70', 'critical'),
            ('DATA_INTEGRITY_TRACKING', 'Data Integrity Tracking', 'Data Integrity Tracking', 'data_integrity', 'data_integrity', 'Track data integrity', 'CFR_Title_21_Part_11', '11.10', 'critical'),
            ('AUDIT_TRAIL_GENERATION', 'Audit Trail Generation', 'Audit Trail Generation', 'data_integrity', 'data_integrity', 'Generate audit trails', 'CFR_Title_21_Part_11', '11.10', 'critical'),
        ]
        
        for req_code, name, title, category, comp_category, description, reg_source, section, criticality in basic_requirements:
            cursor.execute("""
                INSERT OR IGNORE INTO compliance_requirements 
                (requirement_code, requirement_name, requirement_title, category, compliance_category, 
                 description, regulation_source, section_number, criticality_level)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (req_code, name, title, category, comp_category, description, reg_source, section, criticality))
    
    def get_db_connection(self):
        """Get database connection with proper settings"""
        conn = sqlite3.connect(self.db_path, timeout=30.0)  # 30 second timeout
        conn.row_factory = sqlite3.Row
        # Enable WAL mode for better concurrent access
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA synchronous=NORMAL')
        conn.execute('PRAGMA cache_size=10000')
        conn.execute('PRAGMA temp_store=MEMORY')
        return conn
    
    def track_compliance_event(self, event_type: str, event_data: Dict[str, Any], 
                             user_id: str = 'system') -> List[str]:
        """
        Track a system event and update related compliance requirements
        Returns list of requirement codes that were updated
        """
        updated_requirements = []
        
        # Get requirements affected by this event
        affected_requirements = self.event_to_requirements_map.get(event_type, [])
        
        for req_code in affected_requirements:
            try:
                # Record evidence for this requirement with retry logic
                evidence_id = self._record_evidence_with_retry(
                    requirement_code=req_code,
                    evidence_type='automated_log',
                    evidence_source=f'system_event_{event_type}',
                    evidence_data=event_data,
                    user_id=user_id
                )
                
                # Update compliance status with retry logic
                self._update_status_with_retry(req_code, user_id)
                updated_requirements.append(req_code)
                
                self.logger.info(f"Updated compliance for {req_code} based on {event_type}")
                
            except Exception as e:
                self.logger.error(f"Error updating compliance for {req_code}: {e}")
                # Continue with other requirements even if one fails
        
        return updated_requirements
    
    def _record_evidence_with_retry(self, requirement_code: str, evidence_type: str,
                                   evidence_source: str, evidence_data: Dict,
                                   user_id: str = 'user', max_retries: int = 3) -> int:
        """Record evidence with retry logic for database locks"""
        import time
        
        for attempt in range(max_retries):
            try:
                return self.record_compliance_evidence(
                    requirement_code, evidence_type, evidence_source, 
                    evidence_data, user_id
                )
            except sqlite3.OperationalError as e:
                if "database is locked" in str(e) and attempt < max_retries - 1:
                    time.sleep(0.1 * (attempt + 1))  # Exponential backoff
                    continue
                else:
                    raise e
        
        raise Exception("Failed to record evidence after retries")
    
    def _update_status_with_retry(self, requirement_code: str, user_id: str = 'user', max_retries: int = 3):
        """Update status with retry logic for database locks"""
        import time
        
        for attempt in range(max_retries):
            try:
                self.update_requirement_status(requirement_code, user_id)
                return
            except sqlite3.OperationalError as e:
                if "database is locked" in str(e) and attempt < max_retries - 1:
                    time.sleep(0.1 * (attempt + 1))  # Exponential backoff
                    continue
                else:
                    raise e
        
        raise Exception("Failed to update status after retries")
    
    def record_compliance_evidence(self, requirement_code: str, evidence_type: str,
                                 evidence_source: str, evidence_data: Dict,
                                 user_id: str = 'user') -> int:
        """Record evidence for a compliance requirement"""
        with self.get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Ensure compliance_evidence table exists
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS compliance_evidence (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    requirement_code TEXT NOT NULL,
                    evidence_type TEXT NOT NULL,
                    evidence_source TEXT NOT NULL,
                    evidence_data TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    compliance_score INTEGER NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (requirement_code) REFERENCES compliance_requirements(requirement_code)
                )
            """)
            
            # Calculate compliance score based on evidence quality
            compliance_score = self._calculate_evidence_score(evidence_type, evidence_data)
            
            cursor.execute("""
                INSERT INTO compliance_evidence 
                (requirement_code, evidence_type, evidence_source, evidence_data,
                 user_id, compliance_score)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (requirement_code, evidence_type, evidence_source, 
                  json.dumps(evidence_data), user_id, compliance_score))
            
            return cursor.lastrowid
    
    def _calculate_evidence_score(self, evidence_type: str, evidence_data: Dict) -> int:
        """Calculate compliance score based on evidence quality"""
        base_score = {
            'automated_log': 90,      # High confidence in automated evidence
            'test_result': 95,        # Very high confidence in test results
            'manual_entry': 70,       # Lower confidence in manual entries
            'document_upload': 85,    # Good confidence in documents
            'api_call': 88           # High confidence in API data
        }.get(evidence_type, 50)
        
        # Adjust score based on evidence completeness
        required_fields = ['timestamp', 'user_id', 'session_id']
        completeness = sum(1 for field in required_fields if field in evidence_data)
        completeness_bonus = (completeness / len(required_fields)) * 10
        
        return min(100, base_score + completeness_bonus)
    
    def update_requirement_status(self, requirement_code: str, user_id: str = 'user'):
        """Update the compliance status of a requirement based on recent evidence"""
        with self.get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check if requirement exists first
            cursor.execute("""
                SELECT * FROM compliance_requirements 
                WHERE requirement_code = ?
            """, (requirement_code,))
            requirement = cursor.fetchone()
            
            if not requirement:
                # Requirement doesn't exist, skip silently (may be in development)
                self.logger.warning(f"Requirement {requirement_code} not found in database")
                return
            
            # Get recent evidence for this requirement
            cursor.execute("""
                SELECT AVG(compliance_score) as avg_score, COUNT(*) as evidence_count,
                       MAX(timestamp) as last_evidence
                FROM compliance_evidence 
                WHERE requirement_code = ? 
                AND timestamp >= datetime('now', '-30 days')
            """, (requirement_code,))
            
            evidence_summary = cursor.fetchone()
            
            # Determine new status
            new_status = self._determine_compliance_status(
                requirement, evidence_summary, cursor
            )
            
            # Get current status
            cursor.execute("""
                SELECT compliance_status FROM compliance_requirements 
                WHERE requirement_code = ?
            """, (requirement_code,))
            current_row = cursor.fetchone()
            if not current_row:
                return
            
            current_status = current_row['compliance_status']
            
            # Update status if changed
            if new_status != current_status:
                cursor.execute("""
                    UPDATE compliance_requirements 
                    SET compliance_status = ?, last_assessed_date = ?
                    WHERE requirement_code = ?
                """, (new_status, datetime.date.today().isoformat(), requirement_code))
                
                # Ensure compliance_status_log table exists
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS compliance_status_log (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        requirement_code TEXT NOT NULL,
                        previous_status TEXT NOT NULL,
                        new_status TEXT NOT NULL,
                        change_reason TEXT,
                        changed_by TEXT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Log the status change
                cursor.execute("""
                    INSERT INTO compliance_status_log 
                    (requirement_code, previous_status, new_status, 
                     change_reason, changed_by)
                    VALUES (?, ?, ?, ?, ?)
                """, (requirement_code, current_status, new_status,
                      f"Automated update based on recent evidence", user_id))
    
    def _determine_compliance_status(self, requirement: sqlite3.Row, 
                                   evidence_summary: sqlite3.Row, 
                                   cursor: sqlite3.Cursor) -> str:
        """Determine compliance status based on requirement type and evidence"""
        
        if not evidence_summary or evidence_summary['evidence_count'] == 0:
            return 'unknown'
        
        avg_score = evidence_summary['avg_score'] or 0
        evidence_count = evidence_summary['evidence_count'] or 0
        last_evidence = evidence_summary['last_evidence']
        
        # Check frequency requirements
        frequency = requirement['frequency']
        days_since_evidence = self._days_since_timestamp(last_evidence)
        
        frequency_compliance = self._check_frequency_compliance(frequency, days_since_evidence)
        
        # Overall compliance determination
        if avg_score >= 90 and evidence_count >= 3 and frequency_compliance:
            return 'compliant'
        elif avg_score >= 70 and evidence_count >= 1 and frequency_compliance:
            return 'partial'
        else:
            return 'non_compliant'
    
    def _days_since_timestamp(self, timestamp_str: str) -> int:
        """Calculate days since timestamp"""
        if not timestamp_str:
            return 999  # Very old
        
        try:
            timestamp = datetime.datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            now = datetime.datetime.now()
            return (now - timestamp).days
        except:
            return 999
    
    def _check_frequency_compliance(self, frequency: str, days_since: int) -> bool:
        """Check if evidence frequency meets requirement"""
        frequency_limits = {
            'daily': 1,
            'weekly': 7,
            'monthly': 30,
            'quarterly': 90,
            'annual': 365,
            'continuous': 7,  # Expect evidence within week for continuous monitoring
            'per_test': 1,    # Should have evidence for recent tests
            'per_change': 30, # Should have evidence within 30 days of changes
            'as_needed': 90,  # Should have evidence within 3 months if applicable
            'scheduled': 30,  # Should follow maintenance schedules
            'event_based': 7  # Should have evidence within week if events occurred
        }
        
        limit = frequency_limits.get(frequency, 30)
        return days_since <= limit
    
    def get_compliance_dashboard_data(self, days: int = 30) -> Dict[str, Any]:
        """Get comprehensive compliance dashboard data with specific requirements"""
        # Updated to include compliance_percentage
        with self.get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get overall compliance summary
            cursor.execute("""
                SELECT 
                    regulation_source,
                    compliance_category,
                    compliance_status,
                    COUNT(*) as requirement_count
                FROM compliance_requirements
                GROUP BY regulation_source, compliance_category, compliance_status
            """)
            compliance_summary = cursor.fetchall()
            
            # Get requirements needing attention
            cursor.execute("""
                SELECT requirement_code, requirement_title, compliance_status,
                       regulation_source, section_number, criticality_level,
                       last_assessed_date, frequency
                FROM compliance_requirements
                WHERE compliance_status IN ('non_compliant', 'unknown', 'partial')
                ORDER BY 
                    CASE criticality_level 
                        WHEN 'critical' THEN 1 
                        WHEN 'major' THEN 2 
                        ELSE 3 
                    END,
                    requirement_code
            """)
            attention_needed = cursor.fetchall()
            
            # Get recent compliance activities
            cursor.execute("""
                SELECT ce.requirement_code, cr.requirement_title, ce.evidence_type,
                       ce.timestamp, ce.compliance_score, cr.regulation_source
                FROM compliance_evidence ce
                JOIN compliance_requirements cr ON ce.requirement_code = cr.requirement_code
                WHERE ce.timestamp >= datetime('now', '-{} days')
                ORDER BY ce.timestamp DESC
                LIMIT 50
            """.format(days))
            recent_activities = cursor.fetchall()
            
            # Get compliance gaps
            cursor.execute("""
                SELECT cg.requirement_code, cr.requirement_title, cg.gap_description,
                       cg.gap_severity, cg.target_resolution_date, cg.status,
                       cr.regulation_source
                FROM compliance_gaps cg
                JOIN compliance_requirements cr ON cg.requirement_code = cr.requirement_code
                WHERE cg.status IN ('open', 'in_progress')
                ORDER BY 
                    CASE cg.gap_severity 
                        WHEN 'critical' THEN 1 
                        WHEN 'high' THEN 2 
                        WHEN 'medium' THEN 3 
                        ELSE 4 
                    END
            """)
            compliance_gaps = cursor.fetchall()
            
            # Calculate compliance scores by regulation
            regulation_scores = self._calculate_regulation_scores(cursor)
            
            # Get auto-trackable vs manual requirements
            cursor.execute("""
                SELECT auto_trackable, compliance_status, COUNT(*) as count
                FROM compliance_requirements
                GROUP BY auto_trackable, compliance_status
            """)
            tracking_summary = cursor.fetchall()
            
            # Calculate compliance percentage for frontend display
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN compliance_status = 'compliant' THEN 1 ELSE 0 END) as compliant
                FROM compliance_requirements
            """)
            totals = cursor.fetchone()
            compliance_percentage = round((totals['compliant'] / max(totals['total'], 1)) * 100, 1)
            
            # Calculate auto-trackable percentage
            cursor.execute("""
                SELECT COUNT(*) as auto_trackable_count
                FROM compliance_requirements
                WHERE auto_trackable = 1
            """)
            auto_trackable_count = cursor.fetchone()['auto_trackable_count']
            auto_trackable_percentage = round((auto_trackable_count / max(totals['total'], 1)) * 100, 1)
            
            return {
                'ml_validation_metrics': self.ml_validation_manager.get_validation_metrics() if hasattr(self, 'ml_validation_manager') else {},
                'auto_trackable_percentage': auto_trackable_percentage,
                'software_specific_focus': True,  # Indicates this dashboard focuses on software-demonstrable requirements
                'compliance_summary': self._format_compliance_summary(compliance_summary),
                'attention_needed': [dict(row) for row in attention_needed],
                'recent_activities': [dict(row) for row in recent_activities],
                'compliance_gaps': [dict(row) for row in compliance_gaps],
                'regulation_scores': regulation_scores,
                'tracking_summary': self._format_tracking_summary(tracking_summary),
                'overall_score': self._calculate_overall_compliance_score(cursor),
                'compliance_percentage': compliance_percentage,
                'recommendations': self._generate_compliance_recommendations(cursor),
                'period': {
                    'start': (datetime.date.today() - datetime.timedelta(days=days)).isoformat(),
                    'end': datetime.date.today().isoformat()
                }
            }
    
    def _format_compliance_summary(self, summary_data: List[sqlite3.Row]) -> Dict:
        """Format compliance summary by regulation and category"""
        formatted = {}
        for row in summary_data:
            reg_source = row['regulation_source']
            category = row['compliance_category']
            status = row['compliance_status']
            count = row['requirement_count']
            
            if reg_source not in formatted:
                formatted[reg_source] = {}
            if category not in formatted[reg_source]:
                formatted[reg_source][category] = {}
            
            formatted[reg_source][category][status] = count
        
        return formatted
    
    def _format_tracking_summary(self, tracking_data: List[sqlite3.Row]) -> Dict:
        """Format tracking capability summary"""
        auto_trackable = {'compliant': 0, 'partial': 0, 'non_compliant': 0, 'unknown': 0}
        manual_required = {'compliant': 0, 'partial': 0, 'non_compliant': 0, 'unknown': 0}
        
        for row in tracking_data:
            status = row['compliance_status']
            count = row['count']
            
            if row['auto_trackable']:
                auto_trackable[status] = auto_trackable.get(status, 0) + count
            else:
                manual_required[status] = manual_required.get(status, 0) + count
        
        return {
            'auto_trackable': auto_trackable,
            'manual_required': manual_required
        }
    
    def _calculate_regulation_scores(self, cursor: sqlite3.Cursor) -> Dict[str, Dict]:
        """Calculate compliance scores by regulation source"""
        cursor.execute("""
            SELECT regulation_source, compliance_status, criticality_level, COUNT(*) as count
            FROM compliance_requirements
            GROUP BY regulation_source, compliance_status, criticality_level
        """)
        
        regulation_data = cursor.fetchall()
        scores = {}
        
        for row in regulation_data:
            reg_source = row['regulation_source']
            status = row['compliance_status']
            criticality = row['criticality_level']
            count = row['count']
            
            if reg_source not in scores:
                scores[reg_source] = {
                    'total_requirements': 0,
                    'compliant': 0,
                    'critical_compliant': 0,
                    'critical_total': 0,
                    'score': 0
                }
            
            scores[reg_source]['total_requirements'] += count
            
            if criticality == 'critical':
                scores[reg_source]['critical_total'] += count
                if status == 'compliant':
                    scores[reg_source]['critical_compliant'] += count
            
            if status == 'compliant':
                scores[reg_source]['compliant'] += count
        
        # Calculate scores
        for reg_source in scores:
            data = scores[reg_source]
            if data['total_requirements'] > 0:
                # Weight critical requirements more heavily
                critical_score = (data['critical_compliant'] / max(1, data['critical_total'])) * 100
                overall_score = (data['compliant'] / data['total_requirements']) * 100
                # Weighted average: 70% critical, 30% overall
                data['score'] = round((critical_score * 0.7) + (overall_score * 0.3), 1)
            else:
                data['score'] = 0
        
        return scores
    
    def _calculate_overall_compliance_score(self, cursor: sqlite3.Cursor) -> int:
        """Calculate overall compliance score across all regulations"""
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN compliance_status = 'compliant' THEN 1 ELSE 0 END) as compliant,
                SUM(CASE WHEN criticality_level = 'critical' THEN 1 ELSE 0 END) as critical_total,
                SUM(CASE WHEN criticality_level = 'critical' AND compliance_status = 'compliant' 
                         THEN 1 ELSE 0 END) as critical_compliant
            FROM compliance_requirements
        """)
        
        result = cursor.fetchone()
        
        if result['total'] == 0:
            return 0
        
        # Weight critical requirements heavily (80%), others 20%
        critical_score = (result['critical_compliant'] / max(1, result['critical_total'])) * 100
        overall_score = (result['compliant'] / result['total']) * 100
        
        weighted_score = (critical_score * 0.8) + (overall_score * 0.2)
        return round(weighted_score)
    
    def _generate_compliance_recommendations(self, cursor: sqlite3.Cursor) -> List[Dict]:
        """Generate specific recommendations for improving compliance"""
        recommendations = []
        
        # Check for requirements with no recent evidence
        cursor.execute("""
            SELECT cr.requirement_code, cr.requirement_title, cr.frequency,
                   cr.last_assessed_date, cr.auto_trackable
            FROM compliance_requirements cr
            LEFT JOIN compliance_evidence ce ON cr.requirement_code = ce.requirement_code
                AND ce.timestamp >= datetime('now', '-30 days')
            WHERE ce.requirement_code IS NULL
            AND cr.criticality_level = 'critical'
            ORDER BY cr.last_assessed_date ASC
            LIMIT 5
        """)
        
        stale_requirements = cursor.fetchall()
        
        for req in stale_requirements:
            if req['auto_trackable']:
                recommendations.append({
                    'type': 'system_configuration',
                    'priority': 'high',
                    'title': f"Enable automatic tracking for {req['requirement_code']}",
                    'description': f"Requirement '{req['requirement_title']}' can be automatically tracked but has no recent evidence.",
                    'action': 'Configure system to automatically track this requirement'
                })
            else:
                recommendations.append({
                    'type': 'manual_action',
                    'priority': 'high',
                    'title': f"Update evidence for {req['requirement_code']}",
                    'description': f"Requirement '{req['requirement_title']}' needs manual evidence collection.",
                    'action': f"Collect and record evidence according to {req['frequency']} schedule"
                })
        
        # Check for overdue assessments
        cursor.execute("""
            SELECT requirement_code, requirement_title, next_assessment_date
            FROM compliance_requirements
            WHERE next_assessment_date < date('now')
            AND criticality_level IN ('critical', 'major')
            ORDER BY next_assessment_date ASC
            LIMIT 3
        """)
        
        overdue_assessments = cursor.fetchall()
        
        for assessment in overdue_assessments:
            recommendations.append({
                'type': 'assessment_overdue',
                'priority': 'medium',
                'title': f"Assessment overdue for {assessment['requirement_code']}",
                'description': f"'{assessment['requirement_title']}' assessment was due {assessment['next_assessment_date']}",
                'action': 'Schedule and complete compliance assessment'
            })
        
        return recommendations
    
    def create_compliance_gap(self, requirement_code: str, gap_description: str,
                            gap_severity: str, assigned_to: str = None,
                            target_date: str = None) -> int:
        """Create a compliance gap record"""
        with self.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO compliance_gaps 
                (requirement_code, gap_description, gap_severity, identified_date,
                 target_resolution_date, assigned_to)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (requirement_code, gap_description, gap_severity,
                  datetime.date.today().isoformat(), target_date, assigned_to))
            return cursor.lastrowid
    
    def export_compliance_report(self, regulation_source: str = None,
                               include_evidence: bool = True) -> Dict:
        """Export comprehensive compliance report"""
        with self.get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Build query based on regulation source filter
            where_clause = ""
            params = []
            if regulation_source:
                where_clause = "WHERE cr.regulation_source = ?"
                params.append(regulation_source)
            
            cursor.execute(f"""
                SELECT cr.*, 
                       COUNT(ce.id) as evidence_count,
                       AVG(ce.compliance_score) as avg_evidence_score,
                       MAX(ce.timestamp) as last_evidence_date
                FROM compliance_requirements cr
                LEFT JOIN compliance_evidence ce ON cr.requirement_code = ce.requirement_code
                {where_clause}
                GROUP BY cr.requirement_code
                ORDER BY cr.regulation_source, cr.section_number
            """, params)
            
            requirements = cursor.fetchall()
            
            report = {
                'report_metadata': {
                    'generated_date': datetime.datetime.now().isoformat(),
                    'regulation_filter': regulation_source or 'all',
                    'total_requirements': len(requirements),
                    'report_type': 'compliance_status'
                },
                'requirements': []
            }
            
            for req in requirements:
                req_data = dict(req)
                
                if include_evidence:
                    # Get recent evidence for this requirement
                    cursor.execute("""
                        SELECT evidence_type, evidence_source, timestamp, 
                               compliance_score, user_id
                        FROM compliance_evidence
                        WHERE requirement_code = ?
                        ORDER BY timestamp DESC
                        LIMIT 10
                    """, (req['requirement_code'],))
                    
                    req_data['recent_evidence'] = [dict(row) for row in cursor.fetchall()]
                
                report['requirements'].append(req_data)
            
            return report

    def get_dashboard_data(self, days: int = 30, category: str = None, status: str = None) -> Dict[str, Any]:
        """Get comprehensive dashboard data for unified compliance"""
        with self.get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Build filter conditions - only include auto-trackable requirements
            where_conditions = ["auto_trackable = 1"]
            params = []
            
            if category:
                where_conditions.append("regulation_source LIKE ?")
                params.append(f"%{category}%")
            
            if status:
                where_conditions.append("compliance_status = ?")
                params.append(status)
            
            where_clause = ""
            if where_conditions:
                where_clause = "WHERE " + " AND ".join(where_conditions)
            
            # Get requirements summary
            cursor.execute(f"""
                SELECT 
                    compliance_status,
                    regulation_source,
                    COUNT(*) as count
                FROM compliance_requirements 
                {where_clause}
                GROUP BY compliance_status, regulation_source
            """, params)
            
            status_summary = {}
            by_regulation = {}
            
            for row in cursor.fetchall():
                status = row['compliance_status']
                regulation = row['regulation_source']
                count = row['count']
                
                if status not in status_summary:
                    status_summary[status] = 0
                status_summary[status] += count
                
                if regulation not in by_regulation:
                    by_regulation[regulation] = {}
                by_regulation[regulation][status] = count
            
            # Get recent compliance events
            cursor.execute("""
                SELECT 
                    requirement_code,
                    evidence_type,
                    timestamp,
                    user_id
                FROM compliance_evidence 
                WHERE timestamp >= datetime('now', '-' || ? || ' days')
                ORDER BY timestamp DESC
                LIMIT 20
            """, (days,))
            
            recent_events = [dict(row) for row in cursor.fetchall()]
            
            # Get compliance trends
            cursor.execute("""
                SELECT 
                    DATE(timestamp) as date,
                    COUNT(*) as event_count
                FROM compliance_evidence 
                WHERE timestamp >= datetime('now', '-' || ? || ' days')
                GROUP BY DATE(timestamp)
                ORDER BY date
            """, (days,))
            
            trends = [dict(row) for row in cursor.fetchall()]
            
            # Get requirements needing attention - only auto-trackable ones
            attention_where_conditions = where_conditions.copy()
            attention_where_conditions.append("(compliance_status = 'non_compliant' OR compliance_status = 'unknown')")
            
            attention_where_clause = ""
            if attention_where_conditions:
                attention_where_clause = "WHERE " + " AND ".join(attention_where_conditions)
            
            cursor.execute(f"""
                SELECT 
                    requirement_code,
                    requirement_title,
                    regulation_source,
                    compliance_status,
                    criticality_level,
                    frequency,
                    last_assessed_date
                FROM compliance_requirements
                {attention_where_clause}
                ORDER BY 
                    CASE criticality_level 
                        WHEN 'critical' THEN 1 
                        WHEN 'major' THEN 2 
                        ELSE 3 
                    END,
                    last_assessed_date ASC
                LIMIT 10
            """, params)
            
            attention_needed = [dict(row) for row in cursor.fetchall()]
            
            # Calculate regulation scores
            regulation_scores = {}
            for regulation, status_counts in by_regulation.items():
                total = sum(status_counts.values())
                compliant = status_counts.get('compliant', 0)
                score = round((compliant / max(total, 1)) * 100, 1)
                regulation_scores[regulation] = {
                    'score': score,
                    'total': total,
                    'compliant': compliant
                }
            
            # Generate tracking summary
            tracking_summary = {
                'auto_trackable': {
                    'electronic_records': by_regulation.get('FDA_21CFR', {}).get('compliant', 0),
                    'quality_control': by_regulation.get('CLIA_42CFR', {}).get('compliant', 0),
                    'data_integrity': by_regulation.get('CAP_LAB', {}).get('compliant', 0)
                },
                'manual_required': {
                    'documentation': sum([counts.get('unknown', 0) for counts in by_regulation.values()]),
                    'validation': sum([counts.get('non_compliant', 0) for counts in by_regulation.values()]),
                    'assessment': len(attention_needed)
                }
            }
            
            # Generate compliance gaps
            compliance_gaps = []
            for item in attention_needed[:5]:  # Top 5 gaps
                compliance_gaps.append({
                    'area': item['regulation_source'],
                    'gap': item['requirement_title'],
                    'impact': 'High' if item['criticality_level'] == 'critical' else 'Medium',
                    'recommended_action': f"Complete {item['requirement_title']} assessment"
                })
            
            # Generate recommendations
            recommendations = []
            if status_summary.get('unknown', 0) > 0:
                recommendations.append({
                    'title': 'Complete Initial Assessments',
                    'description': f'Assess {status_summary["unknown"]} unknown compliance requirements',
                    'priority': 'high',
                    'estimated_effort': '2-4 hours'
                })
            
            if status_summary.get('non_compliant', 0) > 0:
                recommendations.append({
                    'title': 'Address Non-Compliant Items',
                    'description': f'Resolve {status_summary["non_compliant"]} non-compliant requirements',
                    'priority': 'critical',
                    'estimated_effort': '4-8 hours'
                })
            
            return {
                'status_summary': status_summary,
                'by_regulation': by_regulation,
                'recent_events': recent_events,
                'trends': trends,
                'attention_needed': attention_needed,
                'total_requirements': sum(status_summary.values()),
                'compliance_percentage': round(
                    (status_summary.get('compliant', 0) / max(sum(status_summary.values()), 1)) * 100, 1
                ),
                'regulation_scores': regulation_scores,
                'tracking_summary': tracking_summary,
                'compliance_gaps': compliance_gaps,
                'recommendations': recommendations,
                'recent_activities': recent_events  # Alias for compatibility
            }

    def get_requirements(self, category: str = None, status: str = None, 
                        regulation_number: str = None) -> List[Dict[str, Any]]:
        """Get compliance requirements with filtering"""
        with self.get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Build filter conditions
            where_conditions = []
            params = []
            
            if category:
                where_conditions.append("regulation_source LIKE ?")
                params.append(f"%{category}%")
            
            if status:
                where_conditions.append("compliance_status = ?")
                params.append(status)
            
            if regulation_number:
                where_conditions.append("section_number LIKE ?")
                params.append(f"%{regulation_number}%")
            
            where_clause = ""
            if where_conditions:
                where_clause = "WHERE " + " AND ".join(where_conditions)
            
            cursor.execute(f"""
                SELECT * FROM compliance_requirements 
                {where_clause}
                ORDER BY regulation_source, section_number
            """, params)
            
            return [dict(row) for row in cursor.fetchall()]

    def log_event(self, event_type: str, metadata: Dict[str, Any], 
                  session_id: str = None, user_id: str = 'system') -> Dict[str, Any]:
        """Log a compliance event and update related requirements"""
        
        # Add session context to metadata
        enhanced_metadata = {
            'session_id': session_id,
            'timestamp': datetime.datetime.now().isoformat(),
            **metadata
        }
        
        # Track the compliance event
        updated_requirements = self.track_compliance_event(
            event_type=event_type,
            event_data=enhanced_metadata,
            user_id=user_id
        )
        
        return {
            'success': True,
            'event_type': event_type,
            'updated_requirements': updated_requirements,
            'affected_count': len(updated_requirements)
        }

    def export_compliance_data(self, format_type: str = 'json', 
                              category: str = None, date_range: int = 30) -> Any:
        """Export compliance data in various formats"""
        
        # Get comprehensive compliance data
        dashboard_data = self.get_dashboard_data(days=date_range, category=category)
        requirements = self.get_requirements(category=category)
        
        export_data = {
            'export_timestamp': datetime.datetime.now().isoformat(),
            'date_range_days': date_range,
            'category_filter': category,
            'dashboard_summary': dashboard_data,
            'requirements_detail': requirements
        }
        
        if format_type == 'json':
            return export_data
        elif format_type == 'csv':
            # Convert to CSV format
            import csv
            import io
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write header
            writer.writerow([
                'Requirement Code', 'Title', 'Regulation', 'Section', 
                'Status', 'Criticality', 'Category', 'Last Assessed'
            ])
            
            # Write requirements data
            for req in requirements:
                writer.writerow([
                    req.get('requirement_code', ''),
                    req.get('requirement_title', ''),
                    req.get('regulation_source', ''),
                    req.get('section_number', ''),
                    req.get('compliance_status', ''),
                    req.get('criticality_level', ''),
                    req.get('compliance_category', ''),
                    req.get('last_assessed_date', '')
                ])
            
            return output.getvalue()
        else:
            # For PDF or other formats, return JSON for now
            return export_data

    def validate_system_compliance(self) -> Dict[str, Any]:
        """Run comprehensive system validation against all compliance requirements"""
        
        validation_results = {
            'validation_timestamp': datetime.datetime.now().isoformat(),
            'overall_status': 'PASS',
            'critical_failures': [],
            'warnings': [],
            'passed_checks': [],
            'summary': {}
        }
        
        # Get all requirements
        requirements = self.get_requirements()
        
        critical_count = 0
        major_count = 0
        minor_count = 0
        
        for req in requirements:
            check_result = {
                'requirement_code': req['requirement_code'],
                'title': req['requirement_title'],
                'status': req['compliance_status'],
                'criticality': req['criticality_level']
            }
            
            if req['compliance_status'] == 'non_compliant':
                if req['criticality_level'] == 'critical':
                    critical_count += 1
                    validation_results['critical_failures'].append(check_result)
                elif req['criticality_level'] == 'major':
                    major_count += 1
                    validation_results['warnings'].append(check_result)
                else:
                    minor_count += 1
                    validation_results['warnings'].append(check_result)
            elif req['compliance_status'] == 'compliant':
                validation_results['passed_checks'].append(check_result)
        
        # Determine overall status
        if critical_count > 0:
            validation_results['overall_status'] = 'CRITICAL_FAILURE'
        elif major_count > 0:
            validation_results['overall_status'] = 'WARNING'
        else:
            validation_results['overall_status'] = 'PASS'
        
        validation_results['summary'] = {
            'total_requirements': len(requirements),
            'critical_failures': critical_count,
            'major_warnings': major_count,
            'minor_issues': minor_count,
            'passed': len(validation_results['passed_checks'])
        }
        
        return validation_results
    
    # ===== USER ACCESS AND ROLE TRACKING =====
    
    def log_user_access(self, user_id: str = 'user', action: str = 'login', 
                       details: Dict[str, Any] = None) -> int:
        """Log user access events for compliance tracking"""
        with self.get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Create user access log table if it doesn't exist
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_access_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ip_address TEXT,
                    session_id TEXT,
                    details TEXT,
                    success BOOLEAN DEFAULT TRUE
                )
            """)
            
            access_data = details or {}
            cursor.execute("""
                INSERT INTO user_access_log 
                (user_id, action, ip_address, session_id, details)
                VALUES (?, ?, ?, ?, ?)
            """, (
                user_id,
                action,
                access_data.get('ip_address', 'unknown'),
                access_data.get('session_id'),
                json.dumps(access_data)
            ))
            
            access_log_id = cursor.lastrowid
            
            # Track compliance events for access control
            if action in ['login', 'logout', 'session_timeout', 'access_denied']:
                self.track_compliance_event(
                    event_type=f'USER_{action.upper()}',
                    event_data={
                        'user_id': user_id,
                        'action': action,
                        'access_log_id': access_log_id,
                        **access_data
                    },
                    user_id=user_id
                )
            
            return access_log_id
    
    def assign_user_role(self, user_id: str = 'user', role: str = 'analyst', 
                        assigned_by: str = 'system') -> bool:
        """Assign role to user and track for compliance"""
        with self.get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Create user roles table if it doesn't exist
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_roles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    assigned_by TEXT,
                    active BOOLEAN DEFAULT TRUE,
                    permissions TEXT
                )
            """)
            
            # Define role permissions
            role_permissions = {
                'analyst': ['view_data', 'run_analysis', 'export_reports'],
                'supervisor': ['view_data', 'run_analysis', 'export_reports', 'manage_qc', 'approve_results'],
                'admin': ['view_data', 'run_analysis', 'export_reports', 'manage_qc', 'approve_results', 
                         'manage_users', 'system_config', 'compliance_review'],
                'viewer': ['view_data', 'export_reports'],
                'validator': ['view_data', 'run_analysis', 'system_validation', 'compliance_review']
            }
            
            permissions = role_permissions.get(role, ['view_data'])
            
            # Deactivate previous roles
            cursor.execute("""
                UPDATE user_roles SET active = FALSE 
                WHERE user_id = ? AND active = TRUE
            """, (user_id,))
            
            # Insert new role
            cursor.execute("""
                INSERT INTO user_roles (user_id, role, assigned_by, permissions)
                VALUES (?, ?, ?, ?)
            """, (user_id, role, assigned_by, json.dumps(permissions)))
            
            # Track compliance event
            self.track_compliance_event(
                event_type='ROLE_ASSIGNED',
                event_data={
                    'user_id': user_id,
                    'role': role,
                    'permissions': permissions,
                    'assigned_by': assigned_by
                },
                user_id=assigned_by
            )
            
            return True
    
    def check_user_permission(self, user_id: str = 'user', permission: str = 'view_data') -> bool:
        """Check if user has specific permission"""
        with self.get_db_connection() as conn:
            cursor = conn.cursor()
            
            try:
                cursor.execute("""
                    SELECT permissions FROM user_roles 
                    WHERE user_id = ? AND active = TRUE
                    ORDER BY assigned_date DESC LIMIT 1
                """, (user_id,))
                
                result = cursor.fetchone()
                if not result:
                    # Default permissions for unassigned users
                    return permission in ['view_data']
                
                user_permissions = json.loads(result['permissions'])
                return permission in user_permissions
                
            except Exception:
                # Fail safe - minimal permissions
                return permission in ['view_data']
    
    def validate_data_encryption(self, algorithm: str = 'AES-256', 
                                test_data: str = 'test_encryption') -> Dict[str, Any]:
        """Validate encryption algorithm compliance"""
        import hashlib
        import secrets
        
        validation_result = {
            'algorithm': algorithm,
            'validation_timestamp': datetime.datetime.now().isoformat(),
            'compliance_status': 'compliant',
            'test_results': {}
        }
        
        try:
            # Test data hashing (simulation of encryption validation)
            if algorithm in ['AES-256', 'AES-128', 'SHA-256']:
                # Simulate encryption strength validation
                test_key = secrets.token_hex(32)  # 256-bit key
                test_hash = hashlib.sha256((test_data + test_key).encode()).hexdigest()
                
                validation_result['test_results'] = {
                    'key_strength': '256-bit' if algorithm == 'AES-256' else '128-bit',
                    'hash_output_length': len(test_hash),
                    'randomness_test': len(set(test_hash)) > 10,  # Basic randomness check
                    'algorithm_approved': algorithm in ['AES-256', 'AES-128', 'SHA-256']
                }
                
                # Determine compliance
                if algorithm == 'AES-256' and validation_result['test_results']['algorithm_approved']:
                    validation_result['compliance_status'] = 'compliant'
                else:
                    validation_result['compliance_status'] = 'non_compliant'
                    validation_result['recommendation'] = 'Use AES-256 for maximum compliance'
            
            else:
                validation_result['compliance_status'] = 'non_compliant'
                validation_result['error'] = f'Algorithm {algorithm} not approved for compliance'
            
            # Track compliance event
            self.track_compliance_event(
                event_type='ALGORITHM_VALIDATED',
                event_data=validation_result,
                user_id='system'
            )
            
        except Exception as e:
            validation_result['compliance_status'] = 'error'
            validation_result['error'] = str(e)
        
        return validation_result
    
    def get_user_activity_summary(self, user_id: str = 'user', days: int = 30) -> Dict[str, Any]:
        """Get user activity summary for compliance reporting"""
        with self.get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get access log summary
            try:
                cursor.execute("""
                    SELECT action, COUNT(*) as count, MAX(timestamp) as last_action
                    FROM user_access_log 
                    WHERE user_id = ? AND timestamp >= datetime('now', '-' || ? || ' days')
                    GROUP BY action
                """, (user_id, days))
                
                access_summary = [dict(row) for row in cursor.fetchall()]
            except:
                access_summary = []
            
            # Get compliance activities
            try:
                cursor.execute("""
                    SELECT requirement_code, evidence_type, COUNT(*) as count, MAX(timestamp) as last_activity
                    FROM compliance_evidence 
                    WHERE user_id = ? AND timestamp >= datetime('now', '-' || ? || ' days')
                    GROUP BY requirement_code, evidence_type
                """, (user_id, days))
                
                compliance_activities = [dict(row) for row in cursor.fetchall()]
            except:
                compliance_activities = []
            
            # Get current role
            try:
                cursor.execute("""
                    SELECT role, permissions, assigned_date
                    FROM user_roles 
                    WHERE user_id = ? AND active = TRUE
                    ORDER BY assigned_date DESC LIMIT 1
                """, (user_id,))
                
                role_info = cursor.fetchone()
                current_role = dict(role_info) if role_info else {'role': 'unassigned', 'permissions': '[]'}
            except:
                current_role = {'role': 'unassigned', 'permissions': '[]'}
            
            return {
                'user_id': user_id,
                'period_days': days,
                'current_role': current_role,
                'access_summary': access_summary,
                'compliance_activities': compliance_activities,
                'total_access_events': sum([item['count'] for item in access_summary]),
                'total_compliance_actions': sum([item['count'] for item in compliance_activities]),
                'summary_generated': datetime.datetime.now().isoformat()
            }
