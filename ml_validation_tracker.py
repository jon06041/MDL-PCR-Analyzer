#!/usr/bin/env python3
"""
Enhanced ML Validation Dashboard with Real-time Updates
Tracks pathogen-specific models, expert decisions, and teaching progress
"""

import os
import json
from datetime import datetime, timedelta
import logging
from sqlalchemy import create_engine, text

class MLValidationTracker:
    def __init__(self):
        # Use MySQL connection from environment
        self.database_url = os.environ.get("DATABASE_URL")
        if not self.database_url:
            mysql_host = os.environ.get("MYSQL_HOST", "127.0.0.1")
            mysql_port = os.environ.get("MYSQL_PORT", "3306")
            mysql_user = os.environ.get("MYSQL_USER", "qpcr_user")
            mysql_password = os.environ.get("MYSQL_PASSWORD", "qpcr_password")
            mysql_database = os.environ.get("MYSQL_DATABASE", "qpcr_analysis")
            self.database_url = f"mysql+pymysql://{mysql_user}:{mysql_password}@{mysql_host}:{mysql_port}/{mysql_database}?charset=utf8mb4"
        
        self.engine = create_engine(self.database_url)
        self.logger = logging.getLogger(__name__)
    
    def track_expert_decision(self, well_id, original_prediction, expert_correction, 
                            pathogen, confidence, features_used, user_id='expert'):
        """Track expert teaching decisions for compliance and learning"""
        with self.engine.connect() as conn:
            try:
                # Create table if it doesn't exist
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS ml_expert_decisions (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        well_id VARCHAR(255) NOT NULL,
                        pathogen VARCHAR(255),
                        original_prediction VARCHAR(255) NOT NULL,
                        expert_correction VARCHAR(255) NOT NULL,
                        confidence DECIMAL(5,3),
                        features_used TEXT,
                        teaching_outcome VARCHAR(255),
                        user_id VARCHAR(255),
                        session_id VARCHAR(255),
                        improvement_score DECIMAL(5,3),
                        INDEX idx_pathogen (pathogen),
                        INDEX idx_timestamp (timestamp)
                    )
                """))
                
                # Determine teaching outcome
                teaching_outcome = "correction_needed"
                if original_prediction == expert_correction:
                    teaching_outcome = "prediction_confirmed"
                else:
                    teaching_outcome = "prediction_corrected"
                
                # Calculate improvement score based on confidence and correctness
                improvement_score = 0.0
                if teaching_outcome == "prediction_confirmed":
                    improvement_score = confidence if confidence else 0.8
                else:
                    improvement_score = max(0.0, 1.0 - (confidence if confidence else 0.5))
                
                # Insert expert decision
                conn.execute(text("""
                    INSERT INTO ml_expert_decisions 
                    (well_id, pathogen, original_prediction, expert_correction, confidence, 
                     features_used, teaching_outcome, user_id, improvement_score)
                    VALUES (:well_id, :pathogen, :original_prediction, :expert_correction, 
                            :confidence, :features_used, :teaching_outcome, :user_id, :improvement_score)
                """), {
                    'well_id': well_id,
                    'pathogen': pathogen,
                    'original_prediction': original_prediction,
                    'expert_correction': expert_correction,
                    'confidence': confidence,
                    'features_used': json.dumps(features_used) if features_used else None,
                    'teaching_outcome': teaching_outcome,
                    'user_id': user_id,
                    'improvement_score': improvement_score
                })
                
                conn.commit()
                self.logger.info(f"Expert decision tracked: {well_id} - {teaching_outcome}")
                
            except Exception as e:
                self.logger.error(f"Error tracking expert decision: {e}")
                raise
    
    def track_model_prediction(self, well_id, pathogen, prediction, confidence, 
                             features_used, model_version, user_id='system'):
        """Track ML model predictions for audit trail"""
        with self.engine.connect() as conn:
            try:
                # Create table if it doesn't exist
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS ml_prediction_tracking (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        performance_id INT,
                        well_id VARCHAR(255),
                        pathogen_code VARCHAR(255),
                        ml_prediction VARCHAR(255),
                        ml_confidence DECIMAL(5,3),
                        model_version_used VARCHAR(255),
                        feature_data TEXT,
                        prediction_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        final_classification VARCHAR(255),
                        INDEX idx_pathogen (pathogen_code),
                        INDEX idx_timestamp (prediction_timestamp)
                    )
                """))
                
                conn.execute(text("""
                    INSERT INTO ml_prediction_tracking 
                    (performance_id, well_id, pathogen_code, ml_prediction, ml_confidence, 
                     model_version_used, feature_data, final_classification)
                    VALUES (:performance_id, :well_id, :pathogen_code, :ml_prediction, 
                            :ml_confidence, :model_version_used, :feature_data, :final_classification)
                """), {
                    'performance_id': 1,  # using 1 as default
                    'well_id': well_id,
                    'pathogen_code': pathogen,
                    'ml_prediction': prediction,
                    'ml_confidence': confidence,
                    'model_version_used': model_version,
                    'feature_data': json.dumps(features_used),
                    'final_classification': prediction
                })
                
                conn.commit()
                
            except Exception as e:
                self.logger.error(f"Error tracking prediction: {e}")
                raise
    
    def track_training_event(self, pathogen, training_samples, accuracy, 
                           model_version, trigger_reason, user_id='system'):
        """Track model training events"""
        with self.engine.connect() as conn:
            try:
                # Create table if it doesn't exist
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS ml_training_history (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        model_version_id INT,
                        pathogen_code VARCHAR(255),
                        training_samples_count INT,
                        training_trigger VARCHAR(255),
                        model_metrics TEXT,
                        training_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_pathogen (pathogen_code),
                        INDEX idx_date (training_date)
                    )
                """))
                
                conn.execute(text("""
                    INSERT INTO ml_training_history 
                    (model_version_id, pathogen_code, training_samples_count, 
                     training_trigger, model_metrics)
                    VALUES (:model_version_id, :pathogen_code, :training_samples_count, 
                            :training_trigger, :model_metrics)
                """), {
                    'model_version_id': 1,  # using 1 as default
                    'pathogen_code': pathogen,
                    'training_samples_count': training_samples,
                    'training_trigger': trigger_reason,
                    'model_metrics': json.dumps({'accuracy': accuracy})
                })
                
                conn.commit()
                
            except Exception as e:
                self.logger.error(f"Error tracking training event: {e}")
                raise
    
    def update_pathogen_model_version(self, pathogen, new_version, metrics):
        """Update model version for a specific pathogen"""
        with self.engine.connect() as conn:
            try:
                # Create table if it doesn't exist
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS ml_model_versions (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        pathogen_code VARCHAR(255) UNIQUE,
                        current_version VARCHAR(50),
                        model_metrics TEXT,
                        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_pathogen (pathogen_code)
                    )
                """))
                
                # Ensure current_version column exists (for existing tables)
                try:
                    conn.execute(text("""
                        ALTER TABLE ml_model_versions 
                        ADD COLUMN current_version VARCHAR(50) AFTER pathogen_code
                    """))
                except Exception as e:
                    # Column might already exist, ignore the error
                    pass
                
                # Check if record exists for this pathogen
                result = conn.execute(text("""
                    SELECT id FROM ml_model_versions WHERE pathogen_code = :pathogen_code
                """), {'pathogen_code': pathogen}).fetchone()
                
                if result:
                    # Update existing record
                    conn.execute(text("""
                        UPDATE ml_model_versions 
                        SET current_version = :current_version, 
                            model_metrics = :model_metrics, 
                            last_updated = CURRENT_TIMESTAMP 
                        WHERE pathogen_code = :pathogen_code
                    """), {
                        'current_version': new_version,
                        'model_metrics': json.dumps(metrics),
                        'pathogen_code': pathogen
                    })
                else:
                    # Insert new record
                    conn.execute(text("""
                        INSERT INTO ml_model_versions 
                        (pathogen_code, current_version, model_metrics)
                        VALUES (:pathogen_code, :current_version, :model_metrics)
                    """), {
                        'pathogen_code': pathogen,
                        'current_version': new_version,
                        'model_metrics': json.dumps(metrics)
                    })
                
                conn.commit()
                
            except Exception as e:
                self.logger.error(f"Error updating model version: {e}")
                raise
    
    def get_pathogen_dashboard_data(self):
        """Get comprehensive pathogen-specific dashboard data"""
        with self.engine.connect() as conn:
            try:
                # Create table if it doesn't exist
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS ml_model_versions (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        pathogen_code VARCHAR(255),
                        version_number VARCHAR(50),
                        training_samples_count INT,
                        creation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                        is_active BOOLEAN DEFAULT TRUE,
                        performance_notes TEXT,
                        model_type VARCHAR(50) DEFAULT 'pathogen_specific',
                        INDEX idx_pathogen (pathogen_code)
                    )
                """))
                
                # Get pathogen-specific model versions and performance
                result = conn.execute(text("""
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
                """)).fetchall()
                
                pathogen_models = {}
                for row in result:
                    pathogen = row[0] or 'General_PCR'
                    if pathogen not in pathogen_models:
                        # Extract accuracy from performance_notes
                        accuracy = 0.0
                        if row[5]:  # performance_notes
                            try:
                                # Extract percentage from "Accuracy: XX.X%" format
                                import re
                                match = re.search(r'Accuracy:\s*(\d+(?:\.\d+)?)%', row[5])
                                if match:
                                    accuracy = float(match.group(1)) / 100.0
                            except:
                                pass
                        
                        pathogen_models[pathogen] = {
                            'version': row[1],  # version_number
                            'accuracy': accuracy,
                            'training_samples': row[2],  # training_samples_count
                            'last_updated': row[3],  # creation_date
                            'status': 'active' if row[4] else 'inactive',  # is_active
                            'predictions_count': 0,
                            'expert_decisions_count': 0,
                            'teaching_score': 0.0
                        }
                
                # Get prediction counts per pathogen
                result = conn.execute(text("""
                    SELECT pathogen_code, COUNT(*) as count, AVG(ml_confidence) as avg_confidence
                    FROM ml_prediction_tracking 
                    WHERE prediction_timestamp > DATE_SUB(NOW(), INTERVAL 30 DAY)
                    GROUP BY pathogen_code
                """)).fetchall()
                
                for row in result:
                    pathogen = row[0] or 'General_PCR'
                    if pathogen in pathogen_models:
                        pathogen_models[pathogen]['predictions_count'] = row[1]
                        pathogen_models[pathogen]['avg_confidence'] = row[2]
                
                # Get expert decision counts and teaching scores
                result = conn.execute(text("""
                    SELECT 
                        pathogen, 
                        COUNT(*) as decisions_count,
                        AVG(improvement_score) as teaching_score,
                        SUM(CASE WHEN expert_correction = original_prediction THEN 1 ELSE 0 END) as confirmed,
                        SUM(CASE WHEN expert_correction != original_prediction THEN 1 ELSE 0 END) as corrected,
                        SUM(CASE WHEN teaching_outcome = 'training_sample' THEN 1 ELSE 0 END) as training_samples
                    FROM ml_expert_decisions 
                    WHERE timestamp > DATE_SUB(NOW(), INTERVAL 30 DAY)
                    GROUP BY pathogen
                """)).fetchall()
                
                for row in result:
                    pathogen = row[0] or 'General_PCR'
                    if pathogen in pathogen_models:
                        pathogen_models[pathogen]['expert_decisions_count'] = row[1]
                        pathogen_models[pathogen]['teaching_score'] = row[2] or 0.0
                        pathogen_models[pathogen]['predictions_confirmed'] = row[3]
                        pathogen_models[pathogen]['predictions_corrected'] = row[4]
                
                return pathogen_models
                
            except Exception as e:
                self.logger.error(f"Error getting dashboard data: {e}")
                return {}
    
    def get_expert_teaching_summary(self, days=30):
        """Get summary of expert teaching activity"""
        with self.engine.connect() as conn:
            try:
                result = conn.execute(text("""
                    SELECT 
                        COUNT(*) as total_decisions,
                        AVG(improvement_score) as avg_improvement,
                        COUNT(DISTINCT pathogen) as pathogens_taught,
                        COUNT(DISTINCT user_id) as expert_users,
                        SUM(CASE WHEN expert_correction = original_prediction THEN 1 ELSE 0 END) as confirmations,
                        SUM(CASE WHEN expert_correction != original_prediction THEN 1 ELSE 0 END) as corrections,
                        SUM(CASE WHEN teaching_outcome = 'training_sample' THEN 1 ELSE 0 END) as new_knowledge
                    FROM ml_expert_decisions 
                    WHERE timestamp > DATE_SUB(NOW(), INTERVAL :days DAY)
                """), {'days': days}).fetchone()
                
                if result:
                    return {
                        'total_decisions': result[0],
                        'avg_improvement': result[1],
                        'pathogens_taught': result[2],
                        'expert_users': result[3],
                        'confirmations': result[4],
                        'corrections': result[5],
                        'new_knowledge': result[6]
                    }
                else:
                    return {}
                
            except Exception as e:
                self.logger.error(f"Error getting teaching summary: {e}")
                return {}

# Global tracker instance
ml_tracker = MLValidationTracker()
