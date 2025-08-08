// ML Feedback Interface for qPCR Curve Classification
// Provides ML-based curve analysis and expert feedback collection

class MLFeedbackInterface {
    constructor() {
        this.currentWellData = null;
        this.currentWellKey = null;
        this.isInitialized = false;
        this.mlStats = null;
        this.submissionInProgress = false; // Flag to prevent duplicate submissions
        this.trainedSamples = new Set(); // Track samples that have already been trained
        
        // CRITICAL MULTICHANNEL FIX: Preserve original results
        this.originalResultsBackup = null;
        this.originalResultsCount = 0;
        
        // Progress tracking for batch ML analysis
        this.batchProgress = {
            totalWells: 0,
            processedWells: 0,
            currentChannel: null,
            channelWells: {},
            startTime: null
        };
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeInterface());
        } else {
            this.initializeInterface();
        }
    }
    
    /**
     * CRITICAL MULTICHANNEL FIX: Create backup of original results
     */
    preserveOriginalResults() {
        if (window.currentAnalysisResults?.individual_results) {
            const results = window.currentAnalysisResults.individual_results;
            this.originalResultsBackup = JSON.parse(JSON.stringify(results));
            this.originalResultsCount = Object.keys(results).length;
            console.log(`💾 MULTICHANNEL-FIX: Preserved backup with ${this.originalResultsCount} wells`);
        }
    }
    
    /**
     * CRITICAL MULTICHANNEL FIX: Restore results if they've been corrupted
     */
    checkAndRestoreResults() {
        const currentResults = window.currentAnalysisResults?.individual_results;
        const currentCount = currentResults ? Object.keys(currentResults).length : 0;
        
        if (this.originalResultsBackup && currentCount < this.originalResultsCount) {
            console.warn(`⚠️ MULTICHANNEL-FIX: Results corrupted! Was ${this.originalResultsCount}, now ${currentCount}. Restoring...`);
            window.currentAnalysisResults.individual_results = JSON.parse(JSON.stringify(this.originalResultsBackup));
            console.log(`✅ MULTICHANNEL-FIX: Restored ${this.originalResultsCount} wells from backup`);
            return true;
        }
        return false;
    }

    async initializeInterface() {
        // Wait for modal body to be available (retry up to 10 times)
        let attempts = 0;
        while (attempts < 10) {
            const modalBody = document.querySelector('.modal-body');
            if (modalBody) {
                this.addMLSectionToModal();
                this.isInitialized = true;
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }
        
        // Get initial ML statistics (with error handling)
        try {
            await this.updateMLStats();
            // Load existing trained samples to prevent duplicates
            await this.loadTrainedSamplesCache();
        } catch (error) {
            // Set default stats display if loading fails
            this.displayMLStats({
                training_samples: 0,
                model_trained: false,
                pathogen_models: []
            });
        }
    }

    async addMLSectionToModal() {
        //console.log('ML Feedback Interface: Checking for existing ML section...');
        
        // Check if ML feedback should be hidden based on configuration
        const shouldHideMLFeedback = await this.shouldHideMLFeedback();
        if (shouldHideMLFeedback) {
            //console.log('ML Feedback Interface: ML feedback disabled - hiding section');
            this.hideMLSection();
            return;
        }
        
        // Check if ML section already exists in HTML
        const existingSection = document.getElementById('ml-feedback-section');
        if (existingSection) {
            //console.log('ML Feedback Interface: ML section already exists in HTML');
            this.showMLSection();
            this.attachEventListeners();
            return;
        }

        //console.log('ML Feedback Interface: ML section not found in HTML, creating dynamically...');
        
        // Look for the modal body to insert ML section between chart and details
        const modalBody = document.querySelector('.modal-body');
        const chartContainer = document.querySelector('.modal-chart-container');
        const modalDetails = document.getElementById('modalDetails');
        
        if (!modalBody) {
            //console.log('ML Feedback Interface: Modal body not found');
            return;
        }

        //console.log('ML Feedback Interface: Modal body found, creating ML section');
        //console.log('ML Feedback Interface: Chart container found:', !!chartContainer);
        //console.log('ML Feedback Interface: Modal details found:', !!modalDetails);
        
        // Create ML feedback section HTML
        const mlSection = document.createElement('div');
        mlSection.id = 'ml-feedback-section';
        mlSection.className = 'ml-feedback-container';
        mlSection.innerHTML = `
            <div class="ml-section">
                <h4>🤖 ML Curve Classification</h4>
                
                <!-- ML Prediction Display -->
                <div class="ml-prediction" id="ml-prediction-display" style="display: none;">
                    <div class="prediction-info">
                        <div class="prediction-result">
                            <strong>ML Prediction:</strong> 
                            <span id="ml-prediction-class" class="classification-badge">-</span>
                            <span id="ml-prediction-confidence" class="confidence-score">-</span>
                        </div>
                        <div class="prediction-method">
                            <small>Method: <span id="ml-prediction-method">-</span></small>
                        </div>
                        <div class="pathogen-context" id="pathogen-context" style="display: none;">
                            <small>🧬 Pathogen: <span id="detected-pathogen">-</span></small>
                        </div>
                    </div>
                    
                    <!-- Classification Conflict Alert -->
                    <div class="classification-conflict" id="classification-conflict" style="display: none;">
                        <div class="conflict-header">
                            <span class="conflict-icon">⚠️</span>
                            <strong>Classification Conflict Detected</strong>
                        </div>
                        <div class="conflict-details">
                            <div class="conflict-comparison">
                                <div class="conflict-item">
                                    <span class="conflict-label">Rule-Based:</span>
                                    <span id="rule-based-class" class="classification-badge">-</span>
                                </div>
                                <div class="conflict-vs">vs</div>
                                <div class="conflict-item">
                                    <span class="conflict-label">ML Prediction:</span>
                                    <span id="ml-conflict-class" class="classification-badge">-</span>
                                </div>
                            </div>
                            <div class="conflict-confidence">
                                <small>ML Confidence: <span id="conflict-confidence">-</span></small>
                            </div>
                        </div>
                        <div class="conflict-actions">
                            <button id="approve-ml-btn" class="ml-btn primary small">
                                ✅ Approve ML
                            </button>
                            <button id="keep-rule-btn" class="ml-btn secondary small">
                                📋 Keep Rule-Based
                            </button>
                            <button id="expert-review-btn" class="ml-btn warning small">
                                👨‍⚕️ Need Expert Review
                            </button>
                        </div>
                    </div>
                    
                    <!-- Visual Curve Analysis Display -->
                    <div class="visual-curve-analysis" id="visual-curve-display" style="display: none;">
                        <h6>�️ Visual Curve Analysis</h6>
                        <div class="visual-metrics-grid">
                            <div class="visual-metric-item">
                                <span class="metric-label">Curve Shape:</span>
                                <span id="curve-shape-assessment">-</span>
                            </div>
                            <div class="visual-metric-item">
                                <span class="metric-label">Pattern Type:</span>
                                <span id="curve-pattern-type">-</span>
                            </div>
                            <div class="visual-metric-item">
                                <span class="metric-label">Visual Quality:</span>
                                <span id="visual-quality-score">-</span>
                            </div>
                            <div class="visual-metric-item">
                                <span class="metric-label">Similar Patterns:</span>
                                <span id="similar-patterns-count">-</span>
                            </div>
                        </div>
                        <div class="curve-characteristics">
                            <div class="characteristic-tags" id="curve-characteristics">
                                <!-- Dynamic tags for curve characteristics -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Analysis Buttons -->
                <div class="ml-actions">
                    <button id="ml-analyze-btn" class="ml-btn primary">
                        🔍 Analyze with ML
                    </button>
                    <button id="ml-feedback-btn" class="ml-btn secondary" style="display: none;">
                        📝 Provide Feedback
                    </button>
                </div>

                <!-- Feedback Form -->
                <div class="ml-feedback-form" id="ml-feedback-form" style="display: none;">
                    <h5>Expert Classification Feedback</h5>
                    <p>Current classification: <span id="current-classification">-</span></p>
                    <p>Help improve the ML model by providing the correct classification:</p>
                    
                    <div class="classification-options">
                        <label class="classification-option">
                            <input type="radio" name="expert-classification" value="STRONG_POSITIVE">
                            <span class="classification-label strong-positive">Strong Positive</span>
                        </label>
                        <label class="classification-option">
                            <input type="radio" name="expert-classification" value="POSITIVE">
                            <span class="classification-label positive">Positive</span>
                        </label>
                        <label class="classification-option">
                            <input type="radio" name="expert-classification" value="WEAK_POSITIVE">
                            <span class="classification-label weak-positive">Weak Positive</span>
                        </label>
                        <label class="classification-option">
                            <input type="radio" name="expert-classification" value="INDETERMINATE">
                            <span class="classification-label indeterminate">Indeterminate</span>
                            <small style="display: block; color: #666; margin-top: 2px;">Unclear biological result, ambiguous signal that cannot be confidently classified</small>
                        </label>
                        <label class="classification-option">
                            <input type="radio" name="expert-classification" value="REDO">
                            <span class="classification-label redo">Redo</span>
                            <small style="display: block; color: #666; margin-top: 2px;">Technical issues or borderline amplitude (400-500 RFU), repeat test recommended</small>
                        </label>
                        <label class="classification-option">
                            <input type="radio" name="expert-classification" value="SUSPICIOUS">
                            <span class="classification-label suspicious">Suspicious</span>
                            <small style="display: block; color: #666; margin-top: 2px;">Questionable result that may need further investigation or expert review</small>
                        </label>
                        <label class="classification-option">
                            <input type="radio" name="expert-classification" value="NEGATIVE">
                            <span class="classification-label negative">Negative</span>
                        </label>
                    </div>

                    <div class="feedback-actions">
                        <button id="submit-feedback-btn" class="ml-btn primary">
                            ✅ Submit Feedback
                        </button>
                        <button id="cancel-feedback-btn" class="ml-btn secondary">
                            ❌ Cancel
                        </button>
                    </div>
                </div>

                <!-- ML Statistics -->
                <div class="ml-stats" id="ml-stats-display">
                    <h5>ML Model Status</h5>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Training Samples:</span>
                            <span id="stat-training-samples">-</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Model Trained:</span>
                            <span id="stat-model-trained">-</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Pathogen Models:</span>
                            <span id="stat-pathogen-models">-</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Expert Review:</span>
                            <span id="stat-expert-review-status">-</span>
                        </div>
                    </div>
                    
                    <!-- Manual Retrain Button -->
                    <div class="ml-actions" style="margin-top: 15px;">
                        <button id="manual-retrain-btn" class="ml-btn secondary small" style="font-size: 0.9em;">
                            🔄 Manual Retrain
                        </button>
                    </div>
                    
                    <div class="training-progress" id="training-progress" style="display: none;">
                        <div class="progress-info">
                            <small>Expert review available after 50+ training samples</small>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" id="training-progress-fill"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Try multiple insertion strategies to ensure ML section appears AFTER sample details
        let insertionSuccess = false;
        
        // Strategy 1: Insert after modal details (sample details)
        if (modalDetails) {
            modalDetails.parentNode.insertBefore(mlSection, modalDetails.nextSibling);
            //console.log('ML Feedback Interface: ML section added after sample details');
            insertionSuccess = true;
        }
        // Strategy 2: Insert after chart container if no modal details
        else if (chartContainer) {
            chartContainer.parentNode.insertBefore(mlSection, chartContainer.nextSibling);
            //console.log('ML Feedback Interface: ML section added after chart container');
            insertionSuccess = true;
        }
        // Strategy 3: Fallback - append to modal body
        else {
            modalBody.appendChild(mlSection);
            //console.log('ML Feedback Interface: ML section appended to modal body (fallback)');
            insertionSuccess = true;
        }
        
        if (!insertionSuccess) {
            //console.error('ML Feedback Interface: Failed to insert ML section');
            return;
        }

        // Attach event listeners
        this.attachEventListeners();
    }

    showMLSection() {
        console.log('ML Feedback Interface: Ensuring ML section is visible');
        const mlSection = document.getElementById('ml-feedback-section');
        if (mlSection) {
            mlSection.style.display = 'block';
            //console.log('ML Feedback Interface: ML section made visible');
        } else {
            //console.log('ML Feedback Interface: ML section not found');
        }
        
        // Also show individual ML components when section becomes visible
        const mlStatsDisplay = document.getElementById('ml-stats-display');
        const mlAnalyzeBtn = document.getElementById('ml-analyze-btn');
        
        if (mlStatsDisplay) {
            mlStatsDisplay.style.display = 'block';
            //console.log('ML Feedback Interface: ML stats display made visible');
        }
        if (mlAnalyzeBtn) {
            mlAnalyzeBtn.style.display = 'inline-block';
            mlAnalyzeBtn.disabled = false; // Ensure button is enabled
            mlAnalyzeBtn.textContent = '🔍 Analyze with ML';
            //console.log('ML Feedback Interface: ML analyze button made visible and enabled');
        }
    }

    hideMLSection() {
        //console.log('ML Feedback Interface: Hiding ML section due to configuration');
        const mlSection = document.getElementById('ml-feedback-section');
        if (mlSection) {
            mlSection.style.display = 'none';
            //console.log('ML Feedback Interface: ML section hidden');
        } else {
            //console.log('ML Feedback Interface: ML section not found to hide');
        }
        
        // Also hide individual ML components if they exist separately
        const mlStatsDisplay = document.getElementById('ml-stats-display');
        const mlAnalyzeBtn = document.getElementById('ml-analyze-btn');
        const mlFeedbackBtn = document.getElementById('ml-feedback-btn');
        const mlFeedbackForm = document.getElementById('ml-feedback-form');
        const mlPredictionDisplay = document.getElementById('ml-prediction-display');
        
        if (mlStatsDisplay) mlStatsDisplay.style.display = 'none';
        if (mlAnalyzeBtn) mlAnalyzeBtn.style.display = 'none';
        if (mlFeedbackBtn) mlFeedbackBtn.style.display = 'none';
        if (mlFeedbackForm) mlFeedbackForm.style.display = 'none';
        if (mlPredictionDisplay) mlPredictionDisplay.style.display = 'none';
    }

    async refreshMLSectionConfiguration() {
        /**
         * Refresh the ML section visibility based on current configuration
         * Useful when configuration changes while a modal is open
         */
        //console.log('ML Feedback Interface: Refreshing ML section configuration');
        
        // Check if we should hide ML feedback
        const shouldHide = await this.shouldHideMLFeedback();
        
        if (shouldHide) {
            this.hideMLSection();
        } else {
            // Ensure ML section is shown and properly initialized
            const existingSection = document.getElementById('ml-feedback-section');
            if (existingSection) {
                this.showMLSection();
            } else {
                this.addMLSectionToModal();
            }
        }
    }

    attachEventListeners() {
        // Analyze button
        const analyzeBtn = document.getElementById('ml-analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.analyzeCurveWithML());
        }

        // Feedback button
        const feedbackBtn = document.getElementById('ml-feedback-btn');
        if (feedbackBtn) {
            feedbackBtn.addEventListener('click', () => this.showFeedbackForm());
        }

        // Submit feedback button - CRITICAL FIX for duplicate submissions
        const submitBtn = document.getElementById('submit-feedback-btn');
        if (submitBtn) {
            // Clone and replace the button to remove ALL event listeners
            const newSubmitBtn = submitBtn.cloneNode(true);
            submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
            
            // Add single event listener to the new button with duplicate prevention
            let isSubmitting = false;
            newSubmitBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                // Check for duplicates without disabling button
                if (isSubmitting || this.submissionInProgress) {
                    //console.warn('ML Feedback: Blocking duplicate submission attempt');
                    return false;
                }
                
                isSubmitting = true;
                
                try {
                    await this.submitFeedback();
                } finally {
                    isSubmitting = false;
                }
                
                return false;
            }, { once: false, passive: false });
            
            //console.log('Submit button event listener attached (duplicate prevention without button disabling)');
        }

        // Cancel feedback button
        const cancelBtn = document.getElementById('cancel-feedback-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideFeedbackForm());
        }

        // Classification conflict action buttons
        const approveMlBtn = document.getElementById('approve-ml-btn');
        if (approveMlBtn) {
            approveMlBtn.addEventListener('click', () => this.approveMLClassification());
        }

        const keepRuleBtn = document.getElementById('keep-rule-btn');
        if (keepRuleBtn) {
            keepRuleBtn.addEventListener('click', () => this.keepRuleBasedClassification());
        }

        const expertReviewBtn = document.getElementById('expert-review-btn');
        if (expertReviewBtn) {
            expertReviewBtn.addEventListener('click', () => this.flagForExpertReview());
        }
        
        // Manual retrain button
        const manualRetrainBtn = document.getElementById('manual-retrain-btn');
        if (manualRetrainBtn) {
            manualRetrainBtn.addEventListener('click', () => this.manualRetrain());
        }
    }

    setCurrentWell(wellKey, wellData) {
        // Enhanced validation to ensure we have valid data before setting
        if (!wellKey || !wellData) {
            console.warn('ML Feedback: Invalid well data provided - wellKey:', wellKey, 'wellData:', wellData);
            return;
        }
        
        // Deep clone wellData to avoid reference issues
        this.currentWellKey = wellKey;
        this.currentWellData = JSON.parse(JSON.stringify(wellData));
        
        //console.log('ML Feedback: Set current well:', wellKey, 'with data keys:', Object.keys(this.currentWellData));
        
        // Check ML configuration for current well before showing section
        this.refreshMLSectionConfiguration();
        
        // Reset prediction display when switching wells
        const predictionDisplay = document.getElementById('ml-prediction-display');
        const feedbackBtn = document.getElementById('ml-feedback-btn');
        const feedbackForm = document.getElementById('ml-feedback-form');
        
        if (predictionDisplay) predictionDisplay.style.display = 'none';
        if (feedbackBtn) feedbackBtn.style.display = 'none';
        if (feedbackForm) feedbackForm.style.display = 'none';
        
        // CRITICAL FIX: Reset all button states when switching wells
        this.resetButtonStates();
        
        // Reset any ongoing submission state
        this.submissionInProgress = false;
        // Auto-analyze the curve if ML classification doesn't exist (only if ML is enabled)
        if (!wellData.ml_classification) {
            setTimeout(async () => {
                // Check if ML feedback should be hidden before auto-analysis
                const shouldHide = await this.shouldHideMLFeedback();
                if (shouldHide) {
                    console.log('ML Analysis: Skipping auto-analysis - ML feedback disabled');
                    return;
                }
                
                if (this.currentWellData && this.currentWellKey) {
                    this.analyzeCurveWithML();
                } else {
                    console.warn('ML Analysis: Well data not ready for auto-analysis, skipping');
                }
            }, 300);
        } else {
            // Only display existing classification if ML section is visible
            setTimeout(async () => {
                const shouldHide = await this.shouldHideMLFeedback();
                if (!shouldHide) {
                    this.displayExistingMLClassification(wellData.ml_classification);
                }
            }, 100);
        }
        
        // Update visual curve analysis
        this.updateVisualCurveDisplay(wellData);
    }

    async shouldHideMLFeedback() {
        /**
         * Determine if ML feedback should be hidden based on:
         * Pathogen-specific ML enabled setting for current test
         * Hide when ML is disabled for this specific pathogen/test
         */
        try {
            // Get current pathogen information
            const pathogenInfo = this.extractChannelSpecificPathogen();
            if (!pathogenInfo.pathogen || pathogenInfo.pathogen === 'Unknown') {
                console.log('ML Config Check: No pathogen detected, showing ML feedback');
                return false; // Show ML feedback if we can't determine pathogen
            }

            // Get pathogen-specific ML configuration
            const pathogenResponse = await fetch(`/api/ml-config/pathogen/${encodeURIComponent(pathogenInfo.pathogen)}`);
            if (!pathogenResponse.ok) {
                console.log('ML Config Check: Failed to get pathogen config, showing ML feedback');
                return false; // Show ML feedback if we can't get pathogen config
            }
            const pathogenConfigResponse = await pathogenResponse.json();
            
            // Find config for current fluorophore or general config
            let pathogenMLEnabled = true; // Default to enabled
            if (pathogenConfigResponse.success && pathogenConfigResponse.configs?.length > 0) {
                const configs = pathogenConfigResponse.configs;
                
                // Look for specific fluorophore config first
                let config = configs.find(c => c.fluorophore === pathogenInfo.fluorophore);
                // Fall back to general config (null fluorophore)
                if (!config) {
                    config = configs.find(c => !c.fluorophore);
                }
                
                if (config) {
                    pathogenMLEnabled = config.ml_enabled;
                }
            }

            // Hide ML feedback when ML is disabled for this pathogen
            const shouldHide = !pathogenMLEnabled;

            /*
            console.log('ML Config Check:', {
                pathogen: pathogenInfo.pathogen,
                fluorophore: pathogenInfo.fluorophore,
                pathogenMLEnabled,
                shouldHide
            });
            */
            
            return shouldHide;
            
        } catch (error) {
            console.error('ML Config Check: Error checking ML feedback visibility:', error);
            return false; // Show ML feedback on error to be safe
        }
    }

    // Visual curve analysis functions
    analyzeVisualCurvePattern(wellData) {
        console.log('🔍 Visual Analysis Debug: Analyzing well data:', Object.keys(wellData || {}));
        
        if (!wellData) {
            console.warn('🔍 Visual Analysis Debug: No well data provided');
            return {
                shape: 'Unknown',
                pattern: 'No Data',
                quality: 'N/A',
                characteristics: []
            };
        }
        
        // Try multiple field names for RFU data and cycles
        const rfuData = wellData.rfu_data || 
                       wellData.raw_rfu || 
                       wellData.rfu || 
                       wellData.fluorescence_data ||
                       [];
        
        const cycles = wellData.cycles || 
                      wellData.raw_cycles || 
                      wellData.cycle_data ||
                      wellData.cycle ||
                      [];
        
       // console.log('🔍 Visual Analysis Debug: RFU data length:', rfuData.length, 'Cycles length:', cycles.length);
        // console.log('🔍 Visual Analysis Debug: Available metrics - amplitude:', wellData.amplitude, 'r2:', wellData.r2_score, 'snr:', wellData.snr);
        
        if (!rfuData || !cycles || rfuData.length === 0 || cycles.length === 0) {
            //console.warn('🔍 Visual Analysis Debug: Missing or empty curve data');
            //console.warn('🔍 Visual Analysis Debug: RFU fields tried:', ['rfu_data', 'raw_rfu', 'rfu', 'fluorescence_data']);
            //console.warn('🔍 Visual Analysis Debug: Cycle fields tried:', ['cycles', 'raw_cycles', 'cycle_data', 'cycle']);
            return {
                shape: 'Missing Curve Data',
                pattern: 'No Curve Data Available',
                quality: 'Cannot Analyze',
                characteristics: ['Missing Data']
            };
        }

        const analysis = {
            shape: this.assessCurveShape(rfuData, wellData),
            pattern: this.identifyPatternType(rfuData, wellData),
            quality: this.calculateVisualQuality(rfuData, wellData),
            characteristics: this.extractCurveCharacteristics(rfuData, wellData)
        };
        
        //console.log('🔍 Visual Analysis Debug: Analysis result:', analysis);
        return analysis;

        return analysis;
    }

    assessCurveShape(rfuData, wellData) {
        const amplitude = wellData.amplitude || 0;
        const isGoodSCurve = wellData.is_good_scurve;
        const r2Score = wellData.r2_score || 0;
        const steepness = wellData.steepness || 0;

        // CORRECTED LOGIC: Use updated thresholds instead of potentially outdated is_good_scurve
        // Apply same corrected criteria as in qpcr_analyzer.py (k > 0.02, high confidence k > 0.05)
        const dataPoints = wellData.cycles?.length || 40; // Default to 40 if no cycle data
        const r2Threshold = dataPoints > 20 ? 0.9 : 0.85; // Adaptive threshold based on data points
        const correctedSCurveGood = (r2Score > r2Threshold && steepness > 0.02 && amplitude > 150);
        
        if (!correctedSCurveGood) {
            if (amplitude < 100) return 'Flat/No Rise';
            if (r2Score < 0.5) return 'Irregular/Noisy';
            return 'Poor S-Curve';
        }

        if (steepness > 0.4) return 'Sharp S-Curve';   // LOWERED from 0.5
        if (steepness > 0.25) return 'Good S-Curve';   // LOWERED from 0.3  
        if (steepness > 0.1) return 'Gradual S-Curve';
        return 'Weak S-Curve';
    }

    identifyPatternType(rfuData, wellData) {
        const amplitude = wellData.amplitude || 0;
        const snr = wellData.snr || 0;
        const hasAnomalies = wellData.anomalies && wellData.anomalies.length > 0;
        const isGoodSCurve = wellData.is_good_scurve;
        const r2Score = wellData.r2_score || 0;
        const steepness = wellData.steepness || 0;

        // CORRECTED LOGIC: Use updated thresholds instead of potentially outdated is_good_scurve
        const dataPoints = wellData.cycles?.length || 40; // Default to 40 if no cycle data
        const r2Threshold = dataPoints > 20 ? 0.9 : 0.85; // Adaptive threshold based on data points
        const correctedSCurveGood = (r2Score > r2Threshold && steepness > 0.02 && amplitude > 150);

        // CRITICAL FIX: Check corrected S-curve criteria FIRST before any positive classification
        if (!correctedSCurveGood) {
            if (amplitude < 200) return 'Negative/Background';
            if (amplitude < 500) return 'Poor Quality Signal';
            return 'High Amplitude/Poor Shape';  // High amplitude but poor S-curve shape
        }

        if (amplitude < 200) return 'Negative/Background';
        if (hasAnomalies) {
            const anomalies = wellData.anomalies;
            if (anomalies.includes('early_plateau')) return 'Early Plateau';
            if (anomalies.includes('high_noise')) return 'High Noise';
            if (anomalies.includes('unstable_baseline')) return 'Unstable Baseline';
            return 'Anomalous';
        }
        
        // Only classify as positive if we have a good S-curve
        if (amplitude > 1000 && snr > 15) return 'Strong Positive';
        if (amplitude > 500 && snr > 8) return 'Clear Positive';
        if (amplitude > 300 && snr > 4) return 'Weak Positive';
        return 'Borderline';
    }

    calculateVisualQuality(rfuData, wellData) {
        const r2Score = wellData.r2_score || 0;
        const snr = wellData.snr || 0;
        const amplitude = wellData.amplitude || 0;
        const isGoodSCurve = wellData.is_good_scurve;
        const steepness = wellData.steepness || 0;
        
        // CORRECTED LOGIC: Use updated thresholds instead of potentially outdated is_good_scurve
        const dataPoints = wellData.cycles?.length || 40; // Default to 40 if no cycle data
        const r2Threshold = dataPoints > 20 ? 0.9 : 0.85; // Adaptive threshold based on data points
        const correctedSCurveGood = (r2Score > r2Threshold && steepness > 0.02 && amplitude > 150);
        
        // CRITICAL FIX: Poor S-curve quality should override metric-based quality
        if (!correctedSCurveGood) {
            // Even with good metrics, poor S-curve = poor overall quality
            if (r2Score > 0.9 && amplitude > 1000) {
                return 'Good Metrics/Poor Shape';  // Acknowledge good metrics but poor shape
            }
            return 'Poor';  // Poor S-curve = poor quality regardless of other metrics
        }
        
        let qualityScore = 0;
        
        // R² contribution (40%)
        qualityScore += Math.min(r2Score * 40, 40);
        
        // SNR contribution (30%)
        qualityScore += Math.min((snr / 20) * 30, 30);
        
        // Amplitude contribution (30%)
        qualityScore += Math.min((amplitude / 1000) * 30, 30);
        
        if (qualityScore >= 80) return 'Excellent';
        if (qualityScore >= 60) return 'Good';
        if (qualityScore >= 40) return 'Fair';
        if (qualityScore >= 20) return 'Poor';
        return 'Very Poor';
    }

    extractCurveCharacteristics(rfuData, wellData) {
        const characteristics = [];
        const amplitude = wellData.amplitude || 0;
        const snr = wellData.snr || 0;
        const steepness = wellData.steepness || 0;
        const r2Score = wellData.r2_score || 0;

        // Amplitude characteristics
        if (amplitude > 1000) characteristics.push('High Amplitude');
        else if (amplitude > 500) characteristics.push('Medium Amplitude');
        else if (amplitude > 200) characteristics.push('Low Amplitude');
        else characteristics.push('Very Low Amplitude');

        // Signal quality characteristics
        if (snr > 15) characteristics.push('Excellent SNR');
        else if (snr > 8) characteristics.push('Good SNR');
        else if (snr > 4) characteristics.push('Fair SNR');
        else characteristics.push('Poor SNR');

        // Curve steepness
        if (steepness > 0.5) characteristics.push('Very Steep');
        else if (steepness > 0.3) characteristics.push('Steep');
        else if (steepness > 0.1) characteristics.push('Gradual');
        else characteristics.push('Very Gradual');

        // Fit quality
        if (r2Score > 0.95) characteristics.push('Perfect Fit');
        else if (r2Score > 0.9) characteristics.push('Excellent Fit');
        else if (r2Score > 0.8) characteristics.push('Good Fit');
        else characteristics.push('Poor Fit');

        return characteristics;
    }

    async checkLearningMessagesEnabled() {
        try {
            const response = await fetch('/api/ml-config/system');
            const data = await response.json();
            
            if (data.success && data.config) {
                return data.config.show_learning_messages !== false;
            }
            
            // Default to enabled if we can't check
            return true;
        } catch (error) {
            console.error('Failed to check learning messages setting:', error);
            // Default to enabled if we can't check
            return true;
        }
    }

    // CRITICAL FIX: Reset all button states when switching between wells
    resetButtonStates() {
        // Reset Submit Feedback button
        const submitBtn = document.getElementById('submit-feedback-btn');
        if (submitBtn) {
            submitBtn.textContent = '✅ Submit Feedback';
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }
        
        // Reset Analyze with ML button
        const analyzeBtn = document.getElementById('ml-analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.textContent = '🔍 Analyze with ML';
            analyzeBtn.disabled = false;
            analyzeBtn.style.opacity = '1';
        }
        
        // Reset any other ML-related buttons
        const retrainBtn = document.getElementById('manual-retrain-btn');
        if (retrainBtn) {
            retrainBtn.disabled = false;
            retrainBtn.style.opacity = '1';
        }
        
        // Clear any selected radio buttons in the feedback form
        const radioButtons = document.querySelectorAll('input[name="expert-classification"]');
        radioButtons.forEach(radio => radio.checked = false);
        
        //console.log('🔄 ML Feedback: Reset all button states');
    }

    // Update the display with visual analysis
    updateVisualCurveDisplay(wellData) {
        //console.log('🔍 Visual Display Debug: Updating visual curve display for well with keys:', Object.keys(wellData || {}));
        
        const analysis = this.analyzeVisualCurvePattern(wellData);
        
        // Update visual metrics
        const shapeElement = document.getElementById('curve-shape-assessment');
        const patternElement = document.getElementById('curve-pattern-type');
        const qualityElement = document.getElementById('visual-quality-score');
        const characteristicsElement = document.getElementById('curve-characteristics');

        if (shapeElement) {
            shapeElement.textContent = analysis.shape;
            console.log('🔍 Visual Display Debug: Set curve shape to:', analysis.shape);
        }
        if (patternElement) {
            patternElement.textContent = analysis.pattern;
            console.log('🔍 Visual Display Debug: Set pattern type to:', analysis.pattern);
        }
        if (qualityElement) {
            qualityElement.textContent = analysis.quality;
            console.log('🔍 Visual Display Debug: Set quality to:', analysis.quality);
        }
        
        // Update characteristics tags
        if (characteristicsElement) {
            characteristicsElement.innerHTML = analysis.characteristics
                .map(char => `<span class="characteristic-tag">${char}</span>`)
                .join('');
            console.log('🔍 Visual Display Debug: Set characteristics:', analysis.characteristics);
        }

        // Show the visual analysis section
        const visualDisplay = document.getElementById('visual-curve-display');
        if (visualDisplay) {
            visualDisplay.style.display = 'block';
            console.log('🔍 Visual Display Debug: Made visual analysis section visible');
        } else {
            //console.warn('🔍 Visual Display Debug: Visual display element not found');
        }
        
        // If we have basic metrics but no curve data, show what we can analyze
        if (!wellData || (!wellData.rfu_data && !wellData.raw_rfu && !wellData.rfu)) {
            //console.log('🔍 Visual Display Debug: No curve data available, showing basic metrics analysis');
            this.showBasicMetricsAnalysis(wellData);
        }
    }

    // Show basic metrics analysis when raw curve data isn't available
    showBasicMetricsAnalysis(wellData) {
        if (!wellData) return;
        
        const shapeElement = document.getElementById('curve-shape-assessment');
        const patternElement = document.getElementById('curve-pattern-type');
        const qualityElement = document.getElementById('visual-quality-score');
        const characteristicsElement = document.getElementById('curve-characteristics');
        
        // Analyze based on available metrics
        const amplitude = wellData.amplitude || 0;
        const r2Score = wellData.r2_score || 0;
        const snr = wellData.snr || 0;
        const steepness = wellData.steepness || 0;
        const classification = wellData.classification || 'UNKNOWN';
        
        // Infer shape from metrics
        let inferredShape = 'Metrics-based Analysis';
        if (r2Score > 0.9 && amplitude > 200) {
            inferredShape = 'Good S-Curve (inferred)';
        } else if (r2Score > 0.7 && amplitude > 100) {
            inferredShape = 'Fair S-Curve (inferred)';
        } else if (amplitude < 100) {
            inferredShape = 'Flat/Low Signal (inferred)';
        } else {
            inferredShape = 'Irregular Pattern (inferred)';
        }
        
        // Infer pattern from classification and amplitude
        let inferredPattern = classification.replace('_', ' ');
        if (classification === 'SUSPICIOUS') {
            if (amplitude > 400 && amplitude < 600) {
                inferredPattern = 'Borderline Positive (suspicious range)';
            } else if (snr < 5) {
                inferredPattern = 'Low Signal Quality (suspicious)';
            } else {
                inferredPattern = 'Anomalous Pattern (suspicious)';
            }
        }
        
        // Calculate quality from available metrics
        let qualityScore = 'Based on Metrics';
        if (r2Score > 0.95 && snr > 15) qualityScore = 'Excellent (metrics)';
        else if (r2Score > 0.9 && snr > 10) qualityScore = 'Good (metrics)';
        else if (r2Score > 0.8 && snr > 5) qualityScore = 'Fair (metrics)';
        else if (r2Score > 0.5) qualityScore = 'Poor (metrics)';
        else qualityScore = 'Very Poor (metrics)';
        
        // Create characteristics from metrics
        const characteristics = [];
        characteristics.push(`Amplitude: ${amplitude.toFixed(1)} RFU`);
        characteristics.push(`R²: ${r2Score.toFixed(3)}`);
        characteristics.push(`SNR: ${snr.toFixed(1)}`);
        characteristics.push(`Steepness: ${steepness.toFixed(3)}`);
        characteristics.push(`Classification: ${classification}`);
        
        if (amplitude > 1000) characteristics.push('High Signal');
        else if (amplitude > 500) characteristics.push('Medium Signal');
        else if (amplitude > 200) characteristics.push('Low Signal');
        else characteristics.push('Very Low Signal');
        
        // Update display
        if (shapeElement) shapeElement.textContent = inferredShape;
        if (patternElement) patternElement.textContent = inferredPattern;
        if (qualityElement) qualityElement.textContent = qualityScore;
        if (characteristicsElement) {
            characteristicsElement.innerHTML = characteristics
                .map(char => `<span class="characteristic-tag">${char}</span>`)
                .join('');
        }
        
        console.log('🔍 Basic Metrics Analysis: Shape:', inferredShape, 'Pattern:', inferredPattern, 'Quality:', qualityScore);
    }

    // ===== ENHANCED HYBRID FEATURE EXTRACTION =====
    // Combines numerical and visual features for ML training
    
    extractHybridFeatures(wellData) {
        if (!wellData || !wellData.rfu_data || !wellData.cycles) {
            return null;
        }

        // Get existing 18 numerical features
        const numericalFeatures = this.extractNumericalFeatures(wellData);
        
        // Extract 12 new visual pattern features
        const visualFeatures = this.extractVisualPatternFeatures(wellData.rfu_data, wellData.cycles, wellData);
        
        // Combine into 30-feature vector
        return {
            ...numericalFeatures,
            ...visualFeatures,
            feature_count: 30,
            extraction_method: 'hybrid_numerical_visual'
        };
    }

    extractNumericalFeatures(wellData) {
        return {
            amplitude: wellData.amplitude || 0,
            r2_score: wellData.r2_score || 0,
            steepness: wellData.steepness || 0,
            snr: wellData.snr || 0,
            midpoint: wellData.midpoint || 0,
            baseline: wellData.baseline || 0,
            cq_value: wellData.cq_value || 0,
            cqj: wellData.cqj || 0,
            calcj: wellData.calcj || 0,
            rmse: wellData.rmse || 0,
            min_rfu: Math.min(...(wellData.rfu_data || [0])),
            max_rfu: Math.max(...(wellData.rfu_data || [0])),
            mean_rfu: (wellData.rfu_data || []).reduce((a, b) => a + b, 0) / (wellData.rfu_data || []).length || 0,
            std_rfu: this.calculateStandardDeviation(wellData.rfu_data || []),
            min_cycle: Math.min(...(wellData.cycles || [0])),
            max_cycle: Math.max(...(wellData.cycles || [0])),
            dynamic_range: (Math.max(...(wellData.rfu_data || [0])) - Math.min(...(wellData.rfu_data || [0]))),
            efficiency: wellData.efficiency || 0
        };
    }

    extractVisualPatternFeatures(rfuData, cycles, wellData) {
        return {
            // Shape classification (0-4: flat, linear, s-curve, exponential, irregular)
            shape_class: this.classifyCurveShape(rfuData, cycles, wellData),
            
            // Baseline analysis
            baseline_stability: this.calculateBaselineStability(rfuData),
            
            // Exponential phase quality
            exponential_sharpness: this.calculateExponentialSharpness(rfuData, cycles),
            
            // Plateau characteristics
            plateau_quality: this.calculatePlateauQuality(rfuData),
            
            // Curve geometry
            curve_symmetry: this.calculateCurveSymmetry(rfuData, cycles),
            
            // Noise analysis
            noise_pattern: this.analyzeNoisePattern(rfuData),
            
            // Trend consistency
            trend_consistency: this.calculateTrendConsistency(rfuData),
            
            // Anomaly detection
            spike_detection: this.detectSpikes(rfuData),
            oscillation_pattern: this.detectOscillations(rfuData),
            dropout_detection: this.detectDropouts(rfuData),
            
            // Comparative analysis
            relative_amplitude: this.calculateRelativeAmplitude(rfuData, wellData),
            background_separation: this.calculateBackgroundSeparation(rfuData)
        };
    }

    // ===== VISUAL PATTERN DETECTION FUNCTIONS =====

    classifyCurveShape(rfuData, cycles, wellData) {
        const totalRange = Math.max(...rfuData) - Math.min(...rfuData);
        
        if (totalRange < 50) return 0; // Flat
        
        const isGoodSCurve = wellData.is_good_scurve;
        const r2Score = wellData.r2_score || 0;
        
        if (isGoodSCurve && r2Score > 0.9) return 2; // S-curve
        if (this.isLinearIncrease(rfuData)) return 1; // Linear
        if (this.isExponentialOnly(rfuData)) return 3; // Exponential
        return 4; // Irregular
    }

    calculateBaselineStability(rfuData) {
        const baselineLength = Math.min(10, Math.floor(rfuData.length * 0.25));
        const baseline = rfuData.slice(0, baselineLength);
        const mean = baseline.reduce((a, b) => a + b) / baseline.length;
        const variance = baseline.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / baseline.length;
        return Math.sqrt(variance) / mean; // Coefficient of variation
    }

    calculateExponentialSharpness(rfuData, cycles) {
        // Find the steepest section (exponential phase)
        const derivatives = [];
        for (let i = 1; i < rfuData.length; i++) {
            derivatives.push((rfuData[i] - rfuData[i-1]) / (cycles[i] - cycles[i-1]));
        }
        return Math.max(...derivatives) / (Math.max(...rfuData) - Math.min(...rfuData));
    }

    calculatePlateauQuality(rfuData) {
        const plateauLength = Math.min(10, Math.floor(rfuData.length * 0.25));
        const plateau = rfuData.slice(-plateauLength);
        const plateauStd = this.calculateStandardDeviation(plateau);
        const plateauMean = plateau.reduce((a, b) => a + b) / plateau.length;
        return 1 - (plateauStd / plateauMean); // Higher is better
    }

    calculateCurveSymmetry(rfuData, cycles) {
        // Measure how symmetric the S-curve is around its midpoint
        const midIndex = Math.floor(rfuData.length / 2);
        const leftHalf = rfuData.slice(0, midIndex);
        const rightHalf = rfuData.slice(midIndex).reverse();
        
        let correlation = 0;
        const minLength = Math.min(leftHalf.length, rightHalf.length);
        
        for (let i = 0; i < minLength; i++) {
            correlation += Math.abs(leftHalf[i] - rightHalf[i]);
        }
        
        return 1 - (correlation / (minLength * Math.max(...rfuData)));
    }

    analyzeNoisePattern(rfuData) {
        const derivatives = [];
        for (let i = 1; i < rfuData.length; i++) {
            derivatives.push(Math.abs(rfuData[i] - rfuData[i-1]));
        }
        const noiseLevel = this.calculateStandardDeviation(derivatives);
        const signalRange = Math.max(...rfuData) - Math.min(...rfuData);
        return noiseLevel / signalRange; // Lower is better
    }

    calculateTrendConsistency(rfuData) {
        let consistentDirections = 0;
        for (let i = 2; i < rfuData.length; i++) {
            const dir1 = rfuData[i-1] - rfuData[i-2];
            const dir2 = rfuData[i] - rfuData[i-1];
            if ((dir1 >= 0 && dir2 >= 0) || (dir1 < 0 && dir2 < 0)) {
                consistentDirections++;
            }
        }
        return consistentDirections / (rfuData.length - 2);
    }

    detectSpikes(rfuData) {
        const derivatives = [];
        for (let i = 1; i < rfuData.length; i++) {
            derivatives.push(Math.abs(rfuData[i] - rfuData[i-1]));
        }
        const threshold = 3 * this.calculateStandardDeviation(derivatives);
        return derivatives.filter(d => d > threshold).length;
    }

    detectOscillations(rfuData) {
        let oscillations = 0;
        let lastDirection = 0;
        let directionChanges = 0;
        
        for (let i = 1; i < rfuData.length; i++) {
            const currentDirection = rfuData[i] > rfuData[i-1] ? 1 : -1;
            if (lastDirection !== 0 && currentDirection !== lastDirection) {
                directionChanges++;
            }
            lastDirection = currentDirection;
        }
        
        return directionChanges / rfuData.length;
    }

    detectDropouts(rfuData) {
        return rfuData.filter(val => isNaN(val) || val === null || val === undefined).length;
    }

    calculateRelativeAmplitude(rfuData, wellData) {
        const amplitude = wellData.amplitude || 0;
        // This would ideally compare to other wells in the same plate
        // For now, return normalized amplitude
        return Math.min(amplitude / 1000, 1.0);
    }

    calculateBackgroundSeparation(rfuData) {
        const baseline = Math.min(...rfuData);
        const peak = Math.max(...rfuData);
        const separation = peak - baseline;
        return Math.min(separation / 1000, 1.0);
    }

    // ===== HELPER FUNCTIONS =====

    /**
     * Extract numeric value from CQJ/CalcJ data structure
     * Handles both simple numbers and channel-specific dictionaries like {'FAM': 21.77}
     * Properly handles None/null values which indicate no threshold crossing (negative wells)
     */
    extractNumericValue(value, channelHint = null) {
        if (value === null || value === undefined) {
            // For CQJ/CalcJ, null/None means no threshold crossing (negative well)
            // Use a special sentinel value that ML can recognize as "no crossing"
            // -999 is clearly outside valid CQJ range (typically 5-50 cycles)
            return -999; // -999 indicates no threshold crossing
        }
        
        // If it's already a number, validate it's not an invalid marker
        if (typeof value === 'number') {
            // Check for invalid CQJ values that should never occur
            if (value === -1 || value === 1 || (value > 0 && value <= 1) || value > 50) {
                return -999; // Convert invalid values to our sentinel
            }
            return value; // Valid numeric value
        }
        
        // If it's a dictionary/object, extract the numeric value
        if (typeof value === 'object' && value !== null) {
            // Try to use the channel hint first
            if (channelHint && value[channelHint] !== undefined) {
                const channelValue = value[channelHint];
                if (channelValue === null || channelValue === undefined) {
                    return -999; // No threshold crossing for this channel
                }
                // Validate extracted channel value
                if (typeof channelValue === 'number') {
                    if (channelValue === -1 || channelValue === 1 || 
                        (channelValue > 0 && channelValue <= 1) || channelValue > 50) {
                        return -999; // Invalid CQJ value
                    }
                    return channelValue;
                }
                return -999;
            }
            
            // Otherwise, find the first valid numeric value or null
            for (const key in value) {
                const val = value[key];
                if (val === null || val === undefined) {
                    return -999; // No threshold crossing
                }
                if (typeof val === 'number') {
                    // Validate the value
                    if (val === -1 || val === 1 || (val > 0 && val <= 1) || val > 50) {
                        return -999; // Invalid CQJ value
                    }
                    return val;
                }
            }
            
            // If all values are null/undefined, return sentinel
            return -999;
        }
        
        // Try to parse as number
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
            // Validate parsed value
            if (parsed === -1 || parsed === 1 || (parsed > 0 && parsed <= 1) || parsed > 50) {
                return -999; // Invalid CQJ value
            }
            return parsed;
        }
        
        // Default for unparseable values
        return -999; // Assume no threshold crossing for unparseable values
    }

    isLinearIncrease(rfuData) {
        const firstThird = rfuData.slice(0, Math.floor(rfuData.length / 3));
        const lastThird = rfuData.slice(-Math.floor(rfuData.length / 3));
        const avgFirst = firstThird.reduce((a, b) => a + b) / firstThird.length;
        const avgLast = lastThird.reduce((a, b) => a + b) / lastThird.length;
        return (avgLast - avgFirst) > 100 && (avgLast - avgFirst) < 500;
    }

    isExponentialOnly(rfuData) {
        // Check if curve has exponential growth without plateau
        const lastQuarter = rfuData.slice(-Math.floor(rfuData.length / 4));
        const secondLastQuarter = rfuData.slice(-Math.floor(rfuData.length / 2), -Math.floor(rfuData.length / 4));
        
        const lastAvg = lastQuarter.reduce((a, b) => a + b) / lastQuarter.length;
        const secondLastAvg = secondLastQuarter.reduce((a, b) => a + b) / secondLastQuarter.length;
        
        return (lastAvg - secondLastAvg) > 50; // Still growing at the end
    }

    calculateStandardDeviation(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    // ===== DUPLICATE TRAINING PREVENTION =====
    
    extractFullSampleName() {
        // Try to get the full sample name from the modal details
        const modalDetails = document.getElementById('modalDetails');
        if (modalDetails) {
            // Look for the sample name in the modal parameter grid
            const parameterItems = modalDetails.querySelectorAll('.modal-parameter-item');
            for (let item of parameterItems) {
                const label = item.querySelector('.modal-parameter-label');
                const value = item.querySelector('.modal-parameter-value');
                if (label && value && label.textContent.toLowerCase().includes('sample')) {
                    const sampleName = value.textContent.trim();
                    if (sampleName && sampleName !== 'Unknown' && sampleName !== '') {
                        console.log('🔍 Sample Extraction: Found full sample name in modal:', sampleName);
                        return sampleName;
                    }
                }
            }
            
            // Alternative approach: look for sample info in any text content
            const modalText = modalDetails.textContent;
            const sampleMatch = modalText.match(/Sample:\s*([^\n\r]+)/i);
            if (sampleMatch && sampleMatch[1]) {
                const sampleName = sampleMatch[1].trim();
                //console.log('🔍 Sample Extraction: Found sample name via text match:', sampleName);
                return sampleName;
            }
        }
        
        // Final fallback: use well data
        const fallbackName = this.currentWellData?.sample || this.currentWellData?.sample_name || 'Unknown_Sample';
        //console.log('🔍 Sample Extraction: Using fallback sample name:', fallbackName);
        return fallbackName;
    }
    
    createUniqueSampleIdentifier() {
        // Create a unique identifier using full sample name + pathogen + channel
        const fullSampleName = this.extractFullSampleName();
        const channelData = this.extractChannelSpecificPathogen();
        const pathogen = channelData.pathogen || 'General_PCR';
        const channel = channelData.channel || 'Unknown_Channel';
        
        // Create unique identifier that includes:
        // 1. Full sample name (from modal)
        // 2. Pathogen/test code
        // 3. Channel/fluorophore
        const uniqueId = `${fullSampleName}||${pathogen}||${channel}`;
        
        //console.log('🔍 Sample ID Debug: Created unique identifier:', uniqueId);
        //console.log('   Full Sample Name:', fullSampleName);
        //console.log('   Pathogen:', pathogen);
        //console.log('   Channel:', channel);
        
        return uniqueId;
    }

    /**
     * Force refresh the ML display in the modal with current data
     */
    refreshMLDisplayInModal() {
        try {
            console.log('🔄 MODAL-REFRESH: Refreshing ML display in modal for key:', this.currentWellKey);
            
            // CRITICAL FIX: Check if ML section exists in modal, recreate if missing
            let mlSection = document.getElementById('ml-feedback-section');
            if (!mlSection) {
                console.log('� MODAL-REFRESH: ML section missing from modal, recreating...');
                this.createMLSectionInModal();
                mlSection = document.getElementById('ml-feedback-section');
                
                if (!mlSection) {
                    console.error('❌ MODAL-REFRESH: Failed to create ML section in modal');
                    return;
                }
                console.log('✅ MODAL-REFRESH: ML section recreated successfully');
            }
            
            // ENHANCED FIX: If internal state is not set, try to determine current well from global state
            let workingWellKey = this.currentWellKey;
            let workingWellData = this.currentWellData;
            
            if (!workingWellData || !workingWellKey) {
                console.log('🔍 MODAL-REFRESH: Internal state missing, trying to determine from global state...');
                
                // Try to get current well from global modal state
                if (window.currentModalWellKey) {
                    workingWellKey = window.currentModalWellKey;
                    console.log('🔍 MODAL-REFRESH: Using global modal well key:', workingWellKey);
                }
                
                // Try to get well data from global analysis results
                if (workingWellKey && window.currentAnalysisResults?.individual_results) {
                    workingWellData = window.currentAnalysisResults.individual_results[workingWellKey];
                    if (workingWellData) {
                        console.log('✅ MODAL-REFRESH: Found well data from global state');
                        // Update internal state for future calls
                        this.currentWellKey = workingWellKey;
                        this.currentWellData = workingWellData;
                    }
                }
            }
            
            // If we still don't have well data, at least we recreated the ML section
            if (!workingWellData || !workingWellKey) {
                console.warn('🚨 MODAL-REFRESH: No current well data available for ML display refresh', {
                    hasWellData: !!workingWellData,
                    wellKey: workingWellKey,
                    hasInternalWellData: !!this.currentWellData,
                    internalWellKey: this.currentWellKey,
                    globalModalKey: window.currentModalWellKey
                });
                // Don't return early - at least we recreated the ML section
                console.log('✅ MODAL-REFRESH: ML section restored even without complete well data');
            }
            
            // Check if the well has expert classification or ML classification to display
            const wellResult = window.currentAnalysisResults?.individual_results?.[workingWellKey];
            
            // CRITICAL: For multichannel, try different key variations to handle format inconsistencies
            let actualWellResult = wellResult;
            let actualWellKey = workingWellKey;
            
            if (!wellResult && workingWellKey && workingWellKey.includes('_')) {
                console.log('🔍 MODAL-REFRESH: Well not found, trying key variations for multichannel...');
                const keyVariations = this.generateMultichannelVariations(workingWellKey);
                
                for (const variation of keyVariations) {
                    const varResult = window.currentAnalysisResults?.individual_results?.[variation];
                    if (varResult) {
                        console.log('✅ MODAL-REFRESH: Found well data using key variation:', variation);
                        actualWellResult = varResult;
                        actualWellKey = variation;
                        // Update our current key to match what's actually in the data
                        workingWellKey = variation;
                        this.currentWellKey = variation;
                        break;
                    }
                }
                
                if (!actualWellResult) {
                    console.log('🔍 MODAL-REFRESH: No well data found for any key variation');
                }
            }
            
            if (actualWellResult) {
                console.log('📊 MODAL-REFRESH: Current well result for ML refresh:', {
                    wellKey: workingWellKey,
                    classification: actualWellResult.classification,
                    curve_classification: actualWellResult.curve_classification,
                    ml_classification: actualWellResult.ml_classification,
                    hasExpertFeedback: actualWellResult.curve_classification?.method === 'expert_feedback' || 
                                      actualWellResult.ml_classification?.method === 'Expert Review'
                });
                
                // CRITICAL: Check memory for expert feedback FIRST before well result
                let expertFeedbackToDisplay = null;
                
                // Priority 1: Check if we have expert feedback in memory (most recent)
                if (this.currentWellData && this.currentWellData.curve_classification && 
                    (this.currentWellData.curve_classification.method === 'expert_feedback' ||
                     this.currentWellData.curve_classification.method === 'Expert Review')) {
                    expertFeedbackToDisplay = this.currentWellData.curve_classification;
                    console.log('✅ MODAL-REFRESH: Using expert feedback from memory (currentWellData)');
                } else if (this.currentWellData && this.currentWellData.ml_classification && 
                          (this.currentWellData.ml_classification.method === 'Expert Review' ||
                           this.currentWellData.ml_classification.expert_review_method === 'ml_feedback_interface')) {
                    expertFeedbackToDisplay = this.currentWellData.ml_classification;
                    console.log('✅ MODAL-REFRESH: Using expert ml_classification from memory (currentWellData)');
                }
                // Priority 2: Check for fresh expert feedback in session storage (for fresh uploads)
                else {
                    const sessionKey = `expert_feedback_${workingWellKey}`;
                    console.log('🔍 MODAL-REFRESH: Checking session storage with key:', sessionKey);
                    const storedFeedback = sessionStorage.getItem(sessionKey);
                    if (storedFeedback) {
                        console.log('✅ MODAL-REFRESH: Found stored feedback in session storage:', storedFeedback);
                        try {
                            const parsedFeedback = JSON.parse(storedFeedback);
                            // Check if it's recent (within last 30 seconds)
                            const feedbackAge = Date.now() - new Date(parsedFeedback.timestamp).getTime();
                            if (feedbackAge < 30000) {
                                expertFeedbackToDisplay = parsedFeedback;
                                console.log('✅ MODAL-REFRESH: Using expert feedback from session storage (fresh upload recovery)');
                            } else {
                                console.log('🔄 MODAL-REFRESH: Session storage feedback too old, removing');
                                sessionStorage.removeItem(sessionKey);
                            }
                        } catch (e) {
                            console.warn('⚠️ MODAL-REFRESH: Failed to parse stored feedback:', e);
                            sessionStorage.removeItem(sessionKey);
                        }
                    } else {
                        console.log('🔍 MODAL-REFRESH: No stored feedback found for key:', sessionKey);
                    }
                }
                // Priority 3: Check well result for expert feedback 
                if (!expertFeedbackToDisplay && actualWellResult.curve_classification && 
                    (actualWellResult.curve_classification.method === 'expert_feedback' ||
                     actualWellResult.curve_classification.method === 'Expert Review')) {
                    expertFeedbackToDisplay = actualWellResult.curve_classification;
                    console.log('✅ MODAL-REFRESH: Using expert curve_classification from well result');
                } else if (!expertFeedbackToDisplay && actualWellResult.ml_classification && 
                          (actualWellResult.ml_classification.method === 'Expert Review' ||
                           actualWellResult.ml_classification.expert_review_method === 'ml_feedback_interface')) {
                    expertFeedbackToDisplay = actualWellResult.ml_classification;
                    console.log('✅ MODAL-REFRESH: Using expert ml_classification from well result');
                }
                
                // Display expert feedback if found, otherwise fallback to regular classifications
                if (expertFeedbackToDisplay) {
                    console.log('🎯 MODAL-REFRESH: Displaying EXPERT FEEDBACK:', expertFeedbackToDisplay.classification);
                    this.displayExistingMLClassification(expertFeedbackToDisplay);
                } else if (actualWellResult.curve_classification) {
                    console.log('📊 MODAL-REFRESH: Displaying regular curve_classification');
                    this.displayExistingMLClassification(actualWellResult.curve_classification);
                } else if (actualWellResult.ml_classification) {
                    console.log('📊 MODAL-REFRESH: Displaying regular ml_classification');
                    this.displayExistingMLClassification(actualWellResult.ml_classification);
                } else {
                    console.log('🔄 MODAL-REFRESH: No classification data, showing basic ML section');
                    // Show the basic ML section but without a prediction
                    const mlSection = document.getElementById('ml-feedback-section');
                    if (mlSection) {
                        mlSection.style.display = 'block';
                    }
                }
                
                // Also update the feedback form state
                this.hideFeedbackForm();
            } else {
                console.warn('🚨 MODAL-REFRESH: No well result found for key:', workingWellKey);
                console.log('📊 MODAL-REFRESH: Available keys:', window.currentAnalysisResults?.individual_results ? 
                    Object.keys(window.currentAnalysisResults.individual_results) : 'No individual_results');
            }
            
        } catch (error) {
            console.error('❌ MODAL-REFRESH: Error refreshing ML display in modal:', error);
        }
    }

    /**
     * Creates the ML section in the modal when it's missing after modal content refresh
     */
    createMLSectionInModal() {
        try {
            console.log('🔧 MODAL-CREATE: Creating ML section in modal...');
            
            // Look for the modal body to insert ML section between chart and details
            const modalBody = document.querySelector('.modal-body');
            const chartContainer = document.querySelector('.modal-chart-container');
            const modalDetails = document.getElementById('modalDetails');
            
            if (!modalBody) {
                console.error('❌ MODAL-CREATE: Modal body not found');
                return false;
            }

            console.log('✅ MODAL-CREATE: Modal body found, creating ML section');
            
            // Create ML feedback section HTML (same as in original init)
            const mlSection = document.createElement('div');
            mlSection.id = 'ml-feedback-section';
            mlSection.className = 'ml-feedback-container';
            mlSection.innerHTML = `
                <div class="ml-section">
                    <h4>🤖 ML Curve Classification</h4>
                    
                    <!-- ML Prediction Display -->
                    <div class="ml-prediction" id="ml-prediction-display" style="display: none;">
                        <div class="prediction-info">
                            <div class="prediction-result">
                                <strong>ML Prediction:</strong> 
                                <span id="ml-prediction-class" class="classification-badge">-</span>
                                <span id="ml-prediction-confidence" class="confidence-score">-</span>
                            </div>
                            <div class="prediction-method">
                                <small>Method: <span id="ml-prediction-method">-</span></small>
                            </div>
                            <div class="pathogen-context" id="pathogen-context" style="display: none;">
                                <small>🧬 Pathogen: <span id="detected-pathogen">-</span></small>
                            </div>
                        </div>
                        
                        <!-- Classification Conflict Alert -->
                        <div class="classification-conflict" id="classification-conflict" style="display: none;">
                            <div class="conflict-header">
                                <span class="conflict-icon">⚠️</span>
                                <strong>Classification Conflict Detected</strong>
                            </div>
                            <div class="conflict-details">
                                <div class="conflict-comparison">
                                    <div class="conflict-item">
                                        <span class="conflict-label">Rule-Based:</span>
                                        <span id="rule-based-class" class="classification-badge">-</span>
                                    </div>
                                    <div class="conflict-vs">vs</div>
                                    <div class="conflict-item">
                                        <span class="conflict-label">ML Prediction:</span>
                                        <span id="ml-conflict-class" class="classification-badge">-</span>
                                    </div>
                                </div>
                                <div class="conflict-confidence">
                                    <small>ML Confidence: <span id="conflict-confidence">-</span></small>
                                </div>
                            </div>
                            <div class="conflict-actions">
                                <button id="approve-ml-btn" class="ml-btn primary small">
                                    ✅ Approve ML
                                </button>
                                <button id="keep-rule-btn" class="ml-btn secondary small">
                                    📋 Keep Rule-Based
                                </button>
                                <button id="expert-review-btn" class="ml-btn warning small">
                                    👨‍⚕️ Need Expert Review
                                </button>
                            </div>
                        </div>
                        
                        <!-- Visual Curve Analysis Display -->
                        <div class="visual-curve-analysis" id="visual-curve-display" style="display: none;">
                            <h6>👁️ Visual Curve Analysis</h6>
                            <div class="visual-metrics-grid">
                                <div class="visual-metric-item">
                                    <span class="metric-label">Curve Shape:</span>
                                    <span id="curve-shape-assessment">-</span>
                                </div>
                                <div class="visual-metric-item">
                                    <span class="metric-label">Pattern Type:</span>
                                    <span id="curve-pattern-type">-</span>
                                </div>
                                <div class="visual-metric-item">
                                    <span class="metric-label">Visual Quality:</span>
                                    <span id="visual-quality-score">-</span>
                                </div>
                                <div class="visual-metric-item">
                                    <span class="metric-label">Similar Patterns:</span>
                                    <span id="similar-patterns-count">-</span>
                                </div>
                            </div>
                            <div class="curve-characteristics">
                                <div class="characteristic-tags" id="curve-characteristics">
                                    <!-- Dynamic tags for curve characteristics -->
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Analysis Buttons -->
                    <div class="ml-actions">
                        <button id="ml-analyze-btn" class="ml-btn primary">
                            🔍 Analyze with ML
                        </button>
                        <button id="ml-feedback-btn" class="ml-btn secondary" style="display: none;">
                            📝 Provide Feedback
                        </button>
                    </div>

                    <!-- Feedback Form -->
                    <div class="ml-feedback-form" id="ml-feedback-form" style="display: none;">
                        <h5>Expert Classification Feedback</h5>
                        <p>Current classification: <span id="current-classification">-</span></p>
                        <p>Help improve the ML model by providing the correct classification:</p>
                        
                        <div class="classification-options">
                            <label class="classification-option">
                                <input type="radio" name="expert-classification" value="STRONG_POSITIVE">
                                <span class="classification-label strong-positive">Strong Positive</span>
                            </label>
                            <label class="classification-option">
                                <input type="radio" name="expert-classification" value="POSITIVE">
                                <span class="classification-label positive">Positive</span>
                            </label>
                            <label class="classification-option">
                                <input type="radio" name="expert-classification" value="WEAK_POSITIVE">
                                <span class="classification-label weak-positive">Weak Positive</span>
                            </label>
                            <label class="classification-option">
                                <input type="radio" name="expert-classification" value="INDETERMINATE">
                                <span class="classification-label indeterminate">Indeterminate</span>
                                <small style="display: block; color: #666; margin-top: 2px;">Unclear biological result, ambiguous signal that cannot be confidently classified</small>
                            </label>
                            <label class="classification-option">
                                <input type="radio" name="expert-classification" value="REDO">
                                <span class="classification-label redo">Redo</span>
                                <small style="display: block; color: #666; margin-top: 2px;">Technical issues or borderline amplitude (400-500 RFU), repeat test recommended</small>
                            </label>
                            <label class="classification-option">
                                <input type="radio" name="expert-classification" value="SUSPICIOUS">
                                <span class="classification-label suspicious">Suspicious</span>
                                <small style="display: block; color: #666; margin-top: 2px;">Questionable result that may need further investigation or expert review</small>
                            </label>
                            <label class="classification-option">
                                <input type="radio" name="expert-classification" value="NEGATIVE">
                                <span class="classification-label negative">Negative</span>
                            </label>
                        </div>

                        <div class="feedback-actions">
                            <button id="submit-feedback-btn" class="ml-btn primary">
                                ✅ Submit Feedback
                            </button>
                            <button id="cancel-feedback-btn" class="ml-btn secondary">
                                ❌ Cancel
                            </button>
                        </div>
                    </div>

                    <!-- ML Statistics -->
                    <div class="ml-stats" id="ml-stats-display">
                        <h5>ML Model Status</h5>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <span class="stat-label">Training Samples:</span>
                                <span id="stat-training-samples">-</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Model Trained:</span>
                                <span id="stat-model-trained">-</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Pathogen Models:</span>
                                <span id="stat-pathogen-models">-</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Expert Review:</span>
                                <span id="stat-expert-review-status">-</span>
                            </div>
                        </div>
                        
                        <!-- Manual Retrain Button -->
                        <div class="ml-actions" style="margin-top: 15px;">
                            <button id="manual-retrain-btn" class="ml-btn secondary small" style="font-size: 0.9em;">
                                🔄 Manual Retrain
                            </button>
                        </div>
                        
                        <div class="training-progress" id="training-progress" style="display: none;">
                            <div class="progress-info">
                                <small>Expert review available after 50+ training samples</small>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" id="training-progress-fill"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Insert ML section between chart and details (or at end of modal body)
            if (chartContainer && modalDetails) {
                modalBody.insertBefore(mlSection, modalDetails);
                console.log('✅ MODAL-CREATE: ML section inserted between chart and details');
            } else if (modalDetails) {
                modalBody.insertBefore(mlSection, modalDetails);
                console.log('✅ MODAL-CREATE: ML section inserted before modal details');
            } else {
                modalBody.appendChild(mlSection);
                console.log('✅ MODAL-CREATE: ML section appended to modal body');
            }
            
            // Re-attach event listeners
            this.attachEventListeners();
            
            // Add visual analysis styles
            this.addVisualAnalysisStyles();
            
            // Show the ML section
            this.showMLSection();
            
            console.log('✅ MODAL-CREATE: ML section created and initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ MODAL-CREATE: Error creating ML section in modal:', error);
            return false;
        }
    }

    async checkIfSampleAlreadyTrained() {
        // Check if this exact sample has already been trained
        const sampleId = this.createUniqueSampleIdentifier();
        
        // Check local cache first
        if (this.trainedSamples.has(sampleId)) {
            console.log('🚫 Sample Training Check: Sample already trained (local cache):', sampleId);
            return true;
        }
        
        // Check backend for existing training data
        try {
            const response = await fetch('/api/ml-check-trained-sample', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sample_identifier: sampleId,
                    full_sample_name: this.extractFullSampleName(),
                    pathogen: this.extractChannelSpecificPathogen().pathogen,
                    channel: this.extractChannelSpecificPathogen().channel
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                const alreadyTrained = result.already_trained || false;
                
                if (alreadyTrained) {
                    // Add to local cache
                    this.trainedSamples.add(sampleId);
                    console.log('🚫 Sample Training Check: Sample already trained (backend check):', sampleId);
                    return true;
                }
            }
        } catch (error) {
            console.warn('⚠️ Sample Training Check: Failed to check backend, allowing training:', error);
        }
        
        return false;
    }
    
    markSampleAsTrained() {
        const sampleId = this.createUniqueSampleIdentifier();
        this.trainedSamples.add(sampleId);
        console.log('✅ Sample Training: Marked sample as trained:', sampleId);
    }
    
    async loadTrainedSamplesCache() {
        // Load existing trained sample identifiers from the backend
        try {
            const response = await fetch('/api/ml-get-trained-samples');
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.trained_sample_identifiers) {
                    // Populate the local cache
                    this.trainedSamples = new Set(result.trained_sample_identifiers);
                    //console.log(`📚 Trained Samples Cache: Loaded ${this.trainedSamples.size} previously trained samples`);
                }
            }
        } catch (error) {
            //console.warn('⚠️ Trained Samples Cache: Failed to load cache from backend:', error);
        }
    }
    
    async manualRetrain() {
        const retrainBtn = document.getElementById('manual-retrain-btn');
        
        // Check if we have enough training samples
        if (!this.mlStats || this.mlStats.training_samples < 10) {
            alert(`Need at least 10 training samples for manual retrain. Currently have: ${this.mlStats?.training_samples || 0}`);
            return;
        }
        
        const shouldRetrain = confirm(
            `🔄 Manual Model Retrain\n\n` +
            `Current training samples: ${this.mlStats.training_samples}\n\n` +
            `This will retrain the ML model with all current training data.\n` +
            `This may improve model accuracy with your recent feedback.\n\n` +
            `Continue with manual retrain?`
        );
        
        if (!shouldRetrain) {
            return;
        }
        
        if (retrainBtn) {
            retrainBtn.disabled = true;
            retrainBtn.textContent = '⏳ Retraining...';
        }
        
        try {
            const response = await fetch('/api/ml-retrain', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    manual_trigger: true,
                    training_samples: this.mlStats.training_samples
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.showTrainingNotification(
                        'Model Retrained!',
                        `🎯 Model successfully retrained with ${this.mlStats.training_samples} samples. Accuracy: ${(result.accuracy || 0).toFixed(2)}`,
                        'success'
                    );
                    
                    // Update ML stats to reflect the retrain
                    await this.updateMLStats();
                } else {
                    throw new Error(result.error || 'Retrain failed');
                }
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
            
        } catch (error) {
            console.error('Manual retrain error:', error);
            this.showTrainingNotification(
                'Retrain Failed',
                `❌ Manual retrain failed: ${error.message}`,
                'error'
            );
        } finally {
            if (retrainBtn) {
                retrainBtn.disabled = false;
                retrainBtn.textContent = '🔄 Manual Retrain';
            }
        }
    }

    // ===== CHANNEL-SPECIFIC PATHOGEN EXTRACTION =====
    
    extractChannelSpecificPathogen(fallbackWellData = null) {
        // Enhanced robustness for pathogen extraction with fallback data support
        const wellData = this.currentWellData || fallbackWellData;
        
        if (!wellData) {
            //console.warn('ML Feedback Interface: No current well data available');
            return {
                experimentPattern: null,
                test_code: null,
                testCode: null,
                channel: 'Unknown',
                pathogen: 'Unknown'
            };
        }
        
        // Extract channel-specific pathogen information for multichannel experiments
        const currentExperimentPattern = (typeof getCurrentFullPattern === 'function') ? getCurrentFullPattern() : null;
        const testCode = (typeof extractTestCode === 'function' && currentExperimentPattern) ? 
            extractTestCode(currentExperimentPattern) : null;
        
        // Get channel from current well data with multiple fallback options
        const channel = wellData.channel || 
                       wellData.fluorophore || 
                       wellData.fluorescent_channel ||
                       '';
        
        // Try to get specific pathogen for this channel using multiple strategies
        let specificPathogen = null;
        
        // Strategy 1: Use pathogen library lookup
        if (testCode && channel && typeof getPathogenTarget === 'function') {
            try {
                specificPathogen = getPathogenTarget(testCode, channel);
                if (specificPathogen && specificPathogen !== 'Unknown') {
                    //console.log(`🧬 Pathogen Library lookup: ${testCode} + ${channel} = ${specificPathogen}`);
                }
            } catch (error) {
                //console.log(`⚠️ Pathogen library lookup failed for ${testCode}/${channel}:`, error);
            }
        }
        
        // Strategy 2: Use existing pathogen fields from well data
        if (!specificPathogen || specificPathogen === 'Unknown') {
            specificPathogen = wellData.target || 
                             wellData.specific_pathogen ||
                             wellData.pathogen ||
                             null;
            
            if (specificPathogen && specificPathogen !== 'Unknown') {
                //console.log(`🧬 Well data pathogen: ${specificPathogen}`);
            }
        }
        
        // Strategy 3: Use test code as pathogen
        if (!specificPathogen || specificPathogen === 'Unknown') {
            specificPathogen = testCode || wellData.test_code || null;
            if (specificPathogen && specificPathogen !== 'Unknown') {
                //console.log(`🧬 Test code as pathogen: ${specificPathogen}`);
            }
        }
        
        // Strategy 4: Construct from test code + channel
        if (!specificPathogen || specificPathogen === 'Unknown') {
            if (testCode && channel) {
                specificPathogen = `${testCode}_${channel}`;
                //console.log(`🧬 Constructed pathogen: ${specificPathogen}`);
            }
        }
        
        // Strategy 5: Use channel/fluorophore alone
        if (!specificPathogen || specificPathogen === 'Unknown') {
            if (channel) {
                specificPathogen = channel;
                //console.log(`🧬 Channel as pathogen: ${specificPathogen}`);
            }
        }
        
        // Final fallback
        if (!specificPathogen || specificPathogen === 'Unknown') {
            specificPathogen = 'General_PCR';
            //console.log(`🧬 Final fallback pathogen: ${specificPathogen}`);
        }

        //console.log(`🧬 Final pathogen for ML: ${specificPathogen}`);

        return {
            experimentPattern: currentExperimentPattern,
            test_code: testCode,
            testCode: testCode,  // Keep both for compatibility
            channel: channel || 'Unknown',
            fluorophore: channel || 'Unknown',  // Add fluorophore field for ML config lookup
            pathogen: specificPathogen
        };
    }

    displayExistingMLClassification(mlClassification) {
        console.log('🔄 DISPLAY-ML: Attempting to display ML classification:', mlClassification);
        
        // Add validation for ML classification data but be more forgiving
        if (!mlClassification) {
            console.warn('ML Feedback Interface: No ML classification data provided');
            return;
        }
        
        // Even if classification or confidence is missing, try to show what we have
        if (!mlClassification.classification) {
            console.warn('ML Feedback Interface: Missing classification field, using fallback');
            mlClassification.classification = 'UNKNOWN';
        }
        
        if (mlClassification.confidence === undefined || mlClassification.confidence === null) {
            console.warn('ML Feedback Interface: Missing confidence field, using fallback');
            mlClassification.confidence = 0.0;
        }
        
        console.log('🔄 DISPLAY-ML: Displaying ML classification:', {
            classification: mlClassification.classification,
            method: mlClassification.method,
            confidence: mlClassification.confidence,
            isExpertFeedback: mlClassification.method === 'expert_feedback' || 
                             mlClassification.method === 'Expert Review' ||
                             mlClassification.expert_review_method === 'ml_feedback_interface'
        });
        
        // CRITICAL: Store the original ML prediction for comparison later
        if (this.currentWellData && !this.currentWellData.original_ml_prediction) {
            this.currentWellData.original_ml_prediction = mlClassification.classification;
            console.log('📊 Stored original ML prediction:', mlClassification.classification);
        }
        
        const predictionDisplay = document.getElementById('ml-prediction-display');
        const classElement = document.getElementById('ml-prediction-class');
        const confidenceElement = document.getElementById('ml-prediction-confidence');
        const methodElement = document.getElementById('ml-prediction-method');
        const pathogenElement = document.getElementById('detected-pathogen');
        const pathogenContext = document.getElementById('pathogen-context');
        const feedbackBtn = document.getElementById('ml-feedback-btn');

        if (predictionDisplay && classElement && confidenceElement && methodElement) {
            predictionDisplay.style.display = 'block';
            
            classElement.textContent = mlClassification.classification.replace('_', ' ');
            classElement.className = `classification-badge ${this.getClassificationBadgeClass(mlClassification.classification)}`;
            
            // CRITICAL FIX: Handle expert feedback classifications differently
            // Check for both backend formats: 'expert_feedback' and 'Expert Review'
            if (mlClassification.method === 'expert_feedback' || 
                mlClassification.method === 'Expert Review' ||
                mlClassification.expert_review_method === 'ml_feedback_interface') {
                confidenceElement.textContent = '(Expert Decision)';
                methodElement.textContent = 'Expert Review';
            } else {
                confidenceElement.textContent = `(${(mlClassification.confidence * 100).toFixed(1)}% confidence)`;
                methodElement.textContent = mlClassification.method || 'ML';
            }
            
            if (mlClassification.pathogen && pathogenElement && pathogenContext) {
                pathogenElement.textContent = mlClassification.pathogen;
                pathogenContext.style.display = 'block';
            }
            
            if (feedbackBtn) {
                feedbackBtn.style.display = 'inline-block';
            }
        }
    }

    async analyzeCurveWithML() {
        console.log('ML Analysis: Starting analysis...');
        
        const analyzeBtn = document.getElementById('ml-analyze-btn');
        let originalButtonState = null;
        
        // Store original button state and set to analyzing FIRST
        if (analyzeBtn) {
            originalButtonState = {
                disabled: analyzeBtn.disabled,
                textContent: analyzeBtn.textContent
            };
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = '🔄 Analyzing...';
        }
        
        try {
            // Enhanced validation with fallback recovery
            if (!this.currentWellData) {
                console.warn('ML Analysis: No current well data available, attempting recovery...');
                
                // Try to recover well data from modal context
                const modalWellKey = window.currentModalWellKey;
                if (modalWellKey && currentAnalysisResults && currentAnalysisResults.individual_results) {
                    const wellResult = currentAnalysisResults.individual_results[modalWellKey];
                    if (wellResult) {
                        console.log('ML Analysis: Recovered well data from modal context');
                        this.setCurrentWell(modalWellKey, wellResult);
                        // Wait a moment for the data to be set properly
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }
                
                // Final check - if still no data, give up
                if (!this.currentWellData) {
                    console.error('ML Analysis: No curve data available for analysis');
                    console.warn('ML Analysis: Skipping analysis - no curve data available');
                    return;
                }
            }

            console.log('ML Analysis: Starting analysis for well:', this.currentWellKey);
            console.log('ML Analysis: Current well data keys:', Object.keys(this.currentWellData));
            // Get channel-specific pathogen information with enhanced validation
            const channelData = this.extractChannelSpecificPathogen();
            
            // Multiple fallback strategies for pathogen detection
            let finalPathogen = channelData.pathogen;
            
            if (!finalPathogen || finalPathogen === 'Unknown') {
                // Try alternative pathogen sources
                finalPathogen = this.currentWellData.target || 
                               this.currentWellData.specific_pathogen ||
                               this.currentWellData.pathogen ||
                               channelData.testCode ||
                               channelData.channel ||
                               'General_PCR';
                
                console.warn('ML Analysis: Using fallback pathogen:', finalPathogen);
            }
            
            // Validate we have the required raw data - RFU and Cycles are essential for ML analysis
            const rawRfu = this.currentWellData.raw_rfu || 
                          this.currentWellData.rfu_data || 
                          this.currentWellData.rfu ||
                          [];
            const rawCycles = this.currentWellData.raw_cycles || 
                             this.currentWellData.cycles || 
                             this.currentWellData.cycle_data ||
                             [];
            
            if (!rawRfu || !rawCycles || rawRfu.length === 0 || rawCycles.length === 0) {
                //console.error('ML Analysis: Missing or empty raw curve data');
                //console.error('ML Analysis: Available well data keys:', Object.keys(this.currentWellData));
                //console.error('ML Analysis: RFU data:', rawRfu ? `Array length ${rawRfu.length}` : 'null/undefined');
                //console.error('ML Analysis: Cycles data:', rawCycles ? `Array length ${rawCycles.length}` : 'null/undefined');
                
                // Log warning instead of showing alert popup
                //console.warn('ML Analysis: Skipping analysis - missing raw curve data');
                return; // Exit gracefully without throwing error
            }
            
            //console.log('ML Analysis: Raw data validation passed - RFU points:', rawRfu.length, 'Cycles:', rawCycles.length);
            
            // Comprehensive well data for analysis
            const wellData = {
                well: this.currentWellData.well_id || this.currentWellKey.split('_')[0] || this.currentWellKey,
                target: finalPathogen,
                specific_pathogen: finalPathogen,
                pathogen: finalPathogen,
                sample: this.currentWellData.sample || this.currentWellData.sample_name || 'Unknown_Sample',
                classification: this.currentWellData.classification || 'UNKNOWN',
                channel: channelData.channel || this.currentWellData.channel || this.currentWellData.fluorophore || 'Unknown_Channel',
                fluorophore: channelData.channel || this.currentWellData.fluorophore || this.currentWellData.channel || 'Unknown_Fluorophore',
                experiment_pattern: channelData.experimentPattern || channelData.testCode || this.currentWellData.experiment_pattern || '',
                test_code: channelData.testCode || this.currentWellData.test_code || ''
            };
            
            console.log('ML Analysis: Comprehensive well data:', wellData);

            const response = await fetch('/api/ml-analyze-curve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rfu_data: rawRfu,
                    cycles: rawCycles,
                    well_data: wellData,
                    session_id: window.currentSessionId || this.currentWellData.session_id || null, // Add session_id for persistence
                    well_id: this.currentWellKey, // Add well_id for database lookup
                    existing_metrics: {
                        r2: this.currentWellData.r2_score || 0,
                        steepness: this.currentWellData.steepness || 0,
                        snr: this.currentWellData.snr || 0,
                        midpoint: this.currentWellData.midpoint || 0,
                        baseline: this.currentWellData.baseline || 0,
                        amplitude: this.currentWellData.amplitude || 0,
                        // Extract numeric values from CQJ/CalcJ dictionaries
                        cqj: this.extractNumericValue(this.currentWellData.cqj, channelData.channel),
                        calcj: this.extractNumericValue(this.currentWellData.calcj, channelData.channel),
                        classification: this.currentWellData.classification || 'UNKNOWN'
                    },
                    is_batch_request: false  // Mark as individual request to bypass batch cancellation
                })
            });

            if (response.ok) {
                const result = await response.json();
                //console.log('ML Analysis: Received response:', result);
                //console.log('ML Analysis: Features used CQJ:', result.prediction?.features_used?.cqj);
                //console.log('ML Analysis: Features used CalcJ:', result.prediction?.features_used?.calcj);
                // Store ML classification in well data
                if (result.success && result.prediction) {
                    this.currentWellData.ml_classification = result.prediction;
                    // CRITICAL FIX: Display the ML results after successful analysis
                    this.displayMLResults(result);
                } else {
                    throw new Error(result.error || 'ML analysis failed');
                }
            } else {
                throw new Error(`Server error: ${response.status}`);
            }

        } catch (error) {
            console.error('ML analysis error:', error);
            console.warn('ML Analysis failed:', error.message);
        } finally {
            // Restore button state properly
            if (analyzeBtn) {
                if (originalButtonState) {
                    analyzeBtn.disabled = originalButtonState.disabled;
                    analyzeBtn.textContent = originalButtonState.textContent;
                } else {
                    analyzeBtn.disabled = false;
                    analyzeBtn.textContent = '🔍 Analyze with ML';
                }
            }
        }
    }

    displayMLResults(result) {
        const prediction = result.prediction;
        
        // Add validation for prediction data
        if (!prediction || !prediction.classification || prediction.confidence === undefined) {
            console.error('ML Feedback Interface: Invalid prediction data received:', prediction);
            return;
        }
        
        // CRITICAL: Store the original ML prediction for comparison later
        if (this.currentWellData && !this.currentWellData.original_ml_prediction) {
            this.currentWellData.original_ml_prediction = prediction.classification;
            console.log('📊 Stored original ML prediction:', prediction.classification);
        }
        
        const predictionDisplay = document.getElementById('ml-prediction-display');
        const classElement = document.getElementById('ml-prediction-class');
        const confidenceElement = document.getElementById('ml-prediction-confidence');
        const methodElement = document.getElementById('ml-prediction-method');
        const pathogenElement = document.getElementById('detected-pathogen');
        const pathogenContext = document.getElementById('pathogen-context');
        const feedbackBtn = document.getElementById('ml-feedback-btn');
        const cqjCalcjDisplay = document.getElementById('cqj-calcj-display');

        if (predictionDisplay && classElement && confidenceElement) {
            predictionDisplay.style.display = 'block';
            
            classElement.textContent = prediction.classification.replace('_', ' ');
            classElement.className = `classification-badge ${this.getClassificationBadgeClass(prediction.classification)}`;
            
            confidenceElement.textContent = `(${(prediction.confidence * 100).toFixed(1)}% confidence)`;
            methodElement.textContent = prediction.method || 'ML';
            
            if (prediction.pathogen && pathogenElement && pathogenContext) {
                pathogenElement.textContent = prediction.pathogen;
                pathogenContext.style.display = 'block';
            } else if (pathogenContext) {
                pathogenContext.style.display = 'none';
            }
            
            // Show CQJ/CalcJ metrics if available and valid for this specific sample
            if (prediction.features_used && (prediction.features_used.cqj || prediction.features_used.calcj)) {
                const cqjElement = document.getElementById('metric-cqj');
                const calcjElement = document.getElementById('metric-calcj');
                
                if (cqjElement && calcjElement && cqjCalcjDisplay) {
                    // Only show CQJ/CalcJ if they are meaningful values from the current sample
                    // If the original sample shows N/A, display N/A here too
                    let cqjValue = '-';
                    let calcjValue = '-';
                    
                    // Check if the original well data has valid CQJ/CalcJ values
                    if (this.currentWellData && this.currentWellData.cqj && this.currentWellData.cqj > 0) {
                        cqjValue = prediction.features_used.cqj ? prediction.features_used.cqj.toFixed(2) : '-';
                    }
                    
                    if (this.currentWellData && this.currentWellData.calcj && this.currentWellData.calcj > 0) {
                        calcjValue = prediction.features_used.calcj ? prediction.features_used.calcj.toExponential(2) : '-';
                    }
                    
                    cqjElement.textContent = cqjValue;
                    calcjElement.textContent = calcjValue;
                    cqjCalcjDisplay.style.display = 'block';
                }
            }
            
            if (feedbackBtn) {
                feedbackBtn.style.display = 'inline-block';
            }
            
            // Update the results table with the ML prediction
            this.updateTableCellWithMLPrediction(this.currentWellKey, prediction);
        }
        
        // Force update visual curve analysis when ML results are displayed
        console.log('🔍 ML Debug: Updating visual curve analysis for ML results display');
        this.updateVisualCurveDisplay(this.currentWellData);
        
        // Check for classification conflicts
        this.checkClassificationConflict(prediction);
        
        // Ensure visual analysis is visible
        const visualDisplay = document.getElementById('visual-curve-display');
        if (visualDisplay) {
            visualDisplay.style.display = 'block';
            console.log('🔍 ML Debug: Visual curve analysis made visible');
        } else {
            console.warn('🔍 ML Debug: Visual curve display element not found');
        }
    }

    getClassificationBadgeClass(classification) {
        const classMap = {
            'STRONG_POSITIVE': 'strong-positive',
            'POSITIVE': 'positive',
            'WEAK_POSITIVE': 'weak-positive',
            'NEGATIVE': 'negative',
            'INDETERMINATE': 'indeterminate',
            'REDO': 'redo',
            'SUSPICIOUS': 'suspicious'
        };
        return classMap[classification] || 'other';
    }

    // ===== CLASSIFICATION CONFLICT DETECTION AND EXPERT REVIEW =====

    checkClassificationConflict(mlPrediction) {
        if (!this.currentWellData || !mlPrediction) {
            return;
        }

        // Only show conflicts after the ML model has sufficient training
        const minTrainingSamples = 50; // Minimum samples before conflicts are shown
        const minConfidence = 0.7; // Minimum ML confidence to suggest conflicts
        
        if (!this.mlStats || this.mlStats.training_samples < minTrainingSamples) {
            console.log(`🔍 Conflict detection disabled: Only ${this.mlStats?.training_samples || 0} training samples (need ${minTrainingSamples})`);
            // Hide conflict display - not enough training yet
            const conflictDisplay = document.getElementById('classification-conflict');
            if (conflictDisplay) {
                conflictDisplay.style.display = 'none';
            }
            return;
        }

        // Only show conflicts for high-confidence ML predictions
        if (mlPrediction.confidence < minConfidence) {
            console.log(`🔍 Conflict detection skipped: ML confidence ${(mlPrediction.confidence * 100).toFixed(1)}% < ${(minConfidence * 100)}% threshold`);
            const conflictDisplay = document.getElementById('classification-conflict');
            if (conflictDisplay) {
                conflictDisplay.style.display = 'none';
            }
            return;
        }

        const ruleBasedClass = this.currentWellData.classification;
        const mlClass = mlPrediction.classification;
        
        // Check if there's a conflict between rule-based and ML classifications
        if (ruleBasedClass && mlClass && ruleBasedClass !== mlClass) {
            console.log(`🔍 Classification Conflict: Rule-based="${ruleBasedClass}" vs ML="${mlClass}" (${this.mlStats.training_samples} samples, ${(mlPrediction.confidence * 100).toFixed(1)}% confidence)`);
            this.showClassificationConflict(ruleBasedClass, mlPrediction);
        } else {
            // Hide conflict display if no conflict
            const conflictDisplay = document.getElementById('classification-conflict');
            if (conflictDisplay) {
                conflictDisplay.style.display = 'none';
            }
        }
    }

    showClassificationConflict(ruleBasedClass, mlPrediction) {
        const conflictDisplay = document.getElementById('classification-conflict');
        const ruleClassElement = document.getElementById('rule-based-class');
        const mlConflictClassElement = document.getElementById('ml-conflict-class');
        const conflictConfidenceElement = document.getElementById('conflict-confidence');

        if (conflictDisplay && ruleClassElement && mlConflictClassElement && conflictConfidenceElement) {
            // Update conflict display
            ruleClassElement.textContent = ruleBasedClass.replace('_', ' ');
            ruleClassElement.className = `classification-badge ${this.getClassificationBadgeClass(ruleBasedClass)}`;
            
            mlConflictClassElement.textContent = mlPrediction.classification.replace('_', ' ');
            mlConflictClassElement.className = `classification-badge ${this.getClassificationBadgeClass(mlPrediction.classification)}`;
            
            conflictConfidenceElement.textContent = `${(mlPrediction.confidence * 100).toFixed(1)}%`;
            
            // Show the conflict alert
            conflictDisplay.style.display = 'block';
            
            console.log('🔍 Classification conflict display shown');
        }
    }

    async approveMLClassification() {
        if (!this.currentWellData || !this.currentWellData.ml_classification) {
            console.error('No ML classification to approve');
            return;
        }

        const mlClass = this.currentWellData.ml_classification.classification;
        console.log(`✅ Expert approved ML classification: ${mlClass}`);

        try {
            // Update the rule-based classification to match ML
            await this.updateWellClassification(mlClass, 'expert_approved_ml');
            
            // Log the expert decision
            await this.logExpertDecision('approve_ml', {
                well_id: this.currentWellKey,
                original_rule_class: this.currentWellData.classification,
                approved_ml_class: mlClass,
                ml_confidence: this.currentWellData.ml_classification.confidence,
                pathogen: this.currentWellData.ml_classification.pathogen
            });

            this.showTrainingNotification(
                'ML Classification Approved',
                `✅ Expert approved ML prediction: ${mlClass.replace('_', ' ')}`,
                'success'
            );

            // Hide conflict display
            const conflictDisplay = document.getElementById('classification-conflict');
            if (conflictDisplay) {
                conflictDisplay.style.display = 'none';
            }

        } catch (error) {
            console.error('Error approving ML classification:', error);
            alert(`Failed to approve ML classification: ${error.message}`);
        }
    }

    async keepRuleBasedClassification() {
        if (!this.currentWellData) {
            console.error('No well data available');
            return;
        }

        const ruleClass = this.currentWellData.classification;
        const mlClass = this.currentWellData.ml_classification?.classification;
        
        console.log(`📋 Expert kept rule-based classification: ${ruleClass}`);

        try {
            // Log the expert decision to keep rule-based
            await this.logExpertDecision('keep_rule_based', {
                well_id: this.currentWellKey,
                kept_rule_class: ruleClass,
                rejected_ml_class: mlClass,
                ml_confidence: this.currentWellData.ml_classification?.confidence,
                pathogen: this.currentWellData.ml_classification?.pathogen
            });

            // Add this as negative feedback for ML training
            await this.submitNegativeMLFeedback(ruleClass);

            this.showTrainingNotification(
                'Rule-Based Classification Kept',
                `📋 Expert kept rule-based: ${ruleClass.replace('_', ' ')}`,
                'info'
            );

            // Hide conflict display
            const conflictDisplay = document.getElementById('classification-conflict');
            if (conflictDisplay) {
                conflictDisplay.style.display = 'none';
            }

        } catch (error) {
            console.error('Error keeping rule-based classification:', error);
            alert(`Failed to keep rule-based classification: ${error.message}`);
        }
    }

    async flagForExpertReview() {
        if (!this.currentWellData) {
            console.error('No well data available');
            return;
        }

        const ruleClass = this.currentWellData.classification;
        const mlClass = this.currentWellData.ml_classification?.classification;
        
        console.log(`👨‍⚕️ Flagged for expert review: Rule="${ruleClass}" vs ML="${mlClass}"`);

        try {
            // Log the expert review request
            await this.logExpertDecision('needs_expert_review', {
                well_id: this.currentWellKey,
                rule_class: ruleClass,
                ml_class: mlClass,
                ml_confidence: this.currentWellData.ml_classification?.confidence,
                pathogen: this.currentWellData.ml_classification?.pathogen,
                review_status: 'pending'
            });

            this.showTrainingNotification(
                'Flagged for Expert Review',
                `👨‍⚕️ Well ${this.currentWellKey} flagged for expert review`,
                'warning'
            );

            // Keep conflict display visible but update styling
            const conflictDisplay = document.getElementById('classification-conflict');
            if (conflictDisplay) {
                conflictDisplay.style.border = '2px solid #ff9800';
                conflictDisplay.style.backgroundColor = '#fff3e0';
            }

        } catch (error) {
            console.error('Error flagging for expert review:', error);
            alert(`Failed to flag for expert review: ${error.message}`);
        }
    }

    async updateWellClassification(newClassification, reason) {
        try {
            console.log('🔄 WELL-UPDATE: Starting well classification update:', {
                wellKey: this.currentWellKey,
                newClassification,
                reason,
                sessionId: window.currentSessionId || this.currentWellData?.session_id
            });
            
            // CRITICAL: Normalize well key to handle duplicated channels (A1_FAM_FAM -> A1_FAM)
            const normalizedWellKey = this.normalizeWellKey(this.currentWellKey);
            console.log('🔧 WELL-UPDATE: Using normalized well key for backend:', {
                original: this.currentWellKey,
                normalized: normalizedWellKey,
                wasModified: normalizedWellKey !== this.currentWellKey
            });
            
            const response = await fetch('/api/update-well-classification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    well_id: normalizedWellKey, // Use normalized key for backend
                    session_id: window.currentSessionId || this.currentWellData?.session_id || null,
                    new_classification: newClassification,
                    reason: reason,
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const result = await response.json();
            if (result.success) {
                console.log('✅ WELL-UPDATE: Backend update successful');
                
                // Update local data
                this.currentWellData.classification = newClassification;
                
                // CRITICAL: Update curve_classification data for modal to recognize expert feedback
                this.currentWellData.curve_classification = {
                    classification: newClassification,
                    method: 'expert_feedback',
                    confidence: 1.0,
                    timestamp: new Date().toISOString(),
                    expert_decision_type: reason === 'expert_feedback' ? 'Expert Decision' : 'Other'
                };
                
                // CRITICAL: Store expert feedback in session storage for fresh upload recovery
                const sessionKey = `expert_feedback_${this.currentWellKey}`;
                const expertFeedbackData = {
                    classification: newClassification,
                    method: 'Expert Review',
                    confidence: 1.0,
                    expert_review_method: 'ml_feedback_interface',
                    timestamp: new Date().toISOString(),
                    wellKey: this.currentWellKey
                };
                try {
                    sessionStorage.setItem(sessionKey, JSON.stringify(expertFeedbackData));
                    console.log('💾 STORAGE: Saved expert feedback to session storage for fresh upload recovery');
                } catch (e) {
                    console.warn('⚠️ STORAGE: Failed to save expert feedback to session storage:', e);
                }
                
                console.log('🔍 FEEDBACK-UPDATE: Set curve_classification data:', this.currentWellData.curve_classification);
                
                // Update global analysis results if available
                if (window.currentAnalysisResults && window.currentAnalysisResults.individual_results) {
                    const globalWellData = window.currentAnalysisResults.individual_results[this.currentWellKey];
                    if (globalWellData) {
                        console.log('🔄 WELL-UPDATE: Updating global well data...');
                        
                        globalWellData.classification = newClassification;
                        // CRITICAL: Also update curve_classification in global data
                        globalWellData.curve_classification = {
                            classification: newClassification,
                            method: 'expert_feedback',
                            confidence: 1.0,
                            timestamp: new Date().toISOString(),
                            expert_decision_type: reason === 'expert_feedback' ? 'Expert Decision' : 'Other'
                        };
                        
                        console.log('✅ WELL-UPDATE: Updated global curve_classification for', this.currentWellKey, ':', globalWellData.curve_classification);
                    } else {
                        console.warn('⚠️ WELL-UPDATE: Global well data not found for key:', this.currentWellKey);
                    }
                } else {
                    console.warn('⚠️ WELL-UPDATE: No global analysis results available - attempting recovery');
                    // Try to create/recover the global data structure
                    this.createOrRecoverGlobalResults(newClassification);
                }
                
                console.log(`✅ Well classification updated to: ${newClassification}`);
            } else {
                throw new Error(result.error || 'Failed to update classification');
            }

        } catch (error) {
            console.error('Error updating well classification:', error);
            throw error;
        }
    }

    async logExpertDecision(decisionType, decisionData) {
        try {
            const response = await fetch('/api/log-expert-decision', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    decision_type: decisionType,
                    decision_data: decisionData,
                    timestamp: new Date().toISOString(),
                    user_agent: navigator.userAgent
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to log expert decision: ${response.status}`);
            }

            const result = await response.json();
            console.log(`📝 Expert decision logged: ${decisionType}`, result);

        } catch (error) {
            console.error('Error logging expert decision:', error);
            // Don't throw - logging failures shouldn't block the main operation
        }
    }

    async submitNegativeMLFeedback(correctClassification) {
        // Submit the rule-based classification as negative feedback for the ML model
        try {
            const channelData = this.extractChannelSpecificPathogen();
            const rawRfu = this.currentWellData.raw_rfu || this.currentWellData.rfu_data || [];
            const rawCycles = this.currentWellData.raw_cycles || this.currentWellData.cycles || [];

            if (!rawRfu.length || !rawCycles.length) {
                console.warn('Cannot submit negative feedback - missing raw data');
                return;
            }

            const response = await fetch('/api/ml-submit-feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rfu_data: rawRfu,
                    cycles: rawCycles,
                    well_data: {
                        well: this.currentWellData.well_id || this.currentWellKey,
                        target: channelData.pathogen,
                        sample: this.currentWellData.sample || 'Unknown_Sample',
                        classification: correctClassification,
                        channel: channelData.channel
                    },
                    expert_classification: correctClassification,
                    well_id: this.currentWellKey,
                    feedback_type: 'expert_correction',
                    existing_metrics: {
                        r2: this.currentWellData.r2_score || 0,
                        steepness: this.currentWellData.steepness || 0,
                        snr: this.currentWellData.snr || 0,
                        amplitude: this.currentWellData.amplitude || 0,
                        cqj: this.extractNumericValue(this.currentWellData.cqj),
                        calcj: this.extractNumericValue(this.currentWellData.calcj)
                    }
                })
            });

            if (response.ok) {
                console.log(`✅ Negative feedback submitted for ML correction: ${correctClassification}`);
            }

        } catch (error) {
            console.error('Error submitting negative ML feedback:', error);
        }
    }

    showFeedbackForm() {
        const feedbackForm = document.getElementById('ml-feedback-form');
        const currentClassElement = document.getElementById('current-classification');
        
        if (feedbackForm) {
            feedbackForm.style.display = 'block';
            console.log('ML Feedback Interface: Feedback form displayed');
        } else {
            console.error('ML Feedback Interface: Feedback form not found!');
            // Try to re-add the ML section if the form is missing
            this.addMLSectionToModal();
            setTimeout(() => {
                const retryForm = document.getElementById('ml-feedback-form');
                if (retryForm) {
                    retryForm.style.display = 'block';
                    console.log('ML Feedback Interface: Feedback form displayed after retry');
                }
            }, 100);
        }
        
        if (currentClassElement && this.currentWellData && this.currentWellData.ml_classification) {
            currentClassElement.textContent = this.currentWellData.ml_classification.classification.replace('_', ' ');
        }
    }

    hideFeedbackForm() {
        const feedbackForm = document.getElementById('ml-feedback-form');
        if (feedbackForm) {
            feedbackForm.style.display = 'none';
        }
        
        // Clear radio button selections
        const radioButtons = document.querySelectorAll('input[name="expert-classification"]');
        radioButtons.forEach(radio => radio.checked = false);
    }

    /**
     * Rebuild modal navigation after feedback updates to prevent result table issues
     */
    rebuildModalNavigationAfterUpdate() {
        try {
            console.log('🔄 NAVIGATION: Rebuilding modal navigation after feedback update');
            
            const modal = document.getElementById('chartModal');
            if (modal && modal.style.display !== 'none') {
                // Method 1: Call the main rebuild function if available
                if (window.buildModalNavigationList && typeof window.buildModalNavigationList === 'function') {
                    window.buildModalNavigationList();
                    console.log('✅ NAVIGATION: Modal navigation list rebuilt');
                    
                    // Also update navigation buttons
                    if (window.updateNavigationButtons && typeof window.updateNavigationButtons === 'function') {
                        window.updateNavigationButtons();
                        console.log('✅ NAVIGATION: Navigation buttons updated');
                    }
                } else {
                    console.warn('⚠️ NAVIGATION: buildModalNavigationList function not available');
                }
                
                // Method 2: Trigger a custom event for navigation rebuild
                window.dispatchEvent(new CustomEvent('modalNavigationNeedsRebuild', {
                    detail: { 
                        reason: 'expert_feedback_submitted', 
                        wellKey: this.currentWellKey,
                        timestamp: new Date().toISOString()
                    }
                }));
                
            } else {
                console.log('🔍 NAVIGATION: Modal not open, skipping navigation rebuild');
            }
        } catch (error) {
            console.error('❌ NAVIGATION: Error rebuilding modal navigation:', error);
        }
    }

    /**
     * Ensure session ID is always available for database persistence
     */
    ensureSessionIdAvailable(wellData = null) {
        // Try multiple sources for session ID
        let sessionId = window.currentSessionId;
        
        if (!sessionId) {
            // Try from analysis results
            if (window.currentAnalysisResults && window.currentAnalysisResults.session_id) {
                sessionId = window.currentAnalysisResults.session_id;
                window.currentSessionId = sessionId; // Cache it
            }
        }
        
        if (!sessionId && wellData) {
            // Try from well data
            sessionId = wellData.session_id;
        }
        
        if (!sessionId) {
            // Generate a session ID based on current timestamp and context
            const timestamp = new Date().toISOString().replace(/[:.]/g, '');
            const context = this.currentWellKey ? this.currentWellKey.split('_')[0] : 'unknown';
            sessionId = `expert_feedback_${context}_${timestamp}`;
            window.currentSessionId = sessionId; // Cache the generated ID
        }
        
        console.log('🔧 PERSISTENCE: Ensured session ID available:', sessionId);
        return sessionId;
    }

    async submitFeedback() {
        // Check if batch ML analysis is currently running
        const batchRunning = document.getElementById('ml-available-notification') !== null;
        if (batchRunning) {
            alert('⚠️ Batch ML analysis is currently running. Please wait for it to complete before submitting feedback to avoid database conflicts.');
            return;
        }

        // Prevent multiple simultaneous submissions
        if (this.submissionInProgress) {
            console.log('ML Feedback: Submission already in progress, ignoring duplicate request');
            alert('⚠️ Feedback submission already in progress. Please wait for the current submission to complete.');
            return;
        }
        
        const selectedRadio = document.querySelector('input[name="expert-classification"]:checked');
        if (!selectedRadio) {
            alert('Please select a classification before submitting feedback.');
            return;
        }

        // Check if this sample has already been trained
        const alreadyTrained = await this.checkIfSampleAlreadyTrained();
        if (alreadyTrained) {
            const fullSampleName = this.extractFullSampleName();
            const pathogen = this.extractChannelSpecificPathogen().pathogen;
            const channel = this.extractChannelSpecificPathogen().channel;
            
            const shouldRetrain = confirm(
                `🚫 Duplicate Training Detected\n\n` +
                `This sample has already been used for ML training:\n\n` +
                `Sample: ${fullSampleName}\n` +
                `Pathogen: ${pathogen}\n` +
                `Channel: ${channel}\n\n` +
                `Training the same sample multiple times can reduce model accuracy.\n\n` +
                `Would you like to retrain anyway?\n` +
                `(Note: This will overwrite the previous training for this sample)`
            );
            
            if (!shouldRetrain) {
                //console.log('🚫 ML Feedback: User cancelled duplicate sample training');
                this.submissionInProgress = false; // Reset flag
                return;
            }
            
            //console.log('⚠️ ML Feedback: User approved retraining duplicate sample');
        }

        // Set submission flag
        this.submissionInProgress = true;

        // Enhanced well data recovery - try multiple sources
        let wellKey = this.currentWellKey;
        let wellData = this.currentWellData;
        
        // If our stored data is null, try to recover from DOM or global state
        if (!wellData || !wellKey) {
            console.warn('ML Feedback: Current well data is null, attempting recovery...');
            
            // Try to get well key from modal or global state
            wellKey = wellKey || window.currentModalWellKey || window.currentWellKey;
            
            // Try to get well data from global analysis results
            if (wellKey && window.currentAnalysisResults && window.currentAnalysisResults.individual_results) {
                wellData = window.currentAnalysisResults.individual_results[wellKey];
                if (wellData) {
                    console.log('ML Feedback: Successfully recovered well data from global state');
                    // Update our instance variables
                    this.currentWellKey = wellKey;
                    this.currentWellData = JSON.parse(JSON.stringify(wellData));
                }
            }
        }

        // Final validation
        if (!wellData || !wellKey) {
            console.error('ML Feedback: Unable to recover well data - wellData:', wellData, 'wellKey:', wellKey);
            console.error('ML Feedback: Available global data:', {
                currentModalWellKey: window.currentModalWellKey,
                currentWellKey: window.currentWellKey,
                hasAnalysisResults: !!(window.currentAnalysisResults && window.currentAnalysisResults.individual_results)
            });
            alert('No well data available for feedback submission. Please select a well first and try again.');
            return;
        }

        const expertClassification = selectedRadio.value;
        const submitBtn = document.getElementById('submit-feedback-btn');
        
        // Show loading state but don't disable button (duplicate check popup is sufficient)
        if (submitBtn) {
            submitBtn.textContent = '⏳ Submitting...';
        }

        try {
            // Get channel-specific pathogen information with enhanced validation
            const channelData = this.extractChannelSpecificPathogen(wellData);
            
            // Multiple fallback strategies for pathogen detection
            let finalPathogen = channelData.pathogen;
            
            if (!finalPathogen || finalPathogen === 'Unknown') {
                // Try alternative pathogen sources from recovered well data
                finalPathogen = wellData.target || 
                               wellData.specific_pathogen ||
                               wellData.pathogen ||
                               channelData.testCode ||
                               channelData.channel ||
                               'General_PCR';
                
                console.warn('ML Feedback: Using fallback pathogen:', finalPathogen);
            }
            
            // Validate we have the required raw data with multiple field names
            const rawRfu = wellData.raw_rfu || 
                          wellData.rfu_data || 
                          wellData.rfu ||
                          [];
            const rawCycles = wellData.raw_cycles || 
                             wellData.cycles || 
                             wellData.cycle_data ||
                             [];
            
            if (!rawRfu || !rawCycles || rawRfu.length === 0 || rawCycles.length === 0) {
                console.error('ML Feedback: Missing or empty raw data - RFU:', rawRfu, 'Cycles:', rawCycles);
                throw new Error('Missing raw RFU or cycle data for feedback submission');
            }
            
            // Construct comprehensive well data object with all possible fields
            const submissionWellData = {
                well: wellData.well_id || wellKey.split('_')[0] || wellKey,
                target: finalPathogen, // Primary pathogen field
                specific_pathogen: finalPathogen, // Channel-specific pathogen
                pathogen: finalPathogen, // General pathogen field
                sample: this.extractFullSampleName(), // Use the full sample name from modal
                classification: wellData.classification || 'UNKNOWN',
                channel: channelData.channel || wellData.channel || wellData.fluorophore || 'Unknown_Channel',
                fluorophore: channelData.channel || wellData.fluorophore || wellData.channel || 'Unknown_Fluorophore',
                experiment_pattern: channelData.experimentPattern || channelData.testCode || wellData.experiment_pattern || '',
                test_code: channelData.testCode || wellData.test_code || ''
            };
            
            console.log('ML Feedback: Comprehensive well data:', submissionWellData);

            const response = await fetch('/api/ml-submit-feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rfu_data: rawRfu,
                    cycles: rawCycles,
                    well_data: submissionWellData,
                    expert_classification: expertClassification,
                    well_id: wellKey,
                    session_id: this.ensureSessionIdAvailable(wellData), // Add session_id for persistence
                    existing_metrics: {
                        r2: wellData.r2_score || 0,
                        steepness: wellData.steepness || 0,
                        snr: wellData.snr || 0,
                        midpoint: wellData.midpoint || 0,
                        baseline: wellData.baseline || 0,
                        amplitude: wellData.amplitude || 0,
                        cqj: this.extractNumericValue(wellData.cqj),
                        calcj: this.extractNumericValue(wellData.calcj),
                        classification: wellData.classification || 'UNKNOWN'
                    }
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // Mark this sample as trained to prevent future duplicates
                    this.markSampleAsTrained();
                    
                    // Track this prediction for validation
                    await this.trackPredictionForValidation(wellData, expertClassification, submissionWellData);
                    
                    // CRITICAL: FIRST persist the expert classification to both local and backend data
                    await this.updateWellClassification(expertClassification, 'expert_feedback');
                    
                    // CRITICAL FIX: Persist to session state for page refresh persistence
                    await this.updateWellState(this.currentWellKey, {
                        classification: expertClassification,
                        method: 'expert_feedback',
                        expert_classification: expertClassification
                    });
                    
                    // IMMEDIATE: Update the UI elements to show the expert classification
                    this.updateUIWithExpertClassification(expertClassification);
                    
                    // THEN update the results table with the expert classification
                    await this.updateResultsTableAfterFeedback(expertClassification);
                    
                    // CRITICAL FIX: Add a delay to ensure data propagation AND table refresh complete
                    setTimeout(() => {
                        console.log('🔄 MODAL-REFRESH: About to refresh modal after expert feedback');
                        console.log('🔍 MODAL-REFRESH: Current well curve_classification:', this.currentWellData?.curve_classification);
                        
                        // CRITICAL: Rebuild navigation AFTER table refresh is complete
                        console.log('🔄 NAVIGATION: Rebuilding navigation after table refresh complete');
                        this.rebuildModalNavigationAfterUpdate();
                        
                        // Refresh the modal to show expert feedback (data is now updated)
                        this.refreshModalAfterFeedback(expertClassification);
                        
                        // Refresh the ML display to show expert classification
                        this.refreshMLDisplayInModal();
                        
                        console.log('✅ MODAL-REFRESH: Modal refresh completed');
                    }, 800); // Increased delay to ensure table refresh completes first
                    
                    // Use non-blocking notification instead of alert
                    this.showTrainingNotification(
                        'Feedback Submitted!',
                        `✅ Successfully submitted feedback. Training samples: ${result.training_samples}`,
                        'success'
                    );
                    this.hideFeedbackForm();
                    
                    // Update the display immediately with the returned count
                    const trainingSamplesElement = document.getElementById('stat-training-samples');
                    if (trainingSamplesElement && result.training_samples) {
                        trainingSamplesElement.textContent = result.training_samples;
                    }
                    
                    // Also fetch full stats to update everything else
                    await this.updateMLStats();
                    
                    // Enhanced ML Training Strategy - handle this after a small delay
                    // to prevent popup conflicts
                    setTimeout(async () => {
                        await this.handleTrainingMilestone(result.training_samples);
                    }, 1000);
                    
                    // Automatic batch re-evaluation for similar wells
                    // Run this after training milestone handling
                    setTimeout(async () => {
                        await this.executeAutomaticBatchReEvaluation(
                            wellKey,
                            wellData,
                            expertClassification
                        );
                    }, 2000);
                } else {
                    throw new Error(result.error || 'Feedback submission failed');
                }
            } else {
                throw new Error(`Server error: ${response.status}`);
            }

        } catch (error) {
            console.error('Feedback submission error:', error);
            
            // Check if this is a database connectivity issue
            const isDbConnectivityIssue = error.message && (
                error.message.includes('MySQL') || 
                error.message.includes('database') ||
                error.message.includes('connection') ||
                error.message.includes('ECONNREFUSED') ||
                error.message.includes('timeout') ||
                error.message.includes('503') ||
                error.message.includes('Server error: 503')
            );
            
            if (isDbConnectivityIssue) {
                this.showTrainingNotification(
                    '🔌 Database Connection Issue',
                    `❌ MySQL database is not properly initialized or connected. ` +
                    `Please run: python3 initialize_mysql_tables.py`,
                    'error',
                    8000 // Longer display time for important message
                );
                
                // Also show detailed error in console
                console.error('🔌 DATABASE CONNECTIVITY ERROR:', {
                    error: error.message,
                    requiredTables: ['ml_expert_decisions', 'ml_prediction_tracking', 'ml_model_versions'],
                    solution: 'Run initialize_mysql_tables.py to create missing MySQL tables',
                    note: 'SQLite support has been permanently removed - MySQL required'
                });
            } else {
                this.showTrainingNotification(
                    'Feedback Failed',
                    `❌ Error: ${error.message}`,
                    'error'
                );
            }
        } finally {
            // Reset submission flag
            this.submissionInProgress = false;
            
            // Reset button text without disabling it
            if (submitBtn) {
                submitBtn.textContent = '✅ Submit Feedback';
                // Don't disable the button - let user submit again if needed
            }
        }
    }

    async handleTrainingMilestone(trainingCount) {
        console.log(`🎯 ML Training Milestone: ${trainingCount} samples`);
        
        // Check if learning messages are enabled before showing alerts
        const showMessages = await this.checkLearningMessagesEnabled();
        if (!showMessages) {
            console.log('ML learning messages disabled, skipping milestone notifications');
            return;
        }
        
        const isInitialTraining = trainingCount === 20;
        const isBatchMilestone = trainingCount > 20 && trainingCount % 20 === 0;
        
        if (isInitialTraining) {
            // First time model becomes useful (20 samples)
            const shouldAnalyze = confirm(
                `🎯 ML Model Initially Trained! (20 samples)\n\n` +
                `✅ Model is now ready for automatic predictions\n` +
                `🔄 Would you like to re-analyze all current samples with the trained model?\n\n` +
                `This will provide ML predictions for the entire current dataset.`
            );
            
            if (shouldAnalyze) {
                // Check for cancellation before starting batch analysis
                if (!this.isMLAnalysisCancelled() && window.mlAutoAnalysisUserChoice !== 'skipped') {
                    await this.performBatchMLAnalysis(trainingCount, 'initial');
                }
            }
            
            // Show future automation message
            this.showTrainingNotification(
                'Model Ready!',
                '🤖 Future runs will automatically use ML predictions from the start.',
                'success'
            );
            
        } else if (isBatchMilestone) {
            // Training batch milestone (every 20 samples)
            const shouldAnalyze = confirm(
                `🚀 ML Training Milestone! (${trainingCount} samples)\n\n` +
                `📈 Model has received ${trainingCount - 20} additional training samples\n` +
                `🔄 Would you like to re-analyze current samples with the improved model?\n\n` +
                `This will update predictions with the enhanced model.`
            );
            
            if (shouldAnalyze) {
                // Check for cancellation before starting batch analysis
                if (!this.isMLAnalysisCancelled() && window.mlAutoAnalysisUserChoice !== 'skipped') {
                    await this.performBatchMLAnalysis(trainingCount, 'milestone');
                }
            }
            
        } else if (trainingCount > 20) {
            // Individual training (not at milestone)
            this.showTrainingProgress(trainingCount);
        }
    }

    async performBatchMLAnalysis(trainingCount, analysisType) {
        //console.log(`🔄 Performing ${analysisType} batch ML analysis with ${trainingCount} training samples`);
        
        try {
            // Reset cancellation flag and notify server that new analysis is starting
            window.mlAutoAnalysisUserChoice = null;
            await this.resetBatchCancellationFlag();
            
            // Remove the notification that prompted this action
            const existingNotification = document.getElementById('ml-available-notification');
            if (existingNotification) {
                existingNotification.remove();
            }
            
            // Show actual progress notification now that analysis is starting
            this.showRunningAnalysisNotification(trainingCount, analysisType);
            
            // Get current analysis results
            console.log('🔍 ML Batch Analysis: Checking for analysis results...', {
                currentAnalysisResults: !!window.currentAnalysisResults,
                hasIndividualResults: !!(window.currentAnalysisResults?.individual_results),
                resultKeys: window.currentAnalysisResults ? Object.keys(window.currentAnalysisResults) : null,
                wellCount: window.currentAnalysisResults?.individual_results ? Object.keys(window.currentAnalysisResults.individual_results).length : 0,
                fullStructure: window.currentAnalysisResults ? JSON.stringify(Object.keys(window.currentAnalysisResults)) : 'null',
                sampleKeys: window.currentAnalysisResults ? Object.keys(window.currentAnalysisResults).slice(0, 5) : [],
                isMultiChannel: !!(window.currentAnalysisResults && Object.keys(window.currentAnalysisResults).some(key => key.includes('_')))
            });
            
            // Try multiple possible structures for analysis results
            let individualResults = null;
            
            if (window.currentAnalysisResults) {
                // Strategy 1: Standard structure with individual_results property
                if (window.currentAnalysisResults.individual_results) {
                    individualResults = window.currentAnalysisResults.individual_results;
                    console.log('✅ ML Batch Analysis: Found results in individual_results');
                }
                // Strategy 2: Direct results property
                else if (window.currentAnalysisResults.results) {
                    individualResults = window.currentAnalysisResults.results;
                    console.log('✅ ML Batch Analysis: Found results in results property');
                }
                // Strategy 3: Data property
                else if (window.currentAnalysisResults.data) {
                    individualResults = window.currentAnalysisResults.data;
                    console.log('✅ ML Batch Analysis: Found results in data property');
                }
                // Strategy 4: Direct object with well keys (A1, B2, etc.) OR multichannel keys (M14_FAM_FAM, etc.)
                else {
                    const keys = Object.keys(window.currentAnalysisResults);
                    // Look for well keys (single channel like A1, B2) or multichannel keys (M14_FAM_FAM, etc.)
                    const wellLikeKeys = keys.filter(k => /^[A-H]\d+$/.test(k) || /^[A-Z]\d+_[A-Z]+/.test(k));
                    if (wellLikeKeys.length > 0) {
                        individualResults = window.currentAnalysisResults;
                        console.log('✅ ML Batch Analysis: Found well keys directly in currentAnalysisResults', {
                            wellCount: wellLikeKeys.length,
                            sampleKeys: wellLikeKeys.slice(0, 3),
                            isMultichannel: wellLikeKeys.some(k => k.includes('_'))
                        });
                    } else {
                        // Strategy 5: Check for any nested structure that might contain well data
                        console.log('🔍 ML Batch Analysis: Exploring unknown structure:', {
                            topLevelKeys: Object.keys(window.currentAnalysisResults),
                            firstLevelTypes: Object.keys(window.currentAnalysisResults).map(key => ({
                                key, 
                                type: typeof window.currentAnalysisResults[key],
                                isObject: typeof window.currentAnalysisResults[key] === 'object',
                                hasSubKeys: typeof window.currentAnalysisResults[key] === 'object' ? Object.keys(window.currentAnalysisResults[key] || {}).length : 0
                            }))
                        });
                        
                        // Try to find nested well data by looking for objects with well-like properties
                        for (const [key, value] of Object.entries(window.currentAnalysisResults)) {
                            if (typeof value === 'object' && value !== null) {
                                const subKeys = Object.keys(value);
                                // Look for keys that might contain well data (well IDs like A1_FAM, M14_FAM_FAM, etc.)
                                if (subKeys.some(k => k.match(/^[A-P]?\d+(_[A-Z]+)*$/))) {
                                    individualResults = value;
                                    console.log(`✅ ML Batch Analysis: Found well data in .${key} structure`);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            
            if (!individualResults) {
                console.error('ML Batch Analysis: No analysis results available', {
                    currentAnalysisResults: !!window.currentAnalysisResults,
                    individualResults: !!(window.currentAnalysisResults?.individual_results),
                    resultsKeys: window.currentAnalysisResults ? Object.keys(window.currentAnalysisResults) : null,
                    totalKeys: window.currentAnalysisResults ? Object.keys(window.currentAnalysisResults).length : 0
                });
                
                // Try waiting a moment for results to be available (sometimes there's a timing issue)
                console.log('🔄 ML Batch Analysis: Waiting 2 seconds for analysis results...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Check again after waiting with all strategies
                if (window.currentAnalysisResults) {
                    if (window.currentAnalysisResults.individual_results) {
                        individualResults = window.currentAnalysisResults.individual_results;
                    } else if (window.currentAnalysisResults.results) {
                        individualResults = window.currentAnalysisResults.results;
                    } else if (window.currentAnalysisResults.data) {
                        individualResults = window.currentAnalysisResults.data;
                    } else {
                        const keys = Object.keys(window.currentAnalysisResults);
                        const wellLikeKeys = keys.filter(k => /^[A-H]\d+$/.test(k));
                        if (wellLikeKeys.length > 0) {
                            individualResults = window.currentAnalysisResults;
                        }
                    }
                }
                
                if (!individualResults) {
                    //console.error('ML Batch Analysis: Still no analysis results after waiting');
                    
                    // Try to show a user-friendly error
                    this.showTrainingNotification(
                        'Analysis Required',
                        '❌ Please run a regular qPCR analysis first before using ML batch analysis.',
                        'error'
                    );
                    
                    throw new Error('No current analysis results available for batch processing. Please run a regular analysis first.');
                } else {
                    //console.log('✅ ML Batch Analysis: Analysis results found after waiting');
                }
            }
            const wellKeys = Object.keys(individualResults);
            
            if (wellKeys.length === 0) {
                console.error('ML Batch Analysis: No wells found in analysis results');
                this.showTrainingNotification(
                    'No Wells Found',
                    '❌ No wells found in current analysis results.',
                    'error'
                );
                throw new Error('No wells found in current analysis results');
            }
            
            // EDGE CASE FILTERING: Only process wells that are edge cases
            console.log(`🎯 Filtering for edge cases from ${wellKeys.length} total wells...`);
            
            const edgeCaseWells = [];
            const confidentWells = [];
            
            for (const wellKey of wellKeys) {
                const wellData = individualResults[wellKey];
                const classification = wellData?.curve_classification;
                
                if (!classification) {
                    // No classification - treat as edge case
                    edgeCaseWells.push(wellKey);
                    continue;
                }
                
                // Check if this well should get ML analysis (edge case logic)
                const shouldApplyML = this.shouldApplyMLToWell(classification);
                
                if (shouldApplyML) {
                    edgeCaseWells.push(wellKey);
                    console.log(`🎯 Edge case: ${wellKey} - ${classification.classification} (${this.getEdgeCaseReason(classification)})`);
                } else {
                    confidentWells.push(wellKey);
                    console.log(`✅ Confident: ${wellKey} - ${classification.classification} (confidence: ${classification.confidence?.toFixed(2)}) - Skipping ML`);
                }
            }
            
            console.log(`📊 Edge case filtering complete:`);
            console.log(`  Total wells: ${wellKeys.length}`);
            console.log(`  Edge cases (will process): ${edgeCaseWells.length}`);
            console.log(`  Confident cases (skipping): ${confidentWells.length}`);
            console.log(`  Processing efficiency: ${confidentWells.length}/${wellKeys.length} wells skip ML computation`);
            
            if (edgeCaseWells.length === 0) {
                console.log('🎉 No edge cases found - all wells have confident classifications!');
                this.showTrainingNotification(
                    'All Wells Confident',
                    `✅ All ${wellKeys.length} wells have confident classifications. No ML analysis needed!`,
                    'success'
                );
                
                // Reset browser title
                document.title = 'MDL PCR Analyzer';
                return;
            }
            
            // Show updated notification with edge case count
            this.showEdgeCaseAnalysisNotification(edgeCaseWells.length, wellKeys.length, analysisType);
            
            // Process only edge case wells sequentially to show real-time progress
            for (let i = 0; i < edgeCaseWells.length; i++) {
                // CRITICAL: Check if user clicked "Skip" during processing
                if (this.isMLAnalysisCancelled()) {
                    console.log('🛑 ML Batch Analysis: User cancelled - aborting edge case analysis at well', i + 1, 'of', edgeCaseWells.length);
                    
                    // Send immediate cancellation to server
                    await this.sendBatchCancellationRequest();
                    
                    // Reset browser title
                    document.title = 'MDL PCR Analyzer';
                    
                    // Hide progress notification
                    const progressNotification = document.getElementById('ml-available-notification');
                    if (progressNotification) {
                        progressNotification.remove();
                    }
                    
                    // Show cancellation message
                    this.showTrainingNotification(
                        'Analysis Cancelled',
                        `✋ Edge case ML analysis cancelled by user after processing ${i} of ${edgeCaseWells.length} edge cases.`,
                        'info'
                    );
                    
                    return; // Exit the function early
                }
                
                const wellKey = edgeCaseWells[i];
                const wellData = individualResults[wellKey];
                const wellNum = i + 1;
                
                // Update browser title to show edge case progress
                document.title = `🎯 ML Edge Cases: ${wellNum}/${edgeCaseWells.length} wells`;
                
                console.log(`🔄 ML Analysis: Processing edge case ${wellNum}/${edgeCaseWells.length} (${wellKey})`);
                
                // CRITICAL: Final check before individual well processing to prevent HTTP requests
                if (this.isMLAnalysisCancelled() || window.mlAutoAnalysisUserChoice === 'skipped') {
                    console.log(`🛑 ML Batch Analysis: Cancellation detected before processing ${wellKey}, stopping edge case analysis`);
                    break;
                }
                
                // Process this single well
                await this.analyzeSingleWellWithML(wellKey, wellData);
                
                // CRITICAL: Check for cancellation after well processing to stop batch immediately
                if (this.isMLAnalysisCancelled() || window.mlAutoAnalysisUserChoice === 'skipped') {
                    //console.log(`🛑 ML Batch Analysis: Cancellation detected after processing ${wellKey}, stopping batch`);
                    break;
                }
                
                // Update progress
                const progress = Math.round(((wellNum) / wellKeys.length) * 100);
                this.updateBatchProgress(progress, wellNum, wellKeys.length, `🤖 Analyzing well ${wellNum}/${wellKeys.length}`);
                
                // Small delay between wells to allow UI updates and prevent server overload
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Reset browser title
            document.title = 'MDL PCR Analyzer';

            // Complete batch analysis
            this.showBatchAnalysisProgress(false, trainingCount, analysisType);
            
            // Show appropriate completion message based on analysis type
            let completionTitle = '';
            let completionMessage = '';
            const skippedCount = wellKeys.length - edgeCaseWells.length;
            
            switch (analysisType) {
                case 'automatic':
                    completionTitle = 'Edge Case Analysis Complete!';
                    completionMessage = `� Successfully analyzed ${edgeCaseWells.length} edge cases with pathogen-specific ${trainingCount}-sample model. ${skippedCount} confident wells skipped for efficiency.`;
                    break;
                case 'cross-pathogen':
                    completionTitle = 'Cross-Pathogen Edge Case Analysis Complete!';
                    completionMessage = `🎯 Analyzed ${edgeCaseWells.length} edge cases with general ${trainingCount}-sample model. ${skippedCount} confident wells skipped. Results may need manual review for accuracy.`;
                    break;
                case 'initial':
                    completionTitle = 'Initial Edge Case Analysis Complete!';
                    completionMessage = `� Successfully re-analyzed ${edgeCaseWells.length} edge cases with ${trainingCount}-sample trained model. ${skippedCount} confident wells skipped.`;
                    break;
                case 'milestone':
                    completionTitle = 'Milestone Edge Case Analysis Complete!';
                    completionMessage = `🎯 Successfully re-analyzed ${edgeCaseWells.length} edge cases with updated ${trainingCount}-sample model. ${skippedCount} confident wells skipped.`;
                    break;
                default:
                    completionTitle = 'Edge Case Analysis Complete!';
                    completionMessage = `� Successfully analyzed ${edgeCaseWells.length} edge cases with ${trainingCount}-sample trained model. ${skippedCount} confident wells skipped.`;
            }
            
            this.showTrainingNotification(completionTitle, completionMessage, 'success');
            
            console.log(`✅ Edge case ML analysis complete: ${edgeCaseWells.length} edge cases processed, ${skippedCount} confident wells skipped`);
            console.log(`📊 Processing efficiency: ${skippedCount}/${wellKeys.length} wells saved ML computation`);
            
            // Auto-reset cancellation flag after successful batch completion
            await this.resetBatchCancellationFlag();
            
        } catch (error) {
            //console.error('Batch ML analysis failed:', error);
            this.showBatchAnalysisProgress(false, trainingCount, analysisType);
            this.showTrainingNotification(
                'Batch Analysis Failed',
                `❌ Error: ${error.message}`,
                'error'
            );
        }
    }

    async analyzeSingleWellWithML(wellKey, wellData) {
        try {
            // CRITICAL: Check for cancellation before making any HTTP requests
            if (this.isMLAnalysisCancelled()) {
                console.log(`🛑 ML Analysis: Skipping ${wellKey} - user cancelled batch analysis`);
                return null; // Return early, don't make HTTP request
            }
            
            // ROBOT EMOJI FIX: Show robot emoji in ML column while processing this well
            this.updateTableCellWithMLPrediction(wellKey, '🤖');
            
            // Extract pathogen information for this well
            const fluorophore = wellData.fluorophore || wellData.channel || '';
            const currentExperimentPattern = (typeof getCurrentFullPattern === 'function') ? getCurrentFullPattern() : null;
            const testCode = (typeof extractTestCode === 'function' && currentExperimentPattern) ? 
                extractTestCode(currentExperimentPattern) : null;
            
            let specificPathogen = null;
            if (testCode && fluorophore && typeof getPathogenTarget === 'function') {
                try {
                    specificPathogen = getPathogenTarget(testCode, fluorophore);
                } catch (error) {
                    console.log(`⚠️ Could not get pathogen target for ${testCode}/${fluorophore}:`, error);
                }
            }
            
            // Fallback pathogen detection
            if (!specificPathogen || specificPathogen === 'Unknown') {
                specificPathogen = wellData.target || fluorophore || 'Unknown';
            }
            
            // Prepare well data for ML analysis
            const analysisData = {
                rfu_data: wellData.raw_rfu,
                cycles: wellData.raw_cycles,
                session_id: window.currentSessionId || wellData.session_id || null, // Add session_id for persistence
                well_id: wellKey, // Add well_id for database lookup
                well_data: {
                    well: wellData.well_id || wellKey.split('_')[0],
                    target: specificPathogen, // Use resolved pathogen
                    sample: wellData.sample || wellData.sample_name || '',
                    classification: wellData.classification || 'UNKNOWN',
                    channel: fluorophore,
                    specific_pathogen: specificPathogen,
                    experiment_pattern: currentExperimentPattern,
                    fluorophore: fluorophore
                },
                existing_metrics: {
                    r2: wellData.r2_score || 0,
                    steepness: wellData.steepness || 0,
                    snr: wellData.snr || 0,
                    midpoint: wellData.midpoint || 0,
                    baseline: wellData.baseline || 0,
                    amplitude: wellData.amplitude || 0,
                    cqj: this.extractNumericValue(wellData.cqj, fluorophore),
                    calcj: this.extractNumericValue(wellData.calcj, fluorophore),
                    classification: wellData.classification || 'UNKNOWN'
                },
                is_batch_request: true // Mark as batch request
            };
            
            // CRITICAL: Final cancellation check before making HTTP request
            if (window.mlAutoAnalysisUserChoice === 'skipped') {
                //console.log(`🛑 ML Analysis: Skipping HTTP request for ${wellKey} - user cancelled during preparation`);
                return null; // Return early, don't make HTTP request
            }
            
            // CRITICAL: Double-check cancellation before HTTP request
            if (this.isMLAnalysisCancelled()) {
                console.log(`🛑 ML Analysis: Request cancelled for ${wellKey} before HTTP call`);
                return null;
            }
            
            const response = await fetch('/api/ml-analyze-curve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(analysisData)
            });
            
            // Handle cancellation response from server
            if (response.status === 409) {
                //console.log(`🛑 ML Analysis: Server cancelled analysis for ${wellKey}`);
                return null; // Server-side cancellation, return early
            }
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.prediction) {
                    // Update the well data with ML predictions
                    wellData.ml_classification = result.prediction;
                    //console.log(`✅ ML analysis for ${wellKey}: ${result.prediction.classification} (${(result.prediction.confidence * 100).toFixed(1)}%)`);

                    // Update the table cell with the ML prediction
                    this.updateTableCellWithMLPrediction(wellKey, result.prediction);
                } else {
                    //console.error(`ML analysis failed for ${wellKey}:`, result.error || 'No prediction returned');
                }
            }
            
        } catch (error) {
            //console.error(`Error analyzing ${wellKey} with ML:`, error);
        }
    }

    showTrainingProgress(trainingCount) {
        const nextMilestone = Math.ceil(trainingCount / 20) * 20;
        const remaining = nextMilestone - trainingCount;
        
        this.showTrainingNotification(
            'Model Learning',
            `📚 Model updated (${trainingCount} samples). Next batch analysis at ${nextMilestone} samples (${remaining} more).`,
            'info'
        );
    }

    showBatchAnalysisProgress(isStarting, trainingCount, analysisType) {
        if (isStarting) {
            // The notification banner is already shown by the calling code
            // Just update the progress text to show it's starting
            const notificationProgressText = document.getElementById('ml-progress-text');
            if (notificationProgressText) {
                notificationProgressText.textContent = '🤖 Starting analysis...';
            }
            
            // Initialize progress bar
            const notificationProgressBar = document.getElementById('ml-progress-fill');
            if (notificationProgressBar) {
                notificationProgressBar.style.width = '0%';
            }
        } else {
            // Analysis complete - close the notification banner after a short delay
            setTimeout(() => {
                const notification = document.getElementById('ml-available-notification');
                if (notification) {
                    notification.style.animation = 'slideUp 0.3s ease-out forwards';
                    setTimeout(() => {
                        notification.remove();
                    }, 300);
                }
            }, 2000); // Show completion for 2 seconds before closing
            
            // Update progress to complete
            const notificationProgressBar = document.getElementById('ml-progress-fill');
            const notificationProgressText = document.getElementById('ml-progress-text');
            
            if (notificationProgressBar) {
                notificationProgressBar.style.width = '100%';
            }
            
            if (notificationProgressText) {
                notificationProgressText.textContent = 'Analysis complete!';
            }
        }
        
        // Keep legacy behavior for any other progress containers
        const progressContainer = document.getElementById('ml-batch-progress');
        
        if (isStarting) {
            // Create or update legacy progress display
            let progressDiv = progressContainer;
            if (!progressDiv) {
                progressDiv = document.createElement('div');
                progressDiv.id = 'ml-batch-progress';
                progressDiv.className = 'ml-batch-progress-container';
                
                const mlSection = document.getElementById('ml-feedback-section');
                if (mlSection) {
                    mlSection.appendChild(progressDiv);
                }
            }
            
            // Get analysis type specific messaging
            let analysisTitle = '';
            let analysisDescription = '';
            
            switch (analysisType) {
                case 'automatic':
                    analysisTitle = '🤖 Automatic ML Analysis';
                    analysisDescription = `Processing with pathogen-specific model (${trainingCount} samples)...`;
                    break;
                case 'cross-pathogen':
                    analysisTitle = '🔄 Cross-Pathogen ML Analysis';
                    analysisDescription = `Processing with general model (${trainingCount} samples from different pathogen)...`;
                    break;
                case 'initial':
                    analysisTitle = '🎯 Initial Batch ML Analysis';
                    analysisDescription = `Processing with ${trainingCount}-sample trained model...`;
                    break;
                case 'milestone':
                    analysisTitle = '📈 Milestone Batch ML Analysis';
                    analysisDescription = `Processing with updated ${trainingCount}-sample model...`;
                    break;
                default:
                    analysisTitle = '🔄 Batch ML Analysis';
                    analysisDescription = `Processing with ${trainingCount}-sample trained model...`;
            }
            
            progressDiv.innerHTML = `
                <div class="batch-progress-header">
                    <h6>${analysisTitle}</h6>
                    <p>${analysisDescription}</p>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" id="ml-batch-progress-bar">0%</div>
                </div>
                <div class="progress-details" id="ml-batch-progress-details">
                    Preparing analysis...
                </div>
            `;
            progressDiv.style.display = 'block';
            
        } else {
            // Hide legacy progress
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }
        }
    }

    updateBatchProgress(percentage, processed, total, statusText = null) {
        // Update notification banner progress bar if it exists
        const notificationProgressBar = document.getElementById('ml-progress-fill');
        const notificationProgressText = document.getElementById('ml-progress-text');
        
        if (notificationProgressBar) {
            notificationProgressBar.style.width = `${percentage}%`;
        }
        
        if (notificationProgressText) {
            // ROBOT EMOJI FIX: Show robot emoji during active processing
            const progressText = statusText || `🤖 Analyzing ${processed}/${total} samples (${percentage}%)`;
            notificationProgressText.textContent = progressText;
        }
        
        // Also update legacy progress bar if it exists
        const progressBar = document.getElementById('ml-batch-progress-bar');
        const progressDetails = document.getElementById('ml-batch-progress-details');
        
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
            progressBar.textContent = `${percentage}%`;
        }
        
        if (progressDetails) {
            // Also add robot emoji to legacy progress details
            const detailsText = statusText || `🤖 Analyzed ${processed}/${total} samples`;
            progressDetails.textContent = detailsText;
        }
    }

    /**
     * Display ML channel progress similar to single channel analysis
     * Creates individual progress indicators for each channel
     */
    displayMLChannelProgress(channels, analysisType, trainingCount) {
        // Remove any existing notification banner since we're showing detailed progress
        const existingNotification = document.getElementById('ml-available-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Remove any existing progress container
        const existingContainer = document.getElementById('ml-channel-progress-container');
        if (existingContainer) {
            existingContainer.remove();
        }
        
        // Create ML channel progress container
        const progressContainer = document.createElement('div');
        progressContainer.id = 'ml-channel-progress-container';
        progressContainer.className = 'ml-channel-progress-container';
        
        let analysisTitle = '';
        switch (analysisType) {
            case 'automatic':
                analysisTitle = `ML Analysis (${trainingCount}-sample pathogen-specific model)`;
                break;
            case 'cross-pathogen':
                analysisTitle = `ML Analysis (${trainingCount}-sample general model)`;
                break;
            case 'initial':
                analysisTitle = `Initial Batch ML Analysis (${trainingCount} samples)`;
                break;
            case 'milestone':
                analysisTitle = `Milestone ML Analysis (${trainingCount} samples)`;
                break;
            default:
                analysisTitle = `Batch ML Analysis (${trainingCount} samples)`;
        }
        
        progressContainer.innerHTML = `
            <div class="ml-channel-progress-content">
                <h4>🤖 ${analysisTitle}</h4>
                <div class="ml-progress-channels">
                    ${channels.map(channel => `
                        <div class="ml-channel-progress-item" id="ml-progress-${channel}">
                            <span class="ml-fluorophore-tag fluorophore-${channel.toLowerCase()}">${channel}</span>
                            <span class="ml-progress-status" id="ml-status-text-${channel}">Pending...</span>
                            <div class="ml-status-indicator" id="ml-status-indicator-${channel}">
                                <div class="ml-status-spinner"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="ml-overall-progress">
                    <div class="ml-overall-progress-bar">
                        <div class="ml-overall-progress-fill" id="ml-overall-progress-fill"></div>
                    </div>
                    <div class="ml-overall-progress-text" id="ml-overall-progress-text">🤖 Starting analysis...</div>
                </div>
            </div>
            <style>
                .ml-channel-progress-container {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    border: 2px solid #2196F3;
                    border-radius: 8px;
                    padding: 20px;
                    min-width: 400px;
                    max-width: 600px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                    z-index: 999999 !important;
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                }
                
                .ml-channel-progress-content h4 {
                    margin: 0 0 15px 0;
                    color: #2196F3;
                    text-align: center;
                }
                
                .ml-progress-channels {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    margin-bottom: 20px;
                }
                
                .ml-channel-progress-item {
                    display: flex;
                    align-items: center;
                    padding: 8px 12px;
                    background: #f8f9fa;
                    border-radius: 6px;
                    gap: 15px;
                }
                
                .ml-fluorophore-tag {
                    background: #e3f2fd;
                    color: #1976d2;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-weight: bold;
                    min-width: 60px;
                    text-align: center;
                    font-size: 12px;
                }
                
                .ml-progress-status {
                    flex: 1;
                    font-weight: 500;
                }
                
                .ml-status-indicator {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    font-weight: bold;
                }
                
                .ml-status-indicator.status-processing {
                    background: #2196F3;
                    color: white;
                }
                
                .ml-status-indicator.status-completed {
                    background: #4CAF50;
                    color: white;
                }
                
                .ml-status-indicator.status-failed {
                    background: #f44336;
                    color: white;
                }
                
                .ml-status-indicator.status-waiting {
                    background: #ddd;
                    color: #666;
                }
                
                .ml-status-spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid #fff;
                    border-top: 2px solid transparent;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                .ml-overall-progress {
                    border-top: 1px solid #ddd;
                    padding-top: 15px;
                }
                
                .ml-overall-progress-bar {
                    width: 100%;
                    height: 20px;
                    background: #e0e0e0;
                    border-radius: 10px;
                    overflow: hidden;
                    margin-bottom: 8px;
                }
                
                .ml-overall-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #2196F3, #4CAF50);
                    border-radius: 10px;
                    transition: width 0.3s ease;
                    width: 0%;
                }
                
                .ml-overall-progress-text {
                    text-align: center;
                    font-size: 14px;
                    color: #666;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        
        // Add to page (prefer notification area, fallback to body)
        const mlSection = document.getElementById('ml-feedback-section');
        if (mlSection) {
            mlSection.appendChild(progressContainer);
        } else {
            document.body.appendChild(progressContainer);
        }
        
        // Force container to be visible and properly styled
        progressContainer.style.display = 'block';
        progressContainer.style.visibility = 'visible';
        progressContainer.style.opacity = '1';
    }

    /**
     * Update individual ML channel status in the UI (like updateChannelStatus)
     */
    updateMLChannelStatus(channel, status, progressText = null) {
        const statusIndicator = document.getElementById(`ml-status-indicator-${channel}`);
        const statusText = document.getElementById(`ml-status-text-${channel}`);
        
        if (!statusIndicator || !statusText) {
            return;
        }
        
        // Remove existing status classes
        statusIndicator.className = 'ml-status-indicator';
        
        switch (status) {
            case 'waiting':
                statusIndicator.classList.add('status-waiting');
                statusText.textContent = 'Waiting...';
                statusText.style.color = '#666';
                statusIndicator.innerHTML = '⏸️';
                break;
                
            case 'processing':
                statusIndicator.classList.add('status-processing');
                // Use custom progress text if provided, otherwise default
                const displayText = progressText || 'Analyzing with ML...';
                statusText.textContent = displayText;
                statusText.style.color = '#2196F3';
                // Add pulsing animation to the indicator
                statusIndicator.innerHTML = '<div class="ml-status-spinner"></div>';
                break;
                
            case 'completed':
                statusIndicator.classList.add('status-completed');
                statusText.textContent = 'ML Analysis Complete ✓';
                statusText.style.color = '#4CAF50';
                statusIndicator.innerHTML = '✓';
                this.updateMLOverallProgress();
                break;
                
            case 'failed':
                statusIndicator.classList.add('status-failed');
                statusText.textContent = 'ML Analysis Failed ✗';
                statusText.style.color = '#f44336';
                statusIndicator.innerHTML = '✗';
                this.updateMLOverallProgress();
                break;
        }
        console.log(`📊 ML Channel Status: ${channel} -> ${status}`);
    }

    /**
     * Update overall ML progress bar (like updateOverallProgress)
     */
    updateMLOverallProgress() {
        const progressFill = document.getElementById('ml-overall-progress-fill');
        const progressText = document.getElementById('ml-overall-progress-text');
        
        if (!progressFill || !progressText || !this.batchProgress) {
            return;
        }
        
        const { totalWells, processedWells } = this.batchProgress;
        
        if (totalWells > 0) {
            const percentage = Math.round((processedWells / totalWells) * 100);
            progressFill.style.width = `${percentage}%`;
            
            if (processedWells === totalWells) {
                progressText.textContent = 'ML Analysis Complete! 🎉';
                // Remove progress container after a delay
                setTimeout(() => {
                    const container = document.getElementById('ml-channel-progress-container');
                    if (container) {
                        container.remove();
                    }
                }, 3000);
            } else {
                const newText = `Processing wells: ${processedWells}/${totalWells} (${percentage}%)`;
                progressText.textContent = newText;
            }
        }
    }

    updateChannelMLProgress(channel, channelNum, totalChannels, status) {
        // Legacy function kept for compatibility - new progress uses updateMLChannelStatus
        // Update overall progress percentage based on completed channels
        const percentage = Math.round(((channelNum - 1) / totalChannels) * 100);
        
        let statusText = '';
        switch (status) {
            case 'processing':
                statusText = `Processing channel ${channelNum}/${totalChannels}: ${channel}...`;
                break;
            case 'completed':
                statusText = `Completed channel ${channelNum}/${totalChannels}: ${channel}`;
                break;
            case 'failed':
                statusText = `Failed channel ${channelNum}/${totalChannels}: ${channel}`;
                break;
        }
        
        // Update any legacy progress indicators
        this.updateBatchProgress(percentage, channelNum - 1, totalChannels, statusText);
        
        // Log channel progress
        console.log(`📊 ML Channel Progress: ${statusText}`);
    }

    // Multichannel-aware batch re-evaluation system
    async findSimilarWellsForBatchEvaluation(correctedWellKey, correctedWellData, expertClassification) {
        try {
            console.log(`🔍 Finding similar wells for batch re-evaluation after correction of ${correctedWellKey}`);
            
            // Extract key characteristics from corrected well
            const correctedFluorophore = correctedWellData.fluorophore || correctedWellData.channel;
            const correctedPathogen = this.extractPathogenFromWell(correctedWellData);
            
            if (!correctedFluorophore || !correctedPathogen) {
                console.log('⚠️ Cannot identify fluorophore/pathogen for similarity matching');
                return [];
            }
            
            const similarWells = [];
            const currentAnalysisResults = window.currentAnalysisResults || {};
            
            // Check if we have multichannel data
            if (currentAnalysisResults.fluorophore_data) {
                // Multichannel: look within same fluorophore/pathogen combination
                for (const [fluorophore, fluorophoreData] of Object.entries(currentAnalysisResults.fluorophore_data)) {
                    if (fluorophore !== correctedFluorophore) continue; // Only same channel
                    
                    for (const [wellKey, wellData] of Object.entries(fluorophoreData.well_data || {})) {
                        if (wellKey === correctedWellKey) continue; // Skip the corrected well itself
                        
                        const wellPathogen = this.extractPathogenFromWell(wellData);
                        if (wellPathogen !== correctedPathogen) continue; // Only same pathogen
                        
                        // Check if this well has an ML prediction that differs from expert classification
                        const currentMLPrediction = wellData.ml_prediction;
                        const currentClassification = wellData.classification;
                        
                        // If expert corrected a SUSPICIOUS case, prioritize finding other SUSPICIOUS cases
                        // with the same pathogen for re-evaluation
                        const shouldReEvaluate = this.shouldWellBeReEvaluated(
                            currentMLPrediction, 
                            currentClassification, 
                            expertClassification,
                            correctedWellData.classification || correctedWellData.ml_prediction
                        );
                        
                        if (shouldReEvaluate) {
                            // Check if wells have similar characteristics
                            if (this.areWellsSimilar(correctedWellData, wellData)) {
                                similarWells.push({
                                    wellKey,
                                    wellData,
                                    fluorophore,
                                    pathogen: wellPathogen,
                                    currentPrediction: currentMLPrediction || currentClassification,
                                    reason: 'Similar characteristics within same pathogen/channel - expert correction applied'
                                });
                            }
                        }
                    }
                }
            } else {
                // Single channel: look for similar wells in same pathogen
                const wellDataMap = currentAnalysisResults.well_data || {};
                for (const [wellKey, wellData] of Object.entries(wellDataMap)) {
                    if (wellKey === correctedWellKey) continue;
                    
                    const wellPathogen = this.extractPathogenFromWell(wellData);
                    if (wellPathogen !== correctedPathogen) continue;
                    
                    const currentMLPrediction = wellData.ml_prediction;
                    const currentClassification = wellData.classification;
                    
                    // If expert corrected a SUSPICIOUS case, prioritize finding other SUSPICIOUS cases
                    // with the same pathogen for re-evaluation
                    const shouldReEvaluate = this.shouldWellBeReEvaluated(
                        currentMLPrediction, 
                        currentClassification, 
                        expertClassification,
                        correctedWellData.classification || correctedWellData.ml_prediction
                    );
                    
                    if (shouldReEvaluate) {
                        if (this.areWellsSimilar(correctedWellData, wellData)) {
                            similarWells.push({
                                wellKey,
                                wellData,
                                fluorophore: correctedFluorophore,
                                pathogen: wellPathogen,
                                currentPrediction: currentMLPrediction || currentClassification,
                                reason: 'Similar characteristics within same pathogen - expert correction applied'
                            });
                        }
                    }
                }
            }
            
            console.log(`📊 Found ${similarWells.length} similar wells for potential re-evaluation`);
            return similarWells;
            
        } catch (error) {
            console.error('Error finding similar wells:', error);
            return [];
        }
    }

    extractPathogenFromWell(wellData) {
        // Extract pathogen from well data using multiple fallback methods
        if (wellData.specific_pathogen) return wellData.specific_pathogen;
        if (wellData.target) return wellData.target;
        
        // Try to derive from test code and fluorophore
        const fluorophore = wellData.fluorophore || wellData.channel;
        const currentExperimentPattern = (typeof getCurrentFullPattern === 'function') ? getCurrentFullPattern() : null;
        const testCode = (typeof extractTestCode === 'function' && currentExperimentPattern) ? 
            extractTestCode(currentExperimentPattern) : null;
            
        if (testCode && fluorophore && typeof getPathogenTarget === 'function') {
            try {
                return getPathogenTarget(testCode, fluorophore);
            } catch (error) {
                console.log(`⚠️ Could not get pathogen target for ${testCode}/${fluorophore}`);
            }
        }
        
        return fluorophore || 'Unknown';
    }

    shouldWellBeReEvaluated(currentMLPrediction, currentClassification, expertClassification, originalCorrectedClassification) {
        // Priority 1: If expert corrected a SUSPICIOUS case, find all other SUSPICIOUS cases with same pathogen
        if (originalCorrectedClassification === 'SUSPICIOUS') {
            return (currentMLPrediction === 'SUSPICIOUS' || currentClassification === 'SUSPICIOUS');
        }
        
        // Priority 2: If expert corrected any classification, find wells with same original classification
        if (originalCorrectedClassification && 
            (currentMLPrediction === originalCorrectedClassification || currentClassification === originalCorrectedClassification)) {
            return true;
        }
        
        // Priority 3: General case - find wells where current prediction differs from expert correction
        return (currentMLPrediction && currentMLPrediction !== expertClassification) ||
               (currentClassification && currentClassification !== expertClassification);
    }

    areWellsSimilar(well1, well2, similarityThreshold = 0.8) {
        try {
            // Compare key metrics to determine similarity
            const metrics1 = {
                amplitude: parseFloat(well1.amplitude) || 0,
                r2_score: parseFloat(well1.r2_score) || 0,
                snr: parseFloat(well1.snr) || 0,
                steepness: parseFloat(well1.steepness) || 0,
                baseline: parseFloat(well1.baseline) || 0
            };
            
            const metrics2 = {
                amplitude: parseFloat(well2.amplitude) || 0,
                r2_score: parseFloat(well2.r2_score) || 0,
                snr: parseFloat(well2.snr) || 0,
                steepness: parseFloat(well2.steepness) || 0,
                baseline: parseFloat(well2.baseline) || 0
            };
            
            // Calculate similarity score based on normalized differences
            let similarityScore = 0;
            let validComparisons = 0;
            
            for (const metric of Object.keys(metrics1)) {
                const val1 = metrics1[metric];
                const val2 = metrics2[metric];
                
                if (val1 !== 0 || val2 !== 0) { // Only compare if at least one value is non-zero
                    const maxVal = Math.max(Math.abs(val1), Math.abs(val2), 1); // Avoid division by zero
                    const difference = Math.abs(val1 - val2) / maxVal;
                    const metricSimilarity = Math.max(0, 1 - difference);
                    similarityScore += metricSimilarity;
                    validComparisons++;
                }
            }
            
            if (validComparisons === 0) return false;
            
            const avgSimilarity = similarityScore / validComparisons;
            return avgSimilarity >= similarityThreshold;
            
        } catch (error) {
            console.error('Error comparing well similarity:', error);
            return false;
        }
    }

    async executeAutomaticBatchReEvaluation(correctedWellKey, correctedWellData, expertClassification) {
        try {
            // CRITICAL: Check for cancellation before starting batch re-evaluation
            if (this.isMLAnalysisCancelled() || window.mlAutoAnalysisUserChoice === 'skipped') {
                return;
            }
            
            // Find similar wells that might benefit from re-evaluation
            const similarWells = await this.findSimilarWellsForBatchEvaluation(
                correctedWellKey, 
                correctedWellData, 
                expertClassification
            );
            
            if (similarWells.length === 0) {
                console.log('✅ No similar wells found requiring re-evaluation');
                return;
            }

            // Show brief notification that automatic re-evaluation is happening
            this.showAutomaticBatchNotification(correctedWellKey, expertClassification, similarWells);
            
            // Execute batch re-evaluation automatically
            await this.executeBatchReEvaluation(similarWells, expertClassification);
            
        } catch (error) {
            console.error('Error in automatic batch re-evaluation:', error);
        }
    }

    async showAutomaticBatchNotification(correctedWellKey, expertClassification, similarWells) {
        const pathogenBreakdown = {};
        const fluorophoreBreakdown = {};
        
        // Analyze the similar wells
        similarWells.forEach(well => {
            pathogenBreakdown[well.pathogen] = (pathogenBreakdown[well.pathogen] || 0) + 1;
            fluorophoreBreakdown[well.fluorophore] = (fluorophoreBreakdown[well.fluorophore] || 0) + 1;
        });
        
        const pathogenSummary = Object.entries(pathogenBreakdown)
            .map(([pathogen, count]) => `${pathogen}: ${count}`)
            .join(', ');
        
        const fluorophoreSummary = Object.entries(fluorophoreBreakdown)
            .map(([fluoro, count]) => `${fluoro}: ${count}`)
            .join(', ');

        this.showTrainingNotification(
            'Automatic Batch Re-evaluation',
            `🔄 Corrected ${correctedWellKey} to ${expertClassification}. Automatically re-evaluating ${similarWells.length} similar wells (${fluorophoreSummary})...`,
            'info'
        );
    }

    async proposeAndExecuteBatchReEvaluation(correctedWellKey, correctedWellData, expertClassification) {
        try {
            // CRITICAL: Check for cancellation before starting batch re-evaluation
            if (this.isMLAnalysisCancelled() || window.mlAutoAnalysisUserChoice === 'skipped') {
                return;
            }
            
            // Find similar wells that might benefit from re-evaluation
            const similarWells = await this.findSimilarWellsForBatchEvaluation(
                correctedWellKey, 
                correctedWellData, 
                expertClassification
            );
            
            if (similarWells.length === 0) {
                console.log('✅ No similar wells found requiring re-evaluation');
                return;
            }
            
            // Show confirmation dialog for batch re-evaluation
            const confirmed = await this.showBatchReEvaluationConfirmation(
                correctedWellKey,
                expertClassification,
                similarWells
            );
            
            if (confirmed) {
                await this.executeBatchReEvaluation(similarWells, expertClassification);
            }
            
        } catch (error) {
            console.error('Error in batch re-evaluation proposal:', error);
        }
    }

    async showBatchReEvaluationConfirmation(correctedWellKey, expertClassification, similarWells) {
        return new Promise((resolve) => {
            const pathogenBreakdown = {};
            const fluorophoreBreakdown = {};
            
            // Analyze the similar wells
            similarWells.forEach(well => {
                pathogenBreakdown[well.pathogen] = (pathogenBreakdown[well.pathogen] || 0) + 1;
                fluorophoreBreakdown[well.fluorophore] = (fluorophoreBreakdown[well.fluorophore] || 0) + 1;
            });
            
            const pathogenSummary = Object.entries(pathogenBreakdown)
                .map(([pathogen, count]) => `${pathogen}: ${count}`)
                .join(', ');
            
            const fluorophoreSummary = Object.entries(fluorophoreBreakdown)
                .map(([fluoro, count]) => `${fluoro}: ${count}`)
                .join(', ');
            
            const notificationHtml = `
                <div class="ml-notification ml-notification-info" style="position: fixed; top: 20px; right: 20px; z-index: 10000; max-width: 500px;">
                    <div class="ml-notification-content">
                        <div class="ml-notification-icon">🔄</div>
                        <div class="ml-notification-text">
                            <strong>Intelligent Batch Re-evaluation</strong><br>
                            <div style="margin: 8px 0;">
                                ✏️ You corrected <strong>${correctedWellKey}</strong> to <strong>${expertClassification}</strong><br>
                                🔍 Found <strong>${similarWells.length}</strong> similar wells with different ML predictions
                            </div>
                            <div style="font-size: 0.9em; color: #666; margin: 6px 0;">
                                <strong>Channels:</strong> ${fluorophoreSummary}<br>
                                <strong>Pathogens:</strong> ${pathogenSummary}
                            </div>
                            <div style="font-size: 0.85em; color: #888; margin-top: 6px;">
                                💡 This will re-train the ML model with your correction and re-evaluate similar wells
                            </div>
                        </div>
                        <div class="ml-notification-actions">
                            <button class="ml-notification-btn primary" onclick="this.parentElement.parentElement.parentElement.acceptAction()">
                                🚀 Re-evaluate Similar Wells
                            </button>
                            <button class="ml-notification-btn secondary" onclick="this.parentElement.parentElement.parentElement.declineAction()">
                                ✋ Skip Batch Re-evaluation
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            const notificationDiv = document.createElement('div');
            notificationDiv.innerHTML = notificationHtml;
            const notification = notificationDiv.firstElementChild;
            
            notification.acceptAction = () => {
                document.body.removeChild(notification);
                resolve(true);
            };
            
            notification.declineAction = () => {
                document.body.removeChild(notification);
                resolve(false);
            };
            
            document.body.appendChild(notification);
            
            // Auto-hide after 15 seconds
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    notification.declineAction();
                }
            }, 15000);
        });
    }

    async executeBatchReEvaluation(similarWells, expertClassification) {
        try {
            // CRITICAL: Check for cancellation before starting batch re-evaluation
            if (this.isMLAnalysisCancelled() || window.mlAutoAnalysisUserChoice === 'skipped') {
                return;
            }
            
            // Show progress notification
            this.showTrainingNotification(
                'Batch Re-evaluation In Progress',
                `🔄 Re-evaluating ${similarWells.length} similar wells with updated ML model...`,
                'info'
            );
            
            let reEvaluatedCount = 0;
            let changedPredictions = 0;
            const results = [];
            
            for (const similarWell of similarWells) {
                // CRITICAL: Check for cancellation before processing each well
                if (this.isMLAnalysisCancelled()) {
                    console.log(`🛑 Batch Re-evaluation: User cancelled - stopping after ${reEvaluatedCount} wells`);
                    break; // Exit the loop early
                }
                
                // ADDITIONAL: Check window flag for immediate cancellation
                if (window.mlAutoAnalysisUserChoice === 'skipped') {
                    console.log(`🛑 Batch Re-evaluation: User skipped analysis via window flag after ${reEvaluatedCount} wells`);
                    break;
                }
                
                try {
                    // CRITICAL: Final check before individual well processing to prevent HTTP requests
                    if (this.isMLAnalysisCancelled() || window.mlAutoAnalysisUserChoice === 'skipped') {
                        console.log(`🛑 Batch Re-evaluation: Cancellation detected before processing ${similarWell.wellKey}`);
                        break;
                    }
                    
                    // Re-analyze this well with the updated model
                    const reAnalysisResult = await this.analyzeSingleWellWithML(
                        similarWell.wellKey,
                        similarWell.wellData
                    );
                    
                    // CRITICAL: Check for cancellation after well processing
                    if (this.isMLAnalysisCancelled() || window.mlAutoAnalysisUserChoice === 'skipped') {
                        console.log(`🛑 Batch Re-evaluation: Cancellation detected after processing ${similarWell.wellKey}`);
                        break;
                    }
                    
                    if (reAnalysisResult && reAnalysisResult.prediction) {
                        reEvaluatedCount++;
                        
                        // Check if prediction changed
                        if (reAnalysisResult.prediction !== similarWell.currentPrediction) {
                            changedPredictions++;
                            console.log(`📈 Well ${similarWell.wellKey}: ${similarWell.currentPrediction} → ${reAnalysisResult.prediction}`);
                            
                            // Update the well data with new prediction
                            this.updateWellMLPrediction(similarWell.wellKey, reAnalysisResult, similarWell.fluorophore);
                            
                            // Update the results table immediately
                            this.updateTableCellWithMLPrediction(similarWell.wellKey, reAnalysisResult.prediction);
                            
                            // CRITICAL: Persist the new ML prediction to the backend database
                            try {
                                // Temporarily store current context
                                const tempWellKey = this.currentWellKey;
                                this.currentWellKey = similarWell.wellKey;
                                
                                await this.updateWellClassification(reAnalysisResult.prediction, 'batch_ml_reeval');
                                console.log(`✅ Persisted new prediction for ${similarWell.wellKey}: ${reAnalysisResult.prediction}`);
                                
                                // Restore original context
                                this.currentWellKey = tempWellKey;
                            } catch (persistError) {
                                console.warn(`⚠️ Failed to persist prediction for ${similarWell.wellKey}:`, persistError);
                            }
                            
                            results.push({
                                wellKey: similarWell.wellKey,
                                oldPrediction: similarWell.currentPrediction,
                                newPrediction: reAnalysisResult.prediction,
                                pathogen: similarWell.pathogen,
                                fluorophore: similarWell.fluorophore
                            });
                        }
                    }
                } catch (error) {
                    console.error(`Error re-evaluating well ${similarWell.wellKey}:`, error);
                }
            }
            
            // Force update the entire display to reflect all changes
            if (typeof updateAnalysisResultsDisplay === 'function') {
                updateAnalysisResultsDisplay();
            } else if (typeof populateResultsTable === 'function' && window.currentAnalysisResults) {
                // Fallback to table repopulation
                const individualResults = window.currentAnalysisResults.fluorophore_data ? 
                    Object.values(window.currentAnalysisResults.fluorophore_data).reduce((acc, fluorophoreData) => {
                        return {...acc, ...fluorophoreData.well_data};
                    }, {}) : window.currentAnalysisResults.well_data || {};
                
                // DEBUG: Log batch analysis table rebuild details
                const resultsCount = individualResults ? Object.keys(individualResults).length : 0;
                console.log(`📊 Batch analysis table rebuild: ${resultsCount} wells in individualResults`);
                
                // CRITICAL MULTICHANNEL FIX: Use individual_results if available, better structured
                const bestResults = window.currentAnalysisResults.individual_results || individualResults;
                const finalResultsCount = bestResults ? Object.keys(bestResults).length : 0;
                console.log(`📊 MULTICHANNEL-FIX: Using best results structure with ${finalResultsCount} wells`);
                console.log('🔍 MULTICHANNEL-FIX: Well keys for batch rebuild:', Object.keys(bestResults || {}));
                
                populateResultsTable(bestResults);
                
                // CRITICAL: Rebuild modal navigation AFTER table is rebuilt
                if (window.rebuildModalNavigationIfNeeded) {
                    console.log('🔄 Triggering modal navigation rebuild after batch analysis table rebuild');
                    window.rebuildModalNavigationIfNeeded();
                } else if (window.buildModalNavigationList) {
                    console.log('🔄 Rebuilding modal navigation after batch analysis table rebuild (fallback)');
                    window.buildModalNavigationList();
                }
            }
            
            // Show completion notification
            let completionMessage;
            if (changedPredictions > 0) {
                completionMessage = `✅ Automatic batch re-evaluation complete! Updated ${changedPredictions} of ${reEvaluatedCount} similar wells with improved predictions.`;
            } else {
                completionMessage = `✅ Automatic batch re-evaluation complete! All ${reEvaluatedCount} similar wells maintained their predictions (model confidence validated).`;
            }
            
            this.showTrainingNotification(
                'Batch Re-evaluation Complete',
                completionMessage,
                'success'
            );
            
            console.log(`✅ Automatic batch re-evaluation complete: ${changedPredictions}/${reEvaluatedCount} predictions updated`);
            return results;
            
        } catch (error) {
            console.error('Error executing automatic batch re-evaluation:', error);
            this.showTrainingNotification(
                'Batch Re-evaluation Failed',
                `❌ Error: ${error.message}`,
                'error'
            );
        }
    }

    updateWellMLPrediction(wellKey, mlResult, fluorophore) {
        try {
            const currentAnalysisResults = window.currentAnalysisResults || {};
            
            // Update multichannel data structure
            if (currentAnalysisResults.fluorophore_data && fluorophore) {
                if (currentAnalysisResults.fluorophore_data[fluorophore] && 
                    currentAnalysisResults.fluorophore_data[fluorophore].well_data &&
                    currentAnalysisResults.fluorophore_data[fluorophore].well_data[wellKey]) {
                    
                    const wellData = currentAnalysisResults.fluorophore_data[fluorophore].well_data[wellKey];
                    wellData.ml_prediction = mlResult.prediction;
                    wellData.ml_confidence = mlResult.confidence;
                    if (mlResult.features) wellData.ml_features = mlResult.features;
                    
                    console.log(`✅ Updated ML prediction for ${fluorophore}/${wellKey}: ${mlResult.prediction}`);
                }
            }
            
            // Update single channel data structure
            if (currentAnalysisResults.well_data && currentAnalysisResults.well_data[wellKey]) {
                const wellData = currentAnalysisResults.well_data[wellKey];
                wellData.ml_prediction = mlResult.prediction;
                wellData.ml_confidence = mlResult.confidence;
                if (mlResult.features) wellData.ml_features = mlResult.features;
                
                console.log(`✅ Updated ML prediction for ${wellKey}: ${mlResult.prediction}`);
            }
            
        } catch (error) {
            console.error(`Error updating ML prediction for ${wellKey}:`, error);
        }
    }

    showTrainingNotification(title, message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `ml-training-notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <h6>${title}</h6>
                <p>${message}</p>
                <button class="close-notification" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add to page
        const mlSection = document.getElementById('ml-feedback-section');
        if (mlSection) {
            mlSection.appendChild(notification);
            
            // Auto-remove after 8 seconds
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 8000);
        } else {
            // Fallback: use browser notification
            console.log(`${title}: ${message}`);
        }
    }

    async checkForAutomaticMLAnalysis() {
        // Check if we should automatically run ML analysis for this session
        // This is called when new analysis results are loaded
        
        // Check if user already declined/skipped automatic ML analysis
        if (window.mlAutoAnalysisUserChoice === 'skipped') {
            console.log('🔴 Auto-ML: User previously skipped automatic ML analysis, aborting');
            return false;
        }
        
        try {
            // Get current test code from the uploaded experiment
            const currentExperimentPattern = (typeof getCurrentFullPattern === 'function') ? getCurrentFullPattern() : null;
            const currentTestCode = (typeof extractTestCode === 'function' && currentExperimentPattern) ? 
                extractTestCode(currentExperimentPattern) : null;
                
            console.log(`🧬 Auto-ML: Current test code: ${currentTestCode} (from pattern: ${currentExperimentPattern})`);
            
            // Check if ML is enabled for this pathogen before proceeding
            if (currentTestCode) {
                console.log(`🔍 Auto-ML: Checking ML enabled status for pathogen: "${currentTestCode}"`);
                const mlEnabled = await this.checkMLEnabledForPathogen(currentTestCode);
                if (!mlEnabled) {
                    console.log(`🚫 Auto-ML: ML disabled for pathogen ${currentTestCode}, skipping analysis`);
                    return false;
                }
                console.log(`✅ Auto-ML: ML enabled for pathogen ${currentTestCode}, proceeding with analysis`);
            } else {
                console.log(`⚠️ Auto-ML: No test code found, proceeding with general ML analysis`);
            }
            
            const response = await fetch('/api/ml-stats');
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.stats) {
                    const totalTrainingCount = result.stats.training_samples || 0;
                    const pathogenModels = result.stats.pathogen_models || [];
                    
                    // Check if we have a trained model for this specific pathogen
                    const currentPathogenModel = pathogenModels.find(model => 
                        model.pathogen_code === currentTestCode || 
                        model.test_code === currentTestCode
                    );
                    
                    if (currentPathogenModel && currentPathogenModel.training_samples >= 20) {
                        // Model is trained on this specific pathogen with sufficient samples
                        console.log(`🎯 Auto-ML: Found pathogen-specific model for ${currentTestCode} with ${currentPathogenModel.training_samples} samples`);
                        
                        // Show non-blocking notification instead of blocking popup
                        this.showMLAvailableNotification({
                            type: 'pathogen-specific',
                            pathogen: currentTestCode,
                            samples: currentPathogenModel.training_samples,
                            onAccept: () => {
                                // Check for cancellation before starting batch analysis
                                if (this.isMLAnalysisCancelled() || window.mlAutoAnalysisUserChoice === 'skipped') {
                                    return;
                                }
                                
                                // Run both batch analysis and table enhancement
                                this.performBatchMLAnalysis(currentPathogenModel.training_samples, 'automatic');
                                // Also enhance current table if available
                                if (window.currentAnalysisResults && window.currentAnalysisResults.individual_results) {
                                    window.enhanceResultsWithMLClassification(window.currentAnalysisResults.individual_results, true);
                                }
                            },
                            onDecline: () => console.log('User declined automatic ML analysis')
                        });
                        
                        return true; // Model is ready for automatic analysis
                    } else if (totalTrainingCount >= 20) {
                        // Model is trained but not on this specific pathogen
                        console.log(`⚠️ Auto-ML: Model has ${totalTrainingCount} total samples but none for pathogen ${currentTestCode}`);
                        
                        // Show non-blocking notification for cross-pathogen analysis
                        this.showMLAvailableNotification({
                            type: 'cross-pathogen',
                            pathogen: currentTestCode,
                            samples: totalTrainingCount,
                            stats: result.stats, // Pass the stats for breakdown
                            onAccept: () => {
                                // Check for cancellation before starting batch analysis
                                if (this.isMLAnalysisCancelled() || window.mlAutoAnalysisUserChoice === 'skipped') {
                                    return;
                                }
                                
                                // Run both batch analysis and table enhancement
                                this.performBatchMLAnalysis(totalTrainingCount, 'cross-pathogen');
                                // Also enhance current table if available
                                if (window.currentAnalysisResults && window.currentAnalysisResults.individual_results) {
                                    window.enhanceResultsWithMLClassification(window.currentAnalysisResults.individual_results, true);
                                }
                            },
                            onDecline: () => console.log('User declined cross-pathogen ML analysis')
                        });
                        
                        return false; // Cross-pathogen analysis
                    } else {
                        // No sufficient training data
                        console.log(`📚 Auto-ML: Insufficient training data (${totalTrainingCount}/20 samples total, 0 for ${currentTestCode})`);
                        
                        // Show non-blocking informational notification for new pathogen
                        if (currentTestCode) {
                            this.showMLAvailableNotification({
                                type: 'new-pathogen',
                                pathogen: currentTestCode,
                                samples: totalTrainingCount,
                                onAccept: null, // No action available
                                onDecline: null
                            });
                        }
                        
                        return false; // Model needs more training
                    }
                }
            }
        } catch (error) {
            console.error('Failed to check automatic ML analysis capability:', error);
        }
        
        return false;
    }

    async checkMLEnabledForPathogen(pathogen, fluorophore = 'FAM') {
        try {
            // Validate pathogen parameter
            if (!pathogen || pathogen === 'null' || pathogen === 'undefined') {
                console.log('ML: Invalid pathogen provided, defaulting to enabled');
                return true;
            }
            
            const response = await fetch(`/api/ml-config/check-enabled/${encodeURIComponent(pathogen)}/${encodeURIComponent(fluorophore)}`);
            if (response.ok) {
                const result = await response.json();
                return result.enabled;
            } else {
                console.warn(`ML: Failed to check ML status for ${pathogen}/${fluorophore}, defaulting to enabled`);
                return true;
            }
        } catch (error) {
            console.error('Failed to check ML enabled status:', error);
        }
        return true; // Default to enabled if check fails
    }

    showMLAvailableNotification(options) {
        // Create non-blocking notification banner instead of blocking popup
        const { type, pathogen, samples, stats, onAccept, onDecline } = options;
        
        // Remove any existing ML notifications
        const existingNotification = document.getElementById('ml-available-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Create notification container
        const notification = document.createElement('div');
        notification.id = 'ml-available-notification';
        notification.className = 'ml-notification-banner';
        
        let notificationContent = '';
        let notificationClass = '';
        
        switch (type) {
            case 'pathogen-specific':
                notificationClass = 'ml-notification-success';
                notificationContent = `
                    <div class="ml-notification-content">
                        <div class="ml-notification-icon">🤖</div>
                        <div class="ml-notification-text">
                            <strong>Pathogen-Specific ML Analysis Available</strong><br>
                            🧬 Pathogen: <strong>${pathogen}</strong> | 
                            ✅ ML model trained with <strong>${samples}</strong> samples for this pathogen<br>
                            <small>� Click "Start Analysis" to analyze all wells with the trained model</small>
                        </div>
                        <div class="ml-notification-actions">
                            <button class="ml-notification-btn primary" onclick="this.parentElement.parentElement.parentElement.acceptAction()">
                                🚀 Start Analysis
                            </button>
                            <button class="ml-notification-btn secondary" onclick="this.parentElement.parentElement.parentElement.declineAction()">
                                ✕ Skip
                            </button>
                        </div>
                    </div>
                `;
                break;
                
            case 'cross-pathogen':
                notificationClass = 'ml-notification-info';
                
                // Build detailed pathogen breakdown using passed stats
                let pathogenBreakdownText = '';
                if (stats && stats.training_breakdown && stats.training_breakdown.pathogen_breakdown) {
                    const pathogenBreakdown = stats.training_breakdown.pathogen_breakdown;
                    const pathogenList = Object.entries(pathogenBreakdown)
                        .filter(([key, count]) => key !== 'General_PCR' && count > 0)
                        .map(([pathogenName, count]) => `<span style="font-weight: bold;">${pathogenName}</span>: ${count}`)
                        .join(', ');
                    
                    const generalPCR = pathogenBreakdown['General_PCR'] || 0;
                    
                    if (pathogenList) {
                        pathogenBreakdownText = `<div style="font-size: 0.9em; margin-top: 4px; color: #666;">
                            Training Breakdown: ${generalPCR} General PCR | ${pathogenList}
                        </div>`;
                    }
                }
                
                notificationContent = `
                    <div class="ml-notification-content">
                        <div class="ml-notification-icon">🤖</div>
                        <div class="ml-notification-text">
                            <strong>Cross-Pathogen ML Analysis Available</strong><br>
                            🧬 Current test: <strong>${pathogen}</strong> | 
                            📚 ML model trained with <strong>${samples}</strong> samples including specific training for this test and General PCR<br>
                            <small>💡 Model benefits from diverse training data across multiple pathogen types</small>
                            ${pathogenBreakdownText}
                        </div>
                        <div class="ml-notification-actions">
                            <button class="ml-notification-btn primary" onclick="this.parentElement.parentElement.parentElement.acceptAction()">
                                🔄 Start Analysis
                            </button>
                            <button class="ml-notification-btn secondary" onclick="this.parentElement.parentElement.parentElement.declineAction()">
                                ✕ Skip
                            </button>
                        </div>
                    </div>
                `;
                break;
                
            case 'new-pathogen':
                notificationClass = 'ml-notification-info';
                notificationContent = `
                    <div class="ml-notification-content">
                        <div class="ml-notification-icon">🧬</div>
                        <div class="ml-notification-text">
                            <strong>New Pathogen Detected: ${pathogen}</strong><br>
                            📚 ML model needs training for this pathogen (${samples}/20 total samples)<br>
                            <small>💡 Use the ML feedback interface to classify curves and train the model</small>
                        </div>
                        <div class="ml-notification-actions">
                            <button class="ml-notification-btn secondary" onclick="this.parentElement.parentElement.parentElement.declineAction()">
                                ✅ Got it
                            </button>
                        </div>
                    </div>
                `;
                break;
        }
        
        notification.innerHTML = notificationContent;
        notification.className += ` ${notificationClass}`;
        
        // Add action handlers
        notification.acceptAction = () => {
            // Set flag to indicate user accepted automatic ML analysis
            console.log('🟢 ML Banner: User ACCEPTED automatic ML analysis');
            window.mlAutoAnalysisUserChoice = 'accepted';
            if (onAccept) onAccept();
            notification.remove();
        };
        
        notification.declineAction = () => {
            // Set flag to indicate user declined/skipped automatic ML analysis
            console.log('🔴 ML Banner: User SKIPPED automatic ML analysis');
            window.mlAutoAnalysisUserChoice = 'skipped';
            
            // Send cancellation request to server to stop any ongoing processing
            this.sendBatchCancellationRequest();
            
            if (onDecline) onDecline();
            notification.remove();
        };
        
        // Add styles
        this.addNotificationStyles();
        
        // Insert at top of page
        document.body.insertBefore(notification, document.body.firstChild);
        
        // Auto-dismiss after 30 seconds for info notifications
        if (type === 'new-pathogen') {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 30000);
        }
    }

    showRunningAnalysisNotification(trainingCount, analysisType) {
        // Create running analysis notification
        const notification = document.createElement('div');
        notification.id = 'ml-available-notification';
        notification.className = 'ml-notification-banner ml-notification-success';
        
        let analysisTitle = '';
        let analysisDescription = '';
        
        switch (analysisType) {
            case 'automatic':
                analysisTitle = '🤖 Running Pathogen-Specific ML Analysis';
                analysisDescription = `Processing with pathogen-specific model (${trainingCount} samples)...`;
                break;
            case 'cross-pathogen':
                analysisTitle = '🔄 Running Cross-Pathogen ML Analysis';
                analysisDescription = `Processing with general model (${trainingCount} samples from different pathogen)...`;
                break;
            case 'initial':
                analysisTitle = '🎯 Running Initial Batch ML Analysis';
                analysisDescription = `Processing with ${trainingCount}-sample trained model...`;
                break;
            case 'milestone':
                analysisTitle = '📈 Running Milestone Batch ML Analysis';
                analysisDescription = `Processing with updated ${trainingCount}-sample model...`;
                break;
            default:
                analysisTitle = '🔄 Running Batch ML Analysis';
                analysisDescription = `Processing with ${trainingCount}-sample trained model...`;
        }
        
        notification.innerHTML = `
            <div class="ml-notification-content">
                <div class="ml-notification-icon">🤖</div>
                <div class="ml-notification-text">
                    <strong>${analysisTitle}</strong><br>
                    ${analysisDescription}<br>
                    <small>🔄 Analysis in progress - results will appear in ML column</small>
                    <div class="ml-progress-container" style="margin-top: 8px;">
                        <div class="ml-progress-bar">
                            <div class="ml-progress-fill" id="ml-progress-fill"></div>
                        </div>
                        <div class="ml-progress-text" id="ml-progress-text">🤖 Initializing analysis...</div>
                    </div>
                </div>
                <div class="ml-notification-actions">
                    <button class="ml-notification-btn secondary" onclick="this.parentElement.parentElement.parentElement.skipRunningAnalysis()">
                        ✋ Skip Analysis
                    </button>
                </div>
            </div>
        `;
        
        // Add skip action handler to the notification
        notification.skipRunningAnalysis = () => {
            console.log('🛑 User clicked SKIP during running ML analysis');
            
            // Set the cancellation flag
            window.mlAutoAnalysisUserChoice = 'skipped';
            
            // Send cancellation request to server immediately
            this.sendBatchCancellationRequest();
            
            // Show immediate feedback
            const progressText = document.getElementById('ml-progress-text');
            if (progressText) {
                progressText.textContent = 'Cancelling analysis...';
            }
            
            // Remove the notification after a short delay
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
                
                // Show cancellation confirmation
                this.showTrainingNotification(
                    'Analysis Cancelled',
                    '✋ ML batch analysis has been cancelled by user request.',
                    'info'
                );
            }, 1000);
        };
        
        // Add styles
        this.addNotificationStyles();
        
        // Insert at top of page
        document.body.insertBefore(notification, document.body.firstChild);
    }

    addNotificationStyles() {
        // Add styles only once
        if (document.getElementById('ml-notification-styles')) {
            return;
        }
        
        const styles = document.createElement('style');
        styles.id = 'ml-notification-styles';
        styles.textContent = `
            .ml-notification-banner {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 10000;
                padding: 15px 20px;
                font-family: Arial, sans-serif;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                animation: slideDown 0.3s ease-out;
            }
            
            .ml-notification-success {
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
            }
            
            .ml-notification-warning {
                background: linear-gradient(135deg, #FF9800, #f57c00);
                color: white;
            }
            
            .ml-notification-info {
                background: linear-gradient(135deg, #2196F3, #1976d2);
                color: white;
            }
            
            .ml-notification-content {
                display: flex;
                align-items: center;
                max-width: 1200px;
                margin: 0 auto;
                gap: 15px;
            }
            
            .ml-notification-icon {
                font-size: 24px;
                flex-shrink: 0;
            }
            
            .ml-notification-text {
                flex: 1;
                line-height: 1.4;
            }
            
            .ml-notification-text strong {
                font-weight: bold;
            }
            
            .ml-notification-text small {
                opacity: 0.9;
                font-size: 0.9em;
            }
            
            .ml-notification-spinner {
                flex-shrink: 0;
            }
            
            .spinner-animation {
                animation: spin 1s linear infinite;
                font-size: 18px;
            }
            
            .ml-notification-actions {
                display: flex;
                gap: 10px;
                flex-shrink: 0;
            }
            
            .ml-notification-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                transition: all 0.2s ease;
                font-size: 14px;
            }
            
            .ml-notification-btn.primary {
                background: rgba(255,255,255,0.2);
                color: white;
                border: 2px solid rgba(255,255,255,0.3);
            }
            
            .ml-notification-btn.primary:hover {
                background: rgba(255,255,255,0.3);
                transform: translateY(-1px);
            }
            
            .ml-notification-btn.secondary {
                background: rgba(0,0,0,0.1);
                color: white;
                border: 2px solid rgba(255,255,255,0.2);
            }
            
            .ml-notification-btn.secondary:hover {
                background: rgba(0,0,0,0.2);
            }
            
            .ml-progress-container {
                margin-top: 8px;
                width: 100%;
            }
            
            .ml-progress-bar {
                background: rgba(255,255,255,0.2);
                border-radius: 10px;
                height: 6px;
                overflow: hidden;
                margin-bottom: 4px;
            }
            
            .ml-progress-fill {
                background: rgba(255,255,255,0.8);
                height: 100%;
                width: 0%;
                transition: width 0.3s ease;
                border-radius: 10px;
            }
            
            .ml-progress-text {
                font-size: 0.8em;
                opacity: 0.9;
                color: rgba(255,255,255,0.9);
            }
            
            @keyframes slideDown {
                from {
                    transform: translateY(-100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideUp {
                from {
                    transform: translateY(0);
                    opacity: 1;
                }
                to {
                    transform: translateY(-100%);
                    opacity: 0;
                }
            }
            
            @keyframes spin {
                from {
                    transform: rotate(0deg);
                }
                to {
                    transform: rotate(360deg);
                }
            }
        `;
        
        document.head.appendChild(styles);
    }

    addVisualAnalysisStyles() {
        // Add visual analysis styles only once
        if (document.getElementById('visual-analysis-styles')) {
            return;
        }
        
        const styles = document.createElement('style');
        styles.id = 'visual-analysis-styles';
        styles.textContent = `
            .visual-curve-analysis {
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                border: 1px solid #dee2e6;
                border-radius: 8px;
                padding: 12px;
                margin: 8px 0;
            }
            
            .visual-curve-analysis h6 {
                margin: 0 0 8px 0;
                font-size: 14px;
                font-weight: 600;
                color: #495057;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .visual-metrics-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                margin-bottom: 10px;
            }
            
            .visual-metric-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 12px;
                padding: 4px 0;
            }
            
            .visual-metric-item .metric-label {
                font-weight: 500;
                color: #6c757d;
            }
            
            .curve-characteristics {
                border-top: 1px solid #dee2e6;
                padding-top: 8px;
                margin-top: 8px;
            }
            
            .characteristic-tags {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
            }
            
            .characteristic-tag {
                display: inline-block;
                padding: 2px 6px;
                background: #007bff;
                color: white;
                border-radius: 12px;
                font-size: 10px;
                font-weight: 500;
                white-space: nowrap;
            }
            
            .characteristic-tag:nth-child(odd) {
                background: #28a745;
            }
            
            .characteristic-tag:nth-child(3n) {
                background: #ffc107;
                color: #212529;
            }
            
            .characteristic-tag:nth-child(4n) {
                background: #17a2b8;
            }
        `;
        
        document.head.appendChild(styles);
    }

    async updateMLStats() {
        try {
            const response = await fetch('/api/ml-stats');
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.stats) {
                    this.mlStats = result.stats;
                    this.displayMLStats(result.stats);
                    console.log('ML Stats updated:', result.stats);
                } else {
                    console.error('Failed to get ML stats:', result.error || 'Unknown error');
                }
            }
        } catch (error) {
            console.error('Failed to update ML stats:', error);
        }
    }

    displayMLStats(stats) {
        console.log('Displaying ML stats:', stats);
        
        const trainingSamplesElement = document.getElementById('stat-training-samples');
        const modelTrainedElement = document.getElementById('stat-model-trained');
        const pathogenModelsElement = document.getElementById('stat-pathogen-models');
        const expertReviewElement = document.getElementById('stat-expert-review-status');
        const trainingProgressElement = document.getElementById('training-progress');
        const progressFillElement = document.getElementById('training-progress-fill');

        if (trainingSamplesElement) {
            const trainingCount = stats.training_samples || 0;
            
            // Show enhanced breakdown if available
            if (stats.training_breakdown) {
                const breakdown = stats.training_breakdown;
                const generalPCR = breakdown.general_pcr_samples || 0;
                const pathogenSpecific = breakdown.pathogen_specific_samples || 0;
                const currentTest = breakdown.current_test_samples || 0;
                const currentPathogen = breakdown.current_test_pathogen || 'Unknown';
                
                // Create detailed pathogen breakdown display
                let pathogenDetails = '';
                if (breakdown.pathogen_breakdown) {
                    const pathogenBreakdown = breakdown.pathogen_breakdown;
                    const pathogenList = Object.entries(pathogenBreakdown)
                        .filter(([pathogen, count]) => pathogen !== 'General_PCR')
                        .map(([pathogen, count]) => {
                            const isCurrent = pathogen === currentPathogen;
                            return `<span style="${isCurrent ? 'font-weight: bold; color: #2196F3;' : ''}">${pathogen}: ${count}</span>`;
                        })
                        .join(', ');
                    
                    if (pathogenList) {
                        pathogenDetails = `<br><small style="color: #666;">Pathogens: ${pathogenList}</small>`;
                    }
                }
                
                trainingSamplesElement.innerHTML = `
                    <strong>${trainingCount}</strong>
                    <br><small style="color: #666;">General: ${generalPCR} | Pathogen-specific: ${pathogenSpecific}</small>
                    ${pathogenDetails}
                `;
            } else {
                trainingSamplesElement.textContent = trainingCount;
            }
        }

        if (modelTrainedElement) {
            const modelTrained = stats.model_trained;
            modelTrainedElement.textContent = modelTrained ? 'Yes' : 'No';
            modelTrainedElement.style.color = modelTrained ? '#28a745' : '#dc3545';
        }

        if (pathogenModelsElement) {
            const pathogenCount = stats.pathogen_models ? stats.pathogen_models.length : 0;
            pathogenModelsElement.textContent = pathogenCount;
            
            // Show pathogen models list if available
            if (stats.pathogen_models && stats.pathogen_models.length > 0) {
                const pathogenList = stats.pathogen_models.join(', ');
                pathogenModelsElement.title = `Pathogen Models: ${pathogenList}`;
            }
        }

        // Update expert review status based on training samples
        const minSamplesForExpertReview = 50;
        const currentSamples = stats.training_samples || 0;
        
        if (expertReviewElement) {
            if (currentSamples >= minSamplesForExpertReview) {
                expertReviewElement.textContent = 'Available';
                expertReviewElement.style.color = '#28a745'; // Green
                expertReviewElement.title = 'Expert review of ML vs rule-based conflicts is now available';
            } else {
                const remaining = minSamplesForExpertReview - currentSamples;
                expertReviewElement.textContent = `${remaining} more needed`;
                expertReviewElement.style.color = '#ffc107'; // Orange
                expertReviewElement.title = `${remaining} more training samples needed before expert review becomes available`;
            }
        }

        // Show/update training progress bar
        if (trainingProgressElement && progressFillElement) {
            if (currentSamples < minSamplesForExpertReview) {
                trainingProgressElement.style.display = 'block';
                const progressPercent = Math.min((currentSamples / minSamplesForExpertReview) * 100, 100);
                progressFillElement.style.width = `${progressPercent}%`;
                
                // Update progress info text
                const progressInfo = trainingProgressElement.querySelector('.progress-info small');
                if (progressInfo) {
                    progressInfo.textContent = `Expert review available after 50+ training samples (${currentSamples}/50)`;
                }
            } else {
                trainingProgressElement.style.display = 'none';
            }
        }
    }

    /**
     * Updates the UI elements to immediately show the expert classification
     */
    updateUIWithExpertClassification(expertClassification) {
        // Update the classification display in the modal
        const classificationElements = document.querySelectorAll('.classification-display, .well-classification');
        classificationElements.forEach(element => {
            if (element.textContent.includes('SUSPICIOUS') || 
                element.textContent.includes('NEGATIVE') || 
                element.textContent.includes('POSITIVE')) {
                element.textContent = expertClassification.replace('_', ' ');
                element.className = `classification-badge ${this.getClassificationBadgeClass(expertClassification)}`;
            }
        });

        // Update any curve classification displays
        const curveClassElements = document.querySelectorAll('.curve-classification');
        curveClassElements.forEach(element => {
            element.textContent = expertClassification.replace('_', ' ');
            element.className = `classification-badge ${this.getClassificationBadgeClass(expertClassification)}`;
        });

        // Update the main classification display if visible
        const mainClassDisplay = document.querySelector('#modalDetails .classification-badge');
        if (mainClassDisplay) {
            mainClassDisplay.textContent = expertClassification.replace('_', ' ');
            mainClassDisplay.className = `classification-badge ${this.getClassificationBadgeClass(expertClassification)}`;
        }

        // CRITICAL FIX: Update the ML section in the modal (highlighted area from screenshot)
        const mlPredictionClass = document.getElementById('ml-prediction-class');
        const mlPredictionConfidence = document.getElementById('ml-prediction-confidence');
        const mlPredictionMethod = document.getElementById('ml-prediction-method');

        if (mlPredictionClass) {
            mlPredictionClass.textContent = expertClassification.replace('_', ' ');
            mlPredictionClass.className = `classification-badge ${this.getClassificationBadgeClass(expertClassification)}`;
        }

        if (mlPredictionConfidence) {
            mlPredictionConfidence.textContent = '(Expert Decision)';
        }

        if (mlPredictionMethod) {
            mlPredictionMethod.textContent = 'Expert Review';
        }

        // CRITICAL FIX: Update sample details result field in modal
        const resultElement = document.querySelector('#modalDetails .result-value, .modal-result-badge');
        if (resultElement) {
            resultElement.textContent = expertClassification.replace('_', ' ');
            resultElement.className = `result-badge ${this.getClassificationBadgeClass(expertClassification)}`;
        }
    }

    /**
     * Updates the results table after feedback submission to reflect the new classification
     */
    async updateResultsTableAfterFeedback(expertClassification) {
        try {
            console.log('🔄 Updating results table after feedback submission with:', expertClassification);
            
            // CRITICAL FIX: Backup the complete original results to prevent data loss
            if (!window.originalCompleteResults && window.currentAnalysisResults?.individual_results) {
                window.originalCompleteResults = JSON.parse(JSON.stringify(window.currentAnalysisResults.individual_results));
                console.log('💾 BACKUP: Stored original complete results with', Object.keys(window.originalCompleteResults).length, 'wells');
            }
            
            // CRITICAL FIX: Check if currentAnalysisResults has been corrupted (reduced to 1 well)
            const currentWellCount = Object.keys(window.currentAnalysisResults?.individual_results || {}).length;
            const originalWellCount = Object.keys(window.originalCompleteResults || {}).length;
            
            if (window.originalCompleteResults && currentWellCount < originalWellCount) {
                console.warn('🚨 CORRUPTION DETECTED: currentAnalysisResults reduced from', originalWellCount, 'to', currentWellCount, 'wells');
                console.log('🔄 RESTORATION: Restoring complete results from backup');
                
                // Restore the complete results
                window.currentAnalysisResults.individual_results = JSON.parse(JSON.stringify(window.originalCompleteResults));
                console.log('✅ RESTORATION: Restored', Object.keys(window.currentAnalysisResults.individual_results).length, 'wells');
            }
            
            // Update the global results object with the expert classification
            if (window.currentAnalysisResults && 
                window.currentAnalysisResults.individual_results && 
                this.currentWellKey) {
                
                const wellResult = window.currentAnalysisResults.individual_results[this.currentWellKey];
                if (wellResult) {
                    // Determine if this is an override or confirmation
                    const originalMLPrediction = wellResult.ml_classification?.classification || 
                                               wellResult.curve_classification?.classification ||
                                               wellResult.original_ml_prediction;
                    
                    // Determine the appropriate method based on whether expert agrees with ML
                    let methodType;
                    if (originalMLPrediction && originalMLPrediction.toLowerCase() === expertClassification.toLowerCase()) {
                        methodType = 'Confirmed ML';
                    } else {
                        methodType = 'Expert Decision';
                    }
                    
                    console.log(`📊 Expert feedback type: ${methodType} (Original: ${originalMLPrediction}, Expert: ${expertClassification})`);
                    
                    // Update the curve_classification with expert feedback
                    wellResult.curve_classification = {
                        classification: expertClassification,
                        confidence: 1.0, // Expert classification has 100% confidence
                        method: 'expert_feedback', // Use consistent method name that table expects
                        expert_decision_type: methodType, // Store the decision type separately for logging
                        original_ml_prediction: originalMLPrediction,
                        pathogen: wellResult.target || wellResult.specific_pathogen || 'Unknown',
                        timestamp: new Date().toISOString()
                    };
                    
                    // CRITICAL: Store expert feedback in session storage for fresh upload recovery
                    const sessionKey = `expert_feedback_${this.currentWellKey}`;
                    const expertFeedbackData = {
                        classification: expertClassification,
                        method: 'Expert Review',
                        confidence: 1.0,
                        expert_review_method: 'ml_feedback_interface',
                        timestamp: new Date().toISOString(),
                        wellKey: this.currentWellKey
                    };
                    try {
                        sessionStorage.setItem(sessionKey, JSON.stringify(expertFeedbackData));
                        console.log('💾 STORAGE: Saved expert feedback to session storage for fresh upload recovery');
                        console.log('🔑 STORAGE: Session key format:', sessionKey, '(well key format check)');
                        console.log('🔍 STORAGE: Well key components:', {
                            originalKey: this.currentWellKey,
                            hasUnderscore: this.currentWellKey.includes('_'),
                            channelFormat: this.currentWellKey.split('_').slice(1).join('_'),
                            keyLength: this.currentWellKey.length,
                            isDuplicatedChannel: this.checkForDuplicatedChannel(this.currentWellKey)
                        });
                    } catch (e) {
                        console.warn('⚠️ STORAGE: Failed to save expert feedback to session storage:', e);
                    }
                    
                    // CRITICAL FIX: Also update the main classification field
                    wellResult.classification = expertClassification;
                    
                    // Also store as ml_classification for consistency
                    wellResult.ml_classification = wellResult.curve_classification;
                    
                    console.log('✅ Updated well data with expert classification:', {
                        wellKey: this.currentWellKey,
                        classification: expertClassification,
                        method: methodType,
                        originalPrediction: originalMLPrediction,
                        pathogen: wellResult.curve_classification.pathogen
                    });
                }
            }
            
            // Update the specific table cell directly - use multiple strategies
            this.updateTableCellWithClassification(this.currentWellKey, expertClassification);
            
            // CRITICAL FIX: Create a simple function to refresh just this row
            this.refreshSingleTableRow(this.currentWellKey, expertClassification);
            
            // CRITICAL FIX: Force refresh the entire results table to show changes
            if (typeof window.refreshResultsTable === 'function') {
                console.log('🔄 Force refreshing entire results table');
                setTimeout(() => {
                    // CRITICAL: Reset filters before refreshing to show all wells
                    if (typeof window.resetFilterState === 'function') {
                        console.log('🔄 Resetting filters to show all wells after expert feedback');
                        window.resetFilterState();
                    }
                    
                    // CRITICAL: Refresh table FIRST with updated global data
                    window.refreshResultsTable();
                    
                    // CRITICAL: Build navigation AFTER table refresh to use updated data
                    setTimeout(() => {
                        if (window.buildModalNavigationList) {
                            console.log('🔄 Rebuilding modal navigation AFTER table refresh (ensuring expert feedback is preserved)');
                            window.buildModalNavigationList();
                        }
                        if (window.updateNavigationButtons) {
                            window.updateNavigationButtons();
                        }
                    }, 100);
                }, 200);
            } else if (typeof window.populateResultsTable === 'function') {
                console.log('🔄 Re-populating results table with updated data');
                // DEBUG: Log table rebuild details
                const resultsCount = window.currentAnalysisResults?.individual_results ? 
                    Object.keys(window.currentAnalysisResults.individual_results).length : 0;
                console.log(`📊 Table rebuild: ${resultsCount} wells in currentAnalysisResults.individual_results`);
                
                // CRITICAL MULTICHANNEL FIX: Preserve original results before rebuilding
                const originalResults = window.currentAnalysisResults?.individual_results;
                if (originalResults) {
                    console.log('🔍 MULTICHANNEL-FIX: Preserving original results with', Object.keys(originalResults).length, 'wells');
                    console.log('🔍 MULTICHANNEL-FIX: Well keys:', Object.keys(originalResults));
                }
                
                setTimeout(() => {
                    // CRITICAL: Reset filters before rebuilding to show all wells
                    if (typeof window.resetFilterState === 'function') {
                        console.log('🔄 Resetting filters to show all wells after expert feedback');
                        window.resetFilterState();
                    }
                    
                    // Use preserved results to ensure we don't lose wells
                    const resultsToUse = originalResults || window.currentAnalysisResults.individual_results;
                    console.log('📊 MULTICHANNEL-FIX: Rebuilding table with', Object.keys(resultsToUse || {}).length, 'wells');
                    
                    // CRITICAL: Populate table FIRST
                    window.populateResultsTable(resultsToUse);
                    
                    // CRITICAL: Build navigation AFTER table population to ensure expert feedback is preserved
                    setTimeout(() => {
                        if (window.rebuildModalNavigationIfNeeded) {
                            console.log('🔄 Triggering modal navigation rebuild AFTER table rebuild (preserving expert feedback)');
                            window.rebuildModalNavigationIfNeeded();
                        } else if (window.buildModalNavigationList) {
                            console.log('🔄 Rebuilding modal navigation AFTER table rebuild (preserving expert feedback)');
                            window.buildModalNavigationList();
                        }
                        
                        // Update navigation buttons last
                        if (window.updateNavigationButtons) {
                            window.updateNavigationButtons();
                        }
                        
                        // DO NOT apply filters again - this might hide wells
                        console.log('✅ Table and navigation rebuild complete - expert feedback preserved');
                    }, 100);
                }, 200);
            }
            
            // Refresh the modal if it's currently showing this well
            if (window.currentModalWellKey === this.currentWellKey && 
                typeof window.updateModalContent === 'function') {
                console.log('🔄 Refreshing modal content after feedback submission');
                
                // CRITICAL FIX: Don't call updateModalContent as it destroys the ML section
                // Instead, just refresh the ML section without destroying it
                if (this.isInitialized) {
                    console.log('🔄 Force refreshing ML feedback interface after modal update');
                    setTimeout(() => {
                        this.refreshMLDisplayInModal();
                    }, 100);
                }
            }
            
            // Get a fresh ML prediction for this well to show updated model performance
            setTimeout(async () => {
                try {
                    await this.refreshMLPredictionInTable(this.currentWellKey);
                } catch (error) {
                    console.log('Failed to refresh ML prediction (non-critical):', error.message);
                }
            }, 1500); // Small delay to allow backend training to complete
            
        } catch (error) {
            console.error('Failed to update results table after feedback:', error);
            // Non-critical error, don't throw
        }
    }

    /**
     * Immediately refreshes the modal to show expert feedback
     */
    refreshModalAfterFeedback(expertClassification) {
        try {
            console.log('🔄 MODAL-REFRESH: Refreshing modal after expert feedback:', expertClassification);
            
                // CRITICAL: Ensure the well data in memory has been updated first
                if (this.currentWellData) {
                    this.currentWellData.curve_classification = {
                        classification: expertClassification,
                        method: 'expert_feedback',
                        confidence: 1.0,
                        timestamp: new Date().toISOString(),
                        expert_decision_type: 'Expert Decision'
                    };
                    // ALSO set ml_classification to ensure it displays correctly
                    this.currentWellData.ml_classification = {
                        classification: expertClassification,
                        method: 'Expert Review', // Match backend format
                        confidence: 1.0,
                        expert_review_method: 'ml_feedback_interface',
                        timestamp: new Date().toISOString()
                    };
                    console.log('🔄 MODAL-REFRESH: Updated local well data with both curve_classification and ml_classification');
                }            // Verify the well data has been updated in global state
            if (window.currentAnalysisResults && 
                window.currentAnalysisResults.individual_results && 
                this.currentWellKey) {
                
                const wellResult = window.currentAnalysisResults.individual_results[this.currentWellKey];
                console.log('🔍 MODAL-REFRESH: Current well data after update:', {
                    wellKey: this.currentWellKey,
                    wellExists: !!wellResult,
                    availableKeys: Object.keys(window.currentAnalysisResults.individual_results).slice(0, 5),
                    totalWells: Object.keys(window.currentAnalysisResults.individual_results).length,
                    isMultichannel: this.currentWellKey.includes('_'),
                    classification: wellResult?.classification,
                    curve_classification: wellResult?.curve_classification,
                    ml_classification: wellResult?.ml_classification,
                    expertMethod: wellResult?.curve_classification?.method,
                    expertClassification: wellResult?.curve_classification?.classification
                });
                
                // CRITICAL: Check if the well key exists in the results
                if (!wellResult) {
                    console.error('🚨 MODAL-REFRESH: Well key not found in individual_results!', {
                        searchKey: this.currentWellKey,
                        availableKeys: Object.keys(window.currentAnalysisResults.individual_results),
                        isMultichannel: this.currentWellKey.includes('_')
                    });
                    
                    // Try to find the well by alternative keys for multichannel
                    if (this.currentWellKey.includes('_')) {
                        const baseWellId = this.currentWellKey.split('_')[0];
                        console.log('🔍 MODAL-REFRESH: Searching for multichannel alternatives for base well:', baseWellId);
                        
                        // Look for any key that starts with the base well ID
                        const matchingKeys = Object.keys(window.currentAnalysisResults.individual_results)
                            .filter(key => key.startsWith(baseWellId));
                        
                        console.log('🔍 MODAL-REFRESH: Found matching keys:', matchingKeys);
                        
                        if (matchingKeys.length > 0) {
                            // Use the first matching key as a fallback
                            const fallbackKey = matchingKeys[0];
                            const fallbackResult = window.currentAnalysisResults.individual_results[fallbackKey];
                            console.log('⚠️ MODAL-REFRESH: Using fallback key:', fallbackKey);
                            
                            // Update the fallback result instead
                            fallbackResult.curve_classification = {
                                classification: expertClassification,
                                method: 'expert_feedback',
                                confidence: 1.0,
                                timestamp: new Date().toISOString(),
                                expert_decision_type: 'Expert Decision'
                            };
                            fallbackResult.ml_classification = {
                                classification: expertClassification,
                                method: 'Expert Review',
                                confidence: 1.0,
                                expert_review_method: 'ml_feedback_interface',
                                timestamp: new Date().toISOString()
                            };
                            fallbackResult.classification = expertClassification;
                            
                            // Update the current well key to match what's actually in the data
                            this.currentWellKey = fallbackKey;
                            console.log('✅ MODAL-REFRESH: Updated currentWellKey to match data structure:', fallbackKey);
                        }
                    }
                    return; // Don't proceed if we can't find the well data
                }
                
                // Double-check that the expert feedback was properly saved
                if (!wellResult?.curve_classification || 
                    wellResult.curve_classification.method !== 'expert_feedback' ||
                    wellResult.curve_classification.classification !== expertClassification) {
                    
                    console.warn('🚨 MODAL-REFRESH: Expert feedback not properly saved, forcing update...');
                    // Force update the global data directly with both formats
                    wellResult.curve_classification = {
                        classification: expertClassification,
                        method: 'expert_feedback',
                        confidence: 1.0,
                        timestamp: new Date().toISOString(),
                        expert_decision_type: 'Expert Decision'
                    };
                    // ALSO update ml_classification for proper display
                    wellResult.ml_classification = {
                        classification: expertClassification,
                        method: 'Expert Review', // Backend format
                        confidence: 1.0,
                        expert_review_method: 'ml_feedback_interface',
                        timestamp: new Date().toISOString()
                    };
                    wellResult.classification = expertClassification;
                    console.log('🔄 MODAL-REFRESH: Forced global data update completed with both formats');
                }
            }
            
            // Force immediate modal refresh if modal is open
            if (window.currentModalWellKey === this.currentWellKey) {
                console.log('🔄 MODAL-REFRESH: Modal is open for this well, refreshing immediately');
                
                // CRITICAL FIX: Don't call updateModalDetails as it destroys the ML section
                // Instead, just update the specific result field and preserve ML section
                this.updateModalResultField(expertClassification);
                
                // Refresh the ML feedback interface display without destroying the section
                setTimeout(() => {
                    if (this.isInitialized) {
                        console.log('🔄 MODAL-REFRESH: Refreshing ML feedback interface display');
                        this.refreshMLDisplayInModal();
                    }
                }, 200);
            } else {
                console.log('🔍 MODAL-REFRESH: Modal not open for this well, skipping modal refresh');
            }
            
            console.log('✅ MODAL-REFRESH: Modal refresh process completed');
            
        } catch (error) {
            console.error('Error refreshing modal after feedback:', error);
        }
    }

    /**
     * Directly update the modal result field with expert classification
     * @param {string} expertClassification - The expert classification result
     */
    updateModalResultField(expertClassification) {
        try {
            console.log('🎯 MODAL-RESULT: Directly updating modal result field to:', expertClassification);
            
            // Find the result badge in the modal
            const resultBadge = document.querySelector('.modal-result-badge');
            if (resultBadge) {
                // Map expert classifications to modal result classes and text
                const expertClassMap = {
                    'STRONG_POSITIVE': { class: 'modal-result-pos', text: 'STRONG_POSITIVE' },
                    'POSITIVE': { class: 'modal-result-pos', text: 'POSITIVE' },
                    'WEAK_POSITIVE': { class: 'modal-result-pos', text: 'WEAK_POSITIVE' },
                    'NEGATIVE': { class: 'modal-result-neg', text: 'NEGATIVE' },
                    'INDETERMINATE': { class: 'modal-result-redo', text: 'INDETERMINATE' },
                    'REDO': { class: 'modal-result-redo', text: 'REDO' },
                    'SUSPICIOUS': { class: 'modal-result-redo', text: 'SUSPICIOUS' }
                };
                
                const resultMapping = expertClassMap[expertClassification] || 
                    { class: 'modal-result-redo', text: expertClassification };
                
                // Remove all existing modal result classes
                resultBadge.classList.remove('modal-result-pos', 'modal-result-neg', 'modal-result-redo');
                
                // Add the new class and update text
                resultBadge.classList.add(resultMapping.class);
                resultBadge.textContent = resultMapping.text;
                resultBadge.title = 'Classification source: expert_feedback';
                
                console.log('✅ MODAL-RESULT: Successfully updated result badge to:', resultMapping.text, 'with class:', resultMapping.class);
            } else {
                console.warn('⚠️ MODAL-RESULT: Result badge not found in modal');
            }
        } catch (error) {
            console.error('Error updating modal result field:', error);
        }
    }

    /**
     * Refreshes a single table row instead of the entire table
     */
    refreshSingleTableRow(wellKey, expertClassification) {
        try {
            console.log('🔄 Refreshing single table row for:', wellKey, 'with classification:', expertClassification);
            
            // Find the table row
            const tableBody = document.getElementById('resultsTableBody');
            if (!tableBody) {
                console.warn('Results table body not found');
                return;
            }
            
            // Find the row using multiple strategies
            let targetRow = null;
            
            // Strategy 1: Find by data-well-key attribute
            targetRow = tableBody.querySelector(`tr[data-well-key="${wellKey}"]`);
            
            // Strategy 2: Find by well ID in first cell
            if (!targetRow) {
                const rows = tableBody.querySelectorAll('tr');
                for (const row of rows) {
                    const firstCell = row.querySelector('td:first-child');
                    if (firstCell && firstCell.textContent.trim() === wellKey) {
                        targetRow = row;
                        break;
                    }
                }
            }
            
            // Strategy 3: Find by well part (e.g., A10 from A10_HEX)
            if (!targetRow) {
                const wellPart = wellKey.split('_')[0];
                const rows = tableBody.querySelectorAll('tr');
                for (const row of rows) {
                    const firstCell = row.querySelector('td:first-child');
                    if (firstCell && firstCell.textContent.trim() === wellPart) {
                        targetRow = row;
                        break;
                    }
                }
            }
            
            if (targetRow) {
                console.log('✅ Found target row, updating curve class cell...');
                
                // Find the curve class cell (column index 4 typically)
                const curveClassCell = targetRow.cells[4]; // Curve Class is 5th column (index 4)
                
                if (curveClassCell) {
                    // Create the expert feedback badge HTML
                    const classMap = {
                        'STRONG_POSITIVE': 'curve-strong-pos',
                        'POSITIVE': 'curve-pos',
                        'WEAK_POSITIVE': 'curve-weak-pos',
                        'NEGATIVE': 'curve-neg',
                        'INDETERMINATE': 'curve-indet',
                        'SUSPICIOUS': 'curve-suspicious',
                        'REDO': 'curve-indet'
                    };
                    
                    const badgeClass = classMap[expertClassification] || 'curve-other';
                    const displayText = expertClassification.replace('_', ' ');
                    const newHTML = `<span class="curve-badge ${badgeClass}" title="Expert Classification: ${displayText}">${displayText} ✓</span>`;
                    
                    // Update the cell
                    curveClassCell.innerHTML = newHTML;
                    
                    // Add visual highlight
                    curveClassCell.style.background = '#d4edda';
                    curveClassCell.style.border = '2px solid #28a745';
                    curveClassCell.style.fontWeight = 'bold';
                    
                    setTimeout(() => {
                        curveClassCell.style.background = '';
                        curveClassCell.style.border = '';
                        curveClassCell.style.fontWeight = '';
                    }, 3000);
                    
                    console.log('✅ Successfully updated single table row curve class cell');
                } else {
                    console.warn('Could not find curve class cell in target row');
                }
            } else {
                console.warn('Could not find target row for well:', wellKey);
            }
            
        } catch (error) {
            console.error('Error refreshing single table row:', error);
        }
    }

    /**
     * Updates the specific curve class cell in the results table
     */
    updateTableCellWithClassification(wellKey, classification) {
        try {
            console.log('🔄 Updating table cell for well:', wellKey, 'with classification:', classification);
            console.log('📊 Current analysis results exist:', !!window.currentAnalysisResults);
            
            // Debug: Check what table rows actually exist
            const allRows = document.querySelectorAll('#resultsTableBody tr, .results-table tbody tr, table tbody tr');
            console.log('🔍 Total table rows found:', allRows.length);
            
            // Show first few rows for debugging
            allRows.forEach((testRow, index) => {
                if (index < 5) { // Only log first 5 rows
                    const firstCell = testRow.querySelector('td:first-child');
                    const wellText = firstCell ? firstCell.textContent.trim() : 'NO FIRST CELL';
                    const dataWellKey = testRow.getAttribute('data-well-key');
                    console.log(`   Row ${index}: firstCell="${wellText}", data-well-key="${dataWellKey}"`);
                }
            });
            
            // Try multiple strategies to find the table row
            let row = null;
            
            // Strategy 1: By data-well-key attribute
            const rowsByData = document.querySelectorAll('#resultsTableBody tr[data-well-key="' + wellKey + '"]');
            if (rowsByData.length > 0) {
                row = rowsByData[0];
                console.log('✅ Found row by data-well-key attribute');
            } else {
                // Strategy 2: Search all rows for well ID in first cell
                const allRows = document.querySelectorAll('#resultsTableBody tr, .results-table tbody tr, table tbody tr');
                for (const testRow of allRows) {
                    const firstCell = testRow.querySelector('td:first-child');
                    if (firstCell && firstCell.textContent.trim() === wellKey) {
                        row = testRow;
                        console.log('✅ Found row by searching cell content');
                        break;
                    }
                }
                
                // Strategy 3: Try to match just the well part (e.g., A10 from A10_HEX)
                if (!row) {
                    const wellPart = wellKey.split('_')[0];
                    for (const testRow of allRows) {
                        const firstCell = testRow.querySelector('td:first-child');
                        if (firstCell && firstCell.textContent.trim() === wellPart) {
                            row = testRow;
                            console.log('✅ Found row by well part:', wellPart);
                            break;
                        }
                    }
                }
            }
            
            if (row) {
                console.log('🔍 Found table row, now looking for curve class cell...');
                console.log('📊 Row has', row.cells.length, 'cells');
                
                // Debug: Show all cell contents
                for (let i = 0; i < Math.min(row.cells.length, 10); i++) {
                    const cell = row.cells[i];
                    console.log(`   Cell ${i}: "${cell.textContent.trim()}" (${cell.innerHTML.length} chars HTML)`);
                }
                
                // Find the curve class column - try multiple column indices and search strategies
                let curveClassCell = null;
                
                // Strategy 1: Look for existing curve badge
                const existingBadge = row.querySelector('.curve-badge');
                if (existingBadge) {
                    curveClassCell = existingBadge.closest('td');
                    console.log('✅ Found curve class cell by existing badge');
                }
                
                // Strategy 2: Search by column indices  
                if (!curveClassCell) {
                    const cellIndices = [4, 5, 6, 7]; // Common positions for curve class column
                    
                    for (const index of cellIndices) {
                        const testCell = row.cells[index];
                        if (testCell) {
                            // Check if this looks like a classification cell
                            const cellText = testCell.textContent.toLowerCase();
                            if (cellText.includes('positive') || cellText.includes('negative') || 
                                cellText.includes('indeterminate') || cellText.includes('suspicious') ||
                                cellText.includes('strong') || cellText.includes('weak') ||
                                cellText.includes('unknown') || cellText.includes('ml') ||
                                testCell.querySelector('.curve-badge')) {
                                curveClassCell = testCell;
                                console.log('✅ Found curve class cell at index:', index);
                                break;
                            }
                        }
                    }
                }
                
                // Strategy 3: Look for any cell that might contain classification data
                if (!curveClassCell) {
                    for (let i = 0; i < row.cells.length; i++) {
                        const cell = row.cells[i];
                        const cellText = cell.textContent.toLowerCase();
                        if (cellText.includes('unknown') && !cellText.includes('sample')) {
                            curveClassCell = cell;
                            console.log('✅ Found curve class cell by "unknown" content at index:', i);
                            break;
                        }
                    }
                }
                
                if (curveClassCell) {
                    console.log('✅ Found curve class cell, updating...');
                    console.log('📊 Before update - cell content:', curveClassCell.innerHTML);
                    
                    const classMap = {
                        'STRONG_POSITIVE': 'curve-strong-pos',
                        'POSITIVE': 'curve-pos',
                        'WEAK_POSITIVE': 'curve-weak-pos', 
                        'NEGATIVE': 'curve-neg',
                        'INDETERMINATE': 'curve-indet',
                        'SUSPICIOUS': 'curve-suspicious'
                    };
                    
                    const badgeClass = classMap[classification] || 'curve-other';
                    const displayText = classification.replace('_', ' ');
                    const newHTML = `<span class="curve-badge ${badgeClass}" title="Expert Classification: ${displayText}">✓ ${displayText}</span>`;
                    
                    console.log('📊 New HTML content:', newHTML);
                    
                    // Update with expert feedback indicator
                    curveClassCell.innerHTML = newHTML;
                    
                    console.log('📊 After update - cell content:', curveClassCell.innerHTML);
                    
                    // Add a prominent highlight to show it was just updated
                    curveClassCell.style.background = '#d4edda';
                    curveClassCell.style.border = '2px solid #28a745';
                    curveClassCell.style.fontWeight = 'bold';
                    
                    setTimeout(() => {
                        curveClassCell.style.background = '';
                        curveClassCell.style.border = '';
                        curveClassCell.style.fontWeight = '';
                    }, 5000); // Keep highlight longer for visibility
                    
                    console.log('✅ Updated table cell for', wellKey, 'with classification:', classification);
                    
                    // CRITICAL: Rebuild modal navigation if modal is open to prevent result table issues
                    const modal = document.getElementById('chartModal');
                    if (modal && modal.style.display !== 'none' && window.buildModalNavigationList) {
                        console.log('🔄 Rebuilding modal navigation after expert classification update');
                        window.buildModalNavigationList();
                    }
                    
                    // CRITICAL: Also trigger a table refresh to ensure changes persist
                    if (typeof window.refreshResultsTable === 'function') {
                        console.log('🔄 Triggering table refresh after cell update');
                        setTimeout(() => {
                            window.refreshResultsTable();
                        }, 100);
                    }
                } else {
                    console.warn('❌ Could not find curve class cell in row for:', wellKey);
                    console.log('📊 Available cells in row:');
                    for (let i = 0; i < row.cells.length; i++) {
                        console.log(`   Cell ${i}: "${row.cells[i].textContent.trim()}" (contains badge: ${!!row.cells[i].querySelector('.curve-badge')})`);
                    }
                }
            } else {
                console.error('❌ Could not find table row for well key:', wellKey);
                console.log('🔍 Tried to find row with these strategies:');
                console.log('   1. data-well-key attribute:', `"${wellKey}"`);
                console.log('   2. First cell exact match:', `"${wellKey}"`);
                console.log('   3. Well part match:', `"${wellKey.split('_')[0]}"`);
                
                // Show what rows actually exist for debugging
                const allRowsDebug = document.querySelectorAll('#resultsTableBody tr');
                console.log('📋 Actual rows in results table:');
                allRowsDebug.forEach((testRow, index) => {
                    const firstCell = testRow.querySelector('td:first-child');
                    const dataWellKey = testRow.getAttribute('data-well-key');
                    const wellText = firstCell ? firstCell.textContent.trim() : 'NO FIRST CELL';
                    console.log(`   Row ${index}: "${wellText}" (data-well-key: "${dataWellKey}")`);
                });
                // List available rows for debugging
                const availableRows = document.querySelectorAll('#resultsTableBody tr');
                console.log('Available rows:', Array.from(availableRows).map(r => {
                    const firstCell = r.querySelector('td:first-child');
                    return firstCell ? firstCell.textContent.trim() : 'no-first-cell';
                }));
            }
        } catch (error) {
            console.error('Failed to update table cell:', error);
        }
    }

    /**
     * Updates the table cell with ML prediction results
     */
    updateTableCellWithMLPrediction(wellKey, prediction) {
        try {
            if (!wellKey) return;
            
            // Handle both string predictions and prediction objects
            let predictionClass, confidence, displayText, isRobotEmoji = false;
            if (typeof prediction === 'string') {
                predictionClass = prediction;
                confidence = null;
                displayText = prediction.replace('_', ' ');
                isRobotEmoji = prediction === '🤖';
            } else if (prediction && prediction.classification) {
                predictionClass = prediction.classification;
                confidence = prediction.confidence;
                displayText = prediction.classification.replace('_', ' ');
            } else {
                return;
            }
            
            // Try multiple ways to find the table row
            let row = null;
            
            // Method 1: By data attribute
            const rowsByData = document.querySelectorAll('#resultsTableBody tr[data-well-key="' + wellKey + '"]');
            if (rowsByData.length > 0) {
                row = rowsByData[0];
            } else {
                // Method 2: Search all table rows for matching well key
                const allRows = document.querySelectorAll('#resultsTableBody tr, .results-table tbody tr, table tbody tr');
                for (const testRow of allRows) {
                    const firstCell = testRow.querySelector('td:first-child');
                    if (firstCell && firstCell.textContent.trim() === wellKey) {
                        row = testRow;
                        break;
                    }
                }
            }
            
            if (row) {
                // Find the curve classification column
                let curveClassCell = null;
                
                // Try common column indices for curve class
                for (const columnIndex of [4, 5, 6]) {
                    const cell = row.cells[columnIndex];
                    if (cell && (cell.querySelector('.curve-badge') || cell.innerHTML.includes('curve-') || cell.innerHTML.includes('POSITIVE') || cell.innerHTML.includes('NEGATIVE'))) {
                        curveClassCell = cell;
                        break;
                    }
                }
                
                if (curveClassCell) {
                    if (isRobotEmoji) {
                        // ROBOT EMOJI SPECIAL CASE: Add robot emoji to existing content or show processing state
                        const existingBadge = curveClassCell.querySelector('.curve-badge');
                        if (existingBadge) {
                            // Add robot emoji to existing classification and store original content
                            const originalText = existingBadge.textContent;
                            const originalClass = existingBadge.className;
                            
                            // Store original state for restoration later
                            curveClassCell.dataset.originalText = originalText;
                            curveClassCell.dataset.originalClass = originalClass;
                            
                            existingBadge.innerHTML = `${originalText} 🤖`;
                            existingBadge.title = 'ML analysis in progress...';
                            existingBadge.classList.add('ml-processing');
                            console.log(`🤖 Added robot emoji to existing classification for ${wellKey}: ${originalText} 🤖`);
                        } else {
                            // No existing badge, show processing state
                            curveClassCell.innerHTML = `<span class="curve-badge curve-processing ml-processing" title="ML analysis in progress...">🤖 Processing...</span>`;
                            console.log(`🤖 Set processing state for ${wellKey}: 🤖 Processing...`);
                        }
                    } else {
                        // Normal ML prediction - check if this was previously showing robot emoji
                        const wasProcessing = curveClassCell.querySelector('.ml-processing');
                        
                        const classMap = {
                            'STRONG_POSITIVE': 'curve-strong-pos',
                            'POSITIVE': 'curve-pos',
                            'WEAK_POSITIVE': 'curve-weak-pos',
                            'NEGATIVE': 'curve-neg',
                            'INDETERMINATE': 'curve-indet',
                            'SUSPICIOUS': 'curve-suspicious'
                        };
                        
                        const badgeClass = classMap[predictionClass] || 'curve-other';
                        const confidenceText = confidence ? ` (${(confidence * 100).toFixed(1)}%)` : '';
                        
                        // If this was previously processing, show ML result with a subtle indicator
                        if (wasProcessing) {
                            curveClassCell.innerHTML = `<span class="curve-badge ${badgeClass}" title="ML: Batch analysis result${confidenceText}">${displayText} <small>🤖</small></span>`;
                            console.log(`🤖✅ Updated ${wellKey} from processing to ML result: ${predictionClass}${confidenceText}`);
                        } else {
                            curveClassCell.innerHTML = `<span class="curve-badge ${badgeClass}" title="ML: Updated via batch re-evaluation${confidenceText}">${displayText}</span>`;
                            console.log(`✅ Updated table cell for ${wellKey} with ML prediction: ${predictionClass}${confidenceText}`);
                        }
                    }
                    
                    // CRITICAL: Rebuild modal navigation if modal is open to prevent result table issues
                    const modal = document.getElementById('chartModal');
                    if (modal && modal.style.display !== 'none' && window.rebuildModalNavigationIfNeeded) {
                        console.log('🔄 Triggering modal navigation rebuild after ML prediction update');
                        setTimeout(() => window.rebuildModalNavigationIfNeeded(), 50);
                    } else if (modal && modal.style.display !== 'none' && window.buildModalNavigationList) {
                        console.log('🔄 Rebuilding modal navigation after ML prediction update (fallback)');
                        setTimeout(() => window.buildModalNavigationList(), 50);
                    }
                    
                    // Add a highlight animation to show it was updated
                    curveClassCell.style.background = '#e8f5e8';
                    curveClassCell.style.transition = 'background-color 2s ease';
                    setTimeout(() => {
                        curveClassCell.style.background = '';
                    }, 2000);
                } else {
                    console.log(`⚠️ Could not find curve classification column for ${wellKey}`);
                }
            } else {
                console.log(`⚠️ Could not find table row for ${wellKey}`);
            }
        } catch (error) {
            console.error(`Error updating table cell for ${wellKey}:`, error);
        }
    }

    /**
     * Refreshes the ML prediction for a well to show updated model performance
     */
    async refreshMLPredictionInTable(wellKey) {
        try {
            // Check for cancellation before making ML requests
            if (this.isMLAnalysisCancelled()) {
                console.log(`🛑 ML Refresh: Skipping ${wellKey} - user cancelled analysis`);
                return;
            }
            
            if (!window.currentAnalysisResults || 
                !window.currentAnalysisResults.individual_results || 
                !window.currentAnalysisResults.individual_results[wellKey]) {
                return;
            }
            
            const wellResult = window.currentAnalysisResults.individual_results[wellKey];
            
            // Prepare well data for ML prediction
            const wellData = {
                well: wellResult.well_id || wellKey.split('_')[0],
                target: wellResult.target || wellResult.specific_pathogen || '',
                sample: wellResult.sample || wellResult.sample_name || '',
                classification: 'UNKNOWN', // Ask for fresh prediction
                channel: wellResult.fluorophore || wellResult.channel || 'FAM',
                fluorophore: wellResult.fluorophore || wellResult.channel || 'FAM'
            };

            // Get fresh ML prediction
            const response = await fetch('/api/ml-analyze-curve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rfu_data: wellResult.raw_rfu,
                    cycles: wellResult.raw_cycles,
                    well_data: wellData,
                    existing_metrics: {
                        r2: wellResult.r2_score || 0,
                        steepness: wellResult.steepness || 0,
                        snr: wellResult.snr || 0,
                        midpoint: wellResult.midpoint || 0,
                        baseline: wellResult.baseline || 0,
                        amplitude: wellResult.amplitude || 0,
                        cqj: this.extractNumericValue(wellResult.cqj),
                        calcj: this.extractNumericValue(wellResult.calcj),
                        classification: 'UNKNOWN'
                    }
                })
            });

            if (response.ok) {
                const mlResult = await response.json();
                if (mlResult.success && mlResult.prediction) {
                    // Update the table cell with new ML prediction as a subtitle
                    const rows = document.querySelectorAll('#resultsTableBody tr[data-well-key="' + wellKey + '"]');
                    if (rows.length > 0) {
                        const row = rows[0];
                        const curveClassCell = row.cells[4];
                        
                        if (curveClassCell) {
                            const currentBadge = curveClassCell.querySelector('.curve-badge');
                            if (currentBadge) {
                                const confidence = (mlResult.prediction.confidence * 100).toFixed(1);
                                const mlClassification = mlResult.prediction.classification;
                                
                                // Add ML prediction as tooltip/subtitle
                                currentBadge.title = `Expert Classification: ${currentBadge.textContent.replace('✓ ', '')}\nUpdated ML Prediction: ${mlClassification} (${confidence}% confidence)`;
                                
                                console.log('✅ Refreshed ML prediction for', wellKey, ':', mlClassification, `(${confidence}%)`);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.log('Failed to refresh ML prediction:', error.message);
        }
    }

    async trackPredictionForValidation(wellData, expertClassification, submissionWellData) {
        try {
            // Extract current session information
            const sessionId = window.currentAnalysisResults?.session_id || 'unknown';
            const runFileName = window.currentAnalysisResults?.file_name || 'unknown';
            
            // Get ML prediction if available
            const mlPrediction = wellData.ml_prediction || wellData.ml_classification || wellData.classification || 'unknown';
            const mlConfidence = wellData.ml_confidence || wellData.confidence || 0;
            
            // Determine if this is an expert override
            const isOverride = expertClassification !== mlPrediction && mlPrediction !== 'unknown';
            
            const trackingData = {
                model_type: 'general_pcr', // Default for now
                pathogen_code: submissionWellData.specific_pathogen || submissionWellData.target,
                fluorophore: submissionWellData.channel || submissionWellData.fluorophore,
                run_file_name: runFileName,
                session_id: sessionId,
                test_type: submissionWellData.test_code || submissionWellData.experiment_pattern,
                well_id: wellData.well_id || submissionWellData.well,
                sample_name: submissionWellData.sample,
                ml_prediction: mlPrediction,
                ml_confidence: mlConfidence,
                expert_decision: isOverride ? expertClassification : null,
                final_classification: expertClassification,
                feature_data: {
                    r2: wellData.r2_score || 0,
                    steepness: wellData.steepness || 0,
                    snr: wellData.snr || 0,
                    midpoint: wellData.midpoint || 0,
                    baseline: wellData.baseline || 0,
                    amplitude: wellData.amplitude || 0,
                    cqj: this.extractNumericValue(wellData.cqj),
                    calcj: this.extractNumericValue(wellData.calcj)
                }
            };

            console.log('📊 Tracking ML prediction for validation:', trackingData);

            const response = await fetch('/api/ml-validation/track-prediction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(trackingData)
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    console.log('✅ Successfully tracked prediction for validation:', result);
                } else {
                    console.warn('⚠️ Failed to track prediction:', result.error);
                }
            } else {
                console.warn('⚠️ Server error tracking prediction:', response.status);
            }

        } catch (error) {
            console.error('Error tracking prediction for validation:', error);
            // Don't throw - this is auxiliary functionality
        }
    }
    
    async trackPredictionForValidation(wellData, expertClassification, submissionWellData) {
        /**
         * Track ML prediction and expert override for validation system
         */
        try {
            const trackingData = {
                well_id: submissionWellData.well,
                sample_name: submissionWellData.sample,
                pathogen_code: submissionWellData.specific_pathogen || submissionWellData.pathogen,
                fluorophore: submissionWellData.fluorophore,
                ml_prediction: wellData.ml_classification ? wellData.ml_classification.classification : 'UNKNOWN',
                ml_confidence: wellData.ml_classification ? wellData.ml_classification.confidence : 0,
                expert_decision: expertClassification,
                final_classification: expertClassification,
                run_file_name: window.currentAnalysisResults ? 
                    (window.currentAnalysisResults.metadata ? window.currentAnalysisResults.metadata.filename : 'unknown.csv') : 
                    'unknown.csv',
                session_id: window.currentSessionId || null,
                test_type: submissionWellData.test_code || this.extractTestCode(),
                model_version_used: wellData.ml_classification ? wellData.ml_classification.model_version : 'v1.0',
                feature_data: {
                    amplitude: wellData.amplitude || 0,
                    r2_score: wellData.r2_score || 0,
                    steepness: wellData.steepness || 0,
                    snr: wellData.snr || 0,
                    midpoint: wellData.midpoint || 0,
                    baseline: wellData.baseline || 0,
                    cqj: this.extractNumericValue(wellData.cqj),
                    calcj: this.extractNumericValue(wellData.calcj)
                }
            };
            
            console.log('📊 Tracking prediction for validation:', trackingData);
            
            const response = await fetch('/api/ml-validation/track-prediction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(trackingData)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Prediction tracked for validation:', result);
                
                // Also track for FDA compliance (21 CFR Part 11)
                await this.trackFDACompliance('ml_prediction_override', {
                    well_id: trackingData.well_id,
                    pathogen_code: trackingData.pathogen_code,
                    ml_prediction: trackingData.ml_prediction,
                    expert_decision: trackingData.expert_decision,
                    confidence: trackingData.ml_confidence
                });
                
            } else {
                console.warn('⚠️ Failed to track prediction for validation:', response.status);
            }
            
        } catch (error) {
            console.error('❌ Error tracking prediction for validation:', error);
            // Don't throw error - validation tracking shouldn't break the main workflow
        }
    }
    
    /**
     * Check if ML analysis has been cancelled by the user
     * This is a centralized check to prevent unnecessary ML requests
     */
    isMLAnalysisCancelled() {
        return window.mlAutoAnalysisUserChoice === 'skipped';
    }
    
    async sendBatchCancellationRequest() {
        /**
         * Send cancellation request to server to stop ongoing batch ML analysis
         */
        try {
            console.log('🛑 Sending batch cancellation request to server...');
            
            // Set the client-side cancellation flag immediately
            window.mlAutoAnalysisUserChoice = 'skipped';
            
            const response = await fetch('/api/ml-cancel-batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    reason: 'user_requested_skip'
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Server cancellation request sent successfully:', result.message);
            } else {
                console.warn('⚠️ Failed to send cancellation request to server:', response.status);
            }
            
        } catch (error) {
            console.error('❌ Error sending batch cancellation request:', error);
            // Non-blocking - cancellation request failure shouldn't break the UI
        }
    }

    /**
     * Determine if a well should get ML analysis based on edge case logic
     */
    shouldApplyMLToWell(classificationResult) {
        if (!classificationResult) return true;
        
        // Always apply ML to edge cases
        if (classificationResult.edge_case) return true;
        
        // Apply ML to samples flagged for ML review
        if (classificationResult.ml_recommended) return true;
        
        // Apply ML to low confidence classifications
        const confidence = classificationResult.confidence || 1.0;
        if (confidence < 0.75) return true;
        
        // Apply ML to uncertain classifications
        const classification = classificationResult.classification || '';
        if (['INDETERMINATE', 'SUSPICIOUS', 'WEAK_POSITIVE'].includes(classification)) {
            return true;
        }
        
        // Skip ML for confident classifications
        if (['STRONG_POSITIVE', 'POSITIVE', 'NEGATIVE'].includes(classification) && confidence >= 0.85) {
            return false;
        }
        
        // Default to ML for anything else uncertain
        return true;
    }

    /**
     * Get human-readable reason why a sample is an edge case
     */
    getEdgeCaseReason(classificationResult) {
        if (!classificationResult) return 'No classification';
        
        const edgeReasons = classificationResult.edge_case_reasons || [];
        if (edgeReasons.length > 0) {
            const reasonMap = {
                'intermediate_amplitude': 'Signal 200-600 RFU',
                'moderate_curve_quality': 'R² 0.70-0.90',
                'moderate_steepness': 'Growth 0.1-0.2',
                'moderate_snr': 'SNR 1.5-3.0',
                'valid_cqj_weak_signal': 'Valid CQJ + weak signal',
                'no_cqj_moderate_signal': 'No CQJ + moderate signal',
                'good_curve_no_cqj': 'Good curve without CQJ',
                'borderline_curve_no_cqj': 'Borderline curve without CQJ'
            };
            return edgeReasons.map(r => reasonMap[r] || r).join(', ');
        }
        
        const confidence = classificationResult.confidence || 1.0;
        const classification = classificationResult.classification || '';
        
        if (confidence < 0.75) {
            return `Low confidence (${(confidence * 100).toFixed(0)}%)`;
        } else if (['INDETERMINATE', 'SUSPICIOUS', 'WEAK_POSITIVE'].includes(classification)) {
            return `Uncertain classification (${classification})`;
        } else {
            return 'Borderline metrics';
        }
    }

    /**
     * Show notification for edge case analysis with updated counts
     */
    showEdgeCaseAnalysisNotification(edgeCaseCount, totalCount, analysisType) {
        // Remove any existing notification
        const existing = document.getElementById('ml-available-notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.id = 'ml-available-notification';
        notification.className = 'ml-notification';
        notification.innerHTML = `
            <div class="ml-notification-content">
                <div class="ml-notification-icon">🎯</div>
                <div class="ml-notification-text">
                    <strong>Edge Case ML Analysis Running</strong><br>
                    Processing ${edgeCaseCount} edge cases (${totalCount - edgeCaseCount} confident cases skipped)<br>
                    <small>Analysis Type: ${analysisType}</small>
                </div>
                <div class="ml-notification-actions">
                    <button class="ml-notification-btn secondary" onclick="window.mlFeedbackInterface.skipBatchAnalysis()">✋ Skip Analysis</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after analysis completes (handled elsewhere)
        setTimeout(() => {
            if (document.getElementById('ml-available-notification')) {
                notification.remove();
            }
        }, 300000); // 5 minutes max
    }

    async resetBatchCancellationFlag() {
        /**
         * Reset the batch cancellation flag on the server when starting new analysis
         */
        try {
            console.log('🔄 Resetting batch cancellation flag on server...');
            
            const response = await fetch('/api/ml-reset-cancellation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    action: 'reset_cancellation_flag'
                })
            });
            
            if (response.ok) {
                console.log('✅ Server cancellation flag reset successfully');
            } else {
                console.warn('⚠️ Failed to reset cancellation flag on server:', response.status);
            }
            
        } catch (error) {
            console.error('❌ Error resetting cancellation flag:', error);
            // Non-blocking - flag reset failure shouldn't break the analysis
        }
    }
    
    async trackFDACompliance(actionType, actionDetails = {}) {
        /**
         * Track user actions for FDA compliance (21 CFR Part 11)
         * Made future-proof for upcoming roles and user access system
         */
        try {
            // Prepare compliance data with defaults for current system
            // This will be enhanced when roles system is implemented
            const complianceData = {
                user_id: actionDetails.user_id || 'laboratory_operator', // Will be dynamic with roles
                user_role: actionDetails.user_role || 'operator', // Will be from user session
                action_type: actionType,
                resource_accessed: actionDetails.resource_accessed || 'qpcr_analysis_system',
                action_details: {
                    timestamp: new Date().toISOString(),
                    browser_info: navigator.userAgent,
                    session_id: window.currentSessionId || null,
                    page_url: window.location.pathname,
                    ...actionDetails
                },
                success: actionDetails.success !== undefined ? actionDetails.success : true,
                ip_address: actionDetails.ip_address || null, // Will be populated server-side
                session_id: window.currentSessionId || null
            };
            
            const response = await fetch('/api/fda-compliance/log-user-action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(complianceData)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('📋 FDA compliance action logged:', actionType, result);
            } else {
                const errorText = await response.text();
                console.warn('⚠️ Failed to log FDA compliance action:', response.status, errorText);
                
                // For development/debugging - log the error details
                if (response.status === 500) {
                    console.error('Server error details:', {
                        actionType,
                        complianceData,
                        responseStatus: response.status,
                        responseText: errorText
                    });
                }
            }
            
        } catch (error) {
            console.error('❌ Error logging FDA compliance action:', error);
            console.error('Action details:', { actionType, actionDetails });
            // Non-blocking - compliance logging shouldn't break the main workflow
            // This will be more robust when the roles system is implemented
        }
    }
    
    extractTestCode() {
        // Extract test code from current experiment pattern
        const experimentPattern = getCurrentFullPattern ? getCurrentFullPattern() : '';
        if (experimentPattern) {
            const match = experimentPattern.match(/^Ac([A-Za-z0-9]+)_/);
            return match ? match[1] : 'Unknown';
        }
        return 'Unknown';
    }

    // ===== GLOBAL DATA RECOVERY FUNCTIONS =====
    
    createOrRecoverGlobalResults(newClassification) {
        console.log('🔄 RECOVERY: Attempting to create/recover global analysis results');
        
        try {
            // Try to reconstruct the basic structure
            if (!window.currentAnalysisResults) {
                window.currentAnalysisResults = {
                    individual_results: {}
                };
                console.log('✅ RECOVERY: Created empty global analysis results structure');
            }
            
            if (!window.currentAnalysisResults.individual_results) {
                window.currentAnalysisResults.individual_results = {};
                console.log('✅ RECOVERY: Created empty individual_results structure');
            }
            
            // Create basic well data structure
            if (this.currentWellData && this.currentWellKey) {
                console.log('🔄 RECOVERY: Creating well data for', this.currentWellKey);
                
                window.currentAnalysisResults.individual_results[this.currentWellKey] = {
                    ...this.currentWellData,
                    classification: newClassification,
                    curve_classification: {
                        classification: newClassification,
                        method: 'expert_feedback',
                        confidence: 1.0,
                        timestamp: new Date().toISOString(),
                        expert_decision_type: 'Expert Decision'
                    },
                    ml_classification: {
                        classification: newClassification,
                        method: 'Expert Review',
                        confidence: 1.0,
                        expert_review_method: 'ml_feedback_interface',
                        timestamp: new Date().toISOString()
                    }
                };
                
                console.log('✅ RECOVERY: Created well data structure with expert feedback');
                
                // Force immediate refresh of the modal if it's open
                this.refreshModalAfterFeedback(newClassification);
            } else {
                console.warn('⚠️ RECOVERY: No current well data available for recovery');
            }
            
        } catch (error) {
            console.error('❌ RECOVERY: Failed to create/recover global results:', error);
        }
    }

    createOrRecoverWellData(newClassification, expertFeedbackData) {
        console.log('🔄 RECOVERY: Attempting to create well data for', this.currentWellKey);
        
        try {
            if (this.currentWellData && window.currentAnalysisResults && window.currentAnalysisResults.individual_results) {
                // Create the well data in the global structure
                window.currentAnalysisResults.individual_results[this.currentWellKey] = {
                    ...this.currentWellData,
                    classification: newClassification,
                    curve_classification: expertFeedbackData,
                    ml_classification: {
                        classification: newClassification,
                        method: 'Expert Review',
                        confidence: 1.0,
                        expert_review_method: 'ml_feedback_interface',
                        timestamp: new Date().toISOString()
                    }
                };
                
                console.log('✅ RECOVERY: Created missing well data with expert feedback');
                
                // Force immediate refresh of the modal if it's open
                this.refreshModalAfterFeedback(newClassification);
            } else {
                console.warn('⚠️ RECOVERY: Missing required data for well recovery');
            }
            
        } catch (error) {
            console.error('❌ RECOVERY: Failed to create well data:', error);
        }
    }

    // ===== MULTICHANNEL KEY FORMAT UTILITIES =====
    
    checkForDuplicatedChannel(wellKey) {
        /**
         * Check if the well key has duplicated channel format like A1_CY5_CY5
         * This can happen when the fluorophore gets appended multiple times
         */
        if (!wellKey || !wellKey.includes('_')) {
            return false;
        }
        
        const parts = wellKey.split('_');
        if (parts.length >= 3) {
            // Check if last two parts are identical (case-insensitive)
            const lastPart = parts[parts.length - 1].toUpperCase();
            const secondLastPart = parts[parts.length - 2].toUpperCase();
            
            return lastPart === secondLastPart;
        }
        
        return false;
    }
    
    normalizeWellKey(wellKey) {
        /**
         * Normalize well key to remove duplicated channels
         * A1_CY5_CY5 -> A1_CY5
         * A1_FAM_FAM -> A1_FAM
         */
        if (!wellKey || !this.checkForDuplicatedChannel(wellKey)) {
            return wellKey;
        }
        
        const parts = wellKey.split('_');
        // Remove the last part if it's a duplicate
        const normalizedKey = parts.slice(0, -1).join('_');
        
        console.log('🔧 KEY-NORMALIZE: Fixed duplicated channel:', {
            original: wellKey,
            normalized: normalizedKey,
            removed: parts[parts.length - 1]
        });
        
        return normalizedKey;
    }
    
    generateMultichannelVariations(wellKey) {
        /**
         * Generate possible variations of a multichannel well key to handle
         * inconsistencies between data structures
         * Returns array of possible keys to try
         */
        if (!wellKey || !wellKey.includes('_')) {
            return [wellKey];
        }
        
        const variations = [wellKey];
        
        // Add normalized version (remove duplicate)
        const normalized = this.normalizeWellKey(wellKey);
        if (normalized !== wellKey) {
            variations.push(normalized);
        }
        
        // Add duplicated version (in case data expects it)
        if (!this.checkForDuplicatedChannel(wellKey)) {
            const parts = wellKey.split('_');
            if (parts.length >= 2) {
                const channel = parts[parts.length - 1];
                const duplicated = wellKey + '_' + channel;
                variations.push(duplicated);
            }
        }
        
        console.log('🔀 KEY-VARIATIONS: Generated variations for', wellKey, ':', variations);
        return variations;
    }
    
    /**
     * CRITICAL FIX: Update session state when changes are made
     * This ensures persistence across page refreshes and session reloads
     */
    async updateSessionState(wellUpdates = {}, sessionUpdates = {}) {
        try {
            const sessionId = this.extractSessionId();
            if (!sessionId) {
                console.warn('⚠️ SESSION-UPDATE: No session ID available for state update');
                return false;
            }
            
            const updateData = {
                session_id: sessionId,
                well_updates: wellUpdates,
                session_updates: sessionUpdates
            };
            
            console.log('💾 SESSION-UPDATE: Updating session state:', updateData);
            
            const response = await fetch('/api/update-session-state', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ SESSION-UPDATE: Session state updated successfully:', result);
                return true;
            } else {
                const error = await response.text();
                console.error('❌ SESSION-UPDATE: Failed to update session state:', error);
                return false;
            }
            
        } catch (error) {
            console.error('❌ SESSION-UPDATE: Error updating session state:', error);
            return false;
        }
    }
    
    /**
     * CRITICAL FIX: Update specific well state and persist to session
     */
    async updateWellState(wellKey, updates) {
        try {
            // Update the in-memory results
            if (window.currentAnalysisResults?.individual_results?.[wellKey]) {
                Object.assign(window.currentAnalysisResults.individual_results[wellKey], updates);
                console.log(`🔄 WELL-UPDATE: Updated in-memory state for ${wellKey}:`, updates);
            }
            
            // Persist to database via session update
            const wellUpdates = { [wellKey]: updates };
            const success = await this.updateSessionState(wellUpdates);
            
            if (success) {
                console.log(`✅ WELL-UPDATE: Persisted ${wellKey} changes to database`);
                
                // Update the results table display
                this.updateResultsTableDisplay(wellKey, updates);
                
                return true;
            } else {
                console.error(`❌ WELL-UPDATE: Failed to persist ${wellKey} changes`);
                return false;
            }
            
        } catch (error) {
            console.error(`❌ WELL-UPDATE: Error updating well ${wellKey}:`, error);
            return false;
        }
    }
    
    /**
     * Update the results table display with new well data
     */
    updateResultsTableDisplay(wellKey, updates) {
        try {
            const tableRow = document.querySelector(`tr[data-well-key="${wellKey}"]`);
            if (!tableRow) {
                console.warn(`⚠️ TABLE-UPDATE: No table row found for ${wellKey}`);
                return;
            }
            
            // Update classification if provided
            if (updates.classification) {
                const classCell = tableRow.querySelector('.classification');
                if (classCell) {
                    classCell.textContent = updates.classification;
                    classCell.className = `classification ${updates.classification.toLowerCase()}`;
                }
            }
            
            // Update other fields as needed
            if (updates.cq_value !== undefined) {
                const cqCell = tableRow.querySelector('.cq-value');
                if (cqCell) {
                    cqCell.textContent = updates.cq_value || 'N/A';
                }
            }
            
            console.log(`🎨 TABLE-UPDATE: Updated display for ${wellKey}`);
            
        } catch (error) {
            console.error(`❌ TABLE-UPDATE: Error updating table display for ${wellKey}:`, error);
        }
    }
}

// Expose the class for testing and manual instantiation
window.MLFeedbackInterface = MLFeedbackInterface;

// Initialize the ML feedback interface
window.mlFeedbackInterface = new MLFeedbackInterface();
