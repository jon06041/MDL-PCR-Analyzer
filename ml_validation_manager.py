"""
ML Model Validation Manager
Handles model performance tracking, versioning, and FDA compliance reporting
"""

import sqlite3
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import os

class MLModelValidationManager:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.logger = logging.getLogger(__name__)
        self.initialize_validation_schema()
    
    def get_db_connection(self):
        """Get database connection with proper settings"""
        conn = sqlite3.connect(self.db_path, timeout=30.0)  # 30 second timeout
        # Enable WAL mode for better concurrent access
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA synchronous=NORMAL')
        conn.execute('PRAGMA cache_size=10000')
        conn.execute('PRAGMA temp_store=MEMORY')
        return conn
    
    def _execute_with_retry(self, operation_func, max_retries: int = 3, delay: float = 0.1):
        """Execute database operation with retry logic for handling locks"""
        for attempt in range(max_retries):
            try:
                return operation_func()
            except sqlite3.OperationalError as e:
                if "database is locked" in str(e) and attempt < max_retries - 1:
                    self.logger.warning(f"Database locked, retrying in {delay} seconds (attempt {attempt + 1}/{max_retries})")
                    time.sleep(delay)
                    delay *= 2  # Exponential backoff
                    continue
                else:
                    raise e
            except Exception as e:
                # Re-raise non-lock exceptions immediately
                raise e
        
    def initialize_validation_schema(self):
        """Initialize the ML validation tracking schema"""
        def _initialize():
            with self.get_db_connection() as conn:
                # Read and execute the schema
                schema_path = os.path.join(os.path.dirname(__file__), 'ml_model_validation_schema.sql')
                if os.path.exists(schema_path):
                    with open(schema_path, 'r') as f:
                        schema_sql = f.read()
                    conn.executescript(schema_sql)
                    self.logger.info("ML validation schema initialized successfully")
                else:
                    self.logger.warning("ML validation schema file not found")
        
        try:
            self._execute_with_retry(_initialize)
        except Exception as e:
            self.logger.error(f"Error initializing ML validation schema: {e}")
    
    def get_active_model_version(self, model_type: str, pathogen_code: str = None, fluorophore: str = None) -> Optional[Dict]:
        """Get the currently active model version"""
        try:
            with self.get_db_connection() as conn:
                cursor = conn.cursor()
                
                query = """
                SELECT * FROM ml_model_versions 
                WHERE model_type = ? AND is_active = TRUE
                """
                params = [model_type]
                
                if pathogen_code:
                    query += " AND pathogen_code = ?"
                    params.append(pathogen_code)
                if fluorophore:
                    query += " AND fluorophore = ?"
                    params.append(fluorophore)
                
                cursor.execute(query, params)
                result = cursor.fetchone()
                return dict(result) if result else None
        except Exception as e:
            self.logger.error(f"Error getting active model version: {e}")
            return None
    
    def create_new_model_version(self, model_type: str, version_number: str, 
                                pathogen_code: str = None, fluorophore: str = None,
                                model_file_path: str = None, training_samples_count: int = 0,
                                performance_notes: str = None, trained_by: str = None) -> int:
        """Create a new model version and deactivate the previous one"""
        try:
            with self.get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Deactivate previous version
                cursor.execute("""
                    UPDATE ml_model_versions 
                    SET is_active = FALSE 
                    WHERE model_type = ? AND pathogen_code = ? AND fluorophore = ?
                """, (model_type, pathogen_code, fluorophore))
                
                # Create new version
                cursor.execute("""
                    INSERT INTO ml_model_versions 
                    (model_type, pathogen_code, fluorophore, version_number, 
                     model_file_path, training_samples_count, performance_notes, trained_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (model_type, pathogen_code, fluorophore, version_number,
                      model_file_path, training_samples_count, performance_notes, trained_by))
                
                new_version_id = cursor.lastrowid
                
                # Log FDA compliance event
                self.log_fda_compliance_event(
                    'model_training', 
                    trained_by or 'system',
                    version_number,
                    pathogen_code,
                    event_data=json.dumps({
                        'new_version': version_number,
                        'training_samples': training_samples_count,
                        'model_type': model_type
                    })
                )
                
                return new_version_id
        except Exception as e:
            self.logger.error(f"Error creating new model version: {e}")
            return None
    
    def record_ml_performance(self, model_version_id: int, run_file_name: str,
                             session_id: str = None, pathogen_code: str = None,
                             fluorophore: str = None, test_type: str = None) -> int:
        """Create a performance tracking record for a run"""
        try:
            with self.get_db_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT INTO ml_model_performance 
                    (model_version_id, run_file_name, session_id, pathogen_code, fluorophore, test_type)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (model_version_id, run_file_name, session_id, pathogen_code, fluorophore, test_type))
                
                return cursor.lastrowid
        except Exception as e:
            self.logger.error(f"Error recording ML performance: {e}")
            return None
    
    def track_prediction(self, performance_id: int, well_id: str, sample_name: str,
                        pathogen_code: str, fluorophore: str, ml_prediction: str,
                        ml_confidence: float = None, expert_decision: str = None,
                        final_classification: str = None, model_version_used: str = None,
                        feature_data: Dict = None) -> int:
        """Track an individual ML prediction and any expert override"""
        try:
            with self.get_db_connection() as conn:
                cursor = conn.cursor()
                
                is_expert_override = expert_decision is not None and expert_decision != ml_prediction
                final_class = expert_decision if expert_decision else ml_prediction
                is_correct = final_class == ml_prediction
                
                cursor.execute("""
                    INSERT INTO ml_prediction_tracking 
                    (performance_id, well_id, sample_name, pathogen_code, fluorophore,
                     ml_prediction, ml_confidence, expert_decision, final_classification,
                     is_expert_override, is_correct_prediction, model_version_used, feature_data)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (performance_id, well_id, sample_name, pathogen_code, fluorophore,
                      ml_prediction, ml_confidence, expert_decision, final_class,
                      is_expert_override, is_correct, model_version_used,
                      json.dumps(feature_data) if feature_data else None))
                
                prediction_id = cursor.lastrowid
                
                # Update performance summary
                self.update_performance_summary(performance_id)
                
                # Log expert override if applicable
                if is_expert_override:
                    self.log_fda_compliance_event(
                        'expert_override',
                        'expert_user',  # Will be updated with actual user later
                        model_version_used,
                        pathogen_code,
                        event_data=json.dumps({
                            'well_id': well_id,
                            'sample_name': sample_name,
                            'ml_prediction': ml_prediction,
                            'expert_decision': expert_decision,
                            'confidence': ml_confidence
                        })
                    )
                
                return prediction_id
        except Exception as e:
            self.logger.error(f"Error tracking prediction: {e}")
            return None
    
    def update_performance_summary(self, performance_id: int):
        """Update the performance summary statistics"""
        def _update():
            with self.get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Calculate statistics
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN is_correct_prediction THEN 1 ELSE 0 END) as correct,
                        SUM(CASE WHEN is_expert_override THEN 1 ELSE 0 END) as overrides
                    FROM ml_prediction_tracking 
                    WHERE performance_id = ?
                """, (performance_id,))
                
                result = cursor.fetchone()
                total, correct, overrides = result if result else (0, 0, 0)
                
                # Update performance record
                cursor.execute("""
                    UPDATE ml_model_performance 
                    SET total_predictions = ?, correct_predictions = ?, expert_overrides = ?
                    WHERE id = ?
                """, (total, correct, overrides, performance_id))
        
        try:
            self._execute_with_retry(_update)
        except Exception as e:
            self.logger.error(f"Error updating performance summary: {e}")
    
    def get_model_performance_summary(self, days: int = 30, pathogen_code: str = None) -> Dict:
        """Get performance summary for the last N days"""
        try:
            with self.get_db_connection() as conn:
                cursor = conn.cursor()
                
                base_query = """
                    SELECT 
                        mv.model_type,
                        mv.pathogen_code,
                        mv.fluorophore,
                        mv.version_number,
                        COUNT(mp.id) as total_runs,
                        SUM(mp.total_predictions) as total_predictions,
                        SUM(mp.correct_predictions) as correct_predictions,
                        SUM(mp.expert_overrides) as expert_overrides,
                        AVG(mp.accuracy_percentage) as avg_accuracy,
                        MIN(mp.run_date) as first_run,
                        MAX(mp.run_date) as last_run
                    FROM ml_model_versions mv
                    LEFT JOIN ml_model_performance mp ON mv.id = mp.model_version_id
                    WHERE mv.is_active = TRUE 
                    AND mp.run_date >= datetime('now', '-{} days')
                """.format(days)
                
                params = []
                if pathogen_code:
                    base_query += " AND mv.pathogen_code = ?"
                    params.append(pathogen_code)
                
                base_query += " GROUP BY mv.id ORDER BY mv.model_type, mv.pathogen_code"
                
                cursor.execute(base_query, params)
                results = [dict(row) for row in cursor.fetchall()]
                
                return {
                    'summary': results,
                    'period_days': days,
                    'generated_at': datetime.now().isoformat()
                }
        except Exception as e:
            self.logger.error(f"Error getting performance summary: {e}")
            return {}
    
    def get_pathogen_performance_details(self, pathogen_code: str, days: int = 30) -> Dict:
        """Get detailed performance for a specific pathogen"""
        try:
            with self.get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Overall statistics
                cursor.execute("""
                    SELECT 
                        COUNT(DISTINCT mp.run_file_name) as unique_files,
                        SUM(mp.total_predictions) as total_predictions,
                        SUM(mp.correct_predictions) as correct_predictions,
                        SUM(mp.expert_overrides) as expert_overrides,
                        AVG(mp.accuracy_percentage) as avg_accuracy
                    FROM ml_model_performance mp
                    WHERE mp.pathogen_code = ? 
                    AND mp.run_date >= datetime('now', '-{} days')
                """.format(days), (pathogen_code,))
                
                overall = dict(cursor.fetchone()) if cursor.fetchone() else {}
                
                # Per-file breakdown
                cursor.execute("""
                    SELECT 
                        mp.run_file_name,
                        mp.total_predictions,
                        mp.correct_predictions,
                        mp.expert_overrides,
                        mp.accuracy_percentage,
                        mp.run_date,
                        mv.version_number
                    FROM ml_model_performance mp
                    JOIN ml_model_versions mv ON mp.model_version_id = mv.id
                    WHERE mp.pathogen_code = ? 
                    AND mp.run_date >= datetime('now', '-{} days')
                    ORDER BY mp.run_date DESC
                """.format(days), (pathogen_code,))
                
                file_breakdown = [dict(row) for row in cursor.fetchall()]
                
                return {
                    'pathogen_code': pathogen_code,
                    'overall_stats': overall,
                    'file_breakdown': file_breakdown,
                    'period_days': days
                }
        except Exception as e:
            self.logger.error(f"Error getting pathogen performance details: {e}")
            return {}
    
    def log_fda_compliance_event(self, event_type: str, user_id: str, model_version: str = None,
                                pathogen_code: str = None, session_id: str = None,
                                event_data: str = None, compliance_notes: str = None,
                                regulatory_impact: str = 'low'):
        """Log an event for FDA compliance auditing"""
        def _log_event():
            with self.get_db_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT INTO fda_compliance_audit 
                    (event_type, user_id, model_version, pathogen_code, session_id,
                     event_data, compliance_notes, regulatory_impact)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (event_type, user_id, model_version, pathogen_code, session_id,
                      event_data, compliance_notes, regulatory_impact))
        
        try:
            self._execute_with_retry(_log_event)
        except Exception as e:
            self.logger.error(f"Error logging FDA compliance event: {e}")
    
    def get_expert_override_rate(self, days: int = 30, pathogen_code: str = None) -> Dict:
        """Calculate expert override rates for quality assessment"""
        try:
            with self.get_db_connection() as conn:
                cursor = conn.cursor()
                
                base_query = """
                    SELECT 
                        mp.pathogen_code,
                        COUNT(pt.id) as total_predictions,
                        SUM(CASE WHEN pt.is_expert_override THEN 1 ELSE 0 END) as expert_overrides,
                        ROUND(
                            (SUM(CASE WHEN pt.is_expert_override THEN 1 ELSE 0 END) * 100.0 / COUNT(pt.id)), 2
                        ) as override_percentage
                    FROM ml_prediction_tracking pt
                    JOIN ml_model_performance mp ON pt.performance_id = mp.id
                    WHERE mp.run_date >= datetime('now', '-{} days')
                """.format(days)
                
                params = []
                if pathogen_code:
                    base_query += " AND mp.pathogen_code = ?"
                    params.append(pathogen_code)
                
                base_query += " GROUP BY mp.pathogen_code ORDER BY override_percentage DESC"
                
                cursor.execute(base_query, params)
                results = [dict(row) for row in cursor.fetchall()]
                
                return {
                    'override_rates': results,
                    'period_days': days,
                    'generated_at': datetime.now().isoformat()
                }
        except Exception as e:
            self.logger.error(f"Error calculating expert override rate: {e}")
            return {}
    
    def generate_fda_compliance_report(self, start_date: str = None, end_date: str = None) -> Dict:
        """Generate a comprehensive FDA compliance report"""
        try:
            if not start_date:
                start_date = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
            if not end_date:
                end_date = datetime.now().strftime('%Y-%m-%d')
            
            with self.get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Model versions used in period
                cursor.execute("""
                    SELECT DISTINCT mv.model_type, mv.pathogen_code, mv.version_number,
                           mv.creation_date, mv.training_samples_count
                    FROM ml_model_versions mv
                    JOIN ml_model_performance mp ON mv.id = mp.model_version_id
                    WHERE mp.run_date BETWEEN ? AND ?
                    ORDER BY mv.creation_date DESC
                """, (start_date, end_date))
                
                model_versions = [dict(row) for row in cursor.fetchall()]
                
                # Performance summary
                cursor.execute("""
                    SELECT 
                        mp.pathogen_code,
                        COUNT(DISTINCT mp.run_file_name) as files_processed,
                        SUM(mp.total_predictions) as total_predictions,
                        SUM(mp.correct_predictions) as correct_predictions,
                        SUM(mp.expert_overrides) as expert_overrides,
                        AVG(mp.accuracy_percentage) as avg_accuracy
                    FROM ml_model_performance mp
                    WHERE mp.run_date BETWEEN ? AND ?
                    GROUP BY mp.pathogen_code
                """, (start_date, end_date))
                
                performance_summary = [dict(row) for row in cursor.fetchall()]
                
                # Expert interventions
                cursor.execute("""
                    SELECT COUNT(*) as total_interventions
                    FROM fda_compliance_audit
                    WHERE event_type = 'expert_override' 
                    AND event_timestamp BETWEEN ? AND ?
                """, (start_date, end_date))
                
                interventions = cursor.fetchone()[0] if cursor.fetchone() else 0
                
                # Model training events
                cursor.execute("""
                    SELECT COUNT(*) as training_events
                    FROM fda_compliance_audit
                    WHERE event_type = 'model_training' 
                    AND event_timestamp BETWEEN ? AND ?
                """, (start_date, end_date))
                
                training_events = cursor.fetchone()[0] if cursor.fetchone() else 0
                
                return {
                    'report_period': {
                        'start_date': start_date,
                        'end_date': end_date
                    },
                    'model_versions_used': model_versions,
                    'performance_summary': performance_summary,
                    'expert_interventions': interventions,
                    'model_training_events': training_events,
                    'report_generated_at': datetime.now().isoformat(),
                    'compliance_status': 'TRACKED'  # Will be enhanced with actual validation logic
                }
        except Exception as e:
            self.logger.error(f"Error generating FDA compliance report: {e}")
            return {}
