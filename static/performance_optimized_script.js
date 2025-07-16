// Performance Optimized Chart Update Manager
// This replaces multiple timeout delays with batched updates

class ChartUpdateManager {
    constructor() {
        this.pendingUpdates = new Set();
        this.updateTimeout = null;
        this.batchDelay = 50; // Reduced from 100-200ms to 50ms
    }

    // Batch chart updates to reduce frequency
    requestUpdate(updateType = 'none') {
        this.pendingUpdates.add(updateType);
        
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        
        this.updateTimeout = setTimeout(() => {
            this.executeUpdates();
        }, this.batchDelay);
    }

    executeUpdates() {
        if (!window.amplificationChart) return;
        
        // Determine the most comprehensive update needed
        const hasResize = this.pendingUpdates.has('resize');
        const updateType = hasResize ? 'resize' : 'none';
        
        console.log(`🚀 PERFORMANCE - Batched chart update (${updateType})`);
        window.amplificationChart.update(updateType);
        
        this.pendingUpdates.clear();
        this.updateTimeout = null;
    }

    // Force immediate update for critical operations
    forceUpdate(updateType = 'resize') {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }
        
        this.pendingUpdates.clear();
        
        if (window.amplificationChart) {
            console.log(`🚀 PERFORMANCE - Force chart update (${updateType})`);
            window.amplificationChart.update(updateType);
        }
    }
}

// Global chart update manager
window.chartUpdateManager = new ChartUpdateManager();

// Optimized threshold update function
function optimizedUpdateAllChannelThresholds() {
    // Prevent multiple simultaneous calls
    if (window.thresholdUpdateInProgress) {
        console.log('🚀 PERFORMANCE - Threshold update already in progress, skipping');
        return;
    }
    
    window.thresholdUpdateInProgress = true;
    
    try {
        // Execute the original threshold update logic
        if (window.originalUpdateAllChannelThresholds) {
            window.originalUpdateAllChannelThresholds();
        }
        
        // Request batched chart update instead of immediate
        window.chartUpdateManager.requestUpdate('none');
        
    } finally {
        // Release lock after a short delay
        setTimeout(() => {
            window.thresholdUpdateInProgress = false;
        }, 25);
    }
}

// Fix log scale toggle - ensure proper chart scale application
function fixedOnScaleToggle() {
    const newScale = (window.appState.currentScaleMode === 'linear') ? 'log' : 'linear';
    
    console.log(`🔍 TOGGLE - Switching from ${window.appState.currentScaleMode} to ${newScale} scale`);
    
    // Update button CSS immediately
    const toggleBtn = document.getElementById('scaleToggle');
    if (toggleBtn) {
        toggleBtn.setAttribute('data-scale', newScale);
        
        const options = toggleBtn.querySelectorAll('.toggle-option');
        if (options.length >= 2) {
            if (newScale === 'log') {
                options[0].classList.remove('active');
                options[1].classList.add('active');
            } else {
                options[0].classList.add('active');
                options[1].classList.remove('active');
            }
        }
    }
    
    // Use state management for scale changes
    updateAppState({ currentScaleMode: newScale });
    
    // CRITICAL: Update all scale mode variables immediately
    currentScaleMode = newScale;
    window.currentScaleMode = newScale;
    
    // CRITICAL: Force immediate chart scale update with proper configuration
    if (window.amplificationChart) {
        const newScaleConfig = getScaleConfiguration();
        
        // Ensure the chart options object exists
        if (!window.amplificationChart.options.scales) {
            window.amplificationChart.options.scales = {};
        }
        
        // Apply the new scale configuration
        window.amplificationChart.options.scales.y = newScaleConfig;
        
        // CRITICAL: Destroy and recreate the chart if logarithmic scale isn't applying
        if (newScale === 'log') {
            // Force logarithmic scale by destroying and recreating
            const chartData = window.amplificationChart.data;
            const chartOptions = window.amplificationChart.options;
            
            window.amplificationChart.destroy();
            
            // Recreate with logarithmic scale
            chartOptions.scales.y = newScaleConfig;
            window.amplificationChart = new Chart(
                document.getElementById('amplificationChart').getContext('2d'),
                {
                    type: 'line',
                    data: chartData,
                    options: chartOptions
                }
            );
            
            console.log(`🔍 TOGGLE - Recreated chart for ${newScale} scale`);
        } else {
            // For linear scale, regular update should work
            window.chartUpdateManager.forceUpdate('resize');
        }
    }
    
    // Save preference
    safeSetItem(sessionStorage, 'qpcr_chart_scale', newScale);
    
    // Update baseline toggle visibility
    updateBaselineFlatteningVisibility();
    
    // Update threshold strategy dropdown
    if (window.populateThresholdStrategyDropdown) {
        window.populateThresholdStrategyDropdown();
    }
}

// Debounced threshold input handler to reduce API calls
function createDebouncedThresholdHandler() {
    let debounceTimeout = null;
    
    return function(inputValue, channel) {
        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
        }
        
        debounceTimeout = setTimeout(() => {
            // Execute actual threshold update
            if (window.handleThresholdInput) {
                window.handleThresholdInput(inputValue, channel);
            }
        }, 300); // Wait 300ms after user stops typing
    };
}

// Optimized multichannel chart creation with reduced delays
function optimizedShowAllCurves() {
    console.log('🚀 PERFORMANCE - Starting optimized multichannel display');
    
    // Clear existing timeout if any
    if (window.multichannelTimeout) {
        clearTimeout(window.multichannelTimeout);
    }
    
    try {
        // Execute chart creation logic immediately
        if (window.originalShowAllCurves) {
            window.originalShowAllCurves();
        }
        
        // Reduced timeout from 200ms to 50ms for completion check
        window.multichannelTimeout = setTimeout(() => {
            console.log('🚀 PERFORMANCE - Multichannel display completed (optimized)');
            
            // Use batched update instead of immediate
            window.chartUpdateManager.requestUpdate('none');
            
            // Clear timeout reference
            window.multichannelTimeout = null;
        }, 50);
        
    } catch (error) {
        console.error('🚀 PERFORMANCE - Error in optimized multichannel display:', error);
        
        // Fallback to original implementation
        if (window.originalShowAllCurves) {
            window.originalShowAllCurves();
        }
    }
}

// Performance monitoring utilities
class PerformanceMonitor {
    constructor() {
        this.metrics = {};
        this.enabled = true; // Set to false in production
    }
    
    startTimer(name) {
        if (!this.enabled) return;
        this.metrics[name] = { start: performance.now() };
    }
    
    endTimer(name) {
        if (!this.enabled || !this.metrics[name]) return;
        
        const duration = performance.now() - this.metrics[name].start;
        this.metrics[name].duration = duration;
        
        if (duration > 100) { // Log operations taking more than 100ms
            console.warn(`🚀 PERFORMANCE - Slow operation: ${name} took ${duration.toFixed(2)}ms`);
        }
    }
    
    getMetrics() {
        return this.metrics;
    }
}

// Global performance monitor
window.performanceMonitor = new PerformanceMonitor();

// Export optimized functions
window.optimizedFunctions = {
    chartUpdateManager: window.chartUpdateManager,
    optimizedUpdateAllChannelThresholds,
    fixedOnScaleToggle,
    optimizedShowAllCurves,
    createDebouncedThresholdHandler,
    performanceMonitor: window.performanceMonitor
};

console.log('🚀 PERFORMANCE - Optimization utilities loaded');
