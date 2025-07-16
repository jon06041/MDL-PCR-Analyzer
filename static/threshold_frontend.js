// threshold_frontend.js
// All frontend threshold calculation, storage, and chart annotation logic


// Add this combined initialization function

/**
 * Initialize threshold system after new analysis results are loaded
 * Call this ONCE after displayAnalysisResults or displayMultiFluorophoreResults
 */
window.initializeThresholdSystem = function() {
    console.log('🔍 THRESHOLD-INIT - Initializing complete threshold system');
    
    // 1. Extract control wells
    if (window.extractChannelControlWells) {
        window.extractChannelControlWells();
    }
    
    // 2. Initialize channel thresholds
    if (window.initializeChannelThresholds) {
        window.initializeChannelThresholds();
    }
    
    // 3. Update UI elements
    if (window.updateThresholdInputForCurrentScale) {
        window.updateThresholdInputForCurrentScale();
    }
    
    // 4. Update chart thresholds if chart exists
    if (window.amplificationChart && window.updateChartThresholds) {
        window.updateChartThresholds();
    }
    
    console.log('✅ THRESHOLD-INIT - Threshold system initialization complete');
};


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
    
    // Use ONLY threshold_strategies.js - no fallbacks
    if (typeof window.calculateThreshold === 'function') {
        const strategy = getSelectedThresholdStrategy() || 'default';
        
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
            if (!pathogen) pathogen = 'BVPanelPCR1';
        }
        
        // Get L and B parameters for strategies that need them
        let L = 0, B = baseline;
        if (strategy === 'default' || strategy.includes('exponential')) {
            if (channelWells.length > 0) {
                const amplitudes = channelWells.filter(w => w.amplitude && w.amplitude > 0).map(w => w.amplitude);
                const baselines = channelWells.filter(w => w.baseline !== undefined).map(w => w.baseline);
                
                if (amplitudes.length > 0) L = amplitudes.reduce((a,b) => a+b, 0) / amplitudes.length;
                if (baselines.length > 0) B = baselines.reduce((a,b) => a+b, 0) / baselines.length;
            }
        }
        
        const params = {
            baseline,
            baseline_std,
            N: 10,
            pathogen,
            fluorophore: channel,
            channel: channel,
            L: L,
            B: B,
            fixed_value: null
        };
        
        try {
            const threshold = window.calculateThreshold(strategy, params, scale);
            if (threshold !== null && !isNaN(threshold) && threshold > 0) {
                console.log(`✅ THRESHOLD-CALC - ${channel}[${scale}]: ${threshold.toFixed(2)} (strategy: ${strategy})`);
                return threshold;
            }
        } catch (error) {
            console.error(`❌ THRESHOLD-ERROR - Strategy calculation failed:`, error);
        }
    }
    
    console.error(`❌ THRESHOLD-FAIL - No valid threshold calculated for ${channel}[${scale}]`);
    return null;
}







// --- Utility Functions ---
function safeSetItem(storage, key, value) {
    try {
        storage.setItem(key, value);
    } catch (e) {
        console.warn(`🔍 STORAGE - Failed to save ${key}:`, e);
    }
}

function getSelectedThresholdStrategy() {
    return window.selectedThresholdStrategy || 'default';
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
    const currentScale = window.currentScaleMode;
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
        if (thresholdInput && (window.currentFluorophore === channel || window.currentFluorophore === 'all')) {
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
   

// Custom dragging handler for threshold annotations (since plugin dragging is broken)
function addThresholdDragging() {
    if (!window.amplificationChart) {
        console.log('🔍 THRESHOLD-DRAG - No chart available, skipping dragging setup');
        return;
    }
    
    const chart = window.amplificationChart;
    const canvas = chart.canvas;
    
    // Add null check for canvas
    if (!canvas) {
        console.log('🔍 THRESHOLD-DRAG - No canvas available, skipping dragging setup');
        return;
    }
    
    let draggedChannel = null;
    let dragStartY = null;
    
    // Define event handlers as named functions
    function handleMouseDown(e) {
        const pos = getMousePos(e);
        const threshold = findNearestThreshold(pos);
        
        if (threshold) {
            draggedChannel = threshold.channel;
            dragStartY = pos.y;
            canvas.style.cursor = 'ns-resize';
            e.preventDefault();
        }
    }
    
    function handleMouseMove(e) {
        const pos = getMousePos(e);
        
        if (draggedChannel) {
            // Dragging
            const yScale = chart.scales.y;
            const newValue = yScale.getValueForPixel(pos.y);
            
            if (newValue > 0) {
                // Update the annotation
                const annotations = chart.options.plugins.annotation.annotations;
                const annotationKey = `threshold_${draggedChannel}`;
                
                if (annotations[annotationKey]) {
                    annotations[annotationKey].yMin = newValue;
                    annotations[annotationKey].yMax = newValue;
                    annotations[annotationKey].label.content = `${draggedChannel}: ${newValue.toFixed(2)}`;
                }
                
                // Update stored threshold
                const currentScale = window.currentScaleMode || 'linear';
                setChannelThreshold(draggedChannel, currentScale, newValue);
                
                // Update input if this is the current channel
                const thresholdInput = document.getElementById('thresholdInput');
                if (thresholdInput && (window.currentFluorophore === draggedChannel || window.currentFluorophore === 'all')) {
                    thresholdInput.value = newValue.toFixed(2);
                }
                
                // Update chart without animation
                chart.update('none');
            }
        } else {
            // Hovering
            const threshold = findNearestThreshold(pos);
            canvas.style.cursor = threshold ? 'ns-resize' : 'default';
        }
    }
    
    function handleMouseUp(e) {
        if (draggedChannel) {
            console.log(`🔍 DRAG-END - ${draggedChannel} threshold updated`);
            
            // Mark as manual threshold
            if (!window.manualThresholds) window.manualThresholds = {};
            if (!window.manualThresholds[draggedChannel]) window.manualThresholds[draggedChannel] = {};
            window.manualThresholds[draggedChannel][window.currentScaleMode] = true;
            
            // Update strategy to manual
            const strategySelect = document.getElementById('thresholdStrategySelect');
            if (strategySelect && strategySelect.value !== 'manual') {
                strategySelect.value = 'manual';
                window.selectedThresholdStrategy = 'manual';
            }
            
            // Send to backend
            if (window.sendManualThresholdToBackend) {
                const currentScale = window.currentScaleMode || 'linear';
                const annotations = chart.options.plugins.annotation.annotations;
                const annotationKey = `threshold_${draggedChannel}`;
                const newValue = annotations[annotationKey]?.yMin;
                if (newValue) {
                    window.sendManualThresholdToBackend(draggedChannel, currentScale, newValue);
                }
            }
            
            draggedChannel = null;
            dragStartY = null;
        }
    }
    
    function handleMouseLeave(e) {
        draggedChannel = null;
        dragStartY = null;
        canvas.style.cursor = 'default';
    }
    
    // Helper functions
    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height)
        };
    }
    
    function isNearThreshold(mouseY, thresholdY, tolerance = 10) {
        return Math.abs(mouseY - thresholdY) < tolerance;
    }
    
    function findNearestThreshold(mousePos) {
        const yScale = chart.scales.y;
        const annotations = chart.options.plugins.annotation.annotations;
        
        for (const [key, annotation] of Object.entries(annotations)) {
            if (key.startsWith('threshold_')) {
                const channel = key.replace('threshold_', '');
                const thresholdValue = annotation.yMin;
                const thresholdY = yScale.getPixelForValue(thresholdValue);
                
                if (isNearThreshold(mousePos.y, thresholdY)) {
                    return { channel, value: thresholdValue, pixelY: thresholdY };
                }
            }
        }
        return null;
    }
    
    // Remove any existing listeners to prevent duplicates
    canvas.removeEventListener('mousedown', handleMouseDown);
    canvas.removeEventListener('mousemove', handleMouseMove);
    canvas.removeEventListener('mouseup', handleMouseUp);
    canvas.removeEventListener('mouseleave', handleMouseLeave);
    
    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    
    console.log('✅ Custom threshold dragging enabled');
}
// Expose globally
window.addThresholdDragging = addThresholdDragging;

// Modify the existing updateAllChannelThresholds to call addThresholdDragging after updating
const originalUpdateAllChannelThresholds = window.updateAllChannelThresholds;
window.updateAllChannelThresholds = function() {
    originalUpdateAllChannelThresholds.apply(this, arguments);
    // Add dragging after a small delay to ensure chart is updated
    setTimeout(addThresholdDragging, 100);
};

// Also call it after updateSingleChannelThreshold
const originalUpdateSingleChannelThreshold = window.updateSingleChannelThreshold;
window.updateSingleChannelThreshold = function() {
    originalUpdateSingleChannelThreshold.apply(this, arguments);
    setTimeout(addThresholdDragging, 100);
};

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
    const currentScale = window.currentScaleMode;
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
                setChannelThreshold(fluorophore, window.currentScaleMode, newY);
                const thresholdInput = document.getElementById('thresholdInput');
                if (thresholdInput && (window.currentFluorophore === fluorophore || window.currentFluorophore === 'all')) {
                    thresholdInput.value = newY.toFixed(2);
                }
                updateSingleChannelThreshold(fluorophore);
                console.log(`🔍 DRAG-END - Threshold for ${fluorophore} (${window.currentScaleMode}) set to ${newY}`);
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
// Replace lines 616-703 (the calculateStableChannelThreshold function) with this:

function calculateStableChannelThreshold(channel, scale) {
    console.log(`🔍 THRESHOLD - Calculating ${scale} threshold for channel: ${channel}`);
    
    // Get the current threshold strategy
    const strategy = getSelectedThresholdStrategy() || 'default';
    console.log(`🔍 THRESHOLD - Using strategy: ${strategy} for ${channel} on ${scale} scale`);
    
    // HANDLE MANUAL STRATEGY FIRST
    if (strategy === 'manual') {
        // For manual strategy, return the currently stored threshold value
        if (window.stableChannelThresholds && 
            window.stableChannelThresholds[channel] && 
            window.stableChannelThresholds[channel][scale]) {
            const manualValue = window.stableChannelThresholds[channel][scale];
            console.log(`🔍 THRESHOLD-MANUAL - Returning stored manual value for ${channel}[${scale}]: ${manualValue}`);
            return manualValue;
        } else {
            console.log(`🔍 THRESHOLD-MANUAL - No manual value stored for ${channel}[${scale}], returning null`);
            return null;
        }
    }
    
    // Replace the FIXED STRATEGIES section in calculateStableChannelThreshold:

// Replace the FIXED STRATEGIES section in calculateStableChannelThreshold (starting around line 640):

// HANDLE FIXED STRATEGIES DIRECTLY
if (strategy === 'linear_fixed' || strategy === 'log_fixed') {
    // Get pathogen from experiment pattern instead of well data
    let pathogen = null;
    
    // First try to get from experiment pattern if available
    if (window.currentExperimentPattern) {
        pathogen = extractTestCode(window.currentExperimentPattern);
        console.log(`🔍 THRESHOLD-FIXED - Extracted pathogen "${pathogen}" from experiment pattern: ${window.currentExperimentPattern}`);
    }
    
    // If not found, try to extract from filename in analysis results
    if (!pathogen && window.currentAnalysisResults && window.currentAnalysisResults.metadata && window.currentAnalysisResults.metadata.filename) {
        const filename = window.currentAnalysisResults.metadata.filename;
        pathogen = extractTestCode(filename);
        console.log(`🔍 THRESHOLD-FIXED - Extracted pathogen "${pathogen}" from filename: ${filename}`);
    }
    
    // If still not found, try to get from the first well's experiment_pattern if available
    if (!pathogen && window.currentAnalysisResults) {
        const resultsToCheck = window.currentAnalysisResults.individual_results || window.currentAnalysisResults;
        const wellKeys = Object.keys(resultsToCheck);
        for (const wellKey of wellKeys) {
            const well = resultsToCheck[wellKey];
            if (well && well.experiment_pattern) {
                pathogen = extractTestCode(well.experiment_pattern);
                console.log(`🔍 THRESHOLD-FIXED - Extracted pathogen "${pathogen}" from well experiment_pattern: ${well.experiment_pattern}`);
                break;
            }
        }
    }
    
    // NO FALLBACK - if we can't find the pathogen, we can't use fixed thresholds
    if (!pathogen) {
        console.error(`❌ THRESHOLD-FIXED - Could not extract pathogen from experiment pattern. Cannot use fixed threshold.`);
        return null;
    }
    
    console.log(`🔍 THRESHOLD-FIXED - Using pathogen: ${pathogen} for ${strategy} strategy`);
    
    // Get fixed threshold value directly from PATHOGEN_FIXED_THRESHOLDS
    if (window.PATHOGEN_FIXED_THRESHOLDS && window.PATHOGEN_FIXED_THRESHOLDS[pathogen]) {
        const fixedValues = window.PATHOGEN_FIXED_THRESHOLDS[pathogen];
        const scaleKey = scale === 'log' ? 'log' : 'linear';
        
        // Debug log to help troubleshooting
        console.log(`🔍 THRESHOLD-DEBUG - Fixed values for ${pathogen}:`, 
            fixedValues[channel] ? fixedValues[channel] : 'No entry for this channel');
        
        // Access structure is pathogen->channel->scale (not pathogen->scale->channel)
        if (fixedValues[channel] && fixedValues[channel][scaleKey] !== undefined) {
            const fixedValue = fixedValues[channel][scaleKey];
            console.log(`✅ THRESHOLD-FIXED - ${channel}[${scale}]: ${fixedValue} (pathogen: ${pathogen})`);
            return fixedValue;
        } else {
            console.warn(`⚠️ THRESHOLD-FIXED - No fixed value for ${channel}[${scale}] in pathogen ${pathogen}`);
        }
    } else {
        console.warn(`⚠️ THRESHOLD-FIXED - No fixed thresholds found for pathogen ${pathogen}`);
    }
    
    // Return null if no fixed value found
    return null;
}


    
    // HANDLE CALCULATED STRATEGIES (all other strategies)
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
    
    // Also fix the pathogen detection in the CALCULATED STRATEGIES section (around line 710):
// Replace this section:
    // Get pathogen information
    let pathogen = null;
    
    // Extract pathogen from experiment pattern for calculated strategies too
    if (window.currentExperimentPattern) {
        pathogen = extractTestCode(window.currentExperimentPattern);
    } else if (window.currentAnalysisResults && window.currentAnalysisResults.metadata && window.currentAnalysisResults.metadata.filename) {
        pathogen = extractTestCode(window.currentAnalysisResults.metadata.filename);
    } else if (window.currentAnalysisResults) {
        const resultsToCheck = window.currentAnalysisResults.individual_results || window.currentAnalysisResults;
        const wellKeys = Object.keys(resultsToCheck);
        for (const wellKey of wellKeys) {
            const well = resultsToCheck[wellKey];
            if (well && well.experiment_pattern) {
                pathogen = extractTestCode(well.experiment_pattern);
                break;
            }
        }
    }
    
    // NO FALLBACK - use null if no pathogen found
    if (!pathogen) {
        console.warn(`⚠️ THRESHOLD-CALC - No pathogen found for calculated threshold`);
        pathogen = null; // Don't use BVPanelPCR1 as fallback
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
        const threshold = window.stableChannelThresholds[channel][window.currentScaleMode];
        if (threshold !== null && threshold !== undefined) {
            thresholdInput.value = threshold.toFixed(2);
            console.log(`🔍 THRESHOLD-INPUT-UPDATE - Set input to ${threshold.toFixed(2)} for ${channel} ${window.currentScaleMode}`);
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
    const scale = window.currentScaleMode;
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
    
    const scale = window.currentScaleMode;
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
// Add this function to handle single-channel validation
function validateAndSetSingleChannel() {
    // Get all unique channels from current results
    const channels = new Set();
    if (window.currentAnalysisResults && window.currentAnalysisResults.individual_results) {
        Object.values(window.currentAnalysisResults.individual_results).forEach(well => {
            if (well && well.fluorophore && well.fluorophore !== 'Unknown') {
                channels.add(well.fluorophore);
            }
        });
    }
    
    console.log(`🔍 CHANNEL-VALIDATION - Found ${channels.size} channels: ${Array.from(channels).join(', ')}`);
    
    // If only one channel, automatically set it as current
    if (channels.size === 1) {
        const singleChannel = Array.from(channels)[0];
        window.currentFluorophore = singleChannel;
        
        // Update fluorophore selector if it exists
        const fluorophoreSelector = document.getElementById('fluorophoreFilter');
        if (fluorophoreSelector) {
            // Check if the single channel option exists
            const hasOption = Array.from(fluorophoreSelector.options).some(opt => opt.value === singleChannel);
            if (hasOption) {
                fluorophoreSelector.value = singleChannel;
            } else {
                // Add the option if it doesn't exist
                const option = document.createElement('option');
                option.value = singleChannel;
                option.textContent = singleChannel;
                fluorophoreSelector.appendChild(option);
                fluorophoreSelector.value = singleChannel;
            }
            console.log(`🔍 CHANNEL-VALIDATION - Auto-selected single channel: ${singleChannel}`);
        }
        
        return singleChannel;
    }
    
    // If multiple channels but "all" is selected, prompt user to select one for manual threshold
    if (channels.size > 1 && window.currentFluorophore === 'all') {
        console.log(`🔍 CHANNEL-VALIDATION - Multiple channels available, user should select one for manual threshold`);
    }
    
    return window.currentFluorophore;
}

// Call this function when initializing thresholds
window.validateAndSetSingleChannel = validateAndSetSingleChannel;

// Modify initializeThresholdSystem to include channel validation
const originalInitializeThresholdSystem = window.initializeThresholdSystem;
window.initializeThresholdSystem = function() {
    console.log('🔍 THRESHOLD-INIT - Initializing complete threshold system');
    
    // Validate and set single channel first
    validateAndSetSingleChannel();
    
    // Continue with original initialization
    if (originalInitializeThresholdSystem) {
        originalInitializeThresholdSystem.apply(this, arguments);
    }
};
function getCurrentChannelThreshold(channel, scale = null) {
    // Ensure global threshold object is always initialized
    if (!window.stableChannelThresholds) window.stableChannelThresholds = {};
    if (!scale) scale = window.currentScaleMode;
    
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
    const scale = window.currentScaleMode;
    
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
    const currentScaleMode = window.currentScaleMode;
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

function getChannelColor(channel) {
    const colors = {
        'Cy5': '#ff6b6b',
        'FAM': '#4ecdc4', 
        'HEX': '#45b7d1',
        'Texas Red': '#f9ca24'
    };
    return colors[channel] || '#333333';
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
            
            // Try to extract from chart datasets
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
      // Inside initializeManualThresholdControls function
function handleManualThresholdChange() {
    let channel = window.currentFluorophore;
    
    // Validate channel selection
    if (!channel || channel === 'all') {
        // Try to auto-select if single channel
        channel = validateAndSetSingleChannel();
        
        if (!channel || channel === 'all') {
            alert('Please select a specific channel to set manual threshold. Manual thresholds cannot be applied to "all" channels.');
            return;
        }
    }
    
    const scale = window.currentScaleMode;
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
// Replace the sendManualThresholdToBackend function (around line 1385):

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
        
        console.log(`🔍 BACKEND-THRESHOLD - Sending manual threshold:`, payload);
        
        const response = await fetch('/threshold/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log(`🔍 BACKEND-THRESHOLD - Backend response:`, result);
            
            if (result.success && result.updated_results) {
                // CRITICAL: Create a deep copy of current results to preserve all data
                const preservedResults = JSON.parse(JSON.stringify(window.currentAnalysisResults.individual_results));
                
                // Only update CQJ and CalcJ fields from backend response
                Object.entries(result.updated_results).forEach(([wellKey, updates]) => {
                    if (preservedResults[wellKey]) {
                        // Only update threshold-related fields
                        if (updates.cqj !== undefined) preservedResults[wellKey].cqj = updates.cqj;
                        if (updates.calcj !== undefined) preservedResults[wellKey].calcj = updates.calcj;
                        if (updates.CQJ !== undefined) preservedResults[wellKey].CQJ = updates.CQJ;
                        if (updates.CalcJ !== undefined) preservedResults[wellKey].CalcJ = updates.CalcJ;
                        if (updates['CQ-J'] !== undefined) preservedResults[wellKey]['CQ-J'] = updates['CQ-J'];
                        if (updates['Calc-J'] !== undefined) preservedResults[wellKey]['Calc-J'] = updates['Calc-J'];
                        
                        console.log(`🔍 BACKEND-THRESHOLD - Updated well ${wellKey} CQJ values only`);
                    }
                });
                
                // Update the global results with preserved data
                window.currentAnalysisResults.individual_results = preservedResults;
                
                // Update results table with preserved data
                if (typeof populateResultsTable === 'function') {
                    populateResultsTable(preservedResults);
                }
                
                console.log(`✅ BACKEND-THRESHOLD - Updated ${Object.keys(result.updated_results).length} wells with new CQJ/CalcJ values`);
                
                // Trigger chart update to reflect new calculations
                if (typeof updateChartForNewData === 'function') {
                    updateChartForNewData();
                }
                
                // Also trigger CQJ value updates in the UI
                if (typeof updateCQJDisplayValues === 'function') {
                    updateCQJDisplayValues();
                }
                
                return result;
            } else if (result.success) {
                console.log(`✅ BACKEND-THRESHOLD - Manual threshold acknowledged by backend`);
                return result;
            } else {
                console.warn(`⚠️ BACKEND-THRESHOLD - Backend returned success=false:`, result);
            }
        } else {
            console.warn(`⚠️ BACKEND-THRESHOLD - HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error(`❌ BACKEND-THRESHOLD - Backend update failed:`, error);
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
// Replace the populateThresholdStrategyDropdown function (around line 1500):

function populateThresholdStrategyDropdown() {
    const select = document.getElementById('thresholdStrategySelect');
    if (!select) {
        console.warn('🔍 STRATEGY-DROPDOWN - thresholdStrategySelect element not found');
        return;
    }
    
    select.innerHTML = '';
    
    // CRITICAL FIX: Get scale from multiple sources to ensure correct value
    let scale = window.currentScaleMode;
    
    // If currentScaleMode is not set, try to get from sessionStorage
    if (!scale) {
        scale = sessionStorage.getItem('chartScale') || 'linear';
        window.currentScaleMode = scale; // Update global
    }
    
    // Also check the toggle button state as a fallback
    const toggleBtn = document.getElementById('toggleScaleBtn');
    if (toggleBtn && !scale) {
        scale = toggleBtn.classList.contains('log-scale') ? 'log' : 'linear';
        window.currentScaleMode = scale; // Update global
    }
    
    console.log(`🔍 DROPDOWN-DEBUG - Scale: ${scale}, window.currentScaleMode: ${window.currentScaleMode}`);
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
        
        // Apply the selected strategy directly
        if (e.target.value !== 'manual') {
            applyThresholdStrategy(e.target.value);
        } else {
            // For manual strategy, just update the input box to current threshold
            updateThresholdInputForCurrentScale();
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
    const currentScale = window.currentScaleMode;
    
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
 * End Strategy Integration Functions
 */
// Add this function to threshold_frontend.js

/**
 * Extract and categorize control wells by channel from analysis results
 * This function is required by threshold_frontend.js for threshold calculations
 */
window.extractChannelControlWells = function() {
    if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
        console.log('🔍 CONTROL-WELLS - No analysis results available for control extraction');
        return;
    }
    
    window.channelControlWells = {};
    const results = window.currentAnalysisResults.individual_results;
    
    // Group wells by channel (fluorophore)
    Object.entries(results).forEach(([wellKey, well]) => {
        if (!well || !well.fluorophore || well.fluorophore === 'Unknown') return;
        
        const channel = well.fluorophore;
        const sampleName = well.sample_name || well.sample || '';
        
        // Initialize channel if not exists
        if (!window.channelControlWells[channel]) {
            window.channelControlWells[channel] = { 
                NTC: [], 
                POS: [],
                H: [],
                M: [],
                L: [],
                other: []
            };
        }
        
        // Categorize control wells based on sample name
        const sampleLower = sampleName.toLowerCase();
        
        if (sampleLower.includes('ntc') || 
            sampleLower.includes('neg') ||
            sampleLower.includes('negative') ||
            sampleLower.includes('blank')) {
            window.channelControlWells[channel].NTC.push(well);
        } else if (sampleLower.includes('pos') || sampleLower.includes('control')) {
            // Further categorize positive controls
            if (sampleLower.includes('h ') || sampleLower.match(/\bh\d/)) {
                window.channelControlWells[channel].H.push(well);
            } else if (sampleLower.includes('m ') || sampleLower.match(/\bm\d/)) {
                window.channelControlWells[channel].M.push(well);
            } else if (sampleLower.includes('l ') || sampleLower.match(/\bl\d/)) {
                window.channelControlWells[channel].L.push(well);
            } else {
                window.channelControlWells[channel].POS.push(well);
            }
        }
    });
    
    console.log('🔍 CONTROL-WELLS - Extracted control wells by channel:', window.channelControlWells);
    
    // Log summary for debugging
    Object.entries(window.channelControlWells).forEach(([channel, controls]) => {
        console.log(`🔍 CONTROL-WELLS - ${channel}: NTC=${controls.NTC.length}, POS=${controls.POS.length}, H=${controls.H.length}, M=${controls.M.length}, L=${controls.L.length}`);
    });
};
// --- End Additional Functions ---

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
window.initializeManualThresholdControls = initializeManualThresholdControls;
window.sendManualThresholdToBackend = sendManualThresholdToBackend;
window.updateChartThreshold = updateChartThreshold;
window.applyThresholdStrategy = applyThresholdStrategy;
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
