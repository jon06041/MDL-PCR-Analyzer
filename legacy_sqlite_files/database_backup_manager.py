#!/usr/bin/env python3
"""
Database Backup and Recovery Manager for MDL-PCR-Analyzer
Provides automatic backups, development resets, and ML model impact tracking
"""

import os
import sqlite3
import shutil
import json
import datetime
import time
from pathlib import Path
import hashlib
import zipfile
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DatabaseBackupManager:
    def __init__(self, db_path='qpcr_analysis.db'):
        self.db_path = db_path
        self.backup_dir = Path('db_backups')
        self.backup_dir.mkdir(exist_ok=True)
        
        # Backup configuration
        self.auto_backup_interval = 3600  # 1 hour in seconds
        self.max_backups = 50  # Keep last 50 backups
    
    def _get_db_connection(self):
        """Get database connection with proper timeout and settings"""
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        # Enable WAL mode for better concurrent access
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA synchronous=NORMAL')
        conn.execute('PRAGMA cache_size=10000')
        conn.execute('PRAGMA temp_store=MEMORY')
        return conn
    
    def _execute_with_retry(self, operation_func, max_retries=3, delay=0.1):
        """Execute database operation with retry logic for handling locks"""
        for attempt in range(max_retries):
            try:
                return operation_func()
            except sqlite3.OperationalError as e:
                if "database is locked" in str(e) and attempt < max_retries - 1:
                    logger.warning(f"Database locked, retrying in {delay} seconds (attempt {attempt + 1}/{max_retries})")
                    time.sleep(delay)
                    delay *= 2  # Exponential backoff
                    continue
                else:
                    raise e
            except Exception as e:
                # Re-raise non-lock exceptions immediately
                raise e
        
    def create_backup(self, backup_type='manual', description=''):
        """Create a timestamped backup of the database"""
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f'qpcr_analysis_{backup_type}_{timestamp}.db'
        backup_path = self.backup_dir / backup_filename
        
        try:
            # Create backup
            shutil.copy2(self.db_path, backup_path)
            
            # Create metadata file
            metadata = {
                'backup_type': backup_type,
                'timestamp': timestamp,
                'description': description,
                'original_size': os.path.getsize(self.db_path),
                'backup_size': os.path.getsize(backup_path),
                'md5_hash': self._get_file_hash(backup_path)
            }
            
            metadata_path = backup_path.with_suffix('.json')
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
                
            logger.info(f"Backup created: {backup_filename}")
            
            # Clean up old backups
            self._cleanup_old_backups()
            
            return backup_path, metadata
            
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            return None, None
            
    def restore_backup(self, backup_path):
        """Restore database from backup"""
        try:
            # Create safety backup first
            safety_backup, _ = self.create_backup('pre_restore', 'Before restoring backup')
            
            # Restore the backup
            shutil.copy2(backup_path, self.db_path)
            
            logger.info(f"Database restored from: {backup_path}")
            logger.info(f"Safety backup created: {safety_backup}")
            
            return True
            
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            return False
            
    def list_backups(self):
        """List all available backups with metadata"""
        backups = []
        
        for backup_file in self.backup_dir.glob('*.db'):
            metadata_file = backup_file.with_suffix('.json')
            
            if metadata_file.exists():
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                metadata['file_path'] = str(backup_file)
                backups.append(metadata)
            else:
                # Backup without metadata
                backups.append({
                    'file_path': str(backup_file),
                    'backup_type': 'unknown',
                    'timestamp': backup_file.stem.split('_')[-1] if '_' in backup_file.stem else 'unknown'
                })
                
        return sorted(backups, key=lambda x: x.get('timestamp', ''), reverse=True)
        
    def reset_development_data(self, preserve_structure=True):
        """Reset data for development while preserving schema"""
        backup_path, _ = self.create_backup('pre_dev_reset', 'Before development reset')
        
        def _reset_data():
            conn = self._get_db_connection()
            cursor = conn.cursor()
            
            if preserve_structure:
                # Clear data but keep schema
                tables_to_clear = [
                    'ml_prediction_tracking',
                    'ml_training_history', 
                    'ml_model_performance',
                    'analysis_sessions',
                    'well_results'
                ]
                
                for table in tables_to_clear:
                    cursor.execute(f"DELETE FROM {table}")
                    logger.info(f"Cleared data from {table}")
                    
                # Reset model versions training counts
                cursor.execute("UPDATE ml_model_versions SET training_samples_count = 0")
                
            else:
                # Full reset - drop and recreate tables
                logger.warning("Full development reset - this will recreate all tables")
                # Would implement schema recreation here
                
            conn.commit()
            conn.close()
            
            logger.info("Development data reset completed")
            logger.info(f"Backup created at: {backup_path}")
            
            return True
        
        try:
            return self._execute_with_retry(_reset_data)
        except Exception as e:
            logger.error(f"Development reset failed: {e}")
            return False
            
    def track_model_change_impact(self, model_type, pathogen_code, change_description):
        """Track when model changes occur and their potential impact"""
        def _track_change():
            conn = self._get_db_connection()
            cursor = conn.cursor()
            
            # Record the change in audit log
            cursor.execute("""
                INSERT INTO ml_audit_log 
                (event_type, model_type, pathogen_code, details, impact_assessment, requires_validation)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                'model_change',
                model_type,
                pathogen_code, 
                change_description,
                'requires_assessment',
                True
            ))
            
            # Flag models that may need revalidation
            cursor.execute("""
                UPDATE ml_model_versions 
                SET requires_validation = 1, validation_notes = ?
                WHERE model_type = ? AND pathogen_code = ?
            """, (
                f"Model changed: {change_description}",
                model_type,
                pathogen_code
            ))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Tracked model change impact for {model_type}/{pathogen_code}")
            return True
        
        try:
            return self._execute_with_retry(_track_change)
        except Exception as e:
            logger.error(f"Failed to track model change: {e}")
            return False
            
    def get_validation_required_models(self):
        """Get models that need validation due to changes"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT mv.model_type, mv.pathogen_code, mv.version_number,
                       mp.notes, mp.run_date
                FROM ml_model_versions mv
                JOIN ml_model_performance mp ON mv.id = mp.model_version_id
                WHERE mp.test_type = 'VALIDATION_PENDING'
                ORDER BY mp.run_date DESC
            """)
            
            results = cursor.fetchall()
            conn.close()
            
            return [
                {
                    'model_type': row[0],
                    'pathogen_code': row[1], 
                    'version': row[2],
                    'reason': row[3],
                    'date_flagged': row[4]
                }
                for row in results
            ]
            
        except Exception as e:
            logger.error(f"Failed to get validation required models: {e}")
            return []
            
    def _get_file_hash(self, file_path):
        """Calculate MD5 hash of file"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
        
    def _cleanup_old_backups(self):
        """Remove old backups beyond max_backups limit"""
        backups = self.list_backups()
        
        if len(backups) > self.max_backups:
            for backup in backups[self.max_backups:]:
                backup_path = Path(backup['file_path'])
                metadata_path = backup_path.with_suffix('.json')
                
                backup_path.unlink(missing_ok=True)
                metadata_path.unlink(missing_ok=True)
                
                logger.info(f"Removed old backup: {backup_path.name}")


class MLValidationTracker:
    """Track ML model validation and QC technician confirmations"""
    
    def __init__(self, db_path='qpcr_analysis.db'):
        self.db_path = db_path
        
    def create_qc_validation_run(self, run_file_name, qc_technician, pathogen_codes):
        """Create a new QC validation run"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create validation session
            session_id = f'qc_validation_{datetime.datetime.now().strftime("%Y%m%d_%H%M%S")}'
            
            cursor.execute("""
                INSERT INTO expert_review_sessions (
                    session_id, reviewer_name, session_type, start_time,
                    pathogens_reviewed, review_status
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                session_id,
                qc_technician,
                'QC_VALIDATION',
                datetime.datetime.now().isoformat(),
                json.dumps(pathogen_codes),
                'IN_PROGRESS'
            ))
            
            conn.commit()
            conn.close()
            
            logger.info(f"QC validation run created: {session_id}")
            return session_id
            
        except Exception as e:
            logger.error(f"Failed to create QC validation run: {e}")
            return None
            
    def record_qc_confirmation(self, session_id, well_id, ml_prediction, expert_decision, confidence_level):
        """Record QC technician confirmation of ML predictions"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Find the latest model performance record for this pathogen
            cursor.execute("""
                SELECT id FROM ml_model_performance 
                WHERE run_file_name = ? OR session_id = ?
                ORDER BY run_date DESC LIMIT 1
            """, (session_id, session_id))
            
            performance_id = cursor.fetchone()
            if not performance_id:
                # Create new performance record
                cursor.execute("""
                    INSERT INTO ml_model_performance (
                        model_version_id, run_file_name, session_id,
                        total_predictions, correct_predictions, expert_overrides,
                        test_type, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    1,  # Default to first model version
                    session_id,
                    session_id,
                    0, 0, 0,
                    'QC_VALIDATION',
                    'QC technician validation run'
                ))
                performance_id = cursor.lastrowid
            else:
                performance_id = performance_id[0]
            
            # Record the prediction tracking
            is_correct = ml_prediction == expert_decision
            is_override = ml_prediction != expert_decision
            
            cursor.execute("""
                INSERT INTO ml_prediction_tracking (
                    performance_id, well_id, ml_prediction, expert_decision,
                    final_classification, is_expert_override, is_correct_prediction,
                    prediction_timestamp, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                performance_id,
                well_id,
                ml_prediction,
                expert_decision,
                expert_decision,  # Expert decision is final
                is_override,
                is_correct,
                datetime.datetime.now().isoformat(),
                f'QC confidence: {confidence_level}'
            ))
            
            # Update performance statistics
            cursor.execute("""
                UPDATE ml_model_performance 
                SET total_predictions = total_predictions + 1,
                    correct_predictions = correct_predictions + ?,
                    expert_overrides = expert_overrides + ?
                WHERE id = ?
            """, (1 if is_correct else 0, 1 if is_override else 0, performance_id))
            
            conn.commit()
            conn.close()
            
            logger.info(f"QC confirmation recorded: {well_id} - {ml_prediction} -> {expert_decision}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to record QC confirmation: {e}")
            return False
            
    def get_pathogen_accuracy_stats(self, pathogen_code=None, days_back=30):
        """Get accuracy statistics for pathogen models"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            date_filter = (datetime.datetime.now() - datetime.timedelta(days=days_back)).isoformat()
            
            if pathogen_code:
                cursor.execute("""
                    SELECT mp.pathogen_code, 
                           COUNT(mpt.id) as total_predictions,
                           SUM(CASE WHEN mpt.is_correct_prediction THEN 1 ELSE 0 END) as correct_predictions,
                           SUM(CASE WHEN mpt.is_expert_override THEN 1 ELSE 0 END) as expert_overrides,
                           ROUND(AVG(CASE WHEN mpt.is_correct_prediction THEN 100.0 ELSE 0.0 END), 2) as accuracy_percentage
                    FROM ml_model_performance mp
                    JOIN ml_prediction_tracking mpt ON mp.id = mpt.performance_id
                    WHERE mp.pathogen_code = ? AND mpt.prediction_timestamp >= ?
                    GROUP BY mp.pathogen_code
                """, (pathogen_code, date_filter))
            else:
                cursor.execute("""
                    SELECT mp.pathogen_code, 
                           COUNT(mpt.id) as total_predictions,
                           SUM(CASE WHEN mpt.is_correct_prediction THEN 1 ELSE 0 END) as correct_predictions,
                           SUM(CASE WHEN mpt.is_expert_override THEN 1 ELSE 0 END) as expert_overrides,
                           ROUND(AVG(CASE WHEN mpt.is_correct_prediction THEN 100.0 ELSE 0.0 END), 2) as accuracy_percentage
                    FROM ml_model_performance mp
                    JOIN ml_prediction_tracking mpt ON mp.id = mpt.performance_id
                    WHERE mpt.prediction_timestamp >= ?
                    GROUP BY mp.pathogen_code
                    ORDER BY accuracy_percentage DESC
                """, (date_filter,))
            
            results = cursor.fetchall()
            conn.close()
            
            return [
                {
                    'pathogen_code': row[0],
                    'total_predictions': row[1],
                    'correct_predictions': row[2],
                    'expert_overrides': row[3],
                    'accuracy_percentage': row[4]
                }
                for row in results
            ]
            
        except Exception as e:
            logger.error(f"Failed to get pathogen accuracy stats: {e}")
            return []


def main():
    """CLI interface for backup management"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Database Backup Manager')
    parser.add_argument('action', choices=['backup', 'restore', 'list', 'reset', 'track-change', 'validation-stats'])
    parser.add_argument('--backup-path', help='Path to backup file for restore')
    parser.add_argument('--description', help='Description for backup')
    parser.add_argument('--model-type', help='Model type for change tracking')
    parser.add_argument('--pathogen', help='Pathogen code for change tracking')
    parser.add_argument('--change-desc', help='Description of model change')
    parser.add_argument('--preserve-structure', action='store_true', help='Preserve schema during reset')
    
    args = parser.parse_args()
    
    backup_manager = DatabaseBackupManager()
    
    if args.action == 'backup':
        backup_path, metadata = backup_manager.create_backup('manual', args.description or '')
        if backup_path:
            print(f"Backup created: {backup_path}")
        else:
            print("Backup failed")
            
    elif args.action == 'restore':
        if not args.backup_path:
            print("--backup-path required for restore")
            return
        success = backup_manager.restore_backup(args.backup_path)
        print("Restore successful" if success else "Restore failed")
        
    elif args.action == 'list':
        backups = backup_manager.list_backups()
        print(f"Found {len(backups)} backups:")
        for backup in backups:
            print(f"  {backup['timestamp']} - {backup['backup_type']} - {backup.get('description', 'No description')}")
            
    elif args.action == 'reset':
        success = backup_manager.reset_development_data(args.preserve_structure)
        print("Development reset successful" if success else "Development reset failed")
        
    elif args.action == 'track-change':
        if not all([args.model_type, args.pathogen, args.change_desc]):
            print("--model-type, --pathogen, and --change-desc required for change tracking")
            return
        affected = backup_manager.track_model_change_impact(args.model_type, args.pathogen, args.change_desc)
        print(f"Tracked model change: {len(affected)} models flagged for validation")
        
    elif args.action == 'validation-stats':
        tracker = MLValidationTracker()
        stats = tracker.get_pathogen_accuracy_stats(args.pathogen)
        print("Pathogen Accuracy Statistics:")
        for stat in stats:
            print(f"  {stat['pathogen_code']}: {stat['accuracy_percentage']}% ({stat['correct_predictions']}/{stat['total_predictions']})")


if __name__ == '__main__':
    main()
