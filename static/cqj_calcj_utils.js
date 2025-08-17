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
    
    // Find ALL threshold crossings starting from cycle 5, but be more permissive about early crossings
    const crossings = [];
    
    // Check if data starts above threshold (early crossing case)
    let startedAboveThreshold = false;
    if (startCycle < numericRfu.length && numericRfu[startCycle] >= numericThreshold) {
        startedAboveThreshold = true;
        console.log(`[CQJ-DEBUG] Data starts above threshold at cycle ${startCycle}, looking for next crossing pattern`);
    }
    
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
    
    // Special case: if we started above threshold, look for the first proper positive crossing
    // (going from below to above after potentially going below threshold first)
    if (startedAboveThreshold && crossings.length > 0) {
        // Find the first positive crossing that happens after any negative crossing
        const negativeCrossings = crossings.filter(c => c.direction === 'negative');
        const positiveCrossings = crossings.filter(c => c.direction === 'positive');
        
        if (negativeCrossings.length > 0 && positiveCrossings.length > 0) {
            // Find positive crossings that come after the first negative crossing
            const firstNegativeCycle = negativeCrossings[0].cycle;
            const validPositiveCrossings = positiveCrossings.filter(c => c.cycle > firstNegativeCycle);
            
            if (validPositiveCrossings.length > 0) {
                // Use the first valid positive crossing after the curve went below threshold
                const firstValidCrossing = validPositiveCrossings[0];
                console.log(`[CQJ-DEBUG] Found valid positive crossing after early crossing: ${firstValidCrossing.cycle}`);
                return firstValidCrossing.cycle;
            }
        }
        
        // If no valid pattern found, fall back to the last positive crossing
        if (positiveCrossings.length > 0) {
            const lastPositiveCrossing = positiveCrossings[positiveCrossings.length - 1];
            console.log(`[CQJ-DEBUG] Using last positive crossing as fallback: ${lastPositiveCrossing.cycle}`);
            return lastPositiveCrossing.cycle;
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
 * Determine if a well is a control well and what type (H, M, L, NTC)
 * @param {string} wellKey - The well identifier
 * @param {Object} well - The well data object
 * @returns {string|null} Control type ('H', 'M', 'L', 'NTC') or null if not a control
 */
function determineControlType(wellKey, well) {
    if (!wellKey || !well) return null;
    
    const sampleName = well.sample_name || '';
    const upperSampleName = sampleName.toUpperCase();
    
    // Check for NTC first
    if (sampleName.includes('NTC') || upperSampleName.includes('NTC')) {
        console.log(`[CONTROL-DETECT] Found NTC control: ${wellKey} (sample: ${sampleName})`);
        return 'NTC';
    }
    
    // VERY STRICT control detection: Only identify wells with explicit control patterns
    // Since sample names without controls won't have letters, we can be more specific
    
    // Method 1: Look for H-, M-, L- patterns (most reliable)
    if (sampleName.includes('H-')) {
        //console.log(`[CONTROL-DETECT] Found H control: ${wellKey} (H- pattern in: ${sampleName})`);
        return 'H';
    }
    if (sampleName.includes('M-')) {
        //console.log(`[CONTROL-DETECT] Found M control: ${wellKey} (M- pattern in: ${sampleName})`);
        return 'M';
    }
    if (sampleName.includes('L-')) {
        //console.log(`[CONTROL-DETECT] Found L control: ${wellKey} (L- pattern in: ${sampleName})`);
        return 'L';
    }
    
    // Method 2: Look for explicit concentration indicators
    if (upperSampleName.includes('1E7') || upperSampleName.includes('10E7') || upperSampleName.includes('1E+7')) {
        //console.log(`[CONTROL-DETECT] Found H control by concentration: ${wellKey} (sample: ${sampleName})`);
        return 'H';
    }
    if (upperSampleName.includes('1E5') || upperSampleName.includes('10E5') || upperSampleName.includes('1E+5')) {
        //console.log(`[CONTROL-DETECT] Found M control by concentration: ${wellKey} (sample: ${sampleName})`);
        return 'M';
    }
    if (upperSampleName.includes('1E3') || upperSampleName.includes('10E3') || upperSampleName.includes('1E+3')) {
        //console.log(`[CONTROL-DETECT] Found L control by concentration: ${wellKey} (sample: ${sampleName})`);
        return 'L';
    }
    
    // Method 3: Look for explicit control words (only if very clear)
    if (upperSampleName.includes('HIGH CONTROL') || upperSampleName.includes('POSITIVE CONTROL')) {
        //console.log(`[CONTROL-DETECT] Found H control by explicit name: ${wellKey} (sample: ${sampleName})`);
        return 'H';
    }
    if (upperSampleName.includes('MEDIUM CONTROL') || upperSampleName.includes('MED CONTROL')) {
        //console.log(`[CONTROL-DETECT] Found M control by explicit name: ${wellKey} (sample: ${sampleName})`);
        return 'M';
    }
    if (upperSampleName.includes('LOW CONTROL')) {
        //console.log(`[CONTROL-DETECT] Found L control by explicit name: ${wellKey} (sample: ${sampleName})`);
        return 'L';
    }
    
    // DO NOT classify as control well - be very conservative
    //console.log(`[CONTROL-DETECT] Sample well (not control): ${wellKey} (sample: ${sampleName})`);
    return null; // Not a control well
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
    let safetyFixCount = 0;
    
    // Get test code for CalcJ calculations using robust extraction
    const testCode = getCurrentTestCode();
    
    console.log(`[CALCJ-RECALC] Starting CQJ/CalcJ recalculation for ${Object.keys(results).length} wells (testCode: ${testCode})`);
    
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
                calcjResult = { calcj_value: null, method: 'no_threshold_crossing' };
                //console.log(`[CALCJ-FIX] Well ${wellKey}: No threshold crossing, CalcJ = N/A`);
            } else {
                // Check if this is a control well - if so, use FIXED concentration values
                const controlType = determineControlType(wellKey, well);
                if (controlType && ['H', 'M', 'L'].includes(controlType)) {
                    // Control wells get FIXED concentrations from centralized CONCENTRATION_CONTROLS
                    const concentrationControls = (typeof CONCENTRATION_CONTROLS !== 'undefined') ? 
                        CONCENTRATION_CONTROLS : 
                        (typeof window !== 'undefined' ? window.CONCENTRATION_CONTROLS : null);
                        
                    const concValues = concentrationControls?.[testCode]?.[channel];
                    if (concValues && concValues[controlType]) {
                        calcjResult = { 
                            calcj_value: concValues[controlType], 
                            method: `fixed_${controlType.toLowerCase()}_control` 
                        };
                        //console.log(`[CALCJ-FIX] CONTROL Well ${wellKey} (${controlType}): Fixed CalcJ = ${concValues[controlType]} (CQJ: ${newCqj})`);
                    } else {
                        // Fallback to dynamic calculation if no fixed value available
                        calcjResult = calculateCalcjWithControls(well, threshold, results, testCode, channel);
                        //console.log(`[CALCJ-FIX] CONTROL Well ${wellKey} (${controlType}): No fixed value found, using dynamic calculation`);
                    }
                } else {
                    // Sample wells get dynamic calculation using control-based standard curve
                    calcjResult = calculateCalcjWithControls(well, threshold, results, testCode, channel);
                    //console.log(`[CALCJ-FIX] SAMPLE Well ${wellKey}: Dynamic CalcJ = ${calcjResult.calcj_value} (method: ${calcjResult.method}, CQJ: ${newCqj})`);
                }
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
    
    console.log(`[CALCJ-RECALC] Completed: ${updateCount} CQJ updates, ${calcjUpdateCount} CalcJ updates, ${safetyFixCount} safety fixes`);
    
    // SAFETY CHECK: Ensure any well with null CQJ has N/A CalcJ
    safetyFixCount = 0; // Reset counter for safety check
    Object.entries(results).forEach(([wellKey, well]) => {
        if ((well.cqj_value === null || well.cqj_value === undefined) && 
            (well.calcj_value !== null && well.calcj_value !== undefined && well.calcj_value !== 'N/A')) {
            well.calcj_value = 'N/A';
            well['CalcJ'] = 'N/A';
            well.calcj_method = 'safety_fix_no_threshold_crossing';
            safetyFixCount++;
            console.log(`[CALCJ-SAFETY] Well ${wellKey}: Fixed CalcJ to N/A due to no threshold crossing`);
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
    // FIRST CHECK: If this well itself is a control, don't calculate - it should get fixed values
    const wellKey = well.wellKey || well.well_id || 'unknown';
    const currentWellControlType = determineControlType(wellKey, well);
    if (currentWellControlType && ['H', 'M', 'L'].includes(currentWellControlType)) {
        // This well is a control - it should get fixed values, not calculated ones
        const concentrationControls = (typeof CONCENTRATION_CONTROLS !== 'undefined') ? 
            CONCENTRATION_CONTROLS : 
            (typeof window !== 'undefined' ? window.CONCENTRATION_CONTROLS : null);
            
        const concValues = concentrationControls?.[testCode]?.[channel];
        if (concValues && concValues[currentWellControlType]) {
            console.log(`[CALCJ-DEBUG] Control well ${wellKey} (${currentWellControlType}) getting fixed value: ${concValues[currentWellControlType]}`);
            return { 
                calcj_value: concValues[currentWellControlType], 
                method: `fixed_${currentWellControlType.toLowerCase()}_control_direct` 
            };
        }
    }
    
    // Check if we have concentration controls for this test/channel
    if (typeof CONCENTRATION_CONTROLS === 'undefined' && typeof window !== 'undefined') {
        // Try to get from window if not in global scope
        window.CONCENTRATION_CONTROLS = window.CONCENTRATION_CONTROLS || {};
    }
    
    const concentrationControls = (typeof CONCENTRATION_CONTROLS !== 'undefined') ? 
        CONCENTRATION_CONTROLS : 
        (typeof window !== 'undefined' ? window.CONCENTRATION_CONTROLS : null);
        
    if (!concentrationControls) {
        console.warn('[CALCJ-DEBUG] CONCENTRATION_CONTROLS not available - may need to wait for config loading');
        return { calcj_value: null, method: 'no_concentration_controls' };
    }
    
    const concValues = concentrationControls[testCode]?.[channel];
    if (!concValues) {
        console.warn(`[CALCJ-DEBUG] No concentration controls for ${testCode}/${channel}`);
        return { calcj_value: null, method: 'no_concentration_controls' };
    }
    
    // Find H/M/L/NTC control wells and collect their CQJ values
    const controlCqj = { H: [], M: [], L: [], NTC: [] };
    
    if (allWellResults && typeof allWellResults === 'object') {
        Object.keys(allWellResults).forEach(wellKey => {
            const wellData = allWellResults[wellKey];
            if (!wellKey || !wellData) return;
            
            // Use the same strict control detection logic
            const controlType = determineControlType(wellKey, wellData);
            
            // Handle control types appropriately
            if (controlType === 'NTC') {
                // NTC controls should NOT have CQJ values unless contaminated
                if (wellData.cqj_value !== null && wellData.cqj_value !== undefined) {
                    controlCqj[controlType].push(wellData.cqj_value);
                }
            } else if (controlType && ['H', 'M', 'L'].includes(controlType) && 
                      wellData.cqj_value !== null && wellData.cqj_value !== undefined) {
                // H/M/L controls should have CQJ values
                controlCqj[controlType].push(wellData.cqj_value);
                console.log(`[CALCJ-DEBUG] Found ${controlType} control well ${wellKey} with CQJ: ${wellData.cqj_value}`);
            }
        });
    }
    
    // Calculate average CQJ for each control level with outlier detection
    const avgControlCqj = {};
    Object.keys(controlCqj).forEach(controlType => {
        const cqjList = controlCqj[controlType];
        if (cqjList.length > 0) {
            if (cqjList.length === 1) {
                // Only one control, use it
                avgControlCqj[controlType] = cqjList[0];
                console.log(`[CALCJ-DEBUG] Single ${controlType} control: ${cqjList[0]}`);
            } else if (cqjList.length === 2) {
                // Two controls, use average
                avgControlCqj[controlType] = cqjList.reduce((sum, val) => sum + val, 0) / cqjList.length;
                console.log(`[CALCJ-DEBUG] Two ${controlType} controls, average: ${avgControlCqj[controlType]} from [${cqjList.join(', ')}]`);
            } else {
                // Three or more controls - detect outliers and use consensus
                const sorted = [...cqjList].sort((a, b) => a - b);
                const median = sorted[Math.floor(sorted.length / 2)];
                const q1 = sorted[Math.floor(sorted.length / 4)];
                const q3 = sorted[Math.floor(3 * sorted.length / 4)];
                const iqr = q3 - q1;
                const lowerBound = q1 - 1.5 * iqr;
                const upperBound = q3 + 1.5 * iqr;
                
                // Filter out outliers
                const consensus = cqjList.filter(val => val >= lowerBound && val <= upperBound);
                
                if (consensus.length > 0) {
                    avgControlCqj[controlType] = consensus.reduce((sum, val) => sum + val, 0) / consensus.length;
                    //console.log(`[CALCJ-DEBUG] ${controlType} control consensus: ${avgControlCqj[controlType]} from [${consensus.join(', ')}] (excluded outliers: [${cqjList.filter(val => val < lowerBound || val > upperBound).join(', ')}])`);
                } else {
                    // All were outliers, use median as fallback
                    avgControlCqj[controlType] = median;
                    //console.log(`[CALCJ-DEBUG] ${controlType} control all outliers, using median: ${median}`);
                }
            }
        }
    });
    
    // Check if we have enough controls for standard curve (REQUIRE H and L controls)
    if (!avgControlCqj.H || !avgControlCqj.L) {
        //console.warn(`[CALCJ-DEBUG] Missing required controls - H: ${avgControlCqj.H}, L: ${avgControlCqj.L}`);
        return { calcj_value: null, method: 'missing_required_controls' };
    }
    
    // Get CQJ for current well
    const currentCqj = well.cqj_value;
    if (currentCqj === null || currentCqj === undefined) {
        //console.warn(`[CALCJ-DEBUG] Current well has no CQJ value`);
        return { calcj_value: null, method: 'no_threshold_crossing' };
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
            return { calcj_value: null, method: 'early_crossing' };
        }
        
        // Also check for very late crossing (contamination or poor amplification)
        const lateThreshold = maxControlCqj + Math.max(2.0, controlRange * 0.5);
        
        if (currentCqj > lateThreshold) {
            return { calcj_value: null, method: 'late_crossing' };
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
        // DIVISION BY ZERO PROTECTION: Validate that we have reasonable control data
        if (Math.abs(hCq - lCq) < 0.5) {
            return { calcj_value: null, method: 'controls_too_close' };
        }
        
        // DIVISION BY ZERO PROTECTION: Ensure concentration values are positive
        if (hVal <= 0 || lVal <= 0) {
            return { calcj_value: null, method: 'invalid_concentration_values' };
        }
        
        // Log-linear interpolation using ACTUAL control values from this run
        const logH = Math.log10(hVal);
        const logL = Math.log10(lVal);
        
        // DIVISION BY ZERO PROTECTION: Check for invalid log values
        if (!isFinite(logH) || !isFinite(logL)) {
            return { calcj_value: null, method: 'invalid_log_values' };
        }
        
        // Calculate slope: change in log(concentration) per cycle
        // NOTE: Slope should be NEGATIVE because lower CQJ = higher concentration
        // DIVISION BY ZERO PROTECTION: Ensure we're not dividing by zero
        const cqjDifference = hCq - lCq;
        if (Math.abs(cqjDifference) < 1e-10) {
            return { calcj_value: null, method: 'zero_cqj_difference' };
        }
        
        const slope = (logH - logL) / cqjDifference;
        const intercept = logH - slope * hCq;
        
        // DIVISION BY ZERO PROTECTION: Check for invalid slope/intercept
        if (!isFinite(slope) || !isFinite(intercept)) {
            return { calcj_value: null, method: 'invalid_slope_intercept' };
        }
        
        // Calculate concentration for current CQJ
        const logConc = slope * currentCqj + intercept;
        
        // DIVISION BY ZERO PROTECTION: Check for invalid log concentration
        if (!isFinite(logConc)) {
            return { calcj_value: null, method: 'invalid_log_concentration' };
        }
        
        const calcjResult = Math.pow(10, logConc);
        
        // Enhanced sanity checks: result should be within reasonable range
        if (!isFinite(calcjResult) || calcjResult < 0 || calcjResult > 1e12 || isNaN(calcjResult)) {
            return { calcj_value: null, method: 'unreasonable_result' };
        }
        
        // Additional check for extremely small values that might round to 0
        if (calcjResult < 1e-10) {
            return { calcj_value: null, method: 'value_too_small' };
        }
        
        // CRITICAL: Check for negative e-notation results (should be N/A)
        if (calcjResult < 1) {
            return { calcj_value: null, method: 'negative_exponential' };
        }
        
        // DIVISION BY ZERO PROTECTION: Final check for zero result
        if (calcjResult === 0) {
            return { calcj_value: null, method: 'zero_result' };
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
        
        // CRITICAL: Refresh open modal if it exists
        if (window.currentModalWellKey && typeof updateModalContent === 'function') {
            updateModalContent(window.currentModalWellKey);
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
