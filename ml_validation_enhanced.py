"""
Enhanced ML Validation Dashboard with Run Confirmation System
Tracks analysis runs, allows expert confirmation, and calculates accuracy based on confirmed runs only.
"""

import sqlite3
import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import hashlib

class MLValidationManager:
    def __init__(self, db_path='qpcr_analysis.db'):
        self.db_path = db_path
        self.init_validation_tables()
    
    def init_validation_tables(self):
        """Initialize database tables for ML validation tracking"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Analysis runs table - tracks each uploaded file/analysis session
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS ml_analysis_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT UNIQUE NOT NULL,
            filename TEXT,
            upload_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            file_hash TEXT,
            total_samples INTEGER DEFAULT 0,
            pathogen_summary TEXT, -- JSON of pathogens and counts
            session_data TEXT, -- Full session data for reference
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # Run confirmations table - tracks expert confirmations per run/pathogen
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS ml_run_confirmations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            pathogen TEXT NOT NULL,
            channel TEXT NOT NULL,
            expert_name TEXT,
            confirmation_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            samples_assessed INTEGER DEFAULT 0,
            samples_changed INTEGER DEFAULT 0,
            samples_unchanged INTEGER DEFAULT 0,
            expert_accuracy REAL, -- calculated accuracy for this expert/run
            notes TEXT,
            UNIQUE(run_id, pathogen, channel)
        )
        ''')
        
        # Sample predictions table - detailed tracking of each sample's ML vs expert decisions
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS ml_sample_predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            well_key TEXT NOT NULL,
            sample_name TEXT,
            pathogen TEXT NOT NULL,
            channel TEXT NOT NULL,
            ml_prediction TEXT, -- original ML prediction
            ml_confidence REAL,
            expert_decision TEXT, -- final expert decision (if changed)
            was_changed BOOLEAN DEFAULT FALSE,
            prediction_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            decision_timestamp DATETIME,
            ml_features TEXT -- JSON of ML features used
        )
        ''')
        
        # Validation reports table - summary reports for confirmed runs
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS ml_validation_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id TEXT UNIQUE NOT NULL,
            pathogen TEXT NOT NULL,
            channel TEXT NOT NULL,
            confirmed_runs_count INTEGER DEFAULT 0,
            total_samples INTEGER DEFAULT 0,
            correct_predictions INTEGER DEFAULT 0,
            incorrect_predictions INTEGER DEFAULT 0,
            overall_accuracy REAL,
            report_data TEXT, -- JSON of detailed report
            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        conn.commit()
        conn.close()
    
    def log_analysis_run(self, session_data: dict, filename: str = None) -> str:
        """Log a new analysis run and return run_id"""
        run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hashlib.md5(str(session_data).encode()).hexdigest()[:8]}"
        
        # Calculate file hash if filename provided
        file_hash = None
        if filename and os.path.exists(filename):
            with open(filename, 'rb') as f:
                file_hash = hashlib.md5(f.read()).hexdigest()
        
        # Extract pathogen summary
        pathogen_summary = self._extract_pathogen_summary(session_data)
        total_samples = len(session_data.get('individual_results', {}))
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
        INSERT OR REPLACE INTO ml_analysis_runs 
        (run_id, filename, file_hash, total_samples, pathogen_summary, session_data)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (run_id, filename, file_hash, total_samples, json.dumps(pathogen_summary), json.dumps(session_data)))
        
        # Log individual sample predictions
        if 'individual_results' in session_data:
            for well_key, result in session_data['individual_results'].items():
                if result.get('ml_classification'):
                    ml_class = result['ml_classification']
                    cursor.execute('''
                    INSERT OR REPLACE INTO ml_sample_predictions
                    (run_id, well_key, sample_name, pathogen, channel, ml_prediction, ml_confidence, ml_features)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        run_id,
                        well_key,
                        result.get('sample_name', ''),
                        result.get('specific_pathogen', 'Unknown'),
                        result.get('fluorophore', 'Unknown'),
                        ml_class.get('classification', 'Unknown'),
                        ml_class.get('confidence', 0.0),
                        json.dumps(ml_class.get('features_used', {}))
                    ))
        
        conn.commit()
        conn.close()
        return run_id
    
    def get_pending_runs(self) -> List[Dict]:
        """Get all analysis runs that haven't been confirmed yet"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
        SELECT 
            r.run_id,
            r.filename,
            r.upload_timestamp,
            r.total_samples,
            r.pathogen_summary,
            GROUP_CONCAT(c.pathogen || '/' || c.channel) as confirmed_pathogens
        FROM ml_analysis_runs r
        LEFT JOIN ml_run_confirmations c ON r.run_id = c.run_id
        GROUP BY r.run_id, r.filename, r.upload_timestamp, r.total_samples, r.pathogen_summary
        ORDER BY r.upload_timestamp DESC
        ''')
        
        runs = []
        for row in cursor.fetchall():
            run_id, filename, timestamp, total_samples, pathogen_summary, confirmed = row
            pathogen_data = json.loads(pathogen_summary) if pathogen_summary else {}
            confirmed_list = confirmed.split(',') if confirmed else []
            
            runs.append({
                'run_id': run_id,
                'filename': filename or 'Unknown File',
                'timestamp': timestamp,
                'total_samples': total_samples,
                'pathogens': pathogen_data,
                'confirmed_pathogens': confirmed_list,
                'needs_confirmation': len(confirmed_list) < len(pathogen_data)
            })
        
        conn.close()
        return runs
    
    def confirm_run_pathogen(self, run_id: str, pathogen: str, channel: str, expert_name: str, notes: str = None) -> Dict:
        """Confirm expert assessment for a specific run/pathogen combination"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get all samples for this run/pathogen that have ML predictions
        cursor.execute('''
        SELECT well_key, ml_prediction, expert_decision, was_changed
        FROM ml_sample_predictions
        WHERE run_id = ? AND pathogen = ? AND channel = ?
        ''', (run_id, pathogen, channel))
        
        samples = cursor.fetchall()
        if not samples:
            conn.close()
            return {'success': False, 'error': 'No ML predictions found for this run/pathogen'}
        
        # Calculate accuracy based on changed vs unchanged
        total_samples = len(samples)
        changed_samples = sum(1 for s in samples if s[3])  # was_changed column
        unchanged_samples = total_samples - changed_samples
        
        # Accuracy = unchanged samples / total samples (ML was correct when not changed)
        accuracy = unchanged_samples / total_samples if total_samples > 0 else 0.0
        
        # Record the confirmation
        cursor.execute('''
        INSERT OR REPLACE INTO ml_run_confirmations
        (run_id, pathogen, channel, expert_name, samples_assessed, samples_changed, samples_unchanged, expert_accuracy, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (run_id, pathogen, channel, expert_name, total_samples, changed_samples, unchanged_samples, accuracy, notes))
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'run_id': run_id,
            'pathogen': pathogen,
            'channel': channel,
            'total_samples': total_samples,
            'changed_samples': changed_samples,
            'unchanged_samples': unchanged_samples,
            'accuracy': accuracy
        }
    
    def get_run_details(self, run_id: str) -> Dict:
        """Get detailed information about a specific run"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get run basic info
        cursor.execute('SELECT * FROM ml_analysis_runs WHERE run_id = ?', (run_id,))
        run_data = cursor.fetchone()
        
        if not run_data:
            conn.close()
            return {'error': 'Run not found'}
        
        # Get sample predictions
        cursor.execute('''
        SELECT well_key, sample_name, pathogen, channel, ml_prediction, ml_confidence, expert_decision, was_changed
        FROM ml_sample_predictions
        WHERE run_id = ?
        ORDER BY pathogen, channel, well_key
        ''', (run_id,))
        
        samples = cursor.fetchall()
        
        # Get confirmations
        cursor.execute('''
        SELECT pathogen, channel, expert_name, confirmation_timestamp, expert_accuracy, notes
        FROM ml_run_confirmations
        WHERE run_id = ?
        ''', (run_id,))
        
        confirmations = cursor.fetchall()
        
        conn.close()
        
        return {
            'run_info': {
                'run_id': run_data[1],
                'filename': run_data[2],
                'timestamp': run_data[3],
                'total_samples': run_data[5]
            },
            'samples': samples,
            'confirmations': confirmations
        }
    
    def generate_validation_report(self, pathogen: str, channel: str) -> Dict:
        """Generate validation report for confirmed runs only"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get all confirmed runs for this pathogen/channel
        cursor.execute('''
        SELECT c.run_id, c.samples_assessed, c.samples_unchanged, c.samples_changed, c.expert_accuracy, c.confirmation_timestamp
        FROM ml_run_confirmations c
        WHERE c.pathogen = ? AND c.channel = ?
        ORDER BY c.confirmation_timestamp DESC
        ''', (pathogen, channel))
        
        confirmed_runs = cursor.fetchall()
        
        if not confirmed_runs:
            conn.close()
            return {'error': 'No confirmed runs found for this pathogen/channel'}
        
        # Calculate overall statistics
        total_confirmed_runs = len(confirmed_runs)
        total_samples = sum(run[1] for run in confirmed_runs)  # samples_assessed
        total_correct = sum(run[2] for run in confirmed_runs)   # samples_unchanged
        total_incorrect = sum(run[3] for run in confirmed_runs) # samples_changed
        
        overall_accuracy = total_correct / total_samples if total_samples > 0 else 0.0
        
        # Generate report data
        report_data = {
            'pathogen': pathogen,
            'channel': channel,
            'summary': {
                'confirmed_runs': total_confirmed_runs,
                'total_samples': total_samples,
                'correct_predictions': total_correct,
                'incorrect_predictions': total_incorrect,
                'overall_accuracy': overall_accuracy
            },
            'run_details': []
        }
        
        for run in confirmed_runs:
            report_data['run_details'].append({
                'run_id': run[0],
                'samples_assessed': run[1],
                'samples_correct': run[2],
                'samples_incorrect': run[3],
                'run_accuracy': run[4],
                'confirmed_date': run[5]
            })
        
        # Save report to database
        report_id = f"report_{pathogen}_{channel}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        cursor.execute('''
        INSERT OR REPLACE INTO ml_validation_reports
        (report_id, pathogen, channel, confirmed_runs_count, total_samples, correct_predictions, incorrect_predictions, overall_accuracy, report_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (report_id, pathogen, channel, total_confirmed_runs, total_samples, total_correct, total_incorrect, overall_accuracy, json.dumps(report_data)))
        
        conn.commit()
        conn.close()
        
        return report_data
    
    def _extract_pathogen_summary(self, session_data: dict) -> Dict:
        """Extract pathogen/channel combinations from session data"""
        pathogen_counts = {}
        
        if 'individual_results' in session_data:
            for result in session_data['individual_results'].values():
                pathogen = result.get('specific_pathogen', 'Unknown')
                channel = result.get('fluorophore', 'Unknown')
                key = f"{pathogen}/{channel}"
                pathogen_counts[key] = pathogen_counts.get(key, 0) + 1
        
        return pathogen_counts

# Test the system
if __name__ == "__main__":
    manager = MLValidationManager()
    print("ML Validation Manager initialized successfully!")
