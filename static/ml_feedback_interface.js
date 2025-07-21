// ML Feedback Interface for qPCR Curve Classification
// Provides ML-based curve analysis and expert feedback collection

class MLFeedbackInterface {
    constructor() {
        this.currentWellData = null;
        this.currentWellKey = null;
        this.isInitialized = false;
        this.mlStats = null;
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeInterface());
        } else {
            this.initializeInterface();
        }
    }

    async initializeInterface() {
        console.log('ML Feedback Interface: Starting initialization...');
        
        // Wait for modal body to be available (retry up to 10 times)
        let attempts = 0;
        while (attempts < 10) {
            const modalBody = document.querySelector('.modal-body');
            if (modalBody) {
                console.log('ML Feedback Interface: Modal body found, adding ML section');
                this.addMLSectionToModal();
                this.isInitialized = true;
                break;
            }
            console.log(`ML Feedback Interface: Modal body not found, attempt ${attempts + 1}/10`);
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }
        
        if (attempts >= 10) {
            console.log('ML Feedback Interface: Modal body not found after 10 attempts, will add ML section when modal is opened');
        }
        
        // Get initial ML statistics (with error handling)
        try {
            await this.updateMLStats();
            console.log('ML Feedback Interface: Initial ML stats loaded');
        } catch (error) {
            console.log('ML Feedback Interface: Failed to load initial ML stats:', error);
            // Set default stats display if loading fails
            this.displayMLStats({
                training_samples: 0,
                model_trained: false,
                pathogen_models: []
            });
        }
    }

    addMLSectionToModal() {
        console.log('ML Feedback Interface: Adding ML section below chart...');
        
        // Look for the modal body to insert ML section between chart and details
        const modalBody = document.querySelector('.modal-body');
        const chartContainer = document.querySelector('.modal-chart-container');
        const modalDetails = document.getElementById('modalDetails');
        
        if (!modalBody) {
            console.log('ML Feedback Interface: Modal body not found');
            return;
        }

        // Remove existing ML section if present
        const existingSection = document.getElementById('ml-feedback-section');
        if (existingSection) {
            existingSection.remove();
            console.log('ML Feedback Interface: Removed existing ML section');
        }

        console.log('ML Feedback Interface: Modal body found, creating ML section');
        console.log('ML Feedback Interface: Chart container found:', !!chartContainer);
        console.log('ML Feedback Interface: Modal details found:', !!modalDetails);
        
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
                    
                    <!-- CQJ/CalcJ Metrics Display -->
                    <div class="cqj-calcj-metrics" id="cqj-calcj-display" style="display: none;">
                        <h6>📊 CQJ/CalcJ Metrics</h6>
                        <div class="metrics-grid">
                            <div class="metric-item">
                                <span class="metric-label">CQJ:</span>
                                <span id="metric-cqj">-</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">CalcJ:</span>
                                <span id="metric-calcj">-</span>
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
                        </label>
                        <label class="classification-option">
                            <input type="radio" name="expert-classification" value="NEGATIVE">
                            <span class="classification-label negative">Negative</span>
                        </label>
                        <label class="classification-option">
                            <input type="radio" name="expert-classification" value="SUSPICIOUS">
                            <span class="classification-label suspicious">Suspicious</span>
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
                    </div>
                </div>
            </div>
        `;

        // Try multiple insertion strategies to ensure ML section appears AFTER sample details
        let insertionSuccess = false;
        
        // Strategy 1: Insert after modal details (sample details)
        if (modalDetails) {
            modalDetails.parentNode.insertBefore(mlSection, modalDetails.nextSibling);
            console.log('ML Feedback Interface: ML section added after sample details');
            insertionSuccess = true;
        }
        // Strategy 2: Insert after chart container if no modal details
        else if (chartContainer) {
            chartContainer.parentNode.insertBefore(mlSection, chartContainer.nextSibling);
            console.log('ML Feedback Interface: ML section added after chart container');
            insertionSuccess = true;
        }
        // Strategy 3: Fallback - append to modal body
        else {
            modalBody.appendChild(mlSection);
            console.log('ML Feedback Interface: ML section appended to modal body (fallback)');
            insertionSuccess = true;
        }
        
        if (!insertionSuccess) {
            console.error('ML Feedback Interface: Failed to insert ML section');
            return;
        }

        // Attach event listeners
        this.attachEventListeners();
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

        // Submit feedback button
        const submitBtn = document.getElementById('submit-feedback-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submitFeedback());
        }

        // Cancel feedback button
        const cancelBtn = document.getElementById('cancel-feedback-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideFeedbackForm());
        }
    }

    setCurrentWell(wellKey, wellData) {
        this.currentWellKey = wellKey;
        this.currentWellData = wellData;
        
        console.log('ML Feedback Interface: Set current well:', wellKey);
        
        // Always ensure ML section exists when a well is selected
        // This handles cases where the modal wasn't ready during initialization
        const existingSection = document.getElementById('ml-feedback-section');
        if (!existingSection) {
            console.log('ML Feedback Interface: ML section not found, adding it now');
            this.addMLSectionToModal();
        } else {
            console.log('ML Feedback Interface: ML section already exists');
        }
        
        // Reset prediction display when switching wells
        const predictionDisplay = document.getElementById('ml-prediction-display');
        const feedbackBtn = document.getElementById('ml-feedback-btn');
        const feedbackForm = document.getElementById('ml-feedback-form');
        
        if (predictionDisplay) predictionDisplay.style.display = 'none';
        if (feedbackBtn) feedbackBtn.style.display = 'none';
        if (feedbackForm) feedbackForm.style.display = 'none';
        
        // Auto-analyze the curve if ML classification doesn't exist
        if (!wellData.ml_classification) {
            setTimeout(() => this.analyzeCurveWithML(), 100);
        } else {
            this.displayExistingMLClassification(wellData.ml_classification);
        }
    }

    displayExistingMLClassification(mlClassification) {
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
            
            confidenceElement.textContent = `(${(mlClassification.confidence * 100).toFixed(1)}% confidence)`;
            methodElement.textContent = mlClassification.method || 'ML';
            
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
        if (!this.currentWellData) {
            alert('No curve data available for analysis');
            return;
        }

        console.log('ML Analysis: Starting analysis for well:', this.currentWellKey);
        console.log('ML Analysis: Current well CQJ value:', this.currentWellData.cqj, 'Type:', typeof this.currentWellData.cqj);
        console.log('ML Analysis: Current well CalcJ value:', this.currentWellData.calcj, 'Type:', typeof this.currentWellData.calcj);

        const analyzeBtn = document.getElementById('ml-analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = '🔄 Analyzing...';
        }

        try {
            console.log('Analyzing curve with ML for well:', this.currentWellKey);
            
            // Prepare well data for pathogen detection
            const wellData = {
                well: this.currentWellData.well_id || this.currentWellKey.split('_')[0],
                target: this.currentWellData.target || '',
                sample: this.currentWellData.sample || this.currentWellData.sample_name || '',
                classification: this.currentWellData.classification || 'UNKNOWN'
            };

            const response = await fetch('/api/ml-analyze-curve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rfu_data: this.currentWellData.raw_rfu,
                    cycles: this.currentWellData.raw_cycles,
                    well_data: wellData,
                    existing_metrics: {
                        r2: this.currentWellData.r2_score || 0,
                        steepness: this.currentWellData.steepness || 0,
                        snr: this.currentWellData.snr || 0,
                        midpoint: this.currentWellData.midpoint || 0,
                        baseline: this.currentWellData.baseline || 0,
                        amplitude: this.currentWellData.amplitude || 0,
                        // Only send CQJ/CalcJ if they are valid numbers > 0, otherwise send 0
                        cqj: (this.currentWellData.cqj && typeof this.currentWellData.cqj === 'number' && this.currentWellData.cqj > 0) ? this.currentWellData.cqj : 0,
                        calcj: (this.currentWellData.calcj && typeof this.currentWellData.calcj === 'number' && this.currentWellData.calcj > 0) ? this.currentWellData.calcj : 0,
                        classification: this.currentWellData.classification || 'UNKNOWN'
                    }
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('ML Analysis: Received response:', result);
                console.log('ML Analysis: Features used CQJ:', result.prediction?.features_used?.cqj);
                console.log('ML Analysis: Features used CalcJ:', result.prediction?.features_used?.calcj);
                
                if (result.success) {
                    this.displayMLResults(result);
                    
                    // Store ML classification in well data
                    this.currentWellData.ml_classification = result.prediction;
                } else {
                    throw new Error(result.error || 'ML analysis failed');
                }
            } else {
                throw new Error(`Server error: ${response.status}`);
            }

        } catch (error) {
            console.error('ML analysis error:', error);
            alert(`ML analysis failed: ${error.message}`);
        } finally {
            if (analyzeBtn) {
                analyzeBtn.disabled = false;
                analyzeBtn.textContent = '🔍 Analyze with ML';
            }
        }
    }

    displayMLResults(result) {
        const prediction = result.prediction;
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
        }
    }

    getClassificationBadgeClass(classification) {
        const classMap = {
            'STRONG_POSITIVE': 'strong-positive',
            'POSITIVE': 'positive',
            'WEAK_POSITIVE': 'weak-positive',
            'NEGATIVE': 'negative',
            'INDETERMINATE': 'indeterminate',
            'SUSPICIOUS': 'suspicious'
        };
        return classMap[classification] || 'other';
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

    async submitFeedback() {
        const selectedRadio = document.querySelector('input[name="expert-classification"]:checked');
        if (!selectedRadio) {
            alert('Please select a classification before submitting feedback.');
            return;
        }

        const expertClassification = selectedRadio.value;
        const submitBtn = document.getElementById('submit-feedback-btn');
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Submitting...';
        }

        try {
            const wellData = {
                well: this.currentWellData.well_id || this.currentWellKey.split('_')[0],
                target: this.currentWellData.target || '',
                sample: this.currentWellData.sample || this.currentWellData.sample_name || '',
                classification: this.currentWellData.classification || 'UNKNOWN'
            };

            const response = await fetch('/api/ml-submit-feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rfu_data: this.currentWellData.raw_rfu,
                    cycles: this.currentWellData.raw_cycles,
                    well_data: wellData,
                    expert_classification: expertClassification,
                    well_id: this.currentWellKey,
                    existing_metrics: {
                        r2: this.currentWellData.r2_score || 0,
                        steepness: this.currentWellData.steepness || 0,
                        snr: this.currentWellData.snr || 0,
                        midpoint: this.currentWellData.midpoint || 0,
                        baseline: this.currentWellData.baseline || 0,
                        amplitude: this.currentWellData.amplitude || 0,
                        cqj: this.currentWellData.cqj || 0,
                        calcj: this.currentWellData.calcj || 0,
                        classification: this.currentWellData.classification || 'UNKNOWN'
                    }
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    alert(`Feedback submitted successfully! Training samples: ${result.training_samples}`);
                    this.hideFeedbackForm();
                    
                    // Update the display immediately with the returned count
                    const trainingSamplesElement = document.getElementById('stat-training-samples');
                    if (trainingSamplesElement && result.training_samples) {
                        trainingSamplesElement.textContent = result.training_samples;
                    }
                    
                    // Also fetch full stats to update everything else
                    await this.updateMLStats();
                    
                    // Enhanced ML Training Strategy
                    await this.handleTrainingMilestone(result.training_samples);
                } else {
                    throw new Error(result.error || 'Feedback submission failed');
                }
            } else {
                throw new Error(`Server error: ${response.status}`);
            }

        } catch (error) {
            console.error('Feedback submission error:', error);
            alert(`Feedback submission failed: ${error.message}`);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '✅ Submit Feedback';
            }
        }
    }

    async handleTrainingMilestone(trainingCount) {
        console.log(`🎯 ML Training Milestone: ${trainingCount} samples`);
        
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
                await this.performBatchMLAnalysis(trainingCount, 'initial');
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
                await this.performBatchMLAnalysis(trainingCount, 'milestone');
            }
            
        } else if (trainingCount > 20) {
            // Individual training (not at milestone)
            this.showTrainingProgress(trainingCount);
        }
    }

    async performBatchMLAnalysis(trainingCount, analysisType) {
        console.log(`🔄 Performing ${analysisType} batch ML analysis with ${trainingCount} training samples`);
        
        try {
            // Show progress notification
            this.showBatchAnalysisProgress(true, trainingCount, analysisType);
            
            // Get current analysis results
            if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
                throw new Error('No current analysis results available for batch processing');
            }
            
            const individualResults = window.currentAnalysisResults.individual_results;
            const wellKeys = Object.keys(individualResults);
            
            console.log(`📊 Processing ${wellKeys.length} wells for batch ML analysis`);
            
            // Process wells in chunks to avoid overwhelming the server
            const chunkSize = 10;
            let processedCount = 0;
            
            for (let i = 0; i < wellKeys.length; i += chunkSize) {
                const chunk = wellKeys.slice(i, i + chunkSize);
                
                // Process chunk of wells
                const promises = chunk.map(async (wellKey) => {
                    const wellData = individualResults[wellKey];
                    return this.analyzeSingleWellWithML(wellKey, wellData);
                });
                
                await Promise.all(promises);
                processedCount += chunk.length;
                
                // Update progress
                const progress = Math.round((processedCount / wellKeys.length) * 100);
                this.updateBatchProgress(progress, processedCount, wellKeys.length);
                
                // Small delay between chunks to prevent server overload
                if (i + chunkSize < wellKeys.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            // Complete batch analysis
            this.showBatchAnalysisProgress(false, trainingCount, analysisType);
            this.showTrainingNotification(
                'Batch Analysis Complete!',
                `🎉 Successfully re-analyzed ${wellKeys.length} wells with ${trainingCount}-sample trained model.`,
                'success'
            );
            
            console.log(`✅ Batch ML analysis complete: ${wellKeys.length} wells processed`);
            
        } catch (error) {
            console.error('Batch ML analysis failed:', error);
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
            // Prepare well data for ML analysis
            const analysisData = {
                rfu_data: wellData.raw_rfu,
                cycles: wellData.raw_cycles,
                well_data: {
                    well: wellData.well_id || wellKey.split('_')[0],
                    target: wellData.target || '',
                    sample: wellData.sample || wellData.sample_name || '',
                    classification: wellData.classification || 'UNKNOWN'
                },
                existing_metrics: {
                    r2: wellData.r2_score || 0,
                    steepness: wellData.steepness || 0,
                    snr: wellData.snr || 0,
                    midpoint: wellData.midpoint || 0,
                    baseline: wellData.baseline || 0,
                    amplitude: wellData.amplitude || 0,
                    cqj: wellData.cqj || 0,
                    calcj: wellData.calcj || 0,
                    classification: wellData.classification || 'UNKNOWN'
                }
            };
            
            const response = await fetch('/api/ml-analyze-curve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(analysisData)
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // Update the well data with ML predictions
                    wellData.ml_classification = result.classification;
                    wellData.ml_confidence = result.confidence;
                    console.log(`✅ ML analysis for ${wellKey}: ${result.classification} (${result.confidence}%)`);
                } else {
                    console.error(`ML analysis failed for ${wellKey}:`, result.error);
                }
            }
            
        } catch (error) {
            console.error(`Error analyzing ${wellKey} with ML:`, error);
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
        const progressContainer = document.getElementById('ml-batch-progress');
        
        if (isStarting) {
            // Create or update progress display
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
            
            progressDiv.innerHTML = `
                <div class="batch-progress-header">
                    <h6>🔄 ${analysisType === 'initial' ? 'Initial' : 'Milestone'} Batch ML Analysis</h6>
                    <p>Processing with ${trainingCount}-sample trained model...</p>
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
            // Hide progress
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }
        }
    }

    updateBatchProgress(percentage, processed, total) {
        const progressBar = document.getElementById('ml-batch-progress-bar');
        const progressDetails = document.getElementById('ml-batch-progress-details');
        
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
            progressBar.textContent = `${percentage}%`;
        }
        
        if (progressDetails) {
            progressDetails.textContent = `Processed ${processed}/${total} wells`;
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
        
        try {
            const response = await fetch('/api/ml-stats');
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.stats) {
                    const trainingCount = result.stats.training_samples || 0;
                    
                    if (trainingCount >= 20) {
                        console.log(`🤖 Auto-ML: Model has ${trainingCount} training samples, offering automatic analysis`);
                        
                        // Show automatic analysis option for well-trained models
                        const shouldAutoAnalyze = confirm(
                            `🤖 Automatic ML Analysis Available!\n\n` +
                            `✅ ML model trained with ${trainingCount} samples\n` +
                            `🚀 Would you like to automatically analyze all samples with ML?\n\n` +
                            `This will provide instant ML predictions for the entire dataset.`
                        );
                        
                        if (shouldAutoAnalyze) {
                            await this.performBatchMLAnalysis(trainingCount, 'automatic');
                        }
                        
                        return true; // Model is ready for automatic analysis
                    } else {
                        console.log(`📚 Auto-ML: Model needs more training (${trainingCount}/20 samples)`);
                        return false; // Model needs more training
                    }
                }
            }
        } catch (error) {
            console.error('Failed to check automatic ML analysis capability:', error);
        }
        
        return false;
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

        if (trainingSamplesElement) {
            const trainingCount = stats.training_samples || 0;
            trainingSamplesElement.textContent = trainingCount;
            console.log('Updated training samples display to:', trainingCount);
        } else {
            console.error('Training samples element not found');
        }
        
        if (modelTrainedElement) {
            modelTrainedElement.textContent = stats.model_trained ? '✅ Yes' : '❌ No';
        }
        
        if (pathogenModelsElement) {
            const pathogenCount = stats.pathogen_models ? stats.pathogen_models.length : 0;
            pathogenModelsElement.textContent = pathogenCount;
        }
    }
}

// Initialize the ML feedback interface
window.mlFeedbackInterface = new MLFeedbackInterface();
