// CQJ/CalcJ calculation utilities
// This file should ONLY contain calculation logic, not UI controls

/**
 * Calculate CQJ (threshold crossing) for a well
 * Skips first 5 cycles and uses linear interpolation
 * @param {Array<number>} rfuArray - Array of RFU values
 * @param {Array<number>} cyclesArray - Array of cycle numbers
 * @param {number} threshold - Threshold value
 * @returns {number|null} Interpolated cycle value or null if not found
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
    
    for (let i = startCycle; i < rfuArray.length; i++) {
        const rfu = parseFloat(rfuArray[i]);
        const cycle = parseFloat(cyclesArray[i]);
        
        if (rfu >= numericThreshold) {
            // Found crossing point
            if (i === startCycle) {
                // Threshold already crossed at start
                return cycle;
            }
            
            // Linear interpolation between previous and current point
            const prevRfu = parseFloat(rfuArray[i - 1]);
            const prevCycle = parseFloat(cyclesArray[i - 1]);
            
            if (rfu === prevRfu) {
                // No change in RFU, return current cycle
                return cycle;
            }
            
            // Interpolate
            const interpolatedCq = prevCycle + 
                (numericThreshold - prevRfu) * (cycle - prevCycle) / (rfu - prevRfu);
            
            console.log(`✅ CQJ-CALC - Crossing at ${interpolatedCq.toFixed(2)} ` +
                `(between cycles ${prevCycle}-${cycle}, RFU: ${prevRfu.toFixed(2)}-${rfu.toFixed(2)})`);
            
            return interpolatedCq;
        }
    }
    
    // Never crossed threshold
    const maxRfu = Math.max(...rfuArray.slice(startCycle).map(r => parseFloat(r)));
    console.log(`❌ CQJ-CALC - No crossing (threshold: ${numericThreshold.toFixed(2)}, max RFU: ${maxRfu.toFixed(2)})`);
    return null;
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
        }
    });
    
    console.log(`🔍 CQJ-RECALC - Updated ${updateCount} wells`);
    
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
        console.log('[CALCJ-DEBUG] CONCENTRATION_CONTROLS not available, using basic method');
        return { calcj_value: calculateCalcj(well, threshold), method: 'basic' };
    }
    
    const concValues = CONCENTRATION_CONTROLS[testCode]?.[channel];
    if (!concValues) {
        console.log(`[CALCJ-DEBUG] No concentration controls found for ${testCode}/${channel}, using basic method`);
        return { calcj_value: calculateCalcj(well, threshold), method: 'basic' };
    }
    
    // Find H/M/L control wells and collect their CQJ values
    const controlCqj = { H: [], M: [], L: [] };
    
    if (allWellResults && typeof allWellResults === 'object') {
        Object.keys(allWellResults).forEach(wellKey => {
            const wellData = allWellResults[wellKey];
            if (!wellKey || !wellData) return;
            
            // Check if this is a control well with comprehensive pattern matching
            let controlType = null;
            const upperKey = wellKey.toUpperCase();
            
            // HIGH control patterns
            if (wellKey.startsWith('H_') || wellKey.includes('_H_') || upperKey.startsWith('HIGH') ||
                upperKey.includes('HIGH') || upperKey.includes('H1') || upperKey.includes('H2') || 
                upperKey.includes('H3') || upperKey.includes('POS') || upperKey.includes('POSITIVE') ||
                upperKey.includes('1E7') || upperKey.includes('10E7') || upperKey.includes('1E+7')) {
                controlType = 'H';
            } 
            // MEDIUM control patterns  
            else if (wellKey.startsWith('M_') || wellKey.includes('_M_') || upperKey.startsWith('MEDIUM') ||
                     upperKey.includes('MEDIUM') || upperKey.includes('M1') || upperKey.includes('M2') ||
                     upperKey.includes('M3') || upperKey.includes('MED') || 
                     upperKey.includes('1E5') || upperKey.includes('10E5') || upperKey.includes('1E+5')) {
                controlType = 'M';
            }
            // LOW control patterns
            else if (wellKey.startsWith('L_') || wellKey.includes('_L_') || upperKey.startsWith('LOW') ||
                     upperKey.includes('LOW') || upperKey.includes('L1') || upperKey.includes('L2') ||
                     upperKey.includes('L3') || 
                     upperKey.includes('1E3') || upperKey.includes('10E3') || upperKey.includes('1E+3')) {
                controlType = 'L';
            }
            // Also check sample_name if available
            else if (wellData.sample_name) {
                const upperSample = wellData.sample_name.toUpperCase();
                if (upperSample.includes('HIGH') || upperSample.includes('POS') || upperSample.includes('H1') ||
                    upperSample.includes('1E7') || upperSample.includes('10E7') || upperSample.includes('1E+7')) {
                    controlType = 'H';
                } else if (upperSample.includes('MEDIUM') || upperSample.includes('MED') || upperSample.includes('M1') ||
                          upperSample.includes('1E5') || upperSample.includes('10E5') || upperSample.includes('1E+5')) {
                    controlType = 'M';
                } else if (upperSample.includes('LOW') || upperSample.includes('L1') ||
                          upperSample.includes('1E3') || upperSample.includes('10E3') || upperSample.includes('1E+3')) {
                    controlType = 'L';
                }
            }
            
            if (controlType && wellData.cqj_value !== null && wellData.cqj_value !== undefined) {
                controlCqj[controlType].push(wellData.cqj_value);
                console.log(`[CALCJ-DEBUG] Found ${controlType} control: ${wellKey} (CQJ: ${wellData.cqj_value})`);
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
    
    // Check if we have enough controls for standard curve
    if (Object.keys(avgControlCqj).length < 2) {
        console.log(`[CALCJ-DEBUG] Insufficient controls found (${Object.keys(avgControlCqj).length}), checking all wells for any patterns...`);
        
        // DEBUGGING: Show all well keys to help identify control patterns
        if (allWellResults) {
            const allKeys = Object.keys(allWellResults);
            console.log(`[CALCJ-DEBUG] All available wells: ${allKeys.join(', ')}`);
            
            // Try to find ANY wells that might be controls with more flexible patterns
            allKeys.forEach(key => {
                const upperKey = key.toUpperCase();
                const wellData = allWellResults[key];
                if (wellData && wellData.cqj_value !== null && wellData.cqj_value !== undefined) {
                    console.log(`[CALCJ-DEBUG] Well ${key}: CQJ=${wellData.cqj_value}, sample_name=${wellData.sample_name || 'N/A'}`);
                }
            });
        }
        
        console.log(`[CALCJ-DEBUG] Using basic method due to insufficient controls`);
        return { calcj_value: calculateCalcj(well, threshold), method: 'basic' };
    }
    
    // Get CQJ for current well
    const currentCqj = well.cqj_value;
    if (currentCqj === null || currentCqj === undefined) {
        console.log('[CALCJ-DEBUG] No CQJ value, cannot calculate CalcJ');
        return { calcj_value: null, method: 'control_based_failed' };
    }
    
    // Check for early crossing (crossing before lowest control)
    const controlCqjValues = Object.values(avgControlCqj);
    if (controlCqjValues.length > 0) {
        const minControlCqj = Math.min(...controlCqjValues);
        if (currentCqj < minControlCqj) {
            console.log(`[CALCJ-DEBUG] Early crossing detected (CQJ ${currentCqj.toFixed(2)} < min control ${minControlCqj.toFixed(2)})`);
            return { calcj_value: 'N/A', method: 'early_crossing' };
        }
    }
    
    // Use H and L controls for standard curve (most reliable)
    const hCq = avgControlCqj.H;
    const lCq = avgControlCqj.L;
    const hVal = concValues.H;
    const lVal = concValues.L;
    
    try {
        if (hCq !== undefined && lCq !== undefined && hVal && lVal) {
            // Log-linear interpolation (standard curve)
            const slope = (Math.log10(hVal) - Math.log10(lVal)) / (lCq - hCq);
            const intercept = Math.log10(hVal) - slope * hCq;
            const logConc = slope * currentCqj + intercept;
            const calcjResult = Math.pow(10, logConc);
            
            console.log(`[CALCJ-DEBUG] Control-based CalcJ = ${calcjResult.toExponential(2)} (CQJ: ${currentCqj.toFixed(2)})`);
            return { calcj_value: calcjResult, method: 'control_based' };
        } else {
            console.log('[CALCJ-DEBUG] Missing H/L controls, using basic method');
            return { calcj_value: calculateCalcj(well, threshold), method: 'basic' };
        }
    } catch (error) {
        console.log(`[CALCJ-DEBUG] Error in control-based calculation: ${error.message}, using basic method`);
        return { calcj_value: calculateCalcj(well, threshold), method: 'basic' };
    }
}

/**
 * Calculate CalcJ value (basic method - currently amplitude/threshold)
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