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
        
        // Update visual curve analysis
        this.updateVisualCurveDisplay(wellData);
    }

    // Visual curve analysis functions
    analyzeVisualCurvePattern(wellData) {
        if (!wellData || !wellData.rfu_data || !wellData.cycles) {
            return {
                shape: 'Unknown',
                pattern: 'No Data',
                quality: 'N/A',
                characteristics: []
            };
        }

        const rfuData = wellData.rfu_data;
        const cycles = wellData.cycles;
        const analysis = {
            shape: this.assessCurveShape(rfuData, wellData),
            pattern: this.identifyPatternType(rfuData, wellData),
            quality: this.calculateVisualQuality(rfuData, wellData),
            characteristics: this.extractCurveCharacteristics(rfuData, wellData)
        };

        return analysis;
    }

    assessCurveShape(rfuData, wellData) {
        const amplitude = wellData.amplitude || 0;
        const isGoodSCurve = wellData.is_good_scurve;
        const r2Score = wellData.r2_score || 0;
        const steepness = wellData.steepness || 0;

        if (!isGoodSCurve) {
            if (amplitude < 100) return 'Flat/No Rise';
            if (r2Score < 0.5) return 'Irregular/Noisy';
            return 'Poor S-Curve';
        }

        if (steepness > 0.5) return 'Sharp S-Curve';
        if (steepness > 0.3) return 'Good S-Curve';
        if (steepness > 0.1) return 'Gradual S-Curve';
        return 'Weak S-Curve';
    }

    identifyPatternType(rfuData, wellData) {
        const amplitude = wellData.amplitude || 0;
        const snr = wellData.snr || 0;
        const hasAnomalies = wellData.anomalies && wellData.anomalies.length > 0;

        if (amplitude < 200) return 'Negative/Background';
        if (hasAnomalies) {
            const anomalies = wellData.anomalies;
            if (anomalies.includes('early_plateau')) return 'Early Plateau';
            if (anomalies.includes('high_noise')) return 'High Noise';
            if (anomalies.includes('unstable_baseline')) return 'Unstable Baseline';
            return 'Anomalous';
        }
        
        if (amplitude > 1000 && snr > 15) return 'Strong Positive';
        if (amplitude > 500 && snr > 8) return 'Clear Positive';
        if (amplitude > 300 && snr > 4) return 'Weak Positive';
        return 'Borderline';
    }

    calculateVisualQuality(rfuData, wellData) {
        const r2Score = wellData.r2_score || 0;
        const snr = wellData.snr || 0;
        const amplitude = wellData.amplitude || 0;
        
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

    // Update the display with visual analysis
    updateVisualCurveDisplay(wellData) {
        const analysis = this.analyzeVisualCurvePattern(wellData);
        
        // Update visual metrics
        const shapeElement = document.getElementById('curve-shape-assessment');
        const patternElement = document.getElementById('curve-pattern-type');
        const qualityElement = document.getElementById('visual-quality-score');
        const characteristicsElement = document.getElementById('curve-characteristics');

        if (shapeElement) shapeElement.textContent = analysis.shape;
        if (patternElement) patternElement.textContent = analysis.pattern;
        if (qualityElement) qualityElement.textContent = analysis.quality;
        
        // Update characteristics tags
        if (characteristicsElement) {
            characteristicsElement.innerHTML = analysis.characteristics
                .map(char => `<span class="characteristic-tag">${char}</span>`)
                .join('');
        }

        // Show the visual analysis section
        const visualDisplay = document.getElementById('visual-curve-display');
        if (visualDisplay) {
            visualDisplay.style.display = 'block';
        }
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

    // ===== CHANNEL-SPECIFIC PATHOGEN EXTRACTION =====
    
    extractChannelSpecificPathogen() {
        // Extract channel-specific pathogen information for multichannel experiments
        const currentExperimentPattern = (typeof getCurrentFullPattern === 'function') ? getCurrentFullPattern() : null;
        const testCode = (typeof extractTestCode === 'function' && currentExperimentPattern) ? 
            extractTestCode(currentExperimentPattern) : null;
        
        // Get channel from current well data
        const channel = this.currentWellData.channel || this.currentWellData.fluorophore || '';
        
        // Try to get specific pathogen for this channel
        let specificPathogen = null;
        
        if (testCode && channel && typeof getPathogenTarget === 'function') {
            try {
                specificPathogen = getPathogenTarget(testCode, channel);
                console.log(`🧬 Channel-specific pathogen: ${testCode} + ${channel} = ${specificPathogen}`);
            } catch (error) {
                console.log(`⚠️ Could not get pathogen target for ${testCode}/${channel}:`, error);
            }
        }
        
        // Fallback to target field or experiment pattern
        if (!specificPathogen) {
            specificPathogen = this.currentWellData.target || testCode;
        }
        
        return {
            experimentPattern: currentExperimentPattern,
            testCode: testCode,
            channel: channel,
            pathogen: specificPathogen
        };
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
            
            // Get channel-specific pathogen information
            const channelData = this.extractChannelSpecificPathogen();
            
            // Prepare well data for pathogen detection
            const wellData = {
                well: this.currentWellData.well_id || this.currentWellKey.split('_')[0],
                target: this.currentWellData.target || '',
                sample: this.currentWellData.sample || this.currentWellData.sample_name || '',
                classification: this.currentWellData.classification || 'UNKNOWN',
                channel: channelData.channel,
                specific_pathogen: channelData.pathogen,
                experiment_pattern: channelData.experimentPattern
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
            // Get channel-specific pathogen information
            const channelData = this.extractChannelSpecificPathogen();
            
            const wellData = {
                well: this.currentWellData.well_id || this.currentWellKey.split('_')[0],
                target: this.currentWellData.target || '',
                sample: this.currentWellData.sample || this.currentWellData.sample_name || '',
                classification: this.currentWellData.classification || 'UNKNOWN',
                channel: channelData.channel,
                specific_pathogen: channelData.pathogen,
                experiment_pattern: channelData.experimentPattern
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
            
            // Show appropriate completion message based on analysis type
            let completionTitle = '';
            let completionMessage = '';
            
            switch (analysisType) {
                case 'automatic':
                    completionTitle = 'Automatic Analysis Complete!';
                    completionMessage = `🎉 Successfully analyzed ${wellKeys.length} wells with pathogen-specific ${trainingCount}-sample model.`;
                    break;
                case 'cross-pathogen':
                    completionTitle = 'Cross-Pathogen Analysis Complete!';
                    completionMessage = `⚠️ Analyzed ${wellKeys.length} wells with general ${trainingCount}-sample model. Results may need manual review for accuracy.`;
                    break;
                case 'initial':
                    completionTitle = 'Initial Batch Analysis Complete!';
                    completionMessage = `🎉 Successfully re-analyzed ${wellKeys.length} wells with ${trainingCount}-sample trained model.`;
                    break;
                case 'milestone':
                    completionTitle = 'Milestone Analysis Complete!';
                    completionMessage = `📈 Successfully re-analyzed ${wellKeys.length} wells with updated ${trainingCount}-sample model.`;
                    break;
                default:
                    completionTitle = 'Batch Analysis Complete!';
                    completionMessage = `🎉 Successfully analyzed ${wellKeys.length} wells with ${trainingCount}-sample trained model.`;
            }
            
            this.showTrainingNotification(completionTitle, completionMessage, 'success');
            
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
            // Get current test code from the uploaded experiment
            const currentExperimentPattern = (typeof getCurrentFullPattern === 'function') ? getCurrentFullPattern() : null;
            const currentTestCode = (typeof extractTestCode === 'function' && currentExperimentPattern) ? 
                extractTestCode(currentExperimentPattern) : null;
                
            console.log(`🧬 Auto-ML: Current test code: ${currentTestCode} (from pattern: ${currentExperimentPattern})`);
            
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
                            onAccept: () => this.performBatchMLAnalysis(currentPathogenModel.training_samples, 'automatic'),
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
                            onAccept: () => this.performBatchMLAnalysis(totalTrainingCount, 'cross-pathogen'),
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

    showMLAvailableNotification(options) {
        // Create non-blocking notification banner instead of blocking popup
        const { type, pathogen, samples, onAccept, onDecline } = options;
        
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
                            <strong>Automatic ML Analysis Available!</strong><br>
                            🧬 Pathogen: <strong>${pathogen}</strong> | 
                            ✅ ML model trained with <strong>${samples}</strong> samples for this pathogen<br>
                            <small>Instant ML predictions tailored to ${pathogen} are ready</small>
                        </div>
                        <div class="ml-notification-actions">
                            <button class="ml-notification-btn primary" onclick="this.parentElement.parentElement.parentElement.acceptAction()">
                                🚀 Analyze with ML
                            </button>
                            <button class="ml-notification-btn secondary" onclick="this.parentElement.parentElement.parentElement.declineAction()">
                                ❌ Skip
                            </button>
                        </div>
                    </div>
                `;
                break;
                
            case 'cross-pathogen':
                notificationClass = 'ml-notification-warning';
                notificationContent = `
                    <div class="ml-notification-content">
                        <div class="ml-notification-icon">⚠️</div>
                        <div class="ml-notification-text">
                            <strong>ML Analysis Available (Different Pathogen)</strong><br>
                            🧬 Current test: <strong>${pathogen}</strong> | 
                            📚 ML model trained with <strong>${samples}</strong> samples from different pathogen(s)<br>
                            <small>General curve patterns may apply (results may be less accurate)</small>
                        </div>
                        <div class="ml-notification-actions">
                            <button class="ml-notification-btn primary" onclick="this.parentElement.parentElement.parentElement.acceptAction()">
                                🔄 Try ML Analysis
                            </button>
                            <button class="ml-notification-btn secondary" onclick="this.parentElement.parentElement.parentElement.declineAction()">
                                ❌ Skip
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
            if (onAccept) onAccept();
            notification.remove();
        };
        
        notification.declineAction = () => {
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
