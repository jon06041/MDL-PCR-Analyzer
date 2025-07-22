/**
 * ML Configuration Management Interface
 * Provides controls for pathogen-specific ML settings and data management
 */

class MLConfigManager {
    constructor() {
        this.configs = new Map();
        this.systemConfig = {};
        this.pathogenLibrary = {};
        this.init();
    }

    async init() {
        await this.loadPathogenLibrary();
        await this.loadConfigurations();
        this.setupEventListeners();
    }

    async loadPathogenLibrary() {
        // Load the pathogen library if available
        if (typeof PATHOGEN_LIBRARY !== 'undefined') {
            this.pathogenLibrary = PATHOGEN_LIBRARY;
            console.log('✅ PATHOGEN_LIBRARY loaded successfully:', Object.keys(this.pathogenLibrary).length, 'entries');
            console.log('Sample entries:', Object.keys(this.pathogenLibrary).slice(0, 5));
        } else {
            console.warn('❌ PATHOGEN_LIBRARY not found, using fallback names');
            this.pathogenLibrary = {};
        }
    }

    getPathogenDisplayName(pathogenCode) {
        // Use the global getPathogenName function if available
        if (typeof getPathogenName === 'function') {
            const name = getPathogenName(pathogenCode);
            console.log(`🏷️ getPathogenDisplayName(${pathogenCode}) -> ${name}`);
            return name;
        }
        
        // Fallback to pathogen code if function not available
        console.log(`⚠️ getPathogenName function not available, using fallback: ${pathogenCode}`);
        return pathogenCode;
    }

    getTargetName(pathogenCode, fluorophore) {
        // Get the specific target name for this pathogen/fluorophore combination
        if (this.pathogenLibrary[pathogenCode] && this.pathogenLibrary[pathogenCode][fluorophore]) {
            const target = this.pathogenLibrary[pathogenCode][fluorophore];
            console.log(`🎯 getTargetName(${pathogenCode}, ${fluorophore}) -> ${target}`);
            return target;
        }
        
        // Debug what's available
        console.log(`❌ getTargetName(${pathogenCode}, ${fluorophore}) -> fallback to ${fluorophore}`);
        console.log(`   Available in library: ${pathogenCode} exists: ${!!this.pathogenLibrary[pathogenCode]}`);
        if (this.pathogenLibrary[pathogenCode]) {
            console.log(`   Available fluorophores for ${pathogenCode}:`, Object.keys(this.pathogenLibrary[pathogenCode]));
        }
        
        // Fallback to fluorophore name
        return fluorophore;
    }

    async loadConfigurations() {
        try {
            // Load pathogen configurations
            const pathogenResponse = await fetch('/api/ml-config/pathogen');
            const pathogenData = await pathogenResponse.json();
            
            if (pathogenData.success) {
                pathogenData.configs.forEach(config => {
                    const key = `${config.pathogen_code}_${config.fluorophore}`;
                    this.configs.set(key, config);
                });
            }

            // Load system configuration
            const systemResponse = await fetch('/api/ml-config/system');
            const systemData = await systemResponse.json();
            
            if (systemData.success) {
                this.systemConfig = systemData.config;
            }

            this.renderConfigInterface();
            
        } catch (error) {
            console.error('Failed to load ML configurations:', error);
        }
    }

    async togglePathogenML(pathogenCode, fluorophore, enabled, notes = '') {
        try {
            const response = await fetch(`/api/ml-config/pathogen/${pathogenCode}/${fluorophore}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': 'current_user' // TODO: Replace with actual user ID
                },
                body: JSON.stringify({
                    enabled: enabled,
                    notes: notes
                })
            });

            const data = await response.json();
            
            if (data.success) {
                // Update local cache
                const key = `${pathogenCode}_${fluorophore}`;
                if (this.configs.has(key)) {
                    this.configs.get(key).ml_enabled = enabled;
                }
                
                this.showNotification(`ML ${enabled ? 'enabled' : 'disabled'} for ${pathogenCode}/${fluorophore}`, 'success');
                this.renderConfigInterface();
            } else {
                this.showNotification(`Failed to update ML configuration: ${data.error}`, 'error');
            }
            
        } catch (error) {
            console.error('Failed to toggle pathogen ML:', error);
            this.showNotification('Network error occurred', 'error');
        }
    }

    async resetTrainingData(pathogenCode = null, fluorophore = null, notes = '') {
        const target = pathogenCode && fluorophore ? `${pathogenCode}/${fluorophore}` :
                      pathogenCode ? pathogenCode : 'ALL training data';

        // Show confirmation dialog
        const confirmed = confirm(`⚠️ DANGEROUS OPERATION ⚠️\n\nThis will permanently delete ${target}.\n\nA backup will be created, but this action cannot be undone.\n\nType "RESET" to confirm:`);
        
        if (!confirmed) return;

        const userConfirmation = prompt('Type "RESET_TRAINING_DATA" to confirm this dangerous operation:');
        
        if (userConfirmation !== 'RESET_TRAINING_DATA') {
            this.showNotification('Reset cancelled - incorrect confirmation', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/ml-config/reset-training-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': 'current_user' // TODO: Replace with actual user ID
                },
                body: JSON.stringify({
                    pathogen_code: pathogenCode,
                    fluorophore: fluorophore,
                    confirmation: 'RESET_TRAINING_DATA',
                    notes: notes || `Manual reset of ${target}`
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showNotification(`Training data reset for ${target}. Backup: ${data.backup_path}`, 'success');
                
                // Reload ML statistics
                if (window.mlFeedbackInterface) {
                    window.mlFeedbackInterface.updateMLStats();
                }
            } else {
                this.showNotification(`Failed to reset training data: ${data.error}`, 'error');
            }
            
        } catch (error) {
            console.error('Failed to reset training data:', error);
            this.showNotification('Network error occurred', 'error');
        }
    }

    async checkMLEnabled(pathogenCode, fluorophore) {
        try {
            const response = await fetch(`/api/ml-config/check-enabled/${pathogenCode}/${fluorophore}`);
            const data = await response.json();
            
            return data.success ? data.enabled : true; // Default to enabled
            
        } catch (error) {
            console.error('Failed to check ML enabled status:', error);
            return true; // Default to enabled on error
        }
    }

    renderConfigInterface() {
        // This method creates the UI for ML configuration
        // Can be called from an admin panel or settings page
        
        const container = document.getElementById('mlConfigContainer');
        if (!container) return;

        // Group configs by pathogen
        const pathogenGroups = new Map();
        
        this.configs.forEach(config => {
            if (!pathogenGroups.has(config.pathogen_code)) {
                pathogenGroups.set(config.pathogen_code, []);
            }
            pathogenGroups.get(config.pathogen_code).push(config);
        });

        let html = `
            <div class="ml-config-panel">
                <h3>🤖 ML Configuration Management</h3>
                
                <div class="system-config-section">
                    <h4>System Settings</h4>
                    <div class="config-item">
                        <label>
                            <input type="checkbox" 
                                   ${this.systemConfig.ml_global_enabled ? 'checked' : ''}
                                   onchange="window.mlConfigManager.toggleGlobalML(this.checked)">
                            Global ML Enabled
                        </label>
                    </div>
                    <div class="config-item">
                        <label>
                            Minimum Training Examples: 
                            <input type="number" 
                                   value="${this.systemConfig.min_training_examples || 10}"
                                   min="5" max="100"
                                   onchange="window.mlConfigManager.updateMinTrainingExamples(this.value)">
                        </label>
                    </div>
                </div>

                <div class="pathogen-config-section">
                    <h4>Pathogen-Specific Settings</h4>
        `;

        pathogenGroups.forEach((configs, pathogenCode) => {
            const pathogenDisplayName = this.getPathogenDisplayName(pathogenCode);
            
            html += `
                <div class="pathogen-group">
                    <h5 class="pathogen-title" title="${pathogenCode}">
                        ${pathogenDisplayName}
                        <span class="pathogen-code">(${pathogenCode})</span>
                    </h5>
                    <div class="fluorophore-grid">
            `;

            configs.forEach(config => {
                const isEnabled = config.ml_enabled;
                const statusClass = isEnabled ? 'enabled' : 'disabled';
                const targetName = this.getTargetName(config.pathogen_code, config.fluorophore);
                
                html += `
                    <div class="fluorophore-config ${statusClass}">
                        <div class="fluorophore-info">
                            <div class="fluorophore-header">
                                <span class="fluorophore-name">${config.fluorophore}</span>
                                <span class="ml-status ${statusClass}">${isEnabled ? 'ON' : 'OFF'}</span>
                            </div>
                            <div class="target-name" title="${targetName}">
                                ${targetName}
                            </div>
                        </div>
                        <div class="fluorophore-controls">
                            <button class="toggle-btn ${statusClass}" 
                                    onclick="window.mlConfigManager.togglePathogenML('${pathogenCode}', '${config.fluorophore}', ${!isEnabled})"
                                    title="${isEnabled ? 'Disable' : 'Enable'} ML for ${targetName}">
                                ${isEnabled ? 'Disable' : 'Enable'}
                            </button>
                            <button class="reset-btn danger" 
                                    onclick="window.mlConfigManager.resetTrainingData('${pathogenCode}', '${config.fluorophore}')"
                                    title="Reset training data for ${targetName}">
                                Reset
                            </button>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                    <div class="pathogen-actions">
                        <button class="reset-pathogen-btn danger" 
                                onclick="window.mlConfigManager.resetTrainingData('${pathogenCode}')"
                                title="Reset all ${pathogenDisplayName} training data">
                            Reset All ${pathogenCode} Data
                        </button>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
                
                <div class="danger-zone">
                    <h4>⚠️ Danger Zone</h4>
                    <button class="reset-all-btn danger" 
                            onclick="window.mlConfigManager.resetTrainingData()">
                        Reset ALL Training Data
                    </button>
                    <p class="warning-text">
                        This will delete all ML training data across all pathogens. 
                        A backup will be created.
                    </p>
                </div>
                
                <div class="audit-log-section">
                    <h4>Recent Changes</h4>
                    <button onclick="window.mlConfigManager.showAuditLog()">
                        View Audit Log
                    </button>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    async toggleGlobalML(enabled) {
        try {
            const response = await fetch('/api/ml-config/system/ml_global_enabled', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': 'current_user'
                },
                body: JSON.stringify({
                    value: enabled.toString(),
                    notes: `Global ML ${enabled ? 'enabled' : 'disabled'}`
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.systemConfig.ml_global_enabled = enabled;
                this.showNotification(`Global ML ${enabled ? 'enabled' : 'disabled'}`, 'success');
            } else {
                this.showNotification(`Failed to update global ML setting: ${data.error}`, 'error');
            }
            
        } catch (error) {
            console.error('Failed to toggle global ML:', error);
            this.showNotification('Network error occurred', 'error');
        }
    }

    async updateMinTrainingExamples(value) {
        try {
            const response = await fetch('/api/ml-config/system/min_training_examples', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': 'current_user'
                },
                body: JSON.stringify({
                    value: value,
                    notes: `Updated minimum training examples to ${value}`
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.systemConfig.min_training_examples = parseInt(value);
                this.showNotification(`Minimum training examples updated to ${value}`, 'success');
            } else {
                this.showNotification(`Failed to update minimum training examples: ${data.error}`, 'error');
            }
            
        } catch (error) {
            console.error('Failed to update min training examples:', error);
            this.showNotification('Network error occurred', 'error');
        }
    }

    async showAuditLog() {
        try {
            const response = await fetch('/api/ml-config/audit-log?limit=20');
            const data = await response.json();
            
            if (data.success) {
                this.displayAuditLog(data.log_entries);
            } else {
                this.showNotification(`Failed to load audit log: ${data.error}`, 'error');
            }
            
        } catch (error) {
            console.error('Failed to load audit log:', error);
            this.showNotification('Network error occurred', 'error');
        }
    }

    displayAuditLog(logEntries) {
        const modal = document.createElement('div');
        modal.className = 'audit-log-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>ML Configuration Audit Log</h3>
                    <button class="close-btn" onclick="this.closest('.audit-log-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="audit-log-entries">
                        ${logEntries.map(entry => `
                            <div class="audit-entry">
                                <div class="audit-header">
                                    <span class="action">${entry.action}</span>
                                    <span class="timestamp">${new Date(entry.timestamp).toLocaleString()}</span>
                                </div>
                                <div class="audit-details">
                                    ${entry.pathogen_code ? `<span class="pathogen">Pathogen: ${entry.pathogen_code}</span>` : ''}
                                    ${entry.fluorophore ? `<span class="fluorophore">Fluorophore: ${entry.fluorophore}</span>` : ''}
                                    <span class="user">User: ${entry.user_id}</span>
                                    ${entry.notes ? `<span class="notes">Notes: ${entry.notes}</span>` : ''}
                                </div>
                                <div class="audit-change">
                                    <span class="old-value">From: ${entry.old_value || 'N/A'}</span>
                                    <span class="new-value">To: ${entry.new_value || 'N/A'}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    showNotification(message, type = 'info') {
        // Simple notification system
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            max-width: 400px;
            word-wrap: break-word;
        `;
        
        // Set color based on type
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    setupEventListeners() {
        // Add keyboard shortcuts or other global event listeners if needed
        document.addEventListener('keydown', (event) => {
            // Future: Add keyboard shortcuts for admin functions
        });
    }
}

// Global instance
window.mlConfigManager = new MLConfigManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MLConfigManager;
}
