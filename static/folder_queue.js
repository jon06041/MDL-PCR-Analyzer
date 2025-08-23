// folder_queue.js
/**
 * Automatic Folder Queue System for qPCR File Management
 * 
 * Features:
 * - Monitors selected folder for new qPCR file pairs
 * - Detects matching amplification and summary files
 * - Handles up to 4 amplification files per experiment
 * - Automatic duplicate handling (newest file wins)
 * - Real-time queue updates with auto-refresh
 * - Integration with existing upload system
 */

class FolderQueueManager {
    constructor() {
        this.monitoredFolder = null;
        this.fileQueue = new Map(); // experimentId -> { amplificationFiles, summaryFile, timestamp }
        this.autoRefreshInterval = null;
        this.autoRefreshDelay = 30000; // 30 seconds
        this.isRefreshing = false;
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }
    
    initialize() {
        console.log('Initializing Folder Queue Manager...');
        
        // Set up auto-refresh
        this.startAutoRefresh();
        
        // Load saved folder from localStorage
        this.loadSavedFolder();
        
        console.log('Folder Queue Manager initialized successfully');
    }
    
    /**
     * Show the folder queue modal (instance method)
     */
    showQueueModal() {
        // Use Bootstrap modal API
        $('#folderQueueModal').modal('show');
        this.refreshQueue();
    }
    
    /**
     * Show the folder queue modal
     */
    static showQueueModal() {
        if (window.folderQueueManager) {
            // Use Bootstrap modal API
            $('#folderQueueModal').modal('show');
            window.folderQueueManager.refreshQueue();
        }
    }
    
    /**
     * Browse and select a folder to monitor
     */
    static browseFolder() {
        if (window.folderQueueManager) {
            window.folderQueueManager.browseFolder();
        }
    }
    
    /**
     * Refresh the queue manually
     */
    static refreshQueue() {
        if (window.folderQueueManager) {
            window.folderQueueManager.refreshQueue();
        }
    }
    
    /**
     * Browse and select a folder to monitor
     */
    async browseFolder() {
        try {
            // Use the File System Access API if available, otherwise fall back to input
            if ('showDirectoryPicker' in window) {
                const dirHandle = await window.showDirectoryPicker();
                this.setMonitoredFolder(dirHandle.name, dirHandle);
                this.refreshQueue();
            } else {
                // Fallback: Create a hidden input for folder selection
                this.showFolderInputFallback();
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error browsing folder:', error);
                this.showNotification('Error selecting folder. Please try again.', 'error');
            }
        }
    }
    
    /**
     * Fallback method for browsers that don't support showDirectoryPicker
     */
    showFolderInputFallback() {
        // Create a temporary input for folder selection
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.multiple = true;
        input.style.display = 'none';
        
        input.addEventListener('change', (event) => {
            const files = Array.from(event.target.files);
            if (files.length > 0) {
                // Get the common folder path
                const folderPath = files[0].webkitRelativePath.split('/')[0];
                this.setMonitoredFolder(folderPath, files);
                this.refreshQueue();
            }
            document.body.removeChild(input);
        });
        
        document.body.appendChild(input);
        input.click();
    }
    
    /**
     * Set the monitored folder
     */
    setMonitoredFolder(folderName, folderData) {
        this.monitoredFolder = {
            name: folderName,
            data: folderData,
            timestamp: Date.now()
        };
        
        // Save to localStorage
        localStorage.setItem('monitoredFolder', JSON.stringify({
            name: folderName,
            timestamp: this.monitoredFolder.timestamp
        }));
        
        // Update UI
        this.updateFolderDisplay();
        
        console.log('Monitored folder set:', folderName);
    }
    
    /**
     * Scan the monitored folder for qPCR files
     */
    async scanFolderForFiles() {
        if (!this.monitoredFolder) return;
        
        this.fileQueue.clear();
        
        try {
            let files = [];
            
            if (this.monitoredFolder.data instanceof Array) {
                // Fallback mode - we have a file list
                files = this.monitoredFolder.data;
            } else if (this.monitoredFolder.data.values) {
                // File System Access API - iterate through directory
                for await (const entry of this.monitoredFolder.data.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith('.csv')) {
                        const file = await entry.getFile();
                        file.webkitRelativePath = entry.name; // Simulate the path property
                        files.push(file);
                    }
                }
            }
            
            // Process files to find matching pairs
            await this.processFiles(files);
            
        } catch (error) {
            console.error('Error scanning folder:', error);
            throw error;
        }
    }
    
    /**
     * Process files to find matching amplification and summary pairs
     */
    async processFiles(files) {
        const amplificationFiles = new Map(); // experimentId -> [files]
        const summaryFiles = new Map(); // experimentId -> file
        
    // Pattern matching for qPCR files
    // Recognize "... - Quantification Amplification Results_<channel>.csv" (allow multi-word channels and variable spaces)
    const amplificationPattern = /^(.+?)_(\d+)_([A-Z0-9]+)\s*-\s*(?:Quantification\s+)?Amplification\s+Results_[A-Za-z0-9\s]+\.csv$/i;
    // Recognize summary strictly via explicit "Quantification Summary_0.csv" ONLY
    const summaryPattern = /^(.+?)_(\d+)_([A-Z0-9]+)\s*-\s*(?:Quantification\s+)?Summary_0\.csv$/i;
        
        for (const file of files) {
            const fileName = file.name || file.webkitRelativePath?.split('/').pop() || '';
            
            // Check if it's a summary file
            let summaryMatch = fileName.match(summaryPattern);
            if (summaryMatch) {
                const [, testName, runId, instrument] = summaryMatch;
                const experimentId = `${testName}_${runId}_${instrument}`;
                
                // Keep the newest summary file if duplicates exist
                if (!summaryFiles.has(experimentId) || file.lastModified > summaryFiles.get(experimentId).lastModified) {
                    summaryFiles.set(experimentId, file);
                }
                continue;
            }
            
            // Check if it's an amplification file
            const ampMatch = fileName.match(amplificationPattern);
            if (ampMatch && !fileName.toLowerCase().includes('summary')) {
                const [, testName, runId, instrument] = ampMatch;
                const experimentId = `${testName}_${runId}_${instrument}`;
                
                if (!amplificationFiles.has(experimentId)) {
                    amplificationFiles.set(experimentId, []);
                }
                
                const fileList = amplificationFiles.get(experimentId);
                
                // Handle duplicates - keep the newest file
                const existingIndex = fileList.findIndex(f => 
                    f.name.replace(/\d+\.csv$/, '') === fileName.replace(/\d+\.csv$/, '')
                );
                
                if (existingIndex >= 0) {
                    if (file.lastModified > fileList[existingIndex].lastModified) {
                        fileList[existingIndex] = file;
                    }
                } else {
                    fileList.push(file);
                }
                
                // Limit to 4 amplification files per experiment
                if (fileList.length > 4) {
                    fileList.sort((a, b) => b.lastModified - a.lastModified);
                    fileList.splice(4);
                }
            }
        }
        
        // Create queue entries for experiments with both amplification and summary files
        for (const [experimentId, ampFiles] of amplificationFiles) {
            const summaryFile = summaryFiles.get(experimentId);
            
            if (summaryFile && ampFiles.length > 0) {
                this.fileQueue.set(experimentId, {
                    experimentId,
                    amplificationFiles: ampFiles,
                    summaryFile: summaryFile,
                    timestamp: Math.max(
                        summaryFile.lastModified,
                        ...ampFiles.map(f => f.lastModified)
                    ),
                    fluorophores: this.detectFluorophores(ampFiles)
                });
            }
        }
    }
    
    /**
     * Detect fluorophores from amplification filenames
     */
    detectFluorophores(files) {
        const fluorophores = [];
        const patterns = {
            'Cy5': /(?:_|\b)Cy5(?:_|\b)|red/i,
            'FAM': /(?:_|\b)FAM(?:_|\b)|green/i,
            'HEX': /(?:_|\b)HEX(?:_|\b)|yellow/i,
            'Texas Red': /texas\s*red|rox/i
        };
        
        for (const file of files) {
            for (const [name, pattern] of Object.entries(patterns)) {
                if (pattern.test(file.name) && !fluorophores.includes(name)) {
                    fluorophores.push(name);
                }
            }
        }
        
        return fluorophores.length > 0 ? fluorophores : ['Unknown'];
    }
    
    /**
     * Update the queue display in the modal
     */
    updateQueueDisplay() {
        const container = document.getElementById('queue-items');
        const countBadge = document.getElementById('queueCount');
        
        if (!container) return;
        
        if (this.fileQueue.size === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-inbox fa-3x mb-3"></i>
                    <h6>No qPCR file pairs detected</h6>
                    <p class="mb-2">Looking for files that match CFX naming: "Experiment_ID_CFX123456 - Quantification Amplification Results_<channel>.csv" and "Experiment_ID_CFX123456 - Quantification Summary_0.csv"</p>
                    <small>
                        Only valid CFX files are queued. Invalid or mismatched filenames are ignored.
                    </small>
                </div>
            `;
            countBadge.style.display = 'none';
        } else {
            // Sort by timestamp (newest first)
            const sortedEntries = Array.from(this.fileQueue.values())
                .sort((a, b) => b.timestamp - a.timestamp);
            
            container.innerHTML = sortedEntries.map(entry => this.createQueueItemHTML(entry)).join('');
            
            // Update count badge
            countBadge.textContent = this.fileQueue.size;
            countBadge.style.display = 'inline-flex';
        }
    }
    
    /**
     * Create HTML for a queue item
     */
    createQueueItemHTML(entry) {
        const timeStr = new Date(entry.timestamp).toLocaleString();
        const fluorophoresBadges = entry.fluorophores.map(f => 
            `<span class="badge badge-primary mr-1">${f}</span>`
        ).join('');
        
        return `
            <div class="card queue-item mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h6 class="card-title mb-2">${entry.experimentId}</h6>
                            <div class="mb-2">
                                <small class="text-muted">
                                    <i class="fas fa-clock mr-1"></i> ${timeStr}
                                </small>
                            </div>
                            <div class="mb-2">
                                <small class="text-muted">
                                    <i class="fas fa-file-csv mr-1"></i> 
                                    ${entry.amplificationFiles.length} amplification file${entry.amplificationFiles.length > 1 ? 's' : ''} + 1 summary file
                                </small>
                            </div>
                            <div class="fluorophore-tags">
                                ${fluorophoresBadges}
                            </div>
                        </div>
                        <div class="ml-3">
                            <button class="btn btn-success analyze-btn" 
                                    onclick="window.folderQueueManager.analyzeQueuedItem('${entry.experimentId}')">
                                <i class="fas fa-chart-line mr-1"></i> Analyze
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Analyze a specific queued item
     */
    async analyzeQueuedItem(experimentId) {
        const entry = this.fileQueue.get(experimentId);
        if (!entry) {
            this.showNotification('Queue item not found', 'error');
            return;
        }
        
        try {
            // Close the modal first
            $('#folderQueueModal').modal('hide');
            
            // Load files into the existing upload system
            await this.loadFilesIntoUploadSystem(entry);
            
            // Trigger analysis
            this.triggerAnalysis();
            
            this.showNotification(`Analysis started for ${experimentId}`, 'success');
            
        } catch (error) {
            console.error('Error analyzing queued item:', error);
            this.showNotification('Error starting analysis', 'error');
        }
    }
    
    /**
     * Load files into the existing upload system
     */
    async loadFilesIntoUploadSystem(entry) {
        // Clear existing files
        if (typeof clearAmplificationFiles === 'function') {
            clearAmplificationFiles();
        }
        if (typeof clearSummaryFile === 'function') {
            clearSummaryFile();
        }
        
        // Create a FileList-like object for amplification files
        const amplificationInput = document.getElementById('fileInput');
        if (amplificationInput) {
            // Create a new FileList
            const dataTransfer = new DataTransfer();
            entry.amplificationFiles.forEach(file => dataTransfer.items.add(file));
            amplificationInput.files = dataTransfer.files;
            
            // Trigger the change event
            const event = new Event('change', { bubbles: true });
            amplificationInput.dispatchEvent(event);
        }
        
        // Load summary file
        const summaryInput = document.getElementById('samplesInput');
        if (summaryInput) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(entry.summaryFile);
            summaryInput.files = dataTransfer.files;
            
            // Trigger the change event
            const event = new Event('change', { bubbles: true });
            summaryInput.dispatchEvent(event);
        }
        
        // Small delay to ensure file processing
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    /**
     * Trigger the analysis process
     */
    triggerAnalysis() {
        // Try to click the analyze button if it's visible
        const analyzeBtn = document.getElementById('analyzeBtn');
        if (analyzeBtn && analyzeBtn.style.display !== 'none') {
            analyzeBtn.click();
        } else {
            // If analyze button is not ready, trigger file processing
            this.showNotification('Files loaded. Check upload section to start analysis.', 'info');
        }
    }
    
    /**
     * Start auto-refresh timer
     */
    startAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        this.autoRefreshInterval = setInterval(() => {
            // Only auto-refresh if modal is visible and we have a monitored folder
            if (this.monitoredFolder && $('#folderQueueModal').hasClass('show')) {
                console.log('Auto-refreshing folder queue...');
                this.refreshQueue();
            }
        }, this.autoRefreshDelay);
    }
    
    /**
     * Stop auto-refresh timer
     */
    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }
    
    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        // Create a notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show fixed-notification`;
        notification.innerHTML = `
            ${message}
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
}

// Initialize the global instance
window.folderQueueManager = new FolderQueueManager();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.folderQueueManager) {
        window.folderQueueManager.stopAutoRefresh();
    }
});

console.log('Folder Queue Manager loaded successfully');

