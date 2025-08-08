"""
Database Management API endpoints for Flask app
Provides web interface for backup management and ML validation tracking
CRITICAL: Uses MySQL exclusively - SQLite deprecated
"""

from flask import Blueprint, request, jsonify, render_template_string
# Import MySQL-based validation tracker (SQLite backup manager deprecated)
from ml_validation_tracker import MLValidationTracker
import json
import logging
import os

logger = logging.getLogger(__name__)

# Create blueprint for database management routes
db_mgmt_bp = Blueprint('db_management', __name__)

@db_mgmt_bp.route('/api/db-backup/create', methods=['POST'])
def create_backup():
    """Create a database backup"""
    try:
        data = request.get_json() or {}
        description = data.get('description', '')
        backup_type = data.get('type', 'manual')
        
        backup_manager = DatabaseBackupManager()
        backup_path, metadata = backup_manager.create_backup(backup_type, description)
        
        if backup_path:
            return jsonify({
                'success': True,
                'backup_path': str(backup_path),
                'metadata': metadata,
                'message': 'Backup created successfully'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Backup creation failed'
            }), 500
            
    except Exception as e:
        logger.error(f"Backup creation error: {e}")
        return jsonify({
            'success': False,
            'message': f'Backup creation failed: {str(e)}'
        }), 500

@db_mgmt_bp.route('/api/db-backup/list', methods=['GET'])
def list_backups():
    """List all available backups"""
    try:
        backup_manager = DatabaseBackupManager()
        backups = backup_manager.list_backups()
        
        return jsonify({
            'success': True,
            'backups': backups,
            'count': len(backups)
        })
        
    except Exception as e:
        logger.error(f"Backup listing error: {e}")
        return jsonify({
            'success': False,
            'message': f'Failed to list backups: {str(e)}'
        }), 500

@db_mgmt_bp.route('/api/db-backup/restore', methods=['POST'])
def restore_backup():
    """Restore database from backup"""
    try:
        data = request.get_json()
        backup_path = data.get('backup_path')
        
        if not backup_path:
            return jsonify({
                'success': False,
                'message': 'backup_path is required'
            }), 400
            
        backup_manager = DatabaseBackupManager()
        success = backup_manager.restore_backup(backup_path)
        
        return jsonify({
            'success': success,
            'message': 'Database restored successfully' if success else 'Restore failed'
        })
        
    except Exception as e:
        logger.error(f"Backup restore error: {e}")
        return jsonify({
            'success': False,
            'message': f'Restore failed: {str(e)}'
        }), 500

@db_mgmt_bp.route('/api/db-backup/reset-dev-data', methods=['POST'])
def reset_development_data():
    """Reset development data while preserving schema"""
    try:
        data = request.get_json() or {}
        preserve_structure = data.get('preserve_structure', True)
        
        backup_manager = DatabaseBackupManager()
        success = backup_manager.reset_development_data(preserve_structure)
        
        return jsonify({
            'success': success,
            'message': 'Development data reset successfully' if success else 'Reset failed'
        })
        
    except Exception as e:
        logger.error(f"Development reset error: {e}")
        return jsonify({
            'success': False,
            'message': f'Reset failed: {str(e)}'
        }), 500

@db_mgmt_bp.route('/api/ml-validation/track-change', methods=['POST'])
def track_model_change():
    """Track model changes and flag affected models for validation"""
    try:
        data = request.get_json()
        model_type = data.get('model_type')
        pathogen_code = data.get('pathogen_code') 
        change_description = data.get('change_description')
        
        if not all([model_type, pathogen_code, change_description]):
            return jsonify({
                'success': False,
                'message': 'model_type, pathogen_code, and change_description are required'
            }), 400
            
        backup_manager = DatabaseBackupManager()
        affected_models = backup_manager.track_model_change_impact(
            model_type, pathogen_code, change_description
        )
        
        return jsonify({
            'success': True,
            'affected_models': len(affected_models),
            'models': affected_models,
            'message': f'{len(affected_models)} models flagged for validation'
        })
        
    except Exception as e:
        logger.error(f"Model change tracking error: {e}")
        return jsonify({
            'success': False,
            'message': f'Failed to track model change: {str(e)}'
        }), 500

@db_mgmt_bp.route('/api/ml-validation/validation-required', methods=['GET'])
def get_validation_required():
    """Get models that require validation due to changes"""
    try:
        backup_manager = DatabaseBackupManager()
        validation_required = backup_manager.get_validation_required_models()
        
        return jsonify({
            'success': True,
            'validation_required': validation_required,
            'count': len(validation_required)
        })
        
    except Exception as e:
        logger.error(f"Validation required error: {e}")
        return jsonify({
            'success': False,
            'message': f'Failed to get validation required: {str(e)}'
        }), 500

@db_mgmt_bp.route('/api/ml-validation/qc-session', methods=['POST'])
def create_qc_validation_session():
    """Create QC validation session"""
    try:
        data = request.get_json()
        qc_technician = data.get('qc_technician')
        pathogen_codes = data.get('pathogen_codes', [])
        run_file_name = data.get('run_file_name', '')
        
        if not qc_technician:
            return jsonify({
                'success': False,
                'message': 'qc_technician is required'
            }), 400
            
        tracker = MLValidationTracker()
        session_id = tracker.create_qc_validation_run(run_file_name, qc_technician, pathogen_codes)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'message': 'QC validation session created'
        })
        
    except Exception as e:
        logger.error(f"QC session creation error: {e}")
        return jsonify({
            'success': False,
            'message': f'Failed to create QC session: {str(e)}'
        }), 500

@db_mgmt_bp.route('/api/ml-validation/qc-confirm', methods=['POST'])
def record_qc_confirmation():
    """Record QC technician confirmation"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        well_id = data.get('well_id')
        ml_prediction = data.get('ml_prediction')
        expert_decision = data.get('expert_decision')
        confidence_level = data.get('confidence_level', 'medium')
        
        required_fields = [session_id, well_id, ml_prediction, expert_decision]
        if not all(required_fields):
            return jsonify({
                'success': False,
                'message': 'session_id, well_id, ml_prediction, and expert_decision are required'
            }), 400
            
        tracker = MLValidationTracker()
        success = tracker.record_qc_confirmation(
            session_id, well_id, ml_prediction, expert_decision, confidence_level
        )
        
        return jsonify({
            'success': success,
            'message': 'QC confirmation recorded' if success else 'Failed to record confirmation'
        })
        
    except Exception as e:
        logger.error(f"QC confirmation error: {e}")
        return jsonify({
            'success': False,
            'message': f'Failed to record QC confirmation: {str(e)}'
        }), 500

@db_mgmt_bp.route('/api/ml-validation/pathogen-stats', methods=['GET'])
def get_pathogen_stats():
    """Get pathogen accuracy statistics"""
    try:
        pathogen_code = request.args.get('pathogen_code')
        days_back = int(request.args.get('days_back', 30))
        
        tracker = MLValidationTracker()
        stats = tracker.get_pathogen_accuracy_stats(pathogen_code, days_back)
        
        return jsonify({
            'success': True,
            'stats': stats,
            'pathogen_code': pathogen_code,
            'days_back': days_back
        })
        
    except Exception as e:
        logger.error(f"Pathogen stats error: {e}")
        return jsonify({
            'success': False,
            'message': f'Failed to get pathogen stats: {str(e)}'
        }), 500

@db_mgmt_bp.route('/db-management')
def db_management_dashboard():
    """Database management dashboard"""
    return render_template_string(DB_MANAGEMENT_TEMPLATE)


# HTML Template for Database Management Dashboard
DB_MANAGEMENT_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Management - MDL PCR Analyzer</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }
        .content {
            padding: 20px;
        }
        .section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
        }
        .section h3 {
            margin-top: 0;
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        .btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin-right: 10px;
            margin-bottom: 10px;
        }
        .btn:hover {
            background: #5a6fd8;
        }
        .btn-danger {
            background: #e74c3c;
        }
        .btn-danger:hover {
            background: #c0392b;
        }
        .btn-success {
            background: #27ae60;
        }
        .btn-success:hover {
            background: #229954;
        }
        .input-group {
            margin-bottom: 15px;
        }
        .input-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        .input-group input, .input-group textarea, .input-group select {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        .backup-list {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 10px;
        }
        .backup-item {
            padding: 10px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .backup-item:last-child {
            border-bottom: none;
        }
        .status-message {
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            display: none;
        }
        .status-success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status-error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .stat-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
        }
        .validation-required {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 10px;
        }
        .two-column {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        @media (max-width: 768px) {
            .two-column {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Database Management Dashboard</h1>
            <p>Backup, restore, and track ML model validation</p>
        </div>
        
        <div class="content">
            <!-- Status Messages -->
            <div id="statusMessage" class="status-message"></div>
            
            <div class="two-column">
                <!-- Backup Management Section -->
                <div class="section">
                    <h3>🗄️ Backup Management</h3>
                    
                    <div class="input-group">
                        <label for="backupDescription">Backup Description:</label>
                        <input type="text" id="backupDescription" placeholder="Enter backup description...">
                    </div>
                    
                    <button class="btn" onclick="createBackup()">Create Backup</button>
                    <button class="btn btn-success" onclick="loadBackupList()">Refresh List</button>
                    
                    <h4>Available Backups:</h4>
                    <div id="backupList" class="backup-list">
                        <p>Loading backups...</p>
                    </div>
                </div>
                
                <!-- Development Tools Section -->
                <div class="section">
                    <h3>🔧 Development Tools</h3>
                    
                    <div class="input-group">
                        <label>
                            <input type="checkbox" id="preserveStructure" checked>
                            Preserve database structure (recommended)
                        </label>
                    </div>
                    
                    <button class="btn btn-danger" onclick="resetDevelopmentData()">Reset Development Data</button>
                    
                    <hr style="margin: 20px 0;">
                    
                    <h4>Track Model Changes:</h4>
                    <div class="input-group">
                        <label for="modelType">Model Type:</label>
                        <select id="modelType">
                            <option value="general_pcr">General PCR</option>
                            <option value="pathogen_specific">Pathogen Specific</option>
                        </select>
                    </div>
                    
                    <div class="input-group">
                        <label for="pathogenCode">Pathogen Code:</label>
                        <input type="text" id="pathogenCode" placeholder="e.g., FLUA, NGON, etc.">
                    </div>
                    
                    <div class="input-group">
                        <label for="changeDescription">Change Description:</label>
                        <textarea id="changeDescription" rows="3" placeholder="Describe the model changes..."></textarea>
                    </div>
                    
                    <button class="btn" onclick="trackModelChange()">Track Model Change</button>
                </div>
            </div>
            
            <!-- ML Validation Section -->
            <div class="section">
                <h3>🧪 ML Validation Tracking</h3>
                
                <div class="two-column">
                    <div>
                        <h4>QC Validation Session:</h4>
                        
                        <div class="input-group">
                            <label for="qcTechnician">QC Technician:</label>
                            <input type="text" id="qcTechnician" placeholder="Technician name">
                        </div>
                        
                        <div class="input-group">
                            <label for="runFileName">Run File Name:</label>
                            <input type="text" id="runFileName" placeholder="qPCR run filename">
                        </div>
                        
                        <button class="btn btn-success" onclick="createQCSession()">Start QC Session</button>
                        
                        <div id="currentQCSession" style="margin-top: 15px; display: none;">
                            <p><strong>Active Session:</strong> <span id="sessionId"></span></p>
                        </div>
                    </div>
                    
                    <div>
                        <h4>Validation Required:</h4>
                        <div id="validationRequired">
                            <p>Loading validation requirements...</p>
                        </div>
                        <button class="btn" onclick="loadValidationRequired()">Refresh</button>
                    </div>
                </div>
            </div>
            
            <!-- Statistics Section -->
            <div class="section">
                <h3>📊 ML Performance Statistics</h3>
                
                <div class="input-group">
                    <label for="statsPathogen">Pathogen (leave empty for all):</label>
                    <input type="text" id="statsPathogen" placeholder="e.g., FLUA">
                </div>
                
                <div class="input-group">
                    <label for="daysPeriod">Days Period:</label>
                    <select id="daysPeriod">
                        <option value="7">Last 7 days</option>
                        <option value="30" selected>Last 30 days</option>
                        <option value="90">Last 90 days</option>
                    </select>
                </div>
                
                <button class="btn" onclick="loadPathogenStats()">Load Statistics</button>
                
                <div id="pathogenStats" class="stats-grid" style="margin-top: 20px;">
                    <!-- Stats will be loaded here -->
                </div>
            </div>
        </div>
    </div>

    <script>
        // Global variables
        let currentSessionId = null;
        
        // Utility functions
        function showStatus(message, isError = false) {
            const statusEl = document.getElementById('statusMessage');
            statusEl.textContent = message;
            statusEl.className = `status-message ${isError ? 'status-error' : 'status-success'}`;
            statusEl.style.display = 'block';
            
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }
        
        async function apiCall(url, options = {}) {
            try {
                const response = await fetch(url, {
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    },
                    ...options
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'API call failed');
                }
                
                return data;
            } catch (error) {
                console.error('API call error:', error);
                throw error;
            }
        }
        
        // Backup Management Functions
        async function createBackup() {
            try {
                const description = document.getElementById('backupDescription').value;
                
                const result = await apiCall('/api/db-backup/create', {
                    method: 'POST',
                    body: JSON.stringify({
                        description: description,
                        type: 'manual'
                    })
                });
                
                showStatus(result.message);
                document.getElementById('backupDescription').value = '';
                loadBackupList();
                
            } catch (error) {
                showStatus(`Backup failed: ${error.message}`, true);
            }
        }
        
        async function loadBackupList() {
            try {
                const result = await apiCall('/api/db-backup/list');
                
                const listEl = document.getElementById('backupList');
                
                if (result.backups.length === 0) {
                    listEl.innerHTML = '<p>No backups found</p>';
                    return;
                }
                
                listEl.innerHTML = result.backups.map(backup => `
                    <div class="backup-item">
                        <div>
                            <strong>${backup.timestamp}</strong><br>
                            <small>${backup.backup_type} - ${backup.description || 'No description'}</small>
                        </div>
                        <button class="btn" onclick="restoreBackup('${backup.file_path}')">Restore</button>
                    </div>
                `).join('');
                
            } catch (error) {
                document.getElementById('backupList').innerHTML = `<p>Error loading backups: ${error.message}</p>`;
            }
        }
        
        async function restoreBackup(backupPath) {
            if (!confirm('Are you sure you want to restore this backup? This will replace the current database.')) {
                return;
            }
            
            try {
                const result = await apiCall('/api/db-backup/restore', {
                    method: 'POST',
                    body: JSON.stringify({
                        backup_path: backupPath
                    })
                });
                
                showStatus(result.message);
                
            } catch (error) {
                showStatus(`Restore failed: ${error.message}`, true);
            }
        }
        
        // Development Tools Functions
        async function resetDevelopmentData() {
            if (!confirm('Are you sure you want to reset development data? This action cannot be undone without a backup.')) {
                return;
            }
            
            try {
                const preserveStructure = document.getElementById('preserveStructure').checked;
                
                const result = await apiCall('/api/db-backup/reset-dev-data', {
                    method: 'POST',
                    body: JSON.stringify({
                        preserve_structure: preserveStructure
                    })
                });
                
                showStatus(result.message);
                
            } catch (error) {
                showStatus(`Reset failed: ${error.message}`, true);
            }
        }
        
        async function trackModelChange() {
            try {
                const modelType = document.getElementById('modelType').value;
                const pathogenCode = document.getElementById('pathogenCode').value;
                const changeDescription = document.getElementById('changeDescription').value;
                
                if (!pathogenCode || !changeDescription) {
                    showStatus('Pathogen code and change description are required', true);
                    return;
                }
                
                const result = await apiCall('/api/ml-validation/track-change', {
                    method: 'POST',
                    body: JSON.stringify({
                        model_type: modelType,
                        pathogen_code: pathogenCode,
                        change_description: changeDescription
                    })
                });
                
                showStatus(result.message);
                
                // Clear form
                document.getElementById('pathogenCode').value = '';
                document.getElementById('changeDescription').value = '';
                
                // Refresh validation required
                loadValidationRequired();
                
            } catch (error) {
                showStatus(`Model change tracking failed: ${error.message}`, true);
            }
        }
        
        // ML Validation Functions
        async function createQCSession() {
            try {
                const qcTechnician = document.getElementById('qcTechnician').value;
                const runFileName = document.getElementById('runFileName').value;
                
                if (!qcTechnician) {
                    showStatus('QC Technician name is required', true);
                    return;
                }
                
                const result = await apiCall('/api/ml-validation/qc-session', {
                    method: 'POST',
                    body: JSON.stringify({
                        qc_technician: qcTechnician,
                        run_file_name: runFileName,
                        pathogen_codes: [] // Will be populated during validation
                    })
                });
                
                currentSessionId = result.session_id;
                document.getElementById('sessionId').textContent = currentSessionId;
                document.getElementById('currentQCSession').style.display = 'block';
                
                showStatus(result.message);
                
            } catch (error) {
                showStatus(`QC session creation failed: ${error.message}`, true);
            }
        }
        
        async function loadValidationRequired() {
            try {
                const result = await apiCall('/api/ml-validation/validation-required');
                
                const container = document.getElementById('validationRequired');
                
                if (result.validation_required.length === 0) {
                    container.innerHTML = '<p>No models require validation</p>';
                    return;
                }
                
                container.innerHTML = result.validation_required.map(item => `
                    <div class="validation-required">
                        <strong>${item.model_type}</strong> - ${item.pathogen_code}<br>
                        <small>${item.reason}</small><br>
                        <small>Flagged: ${item.date_flagged}</small>
                    </div>
                `).join('');
                
            } catch (error) {
                document.getElementById('validationRequired').innerHTML = `<p>Error loading validation requirements: ${error.message}</p>`;
            }
        }
        
        async function loadPathogenStats() {
            try {
                const pathogen = document.getElementById('statsPathogen').value;
                const days = document.getElementById('daysPeriod').value;
                
                const params = new URLSearchParams();
                if (pathogen) params.append('pathogen_code', pathogen);
                params.append('days_back', days);
                
                const result = await apiCall(`/api/ml-validation/pathogen-stats?${params}`);
                
                const container = document.getElementById('pathogenStats');
                
                if (result.stats.length === 0) {
                    container.innerHTML = '<p>No statistics available for the selected period</p>';
                    return;
                }
                
                container.innerHTML = result.stats.map(stat => `
                    <div class="stat-card">
                        <div class="stat-value">${stat.accuracy_percentage || 0}%</div>
                        <div><strong>${stat.pathogen_code}</strong></div>
                        <div><small>${stat.correct_predictions}/${stat.total_predictions} predictions</small></div>
                        <div><small>${stat.expert_overrides} overrides</small></div>
                    </div>
                `).join('');
                
            } catch (error) {
                document.getElementById('pathogenStats').innerHTML = `<p>Error loading statistics: ${error.message}</p>`;
            }
        }
        
        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            loadBackupList();
            loadValidationRequired();
            loadPathogenStats();
        });
    </script>
</body>
</html>
"""
