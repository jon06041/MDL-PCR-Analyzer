"""
ML Run Management System
Handles the workflow: Log Runs → Confirm Runs → Record Accuracy
"""

import sqlite3
from datetime import datetime
import json

class MLRunManager:
    def __init__(self):
        self.db_path = 'qpcr_analysis.db'
        self.init_tables()
    
    def get_db_connection(self):
        """Get database connection"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def init_tables(self):
        """Initialize ML run management tables"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        # Create ml_run_logs table for logged but unconfirmed runs
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ml_run_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT UNIQUE NOT NULL,
                file_name TEXT NOT NULL,
                session_id TEXT,
                pathogen_code TEXT,
                total_samples INTEGER DEFAULT 0,
                completed_samples INTEGER DEFAULT 0,
                notes TEXT,
                logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'pending'
            )
        ''')
        
        # Create ml_confirmed_runs table for confirmed runs with accuracy data
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ml_confirmed_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT UNIQUE NOT NULL,
                file_name TEXT NOT NULL,
                session_id TEXT,
                pathogen_code TEXT,
                total_samples INTEGER DEFAULT 0,
                completed_samples INTEGER DEFAULT 0,
                notes TEXT,
                logged_at TIMESTAMP,
                confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                accuracy_score REAL,
                validation_results TEXT,
                FOREIGN KEY (run_id) REFERENCES ml_run_logs(run_id)
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def log_run(self, run_id, file_name, session_id=None, pathogen_code=None, total_samples=0, completed_samples=0, notes=None):
        """Log a new run (Step 1: Log)"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO ml_run_logs 
                (run_id, file_name, session_id, pathogen_code, total_samples, completed_samples, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (run_id, file_name, session_id, pathogen_code, total_samples, completed_samples, notes))
            
            conn.commit()
            return {'success': True, 'message': f'Run {run_id} logged successfully'}
        except sqlite3.IntegrityError:
            return {'success': False, 'message': f'Run {run_id} already exists'}
        finally:
            conn.close()
    
    def get_pending_runs(self):
        """Get runs that have been logged but not yet confirmed"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM ml_run_logs 
            WHERE status = 'pending' 
            ORDER BY logged_at DESC
        ''')
        
        runs = cursor.fetchall()
        conn.close()
        
        return [dict(run) for run in runs]
    
    def confirm_run(self, run_id, confirmed=True):
        """Confirm a run (Step 2: Confirm) and record accuracy (Step 3: Record Accuracy)"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        if not confirmed:
            # If not confirmed, just update status to rejected
            cursor.execute('''
                UPDATE ml_run_logs 
                SET status = 'rejected' 
                WHERE run_id = ?
            ''', (run_id,))
            conn.commit()
            conn.close()
            return {'success': True, 'message': f'Run {run_id} rejected'}
        
        # Get the pending run
        cursor.execute('SELECT * FROM ml_run_logs WHERE run_id = ? AND status = "pending"', (run_id,))
        pending_run = cursor.fetchone()
        
        if not pending_run:
            conn.close()
            return {'success': False, 'message': f'Pending run {run_id} not found'}
        
        try:
            # Move to confirmed_runs table
            cursor.execute('''
                INSERT INTO ml_confirmed_runs 
                (run_id, file_name, session_id, pathogen_code, total_samples, completed_samples, notes, logged_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                pending_run['run_id'],
                pending_run['file_name'], 
                pending_run['session_id'],
                pending_run['pathogen_code'],
                pending_run['total_samples'],
                pending_run['completed_samples'],
                pending_run['notes'],
                pending_run['logged_at']
            ))
            
            # Update status in logs table
            cursor.execute('''
                UPDATE ml_run_logs 
                SET status = 'confirmed' 
                WHERE run_id = ?
            ''', (run_id,))
            
            conn.commit()
            
            # Now record accuracy (Step 3: Record Accuracy after every confirm)
            accuracy_result = self._record_accuracy_for_confirmed_run(run_id)
            
            return {
                'success': True, 
                'message': f'Run {run_id} confirmed and accuracy recorded',
                'accuracy': accuracy_result
            }
            
        except sqlite3.IntegrityError:
            return {'success': False, 'message': f'Run {run_id} already confirmed'}
        finally:
            conn.close()
    
    def _record_accuracy_for_confirmed_run(self, run_id):
        """Record accuracy after confirmation (Step 3: Record Accuracy)"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        # Get the confirmed run
        cursor.execute('SELECT * FROM ml_confirmed_runs WHERE run_id = ?', (run_id,))
        confirmed_run = cursor.fetchone()
        
        if not confirmed_run:
            conn.close()
            return {'success': False, 'message': f'Confirmed run {run_id} not found'}
        
        # Calculate accuracy based on completion rate and sample performance
        # This is a simplified accuracy calculation - can be enhanced with actual ML metrics
        total_samples = confirmed_run['total_samples'] or 1
        completed_samples = confirmed_run['completed_samples'] or 0
        completion_rate = completed_samples / total_samples
        
        # Base accuracy on completion rate (this can be enhanced with actual ML validation)
        accuracy_score = completion_rate * 100  # Convert to percentage
        
        # Create validation results summary
        validation_results = {
            'total_samples': total_samples,
            'completed_samples': completed_samples,
            'completion_rate': completion_rate,
            'accuracy_recorded_at': datetime.now().isoformat(),
            'pathogen_code': confirmed_run['pathogen_code'],
            'session_id': confirmed_run['session_id']
        }
        
        # Update the confirmed run with accuracy data
        cursor.execute('''
            UPDATE ml_confirmed_runs 
            SET accuracy_score = ?, validation_results = ?
            WHERE run_id = ?
        ''', (accuracy_score, json.dumps(validation_results), run_id))
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'accuracy_score': accuracy_score,
            'validation_results': validation_results
        }
    
    def get_confirmed_runs(self):
        """Get all confirmed runs with their accuracy data"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM ml_confirmed_runs 
            ORDER BY confirmed_at DESC
        ''')
        
        runs = cursor.fetchall()
        conn.close()
        
        # Parse validation_results JSON
        result_runs = []
        for run in runs:
            run_dict = dict(run)
            if run_dict.get('validation_results'):
                try:
                    run_dict['validation_results'] = json.loads(run_dict['validation_results'])
                except:
                    pass
            result_runs.append(run_dict)
        
        return result_runs
    
    def get_run_statistics(self):
        """Get statistics about runs"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        # Get pending runs count
        cursor.execute('SELECT COUNT(*) as count FROM ml_run_logs WHERE status = "pending"')
        pending_count = cursor.fetchone()['count']
        
        # Get confirmed runs count
        cursor.execute('SELECT COUNT(*) as count FROM ml_confirmed_runs')
        confirmed_count = cursor.fetchone()['count']
        
        # Get rejected runs count
        cursor.execute('SELECT COUNT(*) as count FROM ml_run_logs WHERE status = "rejected"')
        rejected_count = cursor.fetchone()['count']
        
        # Get average accuracy for confirmed runs
        cursor.execute('SELECT AVG(accuracy_score) as avg_accuracy FROM ml_confirmed_runs WHERE accuracy_score IS NOT NULL')
        avg_accuracy_result = cursor.fetchone()
        avg_accuracy = avg_accuracy_result['avg_accuracy'] if avg_accuracy_result['avg_accuracy'] else 0
        
        conn.close()
        
        return {
            'pending_runs': pending_count,
            'confirmed_runs': confirmed_count,
            'rejected_runs': rejected_count,
            'total_runs': pending_count + confirmed_count + rejected_count,
            'average_accuracy': round(avg_accuracy, 2) if avg_accuracy else 0,
            'confirmation_rate': round((confirmed_count / (confirmed_count + rejected_count)) * 100, 2) if (confirmed_count + rejected_count) > 0 else 0
        }
    
    def delete_run(self, run_id):
        """Delete a run from both tables"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM ml_run_logs WHERE run_id = ?', (run_id,))
        cursor.execute('DELETE FROM ml_confirmed_runs WHERE run_id = ?', (run_id,))
        
        conn.commit()
        conn.close()
        
        return {'success': True, 'message': f'Run {run_id} deleted'}
