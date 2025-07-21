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
        
        // Wait for modal to be available (retry up to 10 times)
        let attempts = 0;
        while (attempts < 10) {
            const modalDetails = document.getElementById('modalDetails');
            if (modalDetails) {
                console.log('ML Feedback Interface: Modal found, adding ML section');
                this.addMLSectionToModal();
                this.isInitialized = true;
                break;
            }
            console.log(`ML Feedback Interface: Modal not found, attempt ${attempts + 1}/10`);
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }
        
        if (attempts >= 10) {
            console.log('ML Feedback Interface: Modal not found after 10 attempts, will add ML section when modal is opened');
        }
        
        // Get initial ML statistics
        await this.updateMLStats();
    }

    addMLSectionToModal() {
        console.log('ML Feedback Interface: Adding ML section to modal...');
        const modalDetails = document.getElementById('modalDetails');
        if (!modalDetails) {
            console.log('ML Feedback Interface: modalDetails element not found');
            return;
        }

        // Remove existing ML section if present
        const existingSection = document.getElementById('ml-feedback-section');
        if (existingSection) {
            existingSection.remove();
        }

        console.log('ML Feedback Interface: modalDetails found, creating ML section');
        
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

        // Add to modal details (append at the end)
        modalDetails.appendChild(mlSection);

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
        
        // Ensure ML section exists
        if (!this.isInitialized || !document.getElementById('ml-feedback-section')) {
            this.addMLSectionToModal();
        }
        
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
                        cqj: this.currentWellData.cqj || 0,
                        calcj: this.currentWellData.calcj || 0,
                        classification: this.currentWellData.classification || 'UNKNOWN'
                    }
                })
            });

            if (response.ok) {
                const result = await response.json();
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
            
            // Show CQJ/CalcJ metrics if available
            if (prediction.features_used && (prediction.features_used.cqj || prediction.features_used.calcj)) {
                const cqjElement = document.getElementById('metric-cqj');
                const calcjElement = document.getElementById('metric-calcj');
                
                if (cqjElement && calcjElement && cqjCalcjDisplay) {
                    cqjElement.textContent = prediction.features_used.cqj ? prediction.features_used.cqj.toFixed(2) : '-';
                    calcjElement.textContent = prediction.features_used.calcj ? prediction.features_used.calcj.toFixed(2) : '-';
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
                    await this.updateMLStats();
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

    async updateMLStats() {
        try {
            const response = await fetch('/api/ml-stats');
            if (response.ok) {
                const stats = await response.json();
                this.mlStats = stats;
                this.displayMLStats(stats);
            }
        } catch (error) {
            console.error('Failed to update ML stats:', error);
        }
    }

    displayMLStats(stats) {
        const trainingSamplesElement = document.getElementById('stat-training-samples');
        const modelTrainedElement = document.getElementById('stat-model-trained');
        const pathogenModelsElement = document.getElementById('stat-pathogen-models');

        if (trainingSamplesElement) {
            trainingSamplesElement.textContent = stats.training_samples || 0;
        }
        
        if (modelTrainedElement) {
            modelTrainedElement.textContent = stats.model_trained ? '✅ Yes' : '❌ No';
        }
        
        if (pathogenModelsElement) {
            const pathogenCount = stats.pathogen_models ? Object.keys(stats.pathogen_models).length : 0;
            pathogenModelsElement.textContent = pathogenCount;
        }
    }
}

// Initialize the ML feedback interface
window.mlFeedbackInterface = new MLFeedbackInterface();

    addMLSectionToModal() {
        console.log('ML Feedback Interface: Adding ML section to modal...');
        const modalDetails = document.getElementById('modalDetails');
        if (!modalDetails) {
            console.log('ML Feedback Interface: modalDetails element not found');
            return;
        }

        console.log('ML Feedback Interface: modalDetails found, creating ML section');
        
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

        // Add to modal details (append at the end)
        modalDetails.appendChild(mlSection);

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

    async analyzeCurveWithML() {
        if (!this.currentWellData) {
            alert('No curve data available for analysis');
            return;
        }

        const analyzeBtn = document.getElementById('ml-analyze-btn');
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = '🔄 Analyzing...';

        try {
            // Prepare well data for pathogen detection
            const wellData = {
                well: this.currentWellData.well || 'unknown',
                target: this.currentWellData.target || '',
                sample: this.currentWellData.sample || '',
                classification: this.currentWellData.classification || 'UNKNOWN'
            };

            const response = await fetch('/api/ml-analyze-curve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rfu_data: this.currentWellData.raw_rfu,
                    cycles: this.currentWellData.cycles,
                    well_data: wellData,
                    existing_metrics: {
                        r2: this.currentWellData.r2,
                        steepness: this.currentWellData.steepness,
                        snr: this.currentWellData.snr,
                        midpoint: this.currentWellData.midpoint,
                        baseline: this.currentWellData.baseline,
                        amplitude: this.currentWellData.amplitude,
                        classification: this.currentWellData.classification
                    }
                })
            });

            const result = await response.json();

            if (result.success) {
                this.mlPrediction = result.prediction;
                this.displayMLPrediction(result.prediction);
                this.updateMLStats(result.model_stats);
            } else {
                throw new Error(result.error || 'Analysis failed');
            }

        } catch (error) {
            console.error('ML analysis error:', error);
            alert('ML analysis failed: ' + error.message);
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = '🔍 Analyze with ML';
        }
    }

    displayMLPrediction(prediction) {
        const predictionDisplay = document.getElementById('ml-prediction-display');
        const classSpan = document.getElementById('ml-prediction-class');
        const confidenceSpan = document.getElementById('ml-prediction-confidence');
        const methodSpan = document.getElementById('ml-prediction-method');
        const feedbackBtn = document.getElementById('ml-feedback-btn');

        if (predictionDisplay && classSpan && confidenceSpan && methodSpan) {
            classSpan.textContent = prediction.classification;
            classSpan.className = `classification-badge ${prediction.classification.toLowerCase().replace('_', '-')}`;
            
            confidenceSpan.textContent = `(${(prediction.confidence * 100).toFixed(1)}%)`;
            methodSpan.textContent = prediction.method;

            // Display pathogen context if available
            const pathogenContext = document.getElementById('pathogen-context');
            const detectedPathogen = document.getElementById('detected-pathogen');
            if (pathogenContext && detectedPathogen && prediction.pathogen) {
                detectedPathogen.textContent = prediction.pathogen;
                pathogenContext.style.display = 'block';
            }

            // Display CQJ/CalcJ metrics if available
            const cqjCalcjDisplay = document.getElementById('cqj-calcj-display');
            const metricCqj = document.getElementById('metric-cqj');
            const metricCalcj = document.getElementById('metric-calcj');
            
            if (cqjCalcjDisplay && metricCqj && metricCalcj && prediction.cqj_calcj_metrics) {
                const metrics = prediction.cqj_calcj_metrics;
                metricCqj.textContent = metrics.CQJ ? metrics.CQJ.toFixed(3) : 'N/A';
                metricCalcj.textContent = metrics.CalcJ ? metrics.CalcJ.toFixed(3) : 'N/A';
                cqjCalcjDisplay.style.display = 'block';
            }

            predictionDisplay.style.display = 'block';
            if (feedbackBtn) feedbackBtn.style.display = 'inline-block';
        }
    }

    showFeedbackForm() {
        const feedbackForm = document.getElementById('ml-feedback-form');
        const currentClassification = document.getElementById('current-classification');

        if (feedbackForm && currentClassification) {
            currentClassification.textContent = this.currentWellData?.classification || 'Unknown';
            feedbackForm.style.display = 'block';
        }
    }

    hideFeedbackForm() {
        const feedbackForm = document.getElementById('ml-feedback-form');
        if (feedbackForm) {
            feedbackForm.style.display = 'none';
            // Clear radio button selections
            const radios = feedbackForm.querySelectorAll('input[type="radio"]');
            radios.forEach(radio => radio.checked = false);
        }
    }

    async submitFeedback() {
        const selectedRadio = document.querySelector('input[name="expert-classification"]:checked');
        if (!selectedRadio) {
            alert('Please select a classification before submitting feedback');
            return;
        }

        if (this.isSubmittingFeedback) return;
        this.isSubmittingFeedback = true;

        const submitBtn = document.getElementById('submit-feedback-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Submitting...';

        try {
            // Prepare well data for pathogen detection
            const wellData = {
                well: this.currentWellData.well || 'unknown',
                target: this.currentWellData.target || '',
                sample: this.currentWellData.sample || '',
                classification: this.currentWellData.classification || 'UNKNOWN'
            };

            const response = await fetch('/api/ml-submit-feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rfu_data: this.currentWellData.raw_rfu,
                    cycles: this.currentWellData.cycles,
                    well_data: wellData,
                    existing_metrics: {
                        r2: this.currentWellData.r2,
                        steepness: this.currentWellData.steepness,
                        snr: this.currentWellData.snr,
                        midpoint: this.currentWellData.midpoint,
                        baseline: this.currentWellData.baseline,
                        amplitude: this.currentWellData.amplitude,
                        classification: this.currentWellData.classification
                    },
                    expert_classification: selectedRadio.value,
                    well_id: this.currentWellData.well || 'unknown'
                })
            });

            const result = await response.json();

            if (result.success) {
                const pathogenNote = result.pathogen ? ` (Pathogen: ${result.pathogen})` : '';
                alert(`Feedback submitted successfully! Training samples: ${result.training_samples}${pathogenNote}`);
                this.hideFeedbackForm();
                await this.updateMLStats();
            } else {
                throw new Error(result.error || 'Feedback submission failed');
            }

        } catch (error) {
            console.error('Feedback submission error:', error);
            alert('Failed to submit feedback: ' + error.message);
        } finally {
            this.isSubmittingFeedback = false;
            submitBtn.disabled = false;
            submitBtn.textContent = '✅ Submit Feedback';
        }
    }

    async updateMLStats(stats = null) {
        if (!stats) {
            try {
                const response = await fetch('/api/ml-stats');
                const result = await response.json();
                if (result.success) {
                    stats = result.stats;
                }
            } catch (error) {
                console.error('Failed to fetch ML stats:', error);
                return;
            }
        }

        if (stats) {
            const trainingSamplesSpan = document.getElementById('stat-training-samples');
            const modelTrainedSpan = document.getElementById('stat-model-trained');
            const pathogenModelsSpan = document.getElementById('stat-pathogen-models');

            if (trainingSamplesSpan) {
                trainingSamplesSpan.textContent = stats.training_samples || 0;
            }
            if (modelTrainedSpan) {
                modelTrainedSpan.textContent = stats.model_trained ? '✅ Yes' : '❌ No';
                modelTrainedSpan.className = stats.model_trained ? 'status-good' : 'status-warning';
            }
            if (pathogenModelsSpan) {
                const pathogenCount = stats.pathogen_models || 0;
                pathogenModelsSpan.textContent = pathogenCount > 0 ? `${pathogenCount} trained` : 'None';
                pathogenModelsSpan.className = pathogenCount > 0 ? 'status-good' : 'status-info';
            }
        }
    }

    updateCurrentWellData(wellData) {
        this.currentWellData = wellData;
        this.mlPrediction = null;
        
        // Hide previous prediction and feedback form
        const predictionDisplay = document.getElementById('ml-prediction-display');
        const feedbackForm = document.getElementById('ml-feedback-form');
        const feedbackBtn = document.getElementById('ml-feedback-btn');
        const pathogenContext = document.getElementById('pathogen-context');
        const cqjCalcjDisplay = document.getElementById('cqj-calcj-display');

        if (predictionDisplay) predictionDisplay.style.display = 'none';
        if (feedbackForm) feedbackForm.style.display = 'none';
        if (feedbackBtn) feedbackBtn.style.display = 'none';
        if (pathogenContext) pathogenContext.style.display = 'none';
        if (cqjCalcjDisplay) cqjCalcjDisplay.style.display = 'none';
    }
}

// Global instance
window.mlFeedbackInterface = new MLFeedbackInterface();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('ML Feedback Interface: DOM loaded, initializing...');
    window.mlFeedbackInterface.initializeInterface();
    console.log('ML Feedback Interface: Initialization complete');
});
