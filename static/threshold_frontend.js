// threshold_frontend.js
// All frontend threshold calculation, storage, and chart annotation logic

// --- Global threshold storage ---
if (!window.stableChannelThresholds) {
    window.stableChannelThresholds = {}; // { channel: { linear: value, log: value } }
}
let channelThresholds = {};

// Manual threshold markers to prevent override when user sets manual values
if (!window.manualThresholds) {
    window.manualThresholds = {}; // { channel: { linear: bool, log: bool } }
}

// --- Threshold Calculation Functions ---
function calculateChannelThreshold(channel, scale) {
    console.log(`🔍 THRESHOLD-CALC - Calculating ${scale} threshold for channel: ${channel} using ALL wells`);
    
    // Multiple null checks for robustness
    if (!window.currentAnalysisResults) {
        console.warn('🔍 THRESHOLD-CALC - window.currentAnalysisResults is null');
        return scale === 'log' ? 10 : 100;
    }
    
    if (!window.currentAnalysisResults.individual_results) {
        console.warn('🔍 THRESHOLD-CALC - individual_results is null');
        return scale === 'log' ? 10 : 100;
    }
    
    if (typeof window.currentAnalysisResults.individual_results !== 'object') {
        console.warn('🔍 THRESHOLD-CALC - individual_results is not an object');
        return scale === 'log' ? 10 : 100;
    }
    
    // Get ALL wells for this channel (by fluorophore) - CRITICAL: This uses ALL wells, not just displayed ones
    const channelWells = Object.keys(window.currentAnalysisResults.individual_results)
        .map(wellKey => window.currentAnalysisResults.individual_results[wellKey])
        .filter(well => well != null && well.fluorophore === channel); // Filter by fluorophore property
    
    if (channelWells.length === 0) {
        console.warn(`🔍 THRESHOLD-CALC - No wells found for channel: ${channel}`);
        return scale === 'log' ? 10 : 100;
    }
    
    console.log(`🔍 THRESHOLD-CALC - Found ${channelWells.length} wells for channel ${channel} (using ALL wells in dataset)`);
    
    // Use threshold_strategies.js for proper log scale calculation
    if (scale === 'log' && typeof window.calculateThreshold === 'function') {
        return calculateLogThresholdUsingStrategies(channelWells, channel);
    } else {
        return calculateLinearThreshold(channelWells, channel);
    }
}

/**
 * Calculate log threshold using threshold_strategies.js default log strategy
 * This ensures consistent log scale calculations for backend CQJ/CalcJ
 */
function calculateLogThresholdUsingStrategies(channelWells, channel) {
    console.log(`🔍 LOG-THRESHOLD-STRATEGIES - Using threshold_strategies.js for ${channel}`);
    
    try {
        // Get first well for baseline parameters
        const firstWell = channelWells[0];
        if (!firstWell) return 10;
        
        // Prepare parameters for strategy calculation
        const params = {
            fluorophore: channel,
            pathogen: firstWell.pathogen || firstWell.test_code,
            L: firstWell.amplitude || calculateAmplitudeFromWells(channelWells),
            B: firstWell.baseline || calculateBaselineFromWells(channelWells),
            baseline: firstWell.baseline || calculateBaselineFromWells(channelWells),
            baseline_std: firstWell.baseline_std || (firstWell.baseline ? firstWell.baseline * 0.1 : 10)
        };
        
        console.log(`🔍 LOG-THRESHOLD-STRATEGIES - Parameters for ${channel}:`, params);
        
        // Use the default log strategy from threshold_strategies.js
        const threshold = window.calculateThreshold('default', params, 'log');
        
        if (threshold && typeof threshold === 'number' && threshold > 0) {
            console.log(`🔍 LOG-THRESHOLD-STRATEGIES - Calculated threshold for ${channel}: ${threshold}`);
            return threshold;
        } else {
            console.warn(`🔍 LOG-THRESHOLD-STRATEGIES - Invalid threshold calculated, using fallback`);
            return calculateLogThresholdFallback(channelWells, channel);
        }
        
    } catch (error) {
        console.error(`🔍 LOG-THRESHOLD-STRATEGIES - Error calculating threshold:`, error);
        return calculateLogThresholdFallback(channelWells, channel);
    }
}

/**
 * Calculate amplitude from wells data
 */
function calculateAmplitudeFromWells(wells) {
    const amplitudes = wells
        .map(well => well.amplitude)
        .filter(amp => amp && typeof amp === 'number');
    
    if (amplitudes.length === 0) return 1000; // Default fallback
    
    return amplitudes.reduce((sum, amp) => sum + amp, 0) / amplitudes.length;
}

/**
 * Calculate baseline from wells data
 */
function calculateBaselineFromWells(wells) {
    const baselines = wells
        .map(well => well.baseline)
        .filter(baseline => baseline && typeof baseline === 'number');
    
    if (baselines.length === 0) return 50; // Default fallback
    
    return baselines.reduce((sum, baseline) => sum + baseline, 0) / baselines.length;
}

/**
 * Fallback log threshold calculation if strategies fail
 */
function calculateLogThresholdFallback(channelWells, channel) {
    console.log(`🔍 LOG-THRESHOLD-FALLBACK - Using fallback calculation for ${channel}`);
    
    // Collect amplification values from cycles 1-5 across all wells in this channel
    const cycles1to5Values = [];
    
    channelWells.forEach(well => {
        if (well.raw_data && Array.isArray(well.raw_data)) {
            // Take first 5 cycles (indices 0-4)
            const earlyCycles = well.raw_data.slice(0, 5);
            earlyCycles.forEach(cycleData => {
                if (cycleData && typeof cycleData.y === 'number' && cycleData.y > 0) {
                    cycles1to5Values.push(cycleData.y);
                }
            });
        } else if (well.raw_rfu) {
            // Try to parse raw_rfu data
            try {
                let rfuValues = typeof well.raw_rfu === 'string' ? JSON.parse(well.raw_rfu) : well.raw_rfu;
                if (Array.isArray(rfuValues)) {
                    // Take first 5 values
                    const earlyCycles = rfuValues.slice(0, 5);
                    earlyCycles.forEach(value => {
                        if (typeof value === 'number' && value > 0) {
                            cycles1to5Values.push(value);
                        }
                    });
                }
            } catch (e) {
                console.warn('🔍 LOG-THRESHOLD-FALLBACK - Error parsing raw_rfu for well:', well.well_id);
            }
        }
    });
    
    if (cycles1to5Values.length === 0) {
        console.warn(`🔍 LOG-THRESHOLD-FALLBACK - No early cycle data found for channel: ${channel}`);
        return 10; // Return minimal fallback
    }
    
    // Calculate standard deviation of cycles 1-5
    const mean = cycles1to5Values.reduce((sum, val) => sum + val, 0) / cycles1to5Values.length;
    const variance = cycles1to5Values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / cycles1to5Values.length;
    const stdDev = Math.sqrt(variance);
    
    // Simple threshold calculation: mean + 10 * std dev (similar to baseline + 10*std approach)
    const threshold = mean + (10 * stdDev);
    
    console.log(`🔍 LOG-THRESHOLD-FALLBACK - Channel ${channel}: mean=${mean.toFixed(2)}, stdDev=${stdDev.toFixed(2)}, threshold=${threshold.toFixed(2)}`);
    
    return Math.max(threshold, 10); // Ensure minimum threshold of 10
}

function calculateLinearThreshold(channelWells, channel) {
    console.log(`🔍 LINEAR-THRESHOLD - Calculating linear threshold for ${channelWells.length} wells in channel: ${channel}`);
    
    // Use NTC/NEG/CONTROL wells if available, otherwise use all wells
    let controlWells = channelWells.filter(well =>
        well.sample_name && (
            well.sample_name.toLowerCase().includes('ntc') ||
            well.sample_name.toLowerCase().includes('neg') ||
            well.sample_name.toLowerCase().includes('control') ||
            /\b(ctrl|positive|h[0-9]|m[0-9]|l[0-9])\b/i.test(well.sample_name)
        )
    );

    if (controlWells.length === 0) {
        console.warn(`⚠️ No NTC/NEG/CONTROL wells found for channel ${channel}. Using ALL wells as controls for threshold calculation.`);
        controlWells = channelWells;
    }

    console.log(`🔍 LINEAR-THRESHOLD - Using ${controlWells.length} control wells for channel: ${channel}`);
    
    // Calculate inflection point thresholds: RFU = L/2 + B
    const inflectionThresholds = [];
    
    controlWells.forEach(well => {
        if (well.amplitude && well.baseline && 
            typeof well.amplitude === 'number' && typeof well.baseline === 'number') {
            
            // Inflection point: L/2 + B
            const inflectionPoint = (well.amplitude / 2) + well.baseline;
            inflectionThresholds.push(inflectionPoint);
            
            console.log(`🔍 LINEAR-THRESHOLD - Well: ${well.well_id}, L: ${well.amplitude.toFixed(2)}, B: ${well.baseline.toFixed(2)}, Inflection: ${inflectionPoint.toFixed(2)}`);
        }
    });
    
    if (inflectionThresholds.length === 0) {
        console.warn(`🔍 LINEAR-THRESHOLD - No valid sigmoid parameters found for channel: ${channel}`);
        return null; // No fallback - return null if no data
    }
    
    // Use median of inflection points for robustness
    inflectionThresholds.sort((a, b) => a - b);
    const median = inflectionThresholds.length % 2 === 0
        ? (inflectionThresholds[inflectionThresholds.length / 2 - 1] + inflectionThresholds[inflectionThresholds.length / 2]) / 2
        : inflectionThresholds[Math.floor(inflectionThresholds.length / 2)];
    
    console.log(`🔍 LINEAR-THRESHOLD - Channel: ${channel}, Inflection points: [${inflectionThresholds.map(t => t.toFixed(2)).join(', ')}], Median: ${median.toFixed(2)}`);
    
    return median; // Return exact calculated value, no minimum
}

// --- Threshold Storage Functions ---
function setChannelThreshold(channel, scale, value) {
    // Use the new stable threshold system
    if (!window.stableChannelThresholds) {
        window.stableChannelThresholds = {};
    }
    if (!window.stableChannelThresholds[channel]) {
        window.stableChannelThresholds[channel] = {};
    }
    window.stableChannelThresholds[channel][scale] = value;
    
    // Also update the legacy system for compatibility
    if (!channelThresholds[channel]) channelThresholds[channel] = {};
    channelThresholds[channel][scale] = value;
    
    // Persist both systems in sessionStorage
    safeSetItem(sessionStorage, 'stableChannelThresholds', JSON.stringify(window.stableChannelThresholds));
    safeSetItem(sessionStorage, 'channelThresholds', JSON.stringify(channelThresholds));
}
function getChannelThreshold(channel, scale) {
      if (channelThresholds[channel] && channelThresholds[channel][scale] != null) {
        return channelThresholds[channel][scale];
    }
    // If not set, calculate and store
    const base = calculateChannelThreshold(channel, scale);
    setChannelThreshold(channel, scale, base);
    return base;
}
function loadChannelThresholds() {
     const stored = sessionStorage.getItem('channelThresholds');
    if (stored) {
        channelThresholds = JSON.parse(stored);
    }
}

// --- Chart Annotation Functions ---
function updateAllChannelThresholds() {
     console.log('🔍 THRESHOLD - Updating all channel thresholds');
    
    // Extra strict guard: do not proceed if any part of the chart config is missing
    if (!window.amplificationChart ||
        typeof window.amplificationChart !== 'object' ||
        !window.amplificationChart.options ||
        typeof window.amplificationChart.options !== 'object' ||
        !window.amplificationChart.options.plugins ||
        typeof window.amplificationChart.options.plugins !== 'object' ||
        !window.amplificationChart.options.plugins.annotation ||
        typeof window.amplificationChart.options.plugins.annotation !== 'object' ||
        !window.amplificationChart.options.plugins.annotation.annotations ||
        typeof window.amplificationChart.options.plugins.annotation.annotations !== 'object') {
        console.warn('🔍 THRESHOLD - Chart or annotation plugin not ready, skipping threshold update');
        return;
    }
    
    // Also guard: do not proceed if no valid analysis results
    if (!window.currentAnalysisResults ||
        !window.currentAnalysisResults.individual_results ||
        typeof window.currentAnalysisResults.individual_results !== 'object' ||
        Object.keys(window.currentAnalysisResults.individual_results).length === 0) {
        console.warn('🔍 THRESHOLD - No valid analysis results found for this channel. Please check your input files.');
        return;
    }
    
    // Get current chart annotations
    const annotations = window.amplificationChart.options.plugins.annotation.annotations;
    
    // Update threshold lines for all visible channels - IMPROVED DETECTION
    const visibleChannels = new Set();
    
    // Method 1: Get channels from chart datasets (for currently displayed data)
    if (window.amplificationChart.data && window.amplificationChart.data.datasets) {
        window.amplificationChart.data.datasets.forEach(dataset => {
            // Extract channel from dataset label
            const match = dataset.label?.match(/\(([^)]+)\)/);
            if (match && match[1] !== 'Unknown') {
                visibleChannels.add(match[1]);
                console.log(`🔍 THRESHOLD - Found channel from dataset: ${match[1]}`);
            }
        });
    }
    
    // Method 2: Get channels from analysis results (for multichannel data)
    if (window.currentAnalysisResults?.individual_results) {
        Object.values(window.currentAnalysisResults.individual_results).forEach(well => {
            if (well.fluorophore && well.fluorophore !== 'Unknown') {
                visibleChannels.add(well.fluorophore);
            }
        });
    }
    
    // Method 3: Get channels from stored channel thresholds
    if (window.stableChannelThresholds) {
        Object.keys(window.stableChannelThresholds).forEach(channel => {
            visibleChannels.add(channel);
        });
    }
    
    // Method 4: If viewing "all curves", ensure all known fluorophores are included
    const currentChannel = window.currentFluorophore;
    if (currentChannel === 'all' || !currentChannel) {
        const knownChannels = ['Cy5', 'FAM', 'HEX', 'Texas Red'];
        knownChannels.forEach(channel => {
            // Only add if we have threshold data for this channel
            if (window.stableChannelThresholds && window.stableChannelThresholds[channel]) {
                visibleChannels.add(channel);
            }
        });
    }
    
    console.log(`🔍 THRESHOLD - Detected ${visibleChannels.size} channels: [${Array.from(visibleChannels).join(', ')}]`);
    
    // Clear old threshold annotations
    Object.keys(annotations).forEach(key => {
        if (key.startsWith('threshold_')) {
            delete annotations[key];
        }
    });
    
    // Add new threshold annotations for visible channels
    const currentScale = window.currentScaleMode || 'linear';
    Array.from(visibleChannels).forEach(channel => {
        const threshold = getCurrentChannelThreshold(channel, currentScale);
        if (threshold !== null && threshold !== undefined && !isNaN(threshold)) {
            const annotationKey = `threshold_${channel}`;
            annotations[annotationKey] = {
                type: 'line',
                yMin: threshold,
                yMax: threshold,
                borderColor: getChannelColor(channel),
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                    display: true,
                    content: `${channel}: ${threshold.toFixed(2)}`,
                    position: 'start',
                    backgroundColor: 'rgba(255,255,255,0.8)',
                    color: getChannelColor(channel),
                    font: { size: 10, weight: 'bold' }
                },
                draggable: true,
dragAxis: 'y',
enter: function(ctx) {
    ctx.chart.canvas.style.cursor = 'ns-resize';
},
leave: function(ctx) {
    ctx.chart.canvas.style.cursor = '';
},
onDragEnd: function(e) {
    // e: { chart, annotation, event }
    const newY = e?.annotation?.yMin;
    if (typeof newY === 'number' && !isNaN(newY)) {
        setChannelThreshold(channel, currentScale, newY);
        // Optionally update UI input if present
        const thresholdInput = document.getElementById('thresholdInput');
        if (thresholdInput && (currentFluorophore === channel || currentFluorophore === 'all')) {
            thresholdInput.value = newY.toFixed(2);
        }
        // Persist and update chart
        window.updateAllChannelThresholds();
        console.log(`🔍 DRAG-END - Threshold for ${channel} (${currentScale}) set to ${newY}`);
    } else {
        console.warn('🔍 DRAG-END - Invalid newY value:', newY);
    }
}
            };
            console.log(`🔍 THRESHOLD - Added threshold for ${channel}: ${threshold.toFixed(2)}`);
        } else {
            console.warn(`🔍 THRESHOLD - Invalid threshold for ${channel}: ${threshold}`);
        }
    });
    
    // Update chart
    window.amplificationChart.update('none');
    
    console.log(`🔍 THRESHOLD - Updated thresholds for channels: ${Array.from(visibleChannels).join(', ')}`);
}
function updateSingleChannelThreshold(fluorophore) {
   console.log(`🔍 THRESHOLD - Updating threshold for single channel: ${fluorophore}`);
    
    if (!window.amplificationChart) {
        console.warn('🔍 THRESHOLD - No chart available');
        return;
    }
    
    // Ensure chart has annotation plugin
    if (!window.amplificationChart.options.plugins) {
        window.amplificationChart.options.plugins = {};
    }
    if (!window.amplificationChart.options.plugins.annotation) {
        window.amplificationChart.options.plugins.annotation = { annotations: {} };
    }
    
    // Get current chart annotations
    const annotations = window.amplificationChart.options.plugins.annotation.annotations;
    
    // Clear old threshold annotations for this channel
    Object.keys(annotations).forEach(key => {
        if (key.startsWith(`threshold_${fluorophore}`)) {
            delete annotations[key];
        }
    });
    
    // Add new threshold annotation for this specific channel
    const currentScale = window.currentScaleMode || 'linear';
    const threshold = getCurrentChannelThreshold(fluorophore, currentScale);
    
    if (threshold !== null && threshold !== undefined && !isNaN(threshold)) {
        const annotationKey = `threshold_${fluorophore}`;
        annotations[annotationKey] = {
            type: 'line',
            yMin: threshold,
            yMax: threshold,
            borderColor: getChannelColor(fluorophore),
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
                display: true,
                content: `${fluorophore}: ${threshold.toFixed(2)}`,
                position: 'start',
                backgroundColor: 'rgba(255,255,255,0.8)',
                color: getChannelColor(fluorophore),
                font: { size: 10, weight: 'bold' }
            },
draggable: true,
dragAxis: 'y',
enter: function(ctx) {
    ctx.chart.canvas.style.cursor = 'ns-resize';
},
leave: function(ctx) {
    ctx.chart.canvas.style.cursor = '';
},
        onDragEnd: function(e) {
            const newY = e?.annotation?.yMin;
            if (typeof newY === 'number' && !isNaN(newY)) {
                setChannelThreshold(fluorophore, window.currentScaleMode || 'linear', newY);
                const thresholdInput = document.getElementById('thresholdInput');
                if (thresholdInput && (window.currentFluorophore === fluorophore || window.currentFluorophore === 'all')) {
                    thresholdInput.value = newY.toFixed(2);
                }
                updateSingleChannelThreshold(fluorophore);
                console.log(`🔍 DRAG-END - Threshold for ${fluorophore} (${window.currentScaleMode || 'linear'}) set to ${newY}`);
            } else {
                console.warn('🔍 DRAG-END - Invalid newY value:', newY);
            }
        }
    };
    console.log(`🔍 THRESHOLD - Added threshold for ${fluorophore}: ${threshold.toFixed(2)}`);
} else {
    console.warn(`🔍 THRESHOLD - Invalid threshold for ${fluorophore}: ${threshold}`);
}
    
    // Update chart
    window.amplificationChart.update('none');
    
    console.log(`🔍 THRESHOLD - Updated threshold for channel: ${fluorophore}`);
}

/**
 * Calculate stable threshold for a specific channel and scale using threshold strategies
 */
function calculateStableChannelThreshold(channel, scale) {
    console.log(`🔍 THRESHOLD - Calculating ${scale} threshold for channel: ${channel}`);
    
    // Get the current threshold strategy
    const strategy = getSelectedThresholdStrategy() || 'default';
    console.log(`🔍 THRESHOLD - Using strategy: ${strategy} for ${channel} on ${scale} scale`);
    
    // Calculate baseline statistics from control wells
    let baseline = 0, baseline_std = 1;
    let allRfus = [];
    
    if (window.channelControlWells && window.channelControlWells[channel]) {
        const controls = window.channelControlWells[channel];
        if (controls && controls.NTC && controls.NTC.length > 0) {
            controls.NTC.forEach(well => {
                let rfu = well.raw_rfu;
                if (typeof rfu === 'string') try { rfu = JSON.parse(rfu); } catch(e){}
                if (Array.isArray(rfu)) allRfus.push(...rfu.slice(0,5));
            });
        }
    }
    
    if (allRfus.length > 0) {
        baseline = allRfus.reduce((a,b)=>a+b,0)/allRfus.length;
        const mean = baseline;
        const variance = allRfus.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allRfus.length;
        baseline_std = Math.sqrt(variance);
    }
    
    // Get pathogen information for fixed strategies
    let pathogen = null;
    if (strategy === 'log_fixed' || strategy === 'linear_fixed') {
        // Try to get pathogen from current analysis results
        if (window.currentAnalysisResults) {
            const resultsToCheck = window.currentAnalysisResults.individual_results || window.currentAnalysisResults;
            const wellKeys = Object.keys(resultsToCheck);
            for (const wellKey of wellKeys) {
                const well = resultsToCheck[wellKey];
                if (well && well.fluorophore === channel && well.test_code) {
                    pathogen = well.test_code;
                    break;
                }
            }
        }
        // Default pathogen for fixed strategies if none found
        if (!pathogen) {
            pathogen = 'BVPanelPCR1';
        }
        console.log(`🔍 THRESHOLD-FIXED - Using pathogen: ${pathogen} for ${strategy} strategy`);
    }
    
    // Get L and B parameters for log strategies that need them
    let L = 0, B = baseline;
    if (strategy === 'default' || strategy.includes('exponential')) {
        // Calculate amplitude (L) and baseline (B) from wells
        if (window.currentAnalysisResults) {
            const resultsToCheck = window.currentAnalysisResults.individual_results || window.currentAnalysisResults;
            const channelWells = Object.values(resultsToCheck).filter(well => well.fluorophore === channel);
            
            if (channelWells.length > 0) {
                // Calculate average amplitude and baseline
                const amplitudes = channelWells.filter(w => w.amplitude && w.amplitude > 0).map(w => w.amplitude);
                const baselines = channelWells.filter(w => w.baseline !== undefined).map(w => w.baseline);
                
                if (amplitudes.length > 0) {
                    L = amplitudes.reduce((a,b) => a+b, 0) / amplitudes.length;
                }
                if (baselines.length > 0) {
                    B = baselines.reduce((a,b) => a+b, 0) / baselines.length;
                }
                
                console.log(`🔍 THRESHOLD-PARAMS - Channel ${channel}: L=${L.toFixed(2)}, B=${B.toFixed(2)}`);
            }
        }
    }
    
    // Use calculateThreshold from threshold_strategies.js
    if (typeof window.calculateThreshold === 'function') {
        const params = {
            baseline,
            baseline_std,
            N: 10,
            pathogen,
            fluorophore: channel,
            channel: channel,
            L: L,
            B: B,
            fixed_value: null  // Will be set by calculateThreshold if needed
        };
        
        try {
            const threshold = window.calculateThreshold(strategy, params, scale);
            if (threshold !== null && !isNaN(threshold) && threshold > 0) {
                console.log(`✅ THRESHOLD-CALC - ${channel}[${scale}]: ${threshold.toFixed(2)} (strategy: ${strategy})`);
                return threshold;
            } else {
                console.warn(`⚠️ THRESHOLD-CALC - calculateThreshold returned invalid value: ${threshold} for ${strategy}`);
            }
        } catch (error) {
            console.error(`❌ THRESHOLD-ERROR - Failed to calculate ${strategy} for ${channel}[${scale}]:`, error);
        }
    } else {
        console.error(`❌ THRESHOLD-ERROR - window.calculateThreshold function not available`);
    }
    
    // Only strategy-based calculations - no fallbacks
    console.warn(`❌ THRESHOLD-FAIL - No valid threshold calculated for ${channel}[${scale}] with strategy ${strategy}`);
    return null;
}

// Expose globally
// Expose per-channel and per-well threshold calculation functions globally
window.calculateChannelThresholdPerChannel = calculateChannelThreshold; // (channel, scale)
window.calculateChannelThresholdPerWell = function(cycles, rfu) {
    if (!cycles || !rfu || cycles.length !== rfu.length || cycles.length < 5) {
        console.warn('Insufficient data for threshold calculation');
        return null;
    }
    // Extract RFU values for cycles 1-5
    const earlyRfuValues = [];
    for (let i = 0; i < Math.min(5, cycles.length); i++) {
        if (cycles[i] <= 5 && rfu[i] !== null && rfu[i] !== undefined && rfu[i] > 0) {
            earlyRfuValues.push(rfu[i]);
        }
    }
    if (earlyRfuValues.length < 3) {
        console.warn('Insufficient early cycle data for threshold calculation');
        return null;
    }
    // Calculate mean and standard deviation
    const mean = earlyRfuValues.reduce((sum, val) => sum + val, 0) / earlyRfuValues.length;
    const variance = earlyRfuValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / earlyRfuValues.length;
    const stdDev = Math.sqrt(variance);
    // Threshold = baseline + 10 * standard deviation
    let threshold = mean + (10 * stdDev);
    // Ensure threshold is meaningful for qPCR data
    const minThreshold = Math.max(mean * 1.5, 1.0); // At least 50% above baseline or 1.0 RFU
    threshold = Math.max(threshold, minThreshold);
    // For log scale compatibility, ensure threshold is well above noise floor
    if (window.currentScaleMode === 'log') {
        threshold = Math.max(threshold, mean * 2); // At least 2x baseline for log visibility
    }
    console.log(`Threshold calculation - Mean: ${mean.toFixed(3)}, StdDev: ${stdDev.toFixed(3)}, Threshold: ${threshold.toFixed(3)}`);
    return {
        threshold: threshold,
        baseline: mean,
        stdDev: stdDev,
        earlyRfuValues: earlyRfuValues,
        minThreshold: minThreshold
    };
};

// --- Additional Threshold Functions moved from script.js ---

function updateThresholdInputForCurrentScale() {
    const thresholdInput = document.getElementById('thresholdInput');
    let channel = window.currentFluorophore;
    
    // Get the first available channel if 'all' is selected
    if (!channel || channel === 'all') {
        if (window.currentAnalysisResults && window.currentAnalysisResults.individual_results) {
            const results = window.currentAnalysisResults.individual_results;
            for (const wellKey in results) {
                if (results[wellKey].fluorophore) {
                    channel = results[wellKey].fluorophore;
                    break;
                }
            }
        }
    }
    
    if (thresholdInput && channel && window.stableChannelThresholds && window.stableChannelThresholds[channel]) {
        const threshold = window.stableChannelThresholds[channel][window.currentScaleMode || 'linear'];
        if (threshold !== null && threshold !== undefined) {
            thresholdInput.value = threshold.toFixed(2);
            console.log(`🔍 THRESHOLD-INPUT-UPDATE - Set input to ${threshold.toFixed(2)} for ${channel} ${window.currentScaleMode || 'linear'}`);
        }
    }
}

function updateChartThresholds() {
    console.log('🔍 CHART-THRESHOLD - Updating chart thresholds');
    
    if (!window.amplificationChart) {
        console.warn('🔍 CHART-THRESHOLD - No chart available');
        return;
    }
    
    // Ensure we have analysis results and channel thresholds are initialized
    if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
        console.warn('🔍 CHART-THRESHOLD - No analysis results available, trying to initialize thresholds');
        // Try to initialize thresholds if we have analysis data
        if (window.currentAnalysisResults) {
            if (typeof initializeChannelThresholds === 'function') {
                initializeChannelThresholds();
            }
        }
        return;
    }
    
    // Check if this is a single-well chart or multi-well chart
    const datasets = window.amplificationChart.data?.datasets || [];
    if (datasets.length === 0) {
        console.warn('🔍 CHART-THRESHOLD - No datasets found in chart');
        return;
    }
    
    // Extract fluorophore from first dataset label
    const firstDataset = datasets[0];
    const match = firstDataset.label?.match(/\(([^)]+)\)/);
    
    if (match && match[1] !== 'Unknown') {
        // Single-channel chart - apply threshold for specific fluorophore
        const fluorophore = match[1];
        console.log(`🔍 CHART-THRESHOLD - Detected single-channel chart for ${fluorophore}`);
        if (window.updateSingleChannelThreshold) window.updateSingleChannelThreshold(fluorophore);
    } else {
        // Multi-channel chart - apply thresholds for all channels
        console.log('🔍 CHART-THRESHOLD - Detected multi-channel chart');
        if (window.updateAllChannelThresholds) window.updateAllChannelThresholds();
    }
}

function setThresholdControls(value, updateChart = true) {
    const numValue = Number(value);
    const thresholdInput = document.getElementById('thresholdInput');
    const thresholdSlider = document.getElementById('thresholdSlider');
    
    if (thresholdInput && thresholdInput.value != numValue) thresholdInput.value = numValue;
    if (thresholdSlider && Number(thresholdSlider.value) !== numValue) thresholdSlider.value = numValue;

    // Use the currently selected channel, never default to HEX
    let channel = window.currentFluorophore;
    if (!channel || channel === 'all') {
        // Try to extract from chart datasets
        const datasets = window.amplificationChart?.data?.datasets;
        if (datasets && datasets.length > 0) {
            const match = datasets[0].label?.match(/\(([^)]+)\)/);
            if (match && match[1] !== 'Unknown') channel = match[1];
        }
    }
    if (!channel) {
        console.warn('No channel selected or detected!');
        return;
    }
    const scale = window.currentScaleMode || 'linear';
    if (!window.userSetThresholds) window.userSetThresholds = {};
    if (!window.userSetThresholds[channel]) window.userSetThresholds[channel] = {};
    window.userSetThresholds[channel][scale] = numValue;
    if (updateChart && typeof window.updateChartThreshold === 'function') window.updateChartThreshold(numValue);
}

function restoreAutoThreshold(channel) {
    if (!channel) {
        console.warn('🔍 AUTO-THRESHOLD - No channel specified');
        return;
    }
    
    const scale = window.currentScaleMode || 'linear';
    const autoValue = window.calculateStableChannelThreshold ? window.calculateStableChannelThreshold(channel, scale) : null;
    
    if (autoValue !== null && autoValue !== undefined) {
        // Clear manual threshold marker for this channel/scale
        if (window.manualThresholds && window.manualThresholds[channel]) {
            delete window.manualThresholds[channel][scale];
            if (Object.keys(window.manualThresholds[channel]).length === 0) {
                delete window.manualThresholds[channel];
            }
        }
        
        if (window.setChannelThreshold) window.setChannelThreshold(channel, scale, autoValue);
        if (window.updateAllChannelThresholds) window.updateAllChannelThresholds();
        
        // Update threshold input/slider if present
        const thresholdInput = document.getElementById('thresholdInput');
        if (thresholdInput) {
            thresholdInput.value = autoValue.toFixed(2);
        }
        
        console.log(`🔍 AUTO-THRESHOLD - Set ${channel} ${scale} to auto value: ${autoValue.toFixed(2)}`);
    } else {
        console.warn(`🔍 AUTO-THRESHOLD - Could not calculate auto threshold for ${channel} ${scale}`);
    }
}

function enableDraggableThresholds() {
    // DISABLED: Draggable threshold functionality commented out
    // Will be replaced with test.html implementation later
    console.log('🔍 THRESHOLD - Draggable thresholds disabled (will use test.html implementation)');
    return;
}

function ensureThresholdFeaturesActive() {
    if (window.updateAllChannelThresholds) window.updateAllChannelThresholds();
    // enableDraggableThresholds(); // DISABLED - Will use test.html implementation
    if (typeof attachAutoButtonHandler === 'function') attachAutoButtonHandler();
}

function initializeChannelThresholds() {
    console.log('🔍 THRESHOLD-INIT - Initializing channel thresholds');
    
    // Multiple null checks for robustness
    if (!window.currentAnalysisResults) {
        console.warn('🔍 THRESHOLD-INIT - No currentAnalysisResults available');
        return;
    }
    
    if (!window.currentAnalysisResults.individual_results) {
        console.warn('🔍 THRESHOLD-INIT - No individual_results in currentAnalysisResults');
        return;
    }
    
    if (typeof window.currentAnalysisResults.individual_results !== 'object') {
        console.warn('🔍 THRESHOLD-INIT - individual_results is not an object');
        return;
    }
    
    // Extract all unique channels from fluorophore properties in wells
    const channels = new Set();
    try {
        Object.values(window.currentAnalysisResults.individual_results).forEach(well => {
            if (well && well.fluorophore && well.fluorophore !== 'Unknown') {
                channels.add(well.fluorophore);
            }
        });
    } catch (e) {
        console.error('🔍 THRESHOLD-INIT - Error extracting channels:', e);
        return;
    }
    
    if (channels.size === 0) {
        console.warn('🔍 THRESHOLD-INIT - No valid channels found in analysis results');
        return;
    }
    
    console.log(`🔍 THRESHOLD-INIT - Found channels: [${Array.from(channels).join(', ')}]`);
    
    // Extract control wells for each channel before calculating thresholds
    if (typeof window.extractChannelControlWells === 'function') {
        window.extractChannelControlWells();
    }
    
    // Calculate and store thresholds for each channel and scale using threshold strategies
    channels.forEach(channel => {
        ['linear', 'log'].forEach(scale => {
            const threshold = calculateStableChannelThreshold(channel, scale);
            if (threshold !== null && threshold !== undefined) {
                if (!window.stableChannelThresholds[channel]) {
                    window.stableChannelThresholds[channel] = {};
                }
                window.stableChannelThresholds[channel][scale] = threshold;
                console.log(`🔍 THRESHOLD-INIT - ${channel} ${scale}: ${threshold.toFixed(2)}`);
            }
        });
    });
    
    // Update UI to reflect initialized thresholds
    if (typeof window.updateSliderUI === 'function') {
        window.updateSliderUI();
    }
    
    // Update chart annotations with new thresholds
    setTimeout(() => {
        if (window.updateAllChannelThresholds) window.updateAllChannelThresholds();
    }, 200);
}

function getCurrentChannelThreshold(channel, scale = null) {
    // Ensure global threshold object is always initialized
    if (!window.stableChannelThresholds) window.stableChannelThresholds = {};
    if (!scale) scale = window.currentScaleMode || 'linear';
    
    // Load from storage if not in memory
    if (!window.stableChannelThresholds[channel] && sessionStorage.getItem('stableChannelThresholds')) {
        try {
            window.stableChannelThresholds = JSON.parse(sessionStorage.getItem('stableChannelThresholds'));
        } catch (e) {
            console.warn('🔍 THRESHOLD - Error loading thresholds from storage:', e);
        }
    }
    
    if (!window.stableChannelThresholds[channel] || !window.stableChannelThresholds[channel][scale]) {
        const baseThreshold = window.calculateStableChannelThreshold ? window.calculateStableChannelThreshold(channel, scale) : null;
        if (!window.stableChannelThresholds[channel]) window.stableChannelThresholds[channel] = {};
        window.stableChannelThresholds[channel][scale] = baseThreshold;
    }
    
    const baseThreshold = window.stableChannelThresholds[channel][scale];
    
    // Return the base threshold WITHOUT any multiplier
    // The scale multiplier only affects chart view, not threshold values
    return baseThreshold;
}

/**
 * Update threshold input box for current scale and channel
 */
function updateThresholdInputForCurrentScale() {
    const thresholdInput = document.getElementById('thresholdInput');
    if (!thresholdInput) return;
    
    const channel = window.currentFluorophore;
    const scale = window.currentScaleMode || 'linear';
    
    console.log(`🔍 UPDATE-INPUT - Channel: ${channel}, Scale: ${scale}`);
    
    if (!channel || channel === 'all') {
        // If no specific channel, try to find first available threshold
        if (window.stableChannelThresholds) {
            const availableChannels = Object.keys(window.stableChannelThresholds);
            if (availableChannels.length > 0) {
                const firstChannel = availableChannels[0];
                const threshold = window.stableChannelThresholds[firstChannel][scale];
                if (threshold !== null && threshold !== undefined) {
                    thresholdInput.value = threshold.toFixed(2);
                    console.log(`🔍 UPDATE-INPUT - Set to ${firstChannel} threshold: ${threshold.toFixed(2)}`);
                    return;
                }
            }
        }
        console.log(`🔍 UPDATE-INPUT - No channel selected, keeping current input value`);
        return;
    }
    
    // Get current threshold for the channel
    const currentThreshold = getCurrentChannelThreshold(channel, scale);
    if (currentThreshold !== null && currentThreshold !== undefined && !isNaN(currentThreshold)) {
        thresholdInput.value = currentThreshold.toFixed(2);
        console.log(`🔍 UPDATE-INPUT - Updated to ${channel} ${scale} threshold: ${currentThreshold.toFixed(2)}`);
    } else {
        console.warn(`🔍 UPDATE-INPUT - No valid threshold found for ${channel} ${scale}`);
    }
}

function createThresholdAnnotation(threshold, fluorophore, color = 'red', index = 0) {
    const currentScaleMode = window.currentScaleMode || 'linear';
    const currentLogMin = window.currentLogMin || 0.1;
    
    const adjustedThreshold = currentScaleMode === 'log' ? 
        Math.max(threshold, currentLogMin) : threshold;
    
    return {
        type: 'line',
        yMin: adjustedThreshold,
        yMax: adjustedThreshold,
        borderColor: color || getFluorophoreColor(fluorophore),
        borderWidth: 2,
        borderDash: [5, 5],
        label: {
            content: `${fluorophore}: ${adjustedThreshold.toFixed(2)}`,
            enabled: true,
            position: index % 2 === 0 ? 'start' : 'end',
            backgroundColor: color || getFluorophoreColor(fluorophore),
            color: 'white',
            font: { weight: 'bold', size: 10 },
            padding: 4
        }
    };
}

function getFluorophoreColor(fluorophore) {
    const colors = {
        'Cy5': '#ff6b6b',
        'FAM': '#4ecdc4', 
        'HEX': '#45b7d1',
        'Texas Red': '#f9ca24'
    };
    return colors[fluorophore] || '#333333';
}

// Attach Auto button event
function attachAutoButtonHandler() {
    const autoBtn = document.getElementById('autoThresholdBtn');
    if (autoBtn) {
        autoBtn.onclick = function() {
            // Get current channel from global variable or analysis results
            let channel = window.currentFluorophore;
            
            // If 'all' is selected or no channel, find the first available channel
            if (!channel || channel === 'all') {
                if (window.currentAnalysisResults && window.currentAnalysisResults.individual_results) {
                    const results = window.currentAnalysisResults.individual_results;
                    for (const wellKey in results) {
                        if (results[wellKey].fluorophore) {
                            channel = results[wellKey].fluorophore;
                            break;
                        }
                    }
                }
            }
            
            // Fallback: try to extract from chart datasets
            if (!channel) {
                const datasets = window.amplificationChart?.data?.datasets;
                if (datasets && datasets.length > 0) {
                    const match = datasets[0].label?.match(/\(([^)]+)\)/);
                    if (match && match[1] !== 'Unknown') channel = match[1];
                }
            }
            
            if (channel) {
                window.restoreAutoThreshold(channel);
            } else {
                console.warn('🔍 AUTO-THRESHOLD - Could not determine current channel');
            }
        };
    }
}

// --- Manual Threshold Control Functions ---

/**
 * Initialize manual threshold controls with event handlers
 */
function initializeManualThresholdControls() {
    // Enhanced manual threshold input with multiple event types for better responsiveness
    const thresholdInput = document.getElementById('thresholdInput');
    const thresholdSlider = document.getElementById('thresholdSlider');
    
    if (thresholdInput) {
        // Function to handle manual threshold changes
        function handleManualThresholdChange() {
            const channel = window.currentFluorophore;
            // FIXED: Get current scale properly from both sources
            const scale = window.currentScaleMode || (typeof currentScaleMode !== 'undefined' ? currentScaleMode : 'linear');
            const value = parseFloat(thresholdInput.value);
            
            console.log(`🔍 MANUAL-THRESHOLD-DEBUG - Channel: ${channel}, Scale: ${scale}, Value: ${value}`);
            
            if (channel && !isNaN(value) && value > 0) {
                console.log(`🔍 MANUAL-THRESHOLD-INPUT - Setting ${channel} ${scale} threshold to ${value}`);
                
                // Mark this threshold as manually set to prevent override
                if (!window.manualThresholds) window.manualThresholds = {};
                if (!window.manualThresholds[channel]) window.manualThresholds[channel] = {};
                window.manualThresholds[channel][scale] = true;
                
                setChannelThreshold(channel, scale, value);
                
                // Update chart threshold lines
                if (window.updateAllChannelThresholds) {
                    window.updateAllChannelThresholds();
                }
                
                // Send manual threshold to backend for proper CQJ recalculation
                sendManualThresholdToBackend(channel, scale, value);
                
                console.log(`🔍 MANUAL-THRESHOLD-SET - ${channel} ${scale} threshold set to ${value}`);
                
                // Force strategy to manual when user manually sets threshold
                const strategySelect = document.getElementById('thresholdStrategySelect');
                if (strategySelect && strategySelect.value !== 'manual') {
                    strategySelect.value = 'manual';
                    window.selectedThresholdStrategy = 'manual';
                    console.log(`🔍 MANUAL-THRESHOLD - Switched strategy to manual`);
                }
            } else {
                console.warn(`🔍 MANUAL-THRESHOLD-INVALID - Invalid input: channel=${channel}, scale=${scale}, value=${value}`);
            }
        }
        
        // Add multiple event listeners for better responsiveness
        thresholdInput.addEventListener('input', handleManualThresholdChange);
        thresholdInput.addEventListener('change', handleManualThresholdChange);
        thresholdInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleManualThresholdChange();
            }
        });
    }
    
    // Handle threshold slider controls
    if (thresholdSlider) {
        thresholdSlider.addEventListener('input', function(e) {
            setThresholdControls(e.target.value);
        });
        thresholdSlider.addEventListener('change', function(e) {
            setThresholdControls(e.target.value);
        });
    }
}

/**
 * Send manual threshold to backend for CQJ recalculation
 */
async function sendManualThresholdToBackend(channel, scale, value) {
    try {
        const payload = {
            action: 'manual_threshold',
            channel: channel,
            scale: scale,
            threshold: value,
            experiment_pattern: (typeof getCurrentFullPattern === 'function') ? getCurrentFullPattern() : null,
            session_id: window.currentSessionId || null
        };
        
        const response = await fetch('/threshold/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.updated_results) {
                // Update frontend with backend-calculated CQJ values
                Object.assign(window.currentAnalysisResults.individual_results, result.updated_results);
                if (typeof populateResultsTable === 'function') {
                    populateResultsTable(window.currentAnalysisResults.individual_results);
                }
            }
        }
    } catch (error) {
        console.warn(`🔍 MANUAL-THRESHOLD-BACKEND - Backend update failed, using frontend fallback:`, error);
        // Fallback to frontend recalculation
        if (window.currentAnalysisResults) {
            if (window.recalculateCQJValuesForManualThreshold) window.recalculateCQJValuesForManualThreshold();
        }
    }
}

/**
 * Set threshold controls for input and slider
 */
function setThresholdControls(value, updateChart = true) {
    // Always keep value as a number for consistency
    const numValue = Number(value);
    const thresholdInput = document.getElementById('thresholdInput');
    const thresholdSlider = document.getElementById('thresholdSlider');
    
    if (thresholdInput && thresholdInput.value != numValue) thresholdInput.value = numValue;
    if (thresholdSlider && Number(thresholdSlider.value) !== numValue) thresholdSlider.value = numValue;
    if (updateChart) updateChartThreshold(numValue);
}

/**
 * Update chart threshold annotation
 */
function updateChartThreshold(value) {
    const chart = window.amplificationChart;
    let channel = window.currentFluorophore;
    if (!channel || channel === 'all') {
        const datasets = chart?.data?.datasets;
        if (datasets && datasets.length > 0) {
            const match = datasets[0].label?.match(/\(([^)]+)\)/);
            if (match && match[1] !== 'Unknown') channel = match[1];
        }
    }
    if (!channel) {
        console.warn('No channel selected or detected!');
        return;
    }
    if (
        chart &&
        chart.options &&
        chart.options.plugins &&
        chart.options.plugins.annotation &&
        chart.options.plugins.annotation.annotations
    ) {
        const key = `threshold_${channel}`;
        const annotations = chart.options.plugins.annotation.annotations;
        if (annotations[key]) {
            annotations[key].yMin = Number(value);
            annotations[key].yMax = Number(value);
            if (annotations[key].label) {
                annotations[key].label.content = `${channel}: ${Number(value).toFixed(2)}`;
            }
            chart.update('none');
            console.log(`[THRESHOLD] Updated ${key} to ${value}`);
        } else {
            console.warn(`[THRESHOLD] Annotation key not found: ${key}`);
        }
    }
}

// --- Strategy Integration Functions ---

/**
 * Populate threshold strategy dropdown based on current scale mode
 */
function populateThresholdStrategyDropdown() {
    const select = document.getElementById('thresholdStrategySelect');
    if (!select) {
        console.warn('🔍 STRATEGY-DROPDOWN - thresholdStrategySelect element not found');
        return;
    }
    
    select.innerHTML = '';
    
    // FIXED: Get current scale mode properly from both sources
    const scale = window.currentScaleMode || (typeof currentScaleMode !== 'undefined' ? currentScaleMode : 'linear');
    
    console.log(`🔍 DROPDOWN-DEBUG - Scale: ${scale}, window.currentScaleMode: ${window.currentScaleMode}, currentScaleMode: ${typeof currentScaleMode !== 'undefined' ? currentScaleMode : 'undefined'}`);
    console.log(`🔍 DROPDOWN-DEBUG - window.LOG_THRESHOLD_STRATEGIES: ${typeof window.LOG_THRESHOLD_STRATEGIES}, window.LINEAR_THRESHOLD_STRATEGIES: ${typeof window.LINEAR_THRESHOLD_STRATEGIES}`);
    
    // Use the appropriate strategies from threshold_strategies.js
    const strategies = scale === 'log' ? window.LOG_THRESHOLD_STRATEGIES : window.LINEAR_THRESHOLD_STRATEGIES;
    
    if (!strategies || typeof strategies !== 'object') {
        console.error('❌ STRATEGY-DROPDOWN - Threshold strategies not available', {
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
    
    // Add manual strategy option
    const manualOption = document.createElement('option');
    manualOption.value = 'manual';
    manualOption.textContent = 'Manual (User-Defined)';
    manualOption.title = 'Use manually entered threshold value';
    select.appendChild(manualOption);
    
    // Check if manual is the current strategy
    if (window.selectedThresholdStrategy === 'manual') found = true;
    
    // Set default strategy if current selection not available
    if (!found && firstKey) {
        window.selectedThresholdStrategy = firstKey;
    }
    
    select.value = window.selectedThresholdStrategy || firstKey;
    window.selectedThresholdStrategy = select.value;
    
    console.log(`✅ STRATEGY-DROPDOWN - Populated with ${Object.keys(strategies).length} ${scale} strategies, selected: ${select.value}`);
    
    // Add event listener for strategy changes
    select.removeEventListener('change', handleThresholdStrategyChange);
    select.addEventListener('change', function(e) {
        window.selectedThresholdStrategy = e.target.value;
        console.log(`🔍 STRATEGY-CHANGE - Strategy changed to: ${e.target.value}`);
        
        // Call the strategy change handler from script.js
        if (typeof handleThresholdStrategyChange === 'function') {
            handleThresholdStrategyChange();
        } else {
            console.warn('handleThresholdStrategyChange function not available');
        }
    });
    
    // Trigger threshold recalculation ONLY if not manual strategy
    if (select.value !== 'manual') {
        // Apply strategy and update threshold input
        applyThresholdStrategy(select.value);
    } else {
        // For manual strategy, just update the input box to current threshold
        updateThresholdInputForCurrentScale();
    }
}

/**
 * Apply threshold strategy and update threshold input box
 */
function applyThresholdStrategy(strategy) {
    console.log(`🔍 APPLY-STRATEGY - Applying threshold strategy: ${strategy}`);
    
    const currentChannel = window.currentFluorophore;
    const currentScale = window.currentScaleMode || 'linear';
    
    if (!currentChannel || currentChannel === 'all') {
        console.warn('🔍 APPLY-STRATEGY - No specific channel selected, applying to all channels');
        
        // Apply to all available channels
        if (window.currentAnalysisResults && window.currentAnalysisResults.individual_results) {
            const channels = new Set();
            Object.values(window.currentAnalysisResults.individual_results).forEach(well => {
                if (well.fluorophore && well.fluorophore !== 'Unknown') {
                    channels.add(well.fluorophore);
                }
            });
            
            channels.forEach(channel => {
                const threshold = calculateStableChannelThreshold(channel, currentScale);
                if (threshold !== null) {
                    setChannelThreshold(channel, currentScale, threshold);
                    console.log(`🔍 APPLY-STRATEGY - Set ${channel} ${currentScale} threshold: ${threshold.toFixed(2)}`);
                }
            });
        }
        
        // Update threshold input to first available channel
        updateThresholdInputForCurrentScale();
        
    } else {
        // Apply to specific channel
        const threshold = calculateStableChannelThreshold(currentChannel, currentScale);
        if (threshold !== null) {
            setChannelThreshold(currentChannel, currentScale, threshold);
            console.log(`🔍 APPLY-STRATEGY - Set ${currentChannel} ${currentScale} threshold: ${threshold.toFixed(2)}`);
            
            // Update threshold input box immediately
            const thresholdInput = document.getElementById('thresholdInput');
            if (thresholdInput) {
                thresholdInput.value = threshold.toFixed(2);
                console.log(`🔍 APPLY-STRATEGY - Updated threshold input to: ${threshold.toFixed(2)}`);
            }
        } else {
            console.warn(`🔍 APPLY-STRATEGY - Failed to calculate threshold for ${currentChannel} using strategy ${strategy}`);
        }
    }
    
    // Update chart threshold lines
    if (window.updateAllChannelThresholds) {
        window.updateAllChannelThresholds();
    }
    
    // Trigger CQJ recalculation if available
    if (window.recalculateCQJValues) {
        window.recalculateCQJValues();
    }
}

/**
 * Apply threshold strategy using threshold_strategies.js with proper log scale integration
 * This function ensures threshold strategies are applied with log scale calculations
 * for consistent backend CQJ/CalcJ processing
 */
function applyThresholdStrategy(strategy, analysisResults = null) {
    console.log(`🔍 STRATEGY-INTEGRATION - Applying strategy "${strategy}" with log scale calculations`);
    
    try {
        // Use current analysis results if not provided
        const results = analysisResults || window.currentAnalysisResults?.individual_results || window.currentAnalysisResults;
        
        if (!results || Object.keys(results).length === 0) {
            console.warn(`🔍 STRATEGY-INTEGRATION - No analysis data available for strategy "${strategy}"`);
            return false;
        }
        
        // Always use log scale for threshold calculations (required for backend CQJ/CalcJ)
        const scale = 'log';
        
        // Use threshold_strategies.js integration if available
        if (typeof window.calculateThresholdForStrategy === 'function') {
            const updatedThresholds = window.calculateThresholdForStrategy(strategy, results, scale);
            
            if (updatedThresholds && Object.keys(updatedThresholds).length > 0) {
                console.log(`🔍 STRATEGY-INTEGRATION - LOG thresholds calculated:`, updatedThresholds);
                
                // Apply the calculated thresholds to global storage
                Object.keys(updatedThresholds).forEach(channel => {
                    if (updatedThresholds[channel] && updatedThresholds[channel].log) {
                        setChannelThreshold(channel, 'log', updatedThresholds[channel].log);
                        console.log(`🔍 LOG-STRATEGY-APPLIED - ${channel}: ${updatedThresholds[channel].log}`);
                    }
                });
                
                // Update chart annotations and UI
                updateAllChannelThresholds();
                updateThresholdInputForCurrentScale();
                
                return true;
            }
        }
        
        // Fallback: Apply strategy per channel manually
        return applyStrategyPerChannelFallback(strategy, results, scale);
        
    } catch (error) {
        console.error(`🔍 STRATEGY-INTEGRATION - Error applying strategy "${strategy}":`, error);
        return false;
    }
}

/**
 * Fallback strategy application per channel
 */
function applyStrategyPerChannelFallback(strategy, results, scale) {
    console.log(`🔍 STRATEGY-FALLBACK - Applying strategy "${strategy}" per channel with fallback method`);
    
    try {
        // Get unique channels from results
        const channels = new Set();
        Object.keys(results).forEach(wellKey => {
            const well = results[wellKey];
            if (well && well.fluorophore) {
                channels.add(well.fluorophore);
            }
        });
        
        if (channels.size === 0) {
            console.warn(`🔍 STRATEGY-FALLBACK - No channels found in results`);
            return false;
        }
        
        let appliedCount = 0;
        
        // Apply strategy to each channel
        channels.forEach(channel => {
            try {
                // Calculate threshold for this channel using log scale
                const threshold = calculateChannelThreshold(channel, scale);
                
                if (threshold && typeof threshold === 'number' && threshold > 0) {
                    setChannelThreshold(channel, scale, threshold);
                    console.log(`🔍 STRATEGY-FALLBACK - Applied ${strategy} to ${channel}: ${threshold}`);
                    appliedCount++;
                }
            } catch (channelError) {
                console.warn(`🔍 STRATEGY-FALLBACK - Failed to apply strategy to ${channel}:`, channelError);
            }
        });
        
        if (appliedCount > 0) {
            // Update UI after successful applications
            updateAllChannelThresholds();
            updateThresholdInputForCurrentScale();
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error(`🔍 STRATEGY-FALLBACK - Fallback strategy application failed:`, error);
        return false;
    }
}

// --- End Strategy Integration Functions ---

// --- End Additional Functions ---

window.calculateLogThresholdUsingStrategies = calculateLogThresholdUsingStrategies;
window.calculateLogThresholdFallback = calculateLogThresholdFallback;
window.calculateLinearThreshold = calculateLinearThreshold;
window.setChannelThreshold = setChannelThreshold;
window.getChannelThreshold = getChannelThreshold;
window.loadChannelThresholds = loadChannelThresholds;
window.updateAllChannelThresholds = updateAllChannelThresholds;
window.updateSingleChannelThreshold = updateSingleChannelThreshold;
window.calculateStableChannelThreshold = calculateStableChannelThreshold;
window.updateThresholdInputForCurrentScale = updateThresholdInputForCurrentScale;
window.updateChartThresholds = updateChartThresholds;
window.setThresholdControls = setThresholdControls;
window.restoreAutoThreshold = restoreAutoThreshold;
window.enableDraggableThresholds = enableDraggableThresholds;
window.ensureThresholdFeaturesActive = ensureThresholdFeaturesActive;
window.initializeChannelThresholds = initializeChannelThresholds;
window.getCurrentChannelThreshold = getCurrentChannelThreshold;
window.createThresholdAnnotation = createThresholdAnnotation;
window.getFluorophoreColor = getFluorophoreColor;
window.attachAutoButtonHandler = attachAutoButtonHandler;
window.calculateLogThresholdUsingStrategies = calculateLogThresholdUsingStrategies;
window.calculateLogThresholdFallback = calculateLogThresholdFallback;
window.initializeManualThresholdControls = initializeManualThresholdControls;
window.sendManualThresholdToBackend = sendManualThresholdToBackend;
window.updateChartThreshold = updateChartThreshold;
window.applyThresholdStrategy = applyThresholdStrategy;
window.applyStrategyPerChannelFallback = applyStrategyPerChannelFallback;
window.populateThresholdStrategyDropdown = populateThresholdStrategyDropdown;
window.updateThresholdInputForCurrentScale = updateThresholdInputForCurrentScale;

// Initialize auto button handler and manual controls when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    attachAutoButtonHandler();
    initializeManualThresholdControls();
    
    // Populate threshold strategy dropdown on page load
    setTimeout(() => {
        populateThresholdStrategyDropdown();
        console.log('🔍 THRESHOLD-INIT - Strategy dropdown populated on DOM ready');
    }, 500); // Small delay to ensure threshold_strategies.js is loaded
});

// End global exposure
