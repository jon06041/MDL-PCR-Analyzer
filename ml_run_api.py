"""
ML Run Management API
Provides endpoints for the Log → Confirm → Record Accuracy workflow
"""

from flask import Blueprint, jsonify, request
from ml_run_manager import MLRunManager

ml_run_api = Blueprint('ml_run_api', __name__)
run_manager = MLRunManager()

@ml_run_api.route('/api/ml-runs/log', methods=['POST'])
def log_run():
    """Log a new ML run (Step 1)"""
    try:
        data = request.get_json()
        
        required_fields = ['run_id', 'file_name']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields: run_id, file_name'}), 400
        
        log_id = run_manager.log_run(
            run_id=data['run_id'],
            file_name=data['file_name'],
            session_id=data.get('session_id'),
            pathogen_code=data.get('pathogen_code'),
            total_samples=data.get('total_samples', 0),
            completed_samples=data.get('completed_samples', 0),
            notes=data.get('notes')
        )
        
        if log_id:
            return jsonify({
                'success': True,
                'log_id': log_id,
                'message': f'Run {data["run_id"]} logged successfully'
            })
        else:
            return jsonify({'error': 'Failed to log run - may already exist'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ml_run_api.route('/api/ml-runs/pending')
def get_pending_runs():
    """Get all runs waiting for confirmation"""
    try:
        pending_runs = run_manager.get_pending_runs()
        return jsonify({
            'success': True,
            'count': len(pending_runs),
            'pending_runs': pending_runs
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ml_run_api.route('/api/ml-runs/confirm', methods=['POST'])
def confirm_run():
    """Confirm or reject a logged run (Step 2)"""
    try:
        data = request.get_json()
        
        required_fields = ['run_log_id', 'confirmed_by', 'is_confirmed']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields: run_log_id, confirmed_by, is_confirmed'}), 400
        
        # Get the run_id from the log_id
        import sqlite3
        conn = sqlite3.connect('qpcr_analysis.db')
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('SELECT run_id FROM ml_run_logs WHERE id = ?', (data['run_log_id'],))
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            return jsonify({'error': f'Run with log ID {data["run_log_id"]} not found'}), 404
        
        run_id = result['run_id']
        
        # Use the MLRunManager's confirm_run method
        success = run_manager.confirm_run(
            run_id=run_id,
            confirmed=data['is_confirmed']
        )
        
        if success:
            action = 'confirmed' if data['is_confirmed'] else 'rejected'
            return jsonify({
                'success': True,
                'message': f'Run {run_id} {action} successfully'
            })
        else:
            return jsonify({'error': 'Failed to process run confirmation'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ml_run_api.route('/api/ml-runs/confirmed')
def get_confirmed_runs():
    """Get all confirmed runs with accuracy data"""
    try:
        limit = request.args.get('limit', 50, type=int)
        confirmed_runs = run_manager.get_confirmed_runs(limit)
        return jsonify({
            'success': True,
            'count': len(confirmed_runs),
            'confirmed_runs': confirmed_runs
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ml_run_api.route('/api/ml-runs/statistics')
def get_run_statistics():
    """Get statistics for all runs"""
    try:
        stats = run_manager.get_run_statistics()
        return jsonify({
            'success': True,
            'statistics': stats
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ml_run_api.route('/api/ml-runs/dashboard-data')
def get_dashboard_data():
    """Get comprehensive data for ML run management dashboard"""
    try:
        stats = run_manager.get_run_statistics()
        pending_runs = run_manager.get_pending_runs()
        recent_confirmed = run_manager.get_confirmed_runs(10)
        
        return jsonify({
            'success': True,
            'statistics': stats,
            'pending_runs': pending_runs,
            'recent_confirmed_runs': recent_confirmed
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
