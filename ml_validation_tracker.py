#!/usr/bin/env python3
"""
Enhanced ML Validation Dashboard with Real-time Updates
Tracks pathogen-specific models, expert decisions, and teaching progress
"""

import sqlite3
import json
from datetime import datetime, timedelta
import logging

class MLValidationTracker:
    def __init__(self, db_path='qpcr_analysis.db'):
        self.db_path = db_path
        self.logger = logging.getLogger(__name__)
        
    def get_db_connection(self):
        """Get database connection with proper settings"""
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        return conn
    
    def track_expert_decision(self, well_id, original_prediction, expert_correction, 
                            pathogen, confidence, features_used, user_id='expert'):
        """Track expert teaching decisions for compliance and learning"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Create table if it doesn't exist
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ml_expert_decisions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    well_id TEXT NOT NULL,
                    pathogen TEXT,
                    original_prediction TEXT NOT NULL,
                    expert_correction TEXT NOT NULL,
                    confidence REAL,
                    features_used TEXT,
                    teaching_outcome TEXT,
                    user_id TEXT,
                    session_id TEXT,
                    improvement_score REAL
                )
            """)
            
            # Determine teaching outcome
            teaching_outcome = "correction_needed"
            if original_prediction == expert_correction:
                teaching_outcome = "prediction_confirmed"
            elif original_prediction == "UNKNOWN":
                teaching_outcome = "new_knowledge_added"
            else:
                teaching_outcome = "prediction_corrected"
            
            # Calculate improvement score based on confidence and correction type
            improvement_score = confidence if teaching_outcome == "prediction_confirmed" else (1.0 - confidence)
            
            cursor.execute("""
                INSERT INTO ml_expert_decisions 
                (well_id, pathogen, original_prediction, expert_correction, confidence, 
                 features_used, teaching_outcome, user_id, improvement_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                well_id, pathogen, original_prediction, expert_correction, 
                confidence, json.dumps(features_used), teaching_outcome, 
                user_id, improvement_score
            ))
            
            conn.commit()
            print(f"✅ Expert decision tracked: {original_prediction} → {expert_correction} for {pathogen}")
            
        except Exception as e:
            self.logger.error(f"Error tracking expert decision: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def track_model_prediction(self, well_id, pathogen, prediction, confidence, 
                             features_used, model_version, user_id='system'):
        """Track ML model predictions for audit trail"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO ml_prediction_tracking 
                (performance_id, well_id, pathogen_code, ml_prediction, ml_confidence, 
                 model_version_used, feature_data, prediction_timestamp, final_classification)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                1,  # performance_id - using 1 as default
                well_id, pathogen, prediction, confidence, 
                model_version, json.dumps(features_used), 
                datetime.now().isoformat(), prediction
            ))
            
            conn.commit()
            
        except Exception as e:
            self.logger.error(f"Error tracking prediction: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def track_training_event(self, pathogen, training_samples, accuracy, 
                           model_version, trigger_reason, user_id='system'):
        """Track model training events"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO ml_training_history 
                (model_version_id, pathogen_code, training_samples_count, 
                 training_trigger, model_metrics, training_date)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                1,  # model_version_id - using 1 as default
                pathogen, training_samples, trigger_reason,
                json.dumps({'accuracy': accuracy}), datetime.now().isoformat()
            ))
            
            conn.commit()
            
        except Exception as e:
            self.logger.error(f"Error tracking training event: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def update_pathogen_model_version(self, pathogen, version, accuracy, 
                                    training_samples, deployment_status='active'):
        """Update pathogen-specific model version"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Check if pathogen model exists
            cursor.execute("""
                SELECT id FROM ml_model_versions 
                WHERE pathogen_code = ? AND is_active = 1
            """, (pathogen,))
            
            existing = cursor.fetchone()
            
            if existing:
                # Update existing model
                cursor.execute("""
                    UPDATE ml_model_versions 
                    SET version_number = ?, training_samples_count = ?, 
                        creation_date = ?, performance_notes = ?
                    WHERE pathogen_code = ? AND is_active = 1
                """, (version, training_samples, datetime.now().isoformat(),
                      f"Accuracy: {accuracy:.1%}", pathogen))
            else:
                # Create new pathogen model entry
                cursor.execute("""
                    INSERT INTO ml_model_versions 
                    (model_type, pathogen_code, fluorophore, version_number, 
                     training_samples_count, creation_date, is_active, 
                     performance_notes, trained_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    'pathogen_specific', pathogen, 'ALL', version,
                    training_samples, datetime.now().isoformat(), 1,
                    f"Accuracy: {accuracy:.1%}", 'ml_system'
                ))
            
            conn.commit()
            print(f"✅ Model version updated for {pathogen}: v{version} ({accuracy:.1%} accuracy)")
            
        except Exception as e:
            self.logger.error(f"Error updating model version: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def get_pathogen_dashboard_data(self):
        """Get comprehensive pathogen-specific dashboard data"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Get pathogen-specific model versions and performance
            cursor.execute("""
                SELECT 
                    pathogen_code,
                    version_number,
                    training_samples_count,
                    creation_date,
                    is_active,
                    performance_notes
                FROM ml_model_versions 
                WHERE model_type = 'pathogen_specific' OR pathogen_code != ''
                ORDER BY pathogen_code, creation_date DESC
            """)
            
            pathogen_models = {}
            for row in cursor.fetchall():
                pathogen = row['pathogen_code'] or 'General_PCR'
                if pathogen not in pathogen_models:
                    # Extract accuracy from performance_notes
                    accuracy = 0.0
                    if row['performance_notes']:
                        try:
                            # Extract percentage from "Accuracy: XX.X%" format
                            import re
                            match = re.search(r'Accuracy:\s*(\d+(?:\.\d+)?)%', row['performance_notes'])
                            if match:
                                accuracy = float(match.group(1)) / 100.0
                        except:
                            pass
                    
                    pathogen_models[pathogen] = {
                        'version': row['version_number'],
                        'accuracy': accuracy,
                        'training_samples': row['training_samples_count'],
                        'last_updated': row['creation_date'],
                        'status': 'active' if row['is_active'] else 'inactive',
                        'predictions_count': 0,
                        'expert_decisions_count': 0,
                        'teaching_score': 0.0
                    }
            
            # Get prediction counts per pathogen
            cursor.execute("""
                SELECT pathogen_code, COUNT(*) as count, AVG(ml_confidence) as avg_confidence
                FROM ml_prediction_tracking 
                WHERE prediction_timestamp > datetime('now', '-30 days')
                GROUP BY pathogen_code
            """)
            
            for row in cursor.fetchall():
                pathogen = row['pathogen_code'] or 'General_PCR'
                if pathogen in pathogen_models:
                    pathogen_models[pathogen]['predictions_count'] = row['count']
                    pathogen_models[pathogen]['avg_confidence'] = row['avg_confidence']
            
            # Get expert decision counts and teaching scores
            cursor.execute("""
                SELECT 
                    pathogen, 
                    COUNT(*) as decisions_count,
                    AVG(improvement_score) as teaching_score,
                    SUM(CASE WHEN teaching_outcome = 'prediction_confirmed' THEN 1 ELSE 0 END) as confirmed,
                    SUM(CASE WHEN teaching_outcome = 'prediction_corrected' THEN 1 ELSE 0 END) as corrected
                FROM ml_expert_decisions 
                WHERE timestamp > datetime('now', '-30 days')
                GROUP BY pathogen
            """)
            
            for row in cursor.fetchall():
                pathogen = row['pathogen'] or 'General_PCR'
                if pathogen in pathogen_models:
                    pathogen_models[pathogen]['expert_decisions_count'] = row['decisions_count']
                    pathogen_models[pathogen]['teaching_score'] = row['teaching_score'] or 0.0
                    pathogen_models[pathogen]['predictions_confirmed'] = row['confirmed']
                    pathogen_models[pathogen]['predictions_corrected'] = row['corrected']
            
            return pathogen_models
            
        except Exception as e:
            self.logger.error(f"Error getting dashboard data: {e}")
            return {}
        finally:
            conn.close()
    
    def get_expert_teaching_summary(self, days=30):
        """Get summary of expert teaching activity"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_decisions,
                    AVG(improvement_score) as avg_improvement,
                    COUNT(DISTINCT pathogen) as pathogens_taught,
                    COUNT(DISTINCT user_id) as expert_users,
                    SUM(CASE WHEN teaching_outcome = 'prediction_confirmed' THEN 1 ELSE 0 END) as confirmations,
                    SUM(CASE WHEN teaching_outcome = 'prediction_corrected' THEN 1 ELSE 0 END) as corrections,
                    SUM(CASE WHEN teaching_outcome = 'new_knowledge_added' THEN 1 ELSE 0 END) as new_knowledge
                FROM ml_expert_decisions 
                WHERE timestamp > datetime('now', '-{} days')
            """.format(days))
            
            result = cursor.fetchone()
            return dict(result) if result else {}
            
        except Exception as e:
            self.logger.error(f"Error getting teaching summary: {e}")
            return {}
        finally:
            conn.close()

# Global tracker instance
ml_tracker = MLValidationTracker()
