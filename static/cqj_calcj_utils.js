// CQJ/CalcJ calculation utilities
// This file should ONLY contain calculation logic, not UI controls

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
    if (window.currentAnalysisResults?.individual_results) {
        const wells = Object.values(window.currentAnalysisResults.individual_results);
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
    if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
        return;
    }
    
    const results = window.currentAnalysisResults.individual_results;
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
            
            // FORCE CLEAR any old calcj object values to prevent caching issues
            if (well.calcj && channel) {
                well.calcj[channel] = calcjResult.calcj_value;
            }
            
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

// Simple debug function to check control detection
window.debugControlDetection = function() {
    if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
        console.log('DEBUG: No analysis results available');
        return;
    }
    
    const results = window.currentAnalysisResults.individual_results;
    const testCode = getCurrentTestCode();
    console.log(`DEBUG: Test code = ${testCode}`);
    
    const controlCqj = { H: [], M: [], L: [], NTC: [] };
    
    Object.keys(results).forEach(wellKey => {
        const wellData = results[wellKey];
        if (!wellKey || !wellData) return;
        
        const sampleName = wellData.sample_name || '';
        let controlType = null;
        
        // Use the same control detection logic as calculateCalcjWithControls
        if (sampleName.includes('NTC')) {
            controlType = 'NTC';
        } else {
            const controlMatch = sampleName.match(/([HML])-?\d*$/);
            if (controlMatch) {
                controlType = controlMatch[1];
            }
        }
        
        if (controlType && wellData.cqj_value !== null && wellData.cqj_value !== undefined) {
            controlCqj[controlType].push({
                wellKey: wellKey,
                sampleName: sampleName,
                cqj: wellData.cqj_value
            });
        }
    });
    
    console.log('DEBUG: Found controls:', controlCqj);
    
    // Check if we have H and L controls
    const hasH = controlCqj.H.length > 0;
    const hasL = controlCqj.L.length > 0;
    console.log(`DEBUG: Has H controls: ${hasH}, Has L controls: ${hasL}`);
    
    if (hasH && hasL) {
        const hAvg = controlCqj.H.reduce((sum, c) => sum + c.cqj, 0) / controlCqj.H.length;
        const lAvg = controlCqj.L.reduce((sum, c) => sum + c.cqj, 0) / controlCqj.L.length;
        console.log(`DEBUG: H avg CQJ: ${hAvg.toFixed(2)}, L avg CQJ: ${lAvg.toFixed(2)}`);
    }
};

// Debug function to test curve quality assessment
window.debugCurveQuality = function(wellKey) {
    if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
        return { error: 'No analysis results available' };
    }
    
    const well = window.currentAnalysisResults.individual_results[wellKey];
    if (!well) {
        return { error: `Well ${wellKey} not found` };
    }
    
    let rfuArray = well.raw_rfu || well.rfu;
    if (typeof rfuArray === 'string') {
        try { rfuArray = JSON.parse(rfuArray); } catch(e) { rfuArray = []; }
    }
    
    if (!Array.isArray(rfuArray) || rfuArray.length === 0) {
        return { error: `No RFU data for well ${wellKey}` };
    }
    
    const numericRfu = rfuArray.map(r => parseFloat(r));
    const quality = assessCurveQuality(numericRfu, 5);
    
    return {
        wellKey,
        isGoodCurve: quality.isGoodCurve,
        reason: quality.reason,
        dataPoints: numericRfu.length,
        rfuRange: [Math.min(...numericRfu), Math.max(...numericRfu)],
        mean: numericRfu.reduce((sum, val) => sum + val, 0) / numericRfu.length,
        stdDev: Math.sqrt(numericRfu.reduce((sum, val) => sum + Math.pow(val - (numericRfu.reduce((s, v) => s + v, 0) / numericRfu.length), 2), 0) / numericRfu.length)
    };
};

// Debug function to test CalcJ formula issue
window.debugCalcJFormula = function(testCqjValues = [null, 22.80, 29.39]) {
    const results = [];
    testCqjValues.forEach((cqj, index) => {
        const labels = ['NTC', 'H', 'M'];
        let calcj;
        
        if (index === 0) { // NTC
            calcj = (cqj === null || cqj === undefined) ? null : calculateCalcj({ cqj_value: cqj }, 100);
        } else {
            calcj = calculateCalcj({ cqj_value: cqj }, 100);
        }
        
        results.push({ label: labels[index], cqj, calcj });
    });
    
    return results;
};

// Debug function to inspect well data structure on backend
window.debugWellData = async function(sessionId = null) {
    try {
        if (!sessionId && window.currentAnalysisResults && window.currentAnalysisResults.session_id) {
            sessionId = window.currentAnalysisResults.session_id;
        }
        
        if (!sessionId) {
            return { error: 'No session ID provided or available' };
        }
        
        const response = await fetch(`/debug/well-data/${sessionId}`);
        const data = await response.json();
        
        return data;
    } catch (error) {
        return { error: error.message };
    }
};

// Debug function to test CQJ calculation for a specific well
window.debugTestCQJ = async function(wellId, sessionId = null) {
    try {
        if (!sessionId && window.currentAnalysisResults && window.currentAnalysisResults.session_id) {
            sessionId = window.currentAnalysisResults.session_id;
        }
        
        if (!sessionId || !wellId) {
            return { error: 'Missing session ID or well ID' };
        }
        
        const response = await fetch(`/debug/test-cqj/${sessionId}/${wellId}`);
        const data = await response.json();
        
        return data;
    } catch (error) {
        return { error: error.message };
    }
};

// Test function to show exact CalcJ calculations
window.testCalcJCalculations = function() {
    // Your actual control values
    const hCqj = 16.34;
    const lCqj = 29.39;
    const hConc = 1.00e7;  // 1.00E+7
    const lConc = 1.00e3;  // 1.00E+3
    
    // Show the math
    const logH = Math.log10(hConc);
    const logL = Math.log10(lConc);
    const slope = (logH - logL) / (hCqj - lCqj);
    const intercept = logH - slope * hCqj;
    
    return { slope, intercept, hCqj, lCqj, hConc, lConc };
};

// Test function using ACTUAL controls from current session (simplified)
window.testActualSessionCalcJ = function() {
    if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
        return { error: 'No analysis results available' };
    }
    
    const results = window.currentAnalysisResults.individual_results;
    const testCode = getCurrentTestCode();
    
    // Find H/L controls quickly - include NTC to avoid errors
    const controlCqj = { H: [], L: [], M: [], NTC: [] };
    
    Object.keys(results).forEach(wellKey => {
        const wellData = results[wellKey];
        if (!wellKey || !wellData || !wellData.cqj_value) return;
        
        const sampleName = wellData.sample_name || '';
        let controlType = null;
        
        // Use same control detection logic as main calculation
        if (sampleName.includes('NTC')) {
            controlType = 'NTC';
        } else {
            const controlMatch = sampleName.match(/([HML])-?\d*$/);
            if (controlMatch) {
                controlType = controlMatch[1];
            } else if (sampleName.includes('H-') || /[A-Z]\d+H-/.test(sampleName)) {
                controlType = 'H';
            } else if (sampleName.includes('M-') || /[A-Z]\d+M-/.test(sampleName)) {
                controlType = 'M';
            } else if (sampleName.includes('L-') || /[A-Z]\d+L-/.test(sampleName)) {
                controlType = 'L';
            }
        }
        
        if (controlType && controlCqj[controlType]) {
            controlCqj[controlType].push({ wellKey, cqj: wellData.cqj_value, sample: wellData.sample_name });
        }
    });
    
    if (controlCqj.H.length === 0 || controlCqj.L.length === 0) {
        return { error: 'Missing H or L controls', available: controlCqj };
    }
    
    // Calculate averages
    const hCqj = controlCqj.H.reduce((sum, val) => sum + val.cqj, 0) / controlCqj.H.length;
    const lCqj = controlCqj.L.reduce((sum, val) => sum + val.cqj, 0) / controlCqj.L.length;
    const mCqj = controlCqj.M.length > 0 ? controlCqj.M.reduce((sum, val) => sum + val.cqj, 0) / controlCqj.M.length : null;
    
    // Get concentration values
    if (typeof CONCENTRATION_CONTROLS === 'undefined') {
        return { error: 'CONCENTRATION_CONTROLS not available' };
    }
    
    const concValues = CONCENTRATION_CONTROLS[testCode]?.FAM;
    if (!concValues) {
        return { error: `No controls for ${testCode}/FAM` };
    }
    
    const hConc = concValues.H;
    const lConc = concValues.L;
    const mConc = concValues.M;
    
    // Calculate slope
    const logH = Math.log10(hConc);
    const logL = Math.log10(lConc);
    const slope = (logH - logL) / (hCqj - lCqj);
    const intercept = logH - slope * hCqj;
    
    return { 
        testCode, 
        slope, 
        hCqj, lCqj, mCqj, 
        hConc, lConc, mConc, 
        controlCqj,
        slopeValid: slope < 0
    };
};

// Quick debug function to see what wells we have
window.debugWellNames = function() {
    if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
        return { error: 'No analysis results available' };
    }
    
    const results = window.currentAnalysisResults.individual_results;
    const wells = [];
    
    Object.keys(results).forEach(wellKey => {
        const wellData = results[wellKey];
        wells.push({
            wellKey,
            sample: wellData.sample_name,
            fluorophore: wellData.fluorophore,
            cqj: wellData.cqj_value,
            calcj: wellData.calcj_value
        });
    });
    
    return wells;
};

// Simple function to check what analysis data is available
window.debugAnalysisAvailability = function() {
    const analysisVars = Object.keys(window).filter(k => 
        k.includes('analysis') || k.includes('session') || k.includes('result') || k.includes('data')
    );
    
    return {
        currentAnalysisResults: !!window.currentAnalysisResults,
        currentSessionData: !!window.currentSessionData,
        analysisVars,
        individualResultsCount: window.currentAnalysisResults?.individual_results ? 
            Object.keys(window.currentAnalysisResults.individual_results).length : 0
    };
};

// Comprehensive debug function for fresh upload issues
window.debugFreshUpload = function() {
    if (!window.currentAnalysisResults) {
        return { error: 'no_analysis_results' };
    }
    
    const results = window.currentAnalysisResults.individual_results;
    if (!results) {
        return { error: 'no_individual_results' };
    }
    
    const testCode = getCurrentTestCode();
    
    // Check CONCENTRATION_CONTROLS availability
    if (typeof CONCENTRATION_CONTROLS === 'undefined') {
        return { error: 'no_concentration_controls' };
    }
    
    const concValues = CONCENTRATION_CONTROLS[testCode];
    if (!concValues) {
        return { error: 'no_test_code_match', availableTests: Object.keys(CONCENTRATION_CONTROLS) };
    }
    
    // Check each channel
    const channelAnalysis = {};
    Object.keys(concValues).forEach(channel => {
        // Find wells for this channel
        const channelWells = Object.keys(results).filter(wellKey => {
            const well = results[wellKey];
            return well.fluorophore === channel;
        });
        
        if (channelWells.length === 0) {
            channelAnalysis[channel] = { error: 'no_wells' };
            return;
        }
        
        // Check for controls
        const controlCqj = { H: [], M: [], L: [], NTC: [] };
        const nonControlWells = [];
        
        channelWells.forEach(wellKey => {
            const wellData = results[wellKey];
            const sampleName = wellData.sample_name || '';
            const upperKey = wellKey.toUpperCase();
            
            let controlType = null;
            
            // Use the same control detection logic as calculateCalcjWithControls
            if (sampleName.includes('NTC')) {
                controlType = 'NTC';
            } else {
                const controlMatch = sampleName.match(/([HML])-?\d*$/);
                if (controlMatch) {
                    controlType = controlMatch[1];
                } else if (sampleName.includes('H-') || /[A-Z]\d+H-/.test(sampleName)) {
                    controlType = 'H';
                } else if (sampleName.includes('M-') || /[A-Z]\d+M-/.test(sampleName)) {
                    controlType = 'M';
                } else if (sampleName.includes('L-') || /[A-Z]\d+L-/.test(sampleName)) {
                    controlType = 'L';
                } else if (upperKey.endsWith('H') || upperKey.includes('HIGH') || upperKey.includes('POS')) {
                    controlType = 'H';
                } else if (upperKey.endsWith('M') || upperKey.includes('MED')) {
                    controlType = 'M';
                } else if (upperKey.endsWith('L') || upperKey.includes('LOW')) {
                    controlType = 'L';
                }
            }
            
            if (controlType && wellData.cqj_value !== null && wellData.cqj_value !== undefined) {
                controlCqj[controlType].push({
                    wellKey: wellKey,
                    sampleName: sampleName,
                    cqj: wellData.cqj_value,
                    calcj: wellData.calcj_value
                });
            } else if (controlType !== 'NTC') {
                nonControlWells.push({
                    wellKey: wellKey,
                    sampleName: sampleName,
                    cqj: wellData.cqj_value,
                    calcj: wellData.calcj_value
                });
            }
        });
        
        // Analyze control detection
        const hCount = controlCqj.H.length;
        const lCount = controlCqj.L.length;
        const mCount = controlCqj.M.length;
        
        if (hCount === 0 || lCount === 0) {
            channelAnalysis[channel] = { 
                error: 'missing_controls', 
                hCount, lCount, mCount,
                nonControlWells: nonControlWells.slice(0, 3) // Show first 3 non-control wells
            };
        } else {
            // Calculate what CalcJ should be
            const hCqj = controlCqj.H.reduce((sum, c) => sum + c.cqj, 0) / controlCqj.H.length;
            const lCqj = controlCqj.L.reduce((sum, c) => sum + c.cqj, 0) / controlCqj.L.length;
            
            channelAnalysis[channel] = {
                success: true,
                hCount, lCount, mCount,
                hCqj, lCqj,
                controlCqj,
                nonControlWells: nonControlWells.length
            };
        }
    });
    
    return {
        testCode,
        totalWells: Object.keys(results).length,
        channelAnalysis,
        concentrationControls: concValues
    };
};
window.debugDetectedControls = function() {
    if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
        return { error: 'No analysis results available' };
    }
    
    const results = window.currentAnalysisResults.individual_results;
    const controlCqj = { H: [], M: [], L: [], NTC: [] };
    
    Object.keys(results).forEach(wellKey => {
        const wellData = results[wellKey];
        if (!wellKey || !wellData || !wellData.cqj_value) return;
        
        const upperKey = wellKey.toUpperCase();
        let controlType = null;
        
        if (upperKey.includes('HIGH') || upperKey.includes('H1') || upperKey.includes('POS') || 
            upperKey.includes('1E7') || upperKey.includes('10E7') || wellKey.endsWith('H')) {
            controlType = 'H';
        } else if (upperKey.includes('MEDIUM') || upperKey.includes('M1') || upperKey.includes('MED') ||
                   upperKey.includes('1E5') || upperKey.includes('10E5') || wellKey.endsWith('M')) {
            controlType = 'M';
        } else if (upperKey.includes('LOW') || upperKey.includes('L1') || 
                   upperKey.includes('1E3') || upperKey.includes('10E3') || wellKey.endsWith('L')) {
            controlType = 'L';
        } else if (upperKey.includes('NTC') || upperKey.includes('NEG') || upperKey.includes('BLANK')) {
            controlType = 'NTC';
        }
        
        if (controlType) {
            controlCqj[controlType].push(wellData.cqj_value);
        }
    });
    
    // Simple summary
    const summary = {};
    Object.keys(controlCqj).forEach(type => {
        if (controlCqj[type].length > 0) {
            const avg = controlCqj[type].reduce((sum, val) => sum + val, 0) / controlCqj[type].length;
            summary[type] = { count: controlCqj[type].length, avg: avg.toFixed(2), values: controlCqj[type] };
        }
    });
    
    return { controlCqj, summary, testCode: window.currentAnalysisResults?.test_code };
};

// Test CQJ calculation for a specific well
window.debugCQJCalculation = function(wellKey) {
    if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
        return { error: 'No analysis results available' };
    }
    
    const well = window.currentAnalysisResults.individual_results[wellKey];
    if (!well) {
        return { error: `Well ${wellKey} not found` };
    }
    
    // Get RFU and cycles data
    let rfuArray = well.raw_rfu || well.rfu;
    let cyclesArray = well.raw_cycles || well.cycles;
    
    if (typeof rfuArray === 'string') {
        try { rfuArray = JSON.parse(rfuArray); } catch(e) { rfuArray = []; }
    }
    if (typeof cyclesArray === 'string') {
        try { cyclesArray = JSON.parse(cyclesArray); } catch(e) { cyclesArray = []; }
    }
    
    // Get current threshold
    const channel = well.fluorophore;
    const currentScale = window.currentScaleMode || 'linear';
    const threshold = window.getChannelThreshold ? 
        window.getChannelThreshold(channel, currentScale) : null;
    
    if (!threshold) {
        return { error: 'No threshold available' };
    }
    
    // Test CQJ calculation
    const cqjResult = calculateThresholdCrossing(rfuArray, cyclesArray, threshold);
    
    // Test curve quality
    const numericRfu = rfuArray.map(r => parseFloat(r));
    const quality = assessCurveQuality(numericRfu, 5);
    
    return {
        wellKey,
        sampleName: well.sample_name,
        fluorophore: well.fluorophore,
        dataPoints: rfuArray.length,
        threshold,
        calculatedCQJ: cqjResult,
        storedCQJ: well.cqj_value,
        curveQuality: quality,
        rfuRange: [Math.min(...rfuArray), Math.max(...rfuArray)],
        match: cqjResult === well.cqj_value
    };
};

// Debug function for CalcJ calculation issues - MULTICHANNEL AWARE
window.debugCalcJMath = function(wellKey) {
    if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
        return { error: 'No analysis results available' };
    }
    
    const results = window.currentAnalysisResults.individual_results;
    const testCode = getCurrentTestCode();
    const well = results[wellKey];
    
    if (!well) {
        return { error: `Well ${wellKey} not found` };
    }
    
    // CRITICAL: Get the actual channel for this well (not hardcoded FAM)
    const channel = well.fluorophore;
    if (!channel) {
        return { error: 'Well has no fluorophore channel' };
    }
    
    // Get concentration controls for THIS SPECIFIC CHANNEL
    const concValues = CONCENTRATION_CONTROLS[testCode]?.[channel];
    if (!concValues) {
        return { error: `No concentration controls for ${testCode}/${channel}` };
    }
    
    // Find H/L controls FOR THIS SPECIFIC CHANNEL ONLY
    const controlCqj = { H: [], L: [] };
    Object.keys(results).forEach(key => {
        const wellData = results[key];
        if (!wellData.cqj_value) return;
        
        // CRITICAL: Only include controls from the same channel
        if (wellData.fluorophore !== channel) return;
        
        const sampleName = wellData.sample_name || '';
        const controlMatch = sampleName.match(/([HML])-?\d*$/);
        if (controlMatch) {
            const type = controlMatch[1];
            if (type === 'H' || type === 'L') {
                controlCqj[type].push(wellData.cqj_value);
            }
        }
    });
    
    if (controlCqj.H.length === 0 || controlCqj.L.length === 0) {
        return { error: `Missing H or L controls for channel ${channel}` };
    }
    
    const hCqj = controlCqj.H.reduce((sum, val) => sum + val, 0) / controlCqj.H.length;
    const lCqj = controlCqj.L.reduce((sum, val) => sum + val, 0) / controlCqj.L.length;
    const hConc = concValues.H;
    const lConc = concValues.L;
    
    // Show the math step by step
    const logH = Math.log10(hConc);
    const logL = Math.log10(lConc);
    const slope = (logH - logL) / (hCqj - lCqj);
    const intercept = logH - slope * hCqj;
    
    const result = {
        wellKey,
        sample: well.sample_name,
        channel: channel,  // Show which channel we're analyzing
        currentCqj: well.cqj_value,
        currentCalcj: well.calcj_value,
        hCqj, lCqj, hConc, lConc,
        logH, logL, slope, intercept
    };
    
    // Calculate for current well
    if (well.cqj_value !== null) {
        const currentCqj = well.cqj_value;
        const logConc = slope * currentCqj + intercept;
        const calcjResult = Math.pow(10, logConc);
        
        result.calculation = {
            logConc,
            calcjResult,
            isFinite: isFinite(calcjResult),
            isNaN: isNaN(calcjResult)
        };
    }
    
    return result;
};

// Debug function for multichannel CalcJ analysis - shows all channels at once
window.debugMultichannelCalcJ = function() {
    if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
        return { error: 'No analysis results available' };
    }
    
    const results = window.currentAnalysisResults.individual_results;
    const testCode = getCurrentTestCode();
    
    // Find all channels in this run
    const channels = new Set();
    Object.values(results).forEach(well => {
        if (well.fluorophore) {
            channels.add(well.fluorophore);
        }
    });
    
    const channelAnalysis = {};
    
    Array.from(channels).forEach(channel => {
        // Get concentration controls for this channel
        const concValues = CONCENTRATION_CONTROLS[testCode]?.[channel];
        if (!concValues) {
            channelAnalysis[channel] = { error: `No concentration controls for ${testCode}/${channel}` };
            return;
        }
        
        // Find H/L controls for this specific channel
        const controlCqj = { H: [], L: [], M: [] };
        const sampleWells = [];
        
        Object.keys(results).forEach(wellKey => {
            const wellData = results[wellKey];
            
            // Only process wells from this channel
            if (wellData.fluorophore !== channel) return;
            
            const sampleName = wellData.sample_name || '';
            let controlType = null;
            
            // Use same control detection logic as main calculation
            if (sampleName.includes('NTC')) {
                controlType = 'NTC';
            } else {
                const controlMatch = sampleName.match(/([HML])-?\d*$/);
                if (controlMatch) {
                    controlType = controlMatch[1];
                } else if (sampleName.includes('H-') || /[A-Z]\d+H-/.test(sampleName)) {
                    controlType = 'H';
                } else if (sampleName.includes('M-') || /[A-Z]\d+M-/.test(sampleName)) {
                    controlType = 'M';
                } else if (sampleName.includes('L-') || /[A-Z]\d+L-/.test(sampleName)) {
                    controlType = 'L';
                }
            }
            
            if (controlType && controlType !== 'NTC' && wellData.cqj_value !== null && wellData.cqj_value !== undefined) {
                controlCqj[controlType].push({
                    wellKey: wellKey,
                    sampleName: sampleName,
                    cqj: wellData.cqj_value,
                    calcj: wellData.calcj_value
                });
            } else if (controlType !== 'NTC' && !controlType) {
                // This is a sample well
                sampleWells.push({
                    wellKey: wellKey,
                    sampleName: sampleName,
                    cqj: wellData.cqj_value,
                    calcj: wellData.calcj_value
                });
            }
        });
        
        // Analyze this channel
        const hCount = controlCqj.H.length;
        const lCount = controlCqj.L.length;
        const mCount = controlCqj.M.length;
        
        if (hCount === 0 || lCount === 0) {
            channelAnalysis[channel] = {
                error: `Missing required controls (H: ${hCount}, L: ${lCount})`,
                controlCqj,
                sampleCount: sampleWells.length
            };
        } else {
            // Calculate averages and standard curve
            const hCqj = controlCqj.H.reduce((sum, c) => sum + c.cqj, 0) / controlCqj.H.length;
            const lCqj = controlCqj.L.reduce((sum, c) => sum + c.cqj, 0) / controlCqj.L.length;
            const mCqj = mCount > 0 ? controlCqj.M.reduce((sum, c) => sum + c.cqj, 0) / controlCqj.M.length : null;
            
            const hConc = concValues.H;
            const lConc = concValues.L;
            
            const logH = Math.log10(hConc);
            const logL = Math.log10(lConc);
            const slope = (logH - logL) / (hCqj - lCqj);
            const intercept = logH - slope * hCqj;
            
            // Find problematic samples
            const problematicSamples = sampleWells.filter(sample => {
                return sample.calcj === null || sample.calcj === 'N/A' || 
                       !isFinite(sample.calcj) || sample.calcj > 1e10;
            });
            
            channelAnalysis[channel] = {
                success: true,
                controls: { hCount, lCount, mCount, hCqj, lCqj, mCqj },
                standardCurve: { slope, intercept, valid: slope < 0 },
                concentrations: { hConc, lConc },
                sampleCount: sampleWells.length,
                problematicSamples: problematicSamples.length,
                sampleDetails: problematicSamples.slice(0, 3) // Show first 3 problematic samples
            };
        }
    });
    
    return {
        testCode,
        channels: Array.from(channels),
        channelAnalysis
    };
};

// Debug function to test infinity issues
window.debugInfinityWells = function() {
    if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
        return { error: 'No analysis results available' };
    }
    
    const results = window.currentAnalysisResults.individual_results;
    const testCode = getCurrentTestCode();
    
    // Find wells with infinity or very large CalcJ values
    const problematicWells = [];
    Object.keys(results).forEach(wellKey => {
        const well = results[wellKey];
        const calcj = well.calcj_value;
        
        if (!isFinite(calcj) || calcj > 1e10 || calcj === 'N/A') {
            problematicWells.push({
                wellKey,
                sampleName: well.sample_name,
                cqj: well.cqj_value,
                calcj: calcj,
                fluorophore: well.fluorophore
            });
        }
    });
    
    // Get current H/L control averages for comparison
    const controlCqj = { H: [], L: [] };
    Object.keys(results).forEach(wellKey => {
        const wellData = results[wellKey];
        if (!wellData.cqj_value) return;
        
        const sampleName = wellData.sample_name || '';
        let controlType = null;
        
        const controlMatch = sampleName.match(/([HML])-?\d*$/);
        if (controlMatch) {
            controlType = controlMatch[1];
        } else if (sampleName.includes('H-')) {
            controlType = 'H';
        } else if (sampleName.includes('L-')) {
            controlType = 'L';
        }
        
        if (controlType === 'H' || controlType === 'L') {
            controlCqj[controlType].push(wellData.cqj_value);
        }
    });
    
    const hAvg = controlCqj.H.length > 0 ? controlCqj.H.reduce((sum, val) => sum + val, 0) / controlCqj.H.length : 0;
    const lAvg = controlCqj.L.length > 0 ? controlCqj.L.reduce((sum, val) => sum + val, 0) / controlCqj.L.length : 0;
    
    return { 
        problematicWells, 
        hAvg, 
        lAvg, 
        testCode,
        controlRange: lAvg - hAvg
    };
};

// Debug function to check table cell content
window.debugTableCalcJ = function() {
    // Try multiple possible table selectors
    let table = document.querySelector('#results-table');
    if (!table) table = document.querySelector('.results-table');
    if (!table) table = document.querySelector('table');
    if (!table) {
        // List all tables on the page for debugging
        const allTables = document.querySelectorAll('table');
        return { 
            error: 'Results table not found', 
            tablesFound: allTables.length,
            tableIds: Array.from(allTables).map(t => t.id || 'no-id'),
            tableClasses: Array.from(allTables).map(t => t.className || 'no-class')
        };
    }
    
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) {
        // Try all rows if tbody doesn't exist
        const allRows = table.querySelectorAll('tr');
        return { error: 'No tbody rows found', totalRows: allRows.length };
    }
    
    const calcjData = [];
    const allRowData = []; // Capture all rows for debugging
    
    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
            const wellId = cells[0]?.textContent?.trim();
            const rowData = {
                rowIndex: index,
                wellId,
                cellCount: cells.length,
                allCells: Array.from(cells).map(cell => cell.textContent?.trim())
            };
            allRowData.push(rowData);
            
            if (wellId && wellId.includes('D10_FAM')) {
                // Try different column positions for CalcJ
                calcjData.push({
                    wellId,
                    displayedCalcJ_col5: cells[5]?.textContent?.trim(),
                    displayedCalcJ_col4: cells[4]?.textContent?.trim(),
                    displayedCalcJ_col6: cells[6]?.textContent?.trim(),
                    cellHTML_col5: cells[5]?.innerHTML,
                    allCellsText: Array.from(cells).map(cell => cell.textContent?.trim())
                });
            }
        }
    });
    
    return { 
        calcjData,
        allRowData: allRowData.slice(0, 5), // Show first 5 rows for debugging
        totalRows: rows.length,
        tableFound: true
    };
};

// Alias for backward compatibility
window.calculateCqj = function(well, threshold) {
    // Convert well object to arrays and call calculateThresholdCrossing
    let rfuArray = well.raw_rfu || well.rfu;
    let cyclesArray = well.raw_cycles || well.cycles;
    
    if (typeof rfuArray === 'string') {
        try { rfuArray = JSON.parse(rfuArray); } catch(e) { return null; }
    }
    if (typeof cyclesArray === 'string') {
        try { cyclesArray = JSON.parse(cyclesArray); } catch(e) { return null; }
    }
    
    return calculateThresholdCrossing(rfuArray, cyclesArray, threshold);
};

// Quick test function for multichannel CalcJ debugging
window.testMultichannelCalcJ = function() {
    console.log('=== TESTING MULTICHANNEL CALCJ ===');
    
    // First check if we have analysis results
    if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
        console.log('❌ No analysis results found');
        return { error: 'no_results' };
    }
    
    const results = window.currentAnalysisResults.individual_results;
    const testCode = getCurrentTestCode();
    console.log(`🧪 Test code: ${testCode}`);
    
    // Find fluorophores
    const fluorophores = [...new Set(Object.values(results).map(well => well.fluorophore).filter(Boolean))];
    console.log(`📡 Fluorophores found: ${fluorophores.join(', ')}`);
    
    if (fluorophores.length === 0) {
        console.log('❌ No fluorophores found in results');
        return { error: 'no_fluorophores' };
    }
    
    // Check how many wells already have CalcJ
    let totalCalcJWells = 0;
    const calcJBychannel = {};
    
    fluorophores.forEach(channel => {
        const channelWells = Object.values(results).filter(well => well.fluorophore === channel);
        const calcJWells = channelWells.filter(well => well.calcj_value || well.CalcJ);
        calcJBychannel[channel] = {
            total: channelWells.length,
            withCalcJ: calcJWells.length
        };
        totalCalcJWells += calcJWells.length;
    });
    
    console.log('📊 Current CalcJ status by channel:', calcJBychannel);
    console.log(`📊 Total wells with CalcJ: ${totalCalcJWells}`);
    
    // Try recalculating CalcJ for all channels
    console.log('🔄 Attempting CalcJ recalculation...');
    
    try {
        const recalcResults = {};
        fluorophores.forEach(channel => {
            console.log(`🔄 Recalculating ${channel}...`);
            recalcResults[channel] = recalculateCalcJForChannel(channel);
        });
        
        // Count how many wells have CalcJ after recalculation
        let newCalcJCount = 0;
        fluorophores.forEach(channel => {
            const channelWells = Object.values(results).filter(well => well.fluorophore === channel);
            const calcJWells = channelWells.filter(well => well.calcj_value || well.CalcJ);
            newCalcJCount += calcJWells.length;
        });
        
        console.log(`📊 Wells with CalcJ after recalc: ${newCalcJCount}`);
        
        // Force table refresh
        if (window.populateResultsTable) {
            console.log('🔄 Refreshing results table...');
            window.populateResultsTable(results);
        }
        
        return {
            success: true,
            testCode: testCode,
            fluorophores: fluorophores,
            beforeRecalc: calcJBychannel,
            afterRecalc: newCalcJCount,
            recalcResults: recalcResults
        };
        
    } catch (error) {
        console.log(`❌ Error during CalcJ recalculation: ${error.message}`);
        return { error: error.message };
    }
};

/**
 * Enhanced debug function to verify CalcJ is properly structured for multichannel
 * This confirms the fix for multichannel CalcJ display
 */
window.debugMultichannelCalcJFixed = function() {
    console.log('🔍 DEBUGGING MULTICHANNEL CALCJ STRUCTURE (POST-FIX)');
    
    if (!window.currentAnalysisResults?.individual_results) {
        return {error: "no_analysis_results"};
    }
    
    const results = window.currentAnalysisResults.individual_results;
    const wellKeys = Object.keys(results);
    const calcjStructure = {};
    const cqjStructure = {};
    const displayData = {};
    
    // Analyze structure for each well
    wellKeys.slice(0, 10).forEach(wellKey => {
        const well = results[wellKey];
        const fluorophore = well.fluorophore;
        
        // Check CalcJ structure
        calcjStructure[wellKey] = {
            fluorophore: fluorophore,
            calcj_value: well.calcj_value,
            calcj_object: well.calcj,
            calcj_object_type: typeof well.calcj,
            calcj_for_fluorophore: well.calcj?.[fluorophore],
            has_proper_structure: !!(well.calcj && typeof well.calcj === 'object' && well.calcj[fluorophore] !== undefined)
        };
        
        // Check CQJ structure for comparison
        cqjStructure[wellKey] = {
            fluorophore: fluorophore,
            cqj_value: well.cqj_value,
            cqj_object: well.cqj,
            cqj_for_fluorophore: well.cqj?.[fluorophore],
            has_proper_structure: !!(well.cqj && typeof well.cqj === 'object' && well.cqj[fluorophore] !== undefined)
        };
        
        // Simulate what the table display logic would show
        const tableCalcJ = (well.calcj && typeof well.calcj === 'object' && fluorophore &&
            well.calcj[fluorophore] !== undefined && well.calcj[fluorophore] !== null &&
            !isNaN(well.calcj[fluorophore])) ? Number(well.calcj[fluorophore]) : 'N/A';
            
        const tableCQJ = (well.cqj && typeof well.cqj === 'object' && fluorophore &&
            well.cqj[fluorophore] !== undefined && well.cqj[fluorophore] !== null &&
            !isNaN(well.cqj[fluorophore])) ? Number(well.cqj[fluorophore]).toFixed(2) : 'N/A';
        
        displayData[wellKey] = {
            fluorophore: fluorophore,
            will_show_calcj: tableCalcJ,
            will_show_cqj: tableCQJ
        };
    });
    
    const summary = {
        total_wells: wellKeys.length,
        wells_with_proper_calcj: Object.values(calcjStructure).filter(w => w.has_proper_structure).length,
        wells_with_proper_cqj: Object.values(cqjStructure).filter(w => w.has_proper_structure).length,
        fluorophores: [...new Set(wellKeys.map(k => results[k].fluorophore))],
        fix_working: Object.values(calcjStructure).every(w => w.has_proper_structure)
    };
    
    console.log('📊 MULTICHANNEL CALCJ STRUCTURE ANALYSIS:', {
        summary: summary,
        sample_calcj_structure: Object.fromEntries(Object.entries(calcjStructure).slice(0, 3)),
        sample_display_data: Object.fromEntries(Object.entries(displayData).slice(0, 3))
    });
    
    return {
        summary: summary,
        calcj_structure: calcjStructure,
        cqj_structure: cqjStructure,
        display_data: displayData
    };
};

/**
 * Enhanced debug function to verify CalcJ is properly structured for multichannel
 * This confirms the fix for multichannel CalcJ display
 */
window.debugMultichannelCalcJFixed = function() {
    console.log('🔍 DEBUGGING MULTICHANNEL CALCJ STRUCTURE (POST-FIX)');
    
    if (!window.currentAnalysisResults?.individual_results) {
        return {error: "no_analysis_results"};
    }
    
    const results = window.currentAnalysisResults.individual_results;
    const wellKeys = Object.keys(results);
    const calcjStructure = {};
    const cqjStructure = {};
    const displayData = {};
    
    // Analyze structure for each well
    wellKeys.slice(0, 10).forEach(wellKey => {
        const well = results[wellKey];
        const fluorophore = well.fluorophore;
        
        // Check CalcJ structure
        calcjStructure[wellKey] = {
            fluorophore: fluorophore,
            calcj_value: well.calcj_value,
            calcj_object: well.calcj,
            calcj_object_type: typeof well.calcj,
            calcj_for_fluorophore: well.calcj?.[fluorophore],
            has_proper_structure: !!(well.calcj && typeof well.calcj === 'object' && well.calcj[fluorophore] !== undefined)
        };
        
        // Check CQJ structure for comparison
        cqjStructure[wellKey] = {
            fluorophore: fluorophore,
            cqj_value: well.cqj_value,
            cqj_object: well.cqj,
            cqj_for_fluorophore: well.cqj?.[fluorophore],
            has_proper_structure: !!(well.cqj && typeof well.cqj === 'object' && well.cqj[fluorophore] !== undefined)
        };
        
        // Simulate what the table display logic would show
        const tableCalcJ = (well.calcj && typeof well.calcj === 'object' && fluorophore &&
            well.calcj[fluorophore] !== undefined && well.calcj[fluorophore] !== null &&
            !isNaN(well.calcj[fluorophore])) ? Number(well.calcj[fluorophore]) : 'N/A';
            
        const tableCQJ = (well.cqj && typeof well.cqj === 'object' && fluorophore &&
            well.cqj[fluorophore] !== undefined && well.cqj[fluorophore] !== null &&
            !isNaN(well.cqj[fluorophore])) ? Number(well.cqj[fluorophore]).toFixed(2) : 'N/A';
        
        displayData[wellKey] = {
            fluorophore: fluorophore,
            will_show_calcj: tableCalcJ,
            will_show_cqj: tableCQJ
        };
    });
    
    const summary = {
        total_wells: wellKeys.length,
        wells_with_proper_calcj: Object.values(calcjStructure).filter(w => w.has_proper_structure).length,
        wells_with_proper_cqj: Object.values(cqjStructure).filter(w => w.has_proper_structure).length,
        fluorophores: [...new Set(wellKeys.map(k => results[k].fluorophore))],
        fix_working: Object.values(calcjStructure).every(w => w.has_proper_structure)
    };
    
    console.log('📊 MULTICHANNEL CALCJ STRUCTURE ANALYSIS:', {
        summary: summary,
        sample_calcj_structure: Object.fromEntries(Object.entries(calcjStructure).slice(0, 3)),
        sample_display_data: Object.fromEntries(Object.entries(displayData).slice(0, 3))
    });
    
    return {
        summary: summary,
        calcj_structure: calcjStructure,
        cqj_structure: cqjStructure,
        display_data: displayData
    };
};

/**
 * Enhanced debug function to verify CalcJ is properly structured for multichannel
 * This confirms the fix for multichannel CalcJ display
 */
window.debugMultichannelCalcJFixed = function() {
    console.log('🔍 DEBUGGING MULTICHANNEL CALCJ STRUCTURE (POST-FIX)');
    
    if (!window.currentAnalysisResults?.individual_results) {
        return {error: "no_analysis_results"};
    }
    
    const results = window.currentAnalysisResults.individual_results;
    const wellKeys = Object.keys(results);
    const calcjStructure = {};
    const cqjStructure = {};
    const displayData = {};
    
    // Analyze structure for each well
    wellKeys.slice(0, 10).forEach(wellKey => {
        const well = results[wellKey];
        const fluorophore = well.fluorophore;
        
        // Check CalcJ structure
        calcjStructure[wellKey] = {
            fluorophore: fluorophore,
            calcj_value: well.calcj_value,
            calcj_object: well.calcj,
            calcj_object_type: typeof well.calcj,
            calcj_for_fluorophore: well.calcj?.[fluorophore],
            has_proper_structure: !!(well.calcj && typeof well.calcj === 'object' && well.calcj[fluorophore] !== undefined)
        };
        
        // Check CQJ structure for comparison
        cqjStructure[wellKey] = {
            fluorophore: fluorophore,
            cqj_value: well.cqj_value,
            cqj_object: well.cqj,
            cqj_for_fluorophore: well.cqj?.[fluorophore],
            has_proper_structure: !!(well.cqj && typeof well.cqj === 'object' && well.cqj[fluorophore] !== undefined)
        };
        
        // Simulate what the table display logic would show
        const tableCalcJ = (well.calcj && typeof well.calcj === 'object' && fluorophore &&
            well.calcj[fluorophore] !== undefined && well.calcj[fluorophore] !== null &&
            !isNaN(well.calcj[fluorophore])) ? Number(well.calcj[fluorophore]) : 'N/A';
            
        const tableCQJ = (well.cqj && typeof well.cqj === 'object' && fluorophore &&
            well.cqj[fluorophore] !== undefined && well.cqj[fluorophore] !== null &&
            !isNaN(well.cqj[fluorophore])) ? Number(well.cqj[fluorophore]).toFixed(2) : 'N/A';
        
        displayData[wellKey] = {
            fluorophore: fluorophore,
            will_show_calcj: tableCalcJ,
            will_show_cqj: tableCQJ
        };
    });
    
    const summary = {
        total_wells: wellKeys.length,
        wells_with_proper_calcj: Object.values(calcjStructure).filter(w => w.has_proper_structure).length,
        wells_with_proper_cqj: Object.values(cqjStructure).filter(w => w.has_proper_structure).length,
        fluorophores: [...new Set(wellKeys.map(k => results[k].fluorophore))],
        fix_working: Object.values(calcjStructure).every(w => w.has_proper_structure)
    };
    
    console.log('📊 MULTICHANNEL CALCJ STRUCTURE ANALYSIS:', {
        summary: summary,
        sample_calcj_structure: Object.fromEntries(Object.entries(calcjStructure).slice(0, 3)),
        sample_display_data: Object.fromEntries(Object.entries(displayData).slice(0, 3))
    });
    
    return {
        summary: summary,
        calcj_structure: calcjStructure,
        cqj_structure: cqjStructure,
        display_data: displayData
    };
};