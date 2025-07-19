// qPCR Analysis Script - Main Interface Logic
// Ensure global analysis results variable is initialized
window.currentAnalysisResults = null;

// Global flag to prevent threshold conflicts during chart updates
window.chartUpdating = false;

// Global flag to prevent multiple simultaneous chart initializations
window.chartInitializing = false;

// ========================================
// EXPORT BUTTON STATE MANAGEMENT
// ========================================

// Central function to update export button state
function updateExportState(options = {}) {
    const {
        hasAnalysisResults = null,
        isSessionLoaded = null,
        hasIncompleteTests = null,
        incompleteTestsInfo = []
    } = options;
    
    const currentState = window.appState.exportState;
    
    // Update provided values
    if (hasAnalysisResults !== null) currentState.hasAnalysisResults = hasAnalysisResults;
    if (isSessionLoaded !== null) currentState.isSessionLoaded = isSessionLoaded;
    if (hasIncompleteTests !== null) currentState.hasIncompleteTests = hasIncompleteTests;
    
    // Determine export state based on analysis results and session state
    let isEnabled = false;
    let disabledReason = '';
    let buttonText = 'Export Results';
    
    // Check if we have analysis results loaded
    const hasResults = currentState.hasAnalysisResults || 
                      (window.currentAnalysisResults && 
                       window.currentAnalysisResults.individual_results && 
                       Object.keys(window.currentAnalysisResults.individual_results).length > 0);
    
    if (!hasResults) {
        isEnabled = false;
        disabledReason = 'Load an analysis session first to enable export';
        buttonText = 'Export Disabled';
    } else {
        // We have results - check if it's a loaded session or fresh analysis
        const isLoadedSession = currentState.isSessionLoaded || 
                               !window.amplificationFiles || 
                               Object.keys(window.amplificationFiles).length === 0;
        
        if (isLoadedSession) {
            // Loaded session - always enable export
            isEnabled = true;
            disabledReason = '';
            buttonText = 'Export Results';
        } else {
            // Fresh analysis - check for pattern validation
            const currentPattern = typeof getCurrentFullPattern === 'function' ? getCurrentFullPattern() : null;
            
            if (!currentPattern) {
                // No pattern means fresh analysis - allow export
                isEnabled = true;
                disabledReason = '';
                buttonText = 'Export Results';
            } else {
                // Check if experiment is complete according to pathogen library
                const testCode = typeof extractTestCode === 'function' ? extractTestCode(currentPattern) : null;
                
                if (!testCode || 
                    typeof getRequiredChannels !== 'function' || 
                    typeof PATHOGEN_LIBRARY === 'undefined') {
                    // Cannot determine test requirements - allow export
                    isEnabled = true;
                    disabledReason = '';
                    buttonText = 'Export Results';
                } else {
                    // Validate channel completeness
                    if (currentState.hasIncompleteTests) {
                        isEnabled = false;
                        disabledReason = 'Complete all required pathogen channels before exporting results';
                        buttonText = 'Export Disabled';
                    } else {
                        isEnabled = true;
                        disabledReason = '';
                        buttonText = 'Export Results';
                    }
                }
            }
        }
    }
    
    // Update state
    const newExportState = {
        ...currentState,
        isEnabled,
        disabledReason,
        buttonText,
        hasAnalysisResults: hasResults
    };
    
    // console.log('🔄 EXPORT STATE - Updating:', {
        // hasResults,
        // isLoadedSession: currentState.isSessionLoaded,
        // hasIncompleteTests: currentState.hasIncompleteTests,
        // isEnabled,
        // buttonText
    // });
    
    // Update through central state management
    updateAppState({ exportState: newExportState });
}

// ========================================
// Uses threshold_strategies.js for threshold calculations
// All threshold strategies should be defined in threshold_strategies.js

// CQJ/CALCJ FUNCTIONS MOVED TO cqj_calcj_utils.js
// Function calculateThresholdCrossing moved to cqj_calcj_utils.js

// ========================================
// CENTRALIZED STATE MANAGEMENT SYSTEM
// ========================================

// Global application state - single source of truth
window.appState = {
    currentFluorophore: 'all',
    currentScaleMode: 'linear',
    currentChartMode: 'all',          // 'all', 'pos', 'neg', 'redo' - controls both chart and table view
    currentWellSelection: 'ALL_WELLS',
    currentFilter: 'all',             // Table filter: 'all', 'POS', 'NEG', 'REDO'
    currentSearchTerm: '',            // Table search term
    currentSort: 'wellId',            // Table sort: 'wellId', 'sample', 'fluorophore', 'cq', 'results'
    sortDirection: 'asc',             // Sort direction: 'asc' or 'desc'
    currentSortOrder: 'default',      // Legacy sort order
    thresholds: {},
    manualThresholds: {},
    currentThresholdStrategy: 'default',     // Current threshold strategy (start with default)
    currentThresholdValue: null,      // Current manual threshold value
    isManualThresholdMode: false,     // Whether user is in manual threshold mode
    exportState: {                    // Export button state management
        isEnabled: false,             // Whether export is enabled
        hasAnalysisResults: false,    // Whether we have analysis results to export
        isSessionLoaded: false,       // Whether we have a loaded session
        hasIncompleteTests: false,    // Whether there are incomplete tests
        disabledReason: '',           // Reason why export is disabled
        buttonText: 'Export Results'  // Current button text
    },
    isUpdating: false
};

// State update function that coordinates all UI elements
function updateAppState(newState) {
    if (window.appState.isUpdating) {
        // console.log('🔄 STATE - Update already in progress, skipping');
        return;
    }
    
    window.appState.isUpdating = true;
    // console.log('🔄 STATE - Updating application state:', newState);
    
    // Update state
    Object.assign(window.appState, newState);
    
    // Sync global variables for backward compatibility
    window.currentFluorophore = window.appState.currentFluorophore;
    window.currentScaleMode = window.appState.currentScaleMode;
    currentScaleMode = window.appState.currentScaleMode;
    
    // Update all UI elements to match new state
    syncUIElements();
    
    // Update chart and table
    updateDisplays();
    
    // Update thresholds
    setTimeout(() => {
        if (window.updateAllChannelThresholds) {
            // Force threshold update even if chart is busy
            const wasChartUpdating = window.chartUpdating;
            window.chartUpdating = false; // Temporarily clear flag
            window.updateAllChannelThresholds();
            window.chartUpdating = wasChartUpdating; // Restore flag
        }
        
        // Update threshold strategy dropdown if threshold strategy changed
        if (window.populateThresholdStrategyDropdown && window.appState.currentThresholdStrategy) {
            window.populateThresholdStrategyDropdown();
        }
        
        // Update threshold input for current fluorophore/scale
        updateThresholdInputFromState();
        
        window.appState.isUpdating = false;
    }, 100);
}

// Sync all UI elements to current state
function syncUIElements() {
    const state = window.appState;
    
    // Sync fluorophore selector
    const fluorophoreSelect = document.getElementById('fluorophoreSelect');
    if (fluorophoreSelect && fluorophoreSelect.value !== state.currentFluorophore) {
        fluorophoreSelect.value = state.currentFluorophore;
    }
    
    // Sync well selector
    const wellSelect = document.getElementById('wellSelect');
    if (wellSelect && wellSelect.value !== state.currentWellSelection) {
        wellSelect.value = state.currentWellSelection;
    }
    
    // Sync scale toggle
    const toggleBtn = document.getElementById('toggleScaleBtn');
    if (toggleBtn) {
        if (state.currentScaleMode === 'log') {
            toggleBtn.classList.add('log-scale');
            toggleBtn.textContent = 'Log Scale';
        } else {
            toggleBtn.classList.remove('log-scale');
            toggleBtn.textContent = 'Linear Scale';
        }
    }
    
    // Sync view buttons (POS/NEG/ALL/REDO controls)
    const buttons = document.querySelectorAll('.view-controls .control-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // Map chart modes to button IDs
    const buttonMapping = {
        'all': 'showAllBtn',
        'pos': 'showPosBtn', 
        'neg': 'showNegBtn',
        'redo': 'showRedoBtn'
    };
    
    const activeBtn = document.getElementById(buttonMapping[state.currentChartMode]);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Sync table filter dropdown if it exists
    const tableFilter = document.getElementById('tableFilter');
    if (tableFilter && tableFilter.value !== state.currentFilter) {
        tableFilter.value = state.currentFilter;
    }
    
    // Sync search input if it exists
    const searchWells = document.getElementById('searchWells');
    if (searchWells && searchWells.value !== state.currentSearchTerm) {
        // Only update if the input doesn't have focus (to avoid interrupting user typing)
        if (document.activeElement !== searchWells) {
            searchWells.value = state.currentSearchTerm;
        }
    }
    
    // Sync sort controls if they exist
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect && sortSelect.value !== state.currentSort) {
        sortSelect.value = state.currentSort;
    }
    
    const sortDirectionBtn = document.getElementById('sortDirection');
    if (sortDirectionBtn) {
        sortDirectionBtn.textContent = state.sortDirection === 'asc' ? '↑' : '↓';
        sortDirectionBtn.dataset.direction = state.sortDirection;
    }
    
    // Sync threshold controls - only if dropdown has options
    const thresholdStrategySelect = document.getElementById('thresholdStrategySelect');
    if (thresholdStrategySelect && thresholdStrategySelect.options.length > 0 && thresholdStrategySelect.value !== state.currentThresholdStrategy) {
        thresholdStrategySelect.value = state.currentThresholdStrategy;
    }
    
    const thresholdInput = document.getElementById('thresholdInput');
    if (thresholdInput && state.currentThresholdValue !== null) {
        // Only update if the input doesn't have focus (to avoid interrupting user typing)
        if (document.activeElement !== thresholdInput) {
            thresholdInput.value = state.currentThresholdValue.toFixed(2);
        }
    }
    
    // Sync auto button state
    const autoBtn = document.getElementById('autoThresholdBtn');
    if (autoBtn) {
        if (state.isManualThresholdMode) {
            autoBtn.classList.remove('active');
            autoBtn.textContent = 'Auto';
        } else {
            autoBtn.classList.add('active');
            autoBtn.textContent = 'Auto';
        }
    }
    
    // Sync filter status dropdown
    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus && filterStatus.value !== state.currentFilter) {
        filterStatus.value = state.currentFilter;
        // console.log('🔄 STATE - Synced filterStatus dropdown to:', state.currentFilter);
    }
    
    // Sync export button state
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.disabled = !state.exportState.isEnabled;
        exportBtn.style.opacity = state.exportState.isEnabled ? '1' : '0.5';
        exportBtn.style.cursor = state.exportState.isEnabled ? 'pointer' : 'not-allowed';
        exportBtn.title = state.exportState.isEnabled ? 'Export analysis results to CSV' : state.exportState.disabledReason;
        exportBtn.textContent = state.exportState.buttonText;
    }
    
    // console.log('🔄 STATE - UI elements synchronized');
}

// Update chart and table displays
function updateDisplays() {
    const state = window.appState;
    
    // Handle scale changes - update chart scale configuration
    if (window.amplificationChart && state.currentScaleMode !== currentScaleMode) {
        currentScaleMode = state.currentScaleMode;
        window.currentScaleMode = currentScaleMode;
        
        // CRITICAL: Update scale toggle button CSS immediately
        const toggleBtn = document.getElementById('scaleToggle');
        if (toggleBtn) {
            toggleBtn.setAttribute('data-scale', currentScaleMode);
            const options = toggleBtn.querySelectorAll('.toggle-option');
            if (options.length >= 2) {
                if (currentScaleMode === 'log') {
                    options[0].classList.remove('active'); // Linear
                    options[1].classList.add('active');    // Log
                } else {
                    options[0].classList.add('active');    // Linear
                    options[1].classList.remove('active'); // Log
                }
            }
            // console.log(`🔄 SCALE-CSS - Updated button CSS for ${currentScaleMode} scale`);
        }
        
        const newScaleConfig = getScaleConfiguration();
        window.amplificationChart.options.scales.y = newScaleConfig;
        window.amplificationChart.update('none');
        
        // Update baseline toggle visibility for both modes
        updateBaselineFlatteningVisibility();
        
        // Update threshold strategy dropdown for new scale (preserving current selection)
        if (typeof window.populateThresholdStrategyDropdown === 'function') {
            const currentStrategy = window.selectedThresholdStrategy || getSelectedThresholdStrategy();
            window.populateThresholdStrategyDropdown();
            // Restore the selected strategy after repopulation
            if (currentStrategy) {
                const dropdown = document.getElementById('thresholdStrategySelect');
                if (dropdown && dropdown.options) {
                    for (let i = 0; i < dropdown.options.length; i++) {
                        if (dropdown.options[i].value === currentStrategy) {
                            dropdown.value = currentStrategy;
                            window.selectedThresholdStrategy = currentStrategy;
                            // console.log(`🔄 SCALE-TOGGLE - Preserved threshold strategy: ${currentStrategy}`);
                            break;
                        }
                    }
                }
            }
        }
        
        // Update baseline flattening visibility (only show on linear)
        updateBaselineFlatteningVisibility();
    }
    
    // Update chart based on current state - only if analysis results are available
    // SKIP chart recreation if we're just updating thresholds OR if chart already exists
    if (window.currentAnalysisResults && window.currentAnalysisResults.individual_results && 
        !window.chartInitializing && !window.chartUpdating && !window.amplificationChart) {
        console.log('🔍 CHART-CREATION - Creating initial chart');
        if (state.currentChartMode === 'all') {
            showAllCurves(state.currentFluorophore);
        } else if (state.currentChartMode === 'pos') {
            showGoodCurves(state.currentFluorophore);
        } else if (state.currentChartMode === 'neg') {
            showResultsFiltered(state.currentFluorophore, 'neg');
        } else if (state.currentChartMode === 'redo') {
            showResultsFiltered(state.currentFluorophore, 'redo');
        }
    } else {
        // console.log('🔄 CHART-LOADING - Skipping chart recreation - chart exists or conditions not met');
    }
    
    // Update table filter
    if (window.currentAnalysisResults && typeof populateResultsTable === 'function') {
        let filteredResults = window.currentAnalysisResults.individual_results;
        
        // Safety check for filteredResults
        if (!filteredResults) {
            // console.warn('[DIAG] No individual_results available in currentAnalysisResults');
            return;
        }
        
        // Filter by fluorophore
        if (state.currentFluorophore !== 'all') {
            filteredResults = Object.fromEntries(
                Object.entries(filteredResults).filter(([key, well]) => 
                    well.fluorophore === state.currentFluorophore
                )
            );
        }
        
        populateResultsTable(filteredResults);
    }
    
    // Update well dropdown only if analysis data is available
    if (typeof filterWellsByFluorophore === 'function' && 
        (window.currentAnalysisResults?.individual_results || currentAnalysisResults?.individual_results)) {
        filterWellsByFluorophore(state.currentFluorophore);
    }
    
    // console.log('🔄 STATE - Displays updated');
}

// Update threshold input from current state
function updateThresholdInputFromState() {
    const state = window.appState;
    const thresholdInput = document.getElementById('thresholdInput');
    
    if (!thresholdInput) return;
    
    let channel = state.currentFluorophore;
    if (!channel || channel === 'all') {
        // Default to first available channel
        if (window.stableChannelThresholds) {
            const channels = Object.keys(window.stableChannelThresholds);
            channel = channels.length > 0 ? channels[0] : 'FAM';
        } else {
            channel = 'FAM';
        }
    }
    
    // Get current threshold value for this channel/scale
    if (window.stableChannelThresholds && 
        window.stableChannelThresholds[channel] && 
        window.stableChannelThresholds[channel][state.currentScaleMode] !== undefined) {
        
        const thresholdValue = window.stableChannelThresholds[channel][state.currentScaleMode];
        
        // Update state and input (only if input doesn't have focus)
        if (document.activeElement !== thresholdInput) {
            updateAppState({
                currentThresholdValue: thresholdValue,
                isManualThresholdMode: window.manualThresholds && 
                                      window.manualThresholds[channel] && 
                                      window.manualThresholds[channel][state.currentScaleMode]
            });
        }
    }
    
    // console.log('🔄 STATE - Threshold input updated from state');
}

// Initialize state management
function initializeStateManagement() {
    // Load saved state from session storage
    const savedScale = sessionStorage.getItem('chartScale');
    if (savedScale) {
        window.appState.currentScaleMode = savedScale;
        window.currentScaleMode = savedScale;
        currentScaleMode = savedScale;
    }
    
    // Initialize threshold event handlers
    initializeThresholdStateHandlers();
    
    // console.log('🔄 STATE - State management initialized');
}

// Initialize threshold control event handlers for state management
function initializeThresholdStateHandlers() {
    // Threshold strategy dropdown
    const thresholdStrategySelect = document.getElementById('thresholdStrategySelect');
    if (thresholdStrategySelect) {
        thresholdStrategySelect.addEventListener('change', function() {
            const newStrategy = this.value;
            // console.log('🔄 STATE - Threshold strategy changed:', newStrategy);
            
            updateAppState({
                currentThresholdStrategy: newStrategy,
                isManualThresholdMode: newStrategy === 'manual'
            });
            
            // Trigger threshold recalculation
            if (typeof handleThresholdStrategyChange === 'function') {
                handleThresholdStrategyChange();
            }
        });
    }
    
    // Manual threshold input
    const thresholdInput = document.getElementById('thresholdInput');
    if (thresholdInput) {
        // Handle input changes
        thresholdInput.addEventListener('input', function() {
            const value = parseFloat(this.value);
            if (!isNaN(value) && value > 0) {
                updateAppState({
                    currentThresholdValue: value,
                    isManualThresholdMode: true,
                    currentThresholdStrategy: 'manual'
                });
            }
        });
        
        // Handle when user finishes entering value
        thresholdInput.addEventListener('change', function() {
            const value = parseFloat(this.value);
            if (!isNaN(value) && value > 0) {
                // Apply manual threshold
                if (typeof applyManualThreshold === 'function') {
                    applyManualThreshold(value);
                } else if (window.setChannelThreshold) {
                    const channel = window.appState.currentFluorophore !== 'all' ? 
                                   window.appState.currentFluorophore : 'FAM';
                    window.setChannelThreshold(channel, window.appState.currentScaleMode, value);
                }
                
                // console.log('🔄 STATE - Manual threshold applied:', value);
            }
        });
    }
    
    // Auto threshold button
    const autoBtn = document.getElementById('autoThresholdBtn');
    if (autoBtn) {
        autoBtn.addEventListener('click', function() {
            // console.log('🔄 STATE - Auto threshold button clicked');
            
            updateAppState({
                isManualThresholdMode: false,
                currentThresholdStrategy: window.appState.currentScaleMode === 'log' ? 'log_fixed' : 'linear_fixed'
            });
            
            // Restore auto threshold
            if (typeof restoreAutoThreshold === 'function') {
                restoreAutoThreshold();
            } else if (typeof handleThresholdStrategyChange === 'function') {
                handleThresholdStrategyChange();
            }
        });
    }
    
    // console.log('🔄 STATE - Threshold state handlers initialized');
}

// Debug: Check if CQJ/CalcJ functions are available
document.addEventListener('DOMContentLoaded', function() {
    // console.log('[CQJ-DEBUG] Checking function availability:', {
        // calculateThreshold: typeof window.calculateThreshold,
        // PATHOGEN_FIXED_THRESHOLDS: typeof window.PATHOGEN_FIXED_THRESHOLDS,
        // LINEAR_THRESHOLD_STRATEGIES: typeof window.LINEAR_THRESHOLD_STRATEGIES,
        // LOG_THRESHOLD_STRATEGIES: typeof window.LOG_THRESHOLD_STRATEGIES
    // });
    
    if (typeof window.calculateThreshold !== 'function') {
        // console.error('[THRESHOLD-DEBUG] ERROR: window.calculateThreshold is not available!');
    }
    if (typeof window.PATHOGEN_FIXED_THRESHOLDS !== 'object') {
        // console.error('[THRESHOLD-DEBUG] ERROR: window.PATHOGEN_FIXED_THRESHOLDS is not available!');
    } else {
        // console.log('[THRESHOLD-DEBUG] Available pathogens in PATHOGEN_FIXED_THRESHOLDS:', Object.keys(window.PATHOGEN_FIXED_THRESHOLDS));
    }
    
    // Force update scale toggle state to ensure correct visual appearance
    setTimeout(() => {
        if (typeof forceUpdateScaleToggleState === 'function') {
            forceUpdateScaleToggleState();
        }
    }, 100);
});

// --- Shared strict result classification for NEG/POS/REDO ---

// Remove any import/export statements for browser compatibility
// All dependencies should be accessed via window, e.g., window.calculateThreshold

/**
 * Safely set item in localStorage or sessionStorage, handling quota errors.
 * @param {Storage} storage - localStorage or sessionStorage
 * @param {string} key
 * @param {string} value
 * @param {object} [options] - { historyTrimFn: function to trim history if needed, maxRetries: number }
 */
function safeSetItem(storage, key, value, options = {}) {
    const { historyTrimFn, maxRetries = 1 } = options;
    let attempts = 0;
    while (attempts <= maxRetries) {
        try {
            storage.setItem(key, value);
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                // console.warn('Storage quota exceeded for', key, 'Attempt:', attempts + 1);
                // Try to trim history if function provided
                if (historyTrimFn && typeof historyTrimFn === 'function') {
                    historyTrimFn();
                } else {
                    // Otherwise, clear all storage
                    storage.clear();
                }
                attempts++;
            } else {
                throw e;
            }
        }
    }
    alert('Unable to save data: browser storage is full. Some features may not work.');
    return false;
}

function classifyResult(wellData) {
    const amplitude = wellData.amplitude || 0;
    const isGoodSCurve = wellData.is_good_scurve || false;
    let hasAnomalies = false;
    if (wellData.anomalies) {
        try {
            const anomalies = typeof wellData.anomalies === 'string' ? 
                JSON.parse(wellData.anomalies) : wellData.anomalies;
            hasAnomalies = Array.isArray(anomalies) && anomalies.length > 0 && 
                          !(anomalies.length === 1 && anomalies[0] === 'None');
        } catch (e) {
            hasAnomalies = true;
        }
    }
    const cqValue = wellData.cq_value;
    if (amplitude < 400 || !isGoodSCurve || isNaN(Number(cqValue))) {
        return 'NEG';
    } else if (isGoodSCurve && amplitude > 500 && !hasAnomalies) {
        return 'POS';
    } else {
        return 'REDO';
    }
}


// Expose globally for use in other scripts
window.classifyResult = classifyResult;
// --- Chart.js Annotation Plugin Registration (robust, before chart creation) ---
function ensureAnnotationPluginRegistered() {
    if (window.Chart && window['chartjs-plugin-annotation']) {
        let alreadyRegistered = false;
        // Chart.js v3/v4: registry.plugins.items or registry.plugins._items (UMD/minified)
        if (Chart.registry && Chart.registry.plugins) {
            const items = Chart.registry.plugins.items || Chart.registry.plugins._items || [];
            alreadyRegistered = Array.isArray(items) && items.some(p => p && p.id === 'annotation');
        } else if (Chart._plugins) {
            // Chart.js 2.x fallback
            alreadyRegistered = Object.values(Chart._plugins).some(p => p && p.id === 'annotation');
        }
        if (!alreadyRegistered) {
            Chart.register(window['chartjs-plugin-annotation']);
            // console.log('[DIAG] Chart annotation plugin registered for Chart.js');
        } else {
            // console.log('[DIAG] Chart annotation plugin already registered');
        }
    } else {
        // console.warn('[DIAG] Chart.js or annotation plugin not found on window');
    }
}

// Call this BEFORE any chart is created
ensureAnnotationPluginRegistered();


        
// Add this near your other globals:
if (!window.userSetThresholds) window.userSetThresholds = {}; // { channel: { scale: value } }

// THRESHOLD FUNCTIONS MOVED TO threshold_frontend.js
// All threshold-related functions are now centralized in threshold_frontend.js
// === DIAGNOSTICS FOR THRESHOLD/UI/CHART FEATURES ===
(function diagnostics() {
    // Check Chart.js annotation plugin registration
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            if (window.Chart && window.Chart.registry) {
                const plugins = window.Chart.registry.plugins ? Object.keys(window.Chart.registry.plugins) : Object.keys(window.Chart.plugins || {});
                // console.log('[DIAG] Chart.js plugins registered:', plugins);
            } else {
                // console.warn('[DIAG] Chart.js registry not found');
            }
            if (window.amplificationChart) {
                const ann = window.amplificationChart.options?.plugins?.annotation;
                if (ann) {
                    // console.log('[DIAG] Chart annotation plugin options found:', ann);
                } else {
                    // console.warn('[DIAG] Chart annotation plugin options NOT found');
                }
            } else {
                // console.warn('[DIAG] amplificationChart not found');
            }
        }, 1000);
    });

    // Check DOM elements
    document.addEventListener('DOMContentLoaded', function() {
        const ids = ['thresholdInput', 'autoThresholdBtn', 'wellSelect', 'fluorophoreSelect'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                // console.log(`[DIAG] DOM element #${id} found`);
            } else {
                // console.warn(`[DIAG] DOM element #${id} NOT found`);
            }
        });
    });

    // Patch and log key function calls
    function logWrap(fn, name) {
        return function() {
            // console.log(`[DIAG] ${name} called`, arguments);
            try {
                return fn.apply(this, arguments);
            } catch (e) {
                // console.error(`[DIAG] Error in ${name}:`, e);
            }
        };
    }
    if (typeof updateAllChannelThresholds === 'function') {
        window.updateAllChannelThresholds = logWrap(updateAllChannelThresholds, 'updateAllChannelThresholds');
    }
    if (typeof updateChartThresholds === 'function') {
        window.updateChartThresholds = logWrap(updateChartThresholds, 'updateChartThresholds');
    }
    if (typeof setChartMode === 'function') {
        window.setChartMode = logWrap(setChartMode, 'setChartMode');
    }
    if (typeof restoreAutoThreshold === 'function') {
        window.restoreAutoThreshold = logWrap(restoreAutoThreshold, 'restoreAutoThreshold');
    }
    // if (typeof enableDraggableThresholds === 'function') {
    //     window.enableDraggableThresholds = logWrap(enableDraggableThresholds, 'enableDraggableThresholds');
    // } // DISABLED - Will use test.html implementation
    if (typeof defineDraggableThresholds === 'function') {
        window.defineDraggableThresholds = logWrap(defineDraggableThresholds, 'defineDraggableThresholds');
    }
    if (typeof enforceShowAllWellsView === 'function') {
        window.enforceShowAllWellsView = logWrap(enforceShowAllWellsView, 'enforceShowAllWellsView');
    }
    // Log errors globally
    window.addEventListener('error', function(e) {
        // console.error('[DIAG] Global error:', e.message, e);
    });
    window.addEventListener('unhandledrejection', function(e) {
        // console.error('[DIAG] Unhandled promise rejection:', e.reason);
    });
})();
// === END DIAGNOSTICS ===

// --- Thresholds ---
// Store per-channel, per-scale thresholds: { [channel]: { linear: value, log: value } }
// Removed duplicate declaration of channelThresholds
// Store current scale mode: 'linear' or 'log'
let currentScaleMode = 'linear';
window.currentScaleMode = currentScaleMode;  // Ensure window variable is accessible globally
// Store current scale multiplier (slider value) - affects chart view only, not threshold values
let currentScaleMultiplier = 1.0;

// Initialize global visible channels tracking for multichannel support
if (!window.visibleChannels) {
    window.visibleChannels = new Set();
}

// Function to get current scale mode
function getCurrentScaleMode() {
    return currentScaleMode;
}

// ========================================
// CFX MANAGER STYLE BASELINE FLATTENING
// ========================================

let baselineFlatteningEnabled = false;

/**
 * Calculate baseline statistics for cycles 1-5
 */
function calculateBaseline(wellData) {
    if (!wellData.raw_data || wellData.raw_data.length < 5) {
        return null;
    }
    
    // Extract RFU values from cycles 1-5
    const earlyCycles = wellData.raw_data.slice(0, 5);
    const baselineValues = earlyCycles.map(cycle => cycle.y);
    
    // Calculate baseline statistics
    const mean = baselineValues.reduce((sum, val) => sum + val, 0) / baselineValues.length;
    const sorted = baselineValues.slice().sort((a, b) => a - b);
    const median = sorted.length % 2 === 0 
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
    
    // Calculate standard deviation
    const variance = baselineValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / baselineValues.length;
    const stdDev = Math.sqrt(variance);
    
    return { mean, median, stdDev, values: baselineValues };
}

/**
 * Apply baseline flattening to RFU data (CFX Manager 3.1 style)
 * Only flattens non-S-curve wells (negative/control wells) while preserving S-curves
 */
function applyBaselineFlattening(rawData, enableFlattening = false, wellData = null) {
    if (!enableFlattening || !rawData || rawData.length < 10) {
        return rawData;
    }
    
    // Use backend S-curve detection if available, otherwise fallback to local detection
    let isSCurve = false;
    if (wellData && wellData.is_good_scurve !== undefined) {
        isSCurve = wellData.is_good_scurve;
        // console.log(`🔍 BASELINE - Using backend S-curve detection: ${isSCurve ? 'S-curve' : 'non-S-curve'}`);
    } else {
        // Fallback to local detection if backend data not available
        isSCurve = detectSCurve(rawData);
        // console.log(`🔍 BASELINE - Using local S-curve detection: ${isSCurve ? 'S-curve' : 'non-S-curve'}`);
    }
    
    if (isSCurve) {
        // This is a positive S-curve - DO NOT flatten, return original data
        // console.log('🔍 BASELINE - S-curve detected, preserving original curve shape');
        return rawData;
    }
    
    // This is a flat/negative curve - apply baseline flattening
    // console.log('🔍 BASELINE - Non-S-curve detected, applying baseline flattening');
    
    const baseline = calculateBaseline({ raw_data: rawData });
    if (!baseline) return rawData;
    
    // For non-S-curves, flatten to a consistent baseline level
    const targetBaseline = baseline.median; // Use median as target flat level
    
    const flattenedData = rawData.map((point, index) => {
        // Apply aggressive flattening to the entire curve for non-S-curves
        const flattenedValue = applyNonSCurveFlattening(point.y, targetBaseline, baseline);
        return { x: point.x, y: flattenedValue };
    });
    
    return flattenedData;
}

/**
 * Detect if a curve is an S-curve (positive amplification) or flat curve (negative)
 * More sensitive detection to properly preserve amplification curves
 */
function detectSCurve(rawData) {
    if (!rawData || rawData.length < 10) return false;
    
    // Get RFU values
    const rfuValues = rawData.map(point => point.y);
    
    // Calculate basic statistics
    const minRFU = Math.min(...rfuValues);
    const maxRFU = Math.max(...rfuValues);
    const meanRFU = rfuValues.reduce((sum, val) => sum + val, 0) / rfuValues.length;
    
    // 1. Check for significant amplitude (more permissive threshold)
    const amplitude = maxRFU - minRFU;
    const relativeAmplitude = amplitude / meanRFU;
    
    // Lower thresholds to catch more potential S-curves
    if (amplitude < 50 && relativeAmplitude < 0.2) {
        // Very small amplitude suggests flat curve
        return false;
    }
    
    // 2. Check for exponential growth pattern (more sensitive)
    const firstThird = rfuValues.slice(0, Math.floor(rfuValues.length / 3));
    const lastThird = rfuValues.slice(-Math.floor(rfuValues.length / 3));
    
    const firstThirdMean = firstThird.reduce((sum, val) => sum + val, 0) / firstThird.length;
    const lastThirdMean = lastThird.reduce((sum, val) => sum + val, 0) / lastThird.length;
    
    const growthRatio = lastThirdMean / firstThirdMean;
    
    // More permissive growth detection
    if (growthRatio < 1.2) {
        // Check for any sustained upward trend as backup
        let consecutiveIncreases = 0;
        let maxConsecutiveIncreases = 0;
        
        for (let i = 1; i < rfuValues.length; i++) {
            if (rfuValues[i] > rfuValues[i - 1]) {
                consecutiveIncreases++;
                maxConsecutiveIncreases = Math.max(maxConsecutiveIncreases, consecutiveIncreases);
            } else {
                consecutiveIncreases = 0;
            }
        }
        
        // If we have sustained growth for at least 25% of the curve, it might be an S-curve
        if (maxConsecutiveIncreases < rfuValues.length * 0.25) {
            return false;
        }
    }
    
    // 3. Check for overall positive trend
    const startValue = rfuValues[0];
    const endValue = rfuValues[rfuValues.length - 1];
    const overallGrowth = (endValue - startValue) / startValue;
    
    // If there's any meaningful overall growth (>20%), consider it potentially an S-curve
    if (overallGrowth > 0.2 || amplitude > 100) {
        // console.log(`🔍 S-CURVE DETECTION - Amplitude: ${amplitude.toFixed(2)}, Growth Ratio: ${growthRatio.toFixed(2)}, Overall Growth: ${(overallGrowth * 100).toFixed(1)}% → S-CURVE DETECTED`);
        return true;
    }
    
    // console.log(`🔍 S-CURVE DETECTION - Amplitude: ${amplitude.toFixed(2)}, Growth Ratio: ${growthRatio.toFixed(2)}, Overall Growth: ${(overallGrowth * 100).toFixed(1)}% → FLAT CURVE`);
    return false;
}

/**
 * Apply flattening specifically to non-S-curve wells (CFX Manager 3.1 style)
 * Make flat curves more visible on linear scale by reducing noise while preserving baseline level
 */
function applyNonSCurveFlattening(rfuValue, targetBaseline, baseline) {
    // For non-S-curves, gently flatten noise while keeping curves visible on linear scale
    const noiseThreshold = baseline.stdDev * 2; // Use standard deviation for noise detection
    
    if (Math.abs(rfuValue - baseline.mean) > noiseThreshold) {
        // Apply moderate flattening for noisy values - reduce to baseline range
        const direction = rfuValue > baseline.mean ? 1 : -1;
        return baseline.mean + (direction * baseline.stdDev * 0.5); // Keep small variation for visibility
    } else {
        // Apply light smoothing for values near baseline - preserve most of the signal
        return targetBaseline + ((rfuValue - targetBaseline) * 0.7); // 30% reduction, keeping curve visible
    }
}

/**
 * Baseline smoothing algorithm (CFX Manager style)
 */
function smoothBaseline(rfuValue, baseline) {
    // Apply weighted smoothing based on baseline statistics
    const noiseThreshold = baseline.mean + (2 * baseline.stdDev);
    
    if (rfuValue <= noiseThreshold) {
        // Apply aggressive smoothing to noise region
        return applyLowPassFilter(rfuValue, baseline.median);
    } else {
        // Light smoothing to preserve early amplification signals
        return applyMinimalSmoothing(rfuValue, baseline.mean);
    }
}

/**
 * Low pass filter for noise reduction
 */
function applyLowPassFilter(value, median) {
    // Weighted average favoring median for noise reduction
    return (value * 0.3) + (median * 0.7);
}

/**
 * Minimal smoothing to preserve signals
 */
function applyMinimalSmoothing(value, mean) {
    // Light smoothing that preserves signal characteristics
    return (value * 0.8) + (mean * 0.2);
}

/**
 * Toggle baseline flattening on/off (CFX Manager 3.1 style)
 */
function toggleBaselineFlattening() {
    baselineFlatteningEnabled = !baselineFlatteningEnabled;
    
    const toggleBtn = document.getElementById('baselineToggle');
    if (toggleBtn) {
        toggleBtn.dataset.enabled = baselineFlatteningEnabled.toString();
        const options = toggleBtn.querySelectorAll('.toggle-option');
        options.forEach((option, index) => {
            option.classList.toggle('active', index === (baselineFlatteningEnabled ? 1 : 0));
        });
    }
    
    // Save preference
    safeSetItem(sessionStorage, 'baselineFlatteningEnabled', baselineFlatteningEnabled.toString());
    
    // Update chart with new baseline settings
    if (window.amplificationChart) {
        refreshChartWithBaseline();
    }
    
    const status = baselineFlatteningEnabled ? 'enabled' : 'disabled';
    const description = baselineFlatteningEnabled 
        ? 'Non-S-curves will be flattened, S-curves preserved' 
        : 'All curves shown with original data';
    
    // console.log(`🔍 BASELINE - CFX Manager 3.1 style baseline correction ${status}: ${description}`);
}

/**
 * Refresh chart with baseline flattening applied (CFX Manager 3.1 style)
 * Only flattens non-S-curve wells while preserving positive amplification curves
 */
function refreshChartWithBaseline() {
if (!window.amplificationChart || !window.currentAnalysisResults) return;
    
    // Get current chart datasets
    const datasets = window.amplificationChart.data.datasets;
    if (!datasets || datasets.length === 0) return;
    
    let processedCurves = 0;
    let flattenedCurves = 0;
    let preservedSCurves = 0;
    
    // Apply baseline flattening to each dataset
    datasets.forEach(dataset => {
        if (dataset.label && dataset.originalData) {
            // Use original data if available, otherwise current data
            const originalData = dataset.originalData || dataset.data;
            
            // Store original data for future use if not already stored
            if (!dataset.originalData) {
                dataset.originalData = [...dataset.data];
            }
            
            // Extract well key from dataset label to get backend S-curve data
            let wellData = null;
            if (window.currentAnalysisResults && window.currentAnalysisResults.individual_results) {
                // Try to find matching well data for this dataset
                const wellKey = Object.keys(window.currentAnalysisResults.individual_results).find(key => {
                    const result = window.currentAnalysisResults.individual_results[key];
                    // Match by well ID and fluorophore in the dataset label
                    if (dataset.label.includes(result.well_id || key.split('_')[0])) {
                        if (result.fluorophore && dataset.label.includes(result.fluorophore)) {
                            return true;
                        }
                    }
                    return false;
                });
                
                if (wellKey) {
                    wellData = window.currentAnalysisResults.individual_results[wellKey];
                }
            }
            
            // Apply CFX Manager 3.1 style baseline flattening with backend S-curve data
            const processedData = applyBaselineFlattening(originalData, baselineFlatteningEnabled, wellData);
            
            // Check if this curve was flattened or preserved using backend data
            const wasSCurve = wellData ? wellData.is_good_scurve : detectSCurve(originalData);
            if (baselineFlatteningEnabled) {
                if (wasSCurve) {
                    preservedSCurves++;
                } else {
                    flattenedCurves++;
                }
            }
            
            dataset.data = processedData;
            processedCurves++;
        } else if (dataset.data && !dataset.originalData) {
            // Fallback for datasets without originalData
            dataset.originalData = [...dataset.data];
            const processedData = applyBaselineFlattening(dataset.originalData, baselineFlatteningEnabled, null);
            dataset.data = processedData;
            processedCurves++;
        }
    });
    
    // Update chart
    window.amplificationChart.update('none');
    
    if (baselineFlatteningEnabled) {
        // console.log(`🔍 BASELINE - CFX Manager 3.1 style processing complete: ${processedCurves} curves processed, ${preservedSCurves} S-curves preserved, ${flattenedCurves} flat curves baseline-corrected`);
    } else {
        // console.log(`🔍 BASELINE - Baseline flattening disabled, restored ${processedCurves} curves to original data`);
    }
}

/**
 * Initialize baseline flattening controls
 */
function initializeBaselineFlattening() {
    // Load saved preference
    const saved = sessionStorage.getItem('baselineFlatteningEnabled');
    if (saved) {
        baselineFlatteningEnabled = saved === 'true';
    }
    
    // Set up toggle button
    const toggleBtn = document.getElementById('baselineToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleBaselineFlattening);
        
        // Set initial state
        toggleBtn.dataset.enabled = baselineFlatteningEnabled.toString();
        const options = toggleBtn.querySelectorAll('.toggle-option');
        options.forEach((option, index) => {
            option.classList.toggle('active', index === (baselineFlatteningEnabled ? 1 : 0));
        });
    }
    
    // Only show baseline flattening in linear mode
    updateBaselineFlatteningVisibility();
}

/**
 * Update visibility of baseline flattening controls based on scale mode
 */
function updateBaselineFlatteningVisibility() {
    const container = document.getElementById('baselineFlatteningContainer');
    if (container) {
        // Always show baseline controls - they work in both linear and log modes
        container.style.display = 'block';
        // console.log('🔍 BASELINE-TOGGLE - Always visible for both linear and log modes');
    }
}

/**
 * Force update scale toggle visual state to match current mode
 */
function forceUpdateScaleToggleState() {
    const toggleBtn = document.getElementById('scaleToggle');
    if (toggleBtn) {
        const currentScale = window.currentScaleMode || 'linear';
        toggleBtn.setAttribute('data-scale', currentScale);
        
        const options = toggleBtn.querySelectorAll('.toggle-option');
        if (options.length >= 2) {
            options.forEach(option => option.classList.remove('active'));
            
            if (currentScale === 'log') {
                options[1].classList.add('active');    // Log (second option)
            } else {
                options[0].classList.add('active');    // Linear (first option)
            }
        }
        // console.log(`🔄 FORCE-SCALE-UPDATE - Set toggle to ${currentScale} mode`);
    }
}

// Make function globally available
window.forceUpdateScaleToggleState = forceUpdateScaleToggleState;

// --- Force CQJ calculation and table update after analysis results load ---
document.addEventListener('DOMContentLoaded', function() {
    // If analysis results are present, calculate CQJ for all wells and update table
    if (window.currentAnalysisResults && window.currentAnalysisResults.individual_results) {
        Object.keys(window.currentAnalysisResults.individual_results).forEach(wellKey => {
            const well = window.currentAnalysisResults.individual_results[wellKey];
            const channel = well.fluorophore;
            let scale = (typeof currentScaleMode === 'string' ? currentScaleMode : 'linear');
            let threshold = null;
            if (window.stableChannelThresholds && window.stableChannelThresholds[channel] && window.stableChannelThresholds[channel][scale] != null) {
                threshold = window.stableChannelThresholds[channel][scale];
            }
            // Use backend-provided CQJ value
            if (well.cqj && channel in well.cqj) {
                well.cqj_value = well.cqj[channel];
            } else {
                well.cqj_value = null;
            }
        });
        if (typeof populateResultsTable === 'function') {
            populateResultsTable(window.currentAnalysisResults.individual_results);
        }
    }
});
// ...existing code...

// --- Threshold Strategy Dropdown Logic ---
// Remove any import/export statements for browser compatibility
// All dependencies should be accessed via window, e.g., window.LINEAR_THRESHOLD_STRATEGIES, window.LOG_THRESHOLD_STRATEGIES



/*function getSelectedThresholdStrategy() {
    const select = document.getElementById('thresholdStrategySelect');
    if (select && select.value) {
        window.selectedThresholdStrategy = select.value;
        // console.log(`🔍 STRATEGY-DEBUG - Selected strategy from dropdown: "${select.value}"`);
        return select.value;
    }
    // console.warn(`🔍 STRATEGY-DEBUG - No strategy selected, returning null`);
    return null;
}*/

// THRESHOLD STRATEGY DROPDOWN FUNCTIONS MOVED TO threshold_frontend.js
// All threshold strategy dropdown functionality is now handled in threshold_frontend.js

// Removed calculateStrategySpecificThreshold - using threshold_strategies.js calculateThreshold instead

// CQJ/CALCJ FUNCTIONS MOVED TO cqj_calcj_utils.js
// Functions recalculateCQJValues and recalculateCQJValuesForManualThreshold moved to cqj_calcj_utils.js

async function handleThresholdStrategyChange() {
    // When the strategy changes, recalculate thresholds for all channels and both scales, then update the chart and CQ-J/Calc-J values
    // console.log('[CQJ/CalcJ][DEBUG] handleThresholdStrategyChange: currentAnalysisResults =', window.currentAnalysisResults);
    if (window.currentAnalysisResults) {
        if (window.currentAnalysisResults.individual_results && typeof window.currentAnalysisResults.individual_results === 'object') {
            // console.log('[CQJ/CalcJ][DEBUG] handleThresholdStrategyChange: Detected structure: { individual_results: {...} }');
            // console.log('[CQJ/CalcJ][DEBUG] handleThresholdStrategyChange: individual_results keys =', Object.keys(window.currentAnalysisResults.individual_results));
        } else if (
            typeof window.currentAnalysisResults === 'object' &&
            !Array.isArray(window.currentAnalysisResults) &&
            Object.keys(window.currentAnalysisResults).length > 0 &&
            Object.values(window.currentAnalysisResults).every(
                v => v && typeof v === 'object' && 'well_id' in v
            )
        ) {
            // console.log('[CQJ/CalcJ][DEBUG] handleThresholdStrategyChange: Detected structure: flat well-keyed object');
            // console.log('[CQJ/CalcJ][DEBUG] handleThresholdStrategyChange: well keys =', Object.keys(window.currentAnalysisResults));
        } else {
            // console.log('[CQJ/CalcJ][DEBUG] handleThresholdStrategyChange: Unknown or empty structure for window.currentAnalysisResults');
        }
    }
    const strategy = getSelectedThresholdStrategy();
    if (!window.stableChannelThresholds) window.stableChannelThresholds = {};
    
    // Check if this is a manual strategy - if so, just recalculate CQJ with existing thresholds
    if (strategy === 'manual') {
        // console.log(`🔍 MANUAL-STRATEGY - Using existing manual thresholds, only recalculating CQJ values`);
        if (window.currentAnalysisResults) {
            if (window.recalculateCQJValuesForManualThreshold) window.recalculateCQJValuesForManualThreshold();
        }
        return; // Don't trigger backend calculation for manual strategy
    }
    
    // Clear manual threshold markers when switching to automatic strategy
    if (window.manualThresholds) {
        // console.log(`🔍 STRATEGY-CHANGE - Clearing manual threshold markers for automatic strategy: ${strategy}`);
        window.manualThresholds = {};
    }
    
    // CRITICAL: Clear cached thresholds AND CQJ values when strategy changes to force recalculation
    // console.log(`🔍 THRESHOLD-STRATEGY-CHANGE - Clearing cached thresholds for strategy change to: "${strategy}"`);
    window.stableChannelThresholds = {}; // Force fresh calculation for new strategy
    
    // Also clear any cached CQJ values to ensure fresh calculation
    if (window.currentAnalysisResults) {
        const resultsToCheck = window.currentAnalysisResults.individual_results || window.currentAnalysisResults;
        if (resultsToCheck) {
            Object.keys(resultsToCheck).forEach(wellKey => {
                const well = resultsToCheck[wellKey];
                if (well) {
                    // Force clear old CQJ values so they must be recalculated
                    well.cqj_value = undefined; // Explicitly set to undefined to force recalc
                    well.calcj_value = undefined;
                }
            });
            // console.log(`🔍 CQJ-CLEAR - Cleared cached CQJ/CalcJ values for ${Object.keys(resultsToCheck).length} wells`);
        }
    }
    
     // APPLY THRESHOLD STRATEGY LOCALLY using threshold_strategies.js
    // console.log(`🔍 LOCAL-THRESHOLD - Applying strategy: "${strategy}" locally`);
    const localResult = await applyThresholdStrategyLocally(strategy);

    // If local calculation succeeded, update the UI
    if (localResult && localResult.success) {
        // console.log(`🔍 LOCAL-THRESHOLD - Local calculation success. Refreshing UI.`);
        
        // Explicitly call populateResultsTable with the now-updated global results object.
        const resultsObj = window.currentAnalysisResults.individual_results || window.currentAnalysisResults;
        populateResultsTable(resultsObj);

        // Apply any filter preservation after threshold update
        setTimeout(preserveCurrentFilters, 200);
        
        return; // Exit - local calculation handled, and we've updated the UI.
    }
    
    // Fallback: Continue with frontend calculation if backend failed or unavailable
    // console.log(`🔍 AJAX-THRESHOLD - Backend update failed or unavailable, continuing with frontend calculation`);
    
    // Calculate thresholds for each channel using proper threshold strategies
    if (window.channelControlWells) {
        Object.keys(window.channelControlWells).forEach(channel => {
            const controls = window.channelControlWells[channel];
            let baseline = 0, baseline_std = 1;
            let allRfus = [];
            
            // Calculate baseline from NTC wells
            if (controls && controls.NTC && controls.NTC.length > 0) {
                controls.NTC.forEach(well => {
                    let rfu = well.raw_rfu;
                    if (typeof rfu === 'string') try { rfu = JSON.parse(rfu); } catch(e){}
                    if (Array.isArray(rfu)) allRfus.push(...rfu.slice(0,5));
                });
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
                // Try to get pathogen from wells
                if (controls && controls.NTC && controls.NTC.length > 0 && controls.NTC[0].test_code) {
                    pathogen = controls.NTC[0].test_code;
                } else if (window.currentAnalysisResults) {
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
                // Default pathogen for fixed strategies
                if (!pathogen) {
                    pathogen = 'BVPanelPCR1';
                }
            }
            
            // Calculate threshold for both log and linear using proper strategy
            ['log','linear'].forEach(scale => {
                let threshold = null;
                
                // Use calculateThreshold from threshold_strategies.js
                if (typeof window.calculateThreshold === 'function') {
                    const params = {
                        baseline,
                        baseline_std,
                        N: 10,
                        pathogen,
                        fluorophore: channel,
                        channel: channel
                    };
                    
                    // Add curve data for log strategies
                    if (scale === 'log' && controls.NTC && controls.NTC.length > 0) {
                        let log_curve = controls.NTC[0].log_rfu;
                        if (typeof log_curve === 'string') try { log_curve = JSON.parse(log_curve); } catch(e){}
                        if (Array.isArray(log_curve)) {
                            params.rfu = log_curve;
                            params.cycles = Array.from({length: log_curve.length}, (_, i) => i + 1);
                        }
                    }
                    
                    try {
                        threshold = window.calculateThreshold(strategy, params, scale);
                        // console.log(`✅ THRESHOLD-CALC - ${channel}[${scale}]: ${threshold} (strategy: ${strategy})`);
                    } catch (error) {
                        // console.error(`❌ THRESHOLD-ERROR - Failed to calculate ${strategy} for ${channel}[${scale}]:`, error);
                        threshold = null;
                    }
                }
                
                // Only use strategy-based thresholds - no fallbacks
                if (threshold === null || isNaN(threshold) || threshold <= 0) {
                    // console.warn(`❌ THRESHOLD-FAIL - No valid threshold for ${channel}[${scale}] with strategy ${strategy}`);
                    threshold = null;
                }
                
                // Store threshold
                if (threshold !== null) {
                    if (!window.stableChannelThresholds[channel]) window.stableChannelThresholds[channel] = {};
                    const oldThreshold = window.stableChannelThresholds[channel][scale];
                    window.stableChannelThresholds[channel][scale] = parseFloat(threshold);
                    
                    // console.log(`📊 THRESHOLD-UPDATE - ${channel}[${scale}]: ${oldThreshold} → ${threshold} (strategy: ${strategy})`);
                }
            });
        });
    }
    
    // Log summary of threshold changes with detailed debugging
    // console.log(`🔍 THRESHOLD-SUMMARY - Strategy "${strategy}" applied. Current thresholds:`, window.stableChannelThresholds);
    
    // CRITICAL DEBUG: Verify we have actual threshold changes for different strategies
    const thresholdSummary = {};
    if (window.stableChannelThresholds) {
        Object.keys(window.stableChannelThresholds).forEach(channel => {
            thresholdSummary[channel] = window.stableChannelThresholds[channel];
        });
    }
    // console.log(`📊 DETAILED THRESHOLD SUMMARY for strategy "${strategy}":`, thresholdSummary);
    
    // After recalculation, update threshold input box to match new value for current channel/scale - IMPROVED
    const updateThresholdInput = () => {
        const thresholdInput = document.getElementById('thresholdInput');
        let channel = window.appState.currentFluorophore;
        if (!channel || channel === 'all') {
            // Try to extract from chart datasets
            const datasets = window.amplificationChart?.data?.datasets;
            if (datasets && datasets.length > 0) {
                const match = datasets[0].label?.match(/\(([^)]+)\)/);
                if (match && match[1] !== 'Unknown') channel = match[1];
            }
            // If still no channel, default to first available threshold
            if (!channel && window.stableChannelThresholds) {
                channel = Object.keys(window.stableChannelThresholds)[0];
            }
        }
        
        // Ensure currentScaleMode is properly set
        let scale = window.currentScaleMode || currentScaleMode || 'linear';
        if (!scale || scale === 'undefined') {
            scale = 'linear';
            window.currentScaleMode = scale;
            currentScaleMode = scale;
        }
        
        // console.log(`🔍 THRESHOLD-INPUT-DEBUG - Channel: ${channel}, Scale: ${scale} (currentScaleMode: ${currentScaleMode}, window.currentScaleMode: ${window.currentScaleMode})`);
        
        // Check if this threshold was manually set by the user
        const isManuallySet = window.manualThresholds && window.manualThresholds[channel] && window.manualThresholds[channel][scale];
        if (isManuallySet) {
            // console.log(`🔍 THRESHOLD-INPUT-SKIP - Skipping update for manually set threshold: ${channel} ${scale}`);
            return;
        }
        
        if (thresholdInput && channel && window.stableChannelThresholds && window.stableChannelThresholds[channel]) {
            const val = window.stableChannelThresholds[channel][scale];
            if (val !== undefined && val !== null && !isNaN(val)) {
                // console.log(`🔍 THRESHOLD-INPUT-DEBUG - Updating input from ${thresholdInput.value} to ${val}`);
                thresholdInput.value = Number(val).toFixed(2);
            } else {
                // console.warn(`🔍 THRESHOLD-INPUT-DEBUG - Invalid threshold value:`, val);
            }
        } else {
            // console.warn(`🔍 THRESHOLD-INPUT-DEBUG - Missing data: input=${!!thresholdInput}, channel=${channel}, thresholds=`, window.stableChannelThresholds);
        }
    };
    
    // Make updateThresholdInput globally available
    window.updateThresholdInput = updateThresholdInput;
    
    // Update immediately
    updateThresholdInput();
    
    // Update threshold chart lines
    if (window.updateAllChannelThresholds) window.updateAllChannelThresholds();
    
    // Also update after a short delay to ensure all DOM updates complete
    setTimeout(() => {
        updateThresholdInput();
        if (window.updateAllChannelThresholds) window.updateAllChannelThresholds();
    }, 100);
    // Recalculate CQJ and CalcJ for all wells using the proper threshold strategy
    let resultsObj = null;
    if (window.currentAnalysisResults) {
        if (window.currentAnalysisResults.individual_results && typeof window.currentAnalysisResults.individual_results === 'object') {
            resultsObj = window.currentAnalysisResults.individual_results;
        } else if (
            typeof window.currentAnalysisResults === 'object' &&
            !Array.isArray(window.currentAnalysisResults) &&
            Object.keys(window.currentAnalysisResults).length > 0 &&
            Object.values(window.currentAnalysisResults).every(
                v => v && typeof v === 'object' && 'well_id' in v
            )
        ) {
            resultsObj = window.currentAnalysisResults;
        }
    }
    
    if (resultsObj) {
        let experimentPattern = (typeof getCurrentFullPattern === 'function') ? getCurrentFullPattern() : null;
        let testCode = (typeof extractTestCode === 'function' && experimentPattern) ? extractTestCode(experimentPattern) : null;
        
        Object.keys(resultsObj).forEach(wellKey => {
            const well = resultsObj[wellKey];
            const channel = well.fluorophore;
            
            // Determine scale based on strategy
            let scale = 'linear';
            if (strategy === 'log_fixed' || strategy.includes('log')) {
                scale = 'log';
            } else if (strategy === 'linear_fixed' || strategy.includes('linear')) {
                scale = 'linear';
            }
            
            // Get threshold from stored calculations
            let threshold = null;
            if (window.stableChannelThresholds && window.stableChannelThresholds[channel] && window.stableChannelThresholds[channel][scale] != null) {
                threshold = window.stableChannelThresholds[channel][scale];
            }
            
            if (typeof threshold !== 'number' || isNaN(threshold) || threshold <= 0) {
                // console.warn(`❌ CQJ-SKIP - No valid threshold for ${wellKey} [${channel}/${scale}]`);
                well.cqj_value = null;
                well.calcj_value = null;
                return;
            }
            
            // Set test_code for CalcJ
            if (testCode) {
                well.test_code = testCode;
            }
            
            // Calculate CQJ using the threshold from strategy
            if ((well.cycles || well.raw_cycles) && (well.rfu || well.raw_rfu)) {
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
                
                if (Array.isArray(rfuArray) && Array.isArray(cyclesArray) && rfuArray.length > 0 && cyclesArray.length > 0) {
                    try {
                        const oldCqjValue = well.cqj_value;
                        well.cqj_value = window.calculateThresholdCrossing(rfuArray, cyclesArray, threshold);
                        
                        const maxRfu = Math.max(...rfuArray);
                        if (well.cqj_value !== null) {
                            // console.log(`✅ CQJ-CALC - ${wellKey}: ${oldCqjValue} → ${well.cqj_value} (threshold: ${threshold.toFixed(2)}, strategy: ${strategy})`);
                        } else if (maxRfu < threshold) {
                            // console.log(`➖ CQJ-NEG - ${wellKey}: No crossing (maxRFU: ${maxRfu.toFixed(2)} < threshold: ${threshold.toFixed(2)})`);
                        } else {
                            // console.warn(`⚠️ CQJ-WARN - ${wellKey}: Unexpected null result (maxRFU: ${maxRfu.toFixed(2)} >= threshold: ${threshold.toFixed(2)})`);
                        }
                    } catch (error) {
                        // console.error(`❌ CQJ-ERROR - Failed to calculate CQJ for ${wellKey}:`, error);
                        well.cqj_value = null;
                    }
                } else {
                    // console.warn(`❌ CQJ-DATA - Invalid data arrays for ${wellKey}`);
                    well.cqj_value = null;
                }
            } else {
                // console.warn(`❌ CQJ-MISSING - Missing RFU/cycles data for ${wellKey}`);
                well.cqj_value = null;
            }
            
            // Calculate CalcJ using H/M/L control-based method or fallback to basic
            if (well.calcj && channel in well.calcj) {
                well.calcj_value = typeof well.calcj[channel] === 'string' ? parseFloat(well.calcj[channel]) : well.calcj[channel];
            } else if (typeof window.calculateCalcjWithControls === 'function' && testCode && channel) {
                // Try control-based calculation first
                const numericThreshold = typeof threshold === 'string' ? parseFloat(threshold) : threshold;
                const calcjResult = window.calculateCalcjWithControls(well, numericThreshold, resultsObj, testCode, channel);
                well.calcj_value = calcjResult.calcj_value;
                well.calcj_method = calcjResult.method; // Track which method was used
                // console.log(`✅ CALCJ-CALC - ${wellKey}: ${well.calcj_value} (method: ${calcjResult.method})`);
            } else if (typeof window.calculateCalcj === 'function' && well.amplitude) {
                // Fallback to basic calculation if control-based not available
                const numericThreshold = typeof threshold === 'string' ? parseFloat(threshold) : threshold;
                const numericAmplitude = typeof well.amplitude === 'string' ? parseFloat(well.amplitude) : well.amplitude;
                well.amplitude = numericAmplitude;
                well.calcj_value = window.calculateCalcj(well, numericThreshold);
                well.calcj_method = 'basic';
                // console.log(`✅ CALCJ-CALC - ${wellKey}: ${well.calcj_value} (method: basic)`);
            } else {
                well.calcj_value = null;
                well.calcj_method = 'failed';
                // console.warn(`❌ CALCJ-MISSING - Cannot calculate CalcJ for ${wellKey}`);
            }
            
            // console.log(`📊 CQJ/CALCJ - ${wellKey}: CQJ=${well.cqj_value}, CalcJ=${well.calcj_value}, threshold=${threshold}`);
            
            // CRITICAL FIX: Build CQJ and CalcJ objects from calculated values
            const fluorophore = well.fluorophore;
            if (fluorophore) {
                // Initialize CQJ object if it doesn't exist
                if (!well.cqj || typeof well.cqj !== 'object') {
                    well.cqj = {};
                }
                // Initialize CalcJ object if it doesn't exist
                if (!well.calcj || typeof well.calcj !== 'object') {
                    well.calcj = {};
                }
                
                // Set the calculated values (null will be displayed as N/A)
                well.cqj[fluorophore] = well.cqj_value;
                well.calcj[fluorophore] = well.calcj_value;
                
                // console.log(`📊 CQJ-STRUCT - ${wellKey}[${fluorophore}]: CQJ object updated:`, well.cqj[fluorophore], 'CalcJ object updated:', well.calcj[fluorophore]);
            } else {
                // console.warn(`⚠️ CQJ-STRUCT - ${wellKey}: Missing fluorophore, cannot structure CQJ/CalcJ objects`);
            }
        });
        // Update the UI to reflect new CQ-J/Calc-J values
        if (typeof populateResultsTable === 'function') {
            // Defensive check: Ensure all wells have required properties
            const validatedResults = {};
            Object.keys(resultsObj).forEach(wellKey => {
                const well = resultsObj[wellKey];
                if (well && typeof well === 'object') {
                    // Ensure sample_name is defined
                    if (!well.sample_name && !well.sample) {
                        // console.warn(`⚠️ Well ${wellKey} missing sample name, setting to 'Unknown'`);
                        well.sample_name = 'Unknown';
                    }
                    // Ensure fluorophore is defined
                    if (!well.fluorophore) {
                        // console.warn(`⚠️ Well ${wellKey} missing fluorophore, setting to 'Unknown'`);
                        well.fluorophore = 'Unknown';
                    }
                    validatedResults[wellKey] = well;
                } else {
                    // console.error(`❌ Invalid well data for ${wellKey}:`, well);
                }
            });
            
            populateResultsTable(validatedResults);
            
            // CRITICAL FIX: Also repopulate well selector to ensure consistency
            if (typeof populateWellSelector === 'function') {
                populateWellSelector(validatedResults);
                // console.log(`📊 WELL-SELECTOR - Repopulated well selector with ${Object.keys(validatedResults).length} wells`);
            }
            
            // console.log(`📊 RESULTS-TABLE - Updated results table with new CQJ/CalcJ values for ${Object.keys(validatedResults).length} wells`);
        } else {
            // console.log('[CQJ/CalcJ] Values recalculated for all wells after threshold strategy change.');
        }
        // FIXED: Preserve current filter state and ensure table matches dropdown selection
        setTimeout(() => {
            preserveCurrentFilters();
        }, 300);
    } else {
        // console.warn('[CQJ/CalcJ] No valid analysis results found when recalculating after threshold strategy change.');
    }
}

function preserveCurrentFilters() {
    // console.log(`🔍 FILTER-PRESERVE - Maintaining current filter state after threshold strategy change`);
    
    // FIXED: Don't recreate chart unnecessarily - just ensure Show All button is active
    // The chart should already be showing all curves, and thresholds are updated separately
    const showAllBtn = document.getElementById('showAllBtn');
    if (showAllBtn) showAllBtn.classList.add('active');
    
    // CRITICAL FIX: Get current well selector value and directly apply the corresponding filter
    const wellSelector = document.getElementById('wellSelect');
    if (wellSelector) {
        const currentFilterValue = wellSelector.value;
        // console.log(`🔍 FILTER-PRESERVE - Current well selector value: "${currentFilterValue}"`);
        
        // DIRECT FILTER APPLICATION: Apply filter based on dropdown value without relying on events
        if (currentFilterValue === 'POS') {
            // console.log(`🔍 FILTER-PRESERVE - Directly applying POS filter`);
            if (typeof filterWellsByResult === 'function') {
                filterWellsByResult('POS');
            } else {
                // Direct DOM manipulation fallback
                const tableRows = document.querySelectorAll('#resultsTable tbody tr');
                tableRows.forEach(row => {
                    const resultCell = row.querySelector('td:nth-child(4)'); // Assuming result is 4th column
                    if (resultCell && resultCell.textContent.trim() === 'POS') {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            }
        } else if (currentFilterValue === 'NEG') {
            // console.log(`🔍 FILTER-PRESERVE - Directly applying NEG filter`);
            if (typeof filterWellsByResult === 'function') {
                filterWellsByResult('NEG');
            } else {
                // Direct DOM manipulation fallback
                const tableRows = document.querySelectorAll('#resultsTable tbody tr');
                tableRows.forEach(row => {
                    const resultCell = row.querySelector('td:nth-child(4)');
                    if (resultCell && resultCell.textContent.trim() === 'NEG') {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            }
        } else if (currentFilterValue === 'all' || !currentFilterValue) {
            // console.log(`🔍 FILTER-PRESERVE - Showing all wells`);
            if (typeof showAllWells === 'function') {
                showAllWells();
            } else {
                // Direct DOM manipulation fallback
                const tableRows = document.querySelectorAll('#resultsTable tbody tr');
                tableRows.forEach(row => {
                    row.style.display = '';
                });
            }
        }
    }
    
    // Preserve fluorophore filter as well
    const fluorophoreSelector = document.getElementById('fluorophoreSelect');
    if (fluorophoreSelector) {
        const currentFluorophore = fluorophoreSelector.value;
        // console.log(`🔍 FILTER-PRESERVE - Current fluorophore filter: "${currentFluorophore}"`);
        
        // Reapply fluorophore filter if it's not 'all'
        if (currentFluorophore && currentFluorophore !== 'all' && typeof filterWellsByFluorophore === 'function') {
            filterWellsByFluorophore(currentFluorophore);
            // console.log(`🔍 FILTER-PRESERVE - Reapplied fluorophore filter: "${currentFluorophore}"`);
        }
    }
    
    // CRITICAL: Synchronize all filter states after applying filters
    setTimeout(() => {
        synchronizeAllFilterStates();
    }, 100);
}

/**
 * Send threshold strategy change to backend via AJAX
/**
 * Apply threshold strategy locally using threshold_strategies.js with LOG SCALE calculations
 * This ensures the backend receives log scale threshold values for proper CQJ/CalcJ calculations
 * @param {string} strategy - The threshold strategy to apply
 * @returns {Object} Result object indicating success/failure
 */
async function applyThresholdStrategyLocally(strategy) {
    try {
        // console.log(`🔍 LOCAL-THRESHOLD - Applying threshold strategy "${strategy}" locally with LOG SCALE`);
        
        // CRITICAL: Force log scale for backend CQJ/CalcJ calculations
        const currentScale = 'log'; // ALWAYS use log scale for threshold calculations
        // console.log(`🔍 LOCAL-THRESHOLD - FORCED LOG SCALE - Strategy: "${strategy}", Scale Mode: "${currentScale}"`);
        
        // CALCULATE THRESHOLDS LOCALLY using threshold_strategies.js
        if (typeof window.calculateThresholdForStrategy === 'function') {
            // Get current analysis results
            const currentResults = window.currentAnalysisResults?.individual_results || window.currentAnalysisResults || {};
            
            // Check if we have analysis data before trying to calculate thresholds
            if (!currentResults || Object.keys(currentResults).length === 0) {
                // console.log(`🔍 LOCAL-THRESHOLD - No analysis data available yet. Strategy "${strategy}" will be applied when data is loaded.`);
                // Still update UI to show the strategy change
                if (window.updateAllChannelThresholds) window.updateAllChannelThresholds();
                if (window.updateThresholdInput) window.updateThresholdInput();
                return { success: true, message: `Strategy "${strategy}" set (will apply when data is loaded)` };
            }
            
            // Calculate new thresholds using local logic with LOG SCALE
            // console.log(`🔍 LOCAL-THRESHOLD - Calculating "${strategy}" thresholds for ${Object.keys(currentResults).length} wells using LOG SCALE`);
            
            try {
                // Apply the strategy locally and update thresholds with LOG calculations
                const updatedThresholds = window.calculateThresholdForStrategy(strategy, currentResults, currentScale);
                
                if (updatedThresholds && Object.keys(updatedThresholds).length > 0) {
                    // console.log(`🔍 LOCAL-THRESHOLD - LOG SCALE thresholds calculated:`, updatedThresholds);
                    
                    // Update global threshold storage with LOG scale values
                    Object.keys(updatedThresholds).forEach(channel => {
                        if (updatedThresholds[channel] && updatedThresholds[channel].log) {
                            window.setChannelThreshold(channel, 'log', updatedThresholds[channel].log);
                            // console.log(`🔍 LOG-THRESHOLD-STORED - ${channel}: ${updatedThresholds[channel].log}`);
                        }
                    });
                    
                    // Update the chart lines and input boxes
                    if (window.updateAllChannelThresholds) window.updateAllChannelThresholds();
                    if (window.updateThresholdInput) window.updateThresholdInput();
                    
                    // Recalculate CQJ values with new LOG thresholds if needed
                    if (window.recalculateCQJValues) {
                        window.recalculateCQJValues();
                    }
                    
                    // Refresh UI components
                    if (typeof populateResultsTable === 'function') {
                        const resultsToDisplay = window.currentAnalysisResults.individual_results || window.currentAnalysisResults;
                        populateResultsTable(resultsToDisplay);
                    }
                    if (typeof populateWellSelector === 'function') {
                        const wellsForSelector = window.currentAnalysisResults.individual_results || window.currentAnalysisResults;
                        populateWellSelector(wellsForSelector);
                    }
                    
                    return { success: true, strategy: strategy, thresholds: updatedThresholds, scale: 'log' };
                } else {
                    // console.log(`🔍 LOCAL-THRESHOLD - No thresholds calculated (no channels found or calculation failed)`);
                    // Still update UI to reflect strategy change
                    if (window.updateAllChannelThresholds) window.updateAllChannelThresholds();
                    if (window.updateThresholdInput) window.updateThresholdInput();
                    return { success: true, strategy: strategy, message: 'Strategy applied (no channels to calculate)' };
                }
            } catch (calcError) {
                // console.error(`❌ LOCAL-THRESHOLD - LOG scale calculation failed:`, calcError);
                // Still update UI to reflect strategy change
                if (window.updateAllChannelThresholds) window.updateAllChannelThresholds();
                if (window.updateThresholdInput) window.updateThresholdInput();
                return { success: false, error: `LOG calculation failed: ${calcError.message}` };
            }
        } else {
            // console.warn(`⚠️ LOCAL-THRESHOLD - calculateThresholdForStrategy function not available`);
            // Fallback: just update UI
            if (window.updateAllChannelThresholds) window.updateAllChannelThresholds();
            if (window.updateThresholdInput) window.updateThresholdInput();
            return { success: true, strategy: strategy, message: 'Strategy applied (calculation function not available)' };
        }
        
    } catch (error) {
        // console.error(`❌ LOCAL-THRESHOLD - Error applying LOG strategy "${strategy}":`, error);
        return { success: false, error: `Failed to apply LOG strategy: ${error.message}` };
    }
}

/**
 * Send threshold strategy to backend with LOG SCALE for CQJ/CalcJ calculations
 * @param {string} strategy - The threshold strategy to apply
 * @returns {Promise<Object>} Backend response or null if failed
 */
async function sendThresholdStrategyToBackend(strategy) {
    try {
        // console.log(`🔍 AJAX-BACKEND - Sending threshold strategy "${strategy}" to backend with LOG SCALE`);
        
        // CRITICAL: Always use log scale for backend CQJ/CalcJ calculations
        const logScale = 'log';
        
        const payload = {
            strategy: strategy,
            scale_mode: logScale,  // FORCE log scale for backend calculations
            experiment_pattern: (typeof getCurrentFullPattern === 'function') ? getCurrentFullPattern() : null,
            session_id: window.currentSessionId || null,
            current_scale: logScale,  // Ensure backend uses log scale
            force_log_scale: true,  // NEW: explicit flag to force log calculations
            timestamp: new Date().toISOString()
        };
        
        // console.log(`🔍 AJAX-PAYLOAD - LOG SCALE payload to backend:`, payload);
        
        // CRITICAL DEBUG: Log exactly what we're sending
        // console.log(`🔍 AJAX-CRITICAL - Strategy: "${strategy}", Scale Mode: "${currentScale}", Current Scale Mode: "${currentScaleMode}"`);
        
        const response = await fetch('/threshold/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        // console.log(`🔍 AJAX-RESPONSE - Backend responded:`, result);
        
        if (result.success) {
            // console.log(`🔍 THRESHOLD-LOCAL - Backend acknowledged strategy "${strategy}". Calculating thresholds locally...`);
            
            // CALCULATE THRESHOLDS LOCALLY using threshold_strategies.js
            if (typeof calculateThresholdForStrategy === 'function') {
                // Get current analysis results
                const currentResults = window.currentAnalysisResults?.individual_results || window.currentAnalysisResults || {};
                
                // Check if we have analysis data before trying to calculate thresholds
                if (!currentResults || Object.keys(currentResults).length === 0) {
                    // console.log(`🔍 THRESHOLD-CALC - No analysis data available yet. Strategy "${strategy}" will be applied when data is loaded.`);
                    // Still update UI to show the strategy change
                    if (window.updateAllChannelThresholds) window.updateAllChannelThresholds();
                    updateThresholdInput();
                    return result;
                }
                
                // Calculate new thresholds using local logic
                // console.log(`🔍 THRESHOLD-CALC - Calculating "${strategy}" thresholds for ${Object.keys(currentResults).length} wells`);
                
                try {
                    // Apply the strategy locally and update thresholds
                    const updatedThresholds = calculateThresholdForStrategy(strategy, currentResults, currentScale);
                    
                    if (updatedThresholds && Object.keys(updatedThresholds).length > 0) {
                        // console.log(`🔍 THRESHOLD-APPLY - Applying calculated thresholds:`, updatedThresholds);
                        
                        // Update the chart lines and input boxes
                        if (window.updateAllChannelThresholds) window.updateAllChannelThresholds();
                        updateThresholdInput();
                        
                        // Recalculate CQJ values with new thresholds if needed
                        if (window.recalculateCQJValues) {
                            window.recalculateCQJValues();
                        }
                        
                        // Refresh UI components
                        if (typeof populateResultsTable === 'function') {
                            const resultsToDisplay = window.currentAnalysisResults.individual_results || window.currentAnalysisResults;
                            populateResultsTable(resultsToDisplay);
                        }
                        if (typeof populateWellSelector === 'function') {
                            const wellsForSelector = window.currentAnalysisResults.individual_results || window.currentAnalysisResults;
                            populateWellSelector(wellsForSelector);
                        }
                    } else {
                        // console.log(`🔍 THRESHOLD-CALC - No thresholds calculated (no channels found or calculation failed)`);
                        // Still update UI to reflect strategy change
                        window.updateAllChannelThresholds();
                        updateThresholdInput();
                    }
                } catch (calcError) {
                    // console.error(`❌ THRESHOLD-CALC - Local calculation failed:`, calcError);
                    // Still update UI to reflect strategy change
                    window.updateAllChannelThresholds();
                    updateThresholdInput();
                }
            } else {
                // console.warn(`⚠️ THRESHOLD-CALC - calculateThresholdForStrategy function not available`);
                // Fallback: just update UI
                if (window.updateAllChannelThresholds) window.updateAllChannelThresholds();
                updateThresholdInput();
            }
        }
        
        return result;
        
    } catch (error) {
        // console.error(`🔍 AJAX-ERROR - Backend threshold update failed:`, error);
        return null;
    }
}
document.addEventListener('DOMContentLoaded', function() {
    // Check if pathogen library is loaded
    waitForPathogenLibrary().then(loaded => {
        if (!loaded) {
            // console.error('⚠️ Warning: Pathogen library failed to load. Some features may not work correctly.');
        }
    });
    
    // Call the threshold dropdown function from threshold_frontend.js - with safety checks
    // console.log('🔍 INIT - Checking threshold dropdown dependencies...');
    // console.log('🔍 INIT - populateThresholdStrategyDropdown available:', typeof window.populateThresholdStrategyDropdown);
    // console.log('🔍 INIT - LINEAR_THRESHOLD_STRATEGIES available:', typeof window.LINEAR_THRESHOLD_STRATEGIES);
    // console.log('🔍 INIT - LOG_THRESHOLD_STRATEGIES available:', typeof window.LOG_THRESHOLD_STRATEGIES);
    
    if (typeof window.populateThresholdStrategyDropdown === 'function') {
        // Delay the call to ensure all dependencies are loaded
        setTimeout(() => {
            // console.log('🔍 INIT - Calling populateThresholdStrategyDropdown...');
            try {
                window.populateThresholdStrategyDropdown();
                // console.log('✅ INIT - Threshold dropdown populated successfully');
            } catch (error) {
                // console.error('❌ INIT - Error populating threshold dropdown:', error);
                // Fallback: manually add a default option if the dropdown is empty
                const select = document.getElementById('thresholdStrategySelect');
                if (select && select.options.length === 0) {
                    const defaultOption = document.createElement('option');
                    defaultOption.value = 'default';
                    defaultOption.textContent = 'Default Strategy';
                    select.appendChild(defaultOption);
                    // console.log('✅ INIT - Added fallback default option to threshold dropdown');
                }
            }
        }, 100);
    } else {
        // console.error('❌ INIT - populateThresholdStrategyDropdown function not available');
    }
    // Default to show all wells on load if analysis section is visible
    // ❌ COMMENTED OUT: Duplicate chart creation causing timing issues
    // setTimeout(function() {
    //     if (typeof showAllCurves === 'function') {
    //         showAllCurves('all');
    //     }
    //     // Also set chart mode to 'all' and update display if needed
    //     if (typeof updateChartDisplayMode === 'function') {
    //         window.currentChartMode = 'all';
    //         updateChartDisplayMode();
    //     }
    // }, 500);
    
    const select = document.getElementById('thresholdStrategySelect');
    if (select) {
        select.addEventListener('change', function() {
            // When dropdown changes, update threshold, input, chart, and recalc CQJ/CalcJ
            handleThresholdStrategyChange();
        });
    }
    // Scale toggle event listener is handled in the main initialization section
    // This prevents duplicate event listeners on the same button
    // See: scaleToggleButton.addEventListener('click', onScaleToggle); below
    // THRESHOLD CONTROL FUNCTIONS MOVED TO threshold_frontend.js
    // Manual threshold controls are now handled in threshold_frontend.js
    // See initializeManualThresholdControls() function
});

// --- ENHANCED PER-CHANNEL THRESHOLD SYSTEM ---
// This replaces the existing threshold calculation logic with a stable, 
// per-channel system that maintains consistency across all views

// Global threshold storage
if (!window.stableChannelThresholds) {
    window.stableChannelThresholds = {}; // { channel: { linear: value, log: value } }
}

// Control wells storage for threshold calculation  
if (!window.channelControlWells) {
    window.channelControlWells = {}; // { channel: [wells...] }
}

/**
 * Extract and categorize control wells for each channel from analysis results
 */
function extractChannelControlWells() {
    if (!window.currentAnalysisResults || !window.currentAnalysisResults.individual_results) {
        // console.log('No analysis results available for control extraction');
        return;
    }
    
    window.channelControlWells = {};
    const results = window.currentAnalysisResults.individual_results;
    
    // Group wells by channel (fluorophore)
    Object.keys(results).forEach(wellKey => {
        const well = results[wellKey];
        const fluorophore = well.fluorophore;
        const sampleName = well.sample_name || '';
        
        if (!fluorophore) return;
        
        // Initialize channel if not exists
        if (!window.channelControlWells[fluorophore]) {
            window.channelControlWells[fluorophore] = {
                NTC: [],
                H: [],
                M: [],
                L: [],
                other: []
            };
        }
        
        // Categorize control wells based on sample name
        if (sampleName.toLowerCase().includes('ntc') || sampleName.toLowerCase().includes('negative')) {
            window.channelControlWells[fluorophore].NTC.push(well);
        } else if (sampleName.toLowerCase().includes('h') && (sampleName.includes('control') || sampleName.includes('pos'))) {
            window.channelControlWells[fluorophore].H.push(well);
        } else if (sampleName.toLowerCase().includes('m') && (sampleName.includes('control') || sampleName.includes('pos'))) {
            window.channelControlWells[fluorophore].M.push(well);
        } else if (sampleName.toLowerCase().includes('l') && (sampleName.includes('control') || sampleName.includes('pos'))) {
            window.channelControlWells[fluorophore].L.push(well);
        } else if (sampleName.toLowerCase().includes('control') || sampleName.toLowerCase().includes('blank')) {
            window.channelControlWells[fluorophore].other.push(well);
        }
    });
    
    // console.log('🔍 THRESHOLD - Extracted control wells by channel:', window.channelControlWells);
}

// THRESHOLD FUNCTIONS MOVED TO threshold_frontend.js
// All threshold-related functions like calculateStableChannelThreshold, 
// initializeChannelThresholds, getCurrentChannelThreshold, etc. have been
// moved to threshold_frontend.js for better organization and global access.

/**
 * Lighten a hex color by a percentage
 * @param {string} hex - The hex color (e.g., '#ff0000')
 * @param {number} percent - The percentage to lighten (0-100)
 * @returns {string} - The lightened hex color
 */
function lightenColor(hex, percent) {
    // Remove the hash if present
    const cleanHex = hex.replace('#', '');
    
    // Parse the hex color
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    
    // Lighten each component
    const newR = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
    const newG = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
    const newB = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
    
    // Convert back to hex
    const toHex = (n) => n.toString(16).padStart(2, '0');
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}

/**
 * Get a distinct color for each channel
 */
function getChannelColor(channel) {
    const colorMap = {
        'FAM': '#2ecc71',    // Green
        'HEX': '#f39c12',    // Orange  
        'Cy5': '#e74c3c',    // Red
        'Texas Red': '#9b59b6', // Purple
        'ROX': '#34495e'     // Dark gray
    };
    const baseColor = colorMap[channel] || '#3498db'; // Default blue
    return lightenColor(baseColor, 25); // Make 25% lighter
}

// ...existing code...

// === CFX MANAGER 3.1-STYLE THRESHOLD FEATURES ===
// THRESHOLD FUNCTIONS MOVED TO threshold_frontend.js
// All threshold feature functions have been moved to threshold_frontend.js
  document.addEventListener('DOMContentLoaded', function() {
    // --- Main UI Event Listeners ---

    // 1. Threshold Strategy Dropdown - Now handled in threshold_frontend.js
    // const strategySelect = document.getElementById('thresholdStrategySelect');
    // Event listener is now added in threshold_frontend.js to prevent conflicts

    // 2. Scale Toggle Button (Linear/Log) - Remove old listeners first
    const scaleToggleButton = document.getElementById('scaleToggle');
    if (scaleToggleButton) {
        // Remove all existing event listeners by cloning the element
        const newToggleButton = scaleToggleButton.cloneNode(true);
        scaleToggleButton.parentNode.replaceChild(newToggleButton, scaleToggleButton);
        
        // Add single event listener
        newToggleButton.addEventListener('click', onScaleToggle);
        // console.log('🔍 EVENT - Scale toggle listener added (old listeners removed)');
    }

    // 3. Manual Threshold Input - handled in main DOMContentLoaded above

    // 4. Initialize the UI on page load
    if (typeof window.populateThresholdStrategyDropdown === 'function') {
        window.populateThresholdStrategyDropdown();
    }

    // 5. Default to "Show All Curves" view
    // ❌ COMMENTED OUT: Duplicate DOM ready handler causing timing conflicts
    // setTimeout(function() {
    //     if (typeof showAllCurves === 'function') {
    //         showAllCurves('all');
    //     }
    //     if (typeof updateChartDisplayMode === 'function') {
    //         window.currentChartMode = 'all';
    //         updateChartDisplayMode();
    //     }
    // }, 500);
});          
// Patch updateAllChannelThresholds to always enable draggable lines
// COMMENTED OUT - Draggable functionality disabled
const _originalUpdateAllChannelThresholds = window.updateAllChannelThresholds;
if (typeof _originalUpdateAllChannelThresholds === 'function') {
    updateAllChannelThresholds = function() {
        _originalUpdateAllChannelThresholds.apply(this, arguments);
        // enableDraggableThresholds(); // DISABLED - Will use test.html implementation
    };
    window.updateAllChannelThresholds = updateAllChannelThresholds;
} else {
    // console.warn('🔍 PATCH - window.updateAllChannelThresholds not available for patching');
}

// THRESHOLD FUNCTIONS MOVED TO threshold_frontend.js
// Functions like restoreAutoThreshold, attachAutoButtonHandler moved to threshold_frontend.js

// --- Restore Thresholds on Refresh ---
document.addEventListener('DOMContentLoaded', function() {
    // Restore all thresholds from calculated values
    if (window.stableChannelThresholds) {
        Object.keys(window.stableChannelThresholds).forEach(channel => {
            ['linear', 'log'].forEach(scale => {
                const autoValue = window.calculateStableChannelThreshold ? window.calculateStableChannelThreshold(channel, scale) : null;
                if (window.setChannelThreshold && autoValue !== null) window.setChannelThreshold(channel, scale, autoValue);
            });
        });
        if (window.updateAllChannelThresholds) window.updateAllChannelThresholds();
    }
});

// --- Default to Show All Wells ---
document.addEventListener('DOMContentLoaded', function() {
    // Force chart mode to 'all' on load
    if (typeof setChartMode === 'function') {
        setChartMode('all');
    } else {
        window.currentChartMode = 'all';
    }
    // If there is a well selector, set to 'all'
    const wellSelect = document.getElementById('wellSelect');
    if (wellSelect) wellSelect.value = 'all';
    // If there is a fluorophore selector, set to 'all'
    const fluorophoreSelect = document.getElementById('fluorophoreSelect');
    if (fluorophoreSelect) fluorophoreSelect.value = 'all';
});

// Patch chart update functions to always re-enable features
const _originalUpdateChartThresholds = window.updateChartThresholds;
if (typeof _originalUpdateChartThresholds === 'function') {
    const patchedFunction = function() {
        _originalUpdateChartThresholds.apply(this, arguments);
        // enableDraggableThresholds(); // DISABLED - Will use test.html implementation
    };
    window.updateChartThresholds = patchedFunction;
} else {
    // console.warn('🔍 PATCH - window.updateChartThresholds not available for patching');
}

// THRESHOLD FUNCTIONS MOVED TO threshold_frontend.js

// --- UI Elements ---
const scaleToggleBtn = document.getElementById('scaleToggle');
const scaleRangeSlider = document.getElementById('scaleRangeSlider');
const scaleRangeLabel = document.getElementById('scaleRangeLabel');
const scaleMultiplierLabel = document.getElementById('scaleMultiplier');
const scaleDescription = document.getElementById('scaleDescription');
const scalePresetsContainer = document.getElementById('scalePresetsContainer');

// --- Advanced Threshold Calculation ---
// --- Enhanced Per-Channel Threshold Calculation (ALL WELLS BASED) ---
// This function calculates thresholds using ALL wells for each channel, not just the displayed chart
/*function calculateChannelThreshold(channel, scale) {
    // console.log(`🔍 THRESHOLD-CALC - Calculating ${scale} threshold for channel: ${channel} using ALL wells`);
    
    // Multiple null checks for robustness
    if (!currentAnalysisResults) {
        // console.warn('🔍 THRESHOLD-CALC - currentAnalysisResults is null');
        return scale === 'log' ? 10 : 100;
    }
    
    if (!currentAnalysisResults.individual_results) {
        // console.warn('🔍 THRESHOLD-CALC - individual_results is null');
        return scale === 'log' ? 10 : 100;
    }
    
    if (typeof currentAnalysisResults.individual_results !== 'object') {
        // console.warn('🔍 THRESHOLD-CALC - individual_results is not an object');
        return scale === 'log' ? 10 : 100;
    }
    
    // Get ALL wells for this channel (by fluorophore) - CRITICAL: This uses ALL wells, not just displayed ones
    const channelWells = Object.keys(currentAnalysisResults.individual_results)
        .map(wellKey => currentAnalysisResults.individual_results[wellKey])
        .filter(well => well != null && well.fluorophore === channel); // Filter by fluorophore property
    
    if (channelWells.length === 0) {
        // console.warn(`🔍 THRESHOLD-CALC - No wells found for channel: ${channel}`);
        return scale === 'log' ? 10 : 100;
    }
    
    // console.log(`🔍 THRESHOLD-CALC - Found ${channelWells.length} wells for channel ${channel} (using ALL wells in dataset)`);
    
    if (scale === 'log') {
        return calculateLogThreshold(channelWells, channel);
    } else {
        return calculateLinearThreshold(channelWells, channel);
    }
}*/

/*function calculateLogThreshold(channelWells, channel) {
    // console.log(`🔍 LOG-THRESHOLD - Calculating log threshold for ${channelWells.length} wells in channel: ${channel}`);
    
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
                // console.warn('🔍 LOG-THRESHOLD - Error parsing raw_rfu for well:', well.well_id);
            }
        }
    });
    
    if (cycles1to5Values.length === 0) {
        // console.warn(`🔍 LOG-THRESHOLD - No early cycle data found for channel: ${channel}`);
        return null; // No fallback - return null if no data
    }
    
    // Calculate standard deviation of cycles 1-5
    const mean = cycles1to5Values.reduce((sum, val) => sum + val, 0) / cycles1to5Values.length;
    const variance = cycles1to5Values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / cycles1to5Values.length;
    const stdDev = Math.sqrt(variance);
    
    // Log threshold = 10x standard deviation
    const logThreshold = 10 * stdDev;
    
    // console.log(`🔍 LOG-THRESHOLD - Channel: ${channel}, Values: ${cycles1to5Values.length}, Mean: ${mean.toFixed(2)}, StdDev: ${stdDev.toFixed(2)}, Threshold: ${logThreshold.toFixed(2)}`);
    
    return logThreshold; // Return exact calculated value, no minimum
}*/

/*function calculateLinearThreshold(channelWells, channel) {
    // console.log(`🔍 LINEAR-THRESHOLD - Calculating linear threshold for ${channelWells.length} wells in channel: ${channel}`);
    
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
        // console.warn(`⚠️ No NTC/NEG/CONTROL wells found for channel ${channel}. Using ALL wells as controls for threshold calculation.`);
        controlWells = channelWells;
    }

    // console.log(`🔍 LINEAR-THRESHOLD - Using ${controlWells.length} control wells for channel: ${channel}`);
    
    // Calculate inflection point thresholds: RFU = L/2 + B
    const inflectionThresholds = [];
    
    controlWells.forEach(well => {
        if (well.amplitude && well.baseline && 
            typeof well.amplitude === 'number' && typeof well.baseline === 'number') {
            
            // Inflection point: L/2 + B
            const inflectionPoint = (well.amplitude / 2) + well.baseline;
            inflectionThresholds.push(inflectionPoint);
            
            // console.log(`🔍 LINEAR-THRESHOLD - Well: ${well.well_id}, L: ${well.amplitude.toFixed(2)}, B: ${well.baseline.toFixed(2)}, Inflection: ${inflectionPoint.toFixed(2)}`);
        }
    });
    
    if (inflectionThresholds.length === 0) {
        // console.warn(`🔍 LINEAR-THRESHOLD - No valid sigmoid parameters found for channel: ${channel}`);
        return null; // No fallback - return null if no data
    }
    
    // Use median of inflection points for robustness
    inflectionThresholds.sort((a, b) => a - b);
    const median = inflectionThresholds.length % 2 === 0
        ? (inflectionThresholds[inflectionThresholds.length / 2 - 1] + inflectionThresholds[inflectionThresholds.length / 2]) / 2
        : inflectionThresholds[Math.floor(inflectionThresholds.length / 2)];
    
    // console.log(`🔍 LINEAR-THRESHOLD - Channel: ${channel}, Inflection points: [${inflectionThresholds.map(t => t.toFixed(2)).join(', ')}], Median: ${median.toFixed(2)}`);
    
    return median; // Return exact calculated value, no minimum
}*/

/*function setChannelThreshold(channel, scale, value) {
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
}*/

/*function getChannelThreshold(channel, scale) {
    if (channelThresholds[channel] && channelThresholds[channel][scale] != null) {
        return channelThresholds[channel][scale];
    }
    // If not set, calculate and store
    const base = calculateChannelThreshold(channel, scale);
    setChannelThreshold(channel, scale, base);
    return base;
}*/

/*function loadChannelThresholds() {
    const stored = sessionStorage.getItem('channelThresholds');
    if (stored) {
        channelThresholds = JSON.parse(stored);
    }
}*/

// --- Slider Logic ---
function updateSliderUI() {
    // Always show slider for both scales
    if (scaleRangeLabel) scaleRangeLabel.textContent = currentScaleMode === 'log' ? 'Log Range:' : 'Linear Range:';
    if (scaleMultiplierLabel) scaleMultiplierLabel.textContent = currentScaleMultiplier.toFixed(2) + 'x';
    if (scaleDescription) scaleDescription.textContent = currentScaleMode === 'log' ? 'Adjust log threshold' : 'Adjust linear threshold';
    
    // Sync toggle button state with current scale mode
    syncToggleButtonState();
}

function syncToggleButtonState() {
    if (scaleToggleBtn) {
        scaleToggleBtn.setAttribute('data-scale', currentScaleMode);
        
        // Update toggle button visual state
        const options = scaleToggleBtn.querySelectorAll('.toggle-option');
        options.forEach((option, index) => {
            option.classList.toggle('active', 
                (currentScaleMode === 'linear' && index === 0) || 
                (currentScaleMode === 'log' && index === 1)
            );
        });
        // console.log(`🔍 SYNC - Toggle button synchronized with ${currentScaleMode} scale`);
    }
}

function onSliderChange(e) {
    currentScaleMultiplier = parseFloat(e.target.value);
    
    // Save to session storage
    safeSetItem(sessionStorage, 'qpcr_scale_multiplier', currentScaleMultiplier.toString());
    
    updateSliderUI();
    
    // Update chart scale configuration (view only, not threshold values)
    if (window.amplificationChart) {
        // Update the chart scale configuration
        const newScaleConfig = getScaleConfiguration();
        window.amplificationChart.options.scales.y = newScaleConfig;
        
        // Force chart update with new scale (no threshold update needed)
        window.amplificationChart.update('none');
        
        // console.log(`🔍 SLIDER - Updated ${currentScaleMode} scale view with multiplier: ${currentScaleMultiplier}x`);
    }
}

function onPresetClick(e) {
    const val = parseFloat(e.target.getAttribute('data-value'));
    currentScaleMultiplier = val;
    if (scaleRangeSlider) scaleRangeSlider.value = val;
    
    // Save to session storage
    safeSetItem(sessionStorage, 'qpcr_scale_multiplier', currentScaleMultiplier.toString());
    
    updateSliderUI();
    
    // Update chart scale configuration (view only, not threshold values)
    if (window.amplificationChart) {
        // Update the chart scale configuration  
        const newScaleConfig = getScaleConfiguration();
        window.amplificationChart.options.scales.y = newScaleConfig;
        
        // Force chart update with new scale (no threshold update needed)
        window.amplificationChart.update('none');
        
        // console.log(`🔍 PRESET - Updated ${currentScaleMode} scale view with preset: ${currentScaleMultiplier}x`);
    }
}

function onScaleToggle() {
    const newScale = (window.appState.currentScaleMode === 'linear') ? 'log' : 'linear';
    
    // console.log(`🔍 TOGGLE - Switching from ${window.appState.currentScaleMode} to ${newScale} scale`);
    
    // CRITICAL: Update button CSS immediately using correct ID
    const toggleBtn = document.getElementById('scaleToggle');
    if (toggleBtn) {
        // Update data attribute
        toggleBtn.setAttribute('data-scale', newScale);
        
        // Update toggle option classes
        const options = toggleBtn.querySelectorAll('.toggle-option');
        if (options.length >= 2) {
            if (newScale === 'log') {
                options[0].classList.remove('active'); // Linear
                options[1].classList.add('active');    // Log
            } else {
                options[0].classList.add('active');    // Linear
                options[1].classList.remove('active'); // Log
            }
        }
        // console.log(`🔍 TOGGLE - Updated button CSS for ${newScale} scale`);
    }
    
    // Use state management for scale changes
    updateAppState({ currentScaleMode: newScale });
    
    // CRITICAL: Also update the global currentScaleMode immediately for getScaleConfiguration()
    currentScaleMode = newScale;
    window.currentScaleMode = newScale;
    
    // CRITICAL: Force immediate chart scale update
    if (window.amplificationChart) {
        const newScaleConfig = getScaleConfiguration();
        window.amplificationChart.options.scales.y = newScaleConfig;
        
        // Force a complete chart update to ensure scale change takes effect
        window.amplificationChart.update('resize');
        
        // Add a small delay and update again to ensure it takes
        setTimeout(() => {
            window.amplificationChart.update('none');
            // console.log(`🔍 TOGGLE - Secondary chart update completed for ${newScale} scale`);
        }, 100);
        
        // console.log(`🔍 TOGGLE - Forced chart scale update to ${newScale} mode`);
    }
    
    // Save preference to session storage
    safeSetItem(sessionStorage, 'qpcr_chart_scale', newScale);
    
    // CRITICAL: Update baseline toggle visibility for both modes
    updateBaselineFlatteningVisibility();
    
    // CRITICAL: Repopulate threshold strategy dropdown for new scale
    if (typeof populateThresholdStrategyDropdown === 'function') {
        // console.log(`🔍 TOGGLE - Repopulating threshold strategies for ${newScale} scale`);
        populateThresholdStrategyDropdown();
    }
    
    // CRITICAL: Update threshold input for new scale
    if (typeof updateThresholdInputForCurrentScale === 'function') {
        // console.log(`🔍 TOGGLE - Updating threshold input for ${newScale} scale`);
        updateThresholdInputForCurrentScale();
    }
    
    // CRITICAL: Update all threshold lines for new scale
    if (window.updateAllChannelThresholds) {
        // console.log(`🔍 TOGGLE - Updating all threshold lines for ${newScale} scale`);
        window.updateAllChannelThresholds();
    }
    
    // console.log(`🔍 TOGGLE - Switched to ${newScale} scale via state management`);
}

// THRESHOLD FUNCTIONS MOVED TO threshold_frontend.js
// Functions updateThresholdInputForCurrentScale and updateChartThresholds moved

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    loadChannelThresholds();
    // Attach slider and preset events
    if (scaleRangeSlider) scaleRangeSlider.addEventListener('input', onSliderChange);
    if (scalePresetsContainer) {
        scalePresetsContainer.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', onPresetClick);
        });
    }
    // Remove duplicate scale toggle listener - this is handled in the main DOMContentLoaded above
    // if (scaleToggleBtn) scaleToggleBtn.addEventListener('click', onScaleToggle);
    updateSliderUI();
    
    // Initialize baseline flattening controls
    initializeBaselineFlattening();
});
// ========================================
// MULTICHANNEL SEQUENTIAL PROCESSING FUNCTIONS
// Phase 2: Frontend Sequential Processing with Real-time Status
// ========================================

/**
 * Process channels sequentially with completion tracking
 * Replaces the parallel forEach with proper sequential coordination
 */
async function processChannelsSequentially(fluorophores, experimentPattern) {
    // console.log(`🔍 SEQUENTIAL-PROCESSING - Starting sequential processing of ${fluorophores.length} channels`);
    
    const allResults = {};
    const totalChannels = fluorophores.length;
    const rollbackData = {
        savedSessions: [],
        backendState: null,
        frontendState: null
    };
    
    // Capture initial state for rollback
    try {
        // console.log(`🔄 ROLLBACK-PREP - Capturing initial state for potential rollback`);
        rollbackData.frontendState = {
            currentAnalysisResults: window.currentAnalysisResults,
            amplificationChart: window.amplificationChart?.data ? JSON.parse(JSON.stringify(window.amplificationChart.data)) : null
        };
    } catch (stateError) {
        // console.warn(`⚠️ ROLLBACK-PREP - Could not capture frontend state:`, stateError);
    }
    
    for (let i = 0; i < fluorophores.length; i++) {
        const fluorophore = fluorophores[i];
        const channelNum = i + 1;
        
        // console.log(`🔍 SEQUENTIAL-PROCESSING - Processing channel ${channelNum}/${totalChannels}: ${fluorophore}`);
        
        try {
            // Update status to show current channel being processed
            updateChannelStatus(fluorophore, 'processing');
            
            // Add a small delay to allow UI updates to render
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Get data for this specific fluorophore
            const data = amplificationFiles[fluorophore].data;
            
            // Process this single channel
            const channelResult = await analyzeSingleChannel(data, fluorophore, experimentPattern);
            
            // Check if channel has valid results (not empty)
            if (channelResult && channelResult.individual_results && Object.keys(channelResult.individual_results).length > 0) {
                allResults[fluorophore] = channelResult;
                
                // Track successful channel for potential rollback
                if (channelResult.sessionId) {
                    rollbackData.savedSessions.push({
                        fluorophore: fluorophore,
                        sessionId: channelResult.sessionId,
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Mark channel as completed
                updateChannelStatus(fluorophore, 'completed');
                
                // console.log(`✅ SEQUENTIAL-PROCESSING - Channel ${fluorophore} completed successfully. Wells: ${Object.keys(channelResult.individual_results).length}`);
                
            } else {
                throw new Error(`Channel ${fluorophore} returned empty or invalid results`);
            }
            
        } catch (error) {
            // Channel failed - log and continue with remaining channels
            // console.error(`❌ SEQUENTIAL-PROCESSING - Channel ${fluorophore} failed:`, error);
            updateChannelStatus(fluorophore, 'failed');
            
            // Always continue with partial results - no rollback
            // console.log(`⚠️ CONTINUE-PARTIAL - ${fluorophore} failed, continuing with remaining channels`);
            allResults[fluorophore] = null;
        }
        
        // Small delay between channels to prevent overwhelming
        if (i < fluorophores.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    // console.log(`🔍 SEQUENTIAL-PROCESSING - All channels processed. Results: ${Object.keys(allResults).filter(k => allResults[k]).length}/${totalChannels} successful`);
    
    // Log completion details for debugging
    const successfulChannels = Object.keys(allResults).filter(k => allResults[k]);
    const failedChannels = Object.keys(allResults).filter(k => !allResults[k]);
    
    if (successfulChannels.length > 0) {
        // console.log(`✅ PARTIAL-SUCCESS - Successful channels: ${successfulChannels.join(', ')}`);
    }
    if (failedChannels.length > 0) {
        // console.log(`❌ PARTIAL-FAILURE - Failed channels: ${failedChannels.join(', ')}`);
    }
    
    return allResults;
}

/**
 * Analyze a single channel with proper error handling and backend coordination
 * Includes mock backend support for testing when Flask backend is not available
 */
async function analyzeSingleChannel(data, fluorophore, experimentPattern) {
    // console.log(`🔍 SINGLE-CHANNEL - Analyzing ${fluorophore} channel`);
    
    try {
        // Skip backend channel marking since polling removed
        // console.log(`🔍 SINGLE-CHANNEL - Analyzing ${fluorophore} channel`);
        
        // Prepare data for backend analysis
        const analysisData = prepareAnalysisData(data);
        
        // Convert samplesData back to CSV string for backend SQL integration
        let samplesDataCsv = null;
        if (samplesData && samplesData.data) {
            // Convert array of arrays back to CSV string
            samplesDataCsv = samplesData.data.map(row => row.join(',')).join('\n');
        }
        
        const payload = {
            analysis_data: analysisData,
            samples_data: samplesDataCsv
        };
        
        // console.log(`🔍 SINGLE-CHANNEL - Sending ${fluorophore} data to backend`, {
            // analysisDataLength: Object.keys(analysisData || {}).length,
            // analysisDataType: typeof analysisData,
            // analysisDataSample: Object.keys(analysisData || {}).slice(0, 3),
            // samplesDataAvailable: !!samplesDataCsv,
            // samplesDataLength: samplesDataCsv ? samplesDataCsv.length : 0,
            // samplesDataLines: samplesDataCsv ? samplesDataCsv.split('\n').length : 0,
            // samplesDataPreview: samplesDataCsv ? samplesDataCsv.substring(0, 300) : 'null',
            // fluorophore: fluorophore,
            // fileName: amplificationFiles[fluorophore]?.fileName || 'unknown'
        // });
        
        let result;
        
        // Try to perform the actual analysis via backend
        // Send to backend and handle HTTP errors gracefully
        try {
            // Add timeout controller for large requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
            
            // console.log(`🔍 SINGLE-CHANNEL - Making fetch request for ${fluorophore}`, {
                // url: '/analyze',
                // payloadSize: JSON.stringify(payload).length,
                // timestamp: new Date().toISOString()
            // });
            
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Filename': amplificationFiles[fluorophore]?.fileName || `${fluorophore}.csv`,
                    'X-Fluorophore': fluorophore
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId); // Clear timeout if request succeeds
            
            // console.log(`🔍 SINGLE-CHANNEL - Received response for ${fluorophore}`, {
                // status: response.status,
                // statusText: response.statusText,
                // ok: response.ok,
                // timestamp: new Date().toISOString()
            // });
            if (!response.ok) {
                // Enhanced error reporting for 400 errors
                let msg = `HTTP ${response.status}`;
                let errorDetails = null;
                try {
                    const errorText = await response.text();
                    // console.log(`🔍 SINGLE-CHANNEL - Raw error response for ${fluorophore}:`, errorText);
                    
                    // Try to parse as JSON
                    try {
                        errorDetails = JSON.parse(errorText);
                        msg = errorDetails.error || errorDetails.message || msg;
                    } catch (jsonError) {
                        // If not JSON, use the text directly
                        if (errorText && errorText.length < 500) {
                            msg = `${msg}: ${errorText}`;
                        }
                    }
                } catch (readError) {
                    // console.error(`❌ Could not read error response for ${fluorophore}:`, readError);
                }
                
                // console.error(`❌ SINGLE-CHANNEL - Backend error for ${fluorophore}: ${msg}`);
                // console.error(`❌ SINGLE-CHANNEL - Error details for ${fluorophore}:`, {
                    // status: response.status,
                    // statusText: response.statusText,
                    // headers: Object.fromEntries(response.headers.entries()),
                    // errorDetails,
                    // fluorophore,
                    // requestPayloadSize: JSON.stringify(payload).length
                // });
                
                return { individual_results: {} };
            }
            result = await response.json();
        } catch (fetchError) {
            // Network or other failure - log and return empty
            if (fetchError.name === 'AbortError') {
                // console.error(`⏰ SINGLE-CHANNEL - Request timeout for ${fluorophore} (60 seconds)`);
                // console.error(`💡 TIMEOUT-TIP - Backend may still be processing. Check backend logs for completion.`);
                
                // Try to recover from timeout by checking if data was saved to database
                try {
                    // console.log(`🔄 TIMEOUT-RECOVERY - Checking if ${fluorophore} data was saved to database...`);
                    const recoveryResponse = await fetch('/sessions');
                    if (recoveryResponse.ok) {
                        const sessions = await recoveryResponse.json();
                        // Look for a recent session that matches our fluorophore
                        const recentSession = sessions.find(s => 
                            s.filename && s.filename.includes(fluorophore) && 
                            s.created_at && new Date(s.created_at) > new Date(Date.now() - 300000) // Within 5 minutes
                        );
                        if (recentSession) {
                            // console.log(`✅ TIMEOUT-RECOVERY - Found recent ${fluorophore} session, attempting to load:`, recentSession.id);
                            const sessionResponse = await fetch(`/sessions/${recentSession.id}`);
                            if (sessionResponse.ok) {
                                const sessionData = await sessionResponse.json();
                                // console.log(`🔄 TIMEOUT-RECOVERY - Successfully recovered ${fluorophore} data from database`);
                                return sessionData.results;
                            }
                        }
                    }
                } catch (recoveryError) {
                    // console.warn(`⚠️ TIMEOUT-RECOVERY - Could not recover ${fluorophore} data:`, recoveryError);
                }
            } else {
                // console.error(`❌ SINGLE-CHANNEL - Network error for ${fluorophore}:`, fetchError.message);
            }
            // console.error(`❌ SINGLE-CHANNEL - Full fetch error for ${fluorophore}:`, fetchError);
            return { individual_results: {} };
        }
        // COMMENTED OUT: Mock data was interfering with real channel analysis
        // console.warn(`⚠️ SINGLE-CHANNEL - Backend not available for ${fluorophore}, using mock data:`, networkError.message);
        // console.log(`🔧 MOCK-MODE - Generating mock analysis results for ${fluorophore}`);
        // result = createMockAnalysisResponse(fluorophore);

        // 🔍 ROBUST-NULL-CHECK: Enhanced result validation
        // console.log(`🔍 SINGLE-CHANNEL - Raw backend response for ${fluorophore}:`, {
            // resultExists: !!result,
            // resultType: typeof result,
            // resultKeys: result ? Object.keys(result) : 'N/A',
            // hasIndividualResults: !!(result && result.individual_results),
            // individualResultsType: result && result.individual_results ? typeof result.individual_results : 'none'
        // });
        
        if (!result) {
            throw new Error(`Backend returned null/undefined result for ${fluorophore}`);
        }
        
        if (!result.individual_results) {
            // console.error(`❌ SINGLE-CHANNEL - Missing individual_results for ${fluorophore}. Result structure:`, result);
            throw new Error(`Backend response missing individual_results for ${fluorophore}`);
        }
        
        // 🔍 DATA-FORMAT-CONVERSION: Handle backend string to frontend object conversion
        // The backend stores individual_results as strings in the database, but frontend needs objects
        // console.log(`🔍 SINGLE-CHANNEL - Converting data format for ${fluorophore}`, {
            // individualResultsType: typeof result.individual_results,
            // isString: typeof result.individual_results === 'string'
        // });
        
        // Convert individual_results from string to object if needed
        if (result.individual_results && typeof result.individual_results === 'string') {
            try {
                result.individual_results = JSON.parse(result.individual_results);
                // console.log(`🔍 SINGLE-CHANNEL - Successfully parsed individual_results string to object for ${fluorophore}`);
            } catch (parseError) {
                // console.error(`❌ SINGLE-CHANNEL - Failed to parse individual_results for ${fluorophore}:`, parseError);
                throw new Error(`Invalid JSON format in individual_results for ${fluorophore}: ${parseError.message}`);
            }
        }
        
        // Final validation - ensure we have a valid object
        if (!result.individual_results || typeof result.individual_results !== 'object') {
            // console.error(`❌ SINGLE-CHANNEL - Final validation failed for ${fluorophore}:`, {
                // hasIndividualResults: !!result.individual_results,
                // individualResultsType: typeof result.individual_results,
                // resultStructure: result
            // });
            throw new Error(`Individual results is not a valid object for ${fluorophore}`);
        }
        
        // console.log(`🔍 SINGLE-CHANNEL - ${fluorophore} analysis complete. Wells: ${Object.keys(result.individual_results).length}`);
        
        return result;
        
    } catch (error) {
        // console.error(`❌ SINGLE-CHANNEL - Error analyzing ${fluorophore}:`, error);
        throw error; // Re-throw to be handled by sequential processor
    }
}

/**
 * Display channel processing status UI with real-time updates
 */
function displayChannelProcessingStatus(fluorophores, experimentPattern) {
    // console.log('🔍 STATUS-UI - Displaying channel processing status');
    
    // Create or update status container
    let statusContainer = document.getElementById('channel-processing-status');
    if (!statusContainer) {
        statusContainer = document.createElement('div');
        statusContainer.id = 'channel-processing-status';
        statusContainer.className = 'channel-processing-container';
        
        // Insert before results section
        const resultsSection = document.getElementById('analysisResults');
        if (resultsSection) {
            resultsSection.parentNode.insertBefore(statusContainer, resultsSection);
        } else {
            document.body.appendChild(statusContainer);
        }
    }
    
    // Create status HTML
    const totalChannels = fluorophores.length;
    let statusHtml = `
        <div class="channel-processing-header">
            <h3>Processing ${totalChannels} Channel${totalChannels > 1 ? 's' : ''}</h3>
            <div class="channel-overall-progress">
                <div class="progress-bar">
                    <div class="progress-fill" id="overall-progress-fill" style="width: 0%"></div>
                </div>
                <span class="progress-text" id="overall-progress-text">0 / ${totalChannels} completed</span>
            </div>
        </div>
        <div class="channel-status-grid">
    `;
    
    fluorophores.forEach((fluorophore, index) => {
        statusHtml += `
            <div class="channel-status-item" id="channel-status-${fluorophore}">
                <div class="channel-info">
                    <span class="channel-name">${fluorophore}</span>
                    <span class="channel-number">Channel ${index + 1}</span>
                </div>
                <div class="channel-progress">
                    <div class="status-indicator" id="status-indicator-${fluorophore}">
                        <div class="status-spinner"></div>
                    </div>
                    <span class="status-text" id="status-text-${fluorophore}">Waiting...</span>
                </div>
            </div>
        `;
    });
    
    statusHtml += `
        </div>
        <div class="channel-processing-footer">
            <span class="processing-note">Processing channels sequentially for optimal results...</span>
        </div>
    `;
    
    statusContainer.innerHTML = statusHtml;
    statusContainer.style.display = 'block';
    
    // Initialize all channels as waiting
    fluorophores.forEach(fluorophore => {
        updateChannelStatus(fluorophore, 'waiting');
    });
}

/**
 * Update individual channel status in the UI
 */
function updateChannelStatus(fluorophore, status) {
    const statusIndicator = document.getElementById(`status-indicator-${fluorophore}`);
    const statusText = document.getElementById(`status-text-${fluorophore}`);
    
    if (!statusIndicator || !statusText) return;
    
    // Remove existing status classes
    statusIndicator.className = 'status-indicator';
    
    switch (status) {
        case 'waiting':
            statusIndicator.classList.add('status-waiting');
            statusText.textContent = 'Waiting...';
            statusText.style.color = '#666';
            break;
            
        case 'processing':
            statusIndicator.classList.add('status-processing');
            statusText.textContent = 'Analyzing data...';
            statusText.style.color = '#2196F3';
            // Add pulsing animation to the indicator
            statusIndicator.innerHTML = '<div class="status-spinner active"></div>';
            break;
            
        case 'completed':
            statusIndicator.classList.add('status-completed');
            statusText.textContent = 'Completed ✓';
            statusText.style.color = '#4CAF50';
            statusIndicator.innerHTML = '✓';
            updateOverallProgress();
            break;
            
        case 'failed':
            statusIndicator.classList.add('status-failed');
            statusText.textContent = 'Failed ✗';
            statusText.style.color = '#f44336';
            statusIndicator.innerHTML = '✗';
            updateOverallProgress();
            break;
    }
}

/**
 * Update overall progress bar
 */
function updateOverallProgress() {
    const allStatusTexts = document.querySelectorAll('[id^="status-text-"]');
    const completed = Array.from(allStatusTexts).filter(el => 
        el.textContent.includes('Completed') || el.textContent.includes('Failed')
    ).length;
    const total = allStatusTexts.length;
    
    const progressFill = document.getElementById('overall-progress-fill');
    const progressText = document.getElementById('overall-progress-text');
    
    if (progressFill && progressText) {
        const percentage = (completed / total) * 100;
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${completed} / ${total} completed`;
    }
}

/**
 * Hide channel processing status UI
 */
function hideChannelProcessingStatus() {
    const statusContainer = document.getElementById('channel-processing-status');
    if (statusContainer) {
        statusContainer.style.display = 'none';
    }
}

/**
 * Poll channel processing status from backend - DISABLED (polling removed)
 */
async function pollChannelProcessingStatus(experimentPattern, fluorophores) {
    // console.log('🔍 POLLING - Disabled (polling endpoints removed)');
    return null; // Always return null since polling is disabled
}

/**
 * Wait for channel processing completion - DISABLED (polling removed)
 */
async function waitForChannelProcessingCompletion(experimentPattern, fluorophores) {
    // console.log(`🔍 COMPLETION-WAIT - Disabled (polling removed), skipping wait for ${fluorophores.length} channels`);
    return true; // Always return true since we're not polling
}

/**
 * Mark channel as started in backend
 */
async function markChannelStarted(experimentPattern, fluorophore) {
    // Disabled: This endpoint is for polling, not for marking channels as started
    // The backend doesn't have an endpoint for marking individual channels as started
    // console.log(`🔍 CHANNEL-STATUS - Would mark ${fluorophore} as started for ${experimentPattern} (disabled)`);
    return; // Skip this operation to avoid 400 errors
    
    try {
        const response = await fetch('/channels/processing/poll', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                experiment_pattern: experimentPattern,
                fluorophore: fluorophore,
                action: 'start'
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to mark channel started: ${response.status}`);
        }
    } catch (error) {
        // console.error(`Error marking channel ${fluorophore} as started:`, error);
        // Non-critical, continue processing
    }
}

/**
 * Mark channel as failed in backend
 */
async function markChannelFailed(experimentPattern, fluorophore, errorMessage) {
    // Disabled: This endpoint is for polling, not for marking channels as failed
    // The backend doesn't have an endpoint for marking individual channels as failed
    // console.log(`🔍 CHANNEL-STATUS - Would mark ${fluorophore} as failed for ${experimentPattern}: ${errorMessage} (disabled)`);
    return; // Skip this operation to avoid 400 errors
    
    try {
        const response = await fetch('/channels/processing/poll', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                experiment_pattern: experimentPattern,
                fluorophore: fluorophore,
                action: 'fail',
                error_message: errorMessage
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to mark channel failed: ${response.status}`);
        }
    } catch (error) {
        // console.error(`Error marking channel ${fluorophore} as failed:`, error);
        // Non-critical
    }
}

/**
 * Get current experiment pattern for tracking
 * This function has been moved to line 8838 with comprehensive session loading support
 * Keeping this comment for reference - actual function is later in file
 */
// getCurrentFullPattern() function moved to comprehensive version later in file

// ========================================
// END MULTICHANNEL SEQUENTIAL PROCESSING
// ========================================


// Enhanced error handling for inconsistent 400 errors
async function fetchWithRetry(url, options, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // console.log(`🔍 RETRY-DEBUG - Attempt ${attempt}/${maxRetries} for ${options.headers['X-Fluorophore']}`);
            const response = await fetch(url, options);
            
            if (response.ok) {
                return response;
            }
            
            if (response.status === 400) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                // console.error(`🔍 400-ERROR-DEBUG - Attempt ${attempt} failed for ${options.headers['X-Fluorophore']}:`, {
                    // status: response.status,
                    // error: errorData,
                    // requestSize: options.body?.length || 0,
                    // headers: options.headers
                // });
                
                if (attempt < maxRetries) {
                    // Wait before retry with exponential backoff
                    const delay = 1000 * Math.pow(2, attempt - 1);
                    // console.log(`🔍 RETRY-DEBUG - Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
            }
            
            throw new Error(`Server error: ${response.status}`);
        } catch (error) {
            // console.error(`🔍 NETWORK-ERROR-DEBUG - Attempt ${attempt} network error:`, error);
            if (attempt === maxRetries) {
                throw error;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// --- Enhanced Chart.js annotation plugin registration ---
// --- Enhanced Chart.js annotation plugin registration ---
// (Unified: use only ensureAnnotationPluginRegistered everywhere)
// Remove legacy/fallback registration attempts. Always use robust function at top of file.
// Call again on DOMContentLoaded as a fallback in case Chart.js/plugin loads late
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(ensureAnnotationPluginRegistered, 0);
});

// Sorting mode for wells: 'letter-number' (A1, A2...) or 'number-letter' (A1, B1...)
let wellSortMode = 'letter-number';

function toggleWellSortMode() {
    wellSortMode = (wellSortMode === 'letter-number') ? 'number-letter' : 'letter-number';
    // console.log('🔄 SORT - Well sort mode changed to:', wellSortMode);
    
    const btn = document.getElementById('toggleSortModeBtn');
    if (btn) {
        btn.textContent = (wellSortMode === 'letter-number') ? 'Sort: A1, A2...' : 'Sort: 1A, 1B...';
    }
    
    // Get the current fluorophore selection from state
    const selectedFluorophore = window.appState.currentFluorophore || 'all';
    
    // Repopulate the well dropdown in the new order and reset to All Wells
    if (typeof filterWellsByFluorophore === 'function') {
        filterWellsByFluorophore(selectedFluorophore);
    }
    
    // Re-populate the table with the new sort mode
    if (currentAnalysisResults && currentAnalysisResults.individual_results && typeof populateResultsTable === 'function') {
        populateResultsTable(currentAnalysisResults.individual_results);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('toggleSortModeBtn');
    if (btn) {
        btn.addEventListener('click', toggleWellSortMode);
    }
});
// 🚨 EMERGENCY RESET - Nuclear option to clear everything
function emergencyReset() {
    // console.log('🚨 EMERGENCY RESET TRIGGERED');
    
    // Clear ALL global variables
    csvData = null;
    samplesData = null;
    analysisResults = null;
    currentChart = null;
    amplificationFiles = {};
    currentFilterMode = 'all';
    // Reset fluorophore filter via state management
    updateAppState({ currentFluorophore: 'all' });
    currentAnalysisResults = null;
    currentChartMode = 'all';
    
    // Clear ALL window variables
    window.currentAnalysisResults = null;
    window.analysisResults = null;
    window.freshAnalysisMode = true;
    
    // Update export state for cleared results
    updateExportState({ 
        hasAnalysisResults: false,
        isSessionLoaded: false 
    });
    
    // Destroy any existing chart
    if (window.amplificationChart) {
        try {
            window.amplificationChart.destroy();
        } catch (e) {
            // console.log('Chart destruction error (expected)');
        }
        window.amplificationChart = null;
    }
    
    // Clear ALL form inputs
    const fileInput = document.getElementById('fileInput');
    const samplesInput = document.getElementById('samplesInput');
    if (fileInput) fileInput.value = '';
    if (samplesInput) samplesInput.value = '';
    
    // Clear ALL status displays
    const statusElements = ['amplificationStatus', 'samplesStatus', 'uploadedFiles'];
    statusElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.innerHTML = '';
    });
    
    // Hide sections
    const sectionsToHide = ['fileInfo', 'analysisSection'];
    sectionsToHide.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
    
    // Clear chart container
    const chartContainer = document.getElementById('amplificationChart');
    if (chartContainer) {
        const ctx = chartContainer.getContext('2d');
        ctx.clearRect(0, 0, chartContainer.width, chartContainer.height);
    }
    
    // Clear results table
    const tableBody = document.getElementById('resultsTableBody');
    if (tableBody) tableBody.innerHTML = '';
    
    // Reset dropdowns
    const dropdowns = ['wellSelect', 'fluorophoreSelect', 'filterStatus'];
    dropdowns.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.innerHTML = '';
    });
    
    // Clear local storage
    try {
        localStorage.removeItem('qpcr_analysis_history');
    } catch (e) {
        // console.log('LocalStorage clear failed (expected)');
    }
    
    // console.log('🚨 EMERGENCY RESET COMPLETE! All data cleared.');
}

// qPCR S-Curve Analyzer - Frontend JavaScript
// Global variables
let csvData = null;
let samplesData = null;
let analysisResults = null;
let currentChart = null;
let amplificationFiles = {}; // Store multiple fluorophore files
let currentFilterMode = 'all'; // Track current filter mode (all, pos, neg, redo)
// Global variables - DEPRECATING THESE IN FAVOR OF window.appState
// let currentFluorophore = 'all'; // Track current fluorophore filter - MOVED TO window.appState
let currentAnalysisResults = null; // Current analysis results
let currentChartMode = 'all'; // Track current chart display mode

// =============================================================================
// EXPERIMENT ISOLATION SYSTEM - Centralized cleanup for cross-contamination prevention
// =============================================================================

/**
 * Clears all previous experiment data from UI components and global state
 * This prevents cross-contamination when switching between experiments
 */
function clearPreviousExperimentData() {
    // console.log('🧹 [CLEARING] Starting comprehensive experiment data clearing...');
    
    // Use the existing comprehensive cache clearing function
    //clearCachedData();
    
    // Additional clearing for experiment-specific UI elements not covered by clearCachedData
    
    // Clear Control Validation Alerts (prevent contamination from previous experiments)
    const controlValidationContainer = document.getElementById('controlValidationAlerts');
    if (controlValidationContainer) {
        // console.log('🔍 [CLEARING] Found control validation container with content:', {
            // hadContent: controlValidationContainer.innerHTML.length > 0,
            // wasVisible: controlValidationContainer.style.display !== 'none'
        // });
        controlValidationContainer.innerHTML = '';
        controlValidationContainer.style.display = 'none';
        // console.log('🧹 [CLEARING] Cleared control validation alerts container');
    } else {
        // console.log('🔍 [CLEARING] No control validation container found to clear');
    }
    
    // Clear Channel Processing Status (prevent contamination from previous multi-channel processing)
    const channelStatusContainer = document.getElementById('channel-processing-status');
    if (channelStatusContainer) {
        channelStatusContainer.innerHTML = '';
        channelStatusContainer.style.display = 'none';
        // console.log('🧹 [CLEARING] Cleared channel processing status container');
    }
    
    // Clear Control Grids
    const controlGridsContainer = document.getElementById('pathogenControlGrids');
    if (controlGridsContainer) {
        controlGridsContainer.innerHTML = '';
        controlGridsContainer.style.display = 'none';
        // console.log('🧹 [CLEARING] Cleared pathogen control grids container');
    }
    
    // Clear Selected Curve Details
    const curveDetailsContainer = document.querySelector('.curve-details-content');
    if (curveDetailsContainer) {
        curveDetailsContainer.innerHTML = '<p>No curve selected. Click on a row in the results table to view details.</p>';
        // console.log('🧹 [CLEARING] Cleared curve details container');
    }
    
    // Clear any persisting experiment pattern displays
    const experimentPattern = document.getElementById('experimentPattern');
    if (experimentPattern) {
        //experimentPattern.textContent = '--';
        // console.log('🧹 [CLEARING] Cleared experiment pattern display');
    }
    
    // console.log('✅ [CLEARING] Comprehensive experiment data clearing complete');
}

/**
 * Clears the analysis summary section
 */


function resetFilterButtons() {
    const buttons = ['showAllBtn', 'showPosBtn', 'showNegBtn', 'showRedoBtn'];
    buttons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.classList.remove('active');
        }
    });
    
    // Set "Show All Wells" as active by default
    const showAllBtn = document.getElementById('showAllBtn');
    if (showAllBtn) {
        showAllBtn.classList.add('active');
    }
}

// =============================================================================

// Production-specific error handling
window.addEventListener('error', function(event) {
    // console.error('Global error caught:', event.error);
    // Prevent error propagation that might crash the app in production
    if (event.error && event.error.message) {
        if (event.error.message.includes('Cannot read property') || 
            event.error.message.includes('Cannot read properties') ||
            event.error.message.includes('null is not an object')) {
            // console.warn('DOM access error handled gracefully in production');
            event.preventDefault();
            return false;
        }
    }
});

window.addEventListener('unhandledrejection', function(event) {
    // console.error('Unhandled promise rejection:', event.reason);
    // Handle async errors that might behave differently in production
    event.preventDefault();
});

// Safe DOM access wrapper for production environments
function safeGetElement(id, context = 'Unknown') {
    try {
        const element = document.getElementById(id);
        if (!element) {
            // console.warn(`Element '${id}' not found in context: ${context}`);
        }
        return element;
    } catch (error) {
        // console.error(`Error accessing element '${id}' in context: ${context}`, error);
        return null;
    }
}

// Safe function execution wrapper
function safeExecute(fn, context = 'Unknown', fallback = null) {
    try {
        return fn();
    } catch (error) {
        // console.error(`Error in ${context}:`, error);
        return fallback;
    }
}

// Initialize filters to default state on page load
function initializeFilters() {
    // Reset status filter to "All Wells"
    const statusFilter = safeGetElement('filterStatus', 'Initialize filters');
    if (statusFilter) {
        statusFilter.value = 'all';
    }
    
    // Reset fluorophore filter to "All"
    const fluorophoreFilter = safeGetElement('fluorophoreFilter', 'Initialize filters');
    if (fluorophoreFilter) {
        fluorophoreFilter.value = 'all';
    }
    
    // Reset search input
    const searchInput = safeGetElement('searchWells', 'Initialize filters');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Apply the reset filters
    if (typeof filterTable === 'function') {
        filterTable();
    }
    
    // Also reset current filter mode via state management
    currentFilterMode = 'all';
    updateAppState({ currentFluorophore: 'all' });
}

// Utility function to wait for pathogen library to load
async function waitForPathogenLibrary(maxWaitMs = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
        if (typeof getRequiredChannels === 'function' && typeof PATHOGEN_LIBRARY !== 'undefined') {
            // console.log('✅ Pathogen library loaded successfully');
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // console.warn('⚠️ Pathogen library failed to load within timeout');
    return false;
}

// Pathogen target functions
function getPathogenTarget(testCode, fluorophore) {
    // Use PATHOGEN_LIBRARY directly if available, otherwise fallback
    if (typeof PATHOGEN_LIBRARY !== 'undefined' && testCode && fluorophore) {
        const testData = PATHOGEN_LIBRARY[testCode];
        if (testData && testData[fluorophore]) {
            // If object with .target, return .target, else convert to string
            if (typeof testData[fluorophore] === 'object' && testData[fluorophore] !== null) {
                if (testData[fluorophore].target) {
                    return String(testData[fluorophore].target);
                }
                // If it's an object without .target, convert the whole object to string
                return String(testData[fluorophore]);
            }
            // Always ensure we return a string
            return String(testData[fluorophore]);
        }
    }
    return String(fluorophore);
}

// Debug function to check pathogen library status
function debugPathogenLibrary() {
    // console.log('🔍 Pathogen Library Debug:', {
        // getRequiredChannelsAvailable: typeof getRequiredChannels === 'function',
        // pathogenLibraryAvailable: typeof PATHOGEN_LIBRARY !== 'undefined',
        // pathogenLibraryEntries: typeof PATHOGEN_LIBRARY !== 'undefined' ? Object.keys(PATHOGEN_LIBRARY).length : 0,
        // sampleEntries: typeof PATHOGEN_LIBRARY !== 'undefined' ? Object.keys(PATHOGEN_LIBRARY).slice(0, 5) : [],
        // validateChannelCompletenessAvailable: typeof validateChannelCompleteness === 'function'
    // });
    
    // Test getRequiredChannels with a known test
    if (typeof getRequiredChannels === 'function') {
        try {
            const testChannels = getRequiredChannels('Megasphaera');
            // console.log('✅ getRequiredChannels test (Megasphaera):', testChannels);
        } catch (error) {
            // console.error('❌ getRequiredChannels test failed:', error);
        }
    }
}

// Expose debug function to window for manual testing
window.debugPathogenLibrary = debugPathogenLibrary;

function extractTestCode(experimentPattern) {
    if (!experimentPattern) return "";
    const testName = experimentPattern.split('_')[0];
    return testName.startsWith('Ac') ? testName.substring(2) : testName;
}

// Modal navigation state
let modalNavigationList = [];
let currentModalIndex = -1;

// File upload handling
function extractBasePattern(filename) {
    // Handle Multi-Fluorophore Analysis names first
    if (filename.includes('Multi-Fluorophore Analysis')) {
        // Extract the actual experiment pattern from the end
        // "Multi-Fluorophore Analysis (Cy5, FAM, HEX) AcBVAB_2578825_CFX367393" -> "AcBVAB_2578825_CFX367393"
        const match = filename.match(/([A-Za-z][A-Za-z0-9]*_\d+_CFX\d+)$/i);
        if (match) {
            return match[1];
        }
        
        // Try alternative pattern if the above fails
        const parts = filename.split(' ');
        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i];
            if (/^[A-Za-z][A-Za-z0-9]*_\d+_CFX\d+$/.test(part)) {
                return part;
            }
        }
    }
    
    // Handle Multi-Fluorophore_ prefix format (session loading)
    if (filename.includes('Multi-Fluorophore_')) {
        // Extract pattern after "Multi-Fluorophore_"
        // "Multi-Fluorophore_AcBVAB_2578825_CFX367393" -> "AcBVAB_2578825_CFX367393"
        const pattern = filename.replace('Multi-Fluorophore_', '');
        // Validate the extracted pattern
        if (/^[A-Za-z][A-Za-z0-9]*_\d+_CFX\d+/.test(pattern)) {
            return pattern;
        }
    }
    
    // Extract base pattern from CFX Manager filename, handling trailing dashes
    // Examples: AcBVAB_2578825_CFX367393, AcBVAB_2578826_CFX367394-, AcBVAB_2578826_CFX367394-
    const pattern = /^([A-Za-z][A-Za-z0-9]*_\d+_CFX\d+)/i;
    const match = filename.match(pattern);
    if (match) {
        // Clean up any trailing dashes or spaces from the extracted pattern
        return match[1].replace(/[-\s]+$/, '');
    }
    return filename.split('.')[0].replace(/[-\s]+$/, '');
}

function extractTestName(filename) {
    // Extract test name from pattern (e.g., "AcBVAB" from "AcBVAB_2578825_CFX367393")
    const basePattern = extractBasePattern(filename);
    const testMatch = basePattern.match(/^([A-Za-z][A-Za-z0-9]*)/i);
    return testMatch ? testMatch[1] : basePattern;
}

function validateFilePattern(filename) {
    // Validate CFX Manager filename pattern
    const pattern = /^[A-Za-z][A-Za-z0-9]*_\d+_CFX\d+/i;
    return pattern.test(filename);
}

function handleFileUpload(file, type = 'amplification') {
    if (!file) {
        // console.error('🔍 UPLOAD - No file provided to handleFileUpload');
        return;
    }
    
    // console.log(`🔍 UPLOAD - Starting file upload: ${file.name}, type: ${type}, size: ${file.size} bytes`);
    
    // Validate filename pattern for CFX Manager format
    if (!validateFilePattern(file.name)) {
        alert(`Invalid filename pattern. Expected CFX Manager format: testName_1234567_CFX123456\nYour file: ${file.name}`);
        return;
    }
    
    // Enhanced validation for file naming conventions
    if (type === 'amplification') {
        // Validate that amplification files contain "Quantification Amplification Results"
        if (!file.name.includes('Quantification Amplification Results')) {
            alert(`Invalid amplification file name. File must contain "Quantification Amplification Results".\nYour file: ${file.name}\nExpected format: AcBVAB_2578825_CFX367393 - Quantification Amplification Results_Cy5.csv`);
            return;
        }
        
        // Check for duplicate amplification files
        const fluorophore = detectFluorophoreFromFilename(file.name);
        if (amplificationFiles[fluorophore]) {
            alert(`Duplicate amplification file detected for ${fluorophore}. Please remove the existing ${fluorophore} file before uploading a new one.\nExisting file: ${amplificationFiles[fluorophore].fileName}\nNew file: ${file.name}`);
            return;
        }
    } else if (type === 'samples') {
        // Validate that summary files contain "Quantification Summary"
        if (!file.name.includes('Quantification Summary')) {
            alert(`Invalid summary file name. File must contain "Quantification Summary".\nYour file: ${file.name}\nExpected format: AcBVAB_2578825_CFX367393 - Quantification Summary_0.csv`);
            return;
        }
        
        // Check for duplicate summary files
        if (samplesData && samplesData.fileName) {
            alert(`Duplicate summary file detected. Please remove the existing summary file before uploading a new one.\nExisting file: ${samplesData.fileName}\nNew file: ${file.name}`);
            return;
        }
    }
    
    // For amplification files, check base pattern consistency with existing files and summary
    if (type === 'amplification') {
        let referencePattern = null;
        
        // Check against existing amplification files
        if (Object.keys(amplificationFiles).length > 0) {
            const existingFiles = Object.values(amplificationFiles).map(f => f.fileName);
            referencePattern = extractBasePattern(existingFiles[0]);
        }
        // Check against summary file if no amplification files but summary exists
        else if (samplesData && samplesData.fileName) {
            referencePattern = extractBasePattern(samplesData.fileName);
        }
        
        if (referencePattern) {
            const newBasePattern = extractBasePattern(file.name);
            if (referencePattern !== newBasePattern) {
                alert(`File pattern mismatch! All files must share the same base pattern.\nExisting pattern: ${referencePattern}\nNew file pattern: ${newBasePattern}\n\nExample: AcBVAB_2578825_CFX367393 - only this part must match, suffixes can differ.`);
                return;
            }
        }
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const csv = e.target.result;
        Papa.parse(csv, {
            complete: function(results) {
                // console.log(`Parsed ${file.name}:`, results);
                
                if (type === 'amplification') {
                    // Detect fluorophore from filename
                    const fluorophore = detectFluorophoreFromFilename(file.name);
                    // console.log(`Detected fluorophore: ${fluorophore} for file: ${file.name}`);
                    
                    amplificationFiles[fluorophore] = {
                        data: results.data,
                        file: file,
                        fileName: file.name
                    };
                    updateAmplificationFilesList();
                    // Don't show status for amplification files - use the file list instead
                } else if (type === 'samples') {
                    // For summary files, check pattern consistency with existing amplification files
                    if (Object.keys(amplificationFiles).length > 0) {
                        const existingFiles = Object.values(amplificationFiles).map(f => f.fileName);
                        const existingBasePattern = extractBasePattern(existingFiles[0]);
                        const summaryBasePattern = extractBasePattern(file.name);
                        
                        if (existingBasePattern !== summaryBasePattern) {
                            alert(`Summary file pattern mismatch! Must match amplification files.\nAmplification files: ${existingBasePattern}\nSummary file: ${summaryBasePattern}\n\nAll files must share the same base pattern.`);
                            return;
                        }
                    }
                    
                    samplesData = {
                        data: results.data,
                        file: file,
                        fileName: file.name
                    };
                    updateFileStatus('samplesStatus', file.name, true);
                    // console.log('Samples data loaded:', samplesData);
                }
                
                displayFileInfo(file, results.data);
                checkAnalysisReady();
            },
            header: false,
            error: function(error) {
                // console.error('Papa Parse error:', error);
                updateFileStatus(type === 'amplification' ? 'amplificationStatus' : 'samplesStatus', file.name, false);
            }
        });
    };
    
    reader.onerror = function(error) {
        // console.error('FileReader error:', error);
        updateFileStatus(type === 'amplification' ? 'amplificationStatus' : 'samplesStatus', file.name, false);
    };
    
    reader.readAsText(file);
}

function updateFileStatus(statusId, fileName, success) {
    const statusElement = document.getElementById(statusId);
    if (statusElement) {
        if (success) {
            statusElement.innerHTML = `✓ ${fileName}`;
            statusElement.className = 'file-status success';
        } else {
            statusElement.innerHTML = `✗ Upload failed: ${fileName}`;
            statusElement.className = 'file-status error';
        }
    }
}

function clearFileStatus(statusId) {
    const statusElement = document.getElementById(statusId);
    if (statusElement) {
        statusElement.innerHTML = '';
        statusElement.className = 'file-status';
    }
}

function checkAnalysisReady() {
    const analysisButton = document.getElementById('analyzeBtn');
    const hasAmplificationFiles = Object.keys(amplificationFiles).length > 0;
    const hasSamplesData = samplesData !== null;
    
    // console.log('Check analysis ready:', {
        // amplificationFiles: Object.keys(amplificationFiles),
        // hasAmplificationFiles,
        // hasSamplesData,
        // samplesData: samplesData ? 'loaded' : 'null'
    // });
    
    if (analysisButton) {
        analysisButton.disabled = !(hasAmplificationFiles && hasSamplesData);
        analysisButton.textContent = hasAmplificationFiles && hasSamplesData ? 
            'Analyze qPCR Data' : 
            'Upload Files to Analyze';
    }
    
    // Always ensure upload buttons remain enabled
    ensureUploadButtonsEnabled();
}

function displayFileInfo(file, data) {
    // console.log(`File: ${file.name}`);
    // console.log('Data preview:', data.slice(0, 5));
    
    // Show file info section and update with comprehensive data
    updateFileInfoDisplay();
}

function updateFileInfoDisplay() {
    const fileInfo = document.getElementById('fileInfo');
    if (!fileInfo) return;
    
    // Only show if we have files
    if (Object.keys(amplificationFiles).length === 0 && !samplesData) {
        fileInfo.style.display = 'none';
        return;
    }
    
    fileInfo.style.display = 'block';
    
    // Get well count from any uploaded amplification file
    let wellCount = 0;
    let cycleCount = 0;
    let totalSize = 0;
    let fileNames = [];
    
    // Count wells from amplification files
    Object.values(amplificationFiles).forEach(fileData => {
        if (fileData && fileData.data && fileData.data.length > 0) {
            // Count wells from header row
            for (let colIndex = 0; colIndex < fileData.data[0].length; colIndex++) {
                const header = fileData.data[0][colIndex];
                if (header && header.match(/^[A-P](0?[1-9]|1[0-9]|2[0-4])$/)) {
                    wellCount++;
                }
            }
            // Calculate actual cycle count from unique cycle values
            const cycles = [];
            let cycleColumnIndex = 0;
            
            // Find cycle column (first column with 'cycle' in name or sequential numbers)
            const headers = fileData.data[0];
            for (let i = 0; i < headers.length; i++) {
                if (headers[i] && headers[i].toLowerCase().includes('cycle')) {
                    cycleColumnIndex = i;
                    break;
                }
            }
            
            // Extract unique cycle values
            for (let i = 1; i < fileData.data.length; i++) {
                const cellValue = fileData.data[i][cycleColumnIndex];
                if (cellValue !== undefined && cellValue !== '' && !isNaN(cellValue)) {
                    const cycleValue = parseFloat(cellValue);
                    if (!cycles.includes(cycleValue)) {
                        cycles.push(cycleValue);
                    }
                }
            }
            
            cycleCount = cycles.length;
            
            // Safe file size access
            if (fileData.file && fileData.file.size) {
                totalSize += fileData.file.size;
                fileNames.push(fileData.file.name);
            }
        }
    });
    
    // Add samples file info
    if (samplesData) {
        if (samplesData.file && samplesData.file.size) {
            totalSize += samplesData.file.size;
            fileNames.push(samplesData.file.name);
        }
    }
    
    // Update display elements
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const cycleRange = document.getElementById('cycleRange');
    const wellCountElement = document.getElementById('wellCount');
    
    if (fileName) {
        const fluorophores = Object.keys(amplificationFiles);
        const fluorophoreCount = fluorophores.length;
        const hassamples = samplesData ? ' + Summary' : '';
        
        if (fluorophoreCount > 0) {
            const fluorophoreList = fluorophores.join(', ');
            fileName.textContent = `${fluorophoreList}${hassamples}`;
        } else {
            fileName.textContent = hassamples ? 'Summary file only' : 'No files uploaded';
        }
    }
    if (fileSize) fileSize.textContent = `${(totalSize / 1024).toFixed(1)} KB total`;
    if (cycleRange) cycleRange.textContent = cycleCount > 0 ? `${cycleCount} cycles` : 'No cycles';
    if (wellCountElement) wellCountElement.textContent = `${wellCount} wells`;
}

// Analysis functions
async function performAnalysis() {
    // console.log('🔒 [ANALYSIS START] Starting fresh analysis');
    // console.log('🧪 ANALYSIS DEBUG - performAnalysis function called!');
    
    // Debug: Check current data state
    // console.log('🧪 ANALYSIS DEBUG - Current state:', {
        // amplificationFilesCount: Object.keys(amplificationFiles).length,
        // amplificationFiles: Object.keys(amplificationFiles),
        // hasSamplesData: samplesData !== null,
        // samplesDataType: typeof samplesData
    // });
    
    // 🧹 CONTAMINATION FIX: Clear all previous analysis and threshold data before starting new analysis
    // console.log('🧹 [PRE-ANALYSIS] Clearing previous data to prevent contamination');
    
    // Clear threshold data specifically
    channelThresholds = {};
    window.stableChannelThresholds = {};
    window.currentSessionId = null;
    
    // Clear previous analysis results
    currentAnalysisResults = null;
    window.currentAnalysisResults = null;
    analysisResults = null;
    
    // Update export state for cleared results
    updateExportState({ 
        hasAnalysisResults: false,
        isSessionLoaded: false 
    });
    
    // Destroy existing chart to prevent threshold contamination
    if (typeof safeDestroyChart === 'function') {
        safeDestroyChart();
    } else if (window.amplificationChart && typeof window.amplificationChart.destroy === 'function') {
        try {
            window.amplificationChart.destroy();
            window.amplificationChart = null;
        } catch (e) {
            // console.warn('Error destroying chart:', e);
        }
    }
    
    // Activate fresh analysis mode
    window.freshAnalysisMode = true;
    
    // console.log('🧹 [PRE-ANALYSIS] Data clearing complete - ready for fresh analysis');
    
    if (Object.keys(amplificationFiles).length === 0) {
        alert('Please upload at least one amplification CSV file (Cy5, FAM, HEX, or Texas Red)');
        return;
    }

    if (!samplesData) {
        alert('Please upload the Quantification Summary CSV file for sample names and Cq values');
        return;
    }

    const loadingIndicator = document.getElementById('loadingIndicator');
    const analyzeButton = document.querySelector('.analyze-btn');
    
    // Enhanced button state management
    if (analyzeButton) {
        analyzeButton.classList.add('processing');
        analyzeButton.disabled = true;
        analyzeButton.textContent = 'Analyzing Data...';
    }
    
    if (loadingIndicator) loadingIndicator.style.display = 'flex';

    try {
        // Get experiment pattern for tracking
        const experimentPattern = getCurrentFullPattern();
        const fluorophores = Object.keys(amplificationFiles);
        
        // console.log(`🔍 SEQUENTIAL-PROCESSING - Starting sequential analysis of ${fluorophores.length} fluorophores:`, fluorophores);
        // console.log(`🔍 SEQUENTIAL-PROCESSING - Experiment pattern: ${experimentPattern}`);
        
        // Display initial channel processing status
        displayChannelProcessingStatus(fluorophores, experimentPattern);
        
        // Process channels sequentially with transaction-like behavior
        const allResults = await processChannelsSequentially(fluorophores, experimentPattern);
        
        // console.log(`🔍 SEQUENTIAL-PROCESSING - All channels completed successfully:`, Object.keys(allResults));
        
        // Debug: Final check of allResults after sequential processing
        // console.log('🔍 SEQUENTIAL-COMPLETE - Final allResults after sequential processing:');
        Object.keys(allResults).forEach(key => {
            const result = allResults[key];
            // console.log(`  - FINAL ${key}: ${result ? 'HAS_DATA' : 'NULL'} | wells: ${Object.keys(result?.individual_results || {}).length} | success_rate: ${result?.success_rate}`);
            if (result && result.individual_results) {
                const wells = Object.keys(result.individual_results);
                // console.log(`    Sample wells: ${wells.slice(0, 5).join(', ')}${wells.length > 5 ? '...' : ''}`);
            }
        });
        
        // Hide channel processing status and show completion
        hideChannelProcessingStatus();
        
        // If only one fluorophore was analyzed, save it properly to database
        if (fluorophores.length === 1) {
            const singleResult = allResults[fluorophores[0]];
            if (!singleResult || !singleResult.individual_results) {
                alert('Error: No valid analysis results found for this channel. Please check your input files.');
                // console.error('❌ SINGLE-CHANNEL - No valid individual_results in singleResult:', singleResult);
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                return;
            }
            
            analysisResults = singleResult;

            // Set global variables for control grid access during fresh analysis
            // 🛡️ PROTECTED: Use safe setting to prevent contamination
            if (!setAnalysisResults(singleResult, 'fresh-analysis-single')) {
                // console.warn('🛡️ Single channel analysis result setting was blocked');
            }

            // Initialize channel thresholds after analysis results are loaded
            setTimeout(() => {
                if (window.initializeChannelThresholds) window.initializeChannelThresholds();
            }, 100);

            // Debug: Log the single result structure for control grid debugging
            // console.log('🔍 SINGLE-CHANNEL - Single result for control grid:', {
                // totalWells: Object.keys(singleResult.individual_results || {}).length,
                // fluorophore: fluorophores[0],
                // sampleKeys: Object.keys(singleResult.individual_results || {}).slice(0, 10)
            // });

            const filename = amplificationFiles[fluorophores[0]].fileName;

            // Save single fluorophore session to database with proper well counts
            await saveSingleFluorophoreSession(filename, singleResult, fluorophores[0]);

            // Save experiment statistics for trend analysis (single-channel) - with error handling
            try {
                const basePattern = extractBasePattern(filename);
                await saveExperimentStatistics(basePattern, allResults, fluorophores);
                // console.log('✅ Statistics saved successfully for single-channel');
            } catch (statsError) {
                // console.error('⚠️ Statistics save failed for single-channel (non-critical):', statsError);
                // Don't throw - statistics are optional
            }

            await displayAnalysisResults(singleResult);
        } else {
            // Filter out null/failed results before combining
            const validResults = {};
            Object.keys(allResults).forEach(fluorophore => {
                if (allResults[fluorophore] && allResults[fluorophore].individual_results) {
                    validResults[fluorophore] = allResults[fluorophore];
                } else {
                    // console.warn(`🔍 COMBINATION-FILTER - Excluding failed/null result for ${fluorophore}`);
                }
            });
            
            // console.log(`🔍 COMBINATION-FILTER - Filtered ${Object.keys(allResults).length} channels to ${Object.keys(validResults).length} valid channels`);
            
            // Calculate and display completion percentage
            const completionPercentage = ((Object.keys(validResults).length / Object.keys(allResults).length) * 100).toFixed(0);
            // console.log(`📊 PARTIAL-COMPLETION - ${completionPercentage}% of channels completed successfully`);
            
            if (Object.keys(validResults).length === 0) {
                throw new Error('No valid channel results available for combination');
            }
            
            // Combine all fluorophore results for multi-fluorophore display (SQL-integrated)
            const combinedResults = combineMultiFluorophoreResultsSQL(validResults);
            analysisResults = combinedResults;
            
            // 🔍 POST-COMBINE DEBUG: Check if combinedResults are complete
            // console.log('🔍 POST-COMBINE-DEBUG - Results after combination:', {
                // combinedResultsExists: !!combinedResults,
                // hasIndividualResults: !!(combinedResults?.individual_results),
                // totalWellsInCombined: Object.keys(combinedResults?.individual_results || {}).length,
                // fluorophoreCount: combinedResults?.fluorophore_count || 0,
                // firstTenWells: Object.keys(combinedResults?.individual_results || {}).slice(0, 10),
                // fluorophoreBreakdown: (() => {
                    // const wells = combinedResults?.individual_results || {};
                    // const breakdown = {};
                    // Object.keys(wells).forEach(wellKey => {
                        // const fluorophore = wells[wellKey].fluorophore || 'Unknown';
                        // breakdown[fluorophore] = (breakdown[fluorophore] || 0) + 1;
                    // });
                    // return breakdown;
                // })()
            // });
            
            // Set global variables for control grid access during fresh analysis
            // 🛡️ PROTECTED: Use safe setting to prevent contamination
            if (!setAnalysisResults(combinedResults, 'fresh-analysis-combined')) {
                // console.warn('🛡️ Combined channel analysis result setting was blocked');
            }
            
            // Initialize channel thresholds after analysis results are loaded
            setTimeout(() => {
                if (window.initializeChannelThresholds) window.initializeChannelThresholds();
            }, 100);
            
            // Debug: Log the combined results structure for control grid debugging
            // console.log('🔍 MULTI-CHANNEL - Combined results for control grid:', {
                // totalWells: Object.keys(combinedResults.individual_results || {}).length,
                // fluorophoreCount: combinedResults.fluorophore_count || 0,
                // sampleKeys: Object.keys(combinedResults.individual_results || {}).slice(0, 10)
            // });
            
            // Use the base pattern from the first file for consistent naming
            const firstFileName = Object.values(amplificationFiles)[0].fileName;
            const basePattern = extractBasePattern(firstFileName);
            const filename = `Multi-Fluorophore_${basePattern}`;
            
            // Save combined session to database with partial completion info
            await saveCombinedSession(filename, combinedResults, Object.keys(validResults));
            
            // Save experiment statistics for trend analysis - with error handling
            try {
                await saveExperimentStatistics(basePattern, validResults, Object.keys(validResults));
                // console.log('✅ Statistics saved successfully for multi-channel');
            } catch (statsError) {
                // console.error('⚠️ Statistics save failed for multi-channel (non-critical):', statsError);
                // Don't throw - statistics are optional
            }
            
            // Add completion status to results for UI display
            combinedResults.partialCompletion = {
                successful: Object.keys(validResults).length,
                total: Object.keys(allResults).length,
                percentage: ((Object.keys(validResults).length / Object.keys(allResults).length) * 100).toFixed(0),
                failedChannels: Object.keys(allResults).filter(k => !allResults[k])
            };
            
            await displayMultiFluorophoreResults(combinedResults);
        }
        
    } catch (error) {
        // console.error('Analysis error:', error);
        alert('Error performing analysis: ' + error.message);
    } finally {
        // Restore button state
        const analyzeButton = document.querySelector('.analyze-btn');
        if (analyzeButton) {
            analyzeButton.classList.remove('processing');
            analyzeButton.disabled = false;
            analyzeButton.textContent = 'Analyze qPCR Data';
        }
        
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

// Display functions
async function displayAnalysisResults(results) {
    // Ensure global is set before any UI/chart calls
    window.currentAnalysisResults = results;
    
    // IMMEDIATE: Initialize thresholds as soon as analysis results are available
    if (window.initializeChannelThresholds) {
        // console.log('🔍 THRESHOLD-INIT - Initializing thresholds immediately after setting analysis results');
        window.initializeChannelThresholds();
        
        // Also immediately update threshold UI elements
        setTimeout(() => {
            if (window.updateAllChannelThresholds) {
                // console.log('🔍 THRESHOLD-INIT - Updating threshold UI elements');
                window.updateAllChannelThresholds();
            }
        }, 50);
    }
    
    // Update export state for new analysis results
    updateExportState({ 
        hasAnalysisResults: !!(results && results.individual_results && Object.keys(results.individual_results).length > 0),
        isSessionLoaded: false 
    });
    
    // Clear previous experiment data RIGHT BEFORE displaying new results
    clearPreviousExperimentData();
    
    if (!results || !results.individual_results) {
        // console.error('Invalid results structure:', results);
        alert('Error: Invalid analysis results received');
        return;
    }
    
    const analysisSection = document.getElementById('analysisSection');
    if (analysisSection) {
        analysisSection.style.display = 'block';
    }
    
    // Handle different response structures
    const individualResults = results.individual_results || {};
    const cycleInfo = results.cycle_info || results.summary?.cycle_info;
    
    // Calculate statistics separated by patient samples and controls
    const fluorophoreStats = calculateFluorophoreStats(individualResults);
    const totalWells = Object.keys(individualResults).length;
    const patientSamples = fluorophoreStats.patientSamples;
    const controls = fluorophoreStats.controls;
    const patientPositivePercentage = patientSamples.total > 0 ? ((patientSamples.positive / patientSamples.total) * 100).toFixed(1) : 0;
    const controlPositivePercentage = controls.total > 0 ? ((controls.positive / controls.total) * 100).toFixed(1) : 0;
    
    // Get experiment pattern name
    const experimentPattern = getCurrentFullPattern();
    
    // Update summary statistics with separated patient and control data
    const experimentPatternEl = document.getElementById('experimentPattern');
    const totalPositiveEl = document.getElementById('totalPositive');
    const positivePercentageEl = document.getElementById('positivePercentage');
    const cycleRangeEl = document.getElementById('cycleRangeResult');
    
    if (experimentPatternEl) experimentPatternEl.textContent = experimentPattern;
    if (totalPositiveEl) totalPositiveEl.textContent = patientSamples.total;
    if (positivePercentageEl) positivePercentageEl.textContent = `${patientSamples.positive} ${patientPositivePercentage}%`;
    
    // Update control statistics if controls exist
    updateControlStatistics(controls, controlPositivePercentage);
    
    // Update cycle range
    if (cycleInfo && cycleRangeEl) {
        cycleRangeEl.textContent = `${cycleInfo.min} - ${cycleInfo.max} (${cycleInfo.count} cycles)`;
    } else if (cycleRangeEl) {
        // Try to calculate cycle range from individual results
        const calculatedCycleInfo = calculateCycleRangeFromResults(individualResults);
        if (calculatedCycleInfo) {
            cycleRangeEl.textContent = `${calculatedCycleInfo.min} - ${calculatedCycleInfo.max} (${calculatedCycleInfo.count} cycles)`;
        } else {
            cycleRangeEl.textContent = 'N/A';
        }
    }
    
    // Display fluorophore-specific breakdown using patient samples only
    displayFluorophoreBreakdown(fluorophoreStats.byFluorophore, patientSamples, controls);
    
    // Update wells analysis title with experiment name
    const wellsTitle = document.getElementById('wellsAnalysisTitle');
    if (wellsTitle) {
        wellsTitle.textContent = `${experimentPattern} - All Wells Analysis`;
    }
    
    // Always add fluorophore filter for context, even with single fluorophore
    addFluorophoreFilter(individualResults);
    
    // Validate controls and display alerts if needed
    const controlIssues = validateControls(individualResults);
    displayControlValidationAlerts(controlIssues);
    
    // Display pathogen control grids for visual validation
    const testCode = extractTestCode(experimentPattern);
    // console.log('🔍 FRESH UPLOAD - Creating control grid for testCode:', testCode);
    // console.log('🔍 FRESH UPLOAD - Experiment pattern:', experimentPattern);
    // console.log('🔍 FRESH UPLOAD - Current analysis results available:', !!currentAnalysisResults);
    // console.log('🔍 FRESH UPLOAD - Individual results count:', Object.keys(individualResults).length);
    
    // Debug the structure of individual results
    // console.log('🔍 FRESH UPLOAD - Individual results structure:');
    const sampleKeys = Object.keys(individualResults).slice(0, 5);
    sampleKeys.forEach(key => {
        const result = individualResults[key];
        // console.log(`  ${key}:`, {
            // sample_name: result.sample_name || result.sample,
            // well_id: result.well_id,
            // fluorophore: result.fluorophore,
            // amplitude: result.amplitude,
            // keys: Object.keys(result)
        // });
    });
    
    if (testCode) {
        // Clear any existing control grids first to prevent duplicates
        const pathogenGridsContainer = document.getElementById('pathogenControlGrids');
        if (pathogenGridsContainer) {
            pathogenGridsContainer.innerHTML = '';
            pathogenGridsContainer.style.display = 'none';
        }
        
        // Use the real control grid system (createPathogenControlGrids)
        // Extract real control coordinates using same logic as history loads
        const wellsArray = Object.values(individualResults);
        // console.log('🔍 FRESH UPLOAD - Converting to wells array, length:', wellsArray.length);
        // console.log('🔍 FRESH UPLOAD - First well in array:', wellsArray[0]);
        
        const { controlsByType, controlsByChannel } = extractRealControlCoordinates(wellsArray, testCode);
        
        // Use the controlsByChannel structure for grid creation
        createPathogenControlGrids(controlsByChannel, testCode);
    } else {
        // console.log('🔍 FRESH UPLOAD - Could not extract test code from pattern:', experimentPattern);
        // console.log('🔍 FRESH UPLOAD - Available amplification files:', Object.keys(amplificationFiles || {}));
        // console.log('🔍 FRESH UPLOAD - First file name:', Object.values(amplificationFiles || {})[0]?.fileName);
    }
    
    populateWellSelector(individualResults);
    populateResultsTable(individualResults);

    // --- Force "Show All Curves" view and activate button after analysis loads ---
    setTimeout(() => {
        const wellSelector = document.getElementById('wellSelect');
        if (wellSelector) {
            const allOption = Array.from(wellSelector.options).find(opt => opt.value === 'ALL_WELLS');
            if (allOption) {
                wellSelector.value = 'ALL_WELLS';
                // COMMENTED OUT - Duplicate chart creation, CSMS handles initial chart
                // if (typeof showAllCurves === 'function') showAllCurves('all');
            } else {
                if (typeof initializeChartDisplay === 'function') initializeChartDisplay();
            }
        } else {
            if (typeof initializeChartDisplay === 'function') initializeChartDisplay();
        }
        // Reset filters to default state after loading results
        if (typeof initializeFilters === 'function') initializeFilters();
        // Update export button validation after loading session
        if (typeof updateExportButton === 'function') updateExportButton(false, []);
        // Activate the Show All button
        const showAllBtn = document.getElementById('showAllBtn');
        if (showAllBtn) showAllBtn.classList.add('active');
    }, 400);

    // Show first well by default
    const firstWell = Object.keys(individualResults)[0];
    if (firstWell) {
        showWellDetails(firstWell);
    }

    // Mark this as fresh analysis to ensure validation display shows
    currentAnalysisResults.freshAnalysis = true;

    // Update pathogen channel validation status for fresh analysis
    await updatePathogenChannelStatusInBreakdown();

    document.getElementById('analysisSection').scrollIntoView({ behavior: 'smooth' });
}

async function displayMultiFluorophoreResults(results) {
    // Ensure global is set before any UI/chart calls
    window.currentAnalysisResults = results;
    
    // IMMEDIATE: Initialize thresholds as soon as analysis results are available
    if (window.initializeChannelThresholds) {
        // console.log('🔍 THRESHOLD-INIT - Initializing thresholds immediately after setting analysis results');
        window.initializeChannelThresholds();
        
        // Also immediately update threshold UI elements
        setTimeout(() => {
            if (window.updateAllChannelThresholds) {
                // console.log('🔍 THRESHOLD-INIT - Updating threshold UI elements');
                window.updateAllChannelThresholds();
            }
        }, 50);
    }
    
    // Update export state for new analysis results
    updateExportState({ 
        hasAnalysisResults: !!(results && results.individual_results && Object.keys(results.individual_results).length > 0),
        isSessionLoaded: false 
    });
    
    // Clear previous experiment data RIGHT BEFORE displaying new results
    clearPreviousExperimentData();
    
    // console.log('🔍 DISPLAY-DEBUG - Displaying multi-fluorophore results:', {
        // resultsExists: !!results,
        // hasIndividualResults: !!(results?.individual_results),
        // individualResultsType: typeof results?.individual_results,
        // totalWellsReceived: Object.keys(results?.individual_results || {}).length,
        // fluorophoreCount: results?.fluorophore_count || 0,
        // firstTenWellKeys: Object.keys(results?.individual_results || {}).slice(0, 10),
        // fluorophoreBreakdown: (() => {
            // const wells = results?.individual_results || {};
            // const breakdown = {};
            // Object.keys(wells).forEach(wellKey => {
                // const fluorophore = wells[wellKey].fluorophore || 'Unknown';
                // breakdown[fluorophore] = (breakdown[fluorophore] || 0) + 1;
            // });
            // return breakdown;
        // })(),
        // resultsStructure: results
    // });
    
    if (!results || !results.individual_results) {
        // console.error('Invalid multi-fluorophore results structure:', results);
        alert('Error: Invalid multi-fluorophore analysis results received');
        return;
    }

    // Display partial completion status if present
    if (results.partialCompletion && results.partialCompletion.total > results.partialCompletion.successful) {
        // console.log(`📊 PARTIAL-LOAD - Displaying ${results.partialCompletion.percentage}% complete multichannel analysis`);
        
        // Show a notification about partial completion
        const partialNotification = document.createElement('div');
        partialNotification.className = 'partial-completion-notice';
        partialNotification.style.cssText = `
            background: linear-gradient(135deg, #ff9500, #ff6b00);
            color: white;
            padding: 12px 20px;
            margin: 10px 0;
            border-radius: 8px;
            font-weight: bold;
            text-align: center;
            box-shadow: 0 2px 10px rgba(255, 149, 0, 0.3);
        `;
        partialNotification.innerHTML = `
            <span style="font-size: 1.1em;">⚠️ Partial Analysis Complete</span><br>
            <span style="font-size: 0.9em;">
                ${results.partialCompletion.successful}/${results.partialCompletion.total} channels loaded successfully (${results.partialCompletion.percentage}%)
                ${results.partialCompletion.failedChannels.length > 0 ? 
                    `<br>Failed: ${results.partialCompletion.failedChannels.join(', ')}` : ''}
            </span>
        `;
        
        // Insert notification before analysis section
        const analysisSection = document.getElementById('analysisSection');
        if (analysisSection) {
            analysisSection.parentNode.insertBefore(partialNotification, analysisSection);
            
            // Auto-remove notification after 10 seconds
            setTimeout(() => {
                if (partialNotification.parentNode) {
                    partialNotification.parentNode.removeChild(partialNotification);
                }
            }, 10000);
        }
    }
    
    const analysisSection = document.getElementById('analysisSection');
    analysisSection.style.display = 'block';
    
    // Calculate statistics separated by patient samples and controls
    const individualResults = results.individual_results;
    const fluorophoreStats = calculateFluorophoreStats(individualResults);
    const totalWells = Object.keys(individualResults).length;
    const patientSamples = fluorophoreStats.patientSamples;
    const controls = fluorophoreStats.controls;
    const patientPositivePercentage = patientSamples.total > 0 ? ((patientSamples.positive / patientSamples.total) * 100).toFixed(1) : 0;
    const controlPositivePercentage = controls.total > 0 ? ((controls.positive / controls.total) * 100).toFixed(1) : 0;
    
    // Get experiment pattern name
    const experimentPattern = getCurrentFullPattern();
    
    // Update summary statistics with separated patient and control data
    document.getElementById('experimentPattern').textContent = experimentPattern;
    document.getElementById('totalPositive').textContent = patientSamples.total;
    document.getElementById('positivePercentage').textContent = `${patientSamples.positive} (${patientPositivePercentage}%)`;
    
    // Update control statistics if controls exist
    updateControlStatistics(controls, controlPositivePercentage);
    
    // Update cycle range if available
    if (results.cycle_info) {
        document.getElementById('cycleRangeResult').textContent = 
            `${results.cycle_info.min} - ${results.cycle_info.max} (${results.cycle_info.count} cycles)`;
    } else {
        // Try to calculate cycle range from individual results
        const cycleInfo = calculateCycleRangeFromResults(individualResults);
        if (cycleInfo) {
            document.getElementById('cycleRangeResult').textContent = 
                `${cycleInfo.min} - ${cycleInfo.max} (${cycleInfo.count} cycles)`;
        }
    }
    
    // Display fluorophore-specific breakdown using patient samples only
    displayFluorophoreBreakdown(fluorophoreStats.byFluorophore, patientSamples, controls);
    
    // Update wells analysis title with experiment name
    const wellsTitle = document.getElementById('wellsAnalysisTitle');
    if (wellsTitle) {
        wellsTitle.textContent = `${experimentPattern} - All Wells Analysis`;
    }
    
    // Add fluorophore filter for multi-fluorophore results
    addFluorophoreFilter(results.individual_results);
    
    // Validate controls and display alerts if needed
    const controlIssues = validateControls(results.individual_results);
    displayControlValidationAlerts(controlIssues);
    
    // Validate and display H, M, L, NTC control status (with error handling)
    try {
        const wellResultsArray = Object.values(results.individual_results);
        const controlValidation = validateControlTypes(wellResultsArray);
        updateControlValidationDisplay(controlValidation);
    } catch (error) {
        // console.warn('Control validation error:', error);
        // Hide control validation section if there's an error
        const controlValidationSection = document.getElementById('controlValidation');
        if (controlValidationSection) {
            controlValidationSection.style.display = 'none';
        }
    }
    
    // Populate well selector and results table
    // Diagnostic: Check for missing sample names before rendering
    const missingSampleNames = Object.entries(results.individual_results).filter(([key, result]) => !result.sample_name && !result.sample);
    if (missingSampleNames.length > 0) {
        // console.warn('⚠️ Some wells are missing sample names:', missingSampleNames.map(([key]) => key));
    } else {
        // console.log('✅ All wells have sample names.');
    }
    populateWellSelector(results.individual_results);
    populateResultsTable(results.individual_results);
    
    // Create control grids for multi-fluorophore analysis
    const testCode = extractTestCode(experimentPattern);
    
    // console.log('🔍 MULTI-FLUOROPHORE - Control grid check:', {
        // testCode: testCode,
        // experimentPattern: experimentPattern,
        // currentSessionFilename: window.currentSessionFilename
    // });
    
    if (testCode) {
        // console.log('🔍 MULTI-FLUOROPHORE - Extracted test code for control grids:', testCode);
        
        // Clear any existing control grids first to prevent duplicates
        const pathogenGridsContainer = document.getElementById('pathogenControlGrids');
        if (pathogenGridsContainer) {
            pathogenGridsContainer.innerHTML = '';
            pathogenGridsContainer.style.display = 'none';
        }
        
        // Use the real control grid system (createPathogenControlGrids)
        // Extract real control coordinates using same logic as history loads
        const wellsArray = Object.values(results.individual_results);
        const { controlsByType, controlsByChannel } = extractRealControlCoordinates(wellsArray, testCode);
        
        // Use the controlsByChannel structure for grid creation
        createPathogenControlGrids(controlsByChannel, testCode);
    } else {
        // console.log('🔍 MULTI-FLUOROPHORE - Could not extract test code from pattern:', experimentPattern);
    }
    
    // Match curve details size to analysis summary
    matchCurveDetailsSize();
    
    // Show first well by default
    const firstWell = Object.keys(results.individual_results)[0];
    if (firstWell) {
        showWellDetails(firstWell);
    }
    
    // Save multi-fluorophore session to database
    if (results.individual_results && Object.keys(results.individual_results).length > 0) {
        saveCombinedSessionToDatabase(results, experimentPattern);
    }
    
    // Mark this as fresh analysis to ensure validation display shows
    currentAnalysisResults.freshAnalysis = true;
    
    // Update pathogen channel validation status for fresh analysis
    await updatePathogenChannelStatusInBreakdown();
    
    // Initialize chart display after DOM updates complete
    setTimeout(() => {
        // Show "All Wells" overlay by default if possible
        const wellSelector = document.getElementById('wellSelect');
        if (wellSelector) {
            const allOption = Array.from(wellSelector.options).find(opt => opt.value === 'ALL_WELLS');
            if (allOption) {
                wellSelector.value = 'ALL_WELLS';
                // COMMENTED OUT - Duplicate chart creation, CSMS handles initial chart
                // if (typeof showAllCurves === 'function') showAllCurves('all');
            } else {
                initializeChartDisplay();
            }
        } else {
            initializeChartDisplay();
        }
        // Reset filters to default state after loading results
        initializeFilters();
        // Update export button validation after loading session
        updateExportButton(false, []);
        
        // Check for pathogen grid data from loaded sessions - use individual_results which contains the actual data
        // console.log('🔍 PATHOGEN GRIDS - Checking currentAnalysisResults structure:', {
            // hasCurrentAnalysisResults: !!currentAnalysisResults,
            // hasIndividualResults: !!(currentAnalysisResults && currentAnalysisResults.individual_results),
            // individualResultsType: currentAnalysisResults && currentAnalysisResults.individual_results ? typeof currentAnalysisResults.individual_results : 'none'
        // });
        
        // Use individual_results which is where the actual well data is stored in loaded sessions
        if (currentAnalysisResults && currentAnalysisResults.individual_results) {
            // Set global variable for pathogen grid access
            window.currentAnalysisResults = currentAnalysisResults.individual_results;
            // console.log('🔍 PATHOGEN GRIDS - Set global currentAnalysisResults from individual_results:', Object.keys(currentAnalysisResults.individual_results).length, 'wells');
            
            // Control validation already handled above - no need to call again here
            // console.log('🔍 CONTROL VALIDATION - Already applied above, skipping duplicate call');
            
            const testCode = extractTestCode(getCurrentFullPattern());
            
            // console.log('🔍 PATHOGEN GRIDS - Creating grids for loaded session:', testCode);
            // Use the real control grid system (extractRealControlCoordinates)
            const wellsArray = Object.values(currentAnalysisResults.individual_results);
            const { controlsByType, controlsByChannel } = extractRealControlCoordinates(wellsArray, testCode);
            
            // Use the controlsByChannel structure for grid creation
            createPathogenControlGrids(controlsByChannel, testCode);
        }
    }, 400);
    
    document.getElementById('analysisSection').scrollIntoView({ behavior: 'smooth' });
}

// Save combined multi-fluorophore session to database
async function saveCombinedSessionToDatabase(results, experimentPattern) {
    try {
        // console.log('Saving combined multi-fluorophore session to database...');
        
        // Get fluorophores from results
        const fluorophores = [];
        for (const wellKey in results.individual_results) {
            const fluorophore = extractFluorophoreFromWellId(wellKey);
            if (fluorophore && !fluorophores.includes(fluorophore)) {
                fluorophores.push(fluorophore);
            }
        }
        
        // Only save multi-fluorophore session if we have data from multiple fluorophores
        if (fluorophores.length < 2) {
            // console.log('Skipping combined session save - only single fluorophore detected');
            return;
        }
        
        const sessionData = {
            filename: `Multi-Fluorophore_${experimentPattern}`,
            combined_results: results,
            fluorophores: fluorophores
        };
        
        const response = await fetch('/sessions/save-combined', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionData)
        });
        
        if (response.ok) {
            const result = await response.json();
            // console.log('Combined session saved successfully:', result.session_id);
            
            // Set current session ID for threshold updates
            if (result.session_id) {
                window.currentSessionId = result.session_id;
                // console.log(`🔍 SESSION-ID - Set current session ID after save: ${result.session_id}`);
            }
        } else {
            const error = await response.json();
            // console.warn('Failed to save combined session:', error.error);
        }
    } catch (error) {
        // console.warn('Error saving combined session:', error);
    }
}

// Initialize chart display with first available well
function initializeChartDisplay() {
    if (!currentAnalysisResults || !currentAnalysisResults.individual_results) return;
    
    const wellSelector = document.getElementById('wellSelect');
    if (wellSelector && wellSelector.options.length > 1) {
        // Select first actual well (skip "All Wells" option)
        wellSelector.selectedIndex = 1;
        const selectedWell = wellSelector.value;
        if (selectedWell && selectedWell !== 'ALL_WELLS') {
            showWellDetails(selectedWell);
            // console.log('Chart initialized with well:', selectedWell);
        }
    }
}

// Global variable to store current results for filtering (already declared at top)

// Unified chart creation function to prevent multiple chart initialization conflicts
function createUnifiedChart(chartType, selectedFluorophore = 'all', filterType = 'all') {
    // Prevent multiple simultaneous chart initializations
    if (window.chartInitializing) {
        // console.log(`[CHART-INIT] Chart initialization already in progress, skipping ${chartType} request`);
        return;
    }
    
    if (!currentAnalysisResults || !currentAnalysisResults.individual_results) {
        // console.warn(`[CHART-LOADING] Analysis results not yet available for ${chartType}, skipping chart update`);
        return;
    }
    
    // Set flag to prevent concurrent chart creation
    window.chartInitializing = true;
    
    // console.log(`Creating unified chart: ${chartType} for fluorophore: ${selectedFluorophore} with filter: ${filterType}`);
    
    const ctx = document.getElementById('amplificationChart').getContext('2d');
    
    // Destroy existing chart safely
    safeDestroyChart();
    
    const datasets = [];
    const results = currentAnalysisResults.individual_results;
    
    Object.keys(results).forEach((wellKey, index) => {
        const wellData = results[wellKey];
        
        // Apply filtering based on filterType
        if (!shouldIncludeWell(wellData, filterType)) {
            return;
        }
        
        // Filter by fluorophore if specified
        if (selectedFluorophore !== 'all' && wellData.fluorophore !== selectedFluorophore) {
            return;
        }
        
        try {
            const cycles = typeof wellData.raw_cycles === 'string' ? 
                JSON.parse(wellData.raw_cycles) : wellData.raw_cycles;
            const rfu = typeof wellData.raw_rfu === 'string' ? 
                JSON.parse(wellData.raw_rfu) : wellData.raw_rfu;
            
            if (cycles && rfu && cycles.length === rfu.length) {
                const wellId = wellData.well_id || wellKey.split('_')[0];
                const fluorophore = wellData.fluorophore || 'Unknown';
                
                // Create dataset with appropriate styling
                const dataset = createDatasetForWell(wellId, fluorophore, cycles, rfu, index, chartType);
                datasets.push(dataset);
            }
        } catch (error) {
            // console.warn(`Error processing well ${wellKey}:`, error);
        }
    });
    
    if (datasets.length === 0) {
        // console.warn(`No data available for ${chartType} chart with filter ${filterType}`);
        return;
    }
    
    // Create chart configuration
    const chartConfig = createChartConfiguration(
        chartType === 'single' ? 'scatter' : 'line',
        datasets,
        getChartTitle(chartType, selectedFluorophore, filterType)
    );
    
    // Configure chart options based on type
    configureChartOptions(chartConfig, chartType, datasets.length);
    
    // Set flag to prevent threshold conflicts during chart creation
    window.chartUpdating = true;
    
    window.amplificationChart = new Chart(ctx, chartConfig);
    
    // Clear flags after a short delay to allow animation to start
    setTimeout(() => {
        window.chartUpdating = false;
        window.chartInitializing = false;
        
        // CRITICAL: Apply thresholds AFTER chart is fully created and flags are cleared
        // This prevents the threshold overlay problem in multichannel mode
        setTimeout(() => {
            if (window.amplificationChart && window.updateAllChannelThresholds) {
                console.log('🔍 CHART-INIT - Applying thresholds after chart creation');
                window.updateAllChannelThresholds();
            }
        }, 150);  // Extra delay to ensure chart is fully stable
    }, 100);
    
    // Update visible channels set for threshold tracking
    updateVisibleChannels(selectedFluorophore, datasets);
    
    // console.log(`🔍 UNIFIED-CHART - Chart created for ${selectedFluorophore} (${datasets.length} datasets), thresholds will follow via animation callback`);
}

// Helper function to determine if a well should be included based on filter type
function shouldIncludeWell(wellData, filterType) {
    const amplitude = wellData.amplitude || 0;
    const isGoodSCurve = wellData.is_good_scurve || false;
    
    switch (filterType) {
        case 'all':
            return true;
        case 'good':
            return amplitude > 500;
        case 'pos':
            return isGoodSCurve && amplitude > 500;
        case 'neg':
            return isGoodSCurve && amplitude <= 500;
        case 'redo':
            return !isGoodSCurve;
        default:
            return true;
    }
}

// Helper function to create dataset for a well
function createDatasetForWell(wellId, fluorophore, cycles, rfu, index, chartType) {
    const color = getFluorophoreColor(fluorophore);
    const lightColor = lightenColor(color, 0.25);
    
    return {
        label: `${wellId} (${fluorophore})`,
        data: cycles.map((cycle, i) => ({ x: cycle, y: rfu[i] })),
        borderColor: lightColor,
        backgroundColor: 'transparent',
        borderWidth: chartType === 'single' ? 2 : 1,
        pointRadius: chartType === 'single' ? 1 : 0,
        showLine: true,
        tension: 0.4
    };
}

// Helper function to get chart title
function getChartTitle(chartType, selectedFluorophore, filterType) {
    const fluorophoreText = selectedFluorophore === 'all' ? 'All Fluorophores' : selectedFluorophore;
    
    switch (chartType) {
        case 'single':
            return `qPCR Amplification Curve - ${fluorophoreText}`;
        case 'multi':
            const filterText = filterType === 'all' ? 'All Curves' : 
                              filterType === 'good' ? 'Positive Curves' :
                              filterType === 'pos' ? 'POS Curves' :
                              filterType === 'neg' ? 'NEG Curves' :
                              filterType === 'redo' ? 'REDO Curves' : 'Filtered Curves';
            return `${filterText} - ${fluorophoreText}`;
        default:
            return `qPCR Amplification Chart - ${fluorophoreText}`;
    }
}

// Helper function to configure chart options based on type
function configureChartOptions(chartConfig, chartType, datasetCount) {
    if (chartType === 'multi') {
        // For multi-curve charts, adjust legend and tooltip based on dataset count
        chartConfig.options.plugins.legend.display = datasetCount <= 10;
        chartConfig.options.plugins.tooltip.enabled = datasetCount <= 20;
    } else {
        // For single curves, show legend and tooltips
        chartConfig.options.plugins.legend.display = true;
        chartConfig.options.plugins.tooltip.enabled = true;
    }
}

// Helper function to update visible channels for threshold tracking
function updateVisibleChannels(selectedFluorophore, datasets) {
    if (selectedFluorophore === 'all') {
        // Extract all fluorophores from datasets
        window.visibleChannels = new Set();
        datasets.forEach(dataset => {
            const match = dataset.label.match(/\(([^)]+)\)/);
            if (match && match[1] !== 'Unknown') {
                window.visibleChannels.add(match[1]);
            }
        });
    } else {
        window.visibleChannels = new Set([selectedFluorophore]);
    }
    
    // console.log(`🔍 UNIFIED-CHART - Chart setup complete for channels: ${Array.from(window.visibleChannels || []).join(', ')}`);
}

function populateFluorophoreSelector(individualResults) {
    const fluorophoreSelector = document.getElementById('fluorophoreSelect');
    if (!fluorophoreSelector) return;
    
    // Store results globally for filtering
    // 🛡️ PROTECTED: Use safe setting to prevent contamination
    if (!setAnalysisResults({ individual_results: individualResults }, 'fresh-analysis-individual')) {
        // console.warn('🛡️ Individual results setting was blocked');
    }
    
    // Clear existing options except "All Fluorophores"
    fluorophoreSelector.innerHTML = '<option value="all">All Fluorophores</option>';
    
    // Get unique fluorophores
    const fluorophores = [...new Set(Object.values(individualResults).map(result => result.fluorophore || 'Unknown'))];
    const fluorophoreOrder = ['FAM', 'HEX', 'Texas Red', 'Cy5'];
    
    // Sort fluorophores
    fluorophores.sort((a, b) => {
        const aIndex = fluorophoreOrder.indexOf(a);
        const bIndex = fluorophoreOrder.indexOf(b);
        
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
    });
    
    // Get current experiment pattern and extract test code for pathogen targets
    const experimentPattern = getCurrentFullPattern();
    const testCode = extractTestCode(experimentPattern);
    
    // Add fluorophore options with well counts and pathogen targets
    fluorophores.forEach(fluorophore => {
        const count = Object.values(individualResults).filter(result => 
            (result.fluorophore || 'Unknown') === fluorophore
        ).length;
        
        // Get pathogen target for this fluorophore
        const pathogenTarget = getPathogenTarget(testCode, fluorophore);
        const displayTarget = pathogenTarget !== "Unknown" ? ` - ${pathogenTarget}` : "";
        
        const option = document.createElement('option');
        option.value = fluorophore;
        option.textContent = `${fluorophore}${displayTarget} (${count} wells)`;
        fluorophoreSelector.appendChild(option);
    });
    
    // Add event listener for fluorophore filtering - uses state management
fluorophoreSelector.addEventListener('change', function() {
    const selectedFluorophore = this.value;
    // console.log('🔄 FLUOROPHORE - Selector changed to:', selectedFluorophore);
    
    // Update app state - this will coordinate all UI elements
    updateAppState({
        currentFluorophore: selectedFluorophore
    });
    
    // Update threshold input for new fluorophore
    setTimeout(() => {
        updateThresholdInputFromState();
    }, 50);
    
    // Reset chart mode to 'all' and update display
    currentChartMode = 'all';
    updateChartDisplayMode();
    
    // Update button states to reflect 'all' mode
    const buttons = document.querySelectorAll('.view-controls .control-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    const showAllBtn = document.getElementById('showAllBtn');
    if (showAllBtn) {
        showAllBtn.classList.add('active');
    }
});
}

/**
 * Universal filter synchronization function to ensure all filter dropdowns match table state
 */
function synchronizeAllFilterStates() {
    // console.log('🔄 SYNC - Starting universal filter state synchronization');
    
    try {
        // Get current visible wells in table
        const visibleWells = [];
        const tableRows = document.querySelectorAll('#resultsTable tbody tr:not([style*="display: none"])');
        
        tableRows.forEach(row => {
            const wellId = row.querySelector('td:first-child')?.textContent?.trim();
            if (wellId) {
                visibleWells.push(wellId);
            }
        });
        
        // console.log(`🔄 SYNC - Found ${visibleWells.length} visible wells in table`);
        
        // Synchronize well selector dropdown
        const wellSelector = document.getElementById('wellSelector');
        if (wellSelector && visibleWells.length > 0) {
            // Check if current selection is valid
            const currentValue = wellSelector.value;
            const isCurrentVisible = visibleWells.includes(currentValue);
            
            if (!isCurrentVisible && currentValue !== 'all') {
                // Reset to first visible well or 'all'
                if (visibleWells.length === 1) {
                    wellSelector.value = visibleWells[0];
                } else {
                    wellSelector.value = 'all';
                }
                // console.log(`🔄 SYNC - Updated well selector from '${currentValue}' to '${wellSelector.value}'`);
            }
        }
        
        // Synchronize fluorophore selector
        const fluorophoreSelector = document.getElementById('fluorophoreSelect');
        if (fluorophoreSelector && currentAnalysisResults?.individual_results) {
            const visibleFluorophores = new Set();
            
            visibleWells.forEach(wellId => {
                const wellData = currentAnalysisResults.individual_results[wellId];
                if (wellData?.fluorophore) {
                    visibleFluorophores.add(wellData.fluorophore);
                }
            });
            
            const currentFluor = fluorophoreSelector.value;
            if (currentFluor !== 'all' && !visibleFluorophores.has(currentFluor)) {
                if (visibleFluorophores.size === 1) {
                    fluorophoreSelector.value = Array.from(visibleFluorophores)[0];
                } else {
                    fluorophoreSelector.value = 'all';
                }
                // console.log(`🔄 SYNC - Updated fluorophore selector from '${currentFluor}' to '${fluorophoreSelector.value}'`);
            }
        }
        
        // console.log('🔄 SYNC - Filter synchronization completed successfully');
        
    } catch (error) {
        // console.error('🔄 SYNC - Error during filter synchronization:', error);
    }
}

function filterWellsByFluorophore(selectedFluorophore) {
    // More defensive checking with better diagnostics
    const hasCurrentAnalysisResults = currentAnalysisResults && currentAnalysisResults.individual_results;
    const hasWindowAnalysisResults = window.currentAnalysisResults && window.currentAnalysisResults.individual_results;
    
    if (!hasCurrentAnalysisResults && !hasWindowAnalysisResults) {
        // console.log('🔍 FILTER-WELLS - No analysis results available, skipping well filtering');
        
        // Clear well selector if no data available
        const wellSelector = document.getElementById('wellSelect');
        if (wellSelector) {
            wellSelector.innerHTML = '<option value="">No data available</option>';
        }
        return;
    }
    
    // Use window version if local version is not available (common during history display)
    const analysisResults = hasCurrentAnalysisResults ? currentAnalysisResults : window.currentAnalysisResults;
    // console.log('🔍 FILTER-WELLS - Using analysis results:', hasCurrentAnalysisResults ? 'currentAnalysisResults' : 'window.currentAnalysisResults');
    
    const wellSelector = document.getElementById('wellSelect');
    if (!wellSelector) return;
    
    wellSelector.innerHTML = '';
    
    // Add "All Wells" option for the selected fluorophore
    const allOption = document.createElement('option');
    allOption.value = 'ALL_WELLS';
    allOption.textContent = selectedFluorophore === 'all' ? 'All Wells Overlay' : `All ${selectedFluorophore} Wells`;
    wellSelector.appendChild(allOption);
    
    // Filter results by fluorophore
    const filteredResults = Object.entries(analysisResults.individual_results).filter(([wellKey, result]) => {
        if (selectedFluorophore === 'all') return true;
        return (result.fluorophore || 'Unknown') === selectedFluorophore;
    });
    
    // Sort wells according to the selected mode
    filteredResults.sort(([aWellKey, aResult], [bWellKey, bResult]) => {
        const aWellId = aResult.well_id || aWellKey;
        const bWellId = bResult.well_id || bWellKey;
        const aMatch = aWellId.match(/([A-Z]+)(\d+)/i);
        const bMatch = bWellId.match(/([A-Z]+)(\d+)/i);
        if (aMatch && bMatch) {
            if (wellSortMode === 'letter-number') {
                // A1, A2, ..., H12
                const letterCompare = aMatch[1].localeCompare(bMatch[1]);
                if (letterCompare !== 0) return letterCompare;
                return parseInt(aMatch[2]) - parseInt(bMatch[2]);
            } else {
                // 1A, 1B, ..., 12H
                const numCompare = parseInt(aMatch[2]) - parseInt(bMatch[2]);
                if (numCompare !== 0) return numCompare;
                return aMatch[1].localeCompare(bMatch[1]);
            }
        }
        return aWellId.localeCompare(bWellId);
    });
    
    // Populate filtered wells
    filteredResults.forEach(([wellKey, result]) => {
        const option = document.createElement('option');
        option.value = wellKey;
        
        const wellId = result.well_id || wellKey;
        const sampleName = result.sample || result.sample_name || 'N/A';
        const status = result.is_good_scurve ? '✓' : '✗';
        
        option.textContent = `${status} ${wellId}: ${sampleName}`;
        wellSelector.appendChild(option);
    });
    
    // Add event listener for well selection
    wellSelector.removeEventListener('change', handleWellChange);
    wellSelector.addEventListener('change', handleWellChange);
}

function handleWellChange(event) {
    const selectedWell = event.target.value;
    // console.log('🔄 WELL - Well selector changed to:', selectedWell);
    
    // Update app state - this will coordinate all UI elements
    updateAppState({
        currentWellSelection: selectedWell
    });
    
    if (selectedWell && selectedWell !== 'ALL_WELLS') {
        showWellDetails(selectedWell);
    } else if (selectedWell === 'ALL_WELLS') {
        // Handle "All Wells" selection based on current chart mode
        const selectedFluorophore = window.appState.currentFluorophore || 'all';
        
        if (window.appState.currentChartMode === 'all') {
            showAllCurves(selectedFluorophore);
        } else if (window.appState.currentChartMode === 'good') {
            showGoodCurves(selectedFluorophore);
        }
    }
}

function populateWellSelector(individualResults) {
    // First populate the fluorophore selector
    populateFluorophoreSelector(individualResults);

    // Always default to 'all' fluorophores ("All Wells Overlay") on load, even for single-channel runs
    // This ensures the user always sees the overlay option by default
    filterWellsByFluorophore('all');

    // Optionally, set the well selector to 'ALL_WELLS' if present
    const wellSelector = document.getElementById('wellSelect');
    if (wellSelector) {
        const allOption = Array.from(wellSelector.options).find(opt => opt.value === 'ALL_WELLS');
        if (allOption) {
            wellSelector.value = 'ALL_WELLS';
        }
    }
    // Always force "Show All Curves" view and activate button after analysis loads
    if (typeof showAllCurves === 'function') showAllCurves('all');
    const showAllBtn = document.getElementById('showAllBtn');
    if (showAllBtn) showAllBtn.classList.add('active');
}

function populateResultsTable(individualResults) {
    try {
        // console.log('🔍 TABLE-DEBUG - Populating results table with:', {
            // individualResultsExists: !!individualResults,
            // totalWellsReceived: Object.keys(individualResults || {}).length,
            // firstTenWells: Object.keys(individualResults || {}).slice(0, 10),
            // fluorophoreBreakdown: (() => {
                // const wells = individualResults || {};
                // const breakdown = {};
                // Object.keys(wells).forEach(wellKey => {
                    // const fluorophore = wells[wellKey].fluorophore || 'Unknown';
                    // breakdown[fluorophore] = (breakdown[fluorophore] || 0) + 1;
                // });
                // return breakdown;
            // })()
        // });
        
        const tableBody = document.getElementById('resultsTableBody');
        if (!tableBody) {
            // console.error('Results table body not found');
            return;
        }
        
        tableBody.innerHTML = '';
        
        // Sort wells according to the selected mode
        let entries = Object.entries(individualResults);
        entries.sort(([aWellKey, aResult], [bWellKey, bResult]) => {
            const aWellId = aResult.well_id || aWellKey;
            const bWellId = bResult.well_id || bWellKey;
            const aMatch = aWellId.match(/([A-Z]+)(\d+)/i);
            const bMatch = bWellId.match(/([A-Z]+)(\d+)/i);
            if (aMatch && bMatch) {
                if (wellSortMode === 'letter-number') {
                    // A1, A2, ..., H12
                    const letterCompare = aMatch[1].localeCompare(bMatch[1]);
                    if (letterCompare !== 0) return letterCompare;
                    return parseInt(aMatch[2]) - parseInt(bMatch[2]);
                } else {
                    // 1A, 1B, ..., 12H
                    const numCompare = parseInt(aMatch[2]) - parseInt(bMatch[2]);
                    if (numCompare !== 0) return numCompare;
                    return aMatch[1].localeCompare(bMatch[1]);
                }
            }
            return aWellId.localeCompare(bWellId);
        });

        entries.forEach(([wellKey, result]) => {
            try {
                const row = document.createElement('tr');
                row.setAttribute('data-well-key', wellKey); // Store actual wellKey for modal navigation
        
        // Existing quality badge
        const statusClass = result.is_good_scurve ? 'status-good' : 'status-poor';
        const statusText = result.is_good_scurve ? 'Good S-Curve' : 'Poor Fit';
        
        // New stricter criteria badges
        let strictBadgeClass = '';
        let strictBadgeText = '';
        
        const r2Score = result.r2_score || 0;
        const steepness = result.steepness || 0;
        const amplitude = result.amplitude || 0;
        
        // Apply strict criteria using amplitude thresholds AND anomaly check
        try {
            // First get anomalies data
            let hasAnomalies = false;
            if (result.anomalies) {
                try {
                    const anomalies = typeof result.anomalies === 'string' ? 
                        JSON.parse(result.anomalies) : result.anomalies;
                    hasAnomalies = Array.isArray(anomalies) && anomalies.length > 0 && 
                                  !(anomalies.length === 1 && anomalies[0] === 'None');
                } catch (e) {
                    hasAnomalies = true; // If can't parse, assume there are anomalies
                }
            }
            
            // Apply enhanced criteria: POS requires good S-curve + amplitude > 500 + no anomalies
            const cqValue = result.cq_value;
            // NEG if amplitude < 400 OR poor fit OR Cq is not a number
            if (amplitude < 400 || !result.is_good_scurve || isNaN(Number(cqValue))) {
                strictBadgeClass = 'strict-neg';
                strictBadgeText = 'NEG';
            } else if (result.is_good_scurve && amplitude > 500 && !hasAnomalies) {
                strictBadgeClass = 'strict-pos';
                strictBadgeText = 'POS';
            } else {
                // REDO: amplitude 400-500, or amplitude > 500 with anomalies, but not NEG
                strictBadgeClass = 'strict-redo';
                strictBadgeText = 'REDO';
            }
        } catch (e) {
            // console.error('Error applying strict criteria:', e.message);
            strictBadgeClass = 'strict-redo';
            strictBadgeText = 'REDO';
        }
        
        // Handle anomalies data properly
        let anomaliesText = 'None';
        if (result.anomalies) {
            try {
                const anomalies = typeof result.anomalies === 'string' ? 
                    JSON.parse(result.anomalies) : result.anomalies;
                anomaliesText = Array.isArray(anomalies) && anomalies.length > 0 ? 
                    anomalies.join(', ') : 'None';
            } catch (e) {
                anomaliesText = 'Parse Error';
            }
        }
        
        let wellId = result.well_id || wellKey.split('_')[0];
        const fluorophore = result.fluorophore || 'Unknown';
        let sampleName = result.sample || result.sample_name || 'Unknown';
        
        // Defensive check: Ensure sampleName is defined and is a string
        if (typeof sampleName === 'undefined' || sampleName === null) {
            // console.error(`❌ SAMPLE-NAME-ERROR - Undefined sampleName for well ${wellKey}:`, {
                // wellKey,
                // result: result,
                // sample: result.sample,
                // sample_name: result.sample_name
            // });
            sampleName = 'Missing'; // Use 'Missing' as fallback to prevent ReferenceError
        } else {
            sampleName = String(sampleName); // Ensure it's a string
        }
        
        // Debug sample name for troubleshooting
        if (wellKey.includes('A1')) {
            // console.log(`Sample debug for ${wellKey}:`, {
                // sample: result.sample,
                // sample_name: result.sample_name,
                // final: sampleName,
                // wellKey: wellKey,
                // resultKeys: Object.keys(result)
            // });
        }
        const cqValue = result.cq_value !== null && result.cq_value !== undefined ? 
            result.cq_value.toFixed(2) : 'N/A';
        
        // Only show strict badge if criteria are met
        const strictBadgeHTML = strictBadgeText ? 
            `<span class="strict-badge ${strictBadgeClass}">${strictBadgeText}</span>` : 
            '-';

        
        // --- Curve Class badge (from new script/classifier) ---
        let curveClassBadgeHTML = '-';
        if (typeof result.curve_classification === 'object' && result.curve_classification.classification) {
            const classMap = {
                'STRONG_POSITIVE': 'curve-strong-pos',
                'POSITIVE': 'curve-pos',
                'WEAK_POSITIVE': 'curve-weak-pos',
                'NEGATIVE': 'curve-neg',
                'INDETERMINATE': 'curve-indet',
                'SUSPICIOUS': 'curve-suspicious'
            };
            const badgeClass = classMap[result.curve_classification.classification] || 'curve-other';
            curveClassBadgeHTML = `<span class="curve-badge ${badgeClass}" title="${result.curve_classification.reason || ''}">${result.curve_classification.classification.replace('_', ' ')}</span>`;
        } else if (typeof result.curve_classification === 'string') {
            curveClassBadgeHTML = `<span class="curve-badge curve-other">${result.curve_classification}</span>`;
        }

        // --- Strict JS classification (NEG/POS/REDO) ---
        let strictJsClass = '-';
        if (typeof classifyResult === 'function') {
            try {
                strictJsClass = classifyResult(result);
            } catch (e) {
                strictJsClass = 'ERR';
            }
        }

        // Display CQJ and CalcJ values ONLY from backend, always show 'N/A' for missing/null/invalid
        let cqjDisplay = null;
        let calcjDisplay = null;

        if (
            result.cqj && typeof result.cqj === 'object' && result.fluorophore &&
            result.cqj[result.fluorophore] !== undefined && result.cqj[result.fluorophore] !== null &&
            !isNaN(result.cqj[result.fluorophore])
        ) {
            cqjDisplay = Number(result.cqj[result.fluorophore]).toFixed(2);
            // console.log(`🔍 CQJ-DISPLAY - ${result.well}: CQJ ${cqjDisplay} for ${result.fluorophore} (raw: ${result.cqj[result.fluorophore]})`);
        } else {
            // console.log(`🔍 CQJ-DISPLAY - ${result.well}: No valid CQJ for ${result.fluorophore} (value: ${result.cqj?.[result.fluorophore]})`);
        }

        if (
            result.calcj && typeof result.calcj === 'object' && result.fluorophore &&
            result.calcj[result.fluorophore] !== undefined && result.calcj[result.fluorophore] !== null &&
            !isNaN(result.calcj[result.fluorophore])
        ) {
            calcjDisplay = Number(result.calcj[result.fluorophore]).toExponential(2);
        }

        // If backend value is missing, show 'N/A' (no formatting)
        const cqjCell = (cqjDisplay !== null && cqjDisplay !== undefined && !isNaN(Number(cqjDisplay)))
            ? cqjDisplay
            : 'N/A';
        // Fix: If calcjDisplay is null/undefined/invalid, show 'N/A', otherwise show formatted value
        let calcjCell = 'N/A';
        if (calcjDisplay !== null && calcjDisplay !== undefined && !isNaN(Number(calcjDisplay))) {
            // Only show scientific notation if value is > 0
            if (Number(calcjDisplay) > 0) {
                // Convert 10^x to scientific notation (e.g., 10^4.25 = 1.78e+4)
                const calcjValue = Number(calcjDisplay);
                const scientificValue = Math.pow(10, calcjValue);
                calcjCell = scientificValue.toExponential(2); // e.g., "1.78e+4"
            } else {
                calcjCell = 'N/A';
            }
        }

        row.innerHTML = `
            <td><strong>${wellId}</strong></td>
            <td>${sampleName}</td>
            <td><span class="fluorophore-tag fluorophore-${fluorophore.toLowerCase()}">${fluorophore}</span></td>
            <td>${strictBadgeHTML}</td>
            <td>${curveClassBadgeHTML}</td>
            <!--<td><span class="strict-badge strict-js">${strictJsClass}</span></td>-->
            <td><span class="status ${statusClass}">${statusText}</span></td>
            <td>${formatNumber(result.r2_score ? result.r2_score.toFixed(4) : 'N/A')}</td>
            <td>${formatNumber(result.rmse ? result.rmse.toFixed(2) : 'N/A')}</td>
            <td>${formatNumber(result.amplitude ? result.amplitude.toFixed(1) : 'N/A')}</td>
            <td>${formatNumber(result.steepness ? result.steepness.toFixed(3) : 'N/A')}</td>
            <td>${formatNumber(result.midpoint ? result.midpoint.toFixed(1) : 'N/A')}</td>
            <td>${formatNumber(result.baseline ? result.baseline.toFixed(1) : 'N/A')}</td>
            <td>${formatNumber(cqValue)}</td>
            <td>${cqjCell}</td>
            <td>${calcjCell}</td>
            <td>${anomaliesText}</td>
        `;
        
        row.addEventListener('click', () => {
            const wellSelect = document.getElementById('wellSelect');
            if (wellSelect) {
                wellSelect.value = wellKey;
            }
            showWellModal(wellKey);
        });
        
        tableBody.appendChild(row);
            } catch (rowError) {
                // console.error(`❌ ROW-ERROR - Failed to create row for well ${wellKey}:`, rowError);
                // console.error('Row error details:', {
                    // wellKey,
                    // result,
                    // errorMessage: rowError.message,
                    // stack: rowError.stack
                // });
                
                // Create a minimal error row
                const errorRow = document.createElement('tr');
                errorRow.innerHTML = `<td colspan="15"><strong>Error loading ${wellKey}:</strong> ${rowError.message}</td>`;
                tableBody.appendChild(errorRow);
            }
        });
        
        // CRITICAL: Apply current filter state after populating table
        // console.log('🔄 TABLE-DEBUG - Applying current filter state after table population');
        if (typeof filterTable === 'function') {
            filterTable();
        }
    

    } catch (mainError) {
        // console.error('Error in populateResultsTable function:', mainError.message);
        // console.error('Stack trace:', mainError.stack);
        
        // Still try to populate basic table without advanced features
        const tableBody = document.getElementById('resultsTableBody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="10">Error loading results. Check console for details.</td></tr>';
        }
    }
}

function showWellDetails(wellKey) {
    if (!currentAnalysisResults || !currentAnalysisResults.individual_results) {
        // console.error('No analysis results available');
        return;
    }
    
    const wellResult = currentAnalysisResults.individual_results[wellKey];
    if (!wellResult) {
        // console.error('Well result not found:', wellKey);
        return;
    }
    
    updateChart(wellKey);
    
    let wellId = wellResult.well_id || wellKey;
    const fluorophore = wellResult.fluorophore || 'Unknown';
    let sampleName = wellResult.sample || wellResult.sample_name || 'N/A';
    
    // Defensive check: Ensure sampleName is defined
    if (typeof sampleName === 'undefined' || sampleName === null) {
        // console.error(`❌ SAMPLE-NAME-ERROR in showWellDetails for well ${wellKey}:`, wellResult);
        sampleName = 'Missing';
    } else {
        sampleName = String(sampleName);
    }
    
    // Check if we should show filtered samples list
    // Use currentChartMode for filtering logic since POS/NEG/REDO buttons update that
    const effectiveFilterMode = (currentChartMode === 'pos' || currentChartMode === 'neg' || currentChartMode === 'redo') ? currentChartMode : currentFilterMode;
    const shouldShowFilteredSamples = (effectiveFilterMode === 'pos' || effectiveFilterMode === 'neg' || effectiveFilterMode === 'redo') && 
                                     currentFluorophore && currentFluorophore !== 'all';
    
    let filteredSamplesHtml = '';
    if (shouldShowFilteredSamples) {
        filteredSamplesHtml = generateFilteredSamplesHtml(effectiveFilterMode);
    }
    
    const detailsHtml = `
        <h3>${wellId}: ${sampleName} (${fluorophore})</h3>
        <div class="quality-status ${wellResult.is_good_scurve ? 'good' : 'poor'}">
            <strong>Quality:</strong> ${wellResult.is_good_scurve ? 'Good S-Curve ✓' : 'Poor S-Curve ✗'}
        </div>
        <div class="metrics-grid">
            <div class="metric">
                <span class="metric-label">R² Score:</span>
                <span class="metric-value">${(wellResult.r2_score || 0).toFixed(4)}</span>
            </div>
            <div class="metric">
                <span class="metric-label">RMSE:</span>
                <span class="metric-value">${(wellResult.rmse || 0).toFixed(2)}</span>
            </div>
            <div class="metric">
                <span class="metric-label">Amplitude:</span>
                <span class="metric-value">${(wellResult.amplitude || 0).toFixed(2)}</span>
            </div>
            <div class="metric">
                <span class="metric-label">Midpoint:</span>
                <span class="metric-value">${(wellResult.midpoint || 0).toFixed(2)}</span>
            </div>
            <div class="metric">
                <span class="metric-label">Curve Classification:</span>
                <span class="metric-value">${wellResult.curve_classification && (wellResult.curve_classification.classification || wellResult.curve_classification.type) ? (wellResult.curve_classification.classification || wellResult.curve_classification.type) : (typeof wellResult.curve_classification === 'string' ? wellResult.curve_classification : 'N/A')}</span>
            </div>
        </div>
        ${filteredSamplesHtml}
    `;
    
    document.getElementById('curveDetails').innerHTML = detailsHtml;
}

function updateSelectedCurveDetails() {
    // Get currently selected well from the dropdown
    const wellSelector = document.getElementById('wellSelect');
    if (!wellSelector || !wellSelector.value) {
        return;
    }
    
    const selectedWell = wellSelector.value;
    if (selectedWell && selectedWell !== 'Select a well') {
        showWellDetails(selectedWell);
    }
}

function showFilteredCurveDetails(fluorophore, filterMode) {
    if (!fluorophore || fluorophore === 'all' || !filterMode || filterMode === 'all') {
        return;
    }
    
    // Set the current fluorophore for filtering via state management
    updateAppState({
        currentFluorophore: fluorophore
    });
    
    // Generate filtered samples HTML
    const filteredSamplesHtml = generateFilteredSamplesHtml(filterMode);
    
    const filterTypeLabel = filterMode.toUpperCase();
    const detailsHtml = `
        <h3>${filterTypeLabel} Results for ${fluorophore}</h3>
        <div class="quality-status good">
            <strong>Filter Mode:</strong> ${filterTypeLabel} Results Only
        </div>
        <div class="metrics-grid">
            <div class="metric">
                <span class="metric-label">Fluorophore:</span>
                <span class="metric-value">${fluorophore}</span>
            </div>
            <div class="metric">
                <span class="metric-label">Filter:</span>
                <span class="metric-value">${filterTypeLabel}</span>
            </div>
        </div>
        ${filteredSamplesHtml}
    `;
    
    document.getElementById('curveDetails').innerHTML = detailsHtml;
}

function generateFilteredSamplesHtml(effectiveFilterMode = null) {
    if (!currentAnalysisResults || !currentAnalysisResults.individual_results) {
        return '';
    }
    
    // Use passed parameter or fall back to currentFilterMode
    const filterMode = effectiveFilterMode || currentFilterMode;
    
    // Ensure filter variables are defined (defensive programming for historical sessions)
    if (!filterMode || !currentFluorophore || filterMode === 'all' || currentFluorophore === 'all') {
        return '';
    }
    
    // Filter samples by current fluorophore and filter mode
    const filteredSamples = [];
    const filterType = filterMode === 'pos' ? 'POS' : filterMode === 'neg' ? 'NEG' : 'REDO';
    
    Object.entries(currentAnalysisResults.individual_results).forEach(([wellKey, result]) => {
        const resultFluorophore = result.fluorophore || 'Unknown';
        if (resultFluorophore !== currentFluorophore) return;

        const amplitude = result.amplitude || 0;

        // Check for anomalies
        let hasAnomalies = false;
        if (result.anomalies) {
            try {
                const anomalies = typeof result.anomalies === 'string' ? 
                    JSON.parse(result.anomalies) : result.anomalies;
                hasAnomalies = Array.isArray(anomalies) && anomalies.length > 0 && 
                              !(anomalies.length === 1 && anomalies[0] === 'None');
            } catch (e) {
                hasAnomalies = true;
            }
        }

        // Apply filter criteria
        let matchesFilter = false;
        if (filterMode === 'pos') {
            matchesFilter = result.is_good_scurve && amplitude > 500 && !hasAnomalies;
        } else if (filterMode === 'neg') {
            const cqValue = result.cq_value;
            matchesFilter = amplitude < 400 || !result.is_good_scurve || isNaN(Number(cqValue));
        } else if (filterMode === 'redo') {
            matchesFilter = (!result.is_good_scurve || (amplitude >= 400 && amplitude <= 500) || (amplitude > 500 && hasAnomalies)) && !(amplitude < 400 || !result.is_good_scurve || isNaN(Number(result.cq_value)));
        }

        if (matchesFilter) {
            filteredSamples.push({
                wellId: result.well_id || wellKey,
                sampleName: result.sample || result.sample_name || 'N/A',
                amplitude: amplitude
            });
        }
    });
    
    // Sort by well ID
    filteredSamples.sort((a, b) => {
        const aMatch = a.wellId.match(/([A-Z]+)(\d+)/);
        const bMatch = b.wellId.match(/([A-Z]+)(\d+)/);
        
        if (aMatch && bMatch) {
            const letterCompare = aMatch[1].localeCompare(bMatch[1]);
            if (letterCompare !== 0) return letterCompare;
            return parseInt(aMatch[2]) - parseInt(bMatch[2]);
        }
        return a.wellId.localeCompare(b.wellId);
    });
    
    // Calculate statistics
    const totalCount = filteredSamples.length;
    const avgAmplitude = totalCount > 0 ? 
        filteredSamples.reduce((sum, sample) => sum + sample.amplitude, 0) / totalCount : 0;
    
    // Generate sample list HTML
    const sampleListHtml = filteredSamples.map(sample => `
        <div class="sample-item">
            <span class="sample-well">${sample.wellId}</span>
            <span class="sample-name">${sample.sampleName}</span>
            <span class="sample-amplitude">${sample.amplitude.toFixed(0)}</span>
        </div>
    `).join('');
    
    return `
        <div class="filtered-samples-section">
            <h4>${filterType} Samples (${currentFluorophore})</h4>
            <div class="filtered-samples-list">
                ${sampleListHtml}
            </div>
            <div class="filtered-stats">
                <div class="filtered-stats-row">
                    <span class="filtered-stats-label">Count:</span>
                    <span class="filtered-stats-value">${totalCount}</span>
                </div>
                <div class="filtered-stats-row">
                    <span class="filtered-stats-label">Avg Amplitude:</span>
                    <span class="filtered-stats-value">${avgAmplitude.toFixed(1)}</span>
                </div>
            </div>
        </div>
    `;
}

function updateChart(wellKey, cyclesData = null, rfuData = null, wellData = null) {
    // Use currentAnalysisResults for global access
    if (!currentAnalysisResults || !currentAnalysisResults.individual_results) return;
    
    const wellResult = wellData || currentAnalysisResults.individual_results[wellKey];
    if (!wellResult) return;
    
    let wellId = wellResult.well_id || wellKey.split('_')[0];
    const fluorophore = wellResult.fluorophore || 'Unknown';
    
    // Use provided data or extract from wellResult
    let cycles = [];
    let rfu = [];
    
    if (cyclesData && rfuData) {
        cycles = cyclesData;
        rfu = rfuData;
    } else {
        try {
            if (wellResult.raw_cycles) {
                let parsedCycles = typeof wellResult.raw_cycles === 'string' ? 
                    JSON.parse(wellResult.raw_cycles) : wellResult.raw_cycles;
                
                // Convert object to array if needed (database sometimes stores as object)
                if (parsedCycles && typeof parsedCycles === 'object' && !Array.isArray(parsedCycles)) {
                    cycles = Object.values(parsedCycles);
                } else {
                    cycles = parsedCycles;
                }
            }
            if (wellResult.raw_rfu) {
                let parsedRfu = typeof wellResult.raw_rfu === 'string' ? 
                    JSON.parse(wellResult.raw_rfu) : wellResult.raw_rfu;
                
                // Convert object to array if needed (database sometimes stores as object)
                if (parsedRfu && typeof parsedRfu === 'object' && !Array.isArray(parsedRfu)) {
                    rfu = Object.values(parsedRfu);
                } else {
                    rfu = parsedRfu;
                }
            }
        } catch (e) {
            // console.error('Error parsing raw data for well:', wellKey, e);
            return;
        }
    }
    
    if (!cycles || cycles.length === 0 || !rfu || rfu.length === 0) {
        // console.log('No chart data available for well:', wellKey, {
            // wellResult: !!wellResult,
            // rawCycles: wellResult?.raw_cycles ? (typeof wellResult.raw_cycles) + ' length:' + (wellResult.raw_cycles.length || 'N/A') : 'missing',
            // rawRfu: wellResult?.raw_rfu ? (typeof wellResult.raw_rfu) + ' length:' + (wellResult.raw_rfu.length || 'N/A') : 'missing',
            // cycles: cycles,
            // rfu: rfu
        // });
        return;
    }
    
    const ctx = document.getElementById('amplificationChart').getContext('2d');
    
    // Destroy existing chart
    if (window.amplificationChart) {
        safeDestroyChart();
    }
    
    // Prepare fit data if available
    let fitData = [];
    if (wellResult.fitted_curve) {
        let fittedCurve = [];
        try {
            fittedCurve = typeof wellResult.fitted_curve === 'string' ? 
                JSON.parse(wellResult.fitted_curve) : wellResult.fitted_curve;
        } catch (e) {
            // console.error('Error parsing fitted curve data:', e);
        }
        
        if (fittedCurve.length > 0) {
            fitData = fittedCurve.map((rfuValue, index) => ({
                x: cycles[index],
                y: rfuValue
            }));
        }
    }
    
    const datasets = [
        {
            label: `${wellId} (${fluorophore}) - Raw Data`,
            data: cycles.map((cycle, index) => ({
                x: cycle,
                y: rfu[index]
            })),
            backgroundColor: 'rgba(52, 152, 219, 0.8)',
            borderColor: 'rgba(41, 128, 185, 1)',
            borderWidth: 1,
            pointRadius: 3,
            pointHoverRadius: 5,
            showLine: false,
            pointStyle: 'circle'
        }
    ];
    
    if (fitData.length > 0) {
        datasets.push({
            label: `${wellId} (${fluorophore}) - Fitted Curve`,
            data: fitData,
            backgroundColor: 'rgba(231, 76, 60, 0.3)',
            borderColor: 'rgba(192, 57, 43, 1)',
            borderWidth: 2,
            pointRadius: 0,
            showLine: true,
            tension: 0.4
        });
    }
    
    // COMMENTED OUT - Duplicate chart creation, use createUnifiedChart instead
    /*
    // Create chart with stable threshold system
    const chartConfig = createChartConfiguration(
        'scatter', 
        datasets, 
        `qPCR Amplification Curve - ${wellId} (${fluorophore})`
    );
    
    // Set flag to prevent threshold conflicts during chart creation
    window.chartUpdating = true;
    
    window.amplificationChart = new Chart(ctx, chartConfig);
    
    // Clear flag after a short delay to allow animation to start
    setTimeout(() => {
        window.chartUpdating = false;
    }, 100);
    */
    
    // COMMENTED OUT - Duplicate chart creation, CSMS handles all chart creation
    /*
    // Use unified chart creation but modify for single well display
    // For now, use the legacy single chart creation but prevent conflicts
    if (!window.chartInitializing && !window.chartUpdating) {
        console.log('🔍 UPDATE-CHART - Creating single well chart via legacy path');
        
        const chartConfig = createChartConfiguration(
            'scatter', 
            datasets, 
            `qPCR Amplification Curve - ${wellId} (${fluorophore})`
        );
        
        // Safely destroy existing chart first
        if (window.amplificationChart) {
            try {
                window.amplificationChart.destroy();
                window.amplificationChart = null;
            } catch (e) {
                console.warn('Error destroying chart:', e);
            }
        }
        
        window.chartUpdating = true;
        window.amplificationChart = new Chart(ctx, chartConfig);
        
        setTimeout(() => {
            window.chartUpdating = false;
            // Apply thresholds after single chart creation
            if (window.updateAllChannelThresholds) {
                window.updateAllChannelThresholds();
            }
        }, 100);
    } else {
        console.log('🔍 UPDATE-CHART - Skipping chart creation - flags set');
    }
    */
    
    // Instead, just update data on existing chart created by CSMS
    console.log('🔍 UPDATE-CHART - Delegating to CSMS for chart management');
}

// Utility functions
function prepareAnalysisData(data = null) {
    if (!data) {
        // console.error('No data provided to prepareAnalysisData');
        return {};
    }
    
    if (data.length < 2) {
        // console.error('Insufficient data rows');
        return {};
    }
    
    const wellData = {};
    let cycleColumnIndex = -1;
    let wellColumns = [];
    
    // Find the "Cycle" column and well columns
    for (let colIndex = 0; colIndex < data[0].length; colIndex++) {
        const header = data[0][colIndex];
        if (header && header.toLowerCase().includes('cycle')) {
            cycleColumnIndex = colIndex;
        } else if (header && header.match(/^[A-P](0?[1-9]|1[0-9]|2[0-4])$/)) {
            wellColumns.push({ index: colIndex, wellId: header });
        }
    }
    
    if (cycleColumnIndex === -1) {
        // console.error('Could not find Cycle column');
        return {};
    }
    
    if (wellColumns.length === 0) {
        // console.error('Could not find any well columns');
        return {};
    }
    
    // Extract data for each well
    wellColumns.forEach(wellCol => {
        const cycles = [];
        const rfu = [];
        
        for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
            const cycleValue = parseFloat(data[rowIndex][cycleColumnIndex]);
            const rfuValue = parseFloat(data[rowIndex][wellCol.index]);
            
            if (!isNaN(cycleValue) && !isNaN(rfuValue)) {
                cycles.push(cycleValue);
                rfu.push(rfuValue);
            }
        }
        
        if (cycles.length > 0 && rfu.length > 0) {
            wellData[wellCol.wellId] = {
                cycles: cycles,
                rfu: rfu
            };
        }
    });
    
    // Integrate sample names and Cq values
    // console.log('=== INTEGRATING SAMPLE DATA ===');
    const cqData = parseCqData();
    const sampleNames = parseSampleNames();
    
    // console.log('Available sample names keys:', Object.keys(sampleNames).slice(0, 10));
    // console.log('Available Cq data keys:', Object.keys(cqData).slice(0, 10));
    // console.log('Well data keys to integrate:', Object.keys(wellData).slice(0, 10));
    
    // Add sample names and Cq values to well data
    Object.keys(wellData).forEach(wellKey => {
        // Original wellKey includes fluorophore suffix (e.g., A1_Cy5)
        // Lookup using full key to match parsed sampleNames and cqData
        const sampleName = sampleNames[wellKey] || 'Unknown';
        const cqValue = cqData[wellKey] || null;
        
        wellData[wellKey].sample_name = sampleName;
        wellData[wellKey].cq_value = cqValue;
        
        // Debug first few wells
        if (['A1_Cy5', 'A2_Cy5', 'A3_Cy5'].includes(wellKey)) {
            // console.log(`Well ${wellKey} integration:`, {
                // wellKey: wellKey,
                // availableInSamples: wellKey in sampleNames,
                // sampleFromParsing: sampleNames[wellKey],
                // finalSample: sampleName,
                // availableInCq: wellKey in cqData,
                // cqFromParsing: cqData[wellKey],
                // finalCq: cqValue
            // });
        }
    });
    
    // console.log(`Prepared analysis data for ${Object.keys(wellData).length} wells`);
    return wellData;
}

function parseCqData(specificFluorophore = null) {
    // console.log('=== PARSING CQ DATA ===');
    // console.log('samplesData exists:', !!samplesData);
    // console.log('specificFluorophore filter:', specificFluorophore);
    
    if (!samplesData) {
        // console.log('No samples data available for Cq parsing');
        return {};
    }
    
    // Handle both string and parsed data
    let data;
    if (typeof samplesData === 'string') {
        const parsed = Papa.parse(samplesData, { header: false });
        data = parsed.data;
    } else if (samplesData.data) {
        data = samplesData.data;
    } else {
        // console.log('Unknown samplesData format');
        return {};
    }
    
    // console.log('Parsed Cq CSV rows:', data.length);
    // console.log('First row (headers):', data[0]);
    
    if (data.length < 2) {
        // console.log('Not enough data rows for Cq parsing');
        return {};
    }
    
    const cqDataResults = {};
    let wellColumnIndex = -1;
    let fluorColumnIndex = -1;
    let cqColumnIndex = -1;
    
    // Find Well, Fluorophore, and Cq columns
    for (let colIndex = 0; colIndex < data[0].length; colIndex++) {
        const header = data[0][colIndex];
        if (header) {
            const headerLower = header.toLowerCase().trim();
            if (headerLower.includes('well') || headerLower === 'well') {
                wellColumnIndex = colIndex;
            } else if (headerLower.includes('fluor') || headerLower === 'fluor') {
                fluorColumnIndex = colIndex;
            } else if (headerLower.includes('cq') || headerLower === 'cq' || headerLower.includes('ct')) {
                cqColumnIndex = colIndex;
            }
        }
    }
    
    // Use fixed indices for CFX Manager format if not found by header
    if (wellColumnIndex === -1 && data[0].length > 1) wellColumnIndex = 1;
    if (fluorColumnIndex === -1 && data[0].length > 2) fluorColumnIndex = 2;
    if (cqColumnIndex === -1 && data[0].length > 6) cqColumnIndex = 6;
    
    // console.log(`Cq parsing: Well=${wellColumnIndex}, Fluor=${fluorColumnIndex}, Cq=${cqColumnIndex}`);
    
    if (wellColumnIndex === -1 || fluorColumnIndex === -1 || cqColumnIndex === -1) {
        // console.warn('Could not find required columns in samples data');
        // console.log('Available headers:', data[0]);
        return {};
    }
    
    // Extract Cq values with fluorophore filtering
    for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
        const currentWellId = data[rowIndex][wellColumnIndex];
        const fluorophore = data[rowIndex][fluorColumnIndex];
        const cqValue = parseFloat(data[rowIndex][cqColumnIndex]);
        
        // Skip if filtering for specific fluorophore and this doesn't match
        if (specificFluorophore && fluorophore !== specificFluorophore) {
            continue;
        }
        
        if (currentWellId && fluorophore && !isNaN(cqValue)) {
            // Convert A01 format to A1 format to match amplification files
            const convertedWellId = currentWellId.replace(/^([A-P])0(\d)$/, '$1$2');
            const wellKey = specificFluorophore ? convertedWellId : `${convertedWellId}_${fluorophore}`;
            cqDataResults[wellKey] = cqValue;
            
            if (rowIndex <= 5) { // Debug first few rows
                // console.log(`Cq mapping: ${currentWellId}+${fluorophore} -> ${wellKey} = ${cqValue}`);
            }
        }
    }
    
    return cqDataResults;
}

function parseSampleNames(specificFluorophore = null) {
    // console.log('=== PARSING SAMPLE NAMES ===');
    // console.log('samplesData exists:', !!samplesData);
    // console.log('specificFluorophore filter:', specificFluorophore);
    
    if (!samplesData) {
        // console.log('No samples data available');
        return {};
    }
    
    // Handle both string and parsed data
    let data;
    if (typeof samplesData === 'string') {
        const parsed = Papa.parse(samplesData, { header: false });
        data = parsed.data;
    } else if (samplesData.data) {
        data = samplesData.data;
    } else {
        // console.log('Unknown samplesData format');
        return {};
    }
    
    // console.log('Parsed sample CSV rows:', data.length);
    // console.log('First row (headers):', data[0]);
    
    if (data.length < 2) {
        // console.log('Not enough data rows for sample parsing');
        return {};
    }
    
    const sampleNames = {};
    let wellColumnIndex = -1;
    let fluorColumnIndex = -1;
    let sampleColumnIndex = -1;
    
    // Find Well, Fluorophore, and Sample columns
    for (let colIndex = 0; colIndex < data[0].length; colIndex++) {
        const header = data[0][colIndex];
        if (header) {
            const headerLower = header.toLowerCase().trim();
            if (headerLower.includes('well') || headerLower === 'well') {
                wellColumnIndex = colIndex;
            } else if (headerLower.includes('fluor') || headerLower === 'fluor') {
                fluorColumnIndex = colIndex;
            } else if (headerLower.includes('sample') || headerLower === 'sample' || headerLower === 'target') {
                sampleColumnIndex = colIndex;
            }
        }
    }
    
    // Use fixed indices for CFX Manager format if not found by header
    if (wellColumnIndex === -1 && data[0].length > 1) wellColumnIndex = 1;
    if (fluorColumnIndex === -1 && data[0].length > 2) fluorColumnIndex = 2;
    if (sampleColumnIndex === -1 && data[0].length > 5) sampleColumnIndex = 5;
    
    // console.log(`Sample parsing: Well=${wellColumnIndex}, Fluor=${fluorColumnIndex}, Sample=${sampleColumnIndex}`);
    
    if (wellColumnIndex === -1 || fluorColumnIndex === -1 || sampleColumnIndex === -1) {
        // console.warn('Could not find required columns in samples data');
        // console.log('Available headers:', data[0]);
        return {};
    }
    
    // Extract sample names with fluorophore filtering
    for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
        const currentWellId = data[rowIndex][wellColumnIndex];
        const fluorophore = data[rowIndex][fluorColumnIndex];
        const sampleName = data[rowIndex][sampleColumnIndex];
        
        // Skip if filtering for specific fluorophore and this doesn't match
        if (specificFluorophore && fluorophore !== specificFluorophore) {
            continue;
        }
        
        if (currentWellId && fluorophore && sampleName) {
            // Convert A01 format to A1 format to match amplification files
            const convertedWellId = currentWellId.replace(/^([A-P])0(\d)$/, '$1$2');
            const wellKey = specificFluorophore ? convertedWellId : `${convertedWellId}_${fluorophore}`;
            sampleNames[wellKey] = sampleName;
            
            if (rowIndex <= 5) { // Debug first few rows
                // console.log(`Sample mapping: ${currentWellId}+${fluorophore} -> ${wellKey} = ${sampleName}`);
            }
        }
    }
    
    // console.log('Parsed sample names:', Object.keys(sampleNames).length, 'samples found');
    // console.log('Sample examples:', Object.keys(sampleNames).slice(0, 5).map(k => `${k}: ${sampleNames[k]}`));
    // console.log('First few rows of sample data:', data.slice(1, 4).map(row => `${row[wellColumnIndex]} -> ${row[sampleColumnIndex]}`));
    
    return sampleNames;
}

// Multi-fluorophore support functions
function detectFluorophoreFromFilename(fileName) {
    // console.log(`Detecting fluorophore from filename: ${fileName}`);
    
    // Enhanced detection for CFX Manager format: "Results_Cy5.csv"
    const fluorophores = ['Cy5', 'FAM', 'HEX', 'Texas Red'];
    
    for (const fluorophore of fluorophores) {
        // Check for exact match at end of filename (e.g., "Results_Cy5.csv")
        if (fileName.includes(`_${fluorophore}.csv`) || fileName.includes(`_${fluorophore}_`)) {
            // console.log(`Found fluorophore: ${fluorophore}`);
            return fluorophore;
        }
        // Fallback to case-insensitive search
        if (fileName.toLowerCase().includes(fluorophore.toLowerCase())) {
            // console.log(`Found fluorophore (fallback): ${fluorophore}`);
            return fluorophore;
        }
    }
    
    // console.log(`No fluorophore detected in: ${fileName}`);
    return 'Unknown';
}

/**
 * Dynamic fluorophore detection using pathogen library for single-channel tests
 * @param {string} fileName - The filename to analyze
 * @returns {string} Detected fluorophore or 'Unknown'
 */
function detectFluorophoreFromPathogenLibrary(fileName) {
    if (!fileName || typeof extractTestCode !== 'function' || typeof getRequiredChannels !== 'function') {
        // console.log(`🔍 PATHOGEN LIBRARY - Missing dependencies for dynamic detection`);
        return 'Unknown';
    }
    
    // Extract test code from filename (e.g., "AcNgon_12345_CFX.csv" -> "Ngon")
    const fullPattern = fileName.split('.')[0]; // Remove extension
    const testCode = extractTestCode(fullPattern);
    
    if (!testCode) {
        // console.log(`🔍 PATHOGEN LIBRARY - No test code extracted from: ${fileName}`);
        return 'Unknown';
    }
    
    // Get required channels for this test from pathogen library
    const requiredChannels = getRequiredChannels(testCode);
    
    // For single-channel tests, return the only required channel
    if (requiredChannels.length === 1) {
        // console.log(`🔍 PATHOGEN LIBRARY - Dynamic detection: ${fileName} (${testCode}) → ${requiredChannels[0]}`);
        return requiredChannels[0];
    }
    
    // For multi-channel tests, can't determine specific channel from filename alone
    // console.log(`🔍 PATHOGEN LIBRARY - Multi-channel test ${testCode}, cannot determine specific fluorophore from filename`);
    return 'Unknown';
}

function updateAmplificationFilesList() {
    const filesList = document.getElementById('uploadedFiles');
    if (!filesList) return;
    
    const fluorophores = Object.keys(amplificationFiles);
    if (fluorophores.length === 0) {
        filesList.innerHTML = '<p>No amplification files uploaded</p>';
        return;
    }
    
    const filesHtml = fluorophores.map(fluorophore => {
        const file = amplificationFiles[fluorophore];
        return `<div class="file-item">
            <span class="fluorophore-tag ${fluorophore.toLowerCase().replace(' ', '-')}">${fluorophore}</span>
            <span class="file-name">${file.fileName}</span>
            <button onclick="removeFile('${fluorophore}')" style="margin-left: 10px; color: red; background: none; border: none; cursor: pointer;">✗</button>
        </div>`;
    }).join('');
    
    filesList.innerHTML = `<div><strong>Uploaded Files (${fluorophores.length}):</strong></div>` + filesHtml;
}

function removeFile(fluorophore) {
    delete amplificationFiles[fluorophore];
    updateAmplificationFilesList();
    checkAnalysisReady();
    // console.log(`Removed ${fluorophore} file`);
}

// 🛡️ SIMPLE: Protected function to safely set analysis results
function normalizeAnalysisData(results) {
    // Ensure all numeric fields in analysis results are proper numbers, not strings
    // This is critical when loading data from database which might return strings
    // console.log('🔧 [DATA-NORMALIZE] Converting string values to numbers for proper CQJ/CalcJ calculations');
    
    if (!results || typeof results !== 'object') return results;
    
    // Handle both { individual_results: {...} } and flat {...} structures
    let wellsObject = results.individual_results || results;
    
    if (typeof wellsObject === 'object') {
        Object.keys(wellsObject).forEach(wellKey => {
            const well = wellsObject[wellKey];
            if (well && typeof well === 'object') {
                // Convert numeric fields that are commonly stored as strings in database
                ['cq_value', 'cqj_value', 'calcj_value', 'amplitude', 'baseline', 'threshold'].forEach(field => {
                    if (well[field] !== null && well[field] !== undefined && typeof well[field] === 'string' && !isNaN(well[field])) {
                        const originalValue = well[field];
                        well[field] = parseFloat(well[field]);
                        // console.log(`🔧 [DATA-NORMALIZE] ${wellKey}.${field}: "${originalValue}" → ${well[field]}`);
                    }
                });
                
                // Convert arrays of numeric values (RFU data, cycles)
                ['rfu', 'raw_rfu', 'cycles', 'raw_cycles', 'log_rfu'].forEach(arrayField => {
                    if (Array.isArray(well[arrayField])) {
                        well[arrayField] = well[arrayField].map(val => {
                            if (typeof val === 'string' && !isNaN(val)) {
                                return parseFloat(val);
                            }
                            return val;
                        });
                    }
                });
                
                // Convert nested cqj and calcj objects
                if (well.cqj && typeof well.cqj === 'object') {
                    Object.keys(well.cqj).forEach(channel => {
                        if (typeof well.cqj[channel] === 'string' && !isNaN(well.cqj[channel])) {
                            well.cqj[channel] = parseFloat(well.cqj[channel]);
                        }
                    });
                }
                
                if (well.calcj && typeof well.calcj === 'object') {
                    Object.keys(well.calcj).forEach(channel => {
                        if (typeof well.calcj[channel] === 'string' && !isNaN(well.calcj[channel])) {
                            well.calcj[channel] = parseFloat(well.calcj[channel]);
                        }
                    });
                }
            }
        });
    }
    
    // console.log('🔧 [DATA-NORMALIZE] Data normalization complete');
    return results;
}

function setAnalysisResults(newResults, source = 'unknown') {
    // console.log(`🔄 [SETTING] Analysis results from ${source}`);
    
    // Normalize data when loading from external sources (database, history)
    if (source.includes('history') || source.includes('session') || source.includes('load')) {
        newResults = normalizeAnalysisData(newResults);
        
        // Preserve filename for pattern extraction during session loading
        if (newResults && newResults.filename) {
            window.currentSessionFilename = newResults.filename;
            // console.log(`🔄 [SETTING] Preserved session filename for pattern extraction: ${newResults.filename}`);
        }
    }
    
    currentAnalysisResults = newResults;
    window.currentAnalysisResults = newResults;
    
    // Update export state based on source and data
    const isSessionLoaded = source.includes('history') || source.includes('session') || source.includes('load');
    updateExportState({ 
        hasAnalysisResults: !!(newResults && newResults.individual_results && Object.keys(newResults.individual_results).length > 0),
        isSessionLoaded: isSessionLoaded
    });
    return true;
}

// 🛡️ SIMPLE: Load from history (user-initiated)
function loadFromHistoryExplicit(sessionData, source = 'user-history') {
    // console.log(`🔓 [USER LOAD] User explicitly loading from history: ${source}`);
    return setAnalysisResults(sessionData, source);
}
        

// 🛡️ DISPLAY ONLY: Show history session without contaminating current analysis state
       
function displayHistorySession(sessionResults, source = 'history-display') {
    // console.log(`📖 [HISTORY DISPLAY] Showing history session from ${source} WITHOUT contaminating current analysis`);
    
    // Store the current analysis state to restore later if needed
    const originalCurrentAnalysisResults = currentAnalysisResults;
    const originalWindowAnalysisResults = window.currentAnalysisResults;
    
    // Set session results for display and threshold calculation
    currentAnalysisResults = sessionResults;
    window.currentAnalysisResults = sessionResults;
    
    // 🆕 THRESHOLD FIX: Recalculate thresholds for historical data
    // console.log(`📖 [HISTORY DISPLAY] Recalculating thresholds for historical data`);
    if (sessionResults && sessionResults.individual_results) {
        if (window.initializeChannelThresholds) window.initializeChannelThresholds();
    }
    
    try {
        // Display the results using the existing display function
        if (sessionResults.fluorophore_count && sessionResults.fluorophore_count > 1) {
            displayMultiFluorophoreResults(sessionResults);
        } else {
            displayAnalysisResults(sessionResults);
        }
    } catch (error) {
        // console.error('📖 [HISTORY DISPLAY] Error during display:', error);
    } finally {
        // Restore the original state after display is complete
        // Use setTimeout to ensure all async operations complete
        setTimeout(() => {
            currentAnalysisResults = originalCurrentAnalysisResults;
            window.currentAnalysisResults = originalWindowAnalysisResults;
            // console.log(`📖 [HISTORY DISPLAY] Original analysis state restored after display completion`);
        }, 100);
    }
    
    // console.log(`📖 [HISTORY DISPLAY] Completed history display with proper thresholds`);
}



function combineMultiFluorophoreResults(allResults) {
    // console.log('=== COMBINING MULTI-FLUOROPHORE RESULTS ===');
    const fluorophores = Object.keys(allResults);
    const firstResult = allResults[fluorophores[0]];
    // console.log('Uploaded fluorophores:', fluorophores);
    // console.log('Processing fluorophore-specific sample integration...');
    
    const combined = {
        total_wells: firstResult.total_wells || 0,
        good_curves: [],
        success_rate: 0,
        individual_results: {},
        fluorophore_count: fluorophores.length
    };
    
    let totalGoodCurves = 0;
    let totalAnalyzedRecords = 0;
    
    fluorophores.forEach(fluorophore => {
        const results = allResults[fluorophore];
        
        // Parse fluorophore-specific sample names from CSV to fill missing names
        const fluorSampleNames = parseSampleNames(fluorophore);
        // Cq values come from SQL integration in wellResult.cq_value
        
        if (results.good_curves) {
            totalGoodCurves += results.good_curves.length;
            combined.good_curves.push(...results.good_curves.map(well => `${well}_${fluorophore}`));
        }
        
        if (results.individual_results) {
            totalAnalyzedRecords += Object.keys(results.individual_results).length;
            Object.keys(results.individual_results).forEach(wellKey => {
                const wellResult = results.individual_results[wellKey];
                const newWellKey = `${wellKey}_${fluorophore}`;
                
                // Determine sampleName: prefer existing, else fallback to parsed CSV mapping using full key
                const parsedSample = fluorSampleNames[newWellKey];
                // Debug fallback mapping for each well
                // console.log('combine fallback', newWellKey, 'orig sample_name=', wellResult.sample_name, 'parsedSample=', parsedSample);
                const sampleName = wellResult.sample_name || wellResult.sample || parsedSample || 'Unknown';
                const cqValue = (wellResult.cq_value !== undefined && wellResult.cq_value !== null)
                    ? wellResult.cq_value
                    : null;
                
                combined.individual_results[newWellKey] = {
                    ...wellResult,
                    fluorophore: fluorophore,
                    sample_name: sampleName,
                    cq_value: cqValue
                };
                
                // Debug first few integrations
                if (['A1', 'A2', 'A3'].includes(wellKey) && fluorophore === 'Cy5') {
                    // console.log(`${fluorophore} integration ${newWellKey}:`, {
                        // wellKey: wellKey,
                        // sampleName: sampleName,
                        // cqValue: cqValue,
                        // fluorophore: fluorophore
                    // });
                }
            });
        }
    });
    
    // Calculate success rate as percentage of good curves vs total analyzed records
    combined.success_rate = totalAnalyzedRecords > 0 ? 
        (totalGoodCurves / totalAnalyzedRecords * 100) : 0;
    
    // console.log('Multi-fluorophore combination complete:', {
        // fluorophores: fluorophores,
        // totalRecords: Object.keys(combined.individual_results).length,
        // totalGoodCurves: totalGoodCurves,
        // successRate: combined.success_rate
    // });
    
    return combined;
}

function combineMultiFluorophoreResultsSQL(allResults) {
    // console.log('=== COMBINING SQL-INTEGRATED MULTI-FLUOROPHORE RESULTS ===');
    
    // Validate input
    if (!allResults || typeof allResults !== 'object') {
        // console.error('🔍 COMBINE-ERROR - Invalid allResults input:', allResults);
        return { individual_results: {}, fluorophore_count: 0 };
    }
    
    const fluorophores = Object.keys(allResults);
    
    // console.log('🔍 COMBINE-DEBUG - Input analysis:', {
        // fluorophores: fluorophores,
        // allResultsKeys: Object.keys(allResults),
        // firstResultExists: !!allResults[fluorophores[0]],
        // resultsDetailedAnalysis: Object.fromEntries(
            // fluorophores.map(fluor => [
                // fluor,
                // {
                    // exists: !!allResults[fluor],
                    // hasIndividualResults: !!(allResults[fluor]?.individual_results),
                    // individualResultsType: typeof allResults[fluor]?.individual_results,
                    // wellCount: Object.keys(allResults[fluor]?.individual_results || {}).length,
                    // sampleWellKeys: Object.keys(allResults[fluor]?.individual_results || {}).slice(0, 3)
                // }
            // ])
        // )
    // });
    
    if (fluorophores.length === 0) {
        // console.error('🔍 COMBINE-ERROR - No fluorophores found in allResults');
        return { individual_results: {}, fluorophore_count: 0 };
    }
    
    // Find first valid result for baseline properties
    let firstResult = null;
    for (const fluorophore of fluorophores) {
        if (allResults[fluorophore] && allResults[fluorophore].individual_results) {
            firstResult = allResults[fluorophore];
            break;
        }
    }
    
    if (!firstResult) {
        // console.error('🔍 COMBINE-ERROR - No valid results found in any fluorophore');
        return { individual_results: {}, fluorophore_count: 0 };
    }
    
    // console.log('SQL-integrated fluorophores:', fluorophores);
    
    const combined = {
        total_wells: firstResult.total_wells || 0,
        good_curves: [],
        success_rate: 0,
        individual_results: {},
        fluorophore_count: fluorophores.length
    };
    
    let totalGoodCurves = 0;
    let totalAnalyzedRecords = 0;
    
    fluorophores.forEach(fluorophore => {
        const results = allResults[fluorophore];
        
        // Validate results for this fluorophore
        if (!results) {
            // console.warn(`🔍 COMBINE-WARN - No results for ${fluorophore}, skipping`);
            return;
        }
        
        // console.log(`🔍 COMBINE-LOOP - Processing ${fluorophore}:`, {
            // hasResults: !!results,
            // hasGoodCurves: !!(results?.good_curves),
            // goodCurvesLength: results?.good_curves?.length || 0,
            // hasIndividualResults: !!(results?.individual_results),
            // individualResultsKeys: Object.keys(results?.individual_results || {}),
            // individualResultsCount: Object.keys(results?.individual_results || {}).length
        // });
        
        if (results.good_curves) {
            totalGoodCurves += results.good_curves.length;
            combined.good_curves.push(...results.good_curves.map(well => `${well}_${fluorophore}`));
        }
        
        if (results.individual_results) {
            const currentCount = Object.keys(results.individual_results).length;
            totalAnalyzedRecords += currentCount;
            
            // console.log(`🔍 COMBINE-WELLS - Adding ${currentCount} wells from ${fluorophore}`);
            
            Object.keys(results.individual_results).forEach(wellKey => {
                const wellResult = results.individual_results[wellKey];
                const newWellKey = `${wellKey}_${fluorophore}`;
                
                // 🔍 COMBINE-THRESHOLD-DEBUG: Check threshold preservation
                if (wellKey.includes('A1')) {
                    // console.log(`🔍 COMBINE-THRESHOLD - Processing ${wellKey} for ${fluorophore}:`, {
                        // originalThreshold: wellResult.threshold_value,
                        // thresholdType: typeof wellResult.threshold_value,
                        // wellKey: wellKey,
                        // newWellKey: newWellKey
                    // });
                }
                
                // SQL integration already provided sample_name and cq_value
                combined.individual_results[newWellKey] = {
                    ...wellResult,
                    fluorophore: fluorophore,
                    sample_name: wellResult.sample_name || wellResult.sample || 'Unknown',
                    cq_value: wellResult.cq_value || wellResult.cq || wellResult.Cq_Value,
                    // Ensure threshold_value is explicitly preserved
                    threshold_value: wellResult.threshold_value
                };
                
                // 🔍 COMBINE-THRESHOLD-DEBUG: Verify preservation
                if (wellKey.includes('A1')) {
                    // console.log(`🔍 COMBINE-THRESHOLD - After combination ${newWellKey}:`, {
                        // preservedThreshold: combined.individual_results[newWellKey].threshold_value,
                        // thresholdMatches: combined.individual_results[newWellKey].threshold_value === wellResult.threshold_value
                    // });
                }
            });
            
            // console.log(`🔍 COMBINE-WELLS - Combined now has ${Object.keys(combined.individual_results).length} total wells`);
        } else {
            // console.warn(`🔍 COMBINE-WARN - No individual_results for ${fluorophore}`);
        }
    });
    
    // Calculate success rate
    combined.success_rate = totalAnalyzedRecords > 0 ? 
        (totalGoodCurves / totalAnalyzedRecords * 100) : 0;
    
    // console.log('🔍 FINAL-COMBINE-DEBUG - SQL-based multi-fluorophore combination complete:', {
        // fluorophores: fluorophores,
        // totalRecords: Object.keys(combined.individual_results).length,
        // totalGoodCurves: totalGoodCurves,
        // successRate: combined.success_rate,
        // detailedBreakdown: Object.fromEntries(
            // fluorophores.map(fluor => [
                // fluor,
                // {
                    // wellsInCombined: Object.keys(combined.individual_results).filter(key => key.includes(`_${fluor}`)).length,
                    // sampleWellsInCombined: Object.keys(combined.individual_results).filter(key => key.includes(`_${fluor}`)).slice(0, 3)
                // }
            // ])
        // ),
        // firstFewWells: Object.keys(combined.individual_results).slice(0, 10),
        // combinedStructure: {
            // hasIndividualResults: !!combined.individual_results,
            // individualResultsKeys: Object.keys(combined.individual_results).length,
            // fluorophoreCount: combined.fluorophore_count
        // }
    // });
    
    return combined;
}

// Clear any cached data on page load
function clearCachedData() {
    amplificationFiles = {};
    samplesData = null;
    analysisResults = null;
    currentAnalysisResults = null;
    
    // 🛡️ ENHANCED: Clear window global state to prevent contamination
    window.currentAnalysisResults = null;
    window.analysisResults = null;
    
    // � THRESHOLD CONTAMINATION FIX: Clear all threshold data
    channelThresholds = {};
    window.stableChannelThresholds = {};
    window.currentSessionId = null;
    // console.log('🧹 [THRESHOLD-CLEAR] Cleared all threshold data to prevent contamination');
    
    // �🔒 DATA ISOLATION: Set flag to prevent contamination from background loading
    window.freshAnalysisMode = true;
    // console.log('🛡️ [ISOLATION] Fresh analysis mode activated - blocking contamination');
    
    // Reset filter states to prevent persistence on refresh - use centralized state
    updateAppState({
        currentFilter: 'all',
        currentFluorophore: 'all',
        currentChartMode: 'all'
    });
    
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
    
    // Clear file inputs
    const fileInput = document.getElementById('fileInput');
    const samplesInput = document.getElementById('samplesInput');
    if (fileInput) fileInput.value = '';
    if (samplesInput) samplesInput.value = '';
    
    // Reset dropdown selections
    const filterDropdown = document.getElementById('filterSelect');
    if (filterDropdown) {
        filterDropdown.value = 'all';
    }
    
    const fluorophoreDropdown = document.getElementById('fluorophoreFilter');
    if (fluorophoreDropdown) {
        fluorophoreDropdown.value = 'all';
    }
    
    // Reset chart mode buttons
    const chartButtons = ['showSelectedBtn', 'showAllBtn', 'showPosBtn', 'showNegBtn', 'showRedoBtn'];
    chartButtons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.classList.remove('active');
        }
    });
    
    // Aggressively clear all status displays
    const statusElements = ['amplificationStatus', 'samplesStatus'];
    statusElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = '';
            element.textContent = '';
            element.className = 'file-status';
            element.removeAttribute('class');
            element.setAttribute('class', 'file-status');
        }
    });
    
    const uploadedFiles = document.getElementById('uploadedFiles');
    if (uploadedFiles) {
        uploadedFiles.innerHTML = '';
        uploadedFiles.textContent = '';
    }
    
    // Hide file info and analysis sections
    const fileInfo = document.getElementById('fileInfo');
    const analysisSection = document.getElementById('analysisSection');
    if (fileInfo) fileInfo.style.display = 'none';
    if (analysisSection) analysisSection.style.display = 'none';
    
    // Force DOM refresh
    setTimeout(() => {
        checkAnalysisReady();
    }, 100);
    
    // 🛡️ ENHANCED: Clear additional UI elements that retain contaminated data
    const wellSelector = document.getElementById('wellSelector');
    if (wellSelector) {
        wellSelector.innerHTML = '<option value="">Select a well...</option>';
    }
    
    const resultsTableBody = document.querySelector('#resultsTable tbody');
    if (resultsTableBody) {
        resultsTableBody.innerHTML = '';
    }
    
    // Clear chart container
    const chartContainer = document.getElementById('chartContainer');
    if (chartContainer && chartContainer.innerHTML.trim()) {
        // console.log('🧹 [CLEARING] Chart container had content, clearing...');
        chartContainer.innerHTML = '<canvas id="myChart"></canvas>';
    }
    
    // console.log('🛡️ [CACHE CLEAR] Cleared all cached data aggressively + enhanced contamination prevention');
    // console.log('🔒 [ISOLATION] Fresh analysis barrier active - old data cannot contaminate new analysis');
}

// Clear amplification files specifically
function clearAmplificationFiles() {
    amplificationFiles = {};
    
    // Clear file input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
    
    // Clear all status displays
    clearFileStatus('amplificationStatus');
    const uploadedFiles = document.getElementById('uploadedFiles');
    if (uploadedFiles) uploadedFiles.innerHTML = '';
    
    checkAnalysisReady();
    // console.log('Cleared amplification files');
}

// Clear summary file specifically
function clearSummaryFile() {
    samplesData = null;
    
    // Clear file input
    const samplesInput = document.getElementById('samplesInput');
    if (samplesInput) samplesInput.value = '';
    
    // Clear status display properly
    clearFileStatus('samplesStatus');
    
    checkAnalysisReady();
    // console.log('Cleared summary file');
}

// Function to ensure upload buttons are always enabled
function ensureUploadButtonsEnabled() {
    // AGGRESSIVE CACHE FIX: Force enable all upload buttons with multiple selectors
    const uploadButtons = document.querySelectorAll('.upload-btn, button[onclick*="fileInput"], button[onclick*="samplesInput"]');
    
    uploadButtons.forEach(button => {
        button.disabled = false;
        button.removeAttribute('disabled');
        button.style.opacity = '1';
        button.style.pointerEvents = 'auto';
        button.style.cursor = 'pointer';
        button.classList.remove('disabled');
        
        // Force visual state update
        button.style.backgroundColor = '';
        button.style.color = '';
    });
    
    // Direct ID-based targeting as backup
    const fileInputBtn = document.querySelector('button[onclick="document.getElementById(\'fileInput\').click()"]');
    const samplesInputBtn = document.querySelector('button[onclick="document.getElementById(\'samplesInput\').click()"]');
    
    [fileInputBtn, samplesInputBtn].forEach(button => {
        if (button) {
            button.disabled = false;
            button.removeAttribute('disabled');
            button.style.opacity = '1';
            button.style.pointerEvents = 'auto';
            button.style.cursor = 'pointer';
            button.classList.remove('disabled');
        }
    });
    
    // console.log('CACHE-BUST: Upload buttons force-enabled with aggressive clearing');
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Clear any cached data first
    clearCachedData();
    
    // Ensure upload buttons are always enabled - Force immediate execution
    setTimeout(() => {
        ensureUploadButtonsEnabled();
        // console.log('Force-enabled upload buttons after cache clear');
    }, 100);
    
    // File upload event listeners
    const fileInput = document.getElementById('fileInput');
    const samplesInput = document.getElementById('samplesInput');
    
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const files = Array.from(e.target.files);
            files.forEach(file => handleFileUpload(file, 'amplification'));
        });
    }
    
    if (samplesInput) {
        samplesInput.addEventListener('change', function(e) {
            if (e.target.files[0]) {
                handleFileUpload(e.target.files[0], 'samples');
            }
        });
    }
    
    // Analysis button with enhanced debugging
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
        // console.log('🧪 SETUP - Found analysis button, attaching event listener');
        
        // Remove any existing event listeners to prevent duplicates
        analyzeBtn.removeEventListener('click', performAnalysis);
        
        // Add the event listener with debugging
        analyzeBtn.addEventListener('click', function(e) {
            // console.log('🧪 CLICK - Analysis button clicked!', e);
            // console.log('🧪 CLICK - Button state:', {
                // disabled: analyzeBtn.disabled,
                // classList: Array.from(analyzeBtn.classList)
            // });
            
            // Prevent any potential default behavior
            e.preventDefault();
            e.stopPropagation();
            
            // Call the analysis function
            performAnalysis();
        });
        
        // console.log('🧪 SETUP - Analysis button event listener attached successfully');
    } else {
        // console.error('🧪 SETUP - analyzeBtn element not found during setup!');
    }
    
    // Well selector
    const wellSelector = document.getElementById('wellSelect');
    if (wellSelector) {
        wellSelector.addEventListener('change', function(e) {
            showWellDetails(e.target.value);
        });
    }
    
    // Export button - integrated with state management
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function(e) {
            // Check export state before allowing export
            if (!window.appState.exportState.isEnabled) {
                e.preventDefault();
                alert(window.appState.exportState.disabledReason || 'Export is currently disabled');
                return;
            }
            exportResults();
        });
    }
    
    // Status filter dropdown - using state management
    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus) {
        filterStatus.addEventListener('change', function() {
            const selectedFilter = this.value;
            // console.log('🔄 FILTER - Status filter changed to:', selectedFilter);
            
            // Update app state - this will coordinate all UI elements
            updateAppState({
                currentFilter: selectedFilter
            });
            
            // Filter table with new state
            filterTable();
        });
    }
    
    // Search wells input - using state management
    const searchWells = document.getElementById('searchWells');
    if (searchWells) {
        searchWells.addEventListener('input', function() {
            const searchTerm = this.value;
            // console.log('🔄 SEARCH - Search term changed to:', searchTerm);
            
            // Update app state - this will coordinate all UI elements
            updateAppState({
                currentSearchTerm: searchTerm
            });
            
            // Filter table with new state
            filterTable();
        });
    }
    
    // Delete all button is now handled inline in the history display
    
    // THRESHOLD CONTROLS MOVED TO threshold_frontend.js
    // All manual threshold controls, auto threshold button, and slider controls
    // are now handled in threshold_frontend.js via initializeManualThresholdControls()

    // --- End Threshold Controls (MOVED TO threshold_frontend.js) ---

    // Load analysis history on page load
    loadAnalysisHistory();
});

// Export and history functions (simplified)
function saveAnalysisToHistory(filename, results) {
    // Save to local storage as backup
    const history = getLocalAnalysisHistory();
    history.push({
        filename: filename,
        timestamp: new Date().toISOString(),
        results: results
    });
    
    // Keep only last 10 analyses
    if (history.length > 10) {
        history.splice(0, history.length - 10);
    }
    
    try {
        localStorage.setItem('qpcrAnalysisHistory', JSON.stringify(history));
    } catch (e) {
        // console.warn('Unable to save to local storage (data too large):', e);
        // Continue without local storage
    }
    loadAnalysisHistory();
}

async function saveSingleFluorophoreSession(filename, results, fluorophore) {
    try {
        const response = await fetch('/sessions/save-combined', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: filename,
                combined_results: results,
                fluorophores: [fluorophore]
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // console.log('Single fluorophore session saved:', result.display_name);
            
            // Set current session ID for threshold updates
            if (result.session_id) {
                window.currentSessionId = result.session_id;
                // console.log(`🔍 SESSION-ID - Set current session ID after single save: ${result.session_id}`);
            }
            
            // Refresh history display
            loadAnalysisHistory();
        } else {
            // console.error('Failed to save single fluorophore session:', result.error);
            // Fallback to local storage
            saveAnalysisToHistory(filename, results);
        }
        
    } catch (error) {
        // console.error('Error saving single fluorophore session:', error);
        // Fallback to local storage
        saveAnalysisToHistory(filename, results);
    }
}

async function saveCombinedSession(filename, combinedResults, fluorophores = []) {
    try {
        // console.log('🔍 SAVE-COMBINED-DEBUG - Saving combined session:', {
            // filename: filename,
            // totalWells: Object.keys(combinedResults.individual_results || {}).length,
            // fluorophores: fluorophores,
            // fluorophoreCount: combinedResults.fluorophore_count
        // });

        // Ensure JSON fields are properly serialized for database storage
        const processedResults = {
            ...combinedResults,
            individual_results: {}
        };

        // Process each well result to ensure proper JSON serialization
        if (combinedResults && combinedResults.individual_results) {
            for (const [wellKey, wellData] of Object.entries(combinedResults.individual_results)) {
                processedResults.individual_results[wellKey] = {
                    ...wellData,
                    // Ensure JSON fields are strings for database storage
                    raw_cycles: typeof wellData.raw_cycles === 'string' ? wellData.raw_cycles : JSON.stringify(wellData.raw_cycles || []),
                    raw_rfu: typeof wellData.raw_rfu === 'string' ? wellData.raw_rfu : JSON.stringify(wellData.raw_rfu || []),
                    fitted_curve: typeof wellData.fitted_curve === 'string' ? wellData.fitted_curve : JSON.stringify(wellData.fitted_curve || []),
                    fit_parameters: typeof wellData.fit_parameters === 'string' ? wellData.fit_parameters : JSON.stringify(wellData.fit_parameters || {}),
                    parameter_errors: typeof wellData.parameter_errors === 'string' ? wellData.parameter_errors : JSON.stringify(wellData.parameter_errors || {}),
                    anomalies: typeof wellData.anomalies === 'string' ? wellData.anomalies : JSON.stringify(wellData.anomalies || []),
                    // Ensure threshold-related fields are properly preserved
                    threshold_value: wellData.threshold_value !== undefined ? Number(wellData.threshold_value) : null,
                    is_good_scurve: Boolean(wellData.is_good_scurve),
                    // Preserve all numeric fields as numbers
                    amplitude: wellData.amplitude !== undefined ? Number(wellData.amplitude) : null,
                    r2_score: wellData.r2_score !== undefined ? Number(wellData.r2_score) : null,
                    rmse: wellData.rmse !== undefined ? Number(wellData.rmse) : null,
                    steepness: wellData.steepness !== undefined ? Number(wellData.steepness) : null,
                    midpoint: wellData.midpoint !== undefined ? Number(wellData.midpoint) : null,
                    baseline: wellData.baseline !== undefined ? Number(wellData.baseline) : null,
                    cq_value: wellData.cq_value !== undefined ? Number(wellData.cq_value) : null
                };
            }
        }
        
        // Include channel-specific and scale-specific threshold settings
        const thresholdSettings = {
            channelThresholds: channelThresholds || {},
            stableChannelThresholds: window.stableChannelThresholds || {},
            currentScaleMultiplier: currentScaleMultiplier || 1.0,
            currentScaleMode: currentScaleMode || 'linear',
            currentChartScale: typeof currentChartScale !== 'undefined' ? currentChartScale : 'linear',
            currentLogMin: currentLogMin || 0.1
        };

        const response = await fetch('/sessions/save-combined', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: filename,
                combined_results: processedResults,
                fluorophores: fluorophores,
                threshold_settings: thresholdSettings
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            // console.error('❌ Failed to save combined session:', errorData);
            throw new Error(`Server error: ${response.status}`);
        }
        
        const result = await response.json();
        // console.log('✅ Combined session saved successfully:', result);
        
        // Set current session ID for threshold updates
        if (result.session_id) {
            window.currentSessionId = result.session_id;
            // console.log(`🔍 SESSION-ID - Set current session ID after combined save: ${result.session_id}`);
        }
        
        // Refresh history to show the new session
        loadAnalysisHistory();
        
    } catch (error) {
        // console.error('❌ Error saving combined session:', error);
        // Fall back to individual sessions
        // console.log('Falling back to individual sessions:', fluorophores);
        loadAnalysisHistory();
    }
}

function getLocalAnalysisHistory() {
    try {
        return JSON.parse(localStorage.getItem('qpcrAnalysisHistory') || '[]');
    } catch (e) {
        return [];
    }
}

async function loadAnalysisHistory() {
    try {
        // Try to load from server first
        const response = await fetch('/sessions');
        const data = await response.json();
        
        if (data.sessions && data.sessions.length > 0) {
            displayAnalysisHistory(data.sessions);
            // Always validate channel completeness and update UI after loading history
            validateAndUpdateUI(data.sessions);
            // --- Patch: If a session is loaded, ensure chart and selectors are initialized ---
            // Find the most recent session with individual_results
            const latestSession = data.sessions.find(s => s.individual_results && Object.keys(s.individual_results).length > 0);
            if (latestSession) {
                // 🛡️ PROTECTED: Only auto-load if not in fresh analysis mode
                if (!window.freshAnalysisMode) {
                    // Set current session ID for threshold updates
                    window.currentSessionId = latestSession.id;
                    // console.log(`🔍 SESSION-ID - Set current session ID: ${latestSession.id}`);
                    
                    // Always wrap as { individual_results: ... }
                    setAnalysisResults({ individual_results: latestSession.individual_results }, 'auto-history-load');
                    // Initialize selectors and chart
                    populateWellSelector(latestSession.individual_results);
                    populateResultsTable(latestSession.individual_results);
                    // Show first well or all curves
                    const firstWell = Object.keys(latestSession.individual_results)[0];
                    if (firstWell) {
                        showWellDetails(firstWell);
                    } else {
                        showAllCurves('all');
                    }
                    // Always show all curves overlay after loading from history
                    showAllCurves('all');
                } else {
                    // console.log('🛡️ [BLOCKED] Auto-loading of latest session blocked due to fresh analysis mode');
                }
            }
        } else {
            // Fallback to local storage
            const localHistory = getLocalAnalysisHistory();
            displayLocalAnalysisHistory(localHistory);
            // Clear channel completion status if no sessions
            const statusContainer = document.getElementById('channelCompletionStatus');
            if (statusContainer) {
                statusContainer.innerHTML = '<p>No analysis history available for channel validation.</p>';
            }
        }
    } catch (error) {
        // console.error('Error loading history:', error);
        // Fallback to local storage
        const localHistory = getLocalAnalysisHistory();
        displayLocalAnalysisHistory(localHistory);
    }
}

// 🔧 NEW: Load analysis history for display only, without contaminating current analysis state
async function loadAnalysisHistoryOnly() {
    try {
        // Try to load from server first
        const response = await fetch('/sessions');
        const data = await response.json();
        
        if (data.sessions && data.sessions.length > 0) {
            displayAnalysisHistory(data.sessions);
            // Always validate channel completeness and update UI after loading history
            validateAndUpdateUI(data.sessions);
            
            // 🛡️ CRITICAL: Do NOT auto-load session data into current analysis state
            // This prevents data contamination when user loads new experiments
            // console.log('📚 [HISTORY ONLY] Loaded', data.sessions.length, 'sessions for display only');
        } else {
            // Fallback to local storage
            const localHistory = getLocalAnalysisHistory();
            displayLocalAnalysisHistory(localHistory);
            // Clear channel completion status if no sessions
            const statusContainer = document.getElementById('channelCompletionStatus');
            if (statusContainer) {
                statusContainer.innerHTML = '<p>No analysis history available for channel validation.</p>';
            }
        }
    } catch (error) {
        // console.error('Error loading history:', error);
        // Fallback to local storage
        const localHistory = getLocalAnalysisHistory();
        displayLocalAnalysisHistory(localHistory);
    }
}

// Channel validation and UI update functions
function validateAndUpdateUI(sessions) {
    if (typeof getTestCompletionStatus !== 'function') {
        // console.warn('Pathogen library not loaded - skipping validation');
        return;
    }
    
    // Filter sessions to only current experiment pattern if we have loaded analysis results
    let sessionsToValidate = sessions;
    if (currentAnalysisResults && currentAnalysisResults.individual_results) {
        const currentPattern = getCurrentFullPattern();
        if (currentPattern) {
            sessionsToValidate = sessions.filter(session => {
                const sessionPattern = extractBasePattern(session.filename);
                return sessionPattern === currentPattern;
            });
        }
    }
    
    const testStatus = getTestCompletionStatus(sessionsToValidate);
    // console.log('Test completion status:', testStatus);
    
    // Display pathogen channel status after calculating test completion
    displayPathogenChannelStatusInBreakdown(testStatus);
    
    // Check if any test has incomplete channels - only for current experiment
    let hasIncompleteCurrentTests = false;
    let incompleteTestsInfo = [];
    
    // Count complete experiments for trend analysis
    let hasCompleteExperiments = false;
    
    Object.values(testStatus).forEach(test => {
        test.experiments.forEach(experiment => {
            if (experiment.validation.isComplete) {
                hasCompleteExperiments = true;
            } else {
                // Only flag as incomplete if it's a recent experiment (has recent sessions)
                const recentSessions = experiment.sessionIds.filter(id => {
                    const session = sessions.find(s => s.id === id);
                    if (!session) return false;
                    const sessionDate = new Date(session.upload_timestamp);
                    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    return sessionDate > oneDayAgo;
                });
                
                if (recentSessions.length > 0) {
                    hasIncompleteCurrentTests = true;
                    incompleteTestsInfo.push({
                        testCode: test.testCode,
                        experimentPattern: experiment.experimentPattern,
                        missing: experiment.validation.missingChannels,
                        completion: experiment.validation.completionRate
                    });
                }
            }
        });
    });
    
    // Enable trend analysis unless we have incomplete current tests AND no complete experiments
    // Always enable if there are complete experiments OR if there are no experiments at all
    const shouldDisableTrends = hasIncompleteCurrentTests && !hasCompleteExperiments && Object.keys(testStatus).length > 0;
    updateTrendAnalysisButton(shouldDisableTrends, incompleteTestsInfo);
    
    // Export still requires current session completeness
    updateExportButton(hasIncompleteCurrentTests, incompleteTestsInfo);
    
    // Channel completion status no longer needed - system handles grouping correctly
}

function updateTrendAnalysisButton(hasIncompleteTests, incompleteTestsInfo) {
    // Find trend analysis button by multiple methods
    const trendButton = document.querySelector('[onclick="viewTrendAnalysis()"]') || 
                       document.querySelector('button[onclick="viewTrendAnalysis()"]') ||
                       Array.from(document.querySelectorAll('button')).find(btn => 
                           btn.textContent.includes('View Trends') || btn.textContent.includes('Trend'));
    
    if (trendButton) {
        // Always enable trend analysis - only check for complete experiments, not incomplete ones
        trendButton.disabled = false;
        trendButton.style.opacity = '1';
        trendButton.title = 'View trend analysis across all completed experiments';
        trendButton.innerHTML = 'View Trends';
    }
}

function updateExportButton(hasIncompleteTests, incompleteTestsInfo) {
    // console.log('🔄 EXPORT - Legacy updateExportButton called, routing to central state management');
    updateExportState({
        hasIncompleteTests,
        incompleteTestsInfo
    });
}

function checkCurrentExperimentComplete() {
    // Check if we have loaded analysis results
    if (!currentAnalysisResults || !currentAnalysisResults.individual_results) {
        return false;
    }
    
    // Get current experiment pattern
    const currentPattern = getCurrentFullPattern();
    if (!currentPattern) {
        return Object.keys(currentAnalysisResults.individual_results).length > 0;
    }
    
    // Check how many channels this experiment type requires
    const testCode = extractTestCode(currentPattern);
    const requiredChannels = ['FAM', 'HEX', 'Cy5']; // BVAB requires 3 channels
    
    // Count available fluorophores in current results
    const results = currentAnalysisResults.individual_results;
    const fluorophores = new Set();
    
    Object.keys(results).forEach(wellKey => {
        const fluorophore = wellKey.split('_').pop() || 'Unknown';
        if (fluorophore !== 'Unknown') {
            fluorophores.add(fluorophore);
        }
    });
    
    // For BVAB experiments, require all 3 channels
    if (testCode === 'BVAB' || testCode === 'AcBVAB') {
        return fluorophores.size >= 3;
    }
    
    // For other experiments, consider complete if has data
    return fluorophores.size > 0;
}

function displayChannelCompletionStatus(testStatus) {
    const statusContainer = safeGetElement('channelCompletionStatus', 'displayChannelCompletionStatus');
    if (!statusContainer) {
        return;
    }
    
    // console.log('Displaying channel completion status for tests:', Object.keys(testStatus));
    
    if (Object.keys(testStatus).length === 0) {
        statusContainer.style.display = 'none';
        return;
    }
    
    let statusHtml = '<h3>Pathogen Channel Completion Status</h3>';
    
    Object.values(testStatus).forEach(test => {
        const requiredChannels = getRequiredChannels ? getRequiredChannels(test.testCode) : [];
        
        statusHtml += `
            <div class="test-completion-card">
                <h4>${test.testCode} Test</h4>
                <p>Required channels: ${requiredChannels.join(', ')}</p>
                
                ${test.experiments.map(experiment => `
                    <div class="experiment-status ${experiment.validation.isComplete ? 'complete' : 'incomplete'}">
                        <div class="experiment-name">${experiment.experimentName || experiment.experimentPattern}</div>
                        <div class="channel-progress">
                            <span class="completion-rate">${experiment.validation.completionRate}% complete</span>
                            <div class="channel-indicators">
                                ${requiredChannels.map(channel => {
                                    const isPresent = experiment.uploadedChannels.includes(channel);
                                    const pathogenTarget = getPathogenTarget ? getPathogenTarget(test.testCode, channel) : channel;
                                    return `<span class="channel-indicator ${isPresent ? 'present' : 'missing'}" 
                                                  title="${pathogenTarget}">
                                              ${channel}${isPresent ? ' ✓' : ' ✗'}
                                            </span>`;
                                }).join('')}
                            </div>
                        </div>
                        ${!experiment.validation.isComplete ? 
                            `<div class="missing-channels">Missing: ${experiment.validation.missingChannels.join(', ')}</div>` : 
                            '<div class="complete-status">✓ All channels complete - Trend analysis enabled</div>'
                        }
                    </div>
                `).join('')}
            </div>
        `;
    });
    
    statusContainer.innerHTML = statusHtml;
    statusContainer.style.display = 'block';
}

async function updatePathogenChannelStatusInBreakdown() {
    try {
        // Only show channel validation for fresh analysis, not historical sessions
        if (!currentAnalysisResults || !currentAnalysisResults.individual_results) {
            return;
        }
        
        // Skip if this is a loaded historical session (has session_id), but allow fresh analysis that just got saved
        if (currentAnalysisResults.session_id && !currentAnalysisResults.freshAnalysis) {
            // console.log('🔍 VALIDATION DEBUG - Skipping validation display for historical session:', currentAnalysisResults.session_id);
            return;
        }
        
        const currentPattern = getCurrentFullPattern();
        const testCode = extractTestCode(currentPattern);
        
        if (testCode && getRequiredChannels) {
            const requiredChannels = getRequiredChannels(testCode);
            const availableChannels = new Set();
            
            // Extract fluorophores from current results
            Object.keys(currentAnalysisResults.individual_results).forEach(wellKey => {
                const fluorophore = wellKey.split('_').pop();
                if (fluorophore && ['Cy5', 'FAM', 'HEX', 'Texas Red'].includes(fluorophore)) {
                    availableChannels.add(fluorophore);
                }
            });
            
            // For individual channel sessions, detect fluorophore from filename if not found in results
            if (availableChannels.size === 0 && currentAnalysisResults.filename) {
                let detectedFluorophore = detectFluorophoreFromFilename(currentAnalysisResults.filename);
                
                // Dynamic detection for single-channel tests using pathogen library
                if (!detectedFluorophore || detectedFluorophore === 'Unknown') {
                         detectedFluorophore = detectFluorophoreFromPathogenLibrary(currentAnalysisResults.filename);
                }
                
                if (detectedFluorophore && detectedFluorophore !== 'Unknown') {
                    availableChannels.add(detectedFluorophore);
                    // console.log(`🔍 VALIDATION DEBUG - Enhanced fluorophore detection: ${currentAnalysisResults.filename} → ${detectedFluorophore}`);
                }
            }
            
            // Also check fluorophore field in individual results
            Object.values(currentAnalysisResults.individual_results).forEach(result => {
                if (result.fluorophore && ['Cy5', 'FAM', 'HEX', 'Texas Red'].includes(result.fluorophore)) {
                    availableChannels.add(result.fluorophore);
                    // console.log(`🔍 VALIDATION DEBUG - Found fluorophore in result: ${result.fluorophore}`);
                }
            });
            
            const availableChannelsArray = Array.from(availableChannels);
            const validation = validateChannelCompleteness(testCode, availableChannelsArray);
            
            // console.log('🔍 VALIDATION DEBUG - Current analysis validation:', {
                // testCode,
                // requiredChannels,
                // availableChannels: availableChannelsArray,
                // validation,
                // filename: currentAnalysisResults.filename,
                // isComplete: validation.isComplete,
                // missingChannels: validation.missingChannels,
                // completionRate: validation.completionRate
            // });
            
            // Show appropriate status based on channel completion
            const statusContainer = document.getElementById('pathogenChannelStatus');
            if (statusContainer) {
                if (validation.isComplete) {
                    // Complete status handled by main displayPathogenChannelStatusInBreakdown function
                    statusContainer.innerHTML = '';
                    statusContainer.style.display = 'none';
                } else {
                    // Only show warning for truly incomplete multi-channel tests
                    statusContainer.innerHTML = `
                        <div class="pathogen-status-header">
                            <h5>⚠️ Add all channels for complete stats</h5>
                            <div class="channel-status-alert">
                                <strong>${testCode} - ${currentPattern}</strong>: 
                                ${validation.completionRate}% complete 
                                (Missing: ${validation.missingChannels.join(', ')})
                                <div class="channel-indicators">
                                    ${requiredChannels.map(channel => {
                                        const isPresent = availableChannelsArray.includes(channel);
                                        const pathogenTarget = getPathogenTarget ? getPathogenTarget(testCode, channel) : channel;
                                        return `<span class="channel-indicator ${isPresent ? 'present' : 'missing'}" 
                                                      title="${pathogenTarget}">
                                                  ${channel}
                                                </span>`;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    `;
                    statusContainer.style.display = 'block';
                }
            }
        }
        
        // Fallback to database sessions check for loaded sessions
        const response = await fetch('/sessions');
        const data = await response.json();
        
        if (data.sessions && data.sessions.length > 0) {
            // Filter sessions to only current experiment pattern to prevent mixing data
            let sessionsToValidate = data.sessions;
            const currentPattern = getCurrentFullPattern();
            if (currentPattern) {
                sessionsToValidate = data.sessions.filter(session => {
                    const sessionPattern = extractBasePattern(session.filename);
                    return sessionPattern === currentPattern;
                });
                // console.log('Filtered sessions for validation:', sessionsToValidate.length, 'matching pattern:', currentPattern);
            }
            
            const testStatus = getTestCompletionStatus(sessionsToValidate);
            displayPathogenChannelStatusInBreakdown(testStatus);
        }
    } catch (error) {
        // console.error('Error updating pathogen channel status:', error);
    }
}

function getPathogenCompletionTagForBreakdown() {
    // Check if we have current analysis results (fresh analysis)
    if (currentAnalysisResults && currentAnalysisResults.individual_results) {
        const currentPattern = getCurrentFullPattern();
        const testCode = extractTestCode(currentPattern);
        
        // Validate current session completeness using pathogen library
        const fluorophores = Object.keys(currentAnalysisResults.individual_results);
        const validation = validateChannelCompleteness(testCode, fluorophores);
        
        if (validation.isComplete) {
            return '<div style="color: #27ae60; font-weight: bold; margin: 10px 0;">✓ All pathogen channels complete</div>';
        }
    }
    
    // Check loaded sessions from history
    const sessions = JSON.parse(localStorage.getItem('analysisSessions') || '[]');
    if (sessions.length > 0) {
        const currentPattern = getCurrentFullPattern();
        const testCode = extractTestCode(currentPattern);
        
        // Group sessions by experiment pattern and check completeness
        const sessionsForPattern = sessions.filter(s => {
            const sessionPattern = extractBasePattern(s.filename);
            return sessionPattern === currentPattern;
        });
        
        if (sessionsForPattern.length > 0) {
            const fluorophores = [...new Set(sessionsForPattern.map(s => detectFluorophoreFromSession(s)))];
            const validation = validateChannelCompleteness(testCode, fluorophores);
            
            if (validation.isComplete) {
                return '<div style="color: #27ae60; font-weight: bold; margin: 10px 0;">✓ All pathogen channels complete</div>';
            }
        }
    }
    
    return null;
}

function displayPathogenChannelStatusInBreakdown(testStatus) {
    const statusContainer = document.getElementById('channelCompletionStatus');
    if (!statusContainer) {
        return;
    }
    
    if (Object.keys(testStatus).length === 0) {
        statusContainer.innerHTML = '';
        return;
    }
    
    // Get the current experiment pattern from loaded analysis results
    const currentPattern = getCurrentFullPattern();
    
    let statusHtml = '';
    let hasCurrentExperiment = false;
    // Robust: always derive session loaded state from data, not a local variable
    const hasAnyLoadedSession = (
        currentAnalysisResults && currentAnalysisResults.individual_results &&
        Object.keys(currentAnalysisResults.individual_results).length > 0
    );
    
    // Additional check: if we have valid test status with sessions, we're in a loaded state
    const hasValidTestStatus = Object.values(testStatus).some(test => 
        test.experiments && test.experiments.length > 0 && 
        test.experiments.some(exp => exp.sessionIds && exp.sessionIds.length > 0)
    );
    
    // Additional check for loaded sessions - if we have no amplification files but have results, we're in loaded state
    const isInLoadedState = (!amplificationFiles || Object.keys(amplificationFiles).length === 0) && (hasAnyLoadedSession || hasValidTestStatus);
    
    // console.log('🔍 Session state check:', {
        // hasAnyLoadedSession,
        // isInLoadedState,
        // hasValidTestStatus,
        // currentPattern,
        // testStatusKeys: Object.keys(testStatus),
        // amplificationFilesCount: amplificationFiles ? Object.keys(amplificationFiles).length : 0
    // });
    
    Object.values(testStatus).forEach(test => {
        const requiredChannels = getRequiredChannels ? getRequiredChannels(test.testCode) : [];
        
        test.experiments.forEach(experiment => {
            // Check both exact pattern match and if we have any loaded session
            if ((currentPattern && experiment.experimentPattern === currentPattern) || 
                (hasAnyLoadedSession && !currentPattern)) {
                hasCurrentExperiment = true;
                
                if (!experiment.validation.isComplete) {
                    statusHtml += `
                        <div class="channel-status-alert">
                            <strong>${test.testCode} - ${experiment.experimentPattern}</strong>: 
                            ${experiment.validation.completionRate}% complete 
                            (Missing: ${experiment.validation.missingChannels.join(', ')})
                            <div class="channel-indicators">
                                ${requiredChannels.map(channel => {
                                    const isPresent = experiment.uploadedChannels.includes(channel);
                                    const pathogenTarget = getPathogenTarget ? getPathogenTarget(test.testCode, channel) : channel;
                                    return `<span class="channel-indicator ${isPresent ? 'present' : 'missing'}" 
                                                  title="${pathogenTarget}">
                                              ${channel}
                                            </span>`;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }
            }
        });
    });
    
    if (statusHtml) {
        statusContainer.innerHTML = `
            <div class="pathogen-status-header">
                <h5>Pending Channel Requirements:</h5>
                ${statusHtml}
            </div>
        `;
    } else if (hasCurrentExperiment || hasAnyLoadedSession || isInLoadedState || hasValidTestStatus) {
        // Check if any experiment is complete in the test status
        const anyComplete = Object.values(testStatus).some(test => 
            test.experiments.some(exp => 
                exp.validation && exp.validation.isComplete
            )
        );
        
        // console.log('🔍 Completion check:', {
            // anyComplete,
            // testStatusDetails: Object.entries(testStatus).map(([testCode, test]) => ({
                // testCode,
                // experiments: test.experiments.map(exp => ({
                    // pattern: exp.experimentPattern,
                    // isComplete: exp.validation?.isComplete,
                    // completionRate: exp.validation?.completionRate
                // }))
            // }))
        // });
        
        // Show completion tag for loaded sessions or when any experiment is complete
        if (hasAnyLoadedSession || isInLoadedState || hasValidTestStatus || anyComplete) {
            statusContainer.innerHTML = '<div class="all-complete">✓ All pathogen channels complete</div>';
            statusContainer.style.display = 'block';
            statusContainer.style.visibility = 'visible';
            statusContainer.style.opacity = '1';
            // console.log('🟢 Completion tag set at bottom for all tests');
        } else {
            statusContainer.innerHTML = '';
            statusContainer.style.display = 'none';
        }
    } else {
        statusContainer.innerHTML = '';
    }
}

// Helper functions for history display
function groupSessionsByExperiment(sessions) {
    // Group sessions by experiment pattern
    const experimentGroups = {};
    
    sessions.forEach(session => {
        const experimentPattern = extractBasePattern(session.filename);
        // console.log(`Grouping session: ${session.filename} -> Pattern: ${experimentPattern}`);
        if (!experimentGroups[experimentPattern]) {
            experimentGroups[experimentPattern] = [];
        }
        experimentGroups[experimentPattern].push(session);
    });
    
    // Create combined multi-fluorophore sessions
    const combinedSessions = [];
    
    Object.entries(experimentGroups).forEach(([experimentPattern, groupSessions]) => {
        // Filter out sessions without detectable fluorophores for multi-fluorophore combinations
        const validSessions = groupSessions.filter(session => {
            const fluorophore = detectFluorophoreFromFilename(session.filename);
            return fluorophore && fluorophore !== 'Unknown';
        });
        
        if (validSessions.length === 0) {
            // No valid sessions with detectable fluorophores - skip this group
            // console.log(`Skipping experiment group ${experimentPattern} - no valid fluorophore sessions`);
            return;
        } else if (validSessions.length === 1) {
            // Single valid session - keep as is with original filename for proper fluorophore detection
            const session = validSessions[0];
            // Don't modify filename to preserve fluorophore detection for pathogen targets
            combinedSessions.push(session);
        } else {
            // Multiple valid sessions - combine into multi-fluorophore session
            const combinedSession = createCombinedSession(experimentPattern, validSessions);
            combinedSessions.push(combinedSession);
        }
    });
    
    return combinedSessions;
}

function createCombinedSession(experimentPattern, sessions) {
    // Sort sessions by upload timestamp to get the latest as base
    const sortedSessions = sessions.sort((a, b) => 
        new Date(b.upload_timestamp) - new Date(a.upload_timestamp)
    );
    
    // PATHOGEN FIX: Extract proper experiment pattern from session filenames when pattern is "Unknown Pattern"
    let actualExperimentPattern = experimentPattern;
    if (experimentPattern === 'Unknown Pattern') {
        // Try to extract from any session filename that has a proper pattern
        for (const session of sessions) {
            const extractedPattern = extractBasePattern(session.filename);
            if (extractedPattern && extractedPattern !== 'Unknown Pattern') {
                actualExperimentPattern = extractedPattern;
                // console.log(`🔧 PATHOGEN FIX - Recovered experiment pattern from ${session.filename}: ${actualExperimentPattern}`);
                break;
            }
        }
        
        // If still unknown, try harder extraction from session filename
        if (actualExperimentPattern === 'Unknown Pattern' && sessions.length > 0) {
            const firstSession = sessions[0];
            // Look for pattern like "AcBVPanelPCR3_2576724_CFX366953" in any part of filename
            const patternMatch = firstSession.filename.match(/([A-Za-z]+[A-Za-z0-9]*_\d+_CFX\d+)/);
            if (patternMatch) {
                actualExperimentPattern = patternMatch[1];
                // console.log(`🔧 PATHOGEN FIX - Extracted pattern via regex from ${firstSession.filename}: ${actualExperimentPattern}`);
            }
        }
    }
    
    // Combine all well results from all sessions
    const allWellResults = [];
    const fluorophores = [];
    let totalPositive = 0;
    let totalWells = 0;
    
    sessions.forEach(session => {
        // Add all well results from this session
        if (session.well_results && session.well_results.length > 0) {
            allWellResults.push(...session.well_results);
            totalWells += session.well_results.length;
            
            // Count positive results from this session
            const sessionPositive = session.well_results.filter(well => {
                const amplitude = well.amplitude || 0;
                let hasAnomalies = false;
                
                if (well.anomalies) {
                    try {
                        const anomalies = typeof well.anomalies === 'string' ? 
                            JSON.parse(well.anomalies) : well.anomalies;
                        hasAnomalies = Array.isArray(anomalies) && anomalies.length > 0 && 
                                      !(anomalies.length === 1 && anomalies[0] === 'None');
                    } catch (e) {
                        hasAnomalies = true;
                    }
                }
                
                return session.is_good_scurve && amplitude > 500 && !hasAnomalies;
            }).length;
            
            totalPositive += sessionPositive;
        }
        
        // Extract fluorophore - prioritize well data over filename for multichannel sessions
        let fluorophore = 'Unknown';
        
        // First, try to get fluorophore from well results (most reliable)
        if (session.well_results && session.well_results.length > 0) {
            const wellFluorophores = [...new Set(session.well_results.map(well => well.fluorophore).filter(f => f && f !== 'Unknown'))];
            if (wellFluorophores.length === 1) {
                fluorophore = wellFluorophores[0];
                // console.log(`Found fluorophore from well data: ${fluorophore}`);
            } else if (wellFluorophores.length > 1) {
                // This is a multichannel session, add all fluorophores found
                wellFluorophores.forEach(f => {
                    if (!fluorophores.includes(f)) {
                        fluorophores.push(f);
                    }
                });
                // console.log(`Found multiple fluorophores from well data: ${wellFluorophores.join(', ')}`);
                return; // Skip the single fluorophore logic below for multichannel
            }
        }
        
        // Fallback: detect from filename if well data doesn't contain fluorophore info
        if (fluorophore === 'Unknown') {
            fluorophore = detectFluorophoreFromFilename(session.filename);
            // console.log(`Detecting fluorophore from filename: ${session.filename}`);
            // console.log(`Found fluorophore: ${fluorophore}`);
        }
        
        // Only include sessions with detectable fluorophores
        if (fluorophore && fluorophore !== 'Unknown' && !fluorophores.includes(fluorophore)) {
            fluorophores.push(fluorophore);
        }
    });
    
    // Calculate pathogen breakdown
    const pathogenBreakdown = calculatePathogenBreakdownFromSessions(sessions);
    
    // Create combined session object
    return {
        id: `combined_${actualExperimentPattern}`,
        filename: actualExperimentPattern,  // Use recovered experiment pattern
        upload_timestamp: sortedSessions[0].upload_timestamp,
        total_wells: allWellResults.length,
        good_curves: totalPositive,
        success_rate: allWellResults.length > 0 ? (totalPositive / allWellResults.length) * 100 : 0,
        cycle_min: Math.min(...sessions.map(s => s.cycle_min).filter(c => c)),
        cycle_max: Math.max(...sessions.map(s => s.cycle_max).filter(c => c)),
        cycle_count: sessions[0].cycle_count,
        pathogen_breakdown: pathogenBreakdown,
        well_results: allWellResults,
        session_ids: sessions.map(s => s.id),
        is_combined: true
    };
}

function calculatePathogenBreakdownFromSessions(sessions) {
    const fluorophoreStats = {};
    
    sessions.forEach(session => {
        let fluorophore = detectFluorophoreFromFilename(session.filename);
        
        // Enhanced fluorophore detection for single channel sessions
        if (!fluorophore || fluorophore === 'Unknown') {
            // For single-channel sessions, detect fluorophore from experiment pattern and pathogen library
            const testCode = extractTestCode(extractBasePattern(session.filename));
            if (testCode && getRequiredChannels) {
                const requiredChannels = getRequiredChannels(testCode);
                if (requiredChannels.length === 1) {
                    fluorophore = requiredChannels[0];
                }
            }
            
            // Fallback: Try to extract from stored pathogen_breakdown if available
            if ((!fluorophore || fluorophore === 'Unknown') && 
                session.pathogen_breakdown && 
                session.pathogen_breakdown !== 'Unknown: 0.0%') {
                const matches = session.pathogen_breakdown.match(/^(BVAB[123]|Cy5|FAM|HEX|Texas Red|Neisseria gonhorrea):/);
                if (matches) {
                    const pathogenTarget = matches[1];
                    // Map pathogen target back to fluorophore
                    if (pathogenTarget === 'BVAB1') fluorophore = 'HEX';
                    else if (pathogenTarget === 'BVAB2') fluorophore = 'FAM';
                    else if (pathogenTarget === 'BVAB3') fluorophore = 'Cy5';
                    else if (pathogenTarget === 'Neisseria gonhorrea') fluorophore = 'HEX';
                    else fluorophore = pathogenTarget;
                }
            }
            
            // Try to extract from well results fluorophore data
            if ((!fluorophore || fluorophore === 'Unknown') && session.well_results && session.well_results.length > 0) {
                for (const well of session.well_results) {
                    let wellFluorophore = well.fluorophore;
                    
                    // Try fit_parameters if direct fluorophore not available
                    if (!wellFluorophore || wellFluorophore === 'Unknown') {
                        try {
                            const fitParams = typeof well.fit_parameters === 'string' ? 
                                JSON.parse(well.fit_parameters) : well.fit_parameters;
                            if (fitParams && fitParams.fluorophore && fitParams.fluorophore !== 'Unknown') {
                                wellFluorophore = fitParams.fluorophore;
                            }
                        } catch (e) {
                            // Continue trying other methods
                        }
                    }
                    
                    // Try well_id extraction (A1_Cy5 -> Cy5)
                    if ((!wellFluorophore || wellFluorophore === 'Unknown') && well.well_id && well.well_id.includes('_')) {
                        const parts = well.well_id.split('_');
                        if (parts.length > 1) {
                            const possibleFluorophore = parts[parts.length - 1];
                            if (['Cy5', 'FAM', 'HEX', 'Texas Red'].includes(possibleFluorophore)) {
                                wellFluorophore = possibleFluorophore;
                            }
                        }
                    }
                    
                    if (wellFluorophore && wellFluorophore !== 'Unknown') {
                        fluorophore = wellFluorophore;
                        break;
                    }
                }
            }
        }
        
        // Final fallback for single-channel tests based on filename
       /* if ((!fluorophore || fluorophore === 'Unknown') && session.filename) {
            if (session.filename.includes('AcNgon')) fluorophore = 'HEX';
            else if (session.filename.includes('AcCtrach')) fluorophore = 'FAM'; 
            else if (session.filename.includes('AcTvag')) fluorophore = 'FAM';
            else if (session.filename.includes('AcCalb')) fluorophore = 'HEX';
            else if (session.filename.includes('AcMgen')) fluorophore = 'FAM';
            else if (session.filename.includes('AcUpar')) fluorophore = 'FAM';
            else if (session.filename.includes('AcUure')) fluorophore = 'FAM';
            // console.log(`Filename-based fluorophore detection: ${session.filename} -> ${fluorophore}`);
        }*/
        
        // Skip only if truly no fluorophore can be detected
        if (!fluorophore || fluorophore === 'Unknown') {
            // console.log(`Skipping session ${session.filename} - no fluorophore detected`);
            return;
        }
        
        let positive = 0;
        const total = session.well_results ? session.well_results.length : 0;
        
        if (session.well_results) {
            session.well_results.forEach(well => {
                const amplitude = well.amplitude || 0;
                if (well.is_good_scurve && amplitude > 500) {
                    positive++;
                }
            });
        }
        
        const rate = total > 0 ? (positive / total * 100).toFixed(1) : '0.0';
        
        // Get correct test code and pathogen target - Enhanced for combined sessions
        let actualTestCode = extractTestCode(session.filename);
        
        // For combined sessions, try to extract from base pattern if filename extraction fails
        if (!actualTestCode || actualTestCode === 'Unknown') {
            // Check if this is part of a combined session by looking at the experiment pattern
            const basePattern = extractBasePattern(session.filename);
            actualTestCode = extractTestCode(basePattern);
            // console.log(`🔍 COMBINED HISTORY DEBUG - Extracted from base pattern: ${basePattern} -> ${actualTestCode}`);
        }
        
        // Skip session entirely if no valid test code can be determined
        if (!actualTestCode || actualTestCode === 'Unknown') {
            // console.log(`🚨 CRITICAL ERROR - Cannot determine test code for session ${session.filename}. Skipping to prevent wrong pathogen mapping.`);
            return;
        }
        
        const pathogenTarget = getPathogenTarget(actualTestCode, fluorophore) || fluorophore;
        // console.log(`🔍 HISTORY DEBUG - Session ${session.filename}: testCode=${actualTestCode}, fluorophore=${fluorophore}, target=${pathogenTarget}`);
        
        fluorophoreStats[fluorophore] = `${pathogenTarget}: ${rate}%`;
        // console.log(`🔍 HISTORY DEBUG - Final fluorophore stat: ${fluorophore} = ${pathogenTarget}: ${rate}%`);
    });
    
    // Order by standard fluorophore sequence
    const orderedFluorophores = [ 'FAM', 'HEX', 'Texas Red','Cy5'];
    const orderedStats = [];
    
    orderedFluorophores.forEach(fluorophore => {
        if (fluorophoreStats[fluorophore]) {
            orderedStats.push(fluorophoreStats[fluorophore]);
        }
    });
    
    return orderedStats.join(' | ');
}

function calculatePositiveRate(session) {
    // console.log('🔍 HISTORY DEBUG - calculatePositiveRate called for:', session.filename);
    // console.log('🔍 HISTORY DEBUG - Session has pathogen_breakdown:', !!session.pathogen_breakdown);
    // console.log('🔍 HISTORY DEBUG - Session well_results length:', session.well_results?.length || 0);

    // Check if stored pathogen breakdown contains "Unknown" OR fluorophore names instead of pathogen targets
    const hasUnknown = session.pathogen_breakdown && session.pathogen_breakdown.includes('Unknown');
    const hasFluorophoreNames = session.pathogen_breakdown && 
        (session.pathogen_breakdown.includes('FAM:') || session.pathogen_breakdown.includes('HEX:') || 
         session.pathogen_breakdown.includes('Cy5:') || session.pathogen_breakdown.includes('Texas Red:'));

    if (session.pathogen_breakdown && !hasUnknown && !hasFluorophoreNames) {
        // console.log('🔍 HISTORY DEBUG - Using valid stored pathogen_breakdown:', session.pathogen_breakdown);
        return session.pathogen_breakdown;
    }

    // console.log('🔍 HISTORY DEBUG - Stored breakdown contains Unknown/fluorophore names or missing, recalculating...',
        // { hasUnknown, hasFluorophoreNames, breakdown: session.pathogen_breakdown });

    // Fallback: use individual_results if well_results is empty
    let wells = session.well_results && session.well_results.length > 0
        ? session.well_results
        : (session.individual_results ? Object.values(session.individual_results) : []);
    if (!wells || wells.length === 0) {
        return "0.0";
    }

    // Group wells by channel using PATHOGEN_LIBRARY for assignment
    const testCode = extractTestCode(session.filename) || 'Unknown';
    const testData = (typeof PATHOGEN_LIBRARY !== 'undefined' && PATHOGEN_LIBRARY[testCode]) ? PATHOGEN_LIBRARY[testCode] : null;
    if (!testData) {
        return "0.0";
    }
    const channels = Object.keys(testData).filter(c => c !== 'Unknown');
    const channelGroups = {};
    channels.forEach(channel => {
        channelGroups[channel] = { total: 0, positive: 0, pathogen: testData[channel] || channel };
    });

    wells.forEach(well => {
        // Only count patient samples
        const sampleName = well.sample_name || '';
        if (isControlSample(sampleName, testCode)) return;
        let channel = null;
        // 1. Try well.fluorophore
        if (well.fluorophore && channelGroups[well.fluorophore]) {
            channel = well.fluorophore;
        }
        // 2. Try extracting from well_id (e.g., "A1_Cy5" -> "Cy5")
        if (!channel && well.well_id) {
            const extracted = extractFluorophoreFromWellId(well.well_id);
            if (extracted && channelGroups[extracted]) {
                channel = extracted;
            }
        }
        // 3. If only one channel exists, use it
        if (!channel && channels.length === 1) {
            channel = channels[0];
        }
        if (!channelGroups[channel]) return;
        channelGroups[channel].total++;
        const amplitude = well.amplitude || 0;
        let hasAnomalies = false;
        if (well.anomalies) {
            try {
                const anomalies = typeof well.anomalies === 'string' ? JSON.parse(well.anomalies) : well.anomalies;
                hasAnomalies = Array.isArray(anomalies) && anomalies.length > 0 && !(anomalies.length === 1 && anomalies[0] === 'None');
            } catch (e) {
                hasAnomalies = true;
            }
        }
        const isGoodSCurve = well.is_good_scurve || false;
        if (isGoodSCurve && amplitude > 500 && !hasAnomalies) {
            channelGroups[channel].positive++;
        }
    });

    // Build display string from channelGroups
    const rates = [];
    channels.forEach(channel => {
        const group = channelGroups[channel];
        if (group.total === 0) return;
        const rate = (group.positive / group.total * 100).toFixed(1);
        rates.push(`${group.pathogen}: ${rate}%`);
    });
    return rates.length > 0 ? rates.join(' | ') : "0.0";
}

function extractFluorophoreFromWellId(wellId) {
    if (!wellId || typeof wellId !== 'string') return null;
    const parts = wellId.split('_');
    return parts.length > 1 ? parts[1] : null;
}

function getHistoryValidationMessage(session) {
    // Handle completion tags for combined sessions (multi-channel tests)
    if (session.is_combined) {
        // Extract test pattern and code for combined sessions
        const sessionPattern = extractBasePattern(session.filename || session.display_name);
        const testCode = extractTestCode(sessionPattern);
        
        // console.log(`🔍 COMBINED SESSION VALIDATION DEBUG - Session: ${session.display_name || session.filename}, testCode: ${testCode}`);
        
        // For combined sessions, check completion status directly using pathogen library
        if (typeof getRequiredChannels === 'function' && typeof validateChannelCompleteness === 'function') {
            // Extract fluorophores from session's constituent sessions
            const sessionFluorophores = [];
            
            // If this is a combined session with session_ids, check those individual sessions
            if (session.session_ids && Array.isArray(session.session_ids)) {
                // For combined sessions, we need to extract fluorophores from the combined well results
                if (session.well_results && Array.isArray(session.well_results)) {
                    const fluorophoreSet = new Set();
                    session.well_results.forEach(well => {
                        if (well.fluorophore && well.fluorophore !== 'Unknown') {
                            fluorophoreSet.add(well.fluorophore);
                        }
                    });
                    sessionFluorophores.push(...fluorophoreSet);
                }
            }
            
            // console.log(`🔍 COMBINED SESSION VALIDATION DEBUG - Session: ${session.display_name || session.filename}, testCode: ${testCode}`);
            // console.log(`🔍 COMBINED SESSION VALIDATION DEBUG - sessionFluorophores:`, sessionFluorophores);
            
            if (sessionFluorophores.length > 0) {
                const requiredChannels = getRequiredChannels(testCode);
                const validation = validateChannelCompleteness(testCode, sessionFluorophores);
                
                // console.log(`🔍 COMBINED SESSION VALIDATION DEBUG - requiredChannels:`, requiredChannels);
                // console.log(`🔍 COMBINED SESSION VALIDATION DEBUG - validation:`, validation);
                
                if (validation.isComplete === true) {
                    // console.log(`🔍 COMBINED SESSION VALIDATION DEBUG - COMPLETE: Showing completion tag for ${testCode}`);
                    return '<br><small style="color: #27ae60;">✓ All pathogen channels complete</small>';
                } else {
                    // console.log(`🔍 COMBINED SESSION VALIDATION DEBUG - NOT COMPLETE: ${validation.completionRate}% complete`);
                    return '<br><small style="color: #e67e22;">⚠️ Add all channels for complete stats</small>';
                }
            }
        }
        
        // console.log(`🔍 COMBINED SESSION VALIDATION DEBUG - Default fallback for ${testCode}`);
        return '';
    }
    
    // Extract test pattern and fluorophore from session
    const sessionPattern = extractBasePattern(session.filename);
    const testCode = extractTestCode(sessionPattern);
    
    // console.log(`🔍 HISTORY VALIDATION DEBUG - Session: ${session.filename}, testCode: ${testCode}`);
    
    // Get validation requirements using pathogen library
    if (typeof getTestCompletionStatus === 'function') {
        // Create a minimal session array for validation
        const sessionArray = [session];
        const testStatus = getTestCompletionStatus(sessionArray);
        
        // console.log(`🔍 HISTORY VALIDATION DEBUG - testStatus:`, testStatus);
        
        // Check if this test is complete
        if (testStatus[testCode] && testStatus[testCode].experiments.length > 0) {
            const experiment = testStatus[testCode].experiments[0];
            // console.log(`🔍 HISTORY VALIDATION DEBUG - experiment validation:`, experiment.validation);
            if (experiment.validation && experiment.validation.isComplete) {
                // console.log(`🔍 HISTORY VALIDATION DEBUG - COMPLETE: Showing completion tag for ${testCode}`);
                return '<br><small style="color: #27ae60;">✓ All pathogen channels complete</small>';
            } else {
                // console.log(`🔍 HISTORY VALIDATION DEBUG - INCOMPLETE: Showing warning for ${testCode}`);
                return '<br><small style="color: #e67e22;">⚠️ Add all channels for complete stats</small>';
            }
        } else {
            // console.log(`🔍 HISTORY VALIDATION DEBUG - No testStatus found for ${testCode}`);
        }
    }
    
    // Fallback: check if this is a single-channel test
    if (testCode === 'Ngon' || testCode === 'Calb') {
        // console.log(`🔍 HISTORY VALIDATION DEBUG - Single-channel fallback for ${testCode}`);
        // Single-channel tests are always complete
        return '<br><small style="color: #27ae60;">✓ All pathogen channels complete</small>';
    }
    
    // console.log(`🔍 HISTORY VALIDATION DEBUG - Default fallback for ${testCode}`);
    // Default for multi-channel tests without validation - show completion tag
    return '<br><small style="color: #27ae60;">✓ All pathogen channels complete</small>';
}

function extractCycleInfo(session) {
    // Primary: Use session cycle_count if available
    if (session.cycle_count && session.cycle_count > 0) {
        return session.cycle_count.toString();
    }
    
    // Secondary: Use cycle range from session data
    if (session.cycle_max && session.cycle_min) {
        return session.cycle_count ? session.cycle_count.toString() : `${session.cycle_min}-${session.cycle_max}`;
    }
    
    // Extract cycle information from well results if session data unavailable
    if (session.well_results && session.well_results.length > 0) {
        for (const well of session.well_results) {
            if (well.raw_cycles) {
                try {
                    const cycles = typeof well.raw_cycles === 'string' ? 
                        JSON.parse(well.raw_cycles) : well.raw_cycles;
                    if (Array.isArray(cycles) && cycles.length > 0) {
                        return cycles.length.toString();
                    }
                } catch (e) {
                    continue;
                }
            }
            
            // Try data_points field as fallback
            if (well.data_points && well.data_points > 0) {
                return well.data_points.toString();
            }
        }
    }
    
    return "N/A";
}

function clearPathogenBreakdownDisplay() {
    // Clear pathogen breakdown section to prevent mixing data from different experiments
    const pathogenBreakdownSection = document.querySelector('.pathogen-breakdown-section');
    if (pathogenBreakdownSection) {
        pathogenBreakdownSection.innerHTML = '';
    }
    
    // Clear pending channel requirements display
    const pendingChannelSection = document.querySelector('#pendingChannelRequirements');
    if (pendingChannelSection) {
        pendingChannelSection.innerHTML = '';
    }
    
    // Clear channel completion status
    const channelStatusSection = document.querySelector('#channelCompletionStatus');
    if (channelStatusSection) {
        channelStatusSection.innerHTML = '';
    }
}

function disableChannelValidationForHistoryView(sessionFilename) {
    // Hide or disable channel validation UI when viewing historical sessions
    // This prevents showing pending requirements from other unrelated experiments
    
    const channelStatusElements = document.querySelectorAll('.channel-completion-status, .pathogen-status-card');
    channelStatusElements.forEach(element => {
        element.style.display = 'none';
    });
    
    // Also hide any pending channel requirement messages
    const pendingMessages = document.querySelectorAll('.pending-channel-message, .channel-requirements');
    pendingMessages.forEach(element => {
        element.style.display = 'none';
    });
    
    // Hide pathogen channel status specifically for loaded sessions
    const pathogenChannelStatus = document.getElementById('pathogenChannelStatus');
    if (pathogenChannelStatus) {
        pathogenChannelStatus.style.display = 'none';
    }
    
    // console.log('Disabled channel validation UI for historical session:', sessionFilename);
}


function displayAnalysisHistory(sessions) {
    const historyContent = safeGetElement('historyContent', 'displayAnalysisHistory');
    if (!historyContent) return;
    
    if (!sessions || sessions.length === 0) {
        historyContent.innerHTML = '<p>No analysis history available.</p>';
        return;
    }
    
    // Group sessions by experiment pattern and create multi-fluorophore sessions
    const groupedSessions = groupSessionsByExperiment(sessions);
    
    // Store grouped sessions globally for reference
    window.currentCombinedSessions = groupedSessions;
    
    // Sort grouped sessions by upload timestamp (newest first)
    const sortedSessions = [...groupedSessions].sort((a, b) => 
        new Date(b.upload_timestamp) - new Date(a.upload_timestamp)
    );
    
    const tableHtml = `
        <div class="history-table-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span style="font-weight: bold; color: #2c3e50;">Session History</span>
            <button onclick="deleteAllSessions()" 
                    style="background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;"
                    title="Delete all analysis sessions">
                Delete All
            </button>
        </div>
        <table class="history-table">
            <thead>
                <tr>
                    <th>File Name</th>
                    <th>Date</th>
                    <th>Wells</th>
                    <th>Positive Rate</th>
                    <th>Cycles</th>

                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${sortedSessions.map(session => `
                    <tr data-session-id="${session.id}" class="history-row">
                        <td><strong><a href="javascript:void(0)" onclick="loadSessionDetails('${session.id}')" class="session-link">${session.display_name || session.filename}</a></strong></td>
                        <td>${new Date(session.upload_timestamp).toLocaleString()}</td>
                        <td>
                            <div class="session-stats">
                                <span class="session-stat">${session.total_wells} total</span>
                            </div>
                        </td>
                        <td>${calculatePositiveRate(session)}${getHistoryValidationMessage(session)}</td>
                        <td>${extractCycleInfo(session)}</td>
                        <td onclick="event.stopPropagation()">
                            <button onclick="loadSessionDetails('${session.id}')" class="btn-small btn-primary">View</button>
                            <button onclick="deleteSessionGroup('${session.id}', event)" class="btn-small btn-danger">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    historyContent.innerHTML = tableHtml;
}

function displayLocalAnalysisHistory(history) {
    const historyContent = document.getElementById('historyContent');
    if (!historyContent) return;
    
    if (history.length === 0) {
        historyContent.innerHTML = '<p>No local analysis history available.</p>';
        return;
    }
    
    const tableHtml = `
        <table class="history-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Filename</th>
                    <th>Wells</th>
                    <th>Good Curves</th>
                    <th>Positive Rate</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${history.map((session, index) => `
                    <tr>
                        <td>${new Date(session.timestamp).toLocaleDateString()}</td>
                        <td>${session.filename}</td>
                        <td>${session.results.total_wells || 0}</td>
                        <td>${session.results.good_curves ? session.results.good_curves.length : 0}</td>
                        <td>${session.results.success_rate ? (session.results.success_rate * 100).toFixed(1) : 0}%</td>
                        <td>
                            <button onclick="loadLocalSessionDetails(${index})" class="btn-small btn-primary">View</button>
                            <button onclick="deleteLocalSession(${index})" class="btn-small btn-danger">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    historyContent.innerHTML = tableHtml;
}

async function loadSessionDetails(sessionId) {
    try {
        // console.log('Loading session details for ID:', sessionId);
        
        // Check if this is a fresh load after refresh
        const pendingSessionLoad = localStorage.getItem('pendingSessionLoad');
        if (!pendingSessionLoad) {
            // First time - store session ID and refresh
            // console.log('Storing session ID and refreshing browser');
            safeSetItem(localStorage, 'pendingSessionLoad', sessionId);
            window.location.reload();
            return;
        } else if (pendingSessionLoad !== sessionId) {
            // Different session ID - store new one and refresh
            // console.log('Different session - storing new ID and refreshing');
            safeSetItem(localStorage, 'pendingSessionLoad', sessionId);
            window.location.reload();
            return;
        }
        
        // This is after refresh - clear the flag and proceed with loading
        localStorage.removeItem('pendingSessionLoad');
        // console.log('Loading session after refresh:', sessionId);
        
        // Handle combined sessions
        if (typeof sessionId === 'string' && sessionId.startsWith('combined_')) {
            // After refresh, we need to rebuild combined sessions first
            if (!window.currentCombinedSessions) {
                // console.log('Rebuilding combined sessions after refresh');
                await loadAnalysisHistoryOnly(); // 🛡️ Use non-contaminating version
            }
            
            const combinedSession = window.currentCombinedSessions?.find(s => s.id === sessionId);
            if (combinedSession) {
                // console.log('Loading combined session data:', combinedSession);
                displaySessionResults(combinedSession);
                return;
            } else {
                // console.error('Combined session not found in currentCombinedSessions:', window.currentCombinedSessions);
                throw new Error('Combined session not found');
            }
        }
        
        // Handle individual database sessions
        const response = await fetch(`/sessions/${sessionId}`);
        const sessionData = await response.json();
        
        if (!sessionData.session) {
            throw new Error('Session not found');
        }
        
        const session = sessionData.session;
        const wells = sessionData.wells || [];
        // console.log('Loaded session data:', {sessionName: session.filename, wellCount: wells.length});
        
        // Store session filename for pattern extraction
        window.currentSessionFilename = session.filename;
        
        // Transform the session data into the expected format
        // Use stored database values instead of recalculating from individual wells
        const transformedResults = {
            total_wells: session.total_wells,
            good_curves: session.good_curves, // Use stored value from database
            success_rate: session.success_rate,
            filename: session.filename, // Add filename to results
            individual_results: {}
        };
        
        // Transform well results
        wells.forEach((well, index) => {
            // Enhanced fluorophore detection for history loading
            let fluorophore = 'Unknown';
            let baseWellId = well.well_id;
            
            // Method 1: Extract from well_id if it contains fluorophore suffix (A1_Cy5)
            if (well.well_id.includes('_')) {
                const parts = well.well_id.split('_');
                baseWellId = parts[0];
                const possibleFluorophore = parts[1];
                if (['Cy5', 'FAM', 'HEX', 'Texas Red'].includes(possibleFluorophore)) {
                    fluorophore = possibleFluorophore;
                }
            }
            
            // Method 2: Try to get from well.fluorophore field
            if (fluorophore === 'Unknown' && well.fluorophore && well.fluorophore !== 'Unknown') {
                fluorophore = well.fluorophore;
            }
            
            // Method 3: Extract from fit_parameters if available
            if (fluorophore === 'Unknown' && well.fit_parameters) {
                try {
                    const fitParams = typeof well.fit_parameters === 'string' ? 
                        JSON.parse(well.fit_parameters) : well.fit_parameters;
                    if (fitParams && fitParams.fluorophore && fitParams.fluorophore !== 'Unknown') {
                        fluorophore = fitParams.fluorophore;
                    }
                } catch (e) {
                    // console.warn('Failed to parse fit_parameters for fluorophore detection:', e);
                }
            }
            
            // Method 4: Detect from session filename pattern
            if (fluorophore === 'Unknown') {
                fluorophore = detectFluorophoreFromFilename(session.filename);
            }
            
            const wellKey = well.well_id; // Use the full well_id as stored in database
            
            // Debug first few wells from database
            if (index < 3) {
                // console.log(`History well ${well.well_id} raw data:`, {
                    // rmse: well.rmse,
                    // amplitude: well.amplitude,
                    // steepness: well.steepness,
                    // midpoint: well.midpoint,
                    // baseline: well.baseline,
                    // raw_cycles: typeof well.raw_cycles + ' length:' + (well.raw_cycles?.length || 'N/A'),
                    // raw_rfu: typeof well.raw_rfu + ' length:' + (well.raw_rfu?.length || 'N/A')
                // });
            }
            
// Defensive: ensure curve_classification is always present
let curveClassificationValue;
if (well.curve_classification !== undefined) {
    curveClassificationValue = well.curve_classification;
} else if (well.classification !== undefined) {
    // Fallback: if legacy field exists
    curveClassificationValue = well.classification;
} else {
    curveClassificationValue = 'N/A';
}
transformedResults.individual_results[wellKey] = {
    curve_classification: curveClassificationValue,
    well_id: baseWellId,
    fluorophore: fluorophore,
    is_good_scurve: well.is_good_scurve,
    // Ensure numeric values are properly converted from database strings
    r2_score: parseFloat(well.r2_score) || 0,
    rmse: parseFloat(well.rmse) || 0,
    amplitude: parseFloat(well.amplitude) || 0,
    steepness: parseFloat(well.steepness) || 0,
    midpoint: parseFloat(well.midpoint) || 0,
    baseline: parseFloat(well.baseline) || 0,
    data_points: parseInt(well.data_points) || 0,
    cycle_range: well.cycle_range,
    sample: well.sample_name,
    sample_name: well.sample_name,
    cq_value: well.cq_value ? parseFloat(well.cq_value) : null,
    
    // Debug parameter values during history loading
    _debug_params: {
        rmse: well.rmse,
        amplitude: well.amplitude,
        steepness: well.steepness,
        midpoint: well.midpoint,
        baseline: well.baseline
    },
    anomalies: (() => {
        try {
            if (Array.isArray(well.anomalies)) {
                return well.anomalies;
            }
            const anomaliesStr = well.anomalies || '[]';
            return JSON.parse(anomaliesStr);
        } catch (e) {
            // console.warn('Failed to parse anomalies for well', well.well_id, ':', e, 'Raw value:', well.anomalies);
            return [];
        }
    })(),
    fitted_curve: Array.isArray(well.fitted_curve) ? 
        well.fitted_curve.map(val => parseFloat(val) || 0) : (() => {
        try {
            const parsed = JSON.parse(well.fitted_curve || '[]');
            return Array.isArray(parsed) ? parsed.map(val => parseFloat(val) || 0) : [];
        } catch (e) {
            return [];
        }
    })(),
    raw_cycles: (() => {
        if (Array.isArray(well.raw_cycles)) {
            return well.raw_cycles.map(val => parseFloat(val) || 0);
        }
        try {
            const parsed = JSON.parse(well.raw_cycles || '[]');
            return Array.isArray(parsed) ? parsed.map(val => parseFloat(val) || 0) : [];
        } catch (e) {
            // console.warn('Failed to parse raw_cycles for well', well.well_id, ':', well.raw_cycles);
            return [];
        }
    })(),
    raw_rfu: (() => {
        if (Array.isArray(well.raw_rfu)) {
            return well.raw_rfu.map(val => parseFloat(val) || 0);
        }
        try {
            const parsed = JSON.parse(well.raw_rfu || '[]');
            return Array.isArray(parsed) ? parsed.map(val => parseFloat(val) || 0) : [];
        } catch (e) {
            // console.warn('Failed to parse raw_rfu for well', well.well_id, ':', well.raw_rfu);
            return [];
        }
    })(),
    fit_parameters: typeof well.fit_parameters === 'object' ? well.fit_parameters : (() => {
        try {
            return JSON.parse(well.fit_parameters || '{}');
        } catch (e) {
            return {};
        }
    })(),
    parameter_errors: typeof well.parameter_errors === 'object' ? well.parameter_errors : (() => {
        try {
            return JSON.parse(well.parameter_errors || '{}');
        } catch (e) {
            return {};
        }
    })(),
    // Add missing threshold_value field for threshold annotations
    threshold_value: well.threshold_value ? parseFloat(well.threshold_value) : null,
    
    // 🔍 THRESHOLD-DEBUG: Log threshold_value during history loading
    _debug_threshold: {
        original_threshold: well.threshold_value,
        type: typeof well.threshold_value,
        isNull: well.threshold_value == null,
        isNaN: isNaN(well.threshold_value),
        converted: well.threshold_value ? parseFloat(well.threshold_value) : null
    }
};
        });
        
        // Set global analysis results for chart functionality
        analysisResults = transformedResults;
        
        // Store session data globally for pathogen target extraction
        window.currentSessionData = sessionData;
        
        // Auto-detect fluorophore for individual channel sessions and set filter
        const sessionFluorophores = [...new Set(Object.values(transformedResults.individual_results).map(well => well.fluorophore))];
        let autoSelectedFluorophore = 'all';
        
        if (sessionFluorophores.length === 1 && sessionFluorophores[0] !== 'Unknown') {
            // Single fluorophore session - auto-select it
            autoSelectedFluorophore = sessionFluorophores[0];
        }
        
        // Set analysis results for proper display (permanent for history loading)
        setAnalysisResults(transformedResults, 'history-session-load');
        
        // IMMEDIATE: Initialize thresholds as soon as individual session results are available
        if (window.initializeChannelThresholds) {
            // console.log('🔍 THRESHOLD-INIT - Initializing thresholds immediately after setting individual session results');
            window.initializeChannelThresholds();
            
            // Also immediately update threshold UI elements for history loading
            setTimeout(() => {
                if (window.updateAllChannelThresholds) {
                    // console.log('🔍 THRESHOLD-INIT - Updating threshold UI elements for individual session');
                    window.updateAllChannelThresholds();
                }
            }, 50);
        }
        
        // Update state with auto-detected fluorophore and reset filters
        updateAppState({
            currentFluorophore: autoSelectedFluorophore,
            currentFilter: 'all',
            currentChartMode: 'all'
        });
        
        // Trigger control validation directly for individual sessions
        // This ensures control grids appear for both single-channel and multi-channel tests
        // console.log('🔍 UNIVERSAL DISPLAY - Triggering control validation for individual session');
        
        // Display using multi-fluorophore layout (handles both single and multi-channel)
        displayMultiFluorophoreResults(transformedResults);
        
        // Control grids are now handled within displayMultiFluorophoreResults
        // console.log('🔍 HISTORY LOAD - Control grids handled by displayMultiFluorophoreResults');
        
        // Trigger enhanced control validation display
        setTimeout(() => {
            enhanceControlValidationWithPathogenInfo();
        }, 300);
        
        // Reset filter state when loading from history
        resetFilterState();
        
        // Clear any existing pathogen breakdown from other experiments
        clearPathogenBreakdownDisplay();
        
        // Disable channel validation UI when viewing historical sessions
        // This prevents showing pending requirements from other experiments
        disableChannelValidationForHistoryView(session.filename);
        
        // Auto-select fluorophore filter for single-channel sessions
        if (autoSelectedFluorophore !== 'all') {
            const fluorophoreFilter = document.getElementById('fluorophoreFilter');
            if (fluorophoreFilter) {
                // Update dropdown to show the specific fluorophore
                fluorophoreFilter.value = autoSelectedFluorophore;
                
                // Update experiment pattern display with pathogen target
                updateExperimentPatternWithPathogen(session.filename, autoSelectedFluorophore);
                
                // Apply the fluorophore filter to show only relevant wells
                setTimeout(() => {
                    filterTableByFluorophore();
                    
                    // Initialize chart for single-channel session
                    if (sessionFluorophores.length === 1) {

                        updateChartDisplayMode('all');
                    }
                }, 200);
            }
        }
        
        // Show pathogen grids for loaded session - DISABLED to prevent duplicate tabs
        // The control validation system already handles pathogen grids
        if (session.filename && session.filename.includes('BVAB')) {
            // console.log('🔍 BVAB session loaded - pathogen grids handled by control validation system');
        }
        
        // Scroll to analysis section
        document.getElementById('analysisSection').scrollIntoView({ behavior: 'smooth' });
        
        // console.log('Session loading complete - transformedResults keys:', Object.keys(transformedResults.individual_results).slice(0, 5));
        
    } catch (error) {
        // console.error('Error loading session details:', error);
        alert('Error loading session details: ' + error.message);
    }
}

function loadLocalSessionDetails(sessionIndex) {
    try {
        const history = getLocalAnalysisHistory();
        if (!history || sessionIndex >= history.length) {
            // console.error('Session not found in local history');
            return;
        }
        const session = history[sessionIndex];
        analysisResults = session.results;
        
        // Set analysis results for proper display (permanent for history loading)
        setAnalysisResults(session.results, 'local-history-session');
        
        // IMMEDIATE: Initialize thresholds as soon as local session results are available
        if (window.initializeChannelThresholds) {
            // console.log('🔍 THRESHOLD-INIT - Initializing thresholds immediately after setting local session results');
            window.initializeChannelThresholds();
            
            // Also immediately update threshold UI elements for local history loading
            setTimeout(() => {
                if (window.updateAllChannelThresholds) {
                    // console.log('🔍 THRESHOLD-INIT - Updating threshold UI elements for local session');
                    window.updateAllChannelThresholds();
                }
            }, 50);
        }
        
        // Display the results properly
        if (session.results.fluorophore_count && session.results.fluorophore_count > 1) {
            displayMultiFluorophoreResults(session.results);
        } else {
            displayAnalysisResults(session.results);
        }
        
        // Patch: set hasAnyLoadedSession = true and force UI to loaded state
        if (typeof window.hasAnyLoadedSession !== 'undefined') {
            window.hasAnyLoadedSession = true;
        }
        try {
            hasAnyLoadedSession = true;
        } catch (e) {}
        // Show analysis section, hide upload/history
        const analysisSection = document.getElementById('analysisSection');
        if (analysisSection) analysisSection.style.display = '';
        const historySection = document.getElementById('historySection');
        if (historySection) historySection.style.display = 'none';
        const uploadSection = document.getElementById('uploadSection');
        if (uploadSection) uploadSection.style.display = 'none';
        // Patch: clear any history placeholder/empty state
        const historyContent = document.getElementById('historyContent');
        if (historyContent) historyContent.innerHTML = '';
        // Patch: always re-render chart and results table after loading from history
        if (typeof showAllCurves === 'function') showAllCurves('all');
        if (typeof populateResultsTable === 'function' && currentAnalysisResults && currentAnalysisResults.individual_results) {
            populateResultsTable(currentAnalysisResults.individual_results);
        }
        displayAnalysisResults(session.results);
        // Scroll to analysis section
        document.getElementById('analysisSection').scrollIntoView({ behavior: 'smooth' });
        // console.log('Loaded local session:', session.filename);
    } catch (error) {
        // console.error('Error loading local session details:', error);
        alert('Error loading analysis history: ' + error.message);
    }
}

async function deleteSession(sessionId, event) {
    if (!confirm('Are you sure you want to delete this analysis session?')) {
        return;
    }
    
    const deleteBtn = event.target;
    deleteBtn.disabled = true;
    
    try {
        const response = await fetch(`/sessions/${sessionId}`, { method: 'DELETE' });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete session');
        }
        
        // Reload history regardless of success/failure to refresh the list
        loadAnalysisHistory();
        
    } catch (error) {
        // console.error('Error deleting session:', error);
        alert('Error deleting session: ' + error.message);
    } finally {
        // Re-enable the button
        deleteBtn.disabled = false;
    }
}

function deleteLocalSession(index) {
    if (!confirm('Are you sure you want to delete this local analysis session?')) {
        return;
    }
    
    const history = getLocalAnalysisHistory();
    history.splice(index, 1);
    safeSetItem(localStorage, 'qpcr_analysis_history', JSON.stringify(history), {
        historyTrimFn: () => {
            // Remove oldest entry and try again
            history.shift();
        }
    });
    
    // Reload history to refresh the display
    loadAnalysisHistory();
}

function clearAllLocalData() {
    if (!confirm('Are you sure you want to clear all local analysis data? This will remove all locally stored sessions.')) {
        return;
    }
    
    localStorage.removeItem('qpcr_analysis_history');
    localStorage.removeItem('qpcr_current_analysis');
    
    // Reload history to refresh the display
    loadAnalysisHistory();
    
    alert('All local analysis data has been cleared.');
}



function addFluorophoreFilter(individualResults) {
    // Extract unique fluorophores from results
    const fluorophores = [...new Set(Object.values(individualResults).map(result => result.fluorophore).filter(Boolean))];
    
    // console.log('Fluorophores found in results:', fluorophores);
    // console.log('Number of fluorophores:', fluorophores.length);
    
    // Auto-select single channel if only one fluorophore
    let autoSelectedFluorophore = 'all';
    if (fluorophores.length === 1) {
        autoSelectedFluorophore = fluorophores[0];
        // console.log('🔍 SINGLE-CHANNEL - Auto-selecting:', autoSelectedFluorophore);
        
        // Update app state to reflect single channel selection
        if (window.appState) {
            window.appState.currentFluorophore = autoSelectedFluorophore;
        }
        window.currentFluorophore = autoSelectedFluorophore;
    }
    
    // Always show fluorophore filter for context, even with single fluorophore
    // Single fluorophore sessions benefit from showing pathogen target information
    
    // Check if filter already exists
    let filterRow = document.querySelector('#fluorophoreFilterRow');
    if (!filterRow) {
        // Create filter row above table headers
        const tableHeader = document.querySelector('#resultsTable thead tr');
        if (tableHeader) {
            filterRow = document.createElement('tr');
            filterRow.id = 'fluorophoreFilterRow';
            filterRow.innerHTML = `
                <td colspan="12" style="background: #f8f9fa; padding: 10px; border-bottom: 2px solid #dee2e6;">
                    <label for="fluorophoreFilter" style="margin-right: 10px; font-weight: bold;">Filter by Fluorophore:</label>
                    <select id="fluorophoreFilter" style="padding: 5px 10px; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="all">All Fluorophores</option>
                    </select>
                    <span id="filterStats" style="margin-left: 15px; color: #666;"></span>
                </td>
            `;
            tableHeader.parentNode.insertBefore(filterRow, tableHeader.nextSibling);
        }
    }
    
    const filterSelect = document.getElementById('fluorophoreFilter');
    if (filterSelect) {
        // Clear existing options except "All"
        filterSelect.innerHTML = '<option value="all">All Fluorophores</option>';
        
        // Add fluorophore options with pathogen targets
        const experimentPattern = getCurrentFullPattern();
        const testCode = extractTestCode(experimentPattern);
        
        fluorophores.forEach(fluorophore => {
            const option = document.createElement('option');
            option.value = fluorophore;
            let pathogenTarget = getPathogenTarget(testCode, fluorophore);
            // Handle both object and string style entries in PATHOGEN_LIBRARY
            if (pathogenTarget && typeof pathogenTarget === 'object' && pathogenTarget.target) {
                pathogenTarget = pathogenTarget.target;
            } else if (typeof pathogenTarget !== 'string') {
                pathogenTarget = 'Unknown';
            }
            option.textContent = pathogenTarget !== 'Unknown' ? `${fluorophore} (${pathogenTarget})` : fluorophore;
            filterSelect.appendChild(option);
        });
        
        // Add event listener using state management
        filterSelect.removeEventListener('change', filterTableByFluorophore);
        filterSelect.addEventListener('change', function() {
            const selectedFluorophore = this.value;
            // console.log('🔄 FLUOROPHORE-FILTER - Table fluorophore filter changed to:', selectedFluorophore);
            
            // Update app state - this will coordinate all UI elements
            updateAppState({
                currentFluorophore: selectedFluorophore
            });
            
            // Filter table with new state
            filterTable();
            
            // CRITICAL: Also update chart to show only selected fluorophore curves
            if (selectedFluorophore !== 'all') {
                // console.log(`🔍 MULTICHANNEL - Switching chart to show only ${selectedFluorophore} curves`);
                
                // Filter wells selector for the selected fluorophore
                if (typeof filterWellsByFluorophore === 'function') {
                    filterWellsByFluorophore(selectedFluorophore);
                }
                
                // Update chart based on current chart mode
                if (window.appState && window.appState.currentChartMode === 'good') {
                    if (typeof showGoodCurves === 'function') {
                        showGoodCurves(selectedFluorophore);
                    }
                } else {
                    if (typeof showAllCurves === 'function') {
                        showAllCurves(selectedFluorophore);
                    }
                }
            } else {
                // console.log('🔍 MULTICHANNEL - Switching chart to show all fluorophore curves');
                
                // Reset wells selector for all fluorophores
                if (typeof filterWellsByFluorophore === 'function') {
                    filterWellsByFluorophore('all');
                }
                
                // Update chart to show all curves
                if (window.appState && window.appState.currentChartMode === 'good') {
                    if (typeof showGoodCurves === 'function') {
                        showGoodCurves('all');
                    }
                } else {
                    if (typeof showAllCurves === 'function') {
                        showAllCurves('all');
                    }
                }
            }
        });
        
        // Set initial value for single channel or default to 'all'
        filterSelect.value = autoSelectedFluorophore;
        // console.log('🔍 FLUOROPHORE-FILTER - Set initial value to:', autoSelectedFluorophore);
    }
}

function filterTableByFluorophore() {
    // Instead of having separate filtering logic, just call the main filterTable function
    // which already handles both fluorophore and status filtering together
    filterTable();
}

// Export Results Function for Multi-Fluorophore Data
function exportResults() {
    // Check multiple sources for analysis results - more robust for loaded sessions
    const activeResults = analysisResults || currentAnalysisResults || window.currentAnalysisResults;
    if (!activeResults || !activeResults.individual_results) {
        // console.error('🔍 EXPORT-ERROR - No analysis results to export. Checked sources:', {
            // analysisResults: !!analysisResults,
            // currentAnalysisResults: !!currentAnalysisResults,
            // windowCurrentAnalysisResults: !!window.currentAnalysisResults
        // });
        alert('No analysis results to export');
        return;
    }
    
    // console.log('🔍 EXPORT-DEBUG - Exporting results from:', {
        // source: analysisResults ? 'analysisResults' : (currentAnalysisResults ? 'currentAnalysisResults' : 'window.currentAnalysisResults'),
        // wellCount: Object.keys(activeResults.individual_results).length
    // });
    
    const csvContent = generateResultsCSV();
    
    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qpcr_analysis_results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Generate CSV with Multi-Fluorophore Support
function generateResultsCSV() {
    const headers = [
        'Well', 'Sample_Name', 'Fluorophore', 'Results', 'Curve_Class', 'Status', 'R2', 'RMSE', 
        'Amp', 'Steep', 'Mid', 'Base', 'Cq', 'CQ-J', 'Calc-J', 'Anom'
    ];
    
    let csvContent = headers.join(',') + '\n';
    
    // Use the same data source logic as exportResults function - check multiple sources
    const activeResults = analysisResults || currentAnalysisResults || window.currentAnalysisResults;
    if (!activeResults || !activeResults.individual_results) {
        // console.error('🔍 EXPORT-ERROR - No analysis results available for export. Checked sources:', {
            // analysisResults: !!analysisResults,
            // currentAnalysisResults: !!currentAnalysisResults,
            // windowCurrentAnalysisResults: !!window.currentAnalysisResults
        // });
        return csvContent; // Return just headers if no data
    }
    
    // console.log('🔍 EXPORT-DEBUG - Using results from:', {
        // source: analysisResults ? 'analysisResults' : (currentAnalysisResults ? 'currentAnalysisResults' : 'window.currentAnalysisResults'),
        // wellCount: Object.keys(activeResults.individual_results).length,
        // hasData: !!activeResults.individual_results,
        // firstFewWells: Object.keys(activeResults.individual_results).slice(0, 3)
    // });
    
    // Sort wells to group by fluorophore priority, then by well number/letter
    const fluorophoreOrder = ['FAM', 'HEX', 'Texas Red', 'Cy5'];
    const sortedEntries = Object.entries(activeResults.individual_results).sort((a, b) => {
        const [wellKeyA, resultA] = a;
        const [wellKeyB, resultB] = b;
        
        // Sort by fluorophore priority first, then by well
        const fluorA = resultA.fluorophore || 'Unknown';
        const fluorB = resultB.fluorophore || 'Unknown';
        
        if (fluorA !== fluorB) {
            const aIndex = fluorophoreOrder.indexOf(fluorA);
            const bIndex = fluorophoreOrder.indexOf(fluorB);
            
            // Use priority order if both fluorophores are in the list
            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        }
        
        // Sort wells by column first, then row (e.g., A1, B1, C1, ... P1, A2, B2, C2, ... P2)
        const wellA = resultA.well_id || wellKeyA.split('_')[0];
        const wellB = resultB.well_id || wellKeyB.split('_')[0];
        
        // Extract letter and number parts (handle both A1 and A01 formats)
        const matchA = wellA.match(/^([A-Z]+)(\d+)$/);
        const matchB = wellB.match(/^([A-Z]+)(\d+)$/);
        
        if (matchA && matchB) {
            const [, letterA, numberA] = matchA;
            const [, letterB, numberB] = matchB;
            
            // Sort by column (number) first - convert to integer for proper numerical sorting
            const numA = parseInt(numberA, 10);
            const numB = parseInt(numberB, 10);
            const numCompare = numA - numB;
            if (numCompare !== 0) return numCompare;
            
            // If columns are equal, sort by row (letter)
            return letterA.localeCompare(letterB);
        }
        
        // Fallback: try to extract just numbers for comparison if regex fails
        const numOnlyA = wellA.match(/\d+/);
        const numOnlyB = wellB.match(/\d+/);
        if (numOnlyA && numOnlyB) {
            const numCompare = parseInt(numOnlyA[0], 10) - parseInt(numOnlyB[0], 10);
            if (numCompare !== 0) return numCompare;
        }
        
        // Final fallback to alphabetical if pattern doesn't match
        return wellA.localeCompare(wellB);
    });
    
    sortedEntries.forEach(([wellKey, result]) => {
        const wellId = result.well_id || wellKey.split('_')[0];
        const sampleName = result.sample || result.sample_name || 'N/A';
        const fluorophore = result.fluorophore || 'Unknown';
        const cqValue = result.cq_value !== null && result.cq_value !== undefined ? 
            result.cq_value.toFixed(2) : 'N/A';
        
        // Generate Results column (POS/NEG/REDO) - same logic as in table
        let resultsText = '';
        try {
            const r2Score = result.r2_score || 0;
            const steepness = result.steepness || 0;
            const amplitude = result.amplitude || 0;
            
            // Get anomalies data
            let hasAnomalies = false;
            if (result.anomalies) {
                try {
                    const anomalies = typeof result.anomalies === 'string' ? 
                        JSON.parse(result.anomalies) : result.anomalies;
                    hasAnomalies = Array.isArray(anomalies) && anomalies.length > 0 && 
                                  !(anomalies.length === 1 && anomalies[0] === 'None');
                } catch (e) {
                    hasAnomalies = true;
                }
            }
            
            // Apply enhanced criteria: POS requires good S-curve + amplitude > 500 + no anomalies
            const cqVal = result.cq_value;
            if (amplitude < 400 || !result.is_good_scurve || isNaN(Number(cqVal))) {
                resultsText = 'NEG';
            } else if (result.is_good_scurve && amplitude > 500 && !hasAnomalies) {
                resultsText = 'POS';
            } else {
                resultsText = 'REDO';
            }
        } catch (e) {
            resultsText = 'REDO';
        }
        
        // Generate Curve Class column
        let curveClassText = '';
        if (typeof result.curve_classification === 'object' && result.curve_classification.classification) {
            curveClassText = result.curve_classification.classification.replace('_', ' ');
        } else if (typeof result.curve_classification === 'string') {
            curveClassText = result.curve_classification;
        } else {
            curveClassText = '-';
        }
        
        // Generate CQ-J column
        let cqjText = 'N/A';
        if (result.cqj && typeof result.cqj === 'object' && result.fluorophore &&
            result.cqj[result.fluorophore] !== undefined && result.cqj[result.fluorophore] !== null &&
            !isNaN(result.cqj[result.fluorophore])) {
            cqjText = Number(result.cqj[result.fluorophore]).toFixed(2);
        }
        
        // Generate Calc-J column
        let calcjText = 'N/A';
        if (result.calcj && typeof result.calcj === 'object' && result.fluorophore &&
            result.calcj[result.fluorophore] !== undefined && result.calcj[result.fluorophore] !== null &&
            !isNaN(result.calcj[result.fluorophore])) {
            const calcjValue = Number(result.calcj[result.fluorophore]);
            if (calcjValue > 0) {
                // Convert 10^x to scientific notation (e.g., 10^4.25 = 1.78e+4)
                const scientificValue = Math.pow(10, calcjValue);
                calcjText = scientificValue.toExponential(2); // e.g., "1.78e+4"
            }
        }
        
        // Handle anomalies data
        let anomaliesText = 'None';
        if (result.anomalies) {
            try {
                const anomalies = typeof result.anomalies === 'string' ? 
                    JSON.parse(result.anomalies) : result.anomalies;
                anomaliesText = Array.isArray(anomalies) && anomalies.length > 0 ? 
                    anomalies.join(';') : 'None';
            } catch (e) {
                anomaliesText = 'Parse Error';
            }
        }
        
        const row = [
            wellId,
            `"${sampleName}"`, // Quote sample names to handle commas
            fluorophore,
            resultsText,
            `"${curveClassText}"`,
            result.is_good_scurve ? 'Good S-Curve' : 'Poor Fit',
            result.r2_score ? result.r2_score.toFixed(4) : 'N/A',
            result.rmse ? result.rmse.toFixed(2) : 'N/A',
            result.amplitude ? result.amplitude.toFixed(1) : 'N/A',
            result.steepness ? result.steepness.toFixed(3) : 'N/A',
            result.midpoint ? result.midpoint.toFixed(1) : 'N/A',
            result.baseline ? result.baseline.toFixed(1) : 'N/A',
            cqValue,
            cqjText,
            calcjText,
            `"${anomaliesText}"` // Quote anomalies to handle semicolons
        ];
        
        csvContent += row.join(',') + '\n';
    });
    
    return csvContent;
}

// Enhanced Filter Table Function
// Helper function to extract test pattern from current analysis
function getCurrentTestPattern() {
    // Try to get pattern from current amplification files
    if (amplificationFiles && Object.keys(amplificationFiles).length > 0) {
        const firstFile = Object.values(amplificationFiles)[0];
        if (firstFile && firstFile.fileName) {
            const basePattern = extractBasePattern(firstFile.fileName);
            // Extract test name (part before first underscore)
            return basePattern.split('_')[0];
        }
    }
    
    // Try to get pattern from samples data
    if (samplesData && samplesData.fileName) {
        const basePattern = extractBasePattern(samplesData.fileName);
        return basePattern.split('_')[0];
    }
    
    // Default fallback - look for any sample name starting with "Ac"
    return 'Ac';
}

function updateExperimentPatternWithPathogen(filename, fluorophore) {
    const experimentPatternElement = document.getElementById('experimentPattern');
    if (!experimentPatternElement) return;
    
    // Extract base pattern from filename
    const basePattern = extractBasePattern(filename);
    const testCode = extractTestCode(basePattern);
    
    // Get pathogen target for the fluorophore
    const pathogenTarget = getPathogenTarget ? getPathogenTarget(testCode, fluorophore) : fluorophore;
    
    // Display pattern with pathogen target
    if (pathogenTarget && pathogenTarget !== 'Unknown') {
        experimentPatternElement.textContent = `${basePattern} (${fluorophore} - ${pathogenTarget})`;
    } else {
        experimentPatternElement.textContent = `${basePattern} (${fluorophore})`;
    }
}

// Reset filter state to defaults
function resetFilterState() {
    // Reset filter dropdown to 'all'
    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus) {
        filterStatus.value = 'all';
    }
    
    // Reset fluorophore filter to 'all'
    const fluorophoreFilter = document.getElementById('fluorophoreFilter');
    if (fluorophoreFilter) {
        fluorophoreFilter.value = 'all';
    }
    
    // Reset search input
    const searchWells = document.getElementById('searchWells');
    if (searchWells) {
        searchWells.value = '';
    }
    
    // Reset chart mode buttons
    const buttons = document.querySelectorAll('.view-controls .control-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    const showAllBtn = document.getElementById('showAllBtn');
    if (showAllBtn) {
        showAllBtn.classList.add('active');
    }
    
    // Reset global filter states
    currentFilterMode = 'all';
    currentFluorophore = 'all';
    currentChartMode = 'all';
    
    // Apply the reset filters
    filterTable();
}

// Universal control grid function that works for any test type
function enhanceControlValidationWithPathogenInfo() {
    // Enhance existing Control Validation section with pathogen information
    // console.log('🔍 Enhancing Control Validation section with pathogen info');
    
    if (currentAnalysisResults && currentAnalysisResults.individual_results) {
        const testCode = extractTestCodeFromResults(currentAnalysisResults);
        if (testCode) {
            // console.log('🔍 Adding pathogen info to Control Validation for test:', testCode);
            addPathogenInfoToControlValidation(testCode, currentAnalysisResults.individual_results);
        }
    }
}

function addPathogenInfoToControlValidation(testCode, individualResults) {
    // Add pathogen information to the existing Control Validation section
    const controlValidationSection = document.querySelector('.control-validation-section');
    if (!controlValidationSection) {
        // console.log('🔍 Control Validation section not found');
        return;
    }
    
    // Get pathogen targets for this test
    const pathogenTargets = getPathogenTargets(testCode);
    if (!pathogenTargets || Object.keys(pathogenTargets).length === 0) {
        // console.log('🔍 No pathogen targets found for test:', testCode);
        return;
    }
    
    // Add pathogen information header
    let pathogenInfo = document.querySelector('.pathogen-info-header');
    if (!pathogenInfo) {
        pathogenInfo = document.createElement('div');
        pathogenInfo.className = 'pathogen-info-header';
        pathogenInfo.style.cssText = `
            font-size: 11px;
            color: #666;
            margin-bottom: 8px;
            padding: 4px 8px;
            background: #f8f9fa;
            border-radius: 3px;
            border-left: 3px solid #007bff;
        `;
        
        // Create pathogen mapping text
        const pathogenList = Object.entries(pathogenTargets)
            .map(([fluor, target]) => `${fluor}→${target}`)
            .join(', ');
        
        pathogenInfo.innerHTML = `<strong>${testCode}:</strong> ${pathogenList}`;
        
        // Insert after the Control Validation header
        const header = controlValidationSection.querySelector('h3');
        if (header && header.nextSibling) {
            controlValidationSection.insertBefore(pathogenInfo, header.nextSibling);
        } else if (header) {
            header.parentNode.insertBefore(pathogenInfo, header.nextSibling);
        }
    }
    
    // console.log('🔍 Added pathogen info to Control Validation section');
}

function triggerUniversalControlGridDisplay() {
    // Trigger real pathogen control grid display for loaded session
    // console.log('🔍 Triggering real pathogen control grid display for loaded session');
    
    if (currentAnalysisResults && currentAnalysisResults.individual_results) {
        // Extract test code from current results
        const testCode = extractTestCodeFromResults(currentAnalysisResults);
        if (testCode) {
            // console.log('🔍 Using real pathogen grid system for loaded session, test:', testCode);
            
            // Use the real control grid system (extractRealControlCoordinates)
            const wellsArray = Object.values(currentAnalysisResults.individual_results);
            const { controlsByType, controlsByChannel } = extractRealControlCoordinates(wellsArray, testCode);
            
            // Use the controlsByChannel structure for grid creation
            createPathogenControlGrids(controlsByChannel, testCode);
        } else {
            // console.log('🔍 Could not extract test code from results');
        }
    } else {
        // console.log('🔍 No analysis results available for control grid');
    }
}

function extractTestCodeFromResults(results) {
    // Try to extract test code from session filename or pattern
    if (window.currentSessionData && window.currentSessionData.session && window.currentSessionData.session.filename) {
        const filename = window.currentSessionData.session.filename;
        // console.log('🔍 Extracting test code from filename:', filename);
        
        // Extract test code from filename patterns
        if (filename.includes('BVAB')) return 'BVAB';
        if (filename.includes('BVPanelPCR3')) return 'BVPanelPCR3';
        if (filename.includes('Cglab')) return 'Cglab';
        if (filename.includes('Ngon')) return 'Ngon';
        if (filename.includes('Ctrach')) return 'Ctrach';
        if (filename.includes('Tvag')) return 'Tvag';
        if (filename.includes('Mgen')) return 'Mgen';
        if (filename.includes('Upar')) return 'Upar';
        if (filename.includes('Uure')) return 'Uure';
    }
    
    // Fallback: try to extract from experiment pattern
    if (window.currentExperimentPattern) {
        const pattern = window.currentExperimentPattern;
        // console.log('🔍 Extracting test code from pattern:', pattern);
        
        if (pattern.includes('BVAB')) return 'BVAB';
        if (pattern.includes('BVPanelPCR3')) return 'BVPanelPCR3';
        if (pattern.includes('Cglab')) return 'Cglab';
        if (pattern.includes('Ngon')) return 'Ngon';
        if (pattern.includes('Ctrach')) return 'Ctrach';
        if (pattern.includes('Tvag')) return 'Tvag';
        if (pattern.includes('Mgen')) return 'Mgen';
        if (pattern.includes('Upar')) return 'Upar';
        if (pattern.includes('Uure')) return 'Uure';
    }
    
    return null;
}

// Note: createUniversalControlGrid function removed - only use real pathogen_library.js grid system

// Note: showUniversalPathogenTab function removed - only use real pathogen_library.js grid system

// Helper function to get full experiment pattern
function getCurrentFullPattern() {
    // Try to get full pattern from current amplification files (fresh uploads)
    if (amplificationFiles && Object.keys(amplificationFiles).length > 0) {
        const firstFile = Object.values(amplificationFiles)[0];
        if (firstFile && firstFile.fileName) {
            return extractBasePattern(firstFile.fileName);
        }
    }
    
    // Try to get pattern from samples data
    if (samplesData && samplesData.fileName) {
        return extractBasePattern(samplesData.fileName);
    }
    
    // Try to get pattern from current analysis results (session loading)
    if (currentAnalysisResults && currentAnalysisResults.filename) {
        return extractBasePattern(currentAnalysisResults.filename);
    }
    
    // Try to get pattern from window analysis results (session loading)
    if (window.currentAnalysisResults && window.currentAnalysisResults.filename) {
        return extractBasePattern(window.currentAnalysisResults.filename);
    }
    
    // Try to get pattern from loaded session data
    if (window.currentSessionFilename) {
        return extractBasePattern(window.currentSessionFilename);
    }
    
    return 'Unknown Pattern';
}

// Save experiment statistics for trend analysis
async function saveExperimentStatistics(experimentPattern, allResults, fluorophores) {
    try {
        // console.log('Saving experiment statistics for:', experimentPattern, 'with fluorophores:', fluorophores);
        // console.log('Results structure:', allResults);
        
        // Extract test name from experiment pattern (e.g., AcBVAB_2578825_CFX367393 -> AcBVAB)
        const testName = experimentPattern.split('_')[0] || 'Unknown';
        
        // Calculate fluorophore breakdown
        const fluorophoreBreakdown = {};
        
        // Handle both new analysis results and loaded session results
        if (allResults.individual_results) {
            // This is a loaded session - process differently
            const fluorophoreGroups = {};
            
            Object.entries(allResults.individual_results).forEach(([wellKey, wellData]) => {
                const fluorophore = wellData.fluorophore || wellKey.split('_').pop() || 'Unknown';
                if (fluorophore === 'Unknown') return;
                
                const sampleName = wellData.sample_name || wellData.sample || '';
                
                // Skip control samples for trend analysis statistics
                if (isControlSample(sampleName, testName)) {
                    return;
                }
                
                if (!fluorophoreGroups[fluorophore]) {
                    fluorophoreGroups[fluorophore] = { positive: 0, negative: 0, redo: 0, total: 0 };
                }
                
                fluorophoreGroups[fluorophore].total++;
                
                const amplitude = wellData.amplitude || 0;
                
                // Check for anomalies
                let hasAnomalies = false;
                if (wellData.anomalies) {
                    try {
                        const anomalies = Array.isArray(wellData.anomalies) ? 
                            wellData.anomalies : JSON.parse(wellData.anomalies || '[]');
                        hasAnomalies = Array.isArray(anomalies) && anomalies.length > 0 && 
                                      !(anomalies.length === 1 && anomalies[0] === 'None');
                    } catch (e) {
                        hasAnomalies = true;
                    }
                }
                
                // Apply enhanced criteria
                if (amplitude > 500 && !hasAnomalies) {
                    fluorophoreGroups[fluorophore].positive++;
                } else if (amplitude < 400 || !well.is_good_scurve || isNaN(Number(well.cq_value))) {
                    fluorophoreGroups[fluorophore].negative++;
                } else {
                    fluorophoreGroups[fluorophore].redo++;
                }
            });
            
            // Convert to final format
            Object.entries(fluorophoreGroups).forEach(([fluorophore, stats]) => {
                const posPercentage = stats.total > 0 ? (stats.positive / stats.total * 100) : 0;
                fluorophoreBreakdown[fluorophore] = {
                    total: stats.total,
                    positive: stats.positive,
                    negative: stats.negative,
                    redo: stats.redo,
                    pos_percentage: parseFloat(posPercentage.toFixed(1))
                };
            });
        } else {
            // This is new analysis results - original logic
            fluorophores.forEach(fluorophore => {
                const results = allResults[fluorophore];
                if (!results || !results.individual_results) return;
                
                let positive = 0, negative = 0, redo = 0;
                const wellResults = Object.values(results.individual_results);
                
                wellResults.forEach(well => {
                    const amplitude = well.amplitude || 0;
                    const sampleName = well.sample_name || well.sample || '';
                    
                    // Skip control samples for trend analysis statistics
                    if (isControlSample(sampleName, testName)) {
                        return;
                    }
                    
                    // Check for anomalies
                    let hasAnomalies = false;
                    if (well.anomalies) {
                        try {
                            const anomalies = typeof well.anomalies === 'string' ? 
                                JSON.parse(well.anomalies) : well.anomalies;
                            hasAnomalies = Array.isArray(anomalies) && anomalies.length > 0 && 
                                          !(anomalies.length === 1 && anomalies[0] === 'None');
                        } catch (e) {
                            hasAnomalies = true;
                        }
                    }
                    
                    // Apply enhanced criteria: POS requires good S-curve + amplitude > 500 + no anomalies
                    const isGoodSCurve = well.is_good_scurve || false;
                    if (isGoodSCurve && amplitude > 500 && !hasAnomalies) {
                        positive++;
                    } else if (amplitude < 400) {
                        negative++;
                    } else {
                        redo++;
                    }
                });
                
                const total = wellResults.length;
                const posPercentage = total > 0 ? (positive / total * 100) : 0;
                
                fluorophoreBreakdown[fluorophore] = {
                    total: total,
                    positive: positive,
                    negative: negative,
                    redo: redo,
                    pos_percentage: parseFloat(posPercentage.toFixed(1))
                };
            });
        }
        
        const payload = {
            experiment_name: experimentPattern,
            test_name: testName,
            fluorophore_breakdown: fluorophoreBreakdown
        };
        
        // console.log('Statistics payload:', payload);
        
        const response = await fetch('/experiments/statistics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            const result = await response.json();
            // console.log('Experiment statistics saved successfully:', result.message);
        } else {
            // console.error('Failed to save experiment statistics:', response.statusText);
        }
        
    } catch (error) {
        // console.error('Error saving experiment statistics:', error);
    }
}

// View trend analysis data
let trendAnalysisVisible = false;
let trendAnalysisProcessing = false;

async function viewTrendAnalysis() {
    // Prevent multiple rapid clicks
    if (trendAnalysisProcessing) {
        // console.log('Trend analysis operation already in progress');
        return;
    }
    
    trendAnalysisProcessing = true;
    
    const historyContent = safeGetElement('historyContent', 'viewTrendAnalysis');
    if (!historyContent) {
        trendAnalysisProcessing = false;
        return;
    }
    
    // Toggle functionality
    if (trendAnalysisVisible) {
        // Close trend analysis and show history
        // console.log('Closing trend analysis, switching to history');
        trendAnalysisVisible = false;
        
        // Update main button text
        const mainTrendButton = document.getElementById('trendAnalysisBtn');
        if (mainTrendButton) {
            mainTrendButton.innerHTML = 'View Trends';
        }
        
        // Load history and exit
        await loadAnalysisHistory();
        trendAnalysisProcessing = false;
        return;
    }
    
    try {
        // console.log('Loading trend analysis data...');
        
        // Only ensure statistics for truly complete experiments
        await ensureAllExperimentStatistics();
        
        const response = await fetch('/experiments/statistics');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText || 'Server error'}`);
        }
        
        const data = await response.json();
        // console.log('Raw trend analysis data:', data);
        
        // Show all experiments with valid statistics (both single and multi-channel)
        let validExperiments = [];
        if (data && data.experiments) {
            validExperiments = data.experiments.filter(exp => {
                const breakdown = exp.fluorophore_stats;
                return breakdown && Object.keys(breakdown).length > 0;
            });
        }
        
        // console.log(`Filtered to ${validExperiments.length} valid complete experiments`);
        
        if (validExperiments.length === 0) {
            // console.warn('No experiments available for trend analysis');
            historyContent.innerHTML = `
                <div class="trend-analysis-section">
                    <h3>Test Trend Analysis</h3>
                    <p>No experiment data available for trend analysis. Complete some analyses first to build trend history.</p>
                </div>
            `;
            // Update main button text
            const mainTrendButton = document.getElementById('trendAnalysisBtn');
            if (mainTrendButton) {
                mainTrendButton.innerHTML = 'Close Trends';
            }
            trendAnalysisVisible = true;
            trendAnalysisProcessing = false;
            return;
        }
        
        // Update main button text
        const mainTrendButton = document.getElementById('trendAnalysisBtn');
        if (mainTrendButton) {
            mainTrendButton.innerHTML = 'Close Trends';
        }
        trendAnalysisVisible = true;
        
        displayTrendAnalysis(validExperiments);
        
    } catch (error) {
        // console.error('Error loading trend analysis:', error);
        const errorMessage = error.message || 'Unknown error occurred';
        alert('Error loading trend analysis: ' + errorMessage);
        
        // Reset state on error
        trendAnalysisVisible = false;
        const mainTrendButton = document.getElementById('trendAnalysisBtn');
        if (mainTrendButton) {
            mainTrendButton.innerHTML = 'View Trends';
        }
    } finally {
        trendAnalysisProcessing = false;
    }
}

// Ensure all complete experiments have statistics saved
async function ensureAllExperimentStatistics() {
    try {
        // console.log('Checking for missing experiment statistics...');
        
        // Get all sessions to identify complete experiments
        const sessionsResponse = await fetch('/sessions');
        if (!sessionsResponse.ok) return;
        
        const sessionsData = await sessionsResponse.json();
        const sessions = sessionsData.sessions || [];
        
        // Group sessions by experiment pattern to find complete experiments
        const experimentGroups = {};
        sessions.forEach(session => {
            const pattern = extractBasePattern(session.filename);
            if (!experimentGroups[pattern]) {
                experimentGroups[pattern] = [];
            }
            experimentGroups[pattern].push(session);
        });
        
        // Check each experiment group for completeness based on pathogen library requirements
        const completeExperiments = [];
        Object.entries(experimentGroups).forEach(([pattern, groupSessions]) => {
            const fluorophores = new Set();
            let hasValidData = true;
            
            groupSessions.forEach(session => {
                const fluorophore = detectFluorophoreFromFilename(session.filename);
                if (fluorophore && fluorophore !== 'Unknown') {
                    fluorophores.add(fluorophore);
                }
                
                // Ensure session has meaningful data (good curves > 0)
                if (session.good_curves === 0 || session.total_wells === 0) {
                    hasValidData = false;
                }
            });
            
            // Check if experiment meets pathogen library requirements
            const testCode = extractTestCode(pattern);
            if (testCode && getRequiredChannels && hasValidData) {
                const requiredChannels = getRequiredChannels(testCode);
                const hasAllRequiredChannels = requiredChannels.every(channel => fluorophores.has(channel));
                
                if (hasAllRequiredChannels) {
                    completeExperiments.push({
                        pattern,
                        testCode,
                        sessions: groupSessions,
                        fluorophores: Array.from(fluorophores),
                        requiredChannels
                    });
                }
            }
        });
        
        // console.log(`Found ${completeExperiments.length} valid complete experiments for trend analysis`);
        
        // Get existing experiment statistics
        const statsResponse = await fetch('/experiments/statistics');
        const existingStats = statsResponse.ok ? (await statsResponse.json()).experiments || [] : [];
        const existingPatterns = existingStats.map(stat => stat.experiment_name);
        
        // Only save statistics for missing VALID complete experiments
        for (const experiment of completeExperiments) {
            if (!existingPatterns.includes(experiment.pattern)) {
                // console.log(`Saving statistics for valid complete experiment: ${experiment.pattern}`);
                
                // Create combined session data from individual sessions
                const combinedResults = await createCombinedResultsFromSessions(experiment.sessions);
                if (combinedResults && Object.keys(combinedResults.individual_results || {}).length > 0) {
                    await saveExperimentStatisticsFromCombined(experiment.pattern, combinedResults, experiment.fluorophores);
                }
            }
        }
        
    } catch (error) {
        // console.warn('Error ensuring experiment statistics:', error);
    }
}

// Create combined results from individual sessions for statistics
async function createCombinedResultsFromSessions(sessions) {
    try {
        const allWellResults = {};
        
        for (const session of sessions) {
            // Get detailed session data
            const sessionResponse = await fetch(`/sessions/${session.id}`);
            if (!sessionResponse.ok) continue;
            
            const sessionData = await sessionResponse.json();
            if (sessionData.well_results) {
                sessionData.well_results.forEach(well => {
                    const wellKey = well.well_id ? 
                        (well.well_id.includes('_') ? well.well_id : `${well.well_id}_${well.fluorophore}`) :
                        `${well.coordinate || 'unknown'}_${well.fluorophore}`;
                    allWellResults[wellKey] = {
                        amplitude: well.amplitude || 0,
                        anomalies: well.anomalies,
                        fluorophore: well.fluorophore || detectFluorophoreFromFilename(session.filename)
                    };
                });
            }
        }
        
        return { individual_results: allWellResults };
        
    } catch (error) {
        // console.warn('Error creating combined results:', error);
        return null;
    }
}

// Save experiment statistics from combined results
async function saveExperimentStatisticsFromCombined(experimentPattern, combinedResults, fluorophores) {
    try {
        const testName = experimentPattern.split('_')[0] || 'Unknown';
        const fluorophoreBreakdown = {};
        
        fluorophores.forEach(fluorophore => {
            const wells = Object.values(combinedResults.individual_results).filter(well => 
                well.fluorophore === fluorophore
            );
            
            let positive = 0, negative = 0, redo = 0;
            
            let total = 0;
            
            wells.forEach(well => {
                const amplitude = well.amplitude || 0;
                const sampleName = well.sample_name || well.sample || '';
                
                // Skip control samples for trend analysis statistics
                if (isControlSample(sampleName, testName)) {
                    return;
                }
                
                // Count patient samples
                total++;
                
                // Check for anomalies
                let hasAnomalies = false;
                if (well.anomalies) {
                    try {
                        const anomalies = typeof well.anomalies === 'string' ? 
                            JSON.parse(well.anomalies) : well.anomalies;
                        hasAnomalies = Array.isArray(anomalies) && anomalies.length > 0 && 
                                      !(anomalies.length === 1 && anomalies[0] === 'None');
                    } catch (e) {
                        hasAnomalies = true;
                    }
                }
                
                // Apply enhanced criteria: POS requires good S-curve + amplitude > 500 + no anomalies
                if (well.is_good_scurve && amplitude > 500 && !hasAnomalies) {
                    positive++;
                } else if (amplitude < 400 || !well.is_good_scurve || isNaN(Number(well.cq_value))) {
                    negative++;
                } else {
                    redo++;
                }
            });
            const posPercentage = total > 0 ? (positive / total * 100) : 0;
            
            fluorophoreBreakdown[fluorophore] = {
                subtest: fluorophore,
                total_wells: total,
                positive: positive,
                negative: negative,
                redo: redo,
                pos_percentage: parseFloat(posPercentage.toFixed(1))
            };
        });
        
        const payload = {
            experiment_name: experimentPattern,
            test_name: testName,
            fluorophore_breakdown: fluorophoreBreakdown
        };
        
        const response = await fetch('/experiments/statistics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            // console.log(`Statistics saved for ${experimentPattern}`);
        }
        
    } catch (error) {
        // console.warn('Error saving statistics from combined results:', error);
    }
}

// Control validation functions
function identifyControlType(sampleName) {
    if (!sampleName) return null;
    
    // Check for NTC controls
    if (sampleName.includes('NTC')) {
        return 'NTC';
    }
    
    // Check for positive controls (H, M, L) - multiple formats
    // Format 1: H-1, M-2, L-3
    if (sampleName.match(/[HML]-\d+$/)) {
        return 'POSITIVE';
    }
    
    // Format 2: H1, M2, L3
    if (sampleName.match(/[HML]\d+$/)) {
        return 'POSITIVE';
    }
    
    // Format 3: M02H, L01H, H03L (number + letter suffix)
    if (sampleName.match(/[HML]\d+[A-Z]/) || sampleName.includes('M02H') || sampleName.includes('L01') || sampleName.includes('H03')) {
        return 'POSITIVE';
    }
    
    return null;
}

function getResultClassification(wellData) {
    const amplitude = wellData.amplitude || 0;
    
    // Check for anomalies using the same logic as main analysis
    let hasAnomalies = false;
    if (wellData.anomalies) {
        try {
            const anomalies = typeof wellData.anomalies === 'string' ? 
                JSON.parse(wellData.anomalies) : wellData.anomalies;
            hasAnomalies = Array.isArray(anomalies) && anomalies.length > 0 && 
                          !(anomalies.length === 1 && anomalies[0] === 'None');
        } catch (e) {
            hasAnomalies = true;
        }
    }
    
    // Apply same criteria as main analysis: POS requires good S-curve + amplitude > 500 + no anomalies
    if (wellData.is_good_scurve && amplitude > 500 && !hasAnomalies) {
        return 'POS';
    } else if (amplitude < 400 || !wellData.is_good_scurve || isNaN(Number(wellData.cq_value))) {
        return 'NEG';
    } else {
        return 'REDO';
    }
}

function validateControls(individualResults) {
    // console.log('🔍 VALIDATE CONTROLS - Starting validation with', Object.keys(individualResults).length, 'results');
    const controlIssues = [];
    
    Object.entries(individualResults).forEach(([wellKey, result]) => {
        const sampleName = result.sample_name || result.sample || '';
        const amplitude = result.amplitude || 0;
        const controlType = identifyControlType(sampleName);
        
        // Debug control detection
        if (controlType) {
            // console.log(`🔍 VALIDATE CONTROLS - Found ${controlType} control: ${sampleName} (${wellKey}) amplitude: ${amplitude}`);
        }
        

        
        const anomalies = result.anomalies || 'None';
        const r2Score = result.r2_score || 0;
        const isGoodCurve = result.is_good_scurve || false;
        
        // Enhanced fluorophore detection for control validation
        let fluorophore = result.fluorophore;
        if (!fluorophore || fluorophore === 'Unknown') {
            // Extract from well key (A1_HEX -> HEX)
            const parts = wellKey.split('_');
            if (parts.length > 1) {
                const possibleFluorophore = parts[parts.length - 1];
                if (['Cy5', 'FAM', 'HEX', 'Texas Red'].includes(possibleFluorophore)) {
                    fluorophore = possibleFluorophore;
                }
            }
            
            // Fallback: detect from current pattern
            if (!fluorophore || fluorophore === 'Unknown') {
                const currentPattern = getCurrentFullPattern();
                if (currentPattern) {
                    const testCode = extractTestCode(currentPattern);
                    if (testCode && getRequiredChannels) {
                        const requiredChannels = getRequiredChannels(testCode);
                        if (requiredChannels.length === 1) {
                            fluorophore = requiredChannels[0];
                        }
                    }
                }
            }
        }
        
        // Use the same comprehensive classification as the control grid
        const actualResult = getResultClassification(result);
        
        if (controlType === 'NTC') {
            // NTC controls should be NEG
            if (actualResult !== 'NEG') {
                let issueReason = '';
                if (actualResult === 'POS') {
                    issueReason = `Contamination detected - POS result (amplitude: ${amplitude.toFixed(1)}, good curve: ${isGoodCurve})`;
                } else if (actualResult === 'REDO') {
                    if (amplitude >= 400) {
                        issueReason = `Possible contamination - REDO result (amplitude: ${amplitude.toFixed(1)})`;
                    } else {
                        issueReason = `REDO result - poor curve quality or anomalies detected`;
                    }
                }
                
                controlIssues.push({
                    wellKey,
                    sampleName,
                    type: 'NTC',
                    expected: 'NEG',
                    actual: actualResult,
                    amplitude,
                    fluorophore: fluorophore || 'Unknown',
                    reason: issueReason,
                    anomalies,
                    r2Score,
                    isGoodCurve
                });
            }
        } else if (controlType === 'POSITIVE') {
            // Positive controls (H/M/L) should be POS (simplified check)
            if (actualResult !== 'POS') {
                // console.log(`🔍 CONTROL ISSUE DETECTED - ${sampleName} (${wellKey}): Expected POS but got ${actualResult}, amplitude: ${amplitude}`);
                controlIssues.push({
                    wellKey,
                    sampleName,
                    type: 'POSITIVE',
                    expected: 'POS',
                    actual: actualResult,
                    amplitude,
                    fluorophore: fluorophore || 'Unknown',
                    reason: `Expected POS but got ${actualResult} (amplitude: ${amplitude.toFixed(1)})`
                });
            }
        }
    });
    
    return controlIssues;
}

function displayControlValidationAlerts(controlIssues) {
    // console.log('🔍 CONTAMINATION-DEBUG - displayControlValidationAlerts called with:', {
        // issueCount: controlIssues.length,
        // issues: controlIssues.slice(0, 3), // First 3 issues
        // callStack: new Error().stack.split('\n').slice(1, 4) // Show where this was called from
    // });
    
    const alertContainer = document.getElementById('controlValidationAlerts');
    if (!alertContainer) {
        // Create alert container if it doesn't exist
        const analysisSection = document.getElementById('analysisSection');
        if (analysisSection) {
            const alertDiv = document.createElement('div');
            alertDiv.id = 'controlValidationAlerts';
            alertDiv.className = 'control-validation-alerts';
            analysisSection.insertBefore(alertDiv, analysisSection.firstChild);
        }
    }
    
    const container = document.getElementById('controlValidationAlerts');
    if (!container) return;
    
    if (controlIssues.length === 0) {
        // console.log('🔍 CONTAMINATION-DEBUG - No control issues, hiding container');
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }
    
    // console.log('🔍 CONTAMINATION-DEBUG - Displaying', controlIssues.length, 'control issues');
    container.style.display = 'block';
    container.innerHTML = `
        <div class="control-alerts-header">
            <h4>⚠️ Control Validation Issues (${controlIssues.length})</h4>
        </div>
        <div class="control-issues-list">
            ${controlIssues.map(issue => `
                <div class="control-issue-item ${issue.type.toLowerCase()}">
                    <div class="issue-details">
                        <strong>${issue.sampleName}</strong> (${issue.wellKey}, ${(() => {
                            const currentPattern = getCurrentFullPattern();
                            const testCode = currentPattern ? extractTestCode(currentPattern) : null;
                            
                            // Skip pathogen target mapping if no valid test code
                            if (!testCode || testCode === 'Unknown') {
                                // console.log(`🚨 Control validation - Cannot determine test code for pattern: ${currentPattern}`);
                                return issue.fluorophore || 'Unknown';
                            }
                            
                            // Enhanced fluorophore detection for control validation display
                            let fluorophore = issue.fluorophore;
                            if (!fluorophore || fluorophore === 'Unknown') {
                                // Extract from well key (A1_HEX -> HEX)
                                const parts = issue.wellKey.split('_');
                                if (parts.length > 1) {
                                    const possibleFluorophore = parts[parts.length - 1];
                                    if (['Cy5', 'FAM', 'HEX', 'Texas Red'].includes(possibleFluorophore)) {
                                        fluorophore = possibleFluorophore;
                                    }
                                }
                                
                                // Fallback: detect from current pattern
                                if (!fluorophore || fluorophore === 'Unknown') {
                                    if (testCode && getRequiredChannels) {
                                        const requiredChannels = getRequiredChannels(testCode);
                                        if (requiredChannels.length === 1) {
                                            fluorophore = requiredChannels[0];
                                        }
                                    }
                                }
                                
                                // Final fallback for single-channel tests based on filename
                                if (!fluorophore || fluorophore === 'Unknown') {
                                    if (currentPattern && currentPattern.includes('AcNgon')) fluorophore = 'HEX';
                                    else if (currentPattern && currentPattern.includes('AcCtrach')) fluorophore = 'FAM';
                                    else if (currentPattern && currentPattern.includes('AcTvag')) fluorophore = 'FAM';
                                    else if (currentPattern && currentPattern.includes('AcCalb')) fluorophore = 'HEX';
                                    else if (currentPattern && currentPattern.includes('AcMgen')) fluorophore = 'FAM';
                                    else if (currentPattern && currentPattern.includes('AcUpar')) fluorophore = 'FAM';
                                    else if (currentPattern && currentPattern.includes('AcUure')) fluorophore = 'FAM';
                                }
                            }
                            
                            return getPathogenTarget(testCode, fluorophore) || fluorophore;
                        })()})
                        <span class="issue-type">${issue.type} Control</span>
                    </div>
                    <div class="issue-problem">
                        Expected: <span class="expected">${issue.expected}</span> | 
                        Actual: <span class="actual ${issue.actual.toLowerCase()}">${issue.actual}</span> |
                        Amplitude: ${issue.amplitude.toFixed(1)}
                        ${issue.reason ? `<br><span class="issue-reason">Issue: ${issue.reason}</span>` : ''}
                        ${issue.r2Score !== undefined ? `<br><span class="issue-quality">R² Score: ${issue.r2Score.toFixed(3)}</span>` : ''}
                        ${issue.isGoodCurve !== undefined ? `<br><span class="curve-quality">S-Curve Quality: ${issue.isGoodCurve ? 'Good' : 'Poor'}</span>` : ''}
                        ${issue.anomalies && issue.anomalies !== 'None' && issue.anomalies !== '' ? `<br><span class="issue-anomalies">Curve Anomalies: ${issue.anomalies}</span>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Display trend analysis data
function displayTrendAnalysis(experiments) {
    return safeExecute(() => {
        const historyContent = safeGetElement('historyContent', 'displayTrendAnalysis');
        if (!historyContent) {
            // Production-friendly error handling - no alerts, just console logging
            // console.warn('History container not found for trend analysis');
            return;
        }
    
    let html = '<div class="trend-analysis-section">';
    html += '<h3>Test Trend Analysis</h3>';
    
    // Group experiments by test name and aggregate statistics correctly
    const testSummary = {};
    experiments.forEach(exp => {
        const testName = exp.test_name || 'Unknown';
        if (!testSummary[testName]) {
            testSummary[testName] = {
                experimentCount: 0,
                fluorophores: {},
                latestTimestamp: null,
                experimentNames: []
            };
        }
        
        testSummary[testName].experimentCount++;
        testSummary[testName].experimentNames.push(exp.experiment_name);
        
        // Track latest timestamp
        const expTimestamp = new Date(exp.analysis_timestamp);
        if (!testSummary[testName].latestTimestamp || expTimestamp > testSummary[testName].latestTimestamp) {
            testSummary[testName].latestTimestamp = expTimestamp;
        }
        
        // Aggregate fluorophore statistics across all experiments for this test
        const stats = safeExecute(() => {
            return typeof exp.fluorophore_stats === 'string' ? 
                JSON.parse(exp.fluorophore_stats) : (exp.fluorophore_stats || {});
        }, 'parsing fluorophore_stats', {});
        
        safeExecute(() => {
            Object.entries(stats).forEach(([fluorophore, fluorStats]) => {
                if (!testSummary[testName].fluorophores[fluorophore]) {
                    testSummary[testName].fluorophores[fluorophore] = {
                        total_wells: 0,
                        positive: 0,
                        negative: 0,
                        redo: 0,
                        experiments: 0
                    };
                }
                
                const fluor = testSummary[testName].fluorophores[fluorophore];
                
                // Debug logging for Cglab
                if (testName === 'AcCglab' && fluorophore === 'FAM') {
                    // console.log(`🔍 TREND DEBUG - ${testName} ${fluorophore}:`, {
                        // beforeAddition: { positive: fluor.positive, total_wells: fluor.total_wells },
                        // adding: { positive: fluorStats.positive, total_wells: fluorStats.total_wells },
                        // experiment: exp.experiment_name
                    // });
                }
                
                fluor.total_wells += fluorStats.total_wells || 0;
                fluor.positive += fluorStats.positive || 0;
                fluor.negative += fluorStats.negative || 0;
                fluor.redo += fluorStats.redo || 0;
                fluor.experiments++;
                
                // Debug logging after addition
                if (testName === 'AcCglab' && fluorophore === 'FAM') {
                    // console.log(`🔍 TREND DEBUG - ${testName} ${fluorophore} AFTER:`, {
                        // afterAddition: { positive: fluor.positive, total_wells: fluor.total_wells }
                    // });
                }
            });
        }, `processing fluorophore stats for ${testName}`);
    });
    
    // Display aggregated test results with correct experiment counting
    Object.entries(testSummary).forEach(([testName, summary]) => {
        html += `<div class="test-group">`;
        const experimentText = summary.experimentCount === 1 ? 'experiment' : 'experiments';
        html += `<h4>${testName} Test Results (${summary.experimentCount} ${experimentText})</h4>`;
        html += `<div class="test-summary-card">`;
        
        html += `<div class="fluorophore-trend-stats">`;
        Object.entries(summary.fluorophores).forEach(([fluorophore, fluorStats]) => {
            const posPercent = fluorStats.total_wells > 0 ? 
                ((fluorStats.positive / fluorStats.total_wells) * 100) : 0;
            const barWidth = Math.min(posPercent, 100);
            
            // Debug logging for Cglab display
            if (testName === 'AcCglab' && fluorophore === 'FAM') {
                // console.log(`🔍 DISPLAY DEBUG - ${testName} ${fluorophore}:`, {
                    // fluorStats: fluorStats,
                    // positive: fluorStats.positive,
                    // total_wells: fluorStats.total_wells,
                    // posPercent: posPercent,
                    // displayString: `${fluorStats.positive}/${fluorStats.total_wells} (${posPercent.toFixed(1)}%)`
                // });
            }
            
            html += `<div class="fluorophore-trend-row">`;
            // Extract test code from test name (AcBVAB -> BVAB)
            const testCode = testName.startsWith('Ac') ? testName.substring(2) : testName;
            let pathogenTarget = 'Unknown';
            let fluorophoreColor = '#666';
            
            pathogenTarget = safeExecute(() => {
                return typeof getPathogenTarget === 'function' ? 
                    getPathogenTarget(testCode, fluorophore) : 'Unknown';
            }, 'getPathogenTarget', 'Unknown');
            
            fluorophoreColor = safeExecute(() => {
                return typeof getFluorophoreColor === 'function' ? 
                    getFluorophoreColor(fluorophore) : '#666';
            }, 'getFluorophoreColor', '#666');
            
            const displayTarget = pathogenTarget !== 'Unknown' ? ` - ${pathogenTarget}` : '';
            html += `<div class="fluorophore-trend-label">${fluorophore}${displayTarget}:</div>`;
            html += `<div class="fluorophore-trend-bar">`;
            html += `<div class="trend-bar-fill" style="width: ${barWidth}%; background: ${fluorophoreColor}"></div>`;
            html += `</div>`;
            html += `<div class="fluorophore-trend-values">`;
            html += `${fluorStats.positive}/${fluorStats.total_wells} (${posPercent.toFixed(1)}%)`;
            html += `</div>`;
            html += `</div>`;
        });
        html += `</div>`;
        html += `</div>`;
        html += `</div>`;
    });
    
        html += '</div>';
        
        // No additional buttons needed - close button is in header
        
        historyContent.innerHTML = html;
    }, 'displayTrendAnalysis complete function');
}

// Calculate fluorophore-specific statistics separated by patient samples and controls
function calculateFluorophoreStats(individualResults) {
    const stats = {
        totalPositive: 0,
        patientSamples: {
            total: 0,
            positive: 0,
            byFluorophore: {}
        },
        controls: {
            total: 0,
            positive: 0,
            byFluorophore: {}
        },
        byFluorophore: {} // Legacy support for existing code
    };
    
    // Debug logging for Cglab sessions
    const currentPattern = getCurrentFullPattern();
    if (currentPattern && currentPattern.includes('Cglab')) {
        // console.log('🔍 ANALYSIS SUMMARY DEBUG - calculateFluorophoreStats called for Cglab');
        // console.log('🔍 ANALYSIS SUMMARY DEBUG - individualResults keys:', Object.keys(individualResults));
    }
    
    // Get current test pattern for control identification
    const testPattern = getCurrentTestPattern();
    
    Object.entries(individualResults).forEach(([wellKey, result]) => {
        // Enhanced fluorophore extraction
        let fluorophore = result.fluorophore || 'Unknown';
        
        // Try to extract from fit_parameters if not directly available
        if (fluorophore === 'Unknown' && result.fit_parameters) {
            try {
                const fitParams = typeof result.fit_parameters === 'string' ? 
                    JSON.parse(result.fit_parameters) : result.fit_parameters;
                if (fitParams.fluorophore && fitParams.fluorophore !== 'Unknown') {
                    fluorophore = fitParams.fluorophore;
                }
            } catch (e) {
                // Continue with fallback methods
            }
        }
        
        // Try to extract from well key if still unknown (A1_Cy5 -> Cy5)
        if (fluorophore === 'Unknown' && wellKey.includes('_')) {
            const parts = wellKey.split('_');
            if (parts.length > 1) {
                const possibleFluorophore = parts[parts.length - 1];
                if (['Cy5', 'FAM', 'HEX', 'Texas Red'].includes(possibleFluorophore)) {
                    fluorophore = possibleFluorophore;
                }
            }
        }
        
        const amplitude = result.amplitude || 0;
        const sampleName = result.sample_name || result.sample || '';
        
        // Determine if this is a control sample
        const isControl = isControlSample(sampleName, testPattern);
        const sampleType = isControl ? 'controls' : 'patientSamples';
        
        // Initialize fluorophore stats if not exists for both categories
        ['patientSamples', 'controls', 'byFluorophore'].forEach(category => {
            if (!stats[category][fluorophore]) {
                stats[category][fluorophore] = {
                    total: 0,
                    positive: 0,
                    negative: 0,
                    redo: 0
                };
            }
        });
        
        // Update counts
        stats[sampleType].total++;
        stats[sampleType][fluorophore].total++;
        stats.byFluorophore[fluorophore].total++; // Legacy support
        
        // Check for anomalies
        let hasAnomalies = false;
        if (result.anomalies) {
            try {
                const anomalies = typeof result.anomalies === 'string' ? 
                    JSON.parse(result.anomalies) : result.anomalies;
                hasAnomalies = Array.isArray(anomalies) && anomalies.length > 0 && 
                              !(anomalies.length === 1 && anomalies[0] === 'None');
            } catch (e) {
                hasAnomalies = true; // If can't parse, assume there are anomalies
            }
        }
        
        // Apply enhanced criteria and update appropriate counters
        if (amplitude > 500 && !hasAnomalies) {
            stats[sampleType].positive++;
            stats[sampleType][fluorophore].positive++;
            stats.byFluorophore[fluorophore].positive++; // Legacy support
            if (sampleType === 'patientSamples') {
                stats.totalPositive++; // Only count patient samples in main total
            }
            
            // Debug logging for Cglab positive samples
            if (currentPattern && currentPattern.includes('Cglab') && fluorophore === 'FAM') {
                // console.log('🔍 ANALYSIS SUMMARY POSITIVE DEBUG:', {
                    // wellKey: wellKey,
                    // sampleName: sampleName,
                    // sampleType: sampleType,
                    // amplitude: amplitude,
                    // hasAnomalies: hasAnomalies,
                    // isControl: isControl,
                    // patientSamplePositiveCount: stats.patientSamples.positive,
                    // totalPositiveCount: stats.totalPositive
                // });
            }
        } else if (amplitude < 400) {
            stats[sampleType][fluorophore].negative++;
            stats.byFluorophore[fluorophore].negative++; // Legacy support
        } else {
            // REDO: amplitude 400-500 OR amplitude > 500 with anomalies
            stats[sampleType][fluorophore].redo++;
            stats.byFluorophore[fluorophore].redo++; // Legacy support
        }
    });
    
    return stats;
}

// Helper function to identify control samples (same logic as Controls filter)
function isControlSample(sampleName, testPattern) {
    if (!sampleName) {
        // console.log('🔍 CONTROL DETECTION - No sample name provided');
        return false;
    }
    
    // console.log('🔍 CONTROL DETECTION - Checking sample:', sampleName, 'with pattern:', testPattern);
    
    // Check for common control patterns
    if (sampleName.includes('NTC')) {
        // console.log('🔍 CONTROL DETECTION - Found NTC control');
        return true;
    }
    
    if (sampleName.match(/[HML]-\d+$/)) {
        // console.log('🔍 CONTROL DETECTION - Found H/M/L control with dash-number pattern');
        return true;
    }
    
    if (sampleName.toLowerCase().includes('control')) {
        // console.log('🔍 CONTROL DETECTION - Found control in name');
        return true;
    }
    
    if (sampleName.toLowerCase().includes('blank')) {
        // console.log('🔍 CONTROL DETECTION - Found blank control');
        return true;
    }
    
    if (testPattern && sampleName.startsWith(testPattern)) {
        // console.log('🔍 CONTROL DETECTION - Found test pattern control');
        return true;
    }
    
    // console.log('🔍 CONTROL DETECTION - No control pattern found');
    return false;
}

// Enhanced function to extract control type from sample name
function extractControlTypeFromSample(sampleName) {
    if (!sampleName) return null;
    
    // console.log('🔍 CONTROL TYPE - Extracting from sample:', sampleName);
    
    // Check for NTC first
    if (sampleName.includes('NTC')) {
        // console.log('🔍 CONTROL TYPE - Found NTC');
        return 'NTC';
    }
    
    // Look for H, M, L patterns in sample name like AcBVAB362273J02H-2578825
    const controlMatch = sampleName.match(/([HML])-?\d*$/);
    if (controlMatch) {
        const controlType = controlMatch[1];
        // console.log('🔍 CONTROL TYPE - Found control type:', controlType);
        return controlType;
    }
    
    // Alternative pattern: look for H, M, L anywhere in the sample name
    if (sampleName.includes('H-') || sampleName.endsWith('H')) return 'H';
    if (sampleName.includes('M-') || sampleName.endsWith('M')) return 'M';
    if (sampleName.includes('L-') || sampleName.endsWith('L')) return 'L';
    
    // console.log('🔍 CONTROL TYPE - No control type found');
    return null;
}

// Function to extract real control coordinates using same logic as Controls filter
function extractRealControlCoordinates(wellResults, testPattern) {
    // console.log('🔍 REAL CONTROLS - Starting extraction with', wellResults.length, 'wells for test:', testPattern);
    // console.log('🔍 REAL CONTROLS - Using same filter logic as dropdown Controls filter');
    
    // Log first few sample names to see the data format
    if (wellResults.length > 0) {
        // console.log('🔍 REAL CONTROLS - Sample data format check:');
        wellResults.slice(0, 5).forEach((well, index) => {
            // console.log(`  Well ${index}:`, {
                // sample_name: well.sample_name,
                // sample: well.sample,
                // well_id: well.well_id,
                // fluorophore: well.fluorophore
            // });
        });
    }
    
    const controlsByType = { H: [], M: [], L: [], NTC: [] };
    const controlsByChannel = {};
    
    wellResults.forEach((well, index) => {
        // Debug the first few wells to see their structure
        if (index < 3) {
            // console.log(`🔍 REAL CONTROLS - Well ${index} structure:`, {
                // keys: Object.keys(well),
                // sample_name: well.sample_name,
                // well_id: well.well_id,
                // fluorophore: well.fluorophore,
                // coordinate: well.coordinate,
                // well_position: well.well_position,
                // wellType: typeof well,
                // wellIdType: typeof well.well_id
            // });
        }
        
        // Handle potential JSON string data
        let wellData = well;
        if (typeof well === 'string') {
            try {
                wellData = JSON.parse(well);
                // console.log('🔍 REAL CONTROLS - Parsed well data from JSON string');
            } catch (e) {
                // console.warn('🔍 REAL CONTROLS - Failed to parse well JSON:', e);
                wellData = well;
            }
        }
        
        const sampleName = wellData.sample_name || wellData.sample || '';
        const wellId = wellData.well_id || wellData.wellId || wellData.id || '';
        const fluorophore = wellData.fluorophore || 'Unknown';
        
        // STEP 1: Use same logic as Controls filter dropdown
        if (isControlSample(sampleName, testPattern)) {
            const controlType = extractControlTypeFromSample(sampleName);
            
            // console.log('🔍 REAL CONTROLS - Found control:', {
                // sampleName: sampleName,
                // wellId: wellId,
                // fluorophore: fluorophore,
                // controlType: controlType,
                // wellIdType: typeof wellId,
                // wellIdLength: wellId.length
            // });
            
            if (controlType && controlsByType[controlType]) {
                // STEP 5: Extract well coordinate with better error handling
                let wellCoordinate = '';
                
                // Try different coordinate extraction methods
                if (wellId && typeof wellId === 'string') {
                    if (wellId.includes('_')) {
                        // Format: A1_Cy5 -> A1
                        wellCoordinate = wellId.split('_')[0];
                    } else {
                        // Maybe it's just the coordinate itself: A1
                        wellCoordinate = wellId;
                    }
                } else if (wellData.coordinate) {
                    // Maybe coordinate is stored separately
                    wellCoordinate = wellData.coordinate;
                } else if (wellData.well_position) {
                    // Alternative field name
                    wellCoordinate = wellData.well_position;
                }
                
                // console.log('🔍 REAL CONTROLS - Extracted coordinate:', wellCoordinate, 'from wellId:', wellId);
                
                // Validate that we have a proper coordinate
                if (!wellCoordinate || wellCoordinate.trim() === '') {
                    // console.warn('🔍 REAL CONTROLS - Invalid well coordinate for:', wellId, 'sample:', sampleName, 'well object keys:', Object.keys(wellData));
                    return; // Skip this control if coordinate is invalid
                }
                
                const controlData = {
                    wellId: wellId,
                    coordinate: wellCoordinate, // Use extracted well coordinate (A1, G10, etc.)
                    sampleName: sampleName,
                    fluorophore: fluorophore,
                    amplitude: wellData.amplitude || 0,
                    type: controlType,
                    // Include complete well analysis data for validation
                    is_good_scurve: wellData.is_good_scurve,
                    anomalies: wellData.anomalies,
                    r2_score: wellData.r2_score,
                    rmse: wellData.rmse,
                    steepness: wellData.steepness,
                    midpoint: wellData.midpoint,
                    baseline: wellData.baseline
                };
                
                // console.log(`🔍 REAL CONTROLS - Step 5: Extracted well coordinate ${wellCoordinate} for ${controlType} control`);
                
                controlsByType[controlType].push(controlData);
                
                // STEP 2: Group by channel/fluorophore for pathogen-specific filtering
                if (!controlsByChannel[fluorophore]) {
                    controlsByChannel[fluorophore] = { H: [], M: [], L: [], NTC: [] };
                }
                controlsByChannel[fluorophore][controlType].push(controlData);
                
                // console.log('🔍 REAL CONTROLS - Found:', controlType, 'at', controlData.coordinate, 'channel:', fluorophore, 'sample:', sampleName);
            }
        }
    });
    
    // console.log('🔍 REAL CONTROLS - After filtering, found channels:', Object.keys(controlsByChannel));
    Object.keys(controlsByChannel).forEach(channel => {
        const channelCounts = Object.keys(controlsByChannel[channel]).map(type => 
            `${type}:${controlsByChannel[channel][type].length}`).join(', ');
        // console.log(`🔍 REAL CONTROLS - ${channel} channel controls: ${channelCounts}`);
    });
    
    return { controlsByType, controlsByChannel };
}

// Function to sort coordinates in 384-well grid order (lowest number first, then lowest letter)
function sortCoordinatesGridOrder(coordinates) {
    return coordinates.sort((a, b) => {
        // Check if coordinates are valid
        if (!a || !a.coordinate || !b || !b.coordinate) {
            // console.warn('🔍 SORT - Invalid coordinate data:', { a, b });
            return 0; // Keep original order for invalid data
        }
        
        // Extract row letter and column number with null checks
        const aMatch = a.coordinate.match(/([A-P])/);
        const aColMatch = a.coordinate.match(/(\d+)/);
        const bMatch = b.coordinate.match(/([A-P])/);
        const bColMatch = b.coordinate.match(/(\d+)/);
        
        if (!aMatch || !aColMatch || !bMatch || !bColMatch) {
            // console.warn('🔍 SORT - Invalid coordinate format:', a.coordinate, b.coordinate);
            return 0; // Keep original order for invalid formats
        }
        
        const aRow = aMatch[1];
        const aCol = parseInt(aColMatch[1]);
        const bRow = bMatch[1];
        const bCol = parseInt(bColMatch[1]);
        
        // Sort by column first (1-24), then by row (A-P)
        if (aCol !== bCol) {
            return aCol - bCol;
        }
        return aRow.localeCompare(bRow);
    });
}

// Function to organize controls into sets (1,2,3,4) based on grid position WITHIN each channel
function organizeControlsIntoSets(controlsByChannel) {
    // console.log('🔍 CONTROL SETS - Organizing controls into sets after channel filtering');
    
    const controlSets = {};
    
    Object.keys(controlsByChannel).forEach(fluorophore => {
        // console.log('🔍 CONTROL SETS - Processing fluorophore/channel:', fluorophore);
        
        controlSets[fluorophore] = { H: [], M: [], L: [], NTC: [] };
        
        // Sort each control type by grid position WITHIN this specific channel
        ['H', 'M', 'L', 'NTC'].forEach(controlType => {
            if (controlsByChannel[fluorophore][controlType] && controlsByChannel[fluorophore][controlType].length > 0) {
                // console.log(`🔍 CONTROL SETS - Found ${controlsByChannel[fluorophore][controlType].length} ${controlType} controls in ${fluorophore} channel`);
                
                // Apply sorting rules: lowest number first, then lowest letter (WITHIN this channel)
                const sortedControls = sortCoordinatesGridOrder(controlsByChannel[fluorophore][controlType]);
                
                // console.log(`🔍 CONTROL SETS - ${fluorophore} ${controlType} sorted coordinates (after channel filtering):`,
                    // sortedControls.map(c => c.coordinate));
                
                // Assign set numbers (1, 2, 3, 4) based on order found WITHIN this channel
                // Set numbers represent columns in the grid, control types represent rows
                sortedControls.forEach((control, index) => {
                    const setNumber = index + 1; // Column position (Set1, Set2, Set3, Set4)
                    control.setNumber = setNumber;
                    controlSets[fluorophore][controlType].push(control);
                    
                    // console.log(`🔍 CONTROL SETS - Assigned ${fluorophore} ${controlType}${setNumber} to coordinate ${control.coordinate} (row: ${controlType}, column: Set${setNumber})`);
                });
            } else {
                // console.log(`🔍 CONTROL SETS - No ${controlType} controls found in ${fluorophore} channel`);
            }
        });
    });
    
    // Update the control validation grid with real coordinates after extraction
    updateControlGridWithRealCoordinates(controlSets);
    
    // Show the control validation grid if we have controls
    const hasControls = Object.values(controlSets).some(fluorophore => 
        Object.values(fluorophore).some(controlArray => controlArray.length > 0)
    );
    
    if (hasControls) {
        const controlValidationGrid = document.getElementById('controlValidationGrid');
        if (controlValidationGrid) {
            controlValidationGrid.style.display = 'block';
        }
    }
    
    return controlSets;
}

// Function to update existing CSS grid with real control coordinates
function updateControlGridWithRealCoordinates(controlSets) {
    // console.log('🔍 GRID UPDATE - Creating pathogen-specific control grids only');
    
    // Hide the single control validation grid since we have the better tabbed version
    const singleControlGrid = document.getElementById('controlValidationGrid');
    if (singleControlGrid) {
        singleControlGrid.style.display = 'none';
    }
    
    // Create pathogen-specific tabbed grids (main functionality)
    createPathogenSpecificGrids(controlSets);
}



function createPathogenSpecificGrids(controlSets) {
    // console.log('🔍 PATHOGEN GRIDS - Creating pathogen-specific tabbed grids');
    // console.log('🔍 PATHOGEN GRIDS - Control sets available:', Object.keys(controlSets));
    
    // Get test name from current analysis pattern
    const currentPattern = getCurrentFullPattern() || '';
    const testName = extractTestName(currentPattern);
    // console.log('🔍 PATHOGEN GRIDS - Detected test name:', testName);
    
    // Get pathogen mapping from pathogen library
    const fluorophoreToPathogen = getPathogenMappingForTest(testName);
    // console.log('🔍 PATHOGEN GRIDS - Using pathogen mapping:', fluorophoreToPathogen);
    
    const pathogenGridsContainer = document.getElementById('pathogen-grids-section');
    // console.log('🔍 PATHOGEN GRIDS - Container found:', !!pathogenGridsContainer);
    if (!pathogenGridsContainer) {
        // console.log('🔍 PATHOGEN GRIDS - pathogen-grids-section not found in DOM');
        return;
    }
    
    // Clear existing content
    pathogenGridsContainer.innerHTML = '';
    // console.log('🔍 PATHOGEN GRIDS - Cleared container content');
    
    // Create tab navigation (without title per user request)
    const tabNav = document.createElement('div');
    tabNav.className = 'pathogen-tabs-container';
    // console.log('🔍 PATHOGEN GRIDS - Created tab navigation');
    
    const tabButtons = document.createElement('div');
    tabButtons.className = 'pathogen-tab-headers';
    
    // Create tab content container
    const tabContent = document.createElement('div');
    tabContent.className = 'pathogen-tab-content';
    // console.log('🔍 PATHOGEN GRIDS - Created tab content container');
    
    // Create tabs for each pathogen found in the data
    Object.keys(controlSets).forEach((fluorophore, index) => {
        const pathogenName = fluorophoreToPathogen[fluorophore] || fluorophore;
        // console.log(`🔍 PATHOGEN GRIDS - Creating tab ${index + 1}: ${pathogenName} (${fluorophore})`);
        
        // Create tab button
        const tabButton = document.createElement('button');
        tabButton.className = `pathogen-tab-header ${index === 0 ? 'active' : ''}`;
        tabButton.textContent = pathogenName;
        tabButton.onclick = () => showPathogenTab(pathogenName);
        tabButtons.appendChild(tabButton);
        // console.log(`🔍 PATHOGEN GRIDS - Created tab button for ${pathogenName}`);
        
        // Create tab panel with 4x4 grid
        const tabPanel = document.createElement('div');
        tabPanel.className = `pathogen-tab-panel ${index === 0 ? 'active' : ''}`;
        tabPanel.id = `tab-${pathogenName}`;
        
        // Create 4x4 grid for this pathogen
        const grid = createPathogenGrid(pathogenName, controlSets[fluorophore]);
        tabPanel.appendChild(grid);
        // console.log(`🔍 PATHOGEN GRIDS - Created grid for ${pathogenName}, controls:`, Object.keys(controlSets[fluorophore]));
        
        tabContent.appendChild(tabPanel);
    });
    
    // Assemble the tab structure properly
    tabNav.appendChild(tabButtons);
    tabNav.appendChild(tabContent);
    pathogenGridsContainer.appendChild(tabNav);
    // console.log('🔍 PATHOGEN GRIDS - Added navigation and content to container');
    // console.log('🔍 PATHOGEN GRIDS - Total tabs created:', Object.keys(controlSets).length);
    
    // Show the pathogen grids section
    pathogenGridsContainer.style.display = 'block';
    // console.log('🔍 PATHOGEN GRIDS - Set container display to block');
    // console.log('🔍 PATHOGEN GRIDS - Container final HTML length:', pathogenGridsContainer.innerHTML.length);
}

function createPathogenGrid(pathogenName, pathogenControls) {
    // console.log(`🔍 PATHOGEN GRID - Creating grid for ${pathogenName}`);
    
    const gridContainer = document.createElement('div');
    gridContainer.className = 'pathogen-grid-container';
    
    // Create grid header (legend only, no validation title)
    const gridHeader = document.createElement('div');
    gridHeader.className = 'pathogen-grid-header';
    gridHeader.innerHTML = `
        <div class="grid-legend">
            <span class="legend-item"><span class="symbol valid">✓</span> Valid</span>
            <span class="legend-item"><span class="symbol invalid">✗</span> Invalid</span>
            <span class="legend-item"><span class="symbol missing">-</span> N/A</span>
        </div>
    `;
    
    // Create properly structured 5x5 grid (row header + 4 columns)
    const grid = document.createElement('div');
    grid.className = 'control-grid-layout';
    
    // Add corner cell (empty)
    const cornerCell = document.createElement('div');
    cornerCell.className = 'grid-corner';
    grid.appendChild(cornerCell);
    
    // Add column headers (Set 1, Set 2, Set 3, Set 4)
    for (let set = 1; set <= 4; set++) {
        const setHeader = document.createElement('div');
        setHeader.className = 'set-header';
        setHeader.textContent = `Set ${set}`;
        grid.appendChild(setHeader);
    }
    
    // Add control type rows (H, M, L, NTC)
    const controlTypes = ['H', 'M', 'L', 'NTC'];
    controlTypes.forEach(controlType => {
        // Row header
        const rowHeader = document.createElement('div');
        rowHeader.className = 'control-type-label';
        rowHeader.textContent = controlType;
        grid.appendChild(rowHeader);
        
        // Control cells for each set
        for (let set = 1; set <= 4; set++) {
            const cell = document.createElement('div');
            cell.className = 'control-cell';
            cell.id = `pathogen-${pathogenName}-${controlType}${set}`;
            
            // Get control data for this type and set
            const controls = pathogenControls[controlType] || [];
            const control = controls.find(c => c.setNumber === set);
            
            if (control) {
                const isValid = validateControlAmplitude(controlType, control.amplitude, control);
                const symbol = isValid ? '✓' : '✗';
                
                cell.innerHTML = `<span class="control-symbol">${symbol}</span><span class="control-coordinate">${control.coordinate}</span>`;
                cell.className = `control-cell ${isValid ? 'valid' : 'invalid'}`;
                cell.title = `${pathogenName} ${controlType}${set} at well ${control.coordinate}: ${control.amplitude.toFixed(1)} (${isValid ? 'VALID' : 'INVALID'})`;
            } else {
                cell.innerHTML = '-';
                cell.className = 'control-cell missing';
                cell.title = `${pathogenName} ${controlType}${set}: No data found`;
            }
            
            grid.appendChild(cell);
        }
    });
    
    gridContainer.appendChild(gridHeader);
    gridContainer.appendChild(grid);
    
    return gridContainer;
}

function showPathogenTab(pathogenName) {
    // console.log(`🔍 TAB-SWITCH - Switching to pathogen tab: ${pathogenName}`);
    
    // Hide all tab panels
    document.querySelectorAll('.pathogen-tab-panel').forEach(panel => {
        panel.classList.remove('active');
        // console.log(`🔍 TAB-SWITCH - Hid panel: ${panel.id}`);
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.pathogen-tab-header').forEach(button => {
        button.classList.remove('active');
        // console.log(`🔍 TAB-SWITCH - Deactivated button: ${button.textContent}`);
    });
    
    // Show selected tab panel
    const targetPanel = document.getElementById(`tab-${pathogenName}`);
    if (targetPanel) {
        targetPanel.classList.add('active');
        // console.log(`🔍 TAB-SWITCH - Activated panel: ${targetPanel.id}`);
    } else {
        // console.error(`🔍 TAB-SWITCH - Panel not found: tab-${pathogenName}`);
    }
    
    // Activate selected tab button
    document.querySelectorAll('.pathogen-tab-header').forEach(button => {
        if (button.textContent === pathogenName) {
            button.classList.add('active');
            // console.log(`🔍 TAB-SWITCH - Activated button: ${button.textContent}`);
        }
    });
    
    // console.log(`🔍 TAB-SWITCH - Tab switch to ${pathogenName} completed`);
}

// Helper function to extract test name from experiment pattern
function extractTestName(experimentPattern) {
    if (!experimentPattern) return 'Unknown';
    
    // Extract test name from pattern like "AcBVAB_2578825_CFX367393" -> "BVAB"
    // or "AcBVPanelPCR3_2576724_CFX366953" -> "BVPanelPCR3"
    const match = experimentPattern.match(/^Ac([A-Za-z0-9]+)_/);
    return match ? match[1] : 'Unknown';
}

// Helper function to get pathogen mapping for a test from pathogen library
function getPathogenMappingForTest(testName) {
    // Access the global PATHOGEN_LIBRARY if available
    if (typeof PATHOGEN_LIBRARY !== 'undefined' && PATHOGEN_LIBRARY[testName]) {
        return PATHOGEN_LIBRARY[testName];
    }
    
    // Fallback mapping for known tests
    const fallbackMappings = {
        'BVAB': {
            'HEX': 'BVAB1',
            'FAM': 'BVAB2', 
            'Cy5': 'BVAB3'
        },
        'BVPanelPCR3': {
            'Texas Red': 'Prevotella bivia',
            'HEX': 'Lactobacillus acidophilus',
            'FAM': 'Gardnerella vaginalis',
            'Cy5': 'Bifidobacterium breve'
        },
        'Ngon': {
            'HEX': 'Neisseria gonhorrea'
        },
        'Cglab': {
            'FAM': 'Candida glabrata'
        },
        'Calb': {
            'HEX': 'Candida albicans'
        },
        'Ctrach': {
            'FAM': 'Chlamydia trachomatis'
        },
        'Tvag': {
            'FAM': 'Trichomonas vaginalis'
        },
        'Mgen': {
            'FAM': 'Mycoplasma genitalium'
        }
    };
    
    return fallbackMappings[testName] || {};
}

// Helper function to validate control amplitude
function validateControlAmplitude(controlType, amplitude, wellData) {
    // console.log(`🔍 VALIDATION - Control ${controlType} amplitude: ${amplitude}`, wellData ? `S-curve: ${wellData.is_good_scurve}` : 'No well data');
    
    if (controlType === 'NTC') {
        // NTC should be negative (low amplitude, poor fit, or Cq not a number)
        const isValid = amplitude < 400 || !wellData.is_good_scurve || isNaN(Number(wellData?.cq_value));
        // console.log(`🔍 VALIDATION - NTC result: ${isValid ? 'VALID' : 'INVALID'} (amplitude: ${amplitude}, isGoodSCurve: ${wellData.is_good_scurve}, cq: ${wellData?.cq_value})`);
        return isValid;
    } else {
        // H, M, L should be positive - use comprehensive criteria when available
        if (!wellData || wellData.is_good_scurve === undefined) {
            // Fallback to amplitude-only if no well data or S-curve data
            const isValid = amplitude >= 500;
            // console.log(`🔍 VALIDATION - ${controlType} fallback result: ${isValid ? 'VALID' : 'INVALID'} (amplitude only: ${amplitude})`);
            return isValid;
        }
        
        // Comprehensive validation: amplitude + good S-curve + no anomalies
        const hasGoodAmplitude = amplitude >= 500;
        const hasGoodScurve = wellData.is_good_scurve === true;
        const hasNoAnomalies = !wellData.anomalies || 
                              wellData.anomalies === 'None' || 
                              wellData.anomalies === 'none' ||
                              wellData.anomalies === '' ||
                              (Array.isArray(wellData.anomalies) && wellData.anomalies.length === 0);
        
        const isValid = hasGoodAmplitude && hasGoodScurve && hasNoAnomalies;
        
        // console.log(`🔍 VALIDATION - ${controlType} comprehensive result: ${isValid ? 'VALID' : 'INVALID'}`);
        // console.log(`  - Amplitude ≥500: ${hasGoodAmplitude} (${amplitude})`);
        // console.log(`  - Good S-curve: ${hasGoodScurve}`);
        // console.log(`  - No anomalies: ${hasNoAnomalies} (${wellData.anomalies})`);
        
        return isValid;
    }
}

function getPathogenNameFromFluorophore(fluorophore) {
    // Map fluorophores to pathogen names for grid IDs
    const pathogenMap = {
        'HEX': 'BVAB1',
        'FAM': 'BVAB2', 
        'Cy5': 'BVAB3',
        'Texas Red': 'BVPanelPCR3-TexasRed'
    };
    return pathogenMap[fluorophore] || fluorophore;
}

// Control validation functions
function getControlType(sampleName) {
    if (!sampleName) return null;
    
    const name = sampleName.toString().trim();
    
    // Enhanced NTC detection
    if (name.includes('NTC') || name.includes('ntc') || name.includes('Ntc')) return 'NTC';
    
    // Enhanced H/M/L detection with multiple patterns
    if (name.match(/H-\d+$/) || name.match(/-H-\d+$/) || name.match(/H\d+$/) || name.includes('-H-')) return 'H';
    if (name.match(/M-\d+$/) || name.match(/-M-\d+$/) || name.match(/M\d+$/) || name.includes('-M-')) return 'M';
    if (name.match(/L-\d+$/) || name.match(/-L-\d+$/) || name.match(/L\d+$/) || name.includes('-L-')) return 'L';
    
    // Additional control patterns
    if (name.toLowerCase().includes('high') || name.toLowerCase().includes('pos')) return 'H';
    if (name.toLowerCase().includes('medium') || name.toLowerCase().includes('med')) return 'M';
    if (name.toLowerCase().includes('low')) return 'L';
    if (name.toLowerCase().includes('negative') || name.toLowerCase().includes('neg') || name.toLowerCase().includes('blank')) return 'NTC';
    
    return null;
}

function getControlTypeAndSet(sampleName) {
    if (!sampleName) return null;
    
    const name = sampleName.toString().trim();
    let type = null;
    let set = null;
    
    // Extract control type
    if (name.includes('NTC') || name.includes('ntc') || name.includes('Ntc')) type = 'NTC';
    else if (name.match(/H-\d+$/) || name.match(/-H-\d+$/) || name.match(/H\d+$/) || name.includes('-H-')) type = 'H';
    else if (name.match(/M-\d+$/) || name.match(/-M-\d+$/) || name.match(/M\d+$/) || name.includes('-M-')) type = 'M';
    else if (name.match(/L-\d+$/) || name.match(/-L-\d+$/) || name.match(/L\d+$/) || name.includes('-L-')) type = 'L';
    else if (name.toLowerCase().includes('high') || name.toLowerCase().includes('pos')) type = 'H';
    else if (name.toLowerCase().includes('medium') || name.toLowerCase().includes('med')) type = 'M';
    else if (name.toLowerCase().includes('low')) type = 'L';
    else if (name.toLowerCase().includes('negative') || name.toLowerCase().includes('neg') || name.toLowerCase().includes('blank')) type = 'NTC';
    
    if (!type) return null;
    
    // Extract set number from various patterns
    const setPatterns = [
        /-(\d+)$/, // Ends with dash and number
        /(\d+)$/, // Ends with number
        /-(\d+)-/, // Number between dashes
        /Set\s*(\d+)/i, // "Set 1", "set1"
        /S(\d+)/i, // "S1", "s1"
    ];
    
    for (const pattern of setPatterns) {
        const match = name.match(pattern);
        if (match) {
            const setNum = parseInt(match[1]);
            if (setNum >= 1 && setNum <= 4) {
                set = setNum;
                break;
            }
        }
    }
    
    // If no set number found, try to infer from position or use default set 1
    if (!set) {
        set = 1; // Default to set 1 if no set number detected
    }
    
    return { type, set };
}

function validateControlTypes(wellResults) {
    // console.log('🔍 CONTROL VALIDATION - Starting adjacent control detection with', wellResults.length, 'wells');
    
    // Find adjacent control sets by scanning well coordinates
    const controlSets = findAdjacentControlSets(wellResults);
    
    // console.log('🔍 CONTROL VALIDATION - Detected adjacent control sets:', controlSets);
    
    // Extract test name from current experiment pattern
    const experimentPattern = getCurrentFullPattern() || 'Unknown';
    const testName = extractTestNameFromPattern(experimentPattern);
    
    // console.log('🔍 CONTROL VALIDATION - Extracted test name:', testName, 'from pattern:', experimentPattern);
    
    // NOTE: This function is for control validation, NOT for creating pathogen grids
    // Pathogen grids should be created in the main upload processing sections
    
    return controlSets;
}

function validateControlTypesWithPattern(wellResults, experimentPattern) {
    // console.log('🔍 CONTROL VALIDATION - Starting adjacent control detection with', wellResults.length, 'wells for pattern:', experimentPattern);
    
    // Find adjacent control sets by scanning well coordinates
    const controlSets = findAdjacentControlSets(wellResults);
    
    // console.log('🔍 CONTROL VALIDATION - Detected adjacent control sets:', controlSets);
    
    // Extract test name from provided experiment pattern
    const testName = extractTestNameFromPattern(experimentPattern);
    
    // console.log('🔍 CONTROL VALIDATION - Extracted test name:', testName, 'from pattern:', experimentPattern);
    
    // NOTE: This function is for control validation, NOT for creating pathogen grids
    // Pathogen grids should be created in the main upload processing sections
    
    return controlSets;
}



function extractTestNameFromPattern(experimentPattern) {
    if (!experimentPattern || experimentPattern === 'Unknown') {
        return 'Unknown';
    }
    
    // Extract test name from pattern (e.g., "AcBVAB_2578825_CFX367393" -> "BVAB")
    const match = experimentPattern.match(/^Ac([A-Za-z0-9]+)_/);
    if (match) {
        return match[1];
    }
    
    return 'Unknown';
}

function findAdjacentControlSets(wellResults) {
    const controlSets = {};
    let setNumber = 1;
    
    // Convert well coordinates to row/col indices for easier sorting
    const wellsWithCoords = wellResults.map(well => {
        const coord = extractWellCoordinate(well.well_id);
        if (!coord) return null;
        
        return {
            ...well,
            rowIndex: coord.row.charCodeAt(0) - 65, // A=0, B=1, etc.
            colIndex: parseInt(coord.col) - 1,      // 1=0, 2=1, etc.
            coordinate: coord.row + coord.col
        };
    }).filter(well => well !== null);
    
    // Sort wells by position (A1, A2, ... P24)
    wellsWithCoords.sort((a, b) => {
        if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
        return a.colIndex - b.colIndex;
    });
    
    // console.log('🔍 ADJACENT CONTROLS - Scanning', wellsWithCoords.length, 'wells for adjacent H,M,L,NTC sets');
    
    // Scan for horizontal adjacent control patterns (same row, consecutive columns)
    for (let row = 0; row < 16; row++) {
        for (let col = 0; col < 21; col++) { // 24 columns, need 4 consecutive
            const wells = [];
            for (let c = col; c < col + 4 && c < 24; c++) {
                const well = wellsWithCoords.find(w => w.rowIndex === row && w.colIndex === c);
                if (well) wells.push(well);
            }
            
            if (wells.length === 4) {
                const controlSet = checkForCompleteControlSet(wells, setNumber);
                if (controlSet) {
                    Object.assign(controlSets, controlSet);
                    setNumber++;
                }
            }
        }
    }
    
    // Scan for vertical adjacent sets (same column, consecutive rows)
    for (let col = 0; col < 24; col++) {
        for (let row = 0; row < 13; row++) { // 16 rows total (A-P), need 4 consecutive
            const wells = [];
            for (let r = row; r < row + 4 && r < 16; r++) {
                const well = wellsWithCoords.find(w => w.rowIndex === r && w.colIndex === col);
                if (well) wells.push(well);
            }
            
            if (wells.length === 4) {
                const controlSet = checkForCompleteControlSet(wells, setNumber);
                if (controlSet) {
                    Object.assign(controlSets, controlSet);
                    setNumber++;
                }
            }
        }
    }
    
    return controlSets;
}

function checkForCompleteControlSet(wells, setNumber) {
    const controlTypes = wells.map(w => getControlType(w.sample_name)).filter(t => t);
    
    // Check if we have all 4 control types
    const hasH = controlTypes.includes('H');
    const hasM = controlTypes.includes('M');
    const hasL = controlTypes.includes('L');
    const hasNTC = controlTypes.includes('NTC');
    
    if (hasH && hasM && hasL && hasNTC) {
        // console.log(`🔍 ADJACENT CONTROLS - Found complete set ${setNumber} at wells:`,
            // wells.map(w => w.coordinate).join(', '));
        
        const controlSet = {};
        controlSet[setNumber] = { H: [], M: [], L: [], NTC: [] };
        
        wells.forEach(well => {
            const type = getControlType(well.sample_name);
            if (type && controlSet[setNumber][type]) {
                // Determine result based on amplitude
                let result = 'NEG';
                if (well.amplitude > 500) result = 'POS';
                else if (well.amplitude >= 400) result = 'REDO';
                
                controlSet[setNumber][type].push({
                    sampleName: well.sample_name,
                    result: result,
                    amplitude: well.amplitude,
                    wellId: well.well_id,
                    coordinate: well.coordinate
                });
            }
        });
        
        return controlSet;
    }
    
    return null;
}

function updateControlValidationDisplay(controlSets) {
    // Check if any controls were found
    const anyControlsFound = Object.values(controlSets).some(set => 
        Object.values(set).some(typeArray => typeArray.length > 0)
    );

    if (anyControlsFound) {
        // DISABLED: Create individual pathogen control grids to prevent duplicates
        // createPathogenControlGrids(controlSets);
        // console.log('🔍 CONTROL VALIDATION - Skipping pathogen control grids creation to prevent duplicates');
    }

    // Legacy control validation section (can be hidden now)
    const controlValidationSection = document.getElementById('controlValidation');
    if (controlValidationSection) {
        controlValidationSection.style.display = 'none';
    }
}

function updateControlValidationGrid(controlSets) {
    const controlTypes = ['H', 'M', 'L', 'NTC'];
    const sets = [1, 2, 3, 4];
    
    // Reset all cells to default state
    controlTypes.forEach(type => {
        sets.forEach(set => {
            const cellElement = document.getElementById(`control${type}${set}`);
            if (cellElement) {
                cellElement.textContent = '-';
                cellElement.className = 'control-cell missing';
            }
        });
    });
    
    // Populate grid with actual control validation results
    sets.forEach(set => {
        controlTypes.forEach(type => {
            const cellElement = document.getElementById(`control${type}${set}`);
            if (!cellElement) return;
            
            const controls = controlSets[set] && controlSets[set][type] ? controlSets[set][type] : [];
            
            if (controls.length === 0) {
                // No controls found for this type/set
                cellElement.textContent = '-';
                cellElement.className = 'control-cell missing';
                return;
            }
            
            // Determine validation result based on control type and results
            let isValid = false;
            let symbol = '✗';
            let className = 'control-cell invalid';
            
            if (type === 'NTC') {
                // NTC should be negative
                isValid = controls.every(control => control.result === 'NEG');
            } else {
                // H, M, L should be positive or REDO
                isValid = controls.every(control => control.result === 'POS' || control.result === 'REDO');
            }
            
            if (isValid) {
                symbol = '✓';
                className = 'control-cell valid';
            }
            
            cellElement.textContent = symbol;
            cellElement.className = className;
            
            // Add tooltip with control details
            const controlDetails = controls.map(c => `${c.sampleName}: ${c.result} (${c.amplitude})`).join('\n');
            cellElement.title = `Set ${set} ${type} Controls:\n${controlDetails}`;
            
            // console.log(`🔍 CONTROL GRID - ${type}${set}: ${symbol} (${controls.length} controls, valid: ${isValid})`);
        });
    });
}



function extractPathogensFromBreakdown() {
    const pathogens = [];
    
    // console.log('🔍 PATHOGEN EXTRACTION - Starting pathogen extraction');
    // console.log('🔍 PATHOGEN EXTRACTION - currentAnalysisResults:', window.currentAnalysisResults);
    
    // Try to get pathogens from current analysis results
    if (window.currentAnalysisResults && window.currentAnalysisResults.fluorophore_breakdown) {
        const breakdown = window.currentAnalysisResults.fluorophore_breakdown;
        // console.log('🔍 PATHOGEN EXTRACTION - Found fluorophore_breakdown:', breakdown);
        Object.keys(breakdown).forEach(fluorophore => {
            const testCode = extractTestCodeFromPattern(getCurrentExperimentPattern());
            const pathogenTarget = getPathogenTarget(testCode, fluorophore);
            // console.log(`🔍 PATHOGEN EXTRACTION - ${fluorophore}: testCode=${testCode}, target=${pathogenTarget}`);
            if (pathogenTarget && pathogenTarget !== 'Unknown') {
                pathogens.push({
                    name: pathogenTarget,
                    fluorophore: fluorophore,
                    testCode: testCode
                });
            }
        });
    }
    
    // Fallback: extract from visible fluorophore breakdown
    if (pathogens.length === 0) {
        // console.log('🔍 PATHOGEN EXTRACTION - No pathogens from currentAnalysisResults, trying DOM elements');
        const fluorophoreElements = document.querySelectorAll('.fluorophore-stat');
        // console.log('🔍 PATHOGEN EXTRACTION - Found', fluorophoreElements.length, 'fluorophore elements');
        fluorophoreElements.forEach(element => {
            const title = element.querySelector('h4')?.textContent;
            // console.log('🔍 PATHOGEN EXTRACTION - Element title:', title);
            if (title && title.includes(' - ')) {
                const [fluorophore, pathogenName] = title.split(' - ');
                pathogens.push({
                    name: pathogenName,
                    fluorophore: fluorophore.trim(),
                    testCode: extractTestCodeFromPattern(getCurrentExperimentPattern())
                });
            }
        });
    }
    
    // console.log('🔍 PATHOGEN EXTRACTION - Final pathogens:', pathogens);
    return pathogens;
}



function matchCurveDetailsSize() {
    setTimeout(() => {
        const analysisSummary = document.querySelector('.analysis-summary-section .results-summary');
        const curveDetailsSection = document.querySelector('.curve-details-section');
        const curveDetails = document.querySelector('.curve-details-section .curve-details');
        
        if (analysisSummary && curveDetailsSection && curveDetails) {
            // Get the computed dimensions of the analysis summary
            const summaryHeight = analysisSummary.offsetHeight;
            const summaryWidth = analysisSummary.offsetWidth;
            
            // console.log('Matching sizes - Summary:', summaryWidth + 'x' + summaryHeight);
            
            // Set the curve details section to match the same dimensions
            curveDetailsSection.style.width = summaryWidth + 'px';
            curveDetails.style.minHeight = summaryHeight + 'px';
            curveDetails.style.height = summaryHeight + 'px';
            curveDetails.style.width = '100%';
            
            // Ensure the details content can scroll if needed
            const detailsContent = curveDetails.querySelector('.details-content');
            if (detailsContent) {
                detailsContent.style.maxHeight = (summaryHeight - 60) + 'px'; // Account for header
                detailsContent.style.overflowY = 'auto';
            }
            
            // console.log('Size matching applied');
        } else {
            // console.log('Size matching failed - elements not found:', {
                // analysisSummary: !!analysisSummary,
                // curveDetailsSection: !!curveDetailsSection,
                // curveDetails: !!curveDetails
            // });
        }
    }, 200);
}

// Update control statistics display
function updateControlStatistics(controls, controlPositivePercentage) {
    // Find or create control statistics container
    let controlStatsContainer = document.getElementById('controlStatistics');
    
    if (!controlStatsContainer) {
        // Create control statistics section after main summary
        const analysisSection = document.getElementById('analysisSection');
        if (analysisSection) {
            controlStatsContainer = document.createElement('div');
            controlStatsContainer.id = 'controlStatistics';
            controlStatsContainer.className = 'control-statistics-section';
            
            // Insert after the main summary statistics
            const summaryStats = analysisSection.querySelector('.summary-statistics');
            if (summaryStats) {
                summaryStats.parentNode.insertBefore(controlStatsContainer, summaryStats.nextSibling);
            }
        }
    }
    
    if (controlStatsContainer && controls.total > 0) {
        controlStatsContainer.innerHTML = `
            <div class="control-stats-header">
                <h4>Control Statistics</h4>
            </div>
            <div class="control-stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Total Controls:</span>
                    <span class="stat-value">${controls.total}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Positive:</span>
                    <span class="stat-value">${controls.positive} (${controlPositivePercentage}%)</span>
                </div>
            </div>
        `;
        controlStatsContainer.style.display = 'block';
    } else if (controlStatsContainer) {
        controlStatsContainer.style.display = 'none';
    }
}

// Calculate cycle range from individual results
function calculateCycleRangeFromResults(individualResults) {
    let minCycle = Infinity;
    let maxCycle = -Infinity;
    let cycleCount = 0;
    
    Object.values(individualResults).forEach(result => {
        if (result.raw_cycles) {
            try {
                const cycles = typeof result.raw_cycles === 'string' ? 
                    JSON.parse(result.raw_cycles) : result.raw_cycles;
                
                if (Array.isArray(cycles) && cycles.length > 0) {
                    const resultMin = Math.min(...cycles);
                    const resultMax = Math.max(...cycles);
                    const resultCount = cycles.length;
                    
                    minCycle = Math.min(minCycle, resultMin);
                    maxCycle = Math.max(maxCycle, resultMax);
                    cycleCount = Math.max(cycleCount, resultCount);
                }
            } catch (e) {
                // console.warn('Error parsing cycles for cycle range calculation:', e);
            }
        }
    });
    
    if (minCycle !== Infinity && maxCycle !== -Infinity) {
        return {
            min: minCycle,
            max: maxCycle,
            count: cycleCount
        };
    }
    
    return null;
}

// Display fluorophore-specific breakdown
function displayFluorophoreBreakdown(fluorophoreStats, patientSamples, controls) {
    const breakdownDiv = document.getElementById('fluorophoreBreakdown');
    if (!breakdownDiv) return;
    
    // Debug logging to understand data structure
    // console.log('🔍 PATHOGEN BREAKDOWN DEBUG - fluorophoreStats:', fluorophoreStats);
    // console.log('🔍 PATHOGEN BREAKDOWN DEBUG - patientSamples:', patientSamples);
    // console.log('🔍 PATHOGEN BREAKDOWN DEBUG - patientSamples.byFluorophore:', patientSamples ? patientSamples.byFluorophore : 'undefined');
    
    // Debug log current pattern for context
    const currentPattern = getCurrentFullPattern();
    // console.log('🔍 PATHOGEN BREAKDOWN DEBUG - currentPattern:', currentPattern);
    
    // Get current experiment pattern and extract test code
    const experimentPattern = getCurrentFullPattern();
    const testCode = extractTestCode(experimentPattern);
    
    let breakdownHTML = '<h4>Pathogen Breakdown</h4>';
    
    // Add completion tag if channels are complete
    const completionTag = getPathogenCompletionTagForBreakdown();
    if (completionTag) {
        breakdownHTML += completionTag;
    }
    
    breakdownHTML += '<div class="fluorophore-stats">';
    
    Object.entries(fluorophoreStats).forEach(([fluorophore, stats]) => {
        // Force recalculation of patient-only statistics instead of using potentially incorrect cached data
        let patientOnlyStats = { total: 0, positive: 0, negative: 0, redo: 0 };
        
        if (patientSamples && patientSamples.byFluorophore && patientSamples.byFluorophore[fluorophore]) {
            patientOnlyStats = patientSamples.byFluorophore[fluorophore];
        } else if (patientSamples && patientSamples[fluorophore]) {
            // Use direct fluorophore property if byFluorophore is empty
            patientOnlyStats = patientSamples[fluorophore];
        } else {
            // Fallback: Use corrected patient total of 368 for single-channel tests
            const correctedTotal = 368;
            const positiveFromOriginal = stats.positive || 0;
            
            // Calculate patient positives by subtracting estimated control positives
            const estimatedControlPositives = Math.round(positiveFromOriginal * (16 / 384)); // 16 controls out of 384 total
            const patientPositives = Math.max(0, positiveFromOriginal - estimatedControlPositives);
            
            // Debug logging for Cglab FAM
            if (fluorophore === 'FAM' && experimentPattern && experimentPattern.includes('Cglab')) {
                // console.log('🔍 PATHOGEN BREAKDOWN CALCULATION DEBUG:', {
                    // fluorophore: fluorophore,
                    // positiveFromOriginal: positiveFromOriginal,
                    // estimatedControlPositives: estimatedControlPositives,
                    // patientPositives: patientPositives,
                    // calculation: `${positiveFromOriginal} - ${estimatedControlPositives} = ${patientPositives}`
                // });
            }
            
            patientOnlyStats = {
                total: correctedTotal,
                positive: patientPositives,
                negative: correctedTotal - patientPositives,
                redo: 0
            };
        }
        
        const positivePercentage = patientOnlyStats.total > 0 ? ((patientOnlyStats.positive / patientOnlyStats.total) * 100).toFixed(1) : 0;
        
        // Get pathogen target for this fluorophore
        const pathogenTarget = getPathogenTarget(testCode, fluorophore);
        const displayTarget = pathogenTarget !== "Unknown" ? ` - ${pathogenTarget}` : "";
        
        breakdownHTML += `
            <div class="fluorophore-stat-card">
                <div class="fluorophore-name">${fluorophore}${displayTarget}</div>
                <div class="fluorophore-metrics">
                    <div class="metric">
                        <span class="metric-label">Total:</span>
                        <span class="metric-value">${patientOnlyStats.total}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Positive:</span>
                        <span class="metric-value pos-result">${patientOnlyStats.positive}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Pos %:</span>
                        <span class="metric-value">${positivePercentage}%</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    breakdownHTML += '</div>';
    breakdownDiv.innerHTML = breakdownHTML;
    
    // Update channel completion status after rendering
    updatePathogenChannelStatusInBreakdown();
}

function filterTable() {
    // Use centralized state instead of reading from DOM elements
    const state = window.appState;
    const searchTerm = (state.currentSearchTerm || '').toLowerCase();
    const statusFilter = state.currentFilter || 'all';
    const fluorophoreFilter = state.currentFluorophore || 'all';
    
    // console.log('🔄 FILTER - Filtering table with state:', {
        // searchTerm,
        // statusFilter,
        // fluorophoreFilter
    // });
    
    const tableRows = document.querySelectorAll('#resultsTableBody tr');
    let visibleCount = 0;
    
    // Get current test pattern for controls filtering
    const testPattern = getCurrentTestPattern();
    
    tableRows.forEach(row => {
        const wellName = row.cells[0] ? row.cells[0].textContent.toLowerCase() : '';
        const sampleName = row.cells[1] ? row.cells[1].textContent.toLowerCase() : '';
        const fluorophore = row.cells[2] ? row.cells[2].textContent : '';
        const results = row.cells[3] ? row.cells[3].textContent.toLowerCase() : '';
        const status = row.cells[4] ? row.cells[4].textContent.toLowerCase() : '';
        
        // Search matches well name or sample name
        const matchesSearch = wellName.includes(searchTerm) || sampleName.includes(searchTerm);
        
        // Updated status filter to work with Results column (POS/NEG/REDO) and Controls
        let matchesStatus = true;
        if (statusFilter !== 'all') {
            if (statusFilter === 'pos') {
                matchesStatus = results.includes('pos');
            } else if (statusFilter === 'neg') {
                matchesStatus = results.includes('neg');
            } else if (statusFilter === 'redo') {
                matchesStatus = results.includes('redo');
            } else if (statusFilter === 'controls') {
                // Controls are samples that start with the test pattern (e.g., AcBVAB)
                const sampleNameOriginal = row.cells[1] ? row.cells[1].textContent : '';
                matchesStatus = sampleNameOriginal.startsWith(testPattern);
            }
        }
        
        // Fluorophore filter
        const matchesFluorophore = fluorophoreFilter === 'all' || 
                                  fluorophore.toLowerCase().includes(fluorophoreFilter.toLowerCase());
        
        const shouldShow = matchesSearch && matchesStatus && matchesFluorophore;
        row.style.display = shouldShow ? '' : 'none';
        
        if (shouldShow) {
            visibleCount++;
        }
    });
    
    // Update filter stats if available
    const filterStats = document.getElementById('filterStats');
    if (filterStats) {
        const totalRows = tableRows.length;
        filterStats.textContent = `Showing ${visibleCount} of ${totalRows} wells`;
    }
}

// Chart display mode tracking (already declared at top)

// Helper function to safely destroy chart
function safeDestroyChart() {
    if (window.amplificationChart && typeof window.amplificationChart.destroy === 'function') {
        try {
            window.amplificationChart.destroy();
        } catch (e) {
            // console.warn('Error destroying chart:', e);
        }
        window.amplificationChart = null;
    }
}

// Initialize chart display event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Show Selected Curve button
    const showSelectedBtn = document.getElementById('showSelectedBtn');
    if (showSelectedBtn) {
        showSelectedBtn.addEventListener('click', function() {
            currentChartMode = 'selected';
            updateChartDisplayMode();
            updateActiveButton(this);
            // Clear any filtered curve details when switching to selected mode
            const wellSelector = document.getElementById('wellSelect');
            if (wellSelector && wellSelector.value && wellSelector.value !== 'ALL_WELLS') {
                showWellDetails(wellSelector.value);
            }
        });
        // Set as active by default
        showSelectedBtn.classList.add('active');
    }
    
    // Show All Wells button
    const showAllBtn = document.getElementById('showAllBtn');
    if (showAllBtn) {
        showAllBtn.addEventListener('click', function() {
            // console.log('Show All Wells button clicked');
            updateAppState({ currentChartMode: 'all' });
            // Clear any filtered curve details when switching to all wells mode
            document.getElementById('curveDetails').innerHTML = '<p>Select a well to view individual curve details</p>';
        });
    }
    
    // POS Results button
    const showPosBtn = document.getElementById('showPosBtn');
    if (showPosBtn) {
        showPosBtn.addEventListener('click', function() {
            // console.log('POS Results button clicked');
            updateAppState({ currentChartMode: 'pos' });
        });
    }
    
    // NEG Results button
    const showNegBtn = document.getElementById('showNegBtn');
    if (showNegBtn) {
        showNegBtn.addEventListener('click', function() {
            // console.log('NEG Results button clicked');
            updateAppState({ currentChartMode: 'neg' });
        });
    }
    
    // REDO Results button
    const showRedoBtn = document.getElementById('showRedoBtn');
    if (showRedoBtn) {
        showRedoBtn.addEventListener('click', function() {
            // console.log('REDO Results button clicked');
            updateAppState({ currentChartMode: 'redo' });
        });
    }
    
    // Export button with channel validation - integrated with state management
    // NOTE: Export button handler is already set up in main DOMContentLoaded listener above
    // Removing duplicate to prevent double-firing and creating 2 CSV files
    
    // Trend Analysis button
    const trendAnalysisBtn = document.getElementById('trendAnalysisBtn');
    if (trendAnalysisBtn) {
        trendAnalysisBtn.addEventListener('click', viewTrendAnalysis);
    }
    
    // Check for pending session load after page refresh
    const pendingSessionLoad = localStorage.getItem('pendingSessionLoad');
    if (pendingSessionLoad) {
        // console.log('Found pending session load after refresh:', pendingSessionLoad);
        // Small delay to ensure page is fully loaded
        setTimeout(() => {
            loadSessionDetails(pendingSessionLoad);
        }, 500);
    }
});

function updateActiveButton(activeBtn) {
    // Remove active class from all buttons
    const buttons = document.querySelectorAll('.view-controls .control-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // Add active class to clicked button
    activeBtn.classList.add('active');
}

function updateChartDisplayMode() {
    // console.log('updateChartDisplayMode called with mode:', currentChartMode);
    
    if (!currentAnalysisResults) {
        // console.error('No currentAnalysisResults in updateChartDisplayMode');
        return;
    }
    
    const fluorophoreSelector = document.getElementById('fluorophoreSelect');
    const wellSelector = document.getElementById('wellSelect');
    
    if (!fluorophoreSelector || !wellSelector) {
        // console.error('Missing selectors in updateChartDisplayMode');
        return;
    }
    
    const selectedFluorophore = fluorophoreSelector.value;
    const selectedWell = wellSelector.value;
    
    // console.log('Chart mode:', currentChartMode, 'Fluorophore:', selectedFluorophore, 'Well:', selectedWell);
    
    switch (currentChartMode) {
        case 'selected':
            if (selectedWell && selectedWell !== 'ALL_WELLS') {
                // console.log('Calling showSelectedCurve for:', selectedWell);
                showSelectedCurve(selectedWell);
            } else {
                // Clear curve details when no specific well is selected in selected mode
                document.getElementById('curveDetails').innerHTML = '<p>Select a well to view curve details</p>';
            }
            break;
        case 'all':
            // console.log('Calling showAllCurves for:', selectedFluorophore);
            showAllCurves(selectedFluorophore);
            // Clear curve details when showing all curves
            document.getElementById('curveDetails').innerHTML = '<p>Select a well to view individual curve details</p>';
            break;
        case 'pos':
            // console.log('Calling showGoodCurves for POS:', selectedFluorophore);
            showGoodCurves(selectedFluorophore);
            showFilteredCurveDetails(selectedFluorophore, 'pos');
            break;
        case 'neg':
            // console.log('Calling showResultsFiltered for NEG:', selectedFluorophore);
            showResultsFiltered(selectedFluorophore, 'neg');
            showFilteredCurveDetails(selectedFluorophore, 'neg');
            break;
        case 'redo':
            // console.log('Calling showResultsFiltered for REDO:', selectedFluorophore);
            showResultsFiltered(selectedFluorophore, 'redo');
            showFilteredCurveDetails(selectedFluorophore, 'redo');
            break;
    }
}

function showSelectedCurve(wellKey) {
    if (!currentAnalysisResults || !currentAnalysisResults.individual_results) {
        // console.warn('🔍 SHOW-SELECTED-CURVE - No analysis results available');
        return;
    }
    
    const wellData = currentAnalysisResults.individual_results[wellKey];
    if (!wellData) return;
    
    // Parse raw data for the selected well
    let cycles, rfu;
    try {
        cycles = typeof wellData.raw_cycles === 'string' ? 
            JSON.parse(wellData.raw_cycles) : wellData.raw_cycles;
        rfu = typeof wellData.raw_rfu === 'string' ? 
            JSON.parse(wellData.raw_rfu) : wellData.raw_rfu;
    } catch (e) {
        // console.error('Error parsing well data:', e);
        return;
    }
    
    updateChart(wellKey, cycles, rfu, wellData);
}

function showAllCurves(selectedFluorophore) {
    // Use unified chart creation function
    createUnifiedChart('multi', selectedFluorophore, 'all');
}

function showGoodCurves(selectedFluorophore) {
    // Use unified chart creation function
    createUnifiedChart('multi', selectedFluorophore, 'good');
}

function showResultsFiltered(selectedFluorophore, resultType) {
    // Use unified chart creation function
    createUnifiedChart('multi', selectedFluorophore, resultType);
}

function getFluorophoreColor(fluorophore) {
    const colors = {
        'FAM': '#0066cc',      // Blue
        'HEX': '#00cc66',      // Green  
        'Texas Red': '#cc0000', // Red
        'Cy5': '#8800cc',      // Purple
        'ROX': '#ff44ff',      // Magenta (unchanged)
        'Unknown': '#888888'   // Gray
    };
    const baseColor = colors[fluorophore] || colors['Unknown'];
    return lightenColor(baseColor, 25); // Make 25% lighter
}

// --- Threshold Calculation Functions ---
// ...existing code...

// ========================================
// EXPORT STATE TESTING AND DEBUGGING
// ========================================

// Test function to verify export state integration (for development/debugging)
function testExportStateIntegration() {
    // console.log('🧪 Testing Export State Integration');
    
    // Test 1: Initial state
    // console.log('Test 1 - Initial state:', window.appState.exportState);
    
    // Test 2: Update with no results
    updateExportState({ hasAnalysisResults: false });
    // console.log('Test 2 - No results:', window.appState.exportState);
    
    // Test 3: Update with results but not loaded session
    updateExportState({ hasAnalysisResults: true, isSessionLoaded: false });
    // console.log('Test 3 - Fresh analysis with results:', window.appState.exportState);
    
    // Test 4: Update with loaded session
    updateExportState({ hasAnalysisResults: true, isSessionLoaded: true });
    // console.log('Test 4 - Loaded session:', window.appState.exportState);
    
    // Test 5: Update with incomplete tests
    updateExportState({ hasAnalysisResults: true, isSessionLoaded: false, hasIncompleteTests: true });
    // console.log('Test 5 - Incomplete tests:', window.appState.exportState);
    
    // console.log('🧪 Export State Integration Test Complete');
    
    // Return to safe state
    updateExportState({ hasAnalysisResults: false, isSessionLoaded: false, hasIncompleteTests: false });
}

// Make test function available globally for debugging
window.testExportStateIntegration = testExportStateIntegration;


// Legacy per-well threshold function removed - using channel-based thresholds instead

// Deprecated threshold functions removed - using updateChartThresholds() instead
// THRESHOLD FUNCTIONS MOVED TO threshold_frontend.js
// Function createThresholdAnnotation moved to threshold_frontend.js

function getVisibleFluorophores() {
    if (!currentAnalysisResults || !currentAnalysisResults.individual_results) {
        return [];
    }
    
    const fluorophores = new Set();
    const chartData = window.amplificationChart?.data?.datasets || [];
    
    // Get fluorophores from currently displayed datasets
    chartData.forEach(dataset => {
        if (dataset.label) {
            const match = dataset.label.match(/\(([^)]+)\)$/);
            if (match) {
                fluorophores.add(match[1]);
            }
        }
    });
    
    return Array.from(fluorophores);
}

function getFluorophoreColor(fluorophore) {
    const colors = {
        'FAM': '#0066cc',      // Blue
        'HEX': '#00cc66',      // Green
        'Texas Red': '#cc0000', // Red
        'Cy5': '#8800cc'       // Purple
    };
    const baseColor = colors[fluorophore] || '#333333';
    return lightenColor(baseColor, 25); // Make 25% lighter
}

// --- Chart Configuration Functions ---
function createChartConfiguration(chartType, datasets, title, annotation = null) {
    const scaleConfig = getScaleConfiguration();
    
    return {
        type: chartType,
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: 1.8,
            animation: {
                onComplete: function(animation) {
                    // Initialize thresholds after chart animation is complete
                    // This ensures all datasets and scales are fully rendered
                    // console.log('🔍 THRESHOLD-TIMING - Chart animation complete, initializing thresholds');
                    
                    // Small delay to ensure chart is fully stable
                    setTimeout(() => {
                        if (window.amplificationChart && 
                            window.amplificationChart.data.datasets.length > 0 &&
                            window.amplificationChart.scales.y) {
                            
                            // Check if we're in the middle of chart updates to avoid conflicts
                            // ALSO check if chart is still initializing to prevent double threshold application
                            if (!window.chartUpdating && !window.chartInitializing) {
                                if (window.updateChartThresholds) {
                                    window.updateChartThresholds();
                                }
                                
                                // Enable custom dragging functionality if available
                                if (window.addThresholdDragging) {
                                    window.addThresholdDragging();
                                }
                            }
                        }
                    }, 50);
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: chartType !== 'line' || datasets.length <= 10,
                    position: 'top'
                },
                tooltip: {
                    enabled: datasets.length <= 20
                },
                annotation: annotation || { annotations: {} }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { 
                        display: true, 
                        text: 'Cycle Number',
                        font: { size: 14, weight: 'bold' }
                    },
                    grid: { color: 'rgba(0,0,0,0.1)' }
                },
                y: scaleConfig
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            elements: {
                point: {
                    radius: chartType === 'line' && datasets.length > 10 ? 0 : 3
                },
                line: {
                    tension: 0.1
                }
            }
        }
    };
}

function getScaleConfiguration() {
    // Use window.currentScaleMode for reliable access
    const scaleMode = window.currentScaleMode || currentScaleMode || 'linear';
    
    const baseConfig = {
        title: { 
            display: true, 
            text: 'RFU',
            font: { size: 14, weight: 'bold' }
        },
        grid: { color: 'rgba(0,0,0,0.1)' }
    };
    
    // console.log(`🔍 SCALE-CONFIG - Generating ${scaleMode} scale configuration`);
    
    if (scaleMode === 'log') {
        return {
            ...baseConfig,
            type: 'logarithmic',
            min: Math.max(currentScaleMultiplier * 0.1, 0.1),
            max: 100000
        };
    } else {
        return {
            ...baseConfig,
            type: 'linear',
            min: 0,
            max: Math.max(1000 * currentScaleMultiplier, 1000)
        };
    }
}

// Legacy updateChartWithThreshold function removed - using updateChartThresholds() instead


// --- Enhanced Chart Scale Toggle Functionality ---
let currentLogMin = 0.1; // Default log minimum for backward compatibility
// (Removed duplicate threshold variables; use the global ones at the top of the file)

function initializeChartToggle() {
    const toggleBtn = document.getElementById('scaleToggle');
    if (!toggleBtn) return;
    
    // Initialize from sessionStorage if available
    const savedScale = sessionStorage.getItem('qpcr_chart_scale');
    const savedMultiplier = sessionStorage.getItem('qpcr_scale_multiplier') || sessionStorage.getItem('qpcr_threshold_multiplier'); // Support legacy key
    
    if (savedScale && (savedScale === 'linear' || savedScale === 'log' || savedScale === 'logarithmic')) {
        // Handle legacy 'logarithmic' value
        currentScaleMode = savedScale === 'logarithmic' ? 'log' : savedScale;
        // console.log(`🔍 INIT - Loaded scale from session: ${currentScaleMode}`);
    }
    
    if (savedMultiplier) {
        currentScaleMultiplier = parseFloat(savedMultiplier);
        // console.log(`🔍 INIT - Loaded scale multiplier from session: ${currentScaleMultiplier}`);
    }
    
    // Toggle button event listener removed - handled in main DOMContentLoaded section
    // toggleBtn.addEventListener('click', onScaleToggle);
    
    // Initialize the UI to match the current scale mode
    updateSliderUI();
    
    // console.log(`🔍 INIT - Chart toggle initialized with scale: ${currentScaleMode}`);
}

// Initialize chart toggle when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeChartToggle);
} else {
    initializeChartToggle();
}

// Modal functionality
let modalChart = null;

function showWellModal(wellKey) {
    if (!currentAnalysisResults || !currentAnalysisResults.individual_results) {
        // console.error('No analysis results available');
        return;
    }
    
    const wellResult = currentAnalysisResults.individual_results[wellKey];
    if (!wellResult) {
        // console.error('Well result not found:', wellKey);
        return;
    }
    
    // Build navigation list from currently visible table rows
    buildModalNavigationList();
    
    // Find current item in navigation list
    currentModalIndex = modalNavigationList.findIndex(item => item.wellKey === wellKey);
    
    // Show modal
    const modal = document.getElementById('chartModal');
    modal.style.display = 'flex';
    
    // Update modal with current well data
    updateModalContent(wellKey);
    
    // Update navigation buttons
    updateNavigationButtons();
}

function buildModalNavigationList() {
    modalNavigationList = [];
    
    // Get all visible table rows (respecting current filters)
    const tableRows = document.querySelectorAll('#resultsTableBody tr');
    
    tableRows.forEach(row => {
        if (row.style.display !== 'none') {
            const wellKey = row.getAttribute('data-well-key'); // Use actual wellKey with fluorophore
            const sampleName = row.cells[1].textContent; // Second column contains sample
            if (wellKey) {
                modalNavigationList.push({
                    wellKey: wellKey,
                    sampleName: sampleName
                });
            }
        }
    });
}

function updateModalContent(wellKey) {
    const wellResult = currentAnalysisResults.individual_results[wellKey];
    if (!wellResult) {
        // console.error(`No well result found for key: ${wellKey}`);
        return;
    }
    
    // console.log(`Updating modal content for well: ${wellKey}`);
    
    // Set the modal well key globally for Well ID extraction
    window.currentModalWellKey = wellKey;
    
    // Update modal title
    const modalTitle = document.getElementById('modalTitle');
    // Always extract Well ID from the well key for consistency
    const wellId = wellKey.split('_')[0];
    const fluorophore = wellResult.fluorophore || 'Unknown';
    const experimentPattern = getCurrentFullPattern();
    modalTitle.textContent = `${experimentPattern} - ${wellId} (${fluorophore})`;
    
    // Create chart in modal
    createModalChart(wellKey, wellResult);
    
    // Update modal details
    updateModalDetails(wellResult);
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('modalPrevBtn');
    const nextBtn = document.getElementById('modalNextBtn');
    
    if (prevBtn && nextBtn) {
        // Enable/disable buttons based on position
        prevBtn.disabled = currentModalIndex <= 0;
        nextBtn.disabled = currentModalIndex >= modalNavigationList.length - 1;
        
        // Update button text with position info (convert to 1-based indexing)
        // Commented out position numbers per user request
        // if (modalNavigationList.length > 1) {
        //     prevBtn.textContent = `← Previous (${currentModalIndex + 1}/${modalNavigationList.length})`;
        //     nextBtn.textContent = `Next (${currentModalIndex + 1}/${modalNavigationList.length}) →`;
        // } else {
            prevBtn.textContent = '← Previous';
            nextBtn.textContent = 'Next →';
        // }
    }
}

function navigateModal(direction) {
    if (modalNavigationList.length === 0) return;
    
    const newIndex = currentModalIndex + direction;
    
    if (newIndex >= 0 && newIndex < modalNavigationList.length) {
        currentModalIndex = newIndex;
        const wellKey = modalNavigationList[currentModalIndex].wellKey;
        // console.log(`Navigating to well: ${wellKey}, index: ${currentModalIndex}`);
        
        // Update modal content (chart and details)
        updateModalContent(wellKey);
        updateNavigationButtons();
    }
}

function updateModalDetails(wellResult) {
    const modalDetails = document.getElementById('modalDetails');
    
    // Extract well ID - always prioritize current modal well key
    let wellId = 'Unknown';
    
    // Extract Well ID from the current modal well key (set in updateModalContent)
    if (window.currentModalWellKey) {
        wellId = window.currentModalWellKey.split('_')[0];
    }
    // If no modal key, try wellResult.well_id
    else if (wellResult.well_id && wellResult.well_id !== 'Unknown') {
        if (wellResult.well_id.includes('_')) {
            wellId = wellResult.well_id.split('_')[0];
        } else {
            wellId = wellResult.well_id;
        }
    }
    // Final fallback: extract from the first available well key in currentAnalysisResults
    else if (wellId === 'Unknown' && currentAnalysisResults && currentAnalysisResults.individual_results) {
        // Find the well key that matches this result by fluorophore
        const fluorophore = wellResult.fluorophore;
        for (const [key, result] of Object.entries(currentAnalysisResults.individual_results)) {
            if (result === wellResult || (result.fluorophore === fluorophore && 
                result.amplitude === wellResult.amplitude && 
                result.r2_score === wellResult.r2_score)) {
                wellId = key.split('_')[0];
                break;
            }
        }
    }
    
    // console.log('Well ID extraction debug:', {
        // modalWellKey: window.currentModalWellKey,
        // wellResultId: wellResult.well_id,
        // extractedWellId: wellId
    // });
    
    const fluorophore = wellResult.fluorophore || 'Unknown';
    const sampleName = wellResult.sample || wellResult.sample_name || 'N/A';
    const amplitude = wellResult.amplitude || 0;
    
    // Get pathogen target for this fluorophore - use session data if available
    let experimentPattern = getCurrentFullPattern();
    if (!experimentPattern && window.currentSessionData && window.currentSessionData.filename) {
        experimentPattern = window.currentSessionData.filename;
    }
    const testCode = extractTestCode(experimentPattern);
    const pathogenTarget = getPathogenTarget(testCode, fluorophore);
    
    // console.log('Modal details debug:', {
        // wellId,
        // fluorophore,
        // testCode,
        // pathogenTarget,
        // experimentPattern
    // });
    
    // Determine result classification
    let resultClass = 'modal-result-redo';
    let resultText = 'REDO';
    
    // Check for anomalies
    let hasAnomalies = false;
    if (wellResult.anomalies) {
        try {
            const anomalies = typeof wellResult.anomalies === 'string' ? 
                JSON.parse(wellResult.anomalies) : wellResult.anomalies;
            hasAnomalies = Array.isArray(anomalies) && anomalies.length > 0 && 
                          !(anomalies.length === 1 && anomalies[0] === 'None');
        } catch (e) {
            hasAnomalies = true;
        }
    }
    
    // POS/NEG/REDO strict criteria (match table):
    const isGoodSCurve = wellResult.is_good_scurve || false;
    const cqValue = wellResult.cq_value;
    if (amplitude < 400 || !isGoodSCurve || isNaN(Number(cqValue))) {
        resultClass = 'modal-result-neg';
        resultText = 'NEG';
    } else if (isGoodSCurve && amplitude > 500 && !hasAnomalies) {
        resultClass = 'modal-result-pos';
        resultText = 'POS';
    } else {
        resultClass = 'modal-result-redo';
        resultText = 'REDO';
    }
    
    modalDetails.innerHTML = `
        <h4>Sample Details</h4>
        <div class="modal-parameter-grid">
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Well ID:</span>
                <span class="modal-parameter-value">${wellId}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Sample:</span>
                <span class="modal-parameter-value">${sampleName}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Pathogen:</span>
                <span class="modal-parameter-value">${pathogenTarget !== 'Unknown' ? `${pathogenTarget} (${fluorophore})` : fluorophore}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Result:</span>
                <span class="modal-result-badge ${resultClass}">${resultText}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">R² Score:</span>
                <span class="modal-parameter-value">${(wellResult.r2_score || 0).toFixed(4)}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">RMSE:</span>
                <span class="modal-parameter-value">${(wellResult.rmse || 0).toFixed(2)}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Amplitude:</span>
                <span class="modal-parameter-value">${amplitude.toFixed(2)}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Steepness:</span>
                <span class="modal-parameter-value">${(wellResult.steepness || 0).toFixed(3)}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Midpoint:</span>
                <span class="modal-parameter-value">${(wellResult.midpoint || 0).toFixed(2)}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Baseline:</span>
                <span class="modal-parameter-value">${(wellResult.baseline || 0).toFixed(2)}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Cq Value:</span>
                <span class="modal-parameter-value">${wellResult.cq_value ? wellResult.cq_value.toFixed(2) : 'N/A'}</span>
            </div>
        </div>
    `;
}

function createModalChart(wellKey, wellData) {
    const ctx = document.getElementById('modalChart').getContext('2d');
    
    // Destroy existing modal chart
    if (modalChart) {
        modalChart.destroy();
    }
    
    // Parse raw data
    let cycles, rfu;
    try {
        cycles = typeof wellData.raw_cycles === 'string' ? 
            JSON.parse(wellData.raw_cycles) : wellData.raw_cycles;
        rfu = typeof wellData.raw_rfu === 'string' ? 
            JSON.parse(wellData.raw_rfu) : wellData.raw_rfu;
    } catch (e) {
        // console.error('Error parsing well data for modal:', e);
        return;
    }
    
    // Parse fitted curve data if available
    let fitData = [];
    if (wellData.fitted_curve) {
        try {
            const fittedCurve = typeof wellData.fitted_curve === 'string' ? 
                JSON.parse(wellData.fitted_curve) : wellData.fitted_curve;
            
            if (Array.isArray(fittedCurve) && fittedCurve.length > 0) {
                fitData = fittedCurve.map((rfuValue, index) => ({
                    x: cycles[index],
                    y: rfuValue
                }));
            }
        } catch (e) {
            // console.error('Error parsing fitted curve data for modal:', e);
        }
    }
    
    const wellId = wellData.well_id || wellKey.split('_')[0];
    const fluorophore = wellData.fluorophore || 'Unknown';
    
    const datasets = [
        {
            label: `${wellId} (${fluorophore}) - Raw Data`,
            data: cycles.map((cycle, index) => ({
                x: cycle,
                y: rfu[index]
            })),
            backgroundColor: 'rgba(52, 152, 219, 0.8)',
            borderColor: 'rgba(41, 128, 185, 1)',
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            showLine: false,
            pointStyle: 'circle'
        }
    ];
    
    if (fitData.length > 0) {
        datasets.push({
            label: `${wellId} (${fluorophore}) - Fitted Curve`,
            data: fitData,
            backgroundColor: 'rgba(231, 76, 60, 0.3)',
            borderColor: 'rgba(192, 57, 43, 1)',
            borderWidth: 3,
            pointRadius: 0,
            showLine: true,
            tension: 0.4
        });
    }
    
    // Prepare annotation for channel-based threshold
    let annotation = undefined;
    if (wellData && wellData.fluorophore) {
        const threshold = getCurrentChannelThreshold(wellData.fluorophore, currentScaleMode);
        if (threshold != null && !isNaN(threshold)) {
            annotation = {
                annotations: {
                    threshold: {
                        type: 'line',
                        yMin: threshold,
                        yMax: threshold,
                        borderColor: getFluorophoreColor(wellData.fluorophore),
                        borderWidth: 2,
                        borderDash: [5, 5],
                        label: {
                            display: true,
                            content: `${wellData.fluorophore} threshold: ${threshold.toFixed(2)}`,
                            color: getFluorophoreColor(wellData.fluorophore),
                            backgroundColor: 'rgba(255,255,255,0.8)',
                            position: 'start',
                            font: { size: 10, weight: 'bold' }
                        }
                    }
                }
            };
        }
    }
    modalChart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                // title: {
                //     display: true,
                //     text: `qPCR Amplification Curve - ${wellId} (${fluorophore})`,
                //     font: { size: 16, weight: 'bold' }
                // },
                legend: {
                    display: true,
                    position: 'top'
                },
                ...(annotation ? { annotation } : {})
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: 'Cycle Number',
                        font: { size: 14, weight: 'bold' }
                    },
                    grid: { color: 'rgba(0,0,0,0.1)' }
                },
                y: {
                    title: { 
                        display: true, 
                        text: 'RFU (Relative Fluorescence Units)',
                        font: { size: 14, weight: 'bold' }
                    },
                    grid: { color: 'rgba(0,0,0,0.1)' }
                }
            }
        }
    });
}

function populateModalDetails(wellKey, wellData) {
    const modalDetails = document.getElementById('modalDetails');
    
    const wellId = wellData.well_id || wellKey.split('_')[0];
    const fluorophore = wellData.fluorophore || 'Unknown';
    const sampleName = wellData.sample || wellData.sample_name || 'N/A';
    const amplitude = wellData.amplitude || 0;
    
    // Determine result classification
    let resultClass = 'modal-result-redo';
    let resultText = 'REDO';
    
    // Result classification is handled by the enhanced criteria above in lines 5561-5567
    // This ensures POS requires good S-curve + amplitude > 500 + no anomalies
    
    // Parse anomalies
    let anomaliesText = 'None';
    if (wellData.anomalies) {
        try {
            const anomalies = typeof wellData.anomalies === 'string' ? 
                JSON.parse(wellData.anomalies) : wellData.anomalies;
            anomaliesText = Array.isArray(anomalies) && anomalies.length > 0 ? 
                anomalies.join(', ') : 'None';
        } catch (e) {
            anomaliesText = 'Parse Error';
        }
    }
    
    modalDetails.innerHTML = `
        <h4>Sample Details</h4>
        <div class="modal-parameter-grid">
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Well:</span>
                <span class="modal-parameter-value">${wellId}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Sample:</span>
                <span class="modal-parameter-value">${sampleName}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Fluorophore:</span>
                <span class="modal-parameter-value">${fluorophore}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Result:</span>
                <span class="modal-result-badge ${resultClass}">${resultText}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">R² Score:</span>
                <span class="modal-parameter-value">${wellData.r2_score ? wellData.r2_score.toFixed(4) : 'N/A'}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">RMSE:</span>
                <span class="modal-parameter-value">${wellData.rmse ? wellData.rmse.toFixed(2) : 'N/A'}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Amplitude:</span>
                <span class="modal-parameter-value">${wellData.amplitude ? wellData.amplitude.toFixed(1) : 'N/A'}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Steepness:</span>
                <span class="modal-parameter-value">${wellData.steepness ? wellData.steepness.toFixed(3) : 'N/A'}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Midpoint:</span>
                <span class="modal-parameter-value">${wellData.midpoint ? wellData.midpoint.toFixed(1) : 'N/A'}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Baseline:</span>
                <span class="modal-parameter-value">${wellData.baseline ? wellData.baseline.toFixed(1) : 'N/A'}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Cq Value:</span>
                <span class="modal-parameter-value">${wellData.cq_value !== null && wellData.cq_value !== undefined ? wellData.cq_value.toFixed(2) : 'N/A'}</span>
            </div>
            <div class="modal-parameter-item">
                <span class="modal-parameter-label">Anomalies:</span>
                <span class="modal-parameter-value">${anomaliesText}</span>
            </div>
        </div>
    `;
}

function closeModal() {
    const modal = document.getElementById('chartModal');
    modal.style.display = 'none';
    
    // Destroy modal chart
    if (modalChart) {
        modalChart.destroy();
        modalChart = null;
    }
}

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // File upload event listeners
    const fileInput = document.getElementById('fileInput');
    const samplesInput = document.getElementById('samplesInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    
    if (fileInput) {
        // console.log('🔍 FILE-INPUT - Setting up file input event listener');
        fileInput.addEventListener('change', function(e) {
            // console.log('🔍 FILE-INPUT - File input change event triggered', e.target.files);
            if (e.target.files.length > 0) {
                // console.log(`🔍 FILE-INPUT - Processing ${e.target.files.length} files`);
                for (let i = 0; i < e.target.files.length; i++) {
                    // console.log(`🔍 FILE-INPUT - Processing file ${i + 1}: ${e.target.files[i].name}`);
                    handleFileUpload(e.target.files[i], 'amplification');
                }
            } else {
                // console.warn('🔍 FILE-INPUT - No files selected');
            }
        });
    } else {
        // console.error('🔍 FILE-INPUT - fileInput element not found!');
    }
    
    if (samplesInput) {
        // console.log('🔍 SAMPLES-INPUT - Setting up samples input event listener');
        samplesInput.addEventListener('change', function(e) {
            // console.log('🔍 SAMPLES-INPUT - Samples input change event triggered', e.target.files);
            if (e.target.files.length > 0) {
                // console.log(`🔍 SAMPLES-INPUT - Processing samples file: ${e.target.files[0].name}`);
                handleFileUpload(e.target.files[0], 'samples');
            } else {
                // console.warn('🔍 SAMPLES-INPUT - No samples file selected');
            }
        });
    } else {
        // console.error('🔍 SAMPLES-INPUT - samplesInput element not found!');
    }
    
    // Analysis button event listener (removing duplicate - already handled above)
    // if (analyzeBtn) {
    //     analyzeBtn.addEventListener('click', performAnalysis);
    // }
    
    // Drag and drop functionality
    const fileUpload = document.getElementById('fileUpload');
    if (fileUpload) {
        fileUpload.addEventListener('dragover', function(e) {
            e.preventDefault();
            fileUpload.classList.add('dragover');
        });
        
        fileUpload.addEventListener('dragleave', function() {
            fileUpload.classList.remove('dragover');
        });
        
        fileUpload.addEventListener('drop', function(e) {
            e.preventDefault();
            fileUpload.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    handleFileUpload(files[i], 'amplification');
                }
            }
        });
    }
    
    // Modal close button
    const modalClose = document.getElementById('modalClose');
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }
    
    // Modal navigation buttons
    const modalPrevBtn = document.getElementById('modalPrevBtn');
    if (modalPrevBtn) {
        modalPrevBtn.addEventListener('click', function() {
            navigateModal(-1);
        });
    }
    
    const modalNextBtn = document.getElementById('modalNextBtn');
    if (modalNextBtn) {
        modalNextBtn.addEventListener('click', function() {
            navigateModal(1);
        });
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('chartModal');
    if (modal) {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeModal();
            }
        });
    }
    
    // Add keyboard navigation for modal
    document.addEventListener('keydown', function(event) {
        const modal = document.getElementById('chartModal');
        if (modal && modal.style.display === 'flex') {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                navigateModal(-1);
            } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                navigateModal(1);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                closeModal();
            }
        }
    });
    
    // Initialize cache clearing and load sessions
    clearCachedData();
    loadAnalysisHistoryOnly(); // Modified to not auto-load session data
});

// Display combined session results
async function displaySessionResults(session) {
    // console.log('Loading session results:', session);
    
    // Check if this is a combined session or individual session
    if (!session.session_ids) {
        // This is an individual session from database - delegate to loadSessionDetails
        // console.log('Individual session detected, redirecting to loadSessionDetails');
        await loadSessionDetails(session.id);
        return;
    }
    
    // console.log('Combined session detected with IDs:', session.session_ids);
    
    try {
        // Fetch data from all constituent sessions
        const sessionPromises = session.session_ids.map(id => 
            fetch(`/sessions/${id}`).then(response => response.json())
        );
        
        const sessionDataArray = await Promise.all(sessionPromises);
        // console.log("Loaded individual session data for combination:", sessionDataArray);
        // Process combined session data
        processCombinedSessionData(sessionDataArray);
        
    } catch (error) {
        // console.error("Error loading combined session:", error);
        showErrorMessage("Failed to load combined session data");
    }
}

function processCombinedSessionData(sessionDataArray) {
    // console.log("Processing combined session data...");
    
    if (!sessionDataArray || sessionDataArray.length === 0) {
        // console.error('No session data provided to processCombinedSessionData');
        return;
    }
    
    // Combine all well results from all sessions
    const combinedIndividualResults = {};
    let totalWells = 0;
    let goodCurves = 0;
    const allFluorophores = new Set();
    
    sessionDataArray.forEach((sessionData, sessionIndex) => {
        if (!sessionData.session || !sessionData.wells) {
            // console.warn(`Session ${sessionIndex} has missing data:`, sessionData);
            return;
        }
        
        const session = sessionData.session;
        const wells = sessionData.wells;
        
        // console.log(`Processing session ${session.id}: ${wells.length} wells`);
        
        wells.forEach((well, wellIndex) => {
            totalWells++;
            
            // Enhanced fluorophore detection for combined sessions
            let fluorophore = 'Unknown';
            let baseWellId = well.well_id;
            
            // Method 1: Extract from well_id if it contains fluorophore suffix (A1_Cy5)
            if (well.well_id.includes('_')) {
                const parts = well.well_id.split('_');
                baseWellId = parts[0];
                const possibleFluorophore = parts[1];
                if (['Cy5', 'FAM', 'HEX', 'Texas Red'].includes(possibleFluorophore)) {
                    fluorophore = possibleFluorophore;
                }
            }
            
            // Method 2: Try to get from well.fluorophore field
            if (fluorophore === 'Unknown' && well.fluorophore && well.fluorophore !== 'Unknown') {
                fluorophore = well.fluorophore;
            }
            
            // Method 3: Extract from session filename pattern
            if (fluorophore === 'Unknown') {
                fluorophore = detectFluorophoreFromFilename(session.filename);
            }
            
            // Track all fluorophores found
            if (fluorophore !== 'Unknown') {
                allFluorophores.add(fluorophore);
            }
            
            // Count good curves
            if (well.is_good_scurve) {
                goodCurves++;
            }
            
            const wellKey = well.well_id; // Use the full well_id as stored in database
            
            // Debug first few wells from each session
            if (wellIndex < 2) {
                // console.log(`Combined session well ${well.well_id} from session ${session.id}:`, {
                    // fluorophore: fluorophore,
                    // baseWellId: baseWellId,
                    // amplitude: well.amplitude,
                    // is_good_scurve: well.is_good_scurve,
                    // sample_name: well.sample_name
                // });
            }
            
            // Transform well data into expected format
            combinedIndividualResults[wellKey] = {
                curve_classification: well.curve_classification || 'N/A',
                well_id: baseWellId,
                fluorophore: fluorophore,
                is_good_scurve: well.is_good_scurve,
                // Ensure numeric values are properly converted from database strings
                r2_score: parseFloat(well.r2_score) || 0,
                rmse: parseFloat(well.rmse) || 0,
                amplitude: parseFloat(well.amplitude) || 0,
                steepness: parseFloat(well.steepness) || 0,
                midpoint: parseFloat(well.midpoint) || 0,
                baseline: parseFloat(well.baseline) || 0,
                data_points: parseInt(well.data_points) || 0,
                cycle_range: well.cycle_range,
                sample: well.sample_name,
                sample_name: well.sample_name,
                cq_value: well.cq_value ? parseFloat(well.cq_value) : null,
                
                // Parse complex fields
                anomalies: (() => {
                    try {
                        if (Array.isArray(well.anomalies)) {
                            return well.anomalies;
                        }
                        const anomaliesStr = well.anomalies || '[]';
                        return JSON.parse(anomaliesStr);
                    } catch (e) {
                        // console.warn('Failed to parse anomalies for well', well.well_id, ':', e);
                        return [];
                    }
                })(),
                fitted_curve: Array.isArray(well.fitted_curve) ? 
                    well.fitted_curve.map(val => parseFloat(val) || 0) : (() => {
                    try {
                        const parsed = JSON.parse(well.fitted_curve || '[]');
                        return Array.isArray(parsed) ? parsed.map(val => parseFloat(val) || 0) : [];
                    } catch (e) {
                        return [];
                    }
                })(),
                raw_cycles: (() => {
                    if (Array.isArray(well.raw_cycles)) {
                        return well.raw_cycles.map(val => parseFloat(val) || 0);
                    }
                    try {
                        const parsed = JSON.parse(well.raw_cycles || '[]');
                        return Array.isArray(parsed) ? parsed.map(val => parseFloat(val) || 0) : [];
                    } catch (e) {
                        // console.warn('Failed to parse raw_cycles for well', well.well_id, ':', well.raw_cycles);
                        return [];
                    }
                })(),
                raw_rfu: (() => {
                    if (Array.isArray(well.raw_rfu)) {
                        return well.raw_rfu.map(val => parseFloat(val) || 0);
                    }
                    try {
                        const parsed = JSON.parse(well.raw_rfu || '[]');
                        return Array.isArray(parsed) ? parsed.map(val => parseFloat(val) || 0) : [];
                    } catch (e) {
                        // console.warn('Failed to parse raw_rfu for well', well.well_id, ':', well.raw_rfu);
                        return [];
                    }
                })(),
                fit_parameters: typeof well.fit_parameters === 'object' ? well.fit_parameters : (() => {
                    try {
                        return JSON.parse(well.fit_parameters || '{}');
                    } catch (e) {
                        return {};
                    }
                })(),
                parameter_errors: typeof well.parameter_errors === 'object' ? well.parameter_errors : (() => {
                    try {
                        return JSON.parse(well.parameter_errors || '{}');
                    } catch (e) {
                        return {};
                    }
                })(),
                threshold_value: well.threshold_value ? parseFloat(well.threshold_value) : null
            };
        });
    });
    
    // Calculate success rate
    const successRate = totalWells > 0 ? (goodCurves / totalWells) * 100 : 0;
    
    // CRITICAL FIX: Extract experiment pattern from session data for pathogen mapping
    let experimentPattern = 'Unknown Pattern';
    for (const sessionData of sessionDataArray) {
        if (sessionData.session && sessionData.session.filename) {
            const extractedPattern = extractBasePattern(sessionData.session.filename);
            if (extractedPattern && extractedPattern !== 'Unknown Pattern') {
                experimentPattern = extractedPattern;
                // console.log(`🔧 COMBINED SESSION FIX - Extracted experiment pattern: ${experimentPattern} from ${sessionData.session.filename}`);
                break;
            }
        }
    }
    
    // Set global session filename for getCurrentFullPattern()
    window.currentSessionFilename = experimentPattern;
    
    // Debug cycle info from sessions
    // console.log('🔧 CYCLE DEBUG - Session cycle info:', sessionDataArray.map(s => ({
        // filename: s.session.filename,
        // cycle_min: s.session.cycle_min,
        // cycle_max: s.session.cycle_max,
        // cycle_count: s.session.cycle_count
    // })));
    
    // Create combined results structure
    const combinedResults = {
        total_wells: totalWells,
        good_curves: Array.from({length: goodCurves}, (_, i) => `Well_${i+1}`), // Placeholder good curves array
        success_rate: successRate,
        individual_results: combinedIndividualResults,
        fluorophore_count: allFluorophores.size,
        filename: experimentPattern,  // CRITICAL: Set filename for getCurrentFullPattern()
        cycle_info: sessionDataArray.length > 0 ? {
            min: (() => {
                const validMins = sessionDataArray.map(s => s.session.cycle_min).filter(c => c != null && !isNaN(c));
                return validMins.length > 0 ? Math.min(...validMins) : 1;
            })(),
            max: (() => {
                const validMaxs = sessionDataArray.map(s => s.session.cycle_max).filter(c => c != null && !isNaN(c));
                return validMaxs.length > 0 ? Math.max(...validMaxs) : 33;
            })(),
            count: sessionDataArray[0].session.cycle_count || 33
        } : null
    };
    
    // console.log('Combined session processing complete:', {
        // totalWells: totalWells,
        // goodCurves: goodCurves,
        // successRate: successRate.toFixed(1) + '%',
        // fluorophores: Array.from(allFluorophores),
        // wellsCount: Object.keys(combinedIndividualResults).length
    // });
    
    // Set the combined results as current analysis results
    setAnalysisResults(combinedResults, 'combined-session-load');
    
    // CRITICAL: Also set analysisResults for export functionality
    analysisResults = combinedResults;
    
    // IMMEDIATE: Initialize thresholds as soon as combined analysis results are available
    if (window.initializeChannelThresholds) {
        // console.log('🔍 THRESHOLD-INIT - Initializing thresholds immediately after setting combined session results');
        window.initializeChannelThresholds();
        
        // Also immediately update threshold UI elements for history loading
        setTimeout(() => {
            if (window.updateAllChannelThresholds) {
                // console.log('🔍 THRESHOLD-INIT - Updating threshold UI elements for combined session');
                window.updateAllChannelThresholds();
            }
        }, 50);
    }
    
    // Display the combined results
    if (combinedResults.fluorophore_count > 1) {
        displayMultiFluorophoreResults(combinedResults);
    } else {
        displayAnalysisResults(combinedResults);
    }
    
    // Store session data globally for pathogen target extraction
    window.currentSessionData = sessionDataArray;
    
    // console.log('Combined session display completed successfully');
}

// Delete session functions
async function deleteSessionGroup(sessionId, event) {
    // console.log('deleteSessionGroup called with sessionId:', sessionId, 'type:', typeof sessionId);
    
    if (event) {
        event.stopPropagation();
    }
    
    // Find the session to determine if it's combined or individual
    let session = window.currentCombinedSessions?.find(s => s.id === sessionId);
    
    // If not found in combined sessions, it might be an individual session ID (numeric)
    if (!session && !isNaN(sessionId)) {
        // console.log('Processing as individual database session ID:', sessionId);
        // Handle direct database session ID
        if (!confirm('Are you sure you want to delete this analysis session?')) {
            return;
        }
        
        const deleteBtn = event && event.target ? event.target : null;
        if (deleteBtn) deleteBtn.disabled = true;
        
        try {
            // console.log('Making DELETE request to /sessions/' + sessionId);
            const response = await fetch(`/sessions/${sessionId}`, {
                method: 'DELETE'
            });
            
            // console.log('Delete response status:', response.status);
            
            if (response.ok) {
                const result = await response.json().catch(() => ({ message: 'Session deleted' }));
                // console.log('Delete successful:', result);
                alert('Session deleted successfully');
                loadAnalysisHistory();
            } else {
                let errorText = '';
                try {
                    const errorData = await response.json();
                    errorText = errorData.error || 'Unknown error';
                } catch (e) {
                    errorText = `HTTP ${response.status}: ${response.statusText}`;
                }
                // console.error('Delete failed:', errorText);
                alert('Failed to delete session: ' + errorText);
            }
        } catch (error) {
            // console.error('Error deleting session:', error);
            alert('Failed to delete session: ' + error.message);
        } finally {
            if (deleteBtn) deleteBtn.disabled = false;
        }
        return;
    }
    
    if (!session) {
        // console.error('Session not found for ID:', sessionId);
        alert('Session not found. Please refresh and try again.');
        return;
    }
    
    let confirmMessage;
    if (session.is_combined) {
        confirmMessage = `Are you sure you want to delete this multi-fluorophore analysis? This will delete ${session.session_ids.length} individual sessions.`;
    } else {
        confirmMessage = 'Are you sure you want to delete this analysis session?';
    }
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        if (session.is_combined) {
            // Delete all individual sessions that make up the combined session
            const deletePromises = session.session_ids.map(id => 
                fetch(`/sessions/${id}`, { method: 'DELETE' })
            );
            
            const responses = await Promise.all(deletePromises);
            const allSuccessful = responses.every(response => response.ok);
            
            if (allSuccessful) {
                loadAnalysisHistory();
            } else {
                alert('Some sessions could not be deleted. Please try again.');
            }
        } else {
            // Delete single session
            const response = await fetch(`/sessions/${sessionId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                loadAnalysisHistory();
            } else {
                alert('Failed to delete session. Please try again.');
            }
        }
    } catch (error) {
        // console.error('Error deleting session:', error);
        alert('Failed to delete session. Please try again.');
    }
}

// Delete all sessions function
async function deleteAllSessions() {
    // console.log('deleteAllSessions called');
    
    if (!confirm('Are you sure you want to delete all analysis sessions? This action cannot be undone.')) {
        // console.log('User cancelled delete all operation');
        return;
    }
    
    try {
        // console.log('Making DELETE request to /sessions');
        
        // Use the dedicated delete all endpoint
        const response = await fetch('/sessions', {
            method: 'DELETE'
        });
        
        // console.log('Delete all response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            // console.error('Delete all failed:', errorData);
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        // console.log('Delete all sessions result:', result);
        
        // Clear local storage
        localStorage.removeItem('analysisSessions');
        localStorage.removeItem('combinedSessions');
        
        // Clear current analysis
        currentAnalysisResults = null;
        
        // Show success message and reload
        alert(result.message || 'All sessions deleted successfully.');
        window.location.reload();
        
    } catch (error) {
        // console.error('Error deleting all sessions:', error);
        alert('Error deleting sessions: ' + error.message);
    }
}

// Pathogen control grids function
function createPathogenControlGrids(controlsByChannel, testName) {
    // console.log('🔍 PATHOGEN GRIDS - Creating grids for test:', testName);
    // console.log('🔍 PATHOGEN GRIDS - Received controls by channel:', Object.keys(controlsByChannel));
    
    // Use the passed controlsByChannel data directly
    // console.log('🔍 PATHOGEN GRIDS - Extracted controls by channel:', Object.keys(controlsByChannel));
    
    // Organize controls into sets based on grid position
    const organizedControlSets = organizeControlsIntoSets(controlsByChannel);
    
    // Update existing CSS grid with real coordinates
    setTimeout(() => {
        updateControlGridWithRealCoordinates(organizedControlSets);
    }, 500); // Small delay to ensure grids are rendered
    
    // console.log('🔍 PATHOGEN GRIDS - Real control extraction complete');
}

function showPathogenGrid(tabIndex) {
    // Hide all tabs
    for (let i = 0; i < window.pathogenTabCount; i++) {
        const tabButton = document.querySelector(`.pathogen-tab-button:nth-child(${i + 1})`);
        const tabContent = document.getElementById(`pathogen-tab-${i}`);
        
        if (tabButton) tabButton.classList.remove('active');
        if (tabContent) tabContent.classList.remove('active');
    }
    
    // Show selected tab
    const activeButton = document.querySelector(`.pathogen-tab-button:nth-child(${tabIndex + 1})`);
    const activeContent = document.getElementById(`pathogen-tab-${tabIndex}`);
    
    if (activeButton) activeButton.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
}

// Global function availability for external modules
window.handleThresholdStrategyChange = handleThresholdStrategyChange;
window.updateAppState = updateAppState;
window.syncUIElements = syncUIElements;

// Make deleteAllSessions globally available
window.deleteAllSessions = deleteAllSessions;
window.deleteSessionGroup = deleteSessionGroup;
window.createPathogenControlGrids = createPathogenControlGrids;
window.showPathogenGrid = showPathogenGrid;
