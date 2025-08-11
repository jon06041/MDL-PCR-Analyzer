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
        if self.database_url:
            # Convert Railway's mysql:// to mysql+pymysql:// format
            if self.database_url.startswith("mysql://"):
                self.database_url = self.database_url.replace("mysql://", "mysql+pymysql://", 1)
            
            # Ensure charset=utf8mb4 is included for proper character handling
            if "charset=" not in self.database_url:
                separator = "&" if "?" in self.database_url else "?"
                self.database_url = f"{self.database_url}{separator}charset=utf8mb4"
        else:
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
    
    def calculate_version_from_accuracy(self, pathogen, current_accuracy):
        """Calculate version number based on accuracy improvements"""
        with self.engine.connect() as conn:
            try:
                # Get previous version and accuracy for this pathogen
                result = conn.execute(text("""
                    SELECT version_number, model_metrics 
                    FROM ml_model_versions 
                    WHERE pathogen_code = :pathogen_code
                    ORDER BY id DESC LIMIT 1
                """), {'pathogen_code': pathogen}).fetchone()
                
                if result:
                    # Parse previous accuracy from metrics
                    prev_version = result[0] or "1.0"
                    try:
                        prev_metrics = json.loads(result[1] or '{}')
                        prev_accuracy = prev_metrics.get('accuracy', 0.85)
                    except:
                        prev_accuracy = 0.85
                    
                    # Parse current version number
                    try:
                        if prev_version.startswith('v'):
                            prev_version = prev_version[1:]
                        major, minor = map(int, prev_version.split('.'))
                    except:
                        major, minor = 1, 0
                        prev_accuracy = 0.85
                else:
                    # First version - start based on accuracy level
                    major, minor = 1, 0
                    prev_accuracy = 0.85
                
                # Version increment logic based on accuracy improvements
                # Ensure both accuracies are numeric to prevent None comparison errors
                if current_accuracy is None:
                    current_accuracy = 0.85
                if prev_accuracy is None:
                    prev_accuracy = 0.85
                    
                accuracy_gain = (current_accuracy - prev_accuracy) * 100
                
                # Ensure current_accuracy is valid for comparisons
                if current_accuracy is None or not isinstance(current_accuracy, (int, float)):
                    current_accuracy = 0.85
                    
                if current_accuracy >= 0.95:  # 95%+ accuracy
                    # Major version bump for excellent performance
                    if major == 1:
                        major = 2
                        minor = 0
                elif current_accuracy >= 0.92:  # 92-94% accuracy  
                    # Significant minor version bump
                    if accuracy_gain >= 3.0:  # 3+ percentage points improvement
                        minor += 3
                    elif accuracy_gain >= 1.5:  # 1.5+ percentage points improvement
                        minor += 2
                    elif accuracy_gain >= 0.5:  # 0.5+ percentage points improvement
                        minor += 1
                elif current_accuracy >= 0.89:  # 89-91% accuracy
                    # Standard minor version bump
                    if accuracy_gain >= 2.0:  # 2+ percentage points improvement
                        minor += 2
                    elif accuracy_gain >= 1.0:  # 1+ percentage points improvement
                        minor += 1
                elif current_accuracy >= 0.85:  # 85-88% accuracy  
                    # Conservative version bump (training phase)
                    if accuracy_gain >= 3.0:  # Significant improvement needed
                        minor += 1
                
                # Generate new version
                new_version = f"v{major}.{minor}"
                
                self.logger.info(f"Version calculation for {pathogen}: {prev_accuracy:.1%} -> {current_accuracy:.1%} = {new_version}")
                return new_version
                
            except Exception as e:
                self.logger.error(f"Error calculating version: {e}")
                # Fallback to simple accuracy-based version
                if current_accuracy >= 0.95:
                    return "v2.0"  
                elif current_accuracy >= 0.90:
                    return f"v1.{int(current_accuracy * 100) - 85}"
                else:
                    return "v1.0"

    def update_pathogen_model_version(self, pathogen, accuracy, metrics):
        """Update model version for a specific pathogen based on accuracy"""
        # Calculate version based on accuracy improvements
        new_version = self.calculate_version_from_accuracy(pathogen, accuracy)
        
        # Add accuracy to metrics
        if isinstance(metrics, dict):
            metrics['accuracy'] = accuracy
        else:
            metrics = {'accuracy': accuracy}
            
        with self.engine.connect() as conn:
            try:
                # Create table if it doesn't exist
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS ml_model_versions (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        pathogen_code VARCHAR(255) UNIQUE,
                        version_number VARCHAR(50),
                        model_metrics TEXT,
                        creation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_pathogen (pathogen_code)
                    )
                """))
                
                # Ensure version_number column exists (for existing tables)
                try:
                    conn.execute(text("""
                        ALTER TABLE ml_model_versions 
                        ADD COLUMN version_number VARCHAR(50) AFTER pathogen_code
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
                        SET version_number = :version_number, 
                            model_metrics = :model_metrics, 
                            creation_date = CURRENT_TIMESTAMP 
                        WHERE pathogen_code = :pathogen_code
                    """), {
                        'version_number': new_version,
                        'model_metrics': json.dumps(metrics),
                        'pathogen_code': pathogen
                    })
                else:
                    # Insert new record
                    conn.execute(text("""
                        INSERT INTO ml_model_versions 
                        (pathogen_code, version_number, model_metrics)
                        VALUES (:pathogen_code, :version_number, :model_metrics)
                    """), {
                        'pathogen_code': pathogen,
                        'version_number': new_version,
                        'model_metrics': json.dumps(metrics)
                    })
                
                conn.commit()
                self.logger.info(f"Updated model version for {pathogen}: {new_version} (accuracy: {accuracy:.1%})")
                
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
    
    def update_training_status(self, pathogen, training_status, accuracy=None, reason=None):
        """Update training status for a pathogen model (active, paused, monitoring)"""
        with self.engine.connect() as conn:
            try:
                # Create/update training status table
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS ml_training_status (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        pathogen_code VARCHAR(255) UNIQUE,
                        training_status ENUM('active', 'paused', 'monitoring') DEFAULT 'active',
                        current_accuracy DECIMAL(5,2),
                        stable_since DATETIME NULL,
                        pause_reason TEXT,
                        status_changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        performance_history JSON,
                        pause_threshold DECIMAL(5,2) DEFAULT 95.0,
                        min_stable_runs INT DEFAULT 10,
                        INDEX idx_pathogen_status (pathogen_code, training_status)
                    )
                """))
                
                # Check if record exists
                result = conn.execute(text("""
                    SELECT id, current_accuracy, stable_since FROM ml_training_status 
                    WHERE pathogen_code = :pathogen_code
                """), {'pathogen_code': pathogen}).fetchone()
                
                if result:
                    # Update existing record
                    conn.execute(text("""
                        UPDATE ml_training_status 
                        SET training_status = :training_status,
                            current_accuracy = :current_accuracy,
                            pause_reason = :pause_reason,
                            status_changed_at = CURRENT_TIMESTAMP,
                            stable_since = CASE 
                                WHEN :training_status = 'paused' AND stable_since IS NULL 
                                THEN CURRENT_TIMESTAMP 
                                ELSE stable_since 
                            END
                        WHERE pathogen_code = :pathogen_code
                    """), {
                        'pathogen_code': pathogen,
                        'training_status': training_status,
                        'current_accuracy': accuracy,
                        'pause_reason': reason
                    })
                else:
                    # Insert new record
                    conn.execute(text("""
                        INSERT INTO ml_training_status 
                        (pathogen_code, training_status, current_accuracy, pause_reason)
                        VALUES (:pathogen_code, :training_status, :current_accuracy, :pause_reason)
                    """), {
                        'pathogen_code': pathogen,
                        'training_status': training_status,
                        'current_accuracy': accuracy,
                        'pause_reason': reason
                    })
                
                conn.commit()
                self.logger.info(f"Updated training status for {pathogen}: {training_status}")
                
            except Exception as e:
                self.logger.error(f"Error updating training status: {e}")
                raise
    
    def check_training_pause_recommendation(self, pathogen, recent_accuracy_scores):
        """Check if training should be paused based on performance plateau"""
        with self.engine.connect() as conn:
            try:
                # Get current training status
                result = conn.execute(text("""
                    SELECT training_status, current_accuracy, pause_threshold, min_stable_runs 
                    FROM ml_training_status 
                    WHERE pathogen_code = :pathogen_code
                """), {'pathogen_code': pathogen}).fetchone()
                
                if not result or result[0] != 'active':
                    return {'should_pause': False, 'reason': 'Training not active'}
                
                current_accuracy = result[1] or 0.0
                pause_threshold = result[2] or 95.0
                min_stable_runs = result[3] or 10
                
                # Check if we have enough data points
                if len(recent_accuracy_scores) < min_stable_runs:
                    return {
                        'should_pause': False, 
                        'reason': f'Need {min_stable_runs} stable runs, have {len(recent_accuracy_scores)}'
                    }
                
                # Check if accuracy is consistently high
                avg_accuracy = sum(recent_accuracy_scores) / len(recent_accuracy_scores)
                min_accuracy = min(recent_accuracy_scores)
                accuracy_variance = max(recent_accuracy_scores) - min(recent_accuracy_scores)
                
                # Recommend pause if:
                # 1. Average accuracy >= threshold
                # 2. Minimum accuracy >= threshold - 2%
                # 3. Variance < 3% (stable performance)
                should_pause = (
                    avg_accuracy >= pause_threshold and
                    min_accuracy >= (pause_threshold - 2.0) and
                    accuracy_variance < 3.0
                )
                
                recommendation = {
                    'should_pause': should_pause,
                    'reason': f'Avg: {avg_accuracy:.1f}%, Min: {min_accuracy:.1f}%, Variance: {accuracy_variance:.1f}%',
                    'avg_accuracy': avg_accuracy,
                    'min_accuracy': min_accuracy,
                    'variance': accuracy_variance,
                    'threshold': pause_threshold,
                    'stable_runs': len(recent_accuracy_scores)
                }
                
                if should_pause:
                    recommendation['pause_message'] = (
                        f"Model for {pathogen} has achieved sustained performance: "
                        f"{avg_accuracy:.1f}% average accuracy over {len(recent_accuracy_scores)} runs. "
                        f"Recommend pausing training to maintain regulatory consistency."
                    )
                
                return recommendation
                
            except Exception as e:
                self.logger.error(f"Error checking pause recommendation: {e}")
                return {'should_pause': False, 'reason': 'Error checking status'}
    
    def track_analysis_run(self, session_id, file_name, pathogen_codes, total_samples, ml_samples_analyzed, accuracy_percentage=None):
        """Track a complete analysis run for ML validation dashboard"""
        with self.engine.connect() as conn:
            try:
                # Create table if it doesn't exist
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS ml_analysis_runs (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        session_id VARCHAR(255) UNIQUE,
                        file_name VARCHAR(500),
                        pathogen_codes JSON,
                        total_samples INT,
                        ml_samples_analyzed INT,
                        accuracy_percentage DECIMAL(5,2),
                        status ENUM('pending', 'confirmed', 'rejected') DEFAULT 'pending',
                        logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        confirmed_at DATETIME NULL,
                        confirmed_by VARCHAR(255) NULL,
                        INDEX idx_session (session_id),
                        INDEX idx_status (status),
                        INDEX idx_logged (logged_at)
                    )
                """))
                
                # Insert or update analysis run
                conn.execute(text("""
                    INSERT INTO ml_analysis_runs 
                    (session_id, file_name, pathogen_codes, total_samples, 
                     ml_samples_analyzed, accuracy_percentage)
                    VALUES (:session_id, :file_name, :pathogen_codes, :total_samples, 
                            :ml_samples_analyzed, :accuracy_percentage)
                    ON DUPLICATE KEY UPDATE
                        ml_samples_analyzed = :ml_samples_analyzed,
                        accuracy_percentage = :accuracy_percentage,
                        logged_at = CURRENT_TIMESTAMP
                """), {
                    'session_id': str(session_id),
                    'file_name': file_name,
                    'pathogen_codes': json.dumps(pathogen_codes) if isinstance(pathogen_codes, list) else str(pathogen_codes),
                    'total_samples': total_samples,
                    'ml_samples_analyzed': ml_samples_analyzed,
                    'accuracy_percentage': accuracy_percentage or 85.0
                })
                
                conn.commit()
                self.logger.info(f"Analysis run tracked: {session_id} with {ml_samples_analyzed} ML samples")
                
            except Exception as e:
                self.logger.error(f"Error tracking analysis run: {e}")
                raise

    def update_session_id(self, old_session_id, new_session_id):
        """Update session_id for an existing analysis run"""
        with self.engine.connect() as conn:
            try:
                conn.execute(text("""
                    UPDATE ml_analysis_runs 
                    SET session_id = :new_session_id
                    WHERE session_id = :old_session_id
                """), {
                    'old_session_id': str(old_session_id),
                    'new_session_id': str(new_session_id)
                })
                
                conn.commit()
                self.logger.info(f"Updated session_id from {old_session_id} to {new_session_id}")
                
            except Exception as e:
                self.logger.error(f"Error updating session_id: {e}")
                raise

    def confirm_analysis_run(self, session_id, confirmed_by='user'):
        """Confirm an analysis run as validated"""
        with self.engine.connect() as conn:
            try:
                conn.execute(text("""
                    UPDATE ml_analysis_runs 
                    SET status = 'confirmed', 
                        confirmed_at = CURRENT_TIMESTAMP,
                        confirmed_by = :confirmed_by
                    WHERE session_id = :session_id
                """), {
                    'session_id': str(session_id),
                    'confirmed_by': confirmed_by
                })
                
                conn.commit()
                self.logger.info(f"Analysis run confirmed: {session_id}")
                
            except Exception as e:
                self.logger.error(f"Error confirming analysis run: {e}")
                raise

    def get_training_status(self, pathogen=None):
        """Get training status for pathogen(s)"""
        with self.engine.connect() as conn:
            try:
                if pathogen:
                    # Get specific pathogen status
                    result = conn.execute(text("""
                        SELECT pathogen_code, training_status, current_accuracy, 
                               stable_since, pause_reason, status_changed_at,
                               pause_threshold, min_stable_runs
                        FROM ml_training_status 
                        WHERE pathogen_code = :pathogen_code
                    """), {'pathogen_code': pathogen}).fetchone()
                    
                    if result:
                        return {
                            'pathogen': result[0],
                            'status': result[1],
                            'accuracy': float(result[2]) if result[2] else 0.0,
                            'stable_since': result[3].isoformat() if result[3] else None,
                            'pause_reason': result[4],
                            'status_changed_at': result[5].isoformat() if result[5] else None,
                            'pause_threshold': float(result[6]) if result[6] else 95.0,
                            'min_stable_runs': result[7] or 10
                        }
                    else:
                        return {
                            'pathogen': pathogen,
                            'status': 'active',
                            'accuracy': 85.0,
                            'stable_since': None,
                            'pause_reason': None,
                            'status_changed_at': None,
                            'pause_threshold': 95.0,
                            'min_stable_runs': 10
                        }
                else:
                    # Get all pathogen statuses
                    results = conn.execute(text("""
                        SELECT pathogen_code, training_status, current_accuracy, 
                               stable_since, pause_reason, status_changed_at
                        FROM ml_training_status 
                        ORDER BY pathogen_code
                    """)).fetchall()
                    
                    statuses = {}
                    for row in results:
                        statuses[row[0]] = {
                            'status': row[1],
                            'accuracy': float(row[2]) if row[2] else 85.0,
                            'stable_since': row[3].isoformat() if row[3] else None,
                            'pause_reason': row[4],
                            'status_changed_at': row[5].isoformat() if row[5] else None
                        }
                    
                    return statuses
                    
            except Exception as e:
                self.logger.error(f"Error getting training status: {e}")
                return {}
    
    def should_accept_training(self, pathogen):
        """Check if training should be accepted for this pathogen"""
        status = self.get_training_status(pathogen)
        return status.get('status', 'active') == 'active'

# Global tracker instance
ml_tracker = MLValidationTracker()
