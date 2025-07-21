// threshold_frontend.js
// All frontend threshold calculation, storage, and chart annotation logic


// Add this combined initialization function

// Debounce utility to prevent rapid-fire function calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Initialize threshold system after new analysis results are loaded
 * Call this ONCE after displayAnalysisResults or displayMultiFluorophoreResults
 */
window.initializeThresholdSystem = function() {
    
    // Add loading state guard to prevent multiple concurrent initializations
    if (window.appState && window.appState.uiState && window.appState.uiState.isThresholdLoading) {
        return;
    }
    
    // Set loading flag
    if (window.appState && window.appState.uiState) {
        window.appState.uiState.isThresholdLoading = true;
    }
    
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
    
    // Clear loading flag
    if (window.appState && window.appState.uiState) {
        window.appState.uiState.isThresholdLoading = false;
    }
    
};

// Create debounced version for use in rapid-fire scenarios
window.initializeThresholdSystemDebounced = debounce(window.initializeThresholdSystem, 300);


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
    
    // Multiple null checks for robustness
    if (!window.currentAnalysisResults) {
        return scale === 'log' ? 10 : 100;
    }
    
    if (!window.currentAnalysisResults.individual_results) {
        return scale === 'log' ? 10 : 100;
    }
    
    if (typeof window.currentAnalysisResults.individual_results !== 'object') {
        return scale === 'log' ? 10 : 100;
    }
    
    // Get ALL wells for this channel (by fluorophore) - CRITICAL: This uses ALL wells, not just displayed ones
    const channelWells = Object.keys(window.currentAnalysisResults.individual_results)
        .map(wellKey => window.currentAnalysisResults.individual_results[wellKey])
        .filter(well => well != null && well.fluorophore === channel); // Filter by fluorophore property
    
    if (channelWells.length === 0) {
        return scale === 'log' ? 10 : 100;
    }
    
    
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
                return threshold;
            }
        } catch (error) {
        }
    }
    
    return null;
}







// --- Utility Functions ---
function safeSetItem(storage, key, value) {
    try {
        storage.setItem(key, value);
    } catch (e) {
    }
}

function getSelectedThresholdStrategy() {
    // First try to get from DOM element (most current)
    const select = document.getElementById('thresholdStrategySelect');
    if (select && select.value) {
        window.selectedThresholdStrategy = select.value;
        return select.value;
    }
    
    // Fallback to global variable
    return window.selectedThresholdStrategy || 'default';
}

// Add event listener to ensure dropdown changes are captured
function initializeThresholdStrategyDropdown() {
    const select = document.getElementById('thresholdStrategySelect');
    if (select) {
        // Remove any existing listeners to prevent duplicates
        if (select._thresholdStrategyHandler) {
            select.removeEventListener('change', select._thresholdStrategyHandler);
            delete select._thresholdStrategyHandler;
        }
        
        // Create and store the handler
        select._thresholdStrategyHandler = handleThresholdStrategyDropdownChange;
        
        // Add new listener
        select.addEventListener('change', select._thresholdStrategyHandler);
        
    } else {
    }
}

function handleThresholdStrategyDropdownChange(event) {
    const newStrategy = event.target.value;
    
    // Update global variable
    window.selectedThresholdStrategy = newStrategy;
    
    // Clear cached thresholds to force recalculation with new strategy
    window.stableChannelThresholds = {};
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
    
    // Check if value actually changed to avoid unnecessary ML triggers
    const previousValue = window.stableChannelThresholds[channel][scale];
    const hasChanged = previousValue !== value;
    
    window.stableChannelThresholds[channel][scale] = value;
    
    // Also update the legacy system for compatibility
    if (!channelThresholds[channel]) channelThresholds[channel] = {};
    channelThresholds[channel][scale] = value;
    
    // Persist both systems in sessionStorage
    safeSetItem(sessionStorage, 'stableChannelThresholds', JSON.stringify(window.stableChannelThresholds));
    safeSetItem(sessionStorage, 'channelThresholds', JSON.stringify(channelThresholds));
    
    // Trigger ML re-classification only when threshold value actually changes
    if (hasChanged && typeof window.onThresholdChange === 'function') {
        window.onThresholdChange(channel, scale, value);
    }
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
    
    // Basic guard: check if chart exists
    if (!window.amplificationChart || typeof window.amplificationChart !== 'object') {
        return;
    }
    
    // Initialize annotation structure if missing (instead of failing)
    if (!window.amplificationChart.options) {
        window.amplificationChart.options = {};
    }
    if (!window.amplificationChart.options.plugins) {
        window.amplificationChart.options.plugins = {};
    }
    if (!window.amplificationChart.options.plugins.annotation) {
        window.amplificationChart.options.plugins.annotation = {};
    }
    if (!window.amplificationChart.options.plugins.annotation.annotations) {
        window.amplificationChart.options.plugins.annotation.annotations = {};
    }
    
    // Also guard: do not proceed if no valid analysis results
    if (!window.currentAnalysisResults ||
        !window.currentAnalysisResults.individual_results ||
        typeof window.currentAnalysisResults.individual_results !== 'object' ||
        Object.keys(window.currentAnalysisResults.individual_results).length === 0) {
        return;
    }
    
    // Get current chart annotations
    const annotations = window.amplificationChart.options.plugins.annotation.annotations;
    
    // Update threshold lines for all visible channels - IMPROVED DETECTION
    // Use global visibleChannels if available, otherwise detect from current context
    let visibleChannels = window.visibleChannels || new Set();
    
    // If no global visibleChannels set, detect from current context
    if (visibleChannels.size === 0) {
        
        // Method 1: Get channels from chart datasets (for currently displayed data)
        if (window.amplificationChart.data && window.amplificationChart.data.datasets) {
            window.amplificationChart.data.datasets.forEach(dataset => {
                // Extract channel from dataset label
                const match = dataset.label?.match(/\(([^)]+)\)/);
                if (match && match[1] !== 'Unknown') {
                    visibleChannels.add(match[1]);
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
        
        // Update global visibleChannels for future use
        window.visibleChannels = visibleChannels;
    }
    
    
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
                }
            };
        } else {
        }
    });
    
    // Update chart
    window.amplificationChart.update('none');
    
}
   

// Custom threshold dragging implementation that works across all platforms
function addThresholdDragging() {
    if (!window.amplificationChart || !window.amplificationChart.canvas) {
        return;
    }
    
    const canvas = window.amplificationChart.canvas;
    let isDragging = false;
    let draggedThreshold = null;
    let startY = 0;
    let startThresholdValue = 0;
    
    // Make canvas focusable for better event handling
    canvas.setAttribute('tabindex', '0');
    canvas.style.touchAction = 'none'; // Prevent touch scrolling
    
    // Helper function to get threshold from canvas position
    function getThresholdAtPosition(x, y) {
        const canvasRect = canvas.getBoundingClientRect();
        const chartArea = window.amplificationChart.chartArea;
        
        // Check if click is within chart area
        if (x < chartArea.left || x > chartArea.right || y < chartArea.top || y > chartArea.bottom) {
            return null;
        }
        
        // Get Y value from chart scale
        const yScale = window.amplificationChart.scales.y;
        const clickedValue = yScale.getValueForPixel(y);
        
        // Find closest threshold line within 10 pixels
        const annotations = window.amplificationChart.options.plugins.annotation.annotations;
        let closestThreshold = null;
        let minDistance = 10; // 10 pixel tolerance
        
        Object.keys(annotations).forEach(key => {
            if (key.startsWith('threshold_')) {
                const annotation = annotations[key];
                const thresholdY = yScale.getPixelForValue(annotation.yMin);
                const distance = Math.abs(y - thresholdY);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    closestThreshold = {
                        key: key,
                        channel: key.replace('threshold_', ''),
                        value: annotation.yMin,
                        pixelY: thresholdY
                    };
                }
            }
        });
        
        return closestThreshold;
    }
    
    // Mouse event handlers
    function onMouseDown(event) {
        // Only handle left mouse button
        if (event.button !== 0) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const threshold = getThresholdAtPosition(x, y);
        if (threshold) {
            isDragging = true;
            draggedThreshold = threshold;
            startY = y;
            startThresholdValue = threshold.value;
            canvas.style.cursor = 'ns-resize';
            
            // Prevent text selection and other defaults
            event.preventDefault();
            event.stopPropagation();
            
        }
    }
    
    function onMouseMove(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        if (isDragging && draggedThreshold) {
            // Calculate new threshold value
            const yScale = window.amplificationChart.scales.y;
            const newValue = yScale.getValueForPixel(y);
            
            // Validate new value (must be positive and reasonable)
            if (newValue > 0 && newValue < yScale.max * 2) {
                // Update the annotation
                const annotations = window.amplificationChart.options.plugins.annotation.annotations;
                const annotation = annotations[draggedThreshold.key];
                if (annotation) {
                    annotation.yMin = newValue;
                    annotation.yMax = newValue;
                    annotation.label.content = `${draggedThreshold.channel}: ${newValue.toFixed(2)}`;
                    
                    // Update chart without animation for smooth dragging
                    window.amplificationChart.update('none');
                }
            }
            
            event.preventDefault();
            event.stopPropagation();
        } else {
            // Check if cursor is over a threshold line
            const threshold = getThresholdAtPosition(x, y);
            canvas.style.cursor = threshold ? 'ns-resize' : '';
        }
    }
    
    function onMouseUp(event) {
        if (isDragging && draggedThreshold) {
            const rect = canvas.getBoundingClientRect();
            const y = event.clientY - rect.top;
            const yScale = window.amplificationChart.scales.y;
            const newValue = yScale.getValueForPixel(y);
            
            // Validate and save the new threshold
            if (newValue > 0 && newValue < yScale.max * 2) {
                // Store the new threshold value
                setChannelThreshold(draggedThreshold.channel, window.currentScaleMode, newValue);
                
                // Update threshold input if it's for the current channel
                const thresholdInput = document.getElementById('thresholdInput');
                if (thresholdInput && 
                    (window.currentFluorophore === draggedThreshold.channel || window.currentFluorophore === 'all')) {
                    thresholdInput.value = newValue.toFixed(2);
                }
                
                // Mark as manual threshold
                if (!window.manualThresholds) window.manualThresholds = {};
                if (!window.manualThresholds[draggedThreshold.channel]) {
                    window.manualThresholds[draggedThreshold.channel] = {};
                }
                window.manualThresholds[draggedThreshold.channel][window.currentScaleMode] = true;
                
                
                // Trigger any backend updates if needed
                if (typeof sendManualThresholdToBackend === 'function') {
                    sendManualThresholdToBackend(draggedThreshold.channel, window.currentScaleMode, newValue);
                }
                
                // Force CQJ recalculation after manual threshold change
                if (typeof window.forceCQJCalcJRecalculation === 'function') {
                    window.forceCQJCalcJRecalculation({ updateWellSelector: false });
                }
            }
            
            // Reset dragging state
            isDragging = false;
            draggedThreshold = null;
            canvas.style.cursor = '';
            
            event.preventDefault();
            event.stopPropagation();
        }
    }
    
    // Touch event handlers for mobile/tablet support
    function onTouchStart(event) {
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const rect = canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            
            const threshold = getThresholdAtPosition(x, y);
            if (threshold) {
                isDragging = true;
                draggedThreshold = threshold;
                startY = y;
                startThresholdValue = threshold.value;
                
                event.preventDefault();
                event.stopPropagation();
            }
        }
    }
    
    function onTouchMove(event) {
        if (isDragging && draggedThreshold && event.touches.length === 1) {
            const touch = event.touches[0];
            const rect = canvas.getBoundingClientRect();
            const y = touch.clientY - rect.top;
            
            // Calculate new threshold value
            const yScale = window.amplificationChart.scales.y;
            const newValue = yScale.getValueForPixel(y);
            
            // Validate new value
            if (newValue > 0 && newValue < yScale.max * 2) {
                // Update the annotation
                const annotations = window.amplificationChart.options.plugins.annotation.annotations;
                const annotation = annotations[draggedThreshold.key];
                if (annotation) {
                    annotation.yMin = newValue;
                    annotation.yMax = newValue;
                    annotation.label.content = `${draggedThreshold.channel}: ${newValue.toFixed(2)}`;
                    
                    // Update chart without animation
                    window.amplificationChart.update('none');
                }
            }
            
            event.preventDefault();
            event.stopPropagation();
        }
    }
    
    function onTouchEnd(event) {
        if (isDragging && draggedThreshold) {
            // Use last known position to finalize threshold
            const annotations = window.amplificationChart.options.plugins.annotation.annotations;
            const annotation = annotations[draggedThreshold.key];
            if (annotation) {
                const newValue = annotation.yMin;
                
                // Store the new threshold value
                setChannelThreshold(draggedThreshold.channel, window.currentScaleMode, newValue);
                
                // Update threshold input if it's for the current channel
                const thresholdInput = document.getElementById('thresholdInput');
                if (thresholdInput && 
                    (window.currentFluorophore === draggedThreshold.channel || window.currentFluorophore === 'all')) {
                    thresholdInput.value = newValue.toFixed(2);
                }
                
                // Mark as manual threshold
                if (!window.manualThresholds) window.manualThresholds = {};
                if (!window.manualThresholds[draggedThreshold.channel]) {
                    window.manualThresholds[draggedThreshold.channel] = {};
                }
                window.manualThresholds[draggedThreshold.channel][window.currentScaleMode] = true;
                
                
                // Force CQJ recalculation after manual threshold change
                if (typeof window.forceCQJCalcJRecalculation === 'function') {
                    window.forceCQJCalcJRecalculation({ updateWellSelector: false });
                }
            }
            
            // Reset dragging state
            isDragging = false;
            draggedThreshold = null;
            
            event.preventDefault();
            event.stopPropagation();
        }
    }
    
    // Remove any existing event listeners to prevent duplicates
    canvas.removeEventListener('mousedown', canvas._thresholdMouseDown);
    canvas.removeEventListener('mousemove', canvas._thresholdMouseMove);
    canvas.removeEventListener('mouseup', canvas._thresholdMouseUp);
    canvas.removeEventListener('touchstart', canvas._thresholdTouchStart);
    canvas.removeEventListener('touchmove', canvas._thresholdTouchMove);
    canvas.removeEventListener('touchend', canvas._thresholdTouchEnd);
    
    // Store handlers on canvas for later removal
    canvas._thresholdMouseDown = onMouseDown;
    canvas._thresholdMouseMove = onMouseMove;
    canvas._thresholdMouseUp = onMouseUp;
    canvas._thresholdTouchStart = onTouchStart;
    canvas._thresholdTouchMove = onTouchMove;
    canvas._thresholdTouchEnd = onTouchEnd;
    
    // Add event listeners
    canvas.addEventListener('mousedown', onMouseDown, { passive: false });
    canvas.addEventListener('mousemove', onMouseMove, { passive: false });
    canvas.addEventListener('mouseup', onMouseUp, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    
    // Also add mouse leave to clean up cursor
    canvas.addEventListener('mouseleave', () => {
        canvas.style.cursor = '';
        if (isDragging) {
            isDragging = false;
            draggedThreshold = null;
        }
    });
    
}
// Expose globally
window.addThresholdDragging = addThresholdDragging;

// Modify the existing updateAllChannelThresholds to call addThresholdDragging after updating
const originalUpdateAllChannelThresholds = window.updateAllChannelThresholds;
window.updateAllChannelThresholds = function() {
    originalUpdateAllChannelThresholds.apply(this, arguments);
    
    // Add dragging after a small delay to ensure chart is updated
    setTimeout(addThresholdDragging, 100);
    
    // Show threshold status after updating
    setTimeout(() => {
        if (window.showThresholdStatus) {
            const currentStrategy = window.getSelectedThresholdStrategy ? 
                window.getSelectedThresholdStrategy() : 'unknown';
            window.showThresholdStatus(currentStrategy);
        }
    }, 200);
};

// Also call it after updateSingleChannelThreshold
const originalUpdateSingleChannelThreshold = window.updateSingleChannelThreshold;
window.updateSingleChannelThreshold = function() {
    originalUpdateSingleChannelThreshold.apply(this, arguments);
    setTimeout(addThresholdDragging, 100);
};

function updateSingleChannelThreshold(fluorophore) {
    
    if (!window.amplificationChart) {
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
            }
        };
} else {
}
    
    // Update chart
    window.amplificationChart.update('none');
    
}

/**
 * Calculate stable threshold for a specific channel and scale using threshold strategies
 */
// Replace lines 616-703 (the calculateStableChannelThreshold function) with this:

function calculateStableChannelThreshold(channel, scale) {
    // Get the current threshold strategy
    const strategy = getSelectedThresholdStrategy() || 'default';
    
    // Debug: Check if this is a fixed strategy
    if (strategy === 'linear_fixed' || strategy === 'log_fixed') {
    }
    
    // HANDLE MANUAL STRATEGY FIRST
    if (strategy === 'manual') {
        // For manual strategy, return the currently stored threshold value
        if (window.stableChannelThresholds && 
            window.stableChannelThresholds[channel] && 
            window.stableChannelThresholds[channel][scale]) {
            const manualValue = window.stableChannelThresholds[channel][scale];
            return manualValue;
        } else {
            return null;
        }
    }
    
    // Replace the FIXED STRATEGIES section in calculateStableChannelThreshold:

// Replace the FIXED STRATEGIES section in calculateStableChannelThreshold (starting around line 640):

// HANDLE FIXED STRATEGIES DIRECTLY
if (strategy === 'linear_fixed' || strategy === 'log_fixed') {
    
    // Get pathogen from experiment pattern instead of well data
    let pathogen = null;
    
    // First try to get from getCurrentFullPattern function if available
    if (typeof window.getCurrentFullPattern === 'function') {
        const fullPattern = window.getCurrentFullPattern();
        pathogen = window.extractTestCode ? window.extractTestCode(fullPattern) : extractTestCode(fullPattern);
    }
    
    // Fallback: try to get from window.currentExperimentPattern if available  
    if (!pathogen && window.currentExperimentPattern) {
        pathogen = window.extractTestCode ? window.extractTestCode(window.currentExperimentPattern) : extractTestCode(window.currentExperimentPattern);
    }
    
    // If not found, try to extract from filename in analysis results
    if (!pathogen && window.currentAnalysisResults && window.currentAnalysisResults.metadata && window.currentAnalysisResults.metadata.filename) {
        const filename = window.currentAnalysisResults.metadata.filename;
        pathogen = window.extractTestCode ? window.extractTestCode(filename) : extractTestCode(filename);
    }
    
    // If still not found, try to get from the first well's experiment_pattern if available
    if (!pathogen && window.currentAnalysisResults) {
        const resultsToCheck = window.currentAnalysisResults.individual_results || window.currentAnalysisResults;
        const wellKeys = Object.keys(resultsToCheck);
        for (const wellKey of wellKeys) {
            const well = resultsToCheck[wellKey];
            if (well && well.experiment_pattern) {
                pathogen = window.extractTestCode ? window.extractTestCode(well.experiment_pattern) : extractTestCode(well.experiment_pattern);
                break;
            }
        }
    }
    
    // Debug: Check availability of required components
        // pathogen: pathogen,
        // PATHOGEN_FIXED_THRESHOLDS_available: !!window.PATHOGEN_FIXED_THRESHOLDS,
        // extractTestCode_available: typeof extractTestCode,
        // extractTestCode_function: typeof window.extractTestCode,
        // channel: channel,
        // scale: scale,
        // strategy: strategy,
        // currentExperimentPattern: window.currentExperimentPattern,
        // analysisResults_filename: window.currentAnalysisResults?.metadata?.filename
    // });
    
    // NO FALLBACK - if we can't find the pathogen, we can't use fixed thresholds
    if (!pathogen) {
            // currentExperimentPattern: window.currentExperimentPattern,
            // analysisResultsExists: !!window.currentAnalysisResults,
            // metadataExists: !!(window.currentAnalysisResults?.metadata),
            // filename: window.currentAnalysisResults?.metadata?.filename
        // });
        return null;
    }
    
    
    // Get fixed threshold value directly from PATHOGEN_FIXED_THRESHOLDS
    if (window.PATHOGEN_FIXED_THRESHOLDS && window.PATHOGEN_FIXED_THRESHOLDS[pathogen]) {
        const fixedValues = window.PATHOGEN_FIXED_THRESHOLDS[pathogen];
        const scaleKey = scale === 'log' ? 'log' : 'linear';
        
        // Debug log to help troubleshooting
            // fixedValues[channel] ? fixedValues[channel] : 'No entry for this channel');
        
        // Access structure is pathogen->channel->scale (not pathogen->scale->channel)
        if (fixedValues[channel] && fixedValues[channel][scaleKey] !== undefined) {
            const fixedValue = fixedValues[channel][scaleKey];
            
            // Immediately store the calculated value
            if (!window.stableChannelThresholds[channel]) {
                window.stableChannelThresholds[channel] = {};
            }
            window.stableChannelThresholds[channel][scale] = fixedValue;
            
            return fixedValue;
        } else {
            if (fixedValues[channel]) {
            }
        }
    } else {
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
        
        // FOR DERIVATIVE STRATEGIES: Add curve data (rfu and cycles arrays)
        if (strategy === 'log_max_derivative' || strategy === 'log_second_derivative_max' || strategy === 'linear_max_slope') {
            
            // Find a representative well for this channel with full curve data
            if (window.currentAnalysisResults) {
                const resultsToCheck = window.currentAnalysisResults.individual_results || window.currentAnalysisResults;
                
                const channelWells = Object.values(resultsToCheck).filter(well => 
                    well != null && well.fluorophore === channel && well.raw_rfu && well.cycles
                );
                
                
                if (channelWells.length > 0) {
                    // Use the first well with complete data
                    const representativeWell = channelWells[0];
                    let rfu = representativeWell.raw_rfu;
                    let cycles = representativeWell.cycles;
                    
                    
                    // Parse if they're strings
                    if (typeof rfu === 'string') {
                        try { 
                            rfu = JSON.parse(rfu); 
                        } catch(e) { 
                            rfu = null; 
                        }
                    }
                    if (typeof cycles === 'string') {
                        try { 
                            cycles = JSON.parse(cycles); 
                        } catch(e) { 
                            cycles = null; 
                        }
                    }
                    
                    if (Array.isArray(rfu) && Array.isArray(cycles) && rfu.length === cycles.length && rfu.length > 5) {
                        // Validate that the data is actually numeric and reasonable
                        const validData = rfu.every(val => typeof val === 'number' && !isNaN(val) && val >= 0);
                        const validCycles = cycles.every(val => typeof val === 'number' && !isNaN(val) && val > 0);
                        
                        if (validData && validCycles) {
                            params.rfu = rfu;
                            params.cycles = cycles;
                            params.curve = rfu; // Alias for compatibility
                        } else {
                            return null; // Invalid data, can't calculate derivative
                        }
                    } else {
                        return null; // Can't calculate derivative without proper curve data
                    }
                } else {
                    return null; // Can't calculate derivative without curve data
                }
            }
        }
        
        try {
            const threshold = window.calculateThreshold(strategy, params, scale);
            
            if (threshold !== null && !isNaN(threshold) && threshold > 0) {
                return threshold;
            }
        } catch (error) {
            // Strategy calculation failed, continue to fallback
        }
    } else {
        // Strategy function not available
    }
    
    // Only strategy-based calculations - no fallbacks
    return null;
}
// Expose globally
// Expose per-channel and per-well threshold calculation functions globally
window.calculateChannelThresholdPerChannel = calculateChannelThreshold; // (channel, scale)
window.calculateChannelThresholdPerWell = function(cycles, rfu) {
    if (!cycles || !rfu || cycles.length !== rfu.length || cycles.length < 5) {
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
        }
    }
}

function updateChartThresholds() {
    
    // Add loading state guard to prevent multiple concurrent updates
    if (window.appState && window.appState.uiState && window.appState.uiState.isChartLoading) {
        return;
    }
    
    if (!window.amplificationChart) {
        return;
    }
    
    // Ensure we have analysis results and channel thresholds are initialized
    if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
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
        return;
    }
    
    // Extract fluorophore from first dataset label
    const firstDataset = datasets[0];
    const match = firstDataset.label?.match(/\(([^)]+)\)/);
    
    if (match && match[1] !== 'Unknown') {
        // Single-channel chart - apply threshold for specific fluorophore
        const fluorophore = match[1];
        if (window.updateSingleChannelThreshold) window.updateSingleChannelThreshold(fluorophore);
    } else {
        // Multi-channel chart - apply thresholds for all channels
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
        
    } else {
    }
}

function enableDraggableThresholds() {
    // DISABLED: Draggable threshold functionality commented out
    // Will be replaced with test.html implementation later
    return;
}

function ensureThresholdFeaturesActive() {
    if (window.updateAllChannelThresholds) window.updateAllChannelThresholds();
    // enableDraggableThresholds(); // DISABLED - Will use test.html implementation
    if (typeof attachAutoButtonHandler === 'function') attachAutoButtonHandler();
}

function initializeChannelThresholds() {
    
    // Multiple null checks for robustness
    if (!window.currentAnalysisResults) {
        return;
    }
    
    if (!window.currentAnalysisResults.individual_results) {
        return;
    }
    
    if (typeof window.currentAnalysisResults.individual_results !== 'object') {
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
        return;
    }
    
    if (channels.size === 0) {
        return;
    }
    
    
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
            }
        });
    });
    
    // Update UI to reflect initialized thresholds
    if (typeof window.updateSliderUI === 'function') {
        window.updateSliderUI();
    }
    
    // Chart thresholds will be updated via animation onComplete callback
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
    
    
    // If only one channel, automatically set it as current
    if (channels.size === 1) {
        const singleChannel = Array.from(channels)[0];
        window.currentFluorophore = singleChannel;
        
        // Update main fluorophore selector if it exists (correct ID)
        const fluorophoreSelector = document.getElementById('fluorophoreSelect');
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
        }
        
        return singleChannel;
    }
    
    // If multiple channels but "all" is selected, prompt user to select one for manual threshold
    if (channels.size > 1 && window.currentFluorophore === 'all') {
    }
    
    return window.currentFluorophore;
}

// Call this function when initializing thresholds
window.validateAndSetSingleChannel = validateAndSetSingleChannel;

// Modify initializeThresholdSystem to include channel validation
const originalInitializeThresholdSystem = window.initializeThresholdSystem;
window.initializeThresholdSystem = function() {
    
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
    
    
    if (!channel || channel === 'all') {
        // If no specific channel, try to find first available threshold
        if (window.stableChannelThresholds) {
            const availableChannels = Object.keys(window.stableChannelThresholds);
            if (availableChannels.length > 0) {
                const firstChannel = availableChannels[0];
                const threshold = window.stableChannelThresholds[firstChannel][scale];
                if (threshold !== null && threshold !== undefined) {
                    thresholdInput.value = threshold.toFixed(2);
                    return;
                }
            }
        }
        return;
    }
    
    // Get current threshold for the channel
    const currentThreshold = getCurrentChannelThreshold(channel, scale);
    if (currentThreshold !== null && currentThreshold !== undefined && !isNaN(currentThreshold)) {
        thresholdInput.value = currentThreshold.toFixed(2);
    } else {
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
        'FAM': '#0066cc',      // Blue
        'HEX': '#00cc66',      // Green
        'Texas Red': '#cc0000', // Red
        'Cy5': '#8800cc'       // Purple
    };
    return colors[channel] || '#333333';
}

function getFluorophoreColor(fluorophore) {
    const colors = {
        'FAM': '#0066cc',      // Blue
        'HEX': '#00cc66',      // Green
        'Texas Red': '#cc0000', // Red
        'Cy5': '#8800cc'       // Purple
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
    
    
    if (channel && !isNaN(value) && value > 0) {
        
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
        
        
        // Force strategy to manual when user manually sets threshold
        const strategySelect = document.getElementById('thresholdStrategySelect');
        if (strategySelect && strategySelect.value !== 'manual') {
            strategySelect.value = 'manual';
            window.selectedThresholdStrategy = 'manual';
        }
    } else {
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
        
        const response = await fetch('/threshold/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.success && result.updated_results) {
                // CRITICAL: Create a deep copy of current results to preserve all data
                const preservedResults = JSON.parse(JSON.stringify(window.currentAnalysisResults.individual_results));
                
                // Only update CQJ and CalcJ fields from backend response
                Object.entries(result.updated_results).forEach(([wellKey, updates]) => {
                    if (preservedResults[wellKey]) {
                        const fluorophore = preservedResults[wellKey].fluorophore;
                        
                        // Map backend field names to frontend field names
                        if (updates.cqj_value !== undefined) {
                            preservedResults[wellKey].cqj_value = updates.cqj_value;
                            preservedResults[wellKey].cqj = preservedResults[wellKey].cqj || {};
                            preservedResults[wellKey].cqj[fluorophore] = updates.cqj_value;
                            preservedResults[wellKey].CQJ = updates.cqj_value;
                            preservedResults[wellKey]['CQ-J'] = updates.cqj_value;
                        }
                        if (updates.calcj_value !== undefined) {
                            preservedResults[wellKey].calcj_value = updates.calcj_value;
                            preservedResults[wellKey].calcj = preservedResults[wellKey].calcj || {};
                            preservedResults[wellKey].calcj[fluorophore] = updates.calcj_value;
                            preservedResults[wellKey].CalcJ = updates.calcj_value;
                            preservedResults[wellKey]['Calc-J'] = updates.calcj_value;
                        }
                        
                    }
                });
                
                // Update the global results with preserved data
                window.currentAnalysisResults.individual_results = preservedResults;
                
                // Store current fluorophore selection before any resets
                const currentFluorophore = window.appState?.currentFluorophore || window.currentFluorophore;
                
                // Update table filter to 'all' but preserve fluorophore selection
                if (window.appState) {
                    window.appState.currentFilter = 'all';
                    window.appState.currentChartMode = 'all';
                    // Don't reset currentFluorophore - keep user's selection
                }
                
                // Update results table with preserved data
                if (typeof populateResultsTable === 'function') {
                    populateResultsTable(preservedResults);
                }
                
                // Apply current filter state after table update
                if (typeof filterTable === 'function') {
                    filterTable();
                }
                
                // Restore fluorophore selection after sync
                if (currentFluorophore && window.appState) {
                    window.appState.currentFluorophore = currentFluorophore;
                    window.currentFluorophore = currentFluorophore;
                    
                    // Update the selector directly without triggering events
                    const fluorophoreSelect = document.getElementById('fluorophoreSelect');
                    if (fluorophoreSelect && fluorophoreSelect.value !== currentFluorophore) {
                        fluorophoreSelect.value = currentFluorophore;
                    }
                }
                
                
                // Force refresh the table display to show updated values
                setTimeout(() => {
                    if (typeof populateResultsTable === 'function') {
                        populateResultsTable(window.currentAnalysisResults.individual_results);
                        
                        // Apply any existing filters after table refresh
                        if (typeof filterTable === 'function') {
                            filterTable();
                        }
                    }
                }, 100);
                
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
                return result;
            } else {
            }
        } else {
        }
    } catch (error) {
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
        } else {
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
    
    
    // Use the appropriate strategies from threshold_strategies.js
    const strategies = scale === 'log' ? window.LOG_THRESHOLD_STRATEGIES : window.LINEAR_THRESHOLD_STRATEGIES;
    
    if (!strategies || typeof strategies !== 'object') {
            // scale: scale,
            // strategies: strategies,
            // window_log: window.LOG_THRESHOLD_STRATEGIES,
            // window_linear: window.LINEAR_THRESHOLD_STRATEGIES
        // });
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
    } else if (found) {
    }
    
    select.value = window.selectedThresholdStrategy || firstKey;
    window.selectedThresholdStrategy = select.value;
    
    
    // IMPORTANT: Remove ALL existing event listeners to prevent conflicts
    const newSelect = select.cloneNode(true);
    select.parentNode.replaceChild(newSelect, select);
    
    // CRITICAL: Set the value on the NEW element after replacement
    newSelect.value = window.selectedThresholdStrategy || firstKey;
    window.selectedThresholdStrategy = newSelect.value;
    
    // Add single consolidated event listener
    newSelect.addEventListener('change', function(e) {
        const newStrategy = e.target.value;
        window.selectedThresholdStrategy = newStrategy;
        
        // Update app state through centralized state management
        if (typeof updateAppState === 'function') {
            updateAppState({
                currentThresholdStrategy: newStrategy,
                isManualThresholdMode: newStrategy === 'manual'
            });
        }
        
        // Apply the selected strategy directly
        if (newStrategy !== 'manual') {
            applyThresholdStrategy(newStrategy);
        } else {
            // For manual strategy, just update the input box to current threshold
            updateThresholdInputForCurrentScale();
        }
        
        // Also trigger the main threshold strategy change handler for backend sync
        if (typeof handleThresholdStrategyChange === 'function') {
            handleThresholdStrategyChange();
        }
    });
    
    // Trigger threshold recalculation ONLY if not manual strategy - use NEW element
    if (newSelect.value !== 'manual') {
        // Apply strategy and update threshold input
        applyThresholdStrategy(newSelect.value);
    } else {
        // For manual strategy, just update the input box to current threshold
        updateThresholdInputForCurrentScale();
    }
}

/**
 * Apply threshold strategy and update threshold input box
 */
function applyThresholdStrategy(strategy) {
    
    const currentChannel = window.currentFluorophore;
    const currentScale = window.currentScaleMode;
    
    if (!currentChannel || currentChannel === 'all') {
        
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
            
            // Update threshold input box immediately
            const thresholdInput = document.getElementById('thresholdInput');
            if (thresholdInput) {
                thresholdInput.value = threshold.toFixed(2);
            }
        } else {
        }
    }
    
    // Update chart threshold lines
    if (window.updateAllChannelThresholds) {
        window.updateAllChannelThresholds();
    }
    
    // Force immediate CQJ and CalcJ recalculation for manual threshold changes
    if (window.forceCQJCalcJRecalculation) {
        window.forceCQJCalcJRecalculation({ updateWellSelector: false });
    } else if (window.recalculateCQJValues) {
        // Fallback to standard recalculation
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
    
    
    // Log summary for debugging
    Object.entries(window.channelControlWells).forEach(([channel, controls]) => {
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
    }, 500); // Small delay to ensure threshold_strategies.js is loaded
});

// End global exposure
