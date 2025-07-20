// CQJ/CalcJ calculation utilities
// This file should ONLY contain calculation logic, not UI controls

/**
 * Helper function to get combined individual results from both single-channel and multichannel data
 * @returns {Object|null} Combined individual_results object or null if no data
 */
function getCombinedIndividualResults() {
    if (!window.currentAnalysisResults) {
        return null;
    }
    
    // Handle single-channel data (object format with individual_results property)
    if (window.currentAnalysisResults.individual_results) {
        return window.currentAnalysisResults.individual_results;
    }
    
    // Handle multichannel data (array format)
    if (Array.isArray(window.currentAnalysisResults)) {
        const combinedResults = {};
        window.currentAnalysisResults.forEach(channelData => {
            if (channelData.individual_results) {
                Object.assign(combinedResults, channelData.individual_results);
            }
        });
        return Object.keys(combinedResults).length > 0 ? combinedResults : null;
    }
    
    // Handle direct individual results object (multichannel loaded sessions)
    // Check if it's a flat object with well keys like "A10_Cy5_Cy5"
    if (typeof window.currentAnalysisResults === 'object' && !Array.isArray(window.currentAnalysisResults)) {
        const keys = Object.keys(window.currentAnalysisResults);
        if (keys.length > 0 && keys[0].includes('_')) {
            // This looks like a direct individual results object
            return window.currentAnalysisResults;
        }
    }
    
    return null;
}

/**
 * Calculate CQJ (threshold crossing) for a well with enhanced curve quality checks
 * Skips first 5 cycles, checks curve quality, direction, and uses LAST positive crossing
 * @param {Array<number>} rfuArray - Array of RFU values
 * @param {Array<number>} cyclesArray - Array of cycle numbers
 * @param {number} threshold - Threshold value
 * @returns {number|null} Interpolated cycle value or null if not found/poor quality
 */
function calculateThresholdCrossing(rfuArray, cyclesArray, threshold) {
    if (!rfuArray || !cyclesArray || rfuArray.length !== cyclesArray.length) {
        return null;
    }
    
    // Ensure threshold is numeric
    const numericThreshold = parseFloat(threshold);
    if (isNaN(numericThreshold) || numericThreshold <= 0) {
        return null;
    }
    
    const startCycle = 5; // Skip cycles 1-5 (indices 0-4)
    
    // Convert to numeric arrays for analysis
    const numericRfu = rfuArray.map(r => parseFloat(r));
    const numericCycles = cyclesArray.map(c => parseFloat(c));
    
    // Check curve quality first
    const curveQuality = assessCurveQuality(numericRfu, startCycle);
    if (!curveQuality.isGoodCurve) {
        return null; // N/A for poor quality curves
    }
    
    // Find ALL threshold crossings (both directions)
    const crossings = [];
    
    for (let i = startCycle + 1; i < numericRfu.length; i++) {
        const prevRfu = numericRfu[i - 1];
        const currentRfu = numericRfu[i];
        const prevCycle = numericCycles[i - 1];
        const currentCycle = numericCycles[i];
        
        // Check for crossing in either direction
        const prevAbove = prevRfu >= numericThreshold;
        const currentAbove = currentRfu >= numericThreshold;
        
        if (prevAbove !== currentAbove) {
            // Found a crossing
            const direction = currentAbove ? 'positive' : 'negative';
            
            // Calculate interpolated crossing point
            let interpolatedCq;
            if (currentRfu === prevRfu) {
                interpolatedCq = currentCycle;
            } else {
                interpolatedCq = prevCycle + 
                    (numericThreshold - prevRfu) * (currentCycle - prevCycle) / (currentRfu - prevRfu);
            }
            
            crossings.push({
                cycle: interpolatedCq,
                direction: direction,
                index: i,
                rfuBefore: prevRfu,
                rfuAfter: currentRfu
            });
        }
    }
    
    if (crossings.length === 0) {
        return null;
    }
    
    // Filter for positive direction crossings only
    const positiveCrossings = crossings.filter(c => c.direction === 'positive');
    
    if (positiveCrossings.length === 0) {
        return null; // N/A for negative-only crossings
    }
    
    // Use the LAST positive crossing to avoid flat-line confusion
    const lastPositiveCrossing = positiveCrossings[positiveCrossings.length - 1];
    
    return lastPositiveCrossing.cycle;
}

/**
 * Assess curve quality to determine if it's suitable for analysis
 * @param {Array<number>} rfuArray - Numeric RFU values
 * @param {number} startCycle - Index to start analysis from
 * @returns {Object} Quality assessment with isGoodCurve boolean and reason
 */
function assessCurveQuality(rfuArray, startCycle) {
    const analysisData = rfuArray.slice(startCycle);
    
    if (analysisData.length < 10) {
        return { isGoodCurve: false, reason: 'insufficient data points' };
    }
    
    // Check for flat lines (very low variance)
    const mean = analysisData.reduce((sum, val) => sum + val, 0) / analysisData.length;
    const variance = analysisData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / analysisData.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev < 0.01) {
        return { isGoodCurve: false, reason: 'flat line (no signal change)' };
    }
    
    // Check for excessive noise (coefficient of variation too high for low signals)
    const coefficientOfVariation = stdDev / mean;
    if (mean < 0.1 && coefficientOfVariation > 0.5) {
        return { isGoodCurve: false, reason: 'excessive noise in low signal' };
    }
    
    // Check for monotonic increase (good exponential curve should generally increase)
    const firstQuarter = analysisData.slice(0, Math.floor(analysisData.length / 4));
    const lastQuarter = analysisData.slice(-Math.floor(analysisData.length / 4));
    const firstMean = firstQuarter.reduce((sum, val) => sum + val, 0) / firstQuarter.length;
    const lastMean = lastQuarter.reduce((sum, val) => sum + val, 0) / lastQuarter.length;
    
    if (lastMean <= firstMean) {
        return { isGoodCurve: false, reason: 'no overall signal increase' };
    }
    
    // Check for reasonable signal range
    const minVal = Math.min(...analysisData);
    const maxVal = Math.max(...analysisData);
    const range = maxVal - minVal;
    
    if (range < 0.05) {
        return { isGoodCurve: false, reason: 'insufficient signal range' };
    }
    
    return { isGoodCurve: true, reason: 'passes quality checks' };
}

/**
 * Extract test code from experiment pattern (AcCtrop_2577717_CFX366496 -> Ctrop)
 */
function extractTestCode(experimentPattern) {
    if (!experimentPattern) return "";
    const testName = experimentPattern.split('_')[0];
    return testName.startsWith('Ac') ? testName.substring(2) : testName;
}

/**
 * Get the current test code using multiple fallback methods
 */
function getCurrentTestCode() {
    // Method 1: Try stored test_code from analysis results
    if (window.currentAnalysisResults?.test_code) {
        return window.currentAnalysisResults.test_code;
    }
    
    // Method 2: Extract from current pattern
    if (window.getCurrentFullPattern && typeof window.getCurrentFullPattern === 'function') {
        const pattern = window.getCurrentFullPattern();
        if (pattern) {
            return extractTestCode(pattern);
        }
    }
    
    // Method 3: Try to extract from session filename
    if (window.currentSessionData?.session?.filename) {
        const filename = window.currentSessionData.session.filename;
        
        // Extract from filename patterns like "AcCtrop_2577717_CFX366496"
        const match = filename.match(/Ac([A-Za-z]+)_\d+_CFX\d+/);
        if (match) {
            return match[1]; // Return the part after "Ac"
        }
        
        // Handle other filename patterns
        if (filename.includes('BVAB')) return 'BVAB2';
        if (filename.includes('BVPanelPCR3')) return 'BVPanelPCR3';
        if (filename.includes('Cglab')) return 'Cglab';
        if (filename.includes('Ngon')) return 'Ngon';
        if (filename.includes('Ctrach')) return 'Ctrach';
        if (filename.includes('Tvag')) return 'Tvag';
        if (filename.includes('Ctrop')) return 'Ctrop';
        if (filename.includes('Mgen')) return 'Mgen';
        if (filename.includes('Lacto')) return 'Lacto';
    }
    
    // Method 4: Try to extract from experiment pattern in window
    if (window.currentExperimentPattern) {
        return extractTestCode(window.currentExperimentPattern);
    }
    
    // Method 5: Last resort - look at actual well data for clues
    const results = getCombinedIndividualResults();
    if (results) {
        const wells = Object.values(results);
        if (wells.length > 0) {
            const sampleNames = wells.map(w => w.sample_name || '').filter(s => s);
            
            // Look for patterns in sample names
            for (const sampleName of sampleNames) {
                if (sampleName.includes('Cglab')) return 'Cglab';
                if (sampleName.includes('Ctrop')) return 'Ctrop';
                if (sampleName.includes('Ctrach')) return 'Ctrach';
                if (sampleName.includes('Tvag')) return 'Tvag';
                if (sampleName.includes('Ngon')) return 'Ngon';
                if (sampleName.includes('Lacto')) return 'Lacto';
                if (sampleName.includes('BVAB')) return 'BVAB2';
                // Add more as needed
            }
        }
    }
    
    return 'Unknown';
}

/**
 * Recalculate CQJ values for all wells using current thresholds
 */
function recalculateCQJValues() {
    const results = getCombinedIndividualResults();
    if (!results) {
        return;
    }
    
    const currentScale = window.currentScaleMode || 'linear';
    let updateCount = 0;
    let calcjUpdateCount = 0;
    
    // Get test code for CalcJ calculations using robust extraction
    const testCode = getCurrentTestCode();
    
    // Process each well
    Object.entries(results).forEach(([wellKey, well]) => {
        const channel = well.fluorophore;
        
        if (!channel || channel === 'Unknown') {
            return; // Skip wells without fluorophore
        }
        
        // Ensure wellKey is available in the well object for backend CQJ calculations
        if (!well.wellKey && !well.well_id) {
            well.wellKey = wellKey;
        }
        
        // Get threshold for this channel
        const threshold = window.getChannelThreshold ? 
            window.getChannelThreshold(channel, currentScale) : null;
        
        if (!threshold) {
            return;
        }
        
        // Parse RFU and cycles data
        let rfuArray = well.raw_rfu || well.rfu;
        let cyclesArray = well.raw_cycles || well.cycles;
        
        // Handle string data
        if (typeof rfuArray === 'string') {
            try { rfuArray = JSON.parse(rfuArray); } catch(e) { rfuArray = []; }
        }
        if (typeof cyclesArray === 'string') {
            try { cyclesArray = JSON.parse(cyclesArray); } catch(e) { cyclesArray = []; }
        }
        
        // Calculate new CQJ
        if (Array.isArray(rfuArray) && Array.isArray(cyclesArray) && rfuArray.length > 0) {
            const oldCqj = well.cqj_value;
            const newCqj = calculateThresholdCrossing(rfuArray, cyclesArray, threshold);
            
            // Update well data
            well.cqj_value = newCqj;
            well['CQ-J'] = newCqj; // Also update display field
            
            // Update CQJ object structure if it exists
            if (!well.cqj) well.cqj = {};
            well.cqj[channel] = newCqj;
            
            if (oldCqj !== newCqj) {
                updateCount++;
            }
            
            // Recalculate CalcJ (concentration) using the new CQJ
            const oldCalcj = well.calcj_value;
            let calcjResult;
            
            // CRITICAL: If CQJ is null/N/A, CalcJ must also be null/N/A
            if (newCqj === null || newCqj === undefined) {
                calcjResult = { calcj_value: null, method: 'no_cqj_value' };
            } else {
                // FORCE dynamic calculation - ignore any cached values
                calcjResult = calculateCalcjWithControls(well, threshold, results, testCode, channel);
            }
            
            // Update CalcJ in well data - FORCE null if CQJ is null
            well.calcj_value = calcjResult.calcj_value;
            well['CalcJ'] = calcjResult.calcj_value; // Also update display field
            well.calcj_method = calcjResult.method;
            
            // Update CalcJ object structure (CRITICAL FIX: Initialize if doesn't exist)
            if (!well.calcj) well.calcj = {};
            well.calcj[channel] = calcjResult.calcj_value;
            
            if (oldCalcj !== calcjResult.calcj_value) {
                calcjUpdateCount++;
            }
        }
    });
    
    // SAFETY CHECK: Ensure any well with null CQJ has null CalcJ
    let safetyFixCount = 0;
    Object.entries(results).forEach(([wellKey, well]) => {
        if ((well.cqj_value === null || well.cqj_value === undefined) && 
            (well.calcj_value !== null && well.calcj_value !== undefined)) {
            well.calcj_value = null;
            well['CalcJ'] = null;
            well.calcj_method = 'safety_fix_null_cqj';
            safetyFixCount++;
        }
    });
    
    // Update the results table
    if (window.populateResultsTable) {
        window.populateResultsTable(results);
    }
    
    // Update CQJ display values if function exists
    if (window.updateCQJDisplayValues) {
        window.updateCQJDisplayValues();
    }
}

/**
 * Calculate CalcJ using H/M/L control-based standard curve
 */
function calculateCalcjWithControls(well, threshold, allWellResults, testCode, channel) {
    // Check if we have concentration controls for this test/channel
    if (typeof CONCENTRATION_CONTROLS === 'undefined') {
        return { calcj_value: null, method: 'no_concentration_controls' };
    }
    
    const concValues = CONCENTRATION_CONTROLS[testCode]?.[channel];
    if (!concValues) {
        return { calcj_value: null, method: 'no_concentration_controls' };
    }
    
    // Find H/M/L/NTC control wells and collect their CQJ values
    const controlCqj = { H: [], M: [], L: [], NTC: [] };
    
    if (allWellResults && typeof allWellResults === 'object') {
        Object.keys(allWellResults).forEach(wellKey => {
            const wellData = allWellResults[wellKey];
            if (!wellKey || !wellData) return;
            
            // Check if this is a control well using the same logic as main script
            let controlType = null;
            const upperKey = wellKey.toUpperCase();
            const sampleName = wellData.sample_name || '';
            
            // Use the same control detection logic from script.js
            // Check for NTC first
            if (sampleName.includes('NTC')) {
                controlType = 'NTC';
            }
            // Look for H, M, L patterns at the end of sample name like AcCglab362271N01H-2573780
            else {
                const controlMatch = sampleName.match(/([HML])-?\d*$/);
                if (controlMatch) {
                    controlType = controlMatch[1];
                }
                // Alternative: check if sample ends with H, M, or L after coordinates
                else if (sampleName.includes('H-') || /[A-Z]\d+H-/.test(sampleName)) {
                    controlType = 'H';
                } else if (sampleName.includes('M-') || /[A-Z]\d+M-/.test(sampleName)) {
                    controlType = 'M';
                } else if (sampleName.includes('L-') || /[A-Z]\d+L-/.test(sampleName)) {
                    controlType = 'L';
                }
                // Check wellKey patterns as backup
                else if (upperKey.endsWith('H') || upperKey.includes('HIGH') || upperKey.includes('POS')) {
                    controlType = 'H';
                } else if (upperKey.endsWith('M') || upperKey.includes('MED')) {
                    controlType = 'M';
                } else if (upperKey.endsWith('L') || upperKey.includes('LOW')) {
                    controlType = 'L';
                }
            }
            
            // Handle control types appropriately
            if (controlType === 'NTC') {
                // NTC controls should NOT have CQJ values unless contaminated
                if (wellData.cqj_value !== null && wellData.cqj_value !== undefined) {
                    controlCqj[controlType].push(wellData.cqj_value);
                }
            } else if (controlType && wellData.cqj_value !== null && wellData.cqj_value !== undefined) {
                // H/M/L controls should have CQJ values
                controlCqj[controlType].push(wellData.cqj_value);
            }
        });
    }
    
    // Calculate average CQJ for each control level
    const avgControlCqj = {};
    Object.keys(controlCqj).forEach(controlType => {
        const cqjList = controlCqj[controlType];
        if (cqjList.length > 0) {
            avgControlCqj[controlType] = cqjList.reduce((sum, val) => sum + val, 0) / cqjList.length;
        }
    });
    
    // Check if we have enough controls for standard curve (REQUIRE H and L controls)
    if (!avgControlCqj.H || !avgControlCqj.L) {
        return { calcj_value: null, method: 'missing_required_controls' };
    }
    
    // Get CQJ for current well
    const currentCqj = well.cqj_value;
    if (currentCqj === null || currentCqj === undefined) {
        return { calcj_value: null, method: 'control_based_failed' };
    }
    
    // Check for early crossing (crossing significantly before lowest control)
    const controlCqjValues = Object.values(avgControlCqj);
    if (controlCqjValues.length > 0) {
        const minControlCqj = Math.min(...controlCqjValues);
        const maxControlCqj = Math.max(...controlCqjValues);
        const controlRange = maxControlCqj - minControlCqj;
        
        // Allow some tolerance - only mark as early crossing if significantly before controls
        const earlyThreshold = minControlCqj - Math.max(1.0, controlRange * 0.2);
        
        if (currentCqj < earlyThreshold) {
            return { calcj_value: 'N/A', method: 'early_crossing' };
        }
        
        // Also check for very late crossing (contamination or poor amplification)
        const lateThreshold = maxControlCqj + Math.max(2.0, controlRange * 0.5);
        
        if (currentCqj > lateThreshold) {
            return { calcj_value: 'N/A', method: 'late_crossing' };
        }
    }
    
    // Use ACTUAL H and L controls from this run (no fallbacks)
    const hCq = avgControlCqj.H;
    const lCq = avgControlCqj.L;
    const hVal = concValues.H;
    const lVal = concValues.L;
    
    // Validate that we have all required data
    if (!hCq || !lCq || !hVal || !lVal) {
        return { calcj_value: null, method: 'incomplete_control_data' };
    }
    
    // Calculate CalcJ using ACTUAL H/L controls from this specific run
    try {
        // Validate that we have reasonable control data
        if (Math.abs(hCq - lCq) < 0.5) {
            return { calcj_value: null, method: 'controls_too_close' };
        }
        
        // Log-linear interpolation using ACTUAL control values from this run
        const logH = Math.log10(hVal);
        const logL = Math.log10(lVal);
        
        // Calculate slope: change in log(concentration) per cycle
        // NOTE: Slope should be NEGATIVE because lower CQJ = higher concentration
        const slope = (logH - logL) / (hCq - lCq);
        const intercept = logH - slope * hCq;
        
        // Calculate concentration for current CQJ
        const logConc = slope * currentCqj + intercept;
        const calcjResult = Math.pow(10, logConc);
        
        // Enhanced sanity checks: result should be within reasonable range
        if (!isFinite(calcjResult) || calcjResult < 0 || calcjResult > 1e12 || isNaN(calcjResult)) {
            return { calcj_value: 'N/A', method: 'unreasonable_result' };
        }
        
        // Additional check for extremely small values that might round to 0
        if (calcjResult < 1e-10) {
            return { calcj_value: 'N/A', method: 'value_too_small' };
        }
        
        return { calcj_value: calcjResult, method: 'dynamic_control_based' };
    } catch (error) {
        return { calcj_value: null, method: 'calculation_error' };
    }
}

/**
 * Calculate CalcJ value (basic method - amplitude/threshold)
 */
function calculateCalcj(well, threshold) {
    // Implement your CalcJ formula here if needed
    // Example: return amplitude / threshold
    if (!well || !well.amplitude) return null;
    
    const amplitude = parseFloat(well.amplitude);
    const thresh = parseFloat(threshold);
    
    if (isNaN(amplitude) || isNaN(thresh) || thresh <= 0) return null;
    
    return amplitude / thresh;
}

// Export functions
window.calculateThresholdCrossing = calculateThresholdCrossing;
window.recalculateCQJValues = recalculateCQJValues;
window.calculateCalcj = calculateCalcj;
window.calculateCalcjWithControls = calculateCalcjWithControls;

// Alias for manual threshold changes (same function)
window.recalculateCQJValuesForManualThreshold = recalculateCQJValues;

// Force immediate CQJ and CalcJ recalculation for threshold changes (no delays)
window.forceCQJCalcJRecalculation = function(options = {}) {
    // Default options: update everything unless specifically disabled
    const {
        updateWellSelector = true,
        updateResultsTable = true,
        recalculateCQJ = true
    } = options;
    
    try {
        // Recalculate CQJ/CalcJ immediately
        if (recalculateCQJ && typeof recalculateCQJValues === 'function') {
            recalculateCQJValues();
        }
        
        // Update results table immediately
        if (updateResultsTable && typeof populateResultsTable === 'function' && window.currentAnalysisResults) {
            const resultsToDisplay = getCombinedIndividualResults();
            if (resultsToDisplay) {
                populateResultsTable(resultsToDisplay);
            }
        }
        
        // Update well selector immediately (only when specifically requested)
        if (updateWellSelector && typeof populateWellSelector === 'function' && window.currentAnalysisResults) {
            const wellsForSelector = getCombinedIndividualResults();
            if (wellsForSelector) {
                populateWellSelector(wellsForSelector);
            }
        }
        
        return true;
    } catch (error) {
        return false;
    }
};

// Alias for backward compatibility
window.calculateCqj = function(well, threshold) {
    // Convert well object to arrays and call calculateThresholdCrossing
    let rfuArray = well.raw_rfu || well.rfu;
    let cyclesArray = well.raw_cycles || well.cycles;
    
    if (typeof rfuArray === 'string') {
        try { rfuArray = JSON.parse(rfuArray); } catch(e) { rfuArray = []; }
    }
    if (typeof cyclesArray === 'string') {
        try { cyclesArray = JSON.parse(cyclesArray); } catch(e) { cyclesArray = []; }
    }
    
    return calculateThresholdCrossing(rfuArray, cyclesArray, threshold);
};
