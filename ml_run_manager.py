"""
ML Run Management System
Handles the workflow: Log Runs → Confirm Runs → Record Accuracy
"""

import os
from datetime import datetime
import json
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

class MLRunManager:
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
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.init_tables()
    
    def get_db_connection(self):
        """Get database connection"""
        return self.engine.connect()
    
    def init_tables(self):
        """Initialize ML run management tables"""
        with self.engine.connect() as conn:
            # Create ml_run_logs table for logged but unconfirmed runs
            conn.execute(text('''
                CREATE TABLE IF NOT EXISTS ml_run_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    run_id VARCHAR(255) UNIQUE NOT NULL,
                    file_name TEXT NOT NULL,
                    session_id VARCHAR(255),
                    pathogen_code VARCHAR(255),
                    total_samples INT DEFAULT 0,
                    completed_samples INT DEFAULT 0,
                    notes TEXT,
                    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    status VARCHAR(50) DEFAULT 'pending'
                )
            '''))
            
            # Create ml_confirmed_runs table for confirmed runs with accuracy data
            conn.execute(text('''
                CREATE TABLE IF NOT EXISTS ml_confirmed_runs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    run_id VARCHAR(255) UNIQUE NOT NULL,
                    file_name TEXT NOT NULL,
                    session_id VARCHAR(255),
                    pathogen_code VARCHAR(255),
                    total_samples INT DEFAULT 0,
                    completed_samples INT DEFAULT 0,
                    notes TEXT,
                    logged_at TIMESTAMP,
                    confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    accuracy_score DECIMAL(5,2),
                    validation_results TEXT,
                    INDEX idx_run_id (run_id),
                    INDEX idx_pathogen (pathogen_code),
                    INDEX idx_confirmed_at (confirmed_at)
                )
            '''))
            
            conn.commit()
    
    def log_run(self, run_id, file_name, session_id=None, pathogen_code=None, total_samples=0, completed_samples=0, notes=None):
        """Log a new run (Step 1: Log)"""
        with self.engine.connect() as conn:
            try:
                conn.execute(text('''
                    INSERT INTO ml_run_logs 
                    (run_id, file_name, session_id, pathogen_code, total_samples, completed_samples, notes)
                    VALUES (:run_id, :file_name, :session_id, :pathogen_code, :total_samples, :completed_samples, :notes)
                '''), {
                    'run_id': run_id,
                    'file_name': file_name,
                    'session_id': session_id,
                    'pathogen_code': pathogen_code,
                    'total_samples': total_samples,
                    'completed_samples': completed_samples,
                    'notes': notes
                })
                
                conn.commit()
                return run_id
            except Exception as e:
                if "Duplicate entry" in str(e):
                    return None  # Already exists
                raise e
    
    def get_pending_runs(self):
        """Get runs that have been logged but not yet confirmed"""
        with self.engine.connect() as conn:
            result = conn.execute(text('''
                SELECT * FROM ml_run_logs 
                WHERE status = 'pending' 
                ORDER BY logged_at DESC
            '''))
            
            runs = []
            for row in result:
                runs.append(dict(row._mapping))
            
            return runs
    
    def confirm_run(self, run_id, confirmed=True):
        """Confirm a run (Step 2: Confirm) and record accuracy (Step 3: Record Accuracy)"""
        with self.engine.connect() as conn:
            if not confirmed:
                # If not confirmed, just update status to rejected
                conn.execute(text('''
                    UPDATE ml_run_logs 
                    SET status = 'rejected' 
                    WHERE run_id = :run_id
                '''), {'run_id': run_id})
                conn.commit()
                return True
            
            # Get the pending run
            result = conn.execute(text('SELECT * FROM ml_run_logs WHERE run_id = :run_id AND status = "pending"'), {'run_id': run_id})
            pending_run = result.fetchone()
            
            if not pending_run:
                return False
            
            try:
                # Move to confirmed_runs table
                conn.execute(text('''
                    INSERT INTO ml_confirmed_runs 
                    (run_id, file_name, session_id, pathogen_code, total_samples, completed_samples, notes, logged_at)
                    VALUES (:run_id, :file_name, :session_id, :pathogen_code, :total_samples, :completed_samples, :notes, :logged_at)
                '''), {
                    'run_id': pending_run.run_id,
                    'file_name': pending_run.file_name,
                    'session_id': pending_run.session_id,
                    'pathogen_code': pending_run.pathogen_code,
                    'total_samples': pending_run.total_samples,
                    'completed_samples': pending_run.completed_samples,
                    'notes': pending_run.notes,
                    'logged_at': pending_run.logged_at
                })
                
                # Update status in logs table
                conn.execute(text('''
                    UPDATE ml_run_logs 
                    SET status = 'confirmed' 
                    WHERE run_id = :run_id
                '''), {'run_id': run_id})
                
                conn.commit()
                
                # Now record accuracy (Step 3: Record Accuracy after every confirm)
                accuracy_result = self._record_accuracy_for_confirmed_run(run_id)
                
                return True
                
            except Exception as e:
                if "Duplicate entry" in str(e):
                    return False  # Already confirmed
                raise e
    
    def _record_accuracy_for_confirmed_run(self, run_id):
        """Record accuracy after confirmation (Step 3: Record Accuracy)"""
        with self.engine.connect() as conn:
            # Get the confirmed run
            result = conn.execute(text('SELECT * FROM ml_confirmed_runs WHERE run_id = :run_id'), {'run_id': run_id})
            confirmed_run = result.fetchone()
            
            if not confirmed_run:
                return {'success': False, 'message': f'Confirmed run {run_id} not found'}
            
            # Calculate accuracy based on completion rate and sample performance
            # This is a simplified accuracy calculation - can be enhanced with actual ML metrics
            total_samples = confirmed_run.total_samples or 1
            completed_samples = confirmed_run.completed_samples or 0
            completion_rate = completed_samples / total_samples
            
            # Base accuracy on completion rate (this can be enhanced with actual ML validation)
            accuracy_score = completion_rate * 100  # Convert to percentage
            
            # Create validation results summary
            validation_results = {
                'total_samples': total_samples,
                'completed_samples': completed_samples,
                'completion_rate': completion_rate,
                'accuracy_recorded_at': datetime.now().isoformat(),
                'pathogen_code': confirmed_run.pathogen_code,
                'session_id': confirmed_run.session_id
            }
            
            # Update the confirmed run with accuracy data
            conn.execute(text('''
                UPDATE ml_confirmed_runs 
                SET accuracy_score = :accuracy_score, validation_results = :validation_results
                WHERE run_id = :run_id
            '''), {
                'accuracy_score': accuracy_score,
                'validation_results': json.dumps(validation_results),
                'run_id': run_id
            })
            
            conn.commit()
            
            return {
                'success': True,
                'accuracy_score': accuracy_score,
                'validation_results': validation_results
            }
    
    def get_confirmed_runs(self, limit=None):
        """Get all confirmed runs with their accuracy data"""
        with self.engine.connect() as conn:
            query = """
            SELECT * FROM ml_confirmed_runs
            ORDER BY confirmed_at DESC
            """
            
            if limit:
                query += f' LIMIT {int(limit)}'
            
            result = conn.execute(text(query))
            
            runs = []
            for row in result:
                run_dict = dict(row._mapping)
                if run_dict.get('validation_results'):
                    try:
                        run_dict['validation_results'] = json.loads(run_dict['validation_results'])
                    except:
                        pass
                runs.append(run_dict)
            
            return runs
    
    def get_run_statistics(self):
        """Get statistics about runs"""
        with self.engine.connect() as conn:
            # Get pending runs count
            result = conn.execute(text('SELECT COUNT(*) as count FROM ml_run_logs WHERE status = "pending"'))
            pending_count = result.fetchone().count
            
            # Get confirmed runs count
            result = conn.execute(text('SELECT COUNT(*) as count FROM ml_confirmed_runs'))
            confirmed_count = result.fetchone().count
            
            # Get rejected runs count
            result = conn.execute(text('SELECT COUNT(*) as count FROM ml_run_logs WHERE status = "rejected"'))
            rejected_count = result.fetchone().count
            
            # Get average accuracy for confirmed runs
            result = conn.execute(text('SELECT AVG(accuracy_score) as avg_accuracy FROM ml_confirmed_runs WHERE accuracy_score IS NOT NULL'))
            avg_accuracy_result = result.fetchone()
            avg_accuracy = avg_accuracy_result.avg_accuracy if avg_accuracy_result.avg_accuracy else 0
            
            return {
                'pending_runs': pending_count,
                'confirmed_runs': confirmed_count,
                'rejected_runs': rejected_count,
                'total_runs': pending_count + confirmed_count + rejected_count,
                'average_accuracy': round(float(avg_accuracy), 2) if avg_accuracy else 0,
                'confirmation_rate': round((confirmed_count / (confirmed_count + rejected_count)) * 100, 2) if (confirmed_count + rejected_count) > 0 else 0
            }
    
    def delete_run(self, run_id, include_confirmed=False):
        """Delete a run: pending log always; confirmed only if explicitly allowed"""
        with self.engine.connect() as conn:
            # Always allow deleting from logs (pending/rejected entries)
            conn.execute(text('DELETE FROM ml_run_logs WHERE run_id = :run_id'), {'run_id': run_id})
            deleted_confirmed = 0
            if include_confirmed:
                result = conn.execute(text('DELETE FROM ml_confirmed_runs WHERE run_id = :run_id'), {'run_id': run_id})
                try:
                    deleted_confirmed = result.rowcount  # type: ignore[attr-defined]
                except Exception:
                    deleted_confirmed = 0
            conn.commit()
            msg = f"Run {run_id} deleted from logs" + (" and confirmed runs" if include_confirmed and deleted_confirmed else "")
            return {'success': True, 'message': msg}

    def delete_confirmed_run_admin(self, run_id):
        """ADMIN USE: Delete a confirmed run record"""
        with self.engine.connect() as conn:
            conn.execute(text('DELETE FROM ml_confirmed_runs WHERE run_id = :run_id'), {'run_id': run_id})
            conn.commit()
            return {'success': True, 'message': f'Confirmed run {run_id} deleted'}
