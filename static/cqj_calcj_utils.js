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
        console.warn('❌ CQJ-CALC - Invalid input arrays');
        return null;
    }
    
    // Ensure threshold is numeric
    const numericThreshold = parseFloat(threshold);
    if (isNaN(numericThreshold) || numericThreshold <= 0) {
        console.warn('❌ CQJ-CALC - Invalid threshold:', threshold);
        return null;
    }
    
    const startCycle = 5; // Skip cycles 1-5 (indices 0-4)
    
    // Convert to numeric arrays for analysis
    const numericRfu = rfuArray.map(r => parseFloat(r));
    const numericCycles = cyclesArray.map(c => parseFloat(c));
    
    // Check curve quality first
    const curveQuality = assessCurveQuality(numericRfu, startCycle);
    if (!curveQuality.isGoodCurve) {
        console.log(`❌ CQJ-CALC - Poor curve quality: ${curveQuality.reason}`);
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
            
            console.log(`🔍 CQJ-CALC - ${direction} crossing at cycle ${interpolatedCq.toFixed(2)} (RFU: ${prevRfu.toFixed(2)} → ${currentRfu.toFixed(2)})`);
        }
    }
    
    if (crossings.length === 0) {
        const maxRfu = Math.max(...numericRfu.slice(startCycle));
        console.log(`❌ CQJ-CALC - No crossings found (threshold: ${numericThreshold.toFixed(2)}, max RFU: ${maxRfu.toFixed(2)})`);
        return null;
    }
    
    // Filter for positive direction crossings only
    const positiveCrossings = crossings.filter(c => c.direction === 'positive');
    
    if (positiveCrossings.length === 0) {
        console.log(`❌ CQJ-CALC - Only negative direction crossings found - marking as N/A`);
        return null; // N/A for negative-only crossings
    }
    
    // Use the LAST positive crossing to avoid flat-line confusion
    const lastPositiveCrossing = positiveCrossings[positiveCrossings.length - 1];
    
    console.log(`✅ CQJ-CALC - Using LAST positive crossing at ${lastPositiveCrossing.cycle.toFixed(2)} ` +
        `(${positiveCrossings.length} positive crossings total)`);
    
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
 * Recalculate CQJ values for all wells using current thresholds
 */
function recalculateCQJValues() {
    console.log('🔍 CQJ-RECALC - Starting recalculation');
    
    if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
        console.warn('❌ CQJ-RECALC - No analysis results available');
        return;
    }
    
    const results = window.currentAnalysisResults.individual_results;
    const currentScale = window.currentScaleMode || 'linear';
    let updateCount = 0;
    let calcjUpdateCount = 0;
    
    // Get test code for CalcJ calculations
    const testCode = window.currentAnalysisResults?.test_code || 
                     window.getCurrentFullPattern?.() || 
                     'Unknown';
    
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
            console.warn(`❌ CQJ-RECALC - No threshold for ${channel} on ${currentScale} scale`);
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
                console.log(`✅ CQJ-UPDATE - ${wellKey} (${channel}): ${oldCqj?.toFixed(2) || 'null'} → ${newCqj?.toFixed(2) || 'null'}`);
            }
            
            // Recalculate CalcJ (concentration) using the new CQJ
            const oldCalcj = well.calcj_value;
            let calcjResult;
            
            // CRITICAL: If CQJ is null/N/A, CalcJ must also be null/N/A
            if (newCqj === null || newCqj === undefined) {
                calcjResult = { calcj_value: null, method: 'no_cqj_value' };
            } else {
                calcjResult = calculateCalcjWithControls(well, threshold, results, testCode, channel);
            }
            
            // Update CalcJ in well data
            well.calcj_value = calcjResult.calcj_value;
            well['CalcJ'] = calcjResult.calcj_value; // Also update display field
            well.calcj_method = calcjResult.method;
            
            if (oldCalcj !== calcjResult.calcj_value) {
                calcjUpdateCount++;
                const oldVal = oldCalcj === null || oldCalcj === undefined ? 'null' : 
                              (typeof oldCalcj === 'number' ? oldCalcj.toExponential(2) : oldCalcj);
                const newVal = calcjResult.calcj_value === null || calcjResult.calcj_value === undefined ? 'null' :
                              (typeof calcjResult.calcj_value === 'number' ? calcjResult.calcj_value.toExponential(2) : calcjResult.calcj_value);
                console.log(`✅ CALCJ-UPDATE - ${wellKey} (${channel}): ${oldVal} → ${newVal} (${calcjResult.method})`);
            }
        }
    });
    
    console.log(`🔍 CQJ-RECALC - Updated ${updateCount} CQJ values and ${calcjUpdateCount} CalcJ values`);
    
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
        console.log('[CALCJ-DEBUG] CONCENTRATION_CONTROLS not available - CalcJ calculation impossible');
        return { calcj_value: null, method: 'no_concentration_controls' };
    }
    
    const concValues = CONCENTRATION_CONTROLS[testCode]?.[channel];
    if (!concValues) {
        console.log(`[CALCJ-DEBUG] No concentration controls found for ${testCode}/${channel} - CalcJ calculation impossible`);
        return { calcj_value: null, method: 'no_concentration_controls' };
    }
    
    console.log(`[CALCJ-DEBUG] Starting control-based calculation for ${testCode}/${channel}...`);
    
    // Find H/M/L/NTC control wells and collect their CQJ values
    const controlCqj = { H: [], M: [], L: [], NTC: [] };
    
    if (allWellResults && typeof allWellResults === 'object') {
        Object.keys(allWellResults).forEach(wellKey => {
            const wellData = allWellResults[wellKey];
            if (!wellKey || !wellData) return;
            
            // Check if this is a control well with comprehensive pattern matching
            let controlType = null;
            const upperKey = wellKey.toUpperCase();
            
            // NTC (No Template Control) patterns - should have NO amplification unless contaminated
            if (wellKey.startsWith('NTC') || wellKey.includes('_NTC_') || upperKey.startsWith('NEG') ||
                upperKey.includes('NEGATIVE') || upperKey.includes('NTC') || upperKey.includes('NO_TEMPLATE') ||
                upperKey.includes('BLANK') || upperKey.includes('N_T_C') || wellKey.endsWith('NTC') ||
                upperKey.includes('D01N') || upperKey.includes('D02N') || upperKey.includes('D03N')) {
                controlType = 'NTC';
            }
            // More aggressive pattern matching for embedded control indicators
            // HIGH control patterns (including embedded H patterns)
            if (wellKey.startsWith('H_') || wellKey.includes('_H_') || upperKey.startsWith('HIGH') ||
                upperKey.includes('HIGH') || upperKey.includes('H1') || upperKey.includes('H2') || 
                upperKey.includes('H3') || upperKey.includes('POS') || upperKey.includes('POSITIVE') ||
                upperKey.includes('1E7') || upperKey.includes('10E7') || upperKey.includes('1E+7') ||
                /[A-Z]\d+H-/.test(wellKey) || /H-\d+/.test(wellKey) || wellKey.endsWith('H') ||
                upperKey.includes('A05H') || upperKey.includes('A06H') || upperKey.includes('A07H')) {
                controlType = 'H';
            } 
            // MEDIUM control patterns (including embedded M patterns)
            else if (wellKey.startsWith('M_') || wellKey.includes('_M_') || upperKey.startsWith('MEDIUM') ||
                     upperKey.includes('MEDIUM') || upperKey.includes('M1') || upperKey.includes('M2') ||
                     upperKey.includes('M3') || upperKey.includes('MED') || 
                     upperKey.includes('1E5') || upperKey.includes('10E5') || upperKey.includes('1E+5') ||
                     /[A-Z]\d+M-/.test(wellKey) || /M-\d+/.test(wellKey) || wellKey.endsWith('M') ||
                     upperKey.includes('B08M') || upperKey.includes('B09M') || upperKey.includes('B10M')) {
                controlType = 'M';
            }
            // LOW control patterns (including embedded L patterns)
            else if (wellKey.startsWith('L_') || wellKey.includes('_L_') || upperKey.startsWith('LOW') ||
                     upperKey.includes('LOW') || upperKey.includes('L1') || upperKey.includes('L2') ||
                     upperKey.includes('L3') || 
                     upperKey.includes('1E3') || upperKey.includes('10E3') || upperKey.includes('1E+3') ||
                     /[A-Z]\d+L-/.test(wellKey) || /L-\d+/.test(wellKey) || wellKey.endsWith('L') ||
                     upperKey.includes('C11L') || upperKey.includes('C12L') || upperKey.includes('C13L')) {
                controlType = 'L';
            }
            // Also check sample_name if available with same aggressive patterns
            else if (wellData.sample_name) {
                const upperSample = wellData.sample_name.toUpperCase();
                if (upperSample.includes('NTC') || upperSample.includes('NEGATIVE') || upperSample.includes('NEG') ||
                    upperSample.includes('NO_TEMPLATE') || upperSample.includes('BLANK') || upperSample.includes('N_T_C') ||
                    upperSample.includes('D01N') || upperSample.includes('D02N') || upperSample.includes('D03N')) {
                    controlType = 'NTC';
                } else if (upperSample.includes('HIGH') || upperSample.includes('POS') || upperSample.includes('H1') ||
                    upperSample.includes('1E7') || upperSample.includes('10E7') || upperSample.includes('1E+7') ||
                    /[A-Z]\d+H-/.test(wellData.sample_name) || /H-\d+/.test(wellData.sample_name) ||
                    upperSample.includes('A05H') || upperSample.includes('A06H') || upperSample.includes('A07H')) {
                    controlType = 'H';
                } else if (upperSample.includes('MEDIUM') || upperSample.includes('MED') || upperSample.includes('M1') ||
                          upperSample.includes('1E5') || upperSample.includes('10E5') || upperSample.includes('1E+5') ||
                          /[A-Z]\d+M-/.test(wellData.sample_name) || /M-\d+/.test(wellData.sample_name) ||
                          upperSample.includes('B08M') || upperSample.includes('B09M') || upperSample.includes('B10M')) {
                    controlType = 'M';
                } else if (upperSample.includes('LOW') || upperSample.includes('L1') ||
                          upperSample.includes('1E3') || upperSample.includes('10E3') || upperSample.includes('1E+3') ||
                          /[A-Z]\d+L-/.test(wellData.sample_name) || /L-\d+/.test(wellData.sample_name) ||
                          upperSample.includes('C11L') || upperSample.includes('C12L') || upperSample.includes('C13L')) {
                    controlType = 'L';
                }
            }
            
            // Handle control types appropriately
            if (controlType === 'NTC') {
                // NTC controls should NOT have CQJ values unless contaminated
                if (wellData.cqj_value !== null && wellData.cqj_value !== undefined) {
                    console.warn(`[CALCJ-DEBUG] ⚠️  CONTAMINATION DETECTED in NTC control ${wellKey}: CQJ ${wellData.cqj_value.toFixed(2)}`);
                    controlCqj[controlType].push(wellData.cqj_value);
                } else {
                    console.log(`[CALCJ-DEBUG] ✅ NTC control ${wellKey}: No amplification (normal)`);
                }
            } else if (controlType && wellData.cqj_value !== null && wellData.cqj_value !== undefined) {
                // H/M/L controls should have CQJ values
                controlCqj[controlType].push(wellData.cqj_value);
                // Only log if controls are found
                if (controlCqj[controlType].length === 1) {
                    console.log(`[CALCJ-DEBUG] Found ${controlType} control wells`);
                }
            }
        });
    }
    
    // Calculate average CQJ for each control level
    const avgControlCqj = {};
    Object.keys(controlCqj).forEach(controlType => {
        const cqjList = controlCqj[controlType];
        if (cqjList.length > 0) {
            avgControlCqj[controlType] = cqjList.reduce((sum, val) => sum + val, 0) / cqjList.length;
            console.log(`[CALCJ-DEBUG] ${controlType} control average CQJ: ${avgControlCqj[controlType].toFixed(2)} (n=${cqjList.length})`);
        }
    });
    
    // Check if we have enough controls for standard curve (REQUIRE H and L controls)
    if (!avgControlCqj.H || !avgControlCqj.L) {
        console.log(`[CALCJ-DEBUG] Missing required H and/or L controls - CalcJ calculation impossible`);
        console.log(`[CALCJ-DEBUG] Found controls: ${Object.keys(avgControlCqj).join(', ')}`);
        return { calcj_value: null, method: 'missing_required_controls' };
    }
    
    // Get CQJ for current well
    const currentCqj = well.cqj_value;
    if (currentCqj === null || currentCqj === undefined) {
        console.log('[CALCJ-DEBUG] No CQJ value, cannot calculate CalcJ');
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
            console.log(`[CALCJ-DEBUG] Early crossing detected (CQJ ${currentCqj.toFixed(2)} < threshold ${earlyThreshold.toFixed(2)})`);
            return { calcj_value: 'N/A', method: 'early_crossing' };
        }
        
        // Also check for very late crossing (contamination or poor amplification)
        const lateThreshold = maxControlCqj + Math.max(2.0, controlRange * 0.5);
        
        if (currentCqj > lateThreshold) {
            console.log(`[CALCJ-DEBUG] Very late crossing detected (CQJ ${currentCqj.toFixed(2)} > threshold ${lateThreshold.toFixed(2)})`);
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
        console.log(`[CALCJ-DEBUG] Missing H/L control data - cannot calculate CalcJ`);
        return { calcj_value: null, method: 'incomplete_control_data' };
    }
    
    // Calculate CalcJ using ACTUAL H/L controls from this specific run
    try {
        // Validate that we have reasonable control data
        if (Math.abs(hCq - lCq) < 0.5) {
            console.log('[CALCJ-DEBUG] H/L controls too close in CQJ values - invalid run');
            return { calcj_value: null, method: 'controls_too_close' };
        }
        
        // Ensure H should have lower CQJ (earlier crossing) than L
        if (hCq > lCq) {
            console.log(`[CALCJ-DEBUG] Warning: H control CQJ (${hCq.toFixed(2)}) > L control CQJ (${lCq.toFixed(2)}), may indicate control mix-up`);
        }
        
        // Log-linear interpolation using ACTUAL control values from this run
        const logH = Math.log10(hVal);
        const logL = Math.log10(lVal);
        
        // Calculate slope: change in log(concentration) per cycle
        const slope = (logH - logL) / (lCq - hCq);
        const intercept = logH - slope * hCq;
        
        // Calculate concentration for current CQJ
        const logConc = slope * currentCqj + intercept;
        const calcjResult = Math.pow(10, logConc);
        
        // Sanity check: result should be within reasonable range
        if (calcjResult < 0 || calcjResult > 1e12) {
            console.log(`[CALCJ-DEBUG] Unreasonable CalcJ result (${calcjResult.toExponential(2)}) - run quality issue`);
            return { calcj_value: null, method: 'unreasonable_result' };
        }
        
        console.log(`[CALCJ-DEBUG] Dynamic CalcJ = ${calcjResult.toExponential(2)} (CQJ: ${currentCqj.toFixed(2)}, H_avg: ${hCq.toFixed(2)}, L_avg: ${lCq.toFixed(2)})`);
        return { calcj_value: calcjResult, method: 'dynamic_control_based' };
    } catch (error) {
        console.log(`[CALCJ-DEBUG] Error in dynamic calculation: ${error.message}`);
        return { calcj_value: null, method: 'calculation_error' };
    }
}

/**
 * Calculate CalcJ value (basic method - requires actual H/L controls from run)
 */
function calculateCalcj(well, threshold) {
    // This basic method cannot work without actual control data from the run
    // Always return null to force use of control-based method
    console.log('[CALCJ] Basic method cannot calculate without actual H/L controls from run');
    return null;
}

// Export functions
window.calculateThresholdCrossing = calculateThresholdCrossing;
window.recalculateCQJValues = recalculateCQJValues;
window.calculateCalcj = calculateCalcj;
window.calculateCalcjWithControls = calculateCalcjWithControls;

// Alias for manual threshold changes (same function)
window.recalculateCQJValuesForManualThreshold = recalculateCQJValues;

// Debug function to test curve quality assessment
window.debugCurveQuality = function(wellKey) {
    if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
        console.error('❌ DEBUG - No analysis results available');
        return;
    }
    
    const well = window.currentAnalysisResults.individual_results[wellKey];
    if (!well) {
        console.error(`❌ DEBUG - Well ${wellKey} not found`);
        return;
    }
    
    let rfuArray = well.raw_rfu || well.rfu;
    if (typeof rfuArray === 'string') {
        try { rfuArray = JSON.parse(rfuArray); } catch(e) { rfuArray = []; }
    }
    
    if (!Array.isArray(rfuArray) || rfuArray.length === 0) {
        console.error(`❌ DEBUG - No RFU data for well ${wellKey}`);
        return;
    }
    
    const numericRfu = rfuArray.map(r => parseFloat(r));
    const quality = assessCurveQuality(numericRfu, 5);
    
    console.log(`🔍 DEBUG - Curve quality for ${wellKey}:`, {
        isGoodCurve: quality.isGoodCurve,
        reason: quality.reason,
        dataPoints: numericRfu.length,
        rfuRange: `${Math.min(...numericRfu).toFixed(3)} - ${Math.max(...numericRfu).toFixed(3)}`,
        mean: (numericRfu.reduce((sum, val) => sum + val, 0) / numericRfu.length).toFixed(3),
        stdDev: Math.sqrt(numericRfu.reduce((sum, val) => sum + Math.pow(val - (numericRfu.reduce((s, v) => s + v, 0) / numericRfu.length), 2), 0) / numericRfu.length).toFixed(3)
    });
    
    return quality;
};

// Debug function to test CalcJ formula issue
window.debugCalcJFormula = function(testCqjValues = [null, 22.80, 29.39]) {
    console.log('🔍 DEBUG - Testing CalcJ formula with corrected expected values:');
    console.log('CORRECTED: NTC should be N/A (no amplification unless contaminated)');
    console.log('Only H (22.80) and M (29.39) should have CalcJ values');
    console.log('');
    
    const results = [];
    testCqjValues.forEach((cqj, index) => {
        const labels = ['NTC', 'H', 'M'];
        let calcj;
        
        if (index === 0) { // NTC
            if (cqj === null || cqj === undefined) {
                calcj = null; // Normal NTC - no amplification
                console.log(`${labels[index]}: No CQJ (normal) → CalcJ N/A`);
            } else {
                calcj = calculateCalcj({ cqj_value: cqj }, 100);
                console.warn(`⚠️  ${labels[index]}: CQJ ${cqj.toFixed(2)} → CalcJ ${calcj ? calcj.toExponential(2) : 'null'} (CONTAMINATION DETECTED!)`);
            }
        } else {
            // H and M controls should have values
            const well = { cqj_value: cqj };
            calcj = calculateCalcj(well, 100);
            console.log(`${labels[index]}: CQJ ${cqj.toFixed(2)} → CalcJ ${calcj ? calcj.toExponential(2) : 'null'}`);
        }
        
        results.push({ label: labels[index], cqj, calcj });
    });
    
    // Check ratios only for H/M (skip NTC since it should be N/A)
    if (results.length >= 3 && results[1].calcj && results[2].calcj) {
        const hMRatio = results[1].calcj / results[2].calcj;
        
        console.log('');
        console.log(`📊 Concentration ratios:`);
        console.log(`H/M ratio: ${hMRatio.toFixed(2)} (should be > 1, typically 4-8x)`);
        
        if (hMRatio < 2) {
            console.warn('⚠️  PROBLEM: H and M concentrations are too similar');
        }
        
        // Check NTC for contamination
        if (results[0].cqj !== null && results[0].cqj !== undefined) {
            console.warn('⚠️  CONTAMINATION: NTC has amplification - this indicates contamination!');
        } else {
            console.log('✅ NTC: No amplification (normal negative control)');
        }
    }
    
    console.log('');
    console.log('🔬 Current formula: concentration = baseline * 2^(40 - CQJ)');
    console.log('🔬 With baseline = 1000 and reference cycle = 40');
    
    return results;
};

// Debug function to inspect well data structure on backend
window.debugWellData = async function(sessionId = null) {
    try {
        // Try to get session ID from current analysis if not provided
        if (!sessionId && window.currentAnalysisResults && window.currentAnalysisResults.session_id) {
            sessionId = window.currentAnalysisResults.session_id;
        }
        
        if (!sessionId) {
            console.error('❌ DEBUG - No session ID provided or available');
            return;
        }
        
        console.log(`🔍 DEBUG - Fetching well data for session ${sessionId}`);
        
        const response = await fetch(`/debug/well-data/${sessionId}`);
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ DEBUG - Well data structure:', data);
            
            // Display key information
            console.log(`📊 DEBUG - Session ${sessionId}: ${data.wells_count} wells`);
            data.debug_info.forEach((wellInfo, index) => {
                console.log(`🔍 DEBUG - Well ${index + 1}:`, {
                    'DB well_id': wellInfo.db_well_id,
                    'well_id type': wellInfo.well_id_type,
                    'well_id value': wellInfo.well_id_value,
                    'fluorophore': wellInfo.fluorophore,
                    'sample_name': wellInfo.sample_name,
                    'has data': wellInfo.has_raw_rfu && wellInfo.has_raw_cycles,
                    'data length': `${wellInfo.raw_rfu_length}/${wellInfo.raw_cycles_length}`
                });
            });
            
            return data;
        } else {
            console.error('❌ DEBUG - Failed to fetch well data:', data.error);
            return data;
        }
    } catch (error) {
        console.error('❌ DEBUG - Error fetching well data:', error);
        return { error: error.message };
    }
};

// Debug function to test CQJ calculation for a specific well
window.debugTestCQJ = async function(wellId, sessionId = null) {
    try {
        // Try to get session ID from current analysis if not provided
        if (!sessionId && window.currentAnalysisResults && window.currentAnalysisResults.session_id) {
            sessionId = window.currentAnalysisResults.session_id;
        }
        
        if (!sessionId) {
            console.error('❌ DEBUG - No session ID provided or available');
            return;
        }
        
        if (!wellId) {
            console.error('❌ DEBUG - No well ID provided');
            return;
        }
        
        console.log(`🔍 DEBUG - Testing CQJ calculation for well ${wellId} in session ${sessionId}`);
        
        const response = await fetch(`/debug/test-cqj/${sessionId}/${wellId}`);
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ DEBUG - CQJ test results:', data);
            
            console.log(`🔍 DEBUG - Well ${wellId}:`, {
                'Well data structure': data.well_data_structure,
                'Test threshold': data.test_threshold,
                'CQJ result': data.cqj_result,
                'CalcJ result': data.calcj_result
            });
            
            return data;
        } else {
            console.error('❌ DEBUG - Failed to test CQJ:', data.error);
            if (data.traceback) {
                console.error('❌ DEBUG - Traceback:', data.traceback);
            }
            return data;
        }
    } catch (error) {
        console.error('❌ DEBUG - Error testing CQJ:', error);
        return { error: error.message };
    }
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