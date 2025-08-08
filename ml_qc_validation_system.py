#!/usr/bin/env python3
"""
Enhanced ML QC Validation System
- Milestone-based versioning (40+ samples)
- Run-level tracking with file organization
- QC confirmation workflow
- Evidence-based capability assessment
"""

import sqlite3
import json
import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path
import logging

class MLQCValidationSystem:
    def __init__(self, db_path='qpcr_analysis.db', runs_base_dir='ml_validation_runs'):
        self.db_path = db_path
        self.runs_base_dir = runs_base_dir
        self.logger = logging.getLogger(__name__)
        self.ensure_directories()
        self.init_qc_tables()
        
    def ensure_directories(self):
        """Create directory structure for ML validation runs"""
        base_path = Path(self.runs_base_dir)
        base_path.mkdir(exist_ok=True)
        
        # Create subdirectories for each pathogen
        subdirs = ['training_runs', 'prediction_runs', 'qc_confirmed_runs', 'validation_evidence']
        for subdir in subdirs:
            (base_path / subdir).mkdir(exist_ok=True)
    
    def get_db_connection(self):
        """Get database connection with proper settings"""
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        return conn
    
    def init_qc_tables(self):
        """Initialize QC-specific tables"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            # QC Run Tracking Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ml_qc_runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id TEXT UNIQUE NOT NULL,
                    pathogen_code TEXT NOT NULL,
                    run_type TEXT NOT NULL,  -- 'training', 'prediction', 'validation'
                    run_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    total_samples INTEGER NOT NULL DEFAULT 0,
                    correct_predictions INTEGER NOT NULL DEFAULT 0,
                    accuracy_rate REAL NOT NULL DEFAULT 0.0,
                    qc_status TEXT DEFAULT 'pending',  -- 'pending', 'confirmed', 'rejected'
                    qc_confirmed_by TEXT,
                    qc_confirmation_date DATETIME,
                    qc_notes TEXT,
                    file_directory TEXT,
                    model_version TEXT,
                    evidence_level TEXT DEFAULT 'preliminary',  -- 'preliminary', 'validated', 'certified'
                    milestone_achieved BOOLEAN DEFAULT FALSE
                )
            """)
            
            # QC Sample Details Table  
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ml_qc_sample_details (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id TEXT NOT NULL,
                    sample_id TEXT NOT NULL,
                    well_id TEXT,
                    pathogen_code TEXT NOT NULL,
                    ml_prediction TEXT NOT NULL,
                    ml_confidence REAL,
                    qc_expected_result TEXT,
                    qc_actual_result TEXT,
                    is_correct BOOLEAN,
                    qc_verified_by TEXT,
                    qc_verification_date DATETIME,
                    sample_file_path TEXT,
                    notes TEXT,
                    FOREIGN KEY (run_id) REFERENCES ml_qc_runs(run_id)
                )
            """)
            
            # Model Version Milestones Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ml_model_milestones (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pathogen_code TEXT NOT NULL,
                    milestone_type TEXT NOT NULL,  -- 'training_40', 'validation_100', 'production_500'
                    version_number TEXT NOT NULL,
                    achievement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    total_samples INTEGER NOT NULL,
                    cumulative_accuracy REAL NOT NULL,
                    evidence_runs INTEGER NOT NULL,
                    qc_confirmed_runs INTEGER NOT NULL,
                    certification_status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'production'
                    certified_by TEXT,
                    certification_date DATETIME,
                    notes TEXT
                )
            """)
            
            conn.commit()
            print("✅ QC validation tables initialized")
            
        except Exception as e:
            self.logger.error(f"Error initializing QC tables: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def create_run_directory(self, pathogen_code, run_type, run_id):
        """Create organized directory structure for a run"""
        pathogen_safe = pathogen_code.replace(' ', '_').replace('/', '_')
        run_dir = Path(self.runs_base_dir) / f"{run_type}_runs" / pathogen_safe / run_id
        run_dir.mkdir(parents=True, exist_ok=True)
        
        # Create subdirectories
        (run_dir / 'input_files').mkdir(exist_ok=True)
        (run_dir / 'predictions').mkdir(exist_ok=True)
        (run_dir / 'qc_results').mkdir(exist_ok=True)
        (run_dir / 'evidence').mkdir(exist_ok=True)
        
        return str(run_dir)
    
    def register_prediction_run(self, pathogen_code, samples_data, model_version):
        """Register a new prediction run for QC tracking"""
        run_id = f"{pathogen_code.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        run_dir = self.create_run_directory(pathogen_code, 'prediction', run_id)
        
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Calculate initial accuracy (if we have expected results)
            total_samples = len(samples_data)
            correct_predictions = sum(1 for sample in samples_data 
                                    if sample.get('is_correct', False))
            accuracy_rate = correct_predictions / total_samples if total_samples > 0 else 0.0
            
            # Register the run
            cursor.execute("""
                INSERT INTO ml_qc_runs 
                (run_id, pathogen_code, run_type, total_samples, correct_predictions, 
                 accuracy_rate, file_directory, model_version)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (run_id, pathogen_code, 'prediction', total_samples, 
                  correct_predictions, accuracy_rate, run_dir, model_version))
            
            # Register individual samples
            for sample in samples_data:
                cursor.execute("""
                    INSERT INTO ml_qc_sample_details
                    (run_id, sample_id, well_id, pathogen_code, ml_prediction, 
                     ml_confidence, qc_expected_result, is_correct)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (run_id, sample.get('sample_id'), sample.get('well_id'),
                      pathogen_code, sample.get('ml_prediction'), 
                      sample.get('ml_confidence'), sample.get('expected_result'),
                      sample.get('is_correct', False)))
            
            conn.commit()
            
            # Save run metadata
            self.save_run_metadata(run_dir, {
                'run_id': run_id,
                'pathogen_code': pathogen_code,
                'run_type': 'prediction',
                'total_samples': total_samples,
                'accuracy_rate': accuracy_rate,
                'model_version': model_version,
                'created_date': datetime.now().isoformat()
            })
            
            print(f"✅ Prediction run registered: {run_id} ({accuracy_rate:.1%} accuracy)")
            return run_id
            
        except Exception as e:
            self.logger.error(f"Error registering prediction run: {e}")
            conn.rollback()
            return None
        finally:
            conn.close()
    
    def qc_confirm_run(self, run_id, qc_user, accuracy_override=None, notes=""):
        """QC confirmation of a run with evidence validation"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Get run details
            cursor.execute("SELECT * FROM ml_qc_runs WHERE run_id = ?", (run_id,))
            run = cursor.fetchone()
            
            if not run:
                raise ValueError(f"Run {run_id} not found")
            
            # Update accuracy if provided
            final_accuracy = accuracy_override if accuracy_override is not None else run['accuracy_rate']
            
            # Determine evidence level based on accuracy and sample count
            evidence_level = self.determine_evidence_level(
                final_accuracy, run['total_samples'], run['pathogen_code']
            )
            
            # Update run status
            cursor.execute("""
                UPDATE ml_qc_runs 
                SET qc_status = 'confirmed', 
                    qc_confirmed_by = ?, 
                    qc_confirmation_date = ?, 
                    qc_notes = ?,
                    accuracy_rate = ?,
                    evidence_level = ?
                WHERE run_id = ?
            """, (qc_user, datetime.now().isoformat(), notes, 
                  final_accuracy, evidence_level, run_id))
            
            # Check for validation milestone achievement (not teaching)
            validation_milestone = self.check_validation_milestone(run['pathogen_code'])
            
            if validation_milestone:
                cursor.execute("""
                    UPDATE ml_qc_runs 
                    SET milestone_achieved = TRUE 
                    WHERE run_id = ?
                """, (run_id,))
            
            conn.commit()
            
            # Move to confirmed runs directory
            self.move_to_confirmed_directory(run['file_directory'], run_id)
            
            print(f"✅ QC confirmed run {run_id}: {final_accuracy:.1%} accuracy, {evidence_level} evidence")
            
            if validation_milestone:
                print(f"� VALIDATION MILESTONE achieved for {run['pathogen_code']}! Model ready for production")
                
            return True
            
        except Exception as e:
            self.logger.error(f"Error confirming QC run: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()
    
    def determine_evidence_level(self, accuracy, sample_count, pathogen_code):
        """Determine evidence level based on performance criteria"""
        if accuracy >= 0.995 and sample_count >= 100:  # 99.5%+ with 100+ samples
            return "certified"
        elif accuracy >= 0.990 and sample_count >= 50:   # 99.0%+ with 50+ samples  
            return "validated"
        elif accuracy >= 0.950 and sample_count >= 20:   # 95.0%+ with 20+ samples
            return "preliminary"
        else:
            return "insufficient"
    
    def check_training_milestone(self, pathogen_code, teaching_samples_count):
        """Check if pathogen has achieved TEACHING milestone (40+ samples)"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Check if we've reached the 40+ teaching samples milestone
            if teaching_samples_count >= 40:
                # Check if milestone already recorded
                cursor.execute("""
                    SELECT COUNT(*) as count FROM ml_model_milestones 
                    WHERE pathogen_code = ? AND milestone_type = 'teaching_complete'
                """, (pathogen_code,))
                
                existing = cursor.fetchone()['count']
                
                if existing == 0:
                    # Record TEACHING milestone - this triggers training pause
                    # Use accuracy-based versioning instead of sample count
                    try:
                        from ml_validation_tracker import ml_tracker
                        # Get current accuracy for this pathogen (default to 85% for teaching phase)
                        current_accuracy = 0.85  # Starting accuracy for teaching phase
                        version_number = ml_tracker.calculate_version_from_accuracy(pathogen_code, current_accuracy)
                    except Exception:
                        # Fallback to teaching phase version
                        version_number = "v1.0"
                    cursor.execute("""
                        INSERT INTO ml_model_milestones
                        (pathogen_code, milestone_type, version_number, total_samples,
                         cumulative_accuracy, evidence_runs, qc_confirmed_runs, notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (pathogen_code, 'teaching_complete', version_number, teaching_samples_count,
                          0.0, 0, 0, f'Teaching milestone reached - PAUSE TRAINING, begin validation phase'))
                    
                    conn.commit()
                    print(f"🎓 TEACHING MILESTONE: {pathogen_code} reached {teaching_samples_count} samples - TRAINING PAUSED")
                    print(f"   Next phase: Validation runs to establish capability evidence")
                    return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Error checking teaching milestone: {e}")
            return False
        finally:
            conn.close()
    
    def check_validation_milestone(self, pathogen_code):
        """Check if pathogen has achieved VALIDATION milestone (proven capability)"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Only check validation if teaching is complete
            cursor.execute("""
                SELECT COUNT(*) as count FROM ml_model_milestones 
                WHERE pathogen_code = ? AND milestone_type = 'teaching_complete'
            """, (pathogen_code,))
            
            teaching_complete = cursor.fetchone()['count'] > 0
            
            if not teaching_complete:
                return False  # Still in teaching phase
            
            # Get validation run results (accuracy confirmations, not training)
            cursor.execute("""
                SELECT 
                    COUNT(*) as validation_runs,
                    SUM(total_samples) as total_validated_samples,
                    AVG(accuracy_rate) as avg_accuracy,
                    MIN(accuracy_rate) as worst_accuracy
                FROM ml_qc_runs 
                WHERE pathogen_code = ? 
                AND run_type = 'prediction'  -- These are validation runs
                AND qc_status = 'confirmed'
                AND evidence_level IN ('validated', 'certified')
            """, (pathogen_code,))
            
            result = cursor.fetchone()
            
            validation_runs = result['validation_runs'] or 0
            total_validated = result['total_validated_samples'] or 0
            avg_accuracy = result['avg_accuracy'] or 0
            worst_accuracy = result['worst_accuracy'] or 0
            
            # Validation milestone criteria: 
            # - 3+ validation runs completed
            # - 200+ total samples validated across runs
            # - Average accuracy ≥ 97%
            # - Worst run accuracy ≥ 95%
            if (validation_runs >= 3 and total_validated >= 200 and 
                avg_accuracy >= 0.97 and worst_accuracy >= 0.95):
                
                # Check if validation milestone already recorded
                cursor.execute("""
                    SELECT COUNT(*) as count FROM ml_model_milestones 
                    WHERE pathogen_code = ? AND milestone_type = 'validation_established'
                """, (pathogen_code,))
                
                existing = cursor.fetchone()['count']
                
                if existing == 0:
                    # Record VALIDATION milestone - model is now production ready
                    version_number = f"v2.0_validated"
                    cursor.execute("""
                        INSERT INTO ml_model_milestones
                        (pathogen_code, milestone_type, version_number, total_samples,
                         cumulative_accuracy, evidence_runs, qc_confirmed_runs, 
                         certification_status, notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (pathogen_code, 'validation_established', version_number, total_validated,
                          avg_accuracy, validation_runs, validation_runs, 'production_ready',
                          f'Validation complete: {validation_runs} runs, {total_validated} samples, {avg_accuracy:.1%} avg accuracy'))
                    
                    conn.commit()
                    print(f"🏆 VALIDATION MILESTONE: {pathogen_code} - MODEL PRODUCTION READY")
                    print(f"   Evidence: {validation_runs} runs, {total_validated} samples, {avg_accuracy:.1%} accuracy")
                    return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Error checking validation milestone: {e}")
            return False
        finally:
            conn.close()
    
    def should_pause_training(self, pathogen_code):
        """Check if training should be paused for this pathogen"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Check if teaching milestone reached (40+ samples)
            cursor.execute("""
                SELECT COUNT(*) as count FROM ml_model_milestones 
                WHERE pathogen_code = ? AND milestone_type = 'teaching_complete'
            """, (pathogen_code,))
            
            teaching_complete = cursor.fetchone()['count'] > 0
            
            if teaching_complete:
                print(f"⏸️  TRAINING PAUSED for {pathogen_code}: Teaching milestone reached")
                print(f"   Focus on validation runs to establish capability evidence")
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Error checking training pause status: {e}")
            return False
        finally:
            conn.close()
    
    def get_pathogen_phase(self, pathogen_code):
        """Get current phase for pathogen: teaching, validation, or production"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT milestone_type, achievement_date 
                FROM ml_model_milestones 
                WHERE pathogen_code = ? 
                ORDER BY achievement_date DESC
            """, (pathogen_code,))
            
            milestones = cursor.fetchall()
            
            if not milestones:
                return "teaching"  # No milestones yet
            
            latest_milestone = milestones[0]['milestone_type']
            
            if latest_milestone == 'validation_established':
                return "production"
            elif latest_milestone == 'teaching_complete':
                return "validation"
            else:
                return "teaching"
                
        except Exception as e:
            self.logger.error(f"Error getting pathogen phase: {e}")
            return "unknown"
        finally:
            conn.close()
    
    def move_to_confirmed_directory(self, original_dir, run_id):
        """Move confirmed run to QC confirmed directory"""
        try:
            original_path = Path(original_dir)
            confirmed_base = Path(self.runs_base_dir) / 'qc_confirmed_runs'
            confirmed_path = confirmed_base / original_path.name
            
            if original_path.exists() and original_path != confirmed_path:
                confirmed_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(original_path), str(confirmed_path))
                print(f"📁 Moved run to confirmed directory: {confirmed_path}")
                
        except Exception as e:
            self.logger.error(f"Error moving to confirmed directory: {e}")
        """Move confirmed run to QC confirmed directory"""
        try:
            original_path = Path(original_dir)
            confirmed_base = Path(self.runs_base_dir) / 'qc_confirmed_runs'
            confirmed_path = confirmed_base / original_path.name
            
            if original_path.exists() and original_path != confirmed_path:
                confirmed_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(original_path), str(confirmed_path))
                print(f"📁 Moved run to confirmed directory: {confirmed_path}")
                
        except Exception as e:
            self.logger.error(f"Error moving to confirmed directory: {e}")
    
    def save_run_metadata(self, run_dir, metadata):
        """Save run metadata to JSON file"""
        try:
            metadata_file = Path(run_dir) / 'run_metadata.json'
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
        except Exception as e:
            self.logger.error(f"Error saving run metadata: {e}")
    
    def get_qc_dashboard_data(self, pathogen_code=None):
        """Get comprehensive QC dashboard data"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            where_clause = "WHERE pathogen_code = ?" if pathogen_code else ""
            params = [pathogen_code] if pathogen_code else []
            
            # Get QC run summary
            cursor.execute(f"""
                SELECT 
                    pathogen_code,
                    COUNT(*) as total_runs,
                    SUM(total_samples) as total_samples,
                    AVG(accuracy_rate) as avg_accuracy,
                    SUM(CASE WHEN qc_status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_runs,
                    MAX(accuracy_rate) as best_accuracy,
                    MIN(accuracy_rate) as worst_accuracy
                FROM ml_qc_runs 
                {where_clause}
                GROUP BY pathogen_code
            """, params)
            
            qc_summary = {}
            for row in cursor.fetchall():
                qc_summary[row['pathogen_code']] = dict(row)
            
            # Get milestone achievements
            cursor.execute(f"""
                SELECT 
                    pathogen_code,
                    milestone_type,
                    version_number,
                    total_samples,
                    cumulative_accuracy,
                    certification_status,
                    achievement_date
                FROM ml_model_milestones 
                {where_clause}
                ORDER BY achievement_date DESC
            """, params)
            
            milestones = {}
            for row in cursor.fetchall():
                pathogen = row['pathogen_code']
                if pathogen not in milestones:
                    milestones[pathogen] = []
                milestones[pathogen].append(dict(row))
            
            # Get recent QC runs
            cursor.execute(f"""
                SELECT 
                    run_id, pathogen_code, run_type, total_samples, 
                    accuracy_rate, qc_status, evidence_level, run_date,
                    qc_confirmed_by, milestone_achieved
                FROM ml_qc_runs 
                {where_clause}
                ORDER BY run_date DESC 
                LIMIT 20
            """, params)
            
            recent_runs = [dict(row) for row in cursor.fetchall()]
            
            return {
                'qc_summary': qc_summary,
                'milestones': milestones,
                'recent_runs': recent_runs,
                'directory_structure': self.get_directory_structure()
            }
            
        except Exception as e:
            self.logger.error(f"Error getting QC dashboard data: {e}")
            return {}
        finally:
            conn.close()
    
    def get_directory_structure(self):
        """Get directory structure for QC access"""
        structure = {}
        base_path = Path(self.runs_base_dir)
        
        if base_path.exists():
            for subdir in ['training_runs', 'prediction_runs', 'qc_confirmed_runs']:
                subdir_path = base_path / subdir
                if subdir_path.exists():
                    structure[subdir] = {}
                    for pathogen_dir in subdir_path.iterdir():
                        if pathogen_dir.is_dir():
                            pathogen_name = pathogen_dir.name
                            structure[subdir][pathogen_name] = len(list(pathogen_dir.iterdir()))
        
        return structure

# Global QC system instance
ml_qc_system = MLQCValidationSystem()
