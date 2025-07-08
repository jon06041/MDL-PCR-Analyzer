// ======================================
// HYBRID SCRIPT: PATTERN RECOGNITION + SMART CONTAMINATION PREVENTION (MERGED)
// ======================================
// This file merges the robust clearing/contamination prevention logic from script.js
// with the working baseline of 'this works but isnt perfect script.js'.
// No original files are altered. Use this as a reference for line-by-line comparison.

// --- EXPERIMENT-SPECIFIC CHANNEL ISOLATION ---
// (from 'this works but isnt perfect script.js')

function getCurrentExperimentFluorophores() {
    // ...existing code from 'this works but isnt perfect script.js'...
}

function filterWellsForCurrentExperiment(individualResults) {
    // ...existing code from 'this works but isnt perfect script.js'...
}

function isFluorophoreValidForCurrentExperiment(fluorophore) {
    // ...existing code from 'this works but isnt perfect script.js'...
}

function sanitizeWellKey(wellId, fluorophore) {
    // ...existing code from 'this works but isnt perfect script.js'...
}

// --- SMART CONTAMINATION PREVENTION SYSTEM ---
// (robust logic from script.js, merged)


function emergencyReset() {
    console.log('🔄 SMART EMERGENCY RESET - Clearing global state while preserving DB-restorable data');
    // Clear global analysis state (contamination sources)
    currentAnalysisResults = null;
    analysisResults = null;
    // Clear upload file references (these should come from fresh uploads only)
    amplificationFiles = {};
    samplesData = null;
    // Clear UI state that could mix experiments
    currentFilterMode = 'all';
    currentFluorophore = 'all';
    currentChartMode = 'all';
    // Clear temporary calculation variables
    window.currentSessionFilename = null;
    window.currentSessionData = null;
    window.currentExperimentPattern = null;
    // Clear chart instances to prevent data mixing
    if (window.amplificationChart) {
        try {
            if (typeof window.amplificationChart.destroy === 'function') {
                window.amplificationChart.destroy();
            } else {
                console.warn('🔄 Chart destroy method not available, clearing reference only');
            }
        } catch (e) {
            console.warn('🔄 Error destroying chart:', e);
        }
        window.amplificationChart = null;
    }
    // Clear analysis sections
    const analysisSection = document.getElementById('analysisSection');
    if (analysisSection) {
        analysisSection.style.display = 'none';
    }
    // Clear results table
    const resultsTableBody = document.querySelector('#resultsTable tbody');
    if (resultsTableBody) {
        resultsTableBody.innerHTML = '';
    }
    // 🧹 COMPREHENSIVE: Clear fluorophore filter dropdown
    const fluorophoreFilterRow = document.querySelector('#fluorophoreFilterRow');
    if (fluorophoreFilterRow) {
        fluorophoreFilterRow.remove();
    }
    // 🧹 COMPREHENSIVE: Clear pathogen breakdown displays  
    clearPathogenBreakdownDisplay();
    // 🧹 COMPREHENSIVE: Clear control validation alerts
    const controlValidationAlerts = document.getElementById('controlValidationAlerts');
    if (controlValidationAlerts) {
        controlValidationAlerts.innerHTML = '';
        controlValidationAlerts.style.display = 'none';
    }
    // 🧹 COMPREHENSIVE: Clear pathogen control grids
    const pathogenControlsContainer = document.getElementById('pathogenControlsContainer');
    if (pathogenControlsContainer) {
        pathogenControlsContainer.innerHTML = '';
        pathogenControlsContainer.style.display = 'none';
    }
    // 🧹 COMPREHENSIVE: Clear pathogen grids section
    const pathogenGridsSection = document.getElementById('pathogen-grids-section');
    if (pathogenGridsSection) {
        pathogenGridsSection.innerHTML = '';
        pathogenGridsSection.style.display = 'none';
    }
    // 🧹 COMPREHENSIVE: Clear control validation grid
    const controlValidationGrid = document.getElementById('controlValidationGrid');
    if (controlValidationGrid) {
        controlValidationGrid.innerHTML = '';
        controlValidationGrid.style.display = 'none';
    }
    // 🧹 COMPREHENSIVE: Clear summary statistics
    const summaryElements = [
        'experimentPattern', 'totalPositive', 'positivePercentage', 'cycleRangeResult',
        'wellsAnalysisTitle', 'patientControlStats', 'controlStats'
    ];
    summaryElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = '';
        }
    });
    // 🧹 COMPREHENSIVE: Clear fluorophore breakdown displays
    const fluorophoreBreakdown = document.getElementById('fluorophoreBreakdown');
    if (fluorophoreBreakdown) {
        fluorophoreBreakdown.innerHTML = '';
        fluorophoreBreakdown.style.display = 'none';
    }
    // 🧹 COMPREHENSIVE: Reset any active filters
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.value = 'all';
    }
    // NOTE: We DO NOT clear window.stableChannelThresholds here
    // These will be restored from database when loading history
    console.log('✅ Emergency reset complete - ready for fresh analysis or DB-driven history load');
}


function smartClearForHistoryLoad(sessionData) {
    console.log('🧹 SMART CLEAR - Preparing for history load with DB restoration');
    // Standard contamination clearing
    emergencyReset();
    // Restore critical data from database
    if (sessionData && sessionData.session) {
        window.currentSessionFilename = sessionData.session.filename;
        window.currentExperimentPattern = extractBasePattern(sessionData.session.filename);
        console.log('🔄 Restored from DB:', {
            filename: window.currentSessionFilename,
            pattern: window.currentExperimentPattern
        });
    }
    // Restore thresholds from database wells
    if (sessionData && sessionData.wells && sessionData.wells.length > 0) {
        restoreThresholdsFromDatabase(sessionData.wells);
    }
}


function restoreThresholdsFromDatabase(wells) {
    console.log('🔄 RESTORING THRESHOLDS from database');
    if (!window.stableChannelThresholds) {
        window.stableChannelThresholds = {};
    }
    const thresholdsByChannel = {};
    // Extract thresholds from database wells
    wells.forEach(well => {
        if (well.threshold_value && well.fluorophore) {
            const channel = well.fluorophore;
            let thresholds = {};
            if (typeof well.threshold_value === 'string') {
                try {
                    thresholds = JSON.parse(well.threshold_value);
                } catch (e) {
                    thresholds = { linear: parseFloat(well.threshold_value) };
                }
            } else if (typeof well.threshold_value === 'object') {
                thresholds = well.threshold_value;
            }
            if (!thresholdsByChannel[channel]) {
                thresholdsByChannel[channel] = {};
            }
            if (thresholds.linear !== undefined) {
                thresholdsByChannel[channel].linear = thresholds.linear;
            }
            if (thresholds.log !== undefined) {
                thresholdsByChannel[channel].log = thresholds.log;
            }
        }
    });
    // Apply restored thresholds to global state
    Object.entries(thresholdsByChannel).forEach(([channel, thresholds]) => {
        if (!window.stableChannelThresholds[channel]) {
            window.stableChannelThresholds[channel] = {};
        }
        window.stableChannelThresholds[channel] = {
            ...window.stableChannelThresholds[channel],
            ...thresholds
        };
        console.log(`✅ Restored thresholds for ${channel}:`, window.stableChannelThresholds[channel]);
    });
    // Save to sessionStorage for persistence
    try {
        sessionStorage.setItem('stableChannelThresholds', JSON.stringify(window.stableChannelThresholds));
        console.log('💾 Saved restored thresholds to sessionStorage');
    } catch (e) {
        console.warn('Failed to save thresholds to sessionStorage:', e);
    }
}


function setAnalysisResults(newResults, source = 'unknown') {
    console.log(`🛡️ SAFE SET ANALYSIS RESULTS from: ${source}`);
    if (!newResults || typeof newResults !== 'object') {
        console.warn('Invalid results passed to setAnalysisResults:', newResults);
        return;
    }
    if (source.includes('history') || source.includes('session')) {
        console.log('📚 History load detected - results should have been restored from DB');
    }
    currentAnalysisResults = { ...newResults };
    analysisResults = { ...newResults };
    console.log('✅ Analysis results set safely with source:', source);
}


function displayHistorySession(sessionResults, source = 'history-display') {
    console.log(`🛡️ DISPLAY HISTORY SESSION from: ${source}`);
    if (sessionResults && sessionResults.individual_results) {
        setAnalysisResults(sessionResults, source);
        if (typeof displayAnalysisResults === 'function') {
            displayAnalysisResults(sessionResults);
        }
        const analysisSection = document.getElementById('analysisSection');
        if (analysisSection) {
            analysisSection.style.display = 'block';
        }
        console.log('📊 History session displayed successfully');
    } else {
        console.warn('Invalid session results structure:', sessionResults);
    }
}


function clearPathogenBreakdownDisplay() {
    const pathogenBreakdownSection = document.querySelector('.pathogen-breakdown-section');
    if (pathogenBreakdownSection) {
        pathogenBreakdownSection.innerHTML = '';
    }
    const pendingChannelSection = document.querySelector('#pendingChannelRequirements');
    if (pendingChannelSection) {
        pendingChannelSection.innerHTML = '';
    }
    const channelStatusSection = document.querySelector('#channelCompletionStatus');
    if (channelStatusSection) {
        channelStatusSection.innerHTML = '';
    }
}

// --- REMAINDER OF WORKING BASELINE CODE ---
// (from 'this works but isnt perfect script.js')

// ...existing code from 'this works but isnt perfect script.js'...

// --- END OF MERGED FILE ---
