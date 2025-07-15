// --- Threshold Strategy Dropdown and Calculation Logic ---
function populateThresholdStrategyDropdown() {
    const select = document.getElementById('thresholdStrategySelect');
    if (!select) return;
    select.innerHTML = '';
    const scale = window.currentScaleMode || 'linear';
    console.log(`[DROPDOWN-DEBUG] Scale: ${scale}, currentScaleMode: ${window.currentScaleMode}`);
    console.log(`[DROPDOWN-DEBUG] window.LOG_THRESHOLD_STRATEGIES: ${typeof window.LOG_THRESHOLD_STRATEGIES}, window.LINEAR_THRESHOLD_STRATEGIES: ${typeof window.LINEAR_THRESHOLD_STRATEGIES}`);
    const strategies = scale === 'log' ? window.LOG_THRESHOLD_STRATEGIES : window.LINEAR_THRESHOLD_STRATEGIES;
    if (!strategies || typeof strategies !== 'object') {
        console.error('STRATEGY-DROPDOWN - Threshold strategies not available', {
            scale: scale,
            strategies: strategies,
            window_log: window.LOG_THRESHOLD_STRATEGIES,
            window_linear: window.LINEAR_THRESHOLD_STRATEGIES
        });
        return;
    }
    let firstKey = null;
    let found = false;
    Object.keys(strategies).forEach((key, idx) => {
        const strat = strategies[key];
        const option = document.createElement('option');
        option.value = key;
        option.textContent = strat.name || key;
        option.title = strat.description || '';
        select.appendChild(option);
        if (idx === 0) firstKey = key;
        if (window.selectedThresholdStrategy === key) found = true;
    });
    const manualOption = document.createElement('option');
    manualOption.value = 'manual';
    manualOption.textContent = 'Manual (User-Defined)';
    manualOption.title = 'Use manually entered threshold value';
    select.appendChild(manualOption);
    if (window.selectedThresholdStrategy === 'manual') found = true;
    if (!found && firstKey) {
        window.selectedThresholdStrategy = firstKey;
    }
    select.value = window.selectedThresholdStrategy || firstKey;
    window.selectedThresholdStrategy = select.value;
    console.log(`[STRATEGY-DROPDOWN] Populated with ${Object.keys(strategies).length} ${scale} strategies, selected: ${select.value}`);
    if (select.value !== 'manual') {
        if (typeof window.handleThresholdStrategyChange === 'function') {
            window.handleThresholdStrategyChange();
        }
    } else {
        if (typeof window.updateThresholdInputForCurrentScale === 'function') {
            window.updateThresholdInputForCurrentScale();
        }
    }
}

function getSelectedThresholdStrategy() {
    const select = document.getElementById('thresholdStrategySelect');
    if (select && select.value) {
        window.selectedThresholdStrategy = select.value;
        console.log(`[STRATEGY-DEBUG] Selected strategy from dropdown: "${select.value}"`);
        return select.value;
    }
    console.warn(`[STRATEGY-DEBUG] No strategy selected, returning null`);
    return null;
}

window.populateThresholdStrategyDropdown = populateThresholdStrategyDropdown;
window.getSelectedThresholdStrategy = getSelectedThresholdStrategy;
// Utility to calculate CQ-J and Calc-J for a well given its data and a threshold
// Assumes well.raw_rfu (array of RFU values) and well.raw_cycles (array of cycle numbers)

function calculateCqj(well, threshold) {
    if (!well || !Array.isArray(well.raw_rfu) || !Array.isArray(well.raw_cycles)) return null;
    
    // Ensure threshold is a number (database might return string)
    const numericThreshold = typeof threshold === 'string' ? parseFloat(threshold) : threshold;
    if (isNaN(numericThreshold) || numericThreshold <= 0) {
        console.warn('[CQJ-DEBUG] Invalid threshold value:', threshold, 'converted to:', numericThreshold);
        return null;
    }
    
    console.log(`[CQJ-DEBUG] Calculating CQJ for well with ${well.raw_rfu.length} points, threshold: ${numericThreshold}`);
    
    // Find the first cycle where RFU crosses the threshold
    for (let i = 0; i < well.raw_rfu.length; i++) {
        const currentRfu = typeof well.raw_rfu[i] === 'string' ? parseFloat(well.raw_rfu[i]) : well.raw_rfu[i];
        const currentCycle = typeof well.raw_cycles[i] === 'string' ? parseFloat(well.raw_cycles[i]) : well.raw_cycles[i];
        
        if (currentRfu >= numericThreshold) {
            // Linear interpolation for more precise Cq
            if (i === 0) {
                console.log(`[CQJ-DEBUG] Threshold crossed at first point, returning cycle: ${currentCycle}`);
                return currentCycle;
            }
            
            const prevRfu = typeof well.raw_rfu[i - 1] === 'string' ? parseFloat(well.raw_rfu[i - 1]) : well.raw_rfu[i - 1];
            const prevCycle = typeof well.raw_cycles[i - 1] === 'string' ? parseFloat(well.raw_cycles[i - 1]) : well.raw_cycles[i - 1];
            
            if (currentRfu === prevRfu) {
                console.log(`[CQJ-DEBUG] No RFU change, returning current cycle: ${currentCycle}`);
                return currentCycle; // avoid div by zero
            }
            
            const interpolatedCq = prevCycle + (numericThreshold - prevRfu) * (currentCycle - prevCycle) / (currentRfu - prevRfu);
            console.log(`[CQJ-DEBUG] Interpolated CQJ: ${interpolatedCq} (between cycles ${prevCycle}-${currentCycle})`);
            return interpolatedCq;
        }
    }
    
    console.log(`[CQJ-DEBUG] Threshold ${numericThreshold} never crossed by well with max RFU: ${Math.max(...well.raw_rfu)}`);
    return null; // never crossed
}

function calculateCalcj(well, threshold) {
    // Example: Calc-J = amplitude / threshold (replace with real formula if needed)
    if (!well || typeof well.amplitude === 'undefined' || well.amplitude === null) {
        console.warn('[CALCJ-DEBUG] Well missing amplitude:', well);
        return null;
    }
    
    // Ensure both amplitude and threshold are numbers
    const numericAmplitude = typeof well.amplitude === 'string' ? parseFloat(well.amplitude) : well.amplitude;
    const numericThreshold = typeof threshold === 'string' ? parseFloat(threshold) : threshold;
    
    if (isNaN(numericAmplitude) || isNaN(numericThreshold) || numericThreshold <= 0) {
        console.warn('[CALCJ-DEBUG] Invalid values - amplitude:', well.amplitude, 'threshold:', threshold);
        return null;
    }
    
    const calcjResult = numericAmplitude / numericThreshold;
    console.log(`[CALCJ-DEBUG] Calculated CalcJ: ${calcjResult} (amplitude: ${numericAmplitude} / threshold: ${numericThreshold})`);
    return calcjResult;
}

/**
 * Simple CQJ calculation function - FIXED: Skip first 5 cycles and return null for negatives
 * @param {Array<number>} rfuArray - Array of RFU values
 * @param {Array<number>} cyclesArray - Array of cycle numbers
 * @param {number} threshold - Threshold value
 * @returns {number|null} Interpolated cycle value or null if not found
 */
function calculateThresholdCrossing(rfuArray, cyclesArray, threshold) {
    if (!rfuArray || !cyclesArray || rfuArray.length !== cyclesArray.length) return null;
    const startCycle = 5; // Skip cycles 1-5 (indices 0-4)
    for (let i = startCycle; i < rfuArray.length; i++) {
        const rfu = parseFloat(rfuArray[i]);
        const cycle = parseFloat(cyclesArray[i]);
        if (rfu >= threshold) {
            if (i === startCycle) return cycle;
            const prevRfu = parseFloat(rfuArray[i - 1]);
            const prevCycle = parseFloat(cyclesArray[i - 1]);
            if (rfu === prevRfu) return cycle;
            const interpolatedCq = prevCycle + (threshold - prevRfu) * (cycle - prevCycle) / (rfu - prevRfu);
            console.log(`[CQJ-DEBUG] Threshold crossing found at cycle ${interpolatedCq.toFixed(2)} (between cycles ${prevCycle}-${cycle}, RFU: ${prevRfu.toFixed(2)}-${rfu.toFixed(2)}, threshold: ${threshold.toFixed(2)})`);
            return interpolatedCq;
        }
    }
    console.log(`[CQJ-DEBUG] No threshold crossing found (threshold: ${threshold.toFixed(2)}, max RFU: ${Math.max(...rfuArray.map(r => parseFloat(r))).toFixed(2)})`);
    return null;
}

/**
 * Recalculate CQJ/CalcJ values for all wells with current thresholds
 * This version works with any threshold strategy by using current threshold values
 */
function recalculateCQJValues() {
    console.log('🔍 CQJ-RECALC - Recalculating CQJ/CalcJ values with current thresholds');
    
    if (!window.currentAnalysisResults) {
        console.warn('❌ CQJ-RECALC - No analysis results available');
        return;
    }
    
    // Get the results structure
    let resultsObj = null;
    if (window.currentAnalysisResults.individual_results && typeof window.currentAnalysisResults.individual_results === 'object') {
        resultsObj = window.currentAnalysisResults.individual_results;
    } else if (typeof window.currentAnalysisResults === 'object' && !Array.isArray(window.currentAnalysisResults)) {
        resultsObj = window.currentAnalysisResults;
    }
    
    if (!resultsObj) {
        console.warn('❌ CQJ-RECALC - Could not find results object');
        return;
    }
    
    const currentScale = window.currentScaleMode || 'linear';
    
    if (!window.stableChannelThresholds) {
        console.warn('❌ CQJ-RECALC - No threshold data available');
        return;
    }
    
    console.log(`🔍 CQJ-RECALC - Using thresholds for ${currentScale} scale:`, window.stableChannelThresholds);
    
    // Recalculate CQJ for all wells
    Object.keys(resultsObj).forEach(wellKey => {
        const well = resultsObj[wellKey];
        const wellChannel = well.fluorophore;
        
        if (wellChannel && window.stableChannelThresholds[wellChannel] && window.stableChannelThresholds[wellChannel][currentScale]) {
            const threshold = window.stableChannelThresholds[wellChannel][currentScale];
            
            const rfuData = well.rfu || well.raw_rfu;
            const cyclesData = well.cycles || well.raw_cycles;
            
            let rfuArray = Array.isArray(rfuData) ? rfuData : (typeof rfuData === 'string' ? JSON.parse(rfuData) : []);
            let cyclesArray = Array.isArray(cyclesData) ? cyclesData : (typeof cyclesData === 'string' ? JSON.parse(cyclesData) : []);
            
            // Ensure arrays are numbers
            if (Array.isArray(rfuArray)) {
                rfuArray = rfuArray.map(val => typeof val === 'string' ? parseFloat(val) : val);
            }
            if (Array.isArray(cyclesArray)) {
                cyclesArray = cyclesArray.map(val => typeof val === 'string' ? parseFloat(val) : val);
            }
            
            if (Array.isArray(rfuArray) && Array.isArray(cyclesArray) && rfuArray.length > 0) {
                const oldCqjValue = well.cqj_value;
                well.cqj_value = window.calculateThresholdCrossing(rfuArray, cyclesArray, threshold);
                
                // Update the CQJ object structure too
                if (!well.cqj) well.cqj = {};
                well.cqj[wellChannel] = well.cqj_value;
                
                console.log(`✅ CQJ-RECALC - ${wellKey} (${wellChannel}): ${oldCqjValue} → ${well.cqj_value} (threshold: ${threshold})`);
            }
        }
    });
    
    // Update the results table to show new CQJ values
    if (typeof window.displayResultsInTable === 'function') {
        window.displayResultsInTable(resultsObj);
    } else if (typeof window.populateResultsTable === 'function') {
        window.populateResultsTable(resultsObj);
    }
    
    console.log('🔍 CQJ-RECALC - CQJ recalculation complete');
}

/**
 * Recalculate CQJ/CalcJ values for all wells after manual threshold input
 * This version doesn't trigger strategy recalculation, just uses the manually set threshold
 */
function recalculateCQJValuesForManualThreshold() {
    console.log('🔍 MANUAL-THRESHOLD - Recalculating CQJ/CalcJ values after manual threshold input');
    
    if (!window.currentAnalysisResults) {
        console.warn('❌ MANUAL-THRESHOLD - No analysis results available');
        return;
    }
    
    // Get the results structure
    let resultsObj = null;
    if (window.currentAnalysisResults.individual_results && typeof window.currentAnalysisResults.individual_results === 'object') {
        resultsObj = window.currentAnalysisResults.individual_results;
    } else if (typeof window.currentAnalysisResults === 'object' && !Array.isArray(window.currentAnalysisResults)) {
        resultsObj = window.currentAnalysisResults;
    }
    
    if (!resultsObj) {
        console.warn('❌ MANUAL-THRESHOLD - Could not find results object');
        return;
    }
    
    const currentChannel = window.currentFluorophore;
    const currentScale = window.currentScaleMode || 'linear';
    
    if (!currentChannel || !window.stableChannelThresholds || !window.stableChannelThresholds[currentChannel]) {
        console.warn('❌ MANUAL-THRESHOLD - Missing channel or threshold data', {
            channel: currentChannel,
            scale: currentScale,
            thresholds: window.stableChannelThresholds
        });
        return;
    }
    
    const threshold = window.stableChannelThresholds[currentChannel][currentScale];
    console.log(`🔍 MANUAL-THRESHOLD - Using threshold ${threshold} for channel ${currentChannel} (${currentScale} scale)`);
    
    // Recalculate CQJ for all wells with this channel
    Object.keys(resultsObj).forEach(wellKey => {
        const well = resultsObj[wellKey];
        if (well.fluorophore === currentChannel) {
            const rfuData = well.rfu || well.raw_rfu;
            const cyclesData = well.cycles || well.raw_cycles;
            
            let rfuArray = Array.isArray(rfuData) ? rfuData : (typeof rfuData === 'string' ? JSON.parse(rfuData) : []);
            let cyclesArray = Array.isArray(cyclesData) ? cyclesData : (typeof cyclesData === 'string' ? JSON.parse(cyclesData) : []);
            
            // Ensure arrays are numbers
            if (Array.isArray(rfuArray)) {
                rfuArray = rfuArray.map(val => typeof val === 'string' ? parseFloat(val) : val);
            }
            if (Array.isArray(cyclesArray)) {
                cyclesArray = cyclesArray.map(val => typeof val === 'string' ? parseFloat(val) : val);
            }
            
            if (Array.isArray(rfuArray) && Array.isArray(cyclesArray) && rfuArray.length > 0) {
                const oldCqjValue = well.cqj_value;
                well.cqj_value = window.calculateThresholdCrossing(rfuArray, cyclesArray, threshold);
                
                // Update the CQJ object structure too
                if (!well.cqj) well.cqj = {};
                well.cqj[currentChannel] = well.cqj_value;
                
                console.log(`✅ MANUAL-THRESHOLD-CQJ - ${wellKey}: ${oldCqjValue} → ${well.cqj_value} (manual threshold: ${threshold})`);
            }
        }
    });
    
    // Update the results table to show new CQJ values
    if (typeof window.displayResultsInTable === 'function') {
        window.displayResultsInTable(resultsObj);
    }
}

// Export for use in script.js
window.calculateCqj = calculateCqj;
window.calculateCalcj = calculateCalcj;
window.calculateThresholdCrossing = calculateThresholdCrossing;
window.recalculateCQJValues = recalculateCQJValues;
window.recalculateCQJValuesForManualThreshold = recalculateCQJValuesForManualThreshold;
