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
        const amplificationPattern = /(.+)_(\d+)_([A-Z0-9]+)\.csv$/i;
        const summaryPattern = /(.+)_(\d+)_([A-Z0-9]+).*summary.*\.csv$/i;
        
        for (const file of files) {
            const fileName = file.name || file.webkitRelativePath?.split('/').pop() || '';
            
            // Check if it's a summary file
            const summaryMatch = fileName.match(summaryPattern);
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

class FolderQueueManager {
    constructor() {
        this.watchFolder = null;
        this.queueItems = [];
        this.processedFiles = new Set(); // Track files already processed
        this.isInitialized = false;
        this.refreshInterval = null;
        this.refreshIntervalMs = 30000; // Check folder every 30 seconds
        
        // Role-based visibility (will be used later)
        this.roleBasedVisibility = {
            canChangeFolders: true, // Will be role-based later
            canAccessQueue: true    // Will be role-based later
        };
        
        this.init();
    }
    
    async init() {
        console.log('🔍 FOLDER-QUEUE - Initializing folder queue manager');
        
        // Load saved folder path from localStorage
        this.loadSavedFolder();
        
        // Initialize UI elements
        this.createQueueUI();
        this.createNavigationButtons();
        
        // Start monitoring if folder is set
        if (this.watchFolder) {
            this.startMonitoring();
        }
        
        this.isInitialized = true;
        console.log('✅ FOLDER-QUEUE - Folder queue manager initialized');
    }
    
    loadSavedFolder() {
        try {
            const savedFolder = localStorage.getItem('qpcr_watch_folder');
            if (savedFolder) {
                this.watchFolder = savedFolder;
                console.log('📁 FOLDER-QUEUE - Loaded saved folder:', this.watchFolder);
            }
        } catch (error) {
            console.warn('⚠️ FOLDER-QUEUE - Could not load saved folder:', error);
        }
    }
    
    createNavigationButtons() {
        // Create folder browse button in upload section
        this.createFolderBrowseButton();
        
        // Create queue access button in main navigation
        this.createQueueAccessButton();
    }
    
    createFolderBrowseButton() {
        // Find the upload section
        const uploadSection = document.querySelector('.upload-section') || 
                             document.querySelector('#uploadSection') ||
                             document.querySelector('.file-upload');
        
        if (!uploadSection) {
            console.warn('⚠️ FOLDER-QUEUE - Upload section not found, creating fallback button');
            return;
        }
        
        // Create browse folder button
        const browseButton = document.createElement('button');
        browseButton.id = 'browse-folder-btn';
        browseButton.className = 'btn btn-outline-primary btn-sm folder-queue-btn';
        browseButton.innerHTML = `
            <i class="fas fa-folder-open"></i> 
            <span class="btn-text">Browse Folder</span>
        `;
        browseButton.title = 'Choose folder to monitor for qPCR files';
        browseButton.style.marginLeft = '10px';
        
        // Add click handler
        browseButton.addEventListener('click', () => this.browseForFolder());
        
        // Insert after upload controls
        const uploadControls = uploadSection.querySelector('.upload-controls') ||
                              uploadSection.querySelector('.file-inputs') ||
                              uploadSection;
        
        if (uploadControls) {
            uploadControls.appendChild(browseButton);
        }
    }
    
    createQueueAccessButton() {
        // Find navigation area (could be header, navbar, or main controls)
        const navArea = document.querySelector('.navbar') ||
                       document.querySelector('.main-nav') ||
                       document.querySelector('.header-controls') ||
                       document.querySelector('header') ||
                       document.querySelector('.top-bar');
        
        if (!navArea) {
            console.warn('⚠️ FOLDER-QUEUE - Navigation area not found, creating fallback placement');
            return;
        }
        
        // Create queue access button
        const queueButton = document.createElement('button');
        queueButton.id = 'queue-access-btn';
        queueButton.className = 'btn btn-outline-success btn-sm folder-queue-btn';
        queueButton.innerHTML = `
            <i class="fas fa-list-ul"></i> 
            <span class="btn-text">File Queue</span>
            <span class="queue-count" id="queue-count">0</span>
        `;
        queueButton.title = 'View automatic file queue';
        queueButton.style.marginLeft = '10px';
        
        // Add click handler
        queueButton.addEventListener('click', () => this.showQueueModal());
        
        // Insert in navigation
        navArea.appendChild(queueButton);
        
        // Update count display
        this.updateQueueCount();
    }
    
    createQueueUI() {
        // Create modal for queue display
        const modalHTML = `
            <div class="modal fade" id="folderQueueModal" tabindex="-1" role="dialog">
                <div class="modal-dialog modal-lg" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-folder-open"></i> Automatic File Queue
                            </h5>
                            <button type="button" class="close" data-dismiss="modal">
                                <span>&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <!-- Folder Status -->
                            <div class="folder-status mb-3">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <strong>Monitored Folder:</strong>
                                        <span id="current-folder-display" class="text-muted">None selected</span>
                                    </div>
                                    <div>
                                        <button class="btn btn-sm btn-outline-primary" id="change-folder-btn">
                                            <i class="fas fa-folder-open"></i> Change Folder
                                        </button>
                                        <button class="btn btn-sm btn-outline-secondary" id="refresh-queue-btn">
                                            <i class="fas fa-sync"></i> Refresh
                                        </button>
                                    </div>
                                </div>
                                <div class="mt-2">
                                    <small class="text-muted">
                                        Auto-refresh: <span id="auto-refresh-status">Every 30s</span>
                                    </small>
                                </div>
                            </div>
                            
                            <!-- Queue Items -->
                            <div class="queue-container">
                                <h6>Available File Sets</h6>
                                <div id="queue-items-list" class="queue-items">
                                    <!-- Queue items will be populated here -->
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event handlers
        document.getElementById('change-folder-btn').addEventListener('click', () => {
            this.browseForFolder();
        });
        
        document.getElementById('refresh-queue-btn').addEventListener('click', () => {
            this.refreshQueue();
        });
    }
    
    async browseForFolder() {
        try {
            // Use HTML5 file input with webkitdirectory to select folder
            const folderInput = document.createElement('input');
            folderInput.type = 'file';
            folderInput.webkitdirectory = true;
            folderInput.style.display = 'none';
            
            folderInput.addEventListener('change', (event) => {
                const files = event.target.files;
                if (files.length > 0) {
                    // Get the folder path from the first file
                    const firstFile = files[0];
                    const folderPath = firstFile.webkitRelativePath.split('/')[0];
                    
                    this.setWatchFolder(folderPath, files);
                }
                document.body.removeChild(folderInput);
            });
            
            document.body.appendChild(folderInput);
            folderInput.click();
            
        } catch (error) {
            console.error('❌ FOLDER-QUEUE - Error browsing for folder:', error);
            this.showNotification('Error selecting folder', 'error');
        }
    }
    
    setWatchFolder(folderPath, files) {
        console.log('📁 FOLDER-QUEUE - Setting watch folder:', folderPath);
        
        this.watchFolder = folderPath;
        
        // Save to localStorage
        try {
            localStorage.setItem('qpcr_watch_folder', folderPath);
        } catch (error) {
            console.warn('⚠️ FOLDER-QUEUE - Could not save folder to localStorage:', error);
        }
        
        // Update UI
        this.updateFolderDisplay();
        
        // Process the files we just got
        if (files) {
            this.processFileList(Array.from(files));
        }
        
        // Start monitoring
        this.startMonitoring();
        
        this.showNotification(`Folder set: ${folderPath}`, 'success');
    }
    
    updateFolderDisplay() {
        const folderDisplay = document.getElementById('current-folder-display');
        if (folderDisplay) {
            folderDisplay.textContent = this.watchFolder || 'None selected';
            folderDisplay.className = this.watchFolder ? 'text-success' : 'text-muted';
        }
    }
    
    startMonitoring() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        console.log('⏱️ FOLDER-QUEUE - Starting folder monitoring');
        
        // Initial scan
        this.refreshQueue();
        
        // Set up periodic refresh
        this.refreshInterval = setInterval(() => {
            this.refreshQueue();
        }, this.refreshIntervalMs);
    }
    
    async refreshQueue() {
        if (!this.watchFolder) {
            console.log('📁 FOLDER-QUEUE - No folder set for monitoring');
            return;
        }
        
        console.log('🔄 FOLDER-QUEUE - Refreshing queue...');
        
        try {
            // In a real implementation, this would scan the actual folder
            // For now, we'll simulate this with a file input refresh
            this.showRefreshStatus();
            
        } catch (error) {
            console.error('❌ FOLDER-QUEUE - Error refreshing queue:', error);
        }
    }
    
    processFileList(files) {
        console.log('🔍 FOLDER-QUEUE - Processing file list:', files.length, 'files');
        
        // Group files by experiment pattern
        const fileGroups = this.groupFilesByExperiment(files);
        
        // Create queue items from file groups
        this.queueItems = [];
        Object.entries(fileGroups).forEach(([pattern, group]) => {
            const queueItem = this.createQueueItem(pattern, group);
            if (queueItem) {
                this.queueItems.push(queueItem);
            }
        });
        
        // Update UI
        this.updateQueueDisplay();
        this.updateQueueCount();
        
        console.log('✅ FOLDER-QUEUE - Created', this.queueItems.length, 'queue items');
    }
    
    groupFilesByExperiment(files) {
        const groups = {};
        
        files.forEach(file => {
            if (!file.name.endsWith('.csv')) return;
            
            // Extract experiment pattern from filename
            const pattern = this.extractExperimentPattern(file.name);
            if (!pattern) return;
            
            if (!groups[pattern]) {
                groups[pattern] = {
                    amplificationFiles: [],
                    summaryFiles: [],
                    pattern: pattern
                };
            }
            
            // Determine file type
            if (this.isAmplificationFile(file.name)) {
                groups[pattern].amplificationFiles.push(file);
            } else if (this.isSummaryFile(file.name)) {
                groups[pattern].summaryFiles.push(file);
            }
        });
        
        return groups;
    }
    
    extractExperimentPattern(filename) {
        // Extract experiment pattern from filename
        // This should match your existing pattern extraction logic
        const patterns = [
            // Pattern: ExperimentName_ID_Device - Amplification Results_Channel.csv
            /^(.+_\d+_[^-]+)\s+-\s+(?:Quantification\s+)?Amplification\s+Results_([A-Z0-9]+)\.csv$/i,
            // Pattern: ExperimentName_ID_Device - Results.csv  
            /^(.+_\d+_[^-]+)\s+-\s+Results\.csv$/i,
            // Add more patterns as needed
        ];
        
        for (const pattern of patterns) {
            const match = filename.match(pattern);
            if (match) {
                return match[1]; // Return the experiment part
            }
        }
        
        return null;
    }
    
    isAmplificationFile(filename) {
        return /Amplification\s+Results_[A-Z0-9]+\.csv$/i.test(filename);
    }
    
    isSummaryFile(filename) {
        return /Results\.csv$/i.test(filename) && !/Amplification/i.test(filename);
    }
    
    createQueueItem(pattern, group) {
        // Must have at least one amplification file and one summary file
        if (group.amplificationFiles.length === 0 || group.summaryFiles.length === 0) {
            return null;
        }
        
        // Remove duplicates and sort by newest first (based on File.lastModified)
        const uniqueAmplificationFiles = this.removeDuplicatesKeepNewest(group.amplificationFiles);
        const uniqueSummaryFiles = this.removeDuplicatesKeepNewest(group.summaryFiles);
        
        // Limit to max 4 amplification files as requested
        const amplificationFiles = uniqueAmplificationFiles.slice(0, 4);
        
        // Create queue item
        const queueItem = {
            id: this.generateQueueItemId(pattern),
            pattern: pattern,
            amplificationFiles: amplificationFiles,
            summaryFiles: uniqueSummaryFiles,
            createdAt: new Date().toISOString(),
            status: 'ready'
        };
        
        return queueItem;
    }
    
    removeDuplicatesKeepNewest(files) {
        const uniqueFiles = new Map();
        
        files.forEach(file => {
            const existing = uniqueFiles.get(file.name);
            if (!existing || file.lastModified > existing.lastModified) {
                uniqueFiles.set(file.name, file);
            }
        });
        
        return Array.from(uniqueFiles.values())
                   .sort((a, b) => b.lastModified - a.lastModified);
    }
    
    generateQueueItemId(pattern) {
        return `queue_${pattern}_${Date.now()}`;
    }
    
    updateQueueDisplay() {
        const queueList = document.getElementById('queue-items-list');
        if (!queueList) return;
        
        if (this.queueItems.length === 0) {
            queueList.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-inbox fa-2x mb-2"></i>
                    <p>No file sets found</p>
                    <small>Upload files to the monitored folder or refresh to check again</small>
                </div>
            `;
            return;
        }
        
        queueList.innerHTML = this.queueItems.map(item => this.renderQueueItem(item)).join('');
    }
    
    renderQueueItem(item) {
        const amplificationCount = item.amplificationFiles.length;
        const summaryCount = item.summaryFiles.length;
        
        return `
            <div class="queue-item card mb-2" data-queue-id="${item.id}">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h6 class="card-title mb-1">${item.pattern}</h6>
                            <small class="text-muted">
                                ${amplificationCount} amplification file${amplificationCount > 1 ? 's' : ''}, 
                                ${summaryCount} summary file${summaryCount > 1 ? 's' : ''}
                            </small>
                            <div class="mt-2">
                                ${item.amplificationFiles.map(file => `
                                    <span class="badge badge-primary mr-1">${this.getChannelFromFilename(file.name)}</span>
                                `).join('')}
                            </div>
                        </div>
                        <div class="ml-3">
                            <button class="btn btn-success btn-sm analyze-btn" onclick="folderQueue.startAnalysis('${item.id}')">
                                <i class="fas fa-play"></i> Analyze
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    getChannelFromFilename(filename) {
        const match = filename.match(/Amplification\s+Results_([A-Z0-9]+)\.csv$/i);
        return match ? match[1] : 'Unknown';
    }
    
    updateQueueCount() {
        const countElement = document.getElementById('queue-count');
        if (countElement) {
            countElement.textContent = this.queueItems.length;
            countElement.style.display = this.queueItems.length > 0 ? 'inline' : 'none';
        }
    }
    
    async startAnalysis(queueItemId) {
        const item = this.queueItems.find(qi => qi.id === queueItemId);
        if (!item) {
            console.error('❌ FOLDER-QUEUE - Queue item not found:', queueItemId);
            return;
        }
        
        console.log('🚀 FOLDER-QUEUE - Starting analysis for:', item.pattern);
        
        try {
            // Close the queue modal
            $('#folderQueueModal').modal('hide');
            
            // Show loading state
            this.showNotification('Loading files for analysis...', 'info');
            
            // Simulate the normal file upload process
            await this.loadFilesForAnalysis(item);
            
        } catch (error) {
            console.error('❌ FOLDER-QUEUE - Error starting analysis:', error);
            this.showNotification('Error starting analysis', 'error');
        }
    }
    
    async loadFilesForAnalysis(item) {
        // This would integrate with your existing file loading logic
        // For now, we'll simulate the process
        
        console.log('📂 FOLDER-QUEUE - Loading files for analysis:', {
            pattern: item.pattern,
            amplificationFiles: item.amplificationFiles.length,
            summaryFiles: item.summaryFiles.length
        });
        
        // TODO: Integrate with existing file upload handlers
        // This would need to:
        // 1. Read the file contents
        // 2. Set up the analysis data structure
        // 3. Trigger the normal analysis workflow
        
        this.showNotification(`Analysis started for ${item.pattern}`, 'success');
    }
    
    showQueueModal() {
        this.updateFolderDisplay();
        this.updateQueueDisplay();
        $('#folderQueueModal').modal('show');
    }
    
    showRefreshStatus() {
        const refreshBtn = document.getElementById('refresh-queue-btn');
        if (refreshBtn) {
            const originalText = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            refreshBtn.disabled = true;
            
            setTimeout(() => {
                refreshBtn.innerHTML = originalText;
                refreshBtn.disabled = false;
            }, 1000);
        }
    }
    
    showNotification(message, type = 'info') {
        // Simple notification system
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '9999';
        notification.style.minWidth = '300px';
        
        notification.innerHTML = `
            ${message}
            <button type="button" class="close" data-dismiss="alert">
                <span>&times;</span>
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
    
    // Role-based visibility methods (for future use)
    setRoleBasedVisibility(canChangeFolders, canAccessQueue) {
        this.roleBasedVisibility.canChangeFolders = canChangeFolders;
        this.roleBasedVisibility.canAccessQueue = canAccessQueue;
        
        this.updateButtonVisibility();
    }
    
    updateButtonVisibility() {
        const browseBtn = document.getElementById('browse-folder-btn');
        const queueBtn = document.getElementById('queue-access-btn');
        const changeFolderBtn = document.getElementById('change-folder-btn');
        
        if (browseBtn) {
            browseBtn.style.display = this.roleBasedVisibility.canChangeFolders ? 'inline-block' : 'none';
        }
        
        if (queueBtn) {
            queueBtn.style.display = this.roleBasedVisibility.canAccessQueue ? 'inline-block' : 'none';
        }
        
        if (changeFolderBtn) {
            changeFolderBtn.style.display = this.roleBasedVisibility.canChangeFolders ? 'inline-block' : 'none';
        }
    }
}

// Initialize the folder queue manager when the page loads
let folderQueue;

document.addEventListener('DOMContentLoaded', () => {
    folderQueue = new FolderQueueManager();
});

// Expose globally for inline handlers
window.folderQueue = folderQueue;
