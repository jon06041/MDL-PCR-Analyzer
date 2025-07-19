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
 * Calculate CalcJ value (if needed - currently just a placeholder)
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