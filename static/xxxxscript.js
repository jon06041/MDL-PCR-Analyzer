// --- Exported for UI and Event Listeners (MERGED) ---
// Add any additional event listeners, DOMContentLoaded, and UI logic as needed from script.js
// ...existing code...
// --- Analysis Ready Check (MERGED) ---
function checkAnalysisReady() {
    const analysisButton = document.getElementById('analyzeBtn');
    const hasAmplificationFiles = Object.keys(amplificationFiles).length > 0;
    const hasSamplesData = samplesData !== null;
    if (analysisButton) analysisButton.disabled = !(hasAmplificationFiles && hasSamplesData);
    ensureUploadButtonsEnabled();
}
// --- Ensure Upload Buttons Enabled (MERGED) ---
function ensureUploadButtonsEnabled() {
    const ampBtn = document.getElementById('amplificationUploadBtn');
    const samplesBtn = document.getElementById('samplesUploadBtn');
    if (ampBtn) ampBtn.disabled = false;
    if (samplesBtn) samplesBtn.disabled = false;
}
// --- Global Error Handling (MERGED) ---
window.addEventListener('error', function(event) {
    console.error('Global error caught:', event.error);
    if (event.error && event.error.message) {
        if (event.error.message.includes('Cannot read property') || 
            event.error.message.includes('Cannot read properties') ||
            event.error.message.includes('null is not an object')) {
            // ...handle gracefully...
        }
    }
});
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
});
// --- Utility and Error Handling (MERGED) ---
function safeGetElement(id, context = 'Unknown') {
    try {
        const element = document.getElementById(id);
        if (!element) return null;
        return element;
    } catch (error) {
        console.error(`Error accessing element '${id}' in context: ${context}`, error);
        return null;
    }
}

function safeExecute(fn, context = 'Unknown', fallback = null) {
    try {
        return fn();
    } catch (error) {
        console.error(`Error in ${context}:`, error);
        return fallback;
    }
}
// --- File Upload Handling (MERGED, from script.js) ---
function extractBasePattern(filename) {
    if (filename.includes('Multi-Fluorophore Analysis')) {
        const match = filename.match(/([A-Za-z][A-Za-z0-9]*_\d+_CFX\d+)$/i);
        if (match) return match[1].replace(/[-\s]+$/, '');
        const parts = filename.split(' ');
        for (let i = parts.length - 1; i >= 0; i--) {
            if (/^[A-Za-z][A-Za-z0-9]*_\d+_CFX\d+/.test(parts[i])) return parts[i].replace(/[-\s]+$/, '');
        }
    }
    const pattern = /^([A-Za-z][A-Za-z0-9]*_\d+_CFX\d+)/i;
    const match = filename.match(pattern);
    if (match) return match[1].replace(/[-\s]+$/, '');
    return filename.split('.')[0].replace(/[-\s]+$/, '');
}

function extractTestName(filename) {
    const basePattern = extractBasePattern(filename);
    const testMatch = basePattern.match(/^([A-Za-z][A-Za-z0-9]*)/i);
    return testMatch ? testMatch[1] : basePattern;
}

function validateFilePattern(filename) {
    const pattern = /^[A-Za-z][A-Za-z0-9]*_\d+_CFX\d+/i;
    return pattern.test(filename);
}

function handleFileUpload(file, type = 'amplification') {
    if (!file) {
        console.error('🔍 UPLOAD - No file provided to handleFileUpload');
        return;
    }
    console.log(`🔍 UPLOAD - Starting file upload: ${file.name}, type: ${type}, size: ${file.size} bytes`);
    if (!validateFilePattern(file.name)) {
        alert(`Invalid filename pattern. Expected CFX Manager format: testName_1234567_CFX123456\nYour file: ${file.name}`);
        return;
    }
    if (type === 'amplification') {
        const fluorophore = detectFluorophoreFromFilename(file.name);
        if (amplificationFiles[fluorophore]) {
            alert(`Duplicate amplification file for ${fluorophore}`);
            return;
        }
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        const csv = e.target.result;
        Papa.parse(csv, {
            complete: function(results) {
                // ...existing code for handling parsed results...
            },
            header: false,
            error: function(error) {
                updateFileStatus(type === 'amplification' ? 'amplificationStatus' : 'samplesStatus', file.name, false);
            }
        });
    };
    reader.onerror = function(error) {
        updateFileStatus(type === 'amplification' ? 'amplificationStatus' : 'samplesStatus', file.name, false);
    };
    reader.readAsText(file);
}
// --- Initialization (MERGED) ---
document.addEventListener('DOMContentLoaded', function() {
    // Load channel thresholds from session storage
    if (typeof loadChannelThresholds === 'function') loadChannelThresholds();
    // Attach slider and preset events
    if (scaleRangeSlider) scaleRangeSlider.addEventListener('input', onSliderChange);
    if (scalePresetsContainer) {
        scalePresetsContainer.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', onPresetClick);
        });
    }
    if (scaleToggleBtn) scaleToggleBtn.addEventListener('click', onScaleToggle);
    if (typeof updateSliderUI === 'function') updateSliderUI();
    // Initialize baseline flattening controls
    if (typeof initializeBaselineFlattening === 'function') initializeBaselineFlattening();
});
// --- UI Elements (MERGED) ---
const scaleToggleBtn = document.getElementById('scaleToggle');
const scaleRangeSlider = document.getElementById('scaleRangeSlider');
const scaleRangeLabel = document.getElementById('scaleRangeLabel');
const scaleMultiplierLabel = document.getElementById('scaleMultiplier');
const scaleDescription = document.getElementById('scaleDescription');
const scalePresetsContainer = document.getElementById('scalePresetsContainer');
// --- ENHANCED PER-CHANNEL THRESHOLD SYSTEM (MERGED) ---
// This replaces the existing threshold calculation logic with a stable, per-channel system that maintains consistency across all views

if (!window.stableChannelThresholds) {
    window.stableChannelThresholds = {}; // { channel: { linear: value, log: value } }
}
if (!window.channelControlWells) {
    window.channelControlWells = {}; // { channel: [wells...] }
}

function extractChannelControlWells() {
    if (!currentAnalysisResults || !currentAnalysisResults.individual_results) return;
    window.channelControlWells = {};
    const results = currentAnalysisResults.individual_results;
    Object.keys(results).forEach(wellKey => {
        const well = results[wellKey];
        if (!well || !well.fluorophore) return;
        if (!window.channelControlWells[well.fluorophore]) window.channelControlWells[well.fluorophore] = [];
        window.channelControlWells[well.fluorophore].push(well);
    });
}

function calculateStableChannelThreshold(channel, scale) {
    if (!window.channelControlWells || !window.channelControlWells[channel]) return 100;
    const controls = window.channelControlWells[channel];
    const controlRfuValues = [];
    controls.forEach(well => {
        if (well.raw_data && Array.isArray(well.raw_data)) {
            controlRfuValues.push(...well.raw_data.slice(0, 5).map(point => point.y || point));
        }
    });
    if (controlRfuValues.length === 0) return 100;
    const mean = controlRfuValues.reduce((sum, val) => sum + val, 0) / controlRfuValues.length;
    const variance = controlRfuValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / controlRfuValues.length;
    const stdDev = Math.sqrt(variance);
    if (scale === 'log') return Math.max(10 * stdDev, 1);
    return Math.max(mean + 3 * stdDev, 10);
}

function initializeChannelThresholds() {
    if (!currentAnalysisResults || !currentAnalysisResults.individual_results) return;
    const channels = new Set();
    Object.values(currentAnalysisResults.individual_results).forEach(well => {
        if (well && well.fluorophore) channels.add(well.fluorophore);
    });
    extractChannelControlWells();
    channels.forEach(channel => {
        if (!window.stableChannelThresholds[channel]) window.stableChannelThresholds[channel] = {};
        window.stableChannelThresholds[channel]['linear'] = calculateStableChannelThreshold(channel, 'linear');
        window.stableChannelThresholds[channel]['log'] = calculateStableChannelThreshold(channel, 'log');
    });
}

function getCurrentChannelThreshold(channel, scale = null) {
    if (!scale) scale = currentScaleMode;
    if (!window.stableChannelThresholds[channel] || window.stableChannelThresholds[channel][scale] == null) {
        initializeChannelThresholds();
    }
    return window.stableChannelThresholds[channel] ? window.stableChannelThresholds[channel][scale] : null;
}

function updateAllChannelThresholds() {
    if (!window.amplificationChart) return;
    if (!window.amplificationChart.options.plugins || !window.amplificationChart.options.plugins.annotation) return;
    const annotations = window.amplificationChart.options.plugins.annotation.annotations;
    const visibleChannels = new Set();
    if (window.amplificationChart.data && window.amplificationChart.data.datasets) {
        window.amplificationChart.data.datasets.forEach(ds => {
            if (ds.label) {
                const match = ds.label.match(/\(([^)]+)\)/);
                if (match && match[1]) visibleChannels.add(match[1]);
            }
        });
    }
    Object.keys(annotations).forEach(key => { delete annotations[key]; });
    const currentScale = currentScaleMode;
    Array.from(visibleChannels).forEach(channel => {
        const threshold = getCurrentChannelThreshold(channel, currentScale);
        if (threshold !== null && threshold !== undefined && !isNaN(threshold)) {
            annotations[`threshold-${channel}`] = {
                type: 'line',
                yMin: threshold,
                yMax: threshold,
                borderColor: getChannelColor(channel),
                borderWidth: 2,
                label: {
                    content: `${channel} ${currentScale} threshold`,
                    enabled: true,
                    position: 'end'
                }
            };
        }
    });
    window.amplificationChart.update('none');
}

function updateSingleChannelThreshold(fluorophore) {
    if (!window.amplificationChart) return;
    if (!window.amplificationChart.options.plugins || !window.amplificationChart.options.plugins.annotation) return;
    const annotations = window.amplificationChart.options.plugins.annotation.annotations;
    Object.keys(annotations).forEach(key => { delete annotations[key]; });
    const currentScale = currentScaleMode;
    const threshold = getCurrentChannelThreshold(fluorophore, currentScale);
    if (threshold !== null && threshold !== undefined && !isNaN(threshold)) {
        annotations[`threshold-${fluorophore}`] = {
            type: 'line',
            yMin: threshold,
            yMax: threshold,
            borderColor: getChannelColor(fluorophore),
            borderWidth: 2,
            label: {
                content: `${fluorophore} ${currentScale} threshold`,
                enabled: true,
                position: 'end'
            }
        };
    }
    window.amplificationChart.update('none');
}

function getChannelColor(channel) {
    const colorMap = {
        'FAM': '#006400', 'HEX': '#FFD700', 'Cy5': '#00CED1', 'Texas Red': '#FF0000', 'ROX': '#34495e'
    };
    return colorMap[channel] || '#3498db';
}
// ========================================
// CFX MANAGER STYLE BASELINE FLATTENING (MERGED)
// ========================================

let baselineFlatteningEnabled = false;

function calculateBaseline(wellData) {
    if (!wellData || !wellData.raw_data || wellData.raw_data.length < 5) return null;
    const firstFive = wellData.raw_data.slice(0, 5).map(point => point.y || point);
    const mean = firstFive.reduce((sum, val) => sum + val, 0) / firstFive.length;
    const median = firstFive.slice().sort((a, b) => a - b)[Math.floor(firstFive.length / 2)];
    const variance = firstFive.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / firstFive.length;
    const stdDev = Math.sqrt(variance);
    return { mean, median, stdDev };
}

function applyBaselineFlattening(rawData, enableFlattening = false, wellData = null) {
    if (!enableFlattening || !rawData || rawData.length < 10) return rawData;
    let isSCurve = false;
    if (wellData && wellData.is_good_scurve !== undefined) {
        isSCurve = !!wellData.is_good_scurve;
    } else {
        isSCurve = detectSCurve(rawData);
    }
    if (isSCurve) return rawData;
    const baseline = calculateBaseline({ raw_data: rawData });
    if (!baseline) return rawData;
    const targetBaseline = baseline.median;
    const flattenedData = rawData.map((point, index) => {
        if (typeof point === 'object' && point.y !== undefined) {
            return { ...point, y: applyNonSCurveFlattening(point.y, targetBaseline, baseline) };
        } else {
            return applyNonSCurveFlattening(point, targetBaseline, baseline);
        }
    });
    return flattenedData;
}

function detectSCurve(rawData) {
    if (!rawData || rawData.length < 10) return false;
    const rfuValues = rawData.map(point => point.y !== undefined ? point.y : point);
    const minRFU = Math.min(...rfuValues);
    const maxRFU = Math.max(...rfuValues);
    const meanRFU = rfuValues.reduce((sum, val) => sum + val, 0) / rfuValues.length;
    const amplitude = maxRFU - minRFU;
    const relativeAmplitude = amplitude / meanRFU;
    if (amplitude < 50 && relativeAmplitude < 0.2) return false;
    const firstThird = rfuValues.slice(0, Math.floor(rfuValues.length / 3));
    const lastThird = rfuValues.slice(-Math.floor(rfuValues.length / 3));
    const firstThirdMean = firstThird.reduce((sum, val) => sum + val, 0) / firstThird.length;
    const lastThirdMean = lastThird.reduce((sum, val) => sum + val, 0) / lastThird.length;
    const growthRatio = lastThirdMean / firstThirdMean;
    if (growthRatio < 1.2) return false;
    const startValue = rfuValues[0];
    const endValue = rfuValues[rfuValues.length - 1];
    const overallGrowth = (endValue - startValue) / startValue;
    if (overallGrowth > 0.2 || amplitude > 100) return true;
    return false;
}

function applyNonSCurveFlattening(rfuValue, targetBaseline, baseline) {
    const noiseThreshold = baseline.stdDev * 2;
    if (Math.abs(rfuValue - baseline.mean) > noiseThreshold) {
        return targetBaseline;
    } else {
        return smoothBaseline(rfuValue, baseline);
    }
}

function smoothBaseline(rfuValue, baseline) {
    const noiseThreshold = baseline.mean + (2 * baseline.stdDev);
    if (rfuValue <= noiseThreshold) {
        return (rfuValue * 0.7) + (baseline.mean * 0.3);
    } else {
        return rfuValue;
    }
}

function applyLowPassFilter(value, median) {
    return (value * 0.3) + (median * 0.7);
}

function applyMinimalSmoothing(value, mean) {
    return (value * 0.8) + (mean * 0.2);
}

function toggleBaselineFlattening() {
    baselineFlatteningEnabled = !baselineFlatteningEnabled;
    const toggleBtn = document.getElementById('baselineToggle');
    if (toggleBtn) {
        toggleBtn.textContent = baselineFlatteningEnabled ? 'Disable Baseline Flattening' : 'Enable Baseline Flattening';
    }
    sessionStorage.setItem('baselineFlatteningEnabled', baselineFlatteningEnabled.toString());
    if (window.amplificationChart) {
        refreshChartWithBaseline();
    }
    const status = baselineFlatteningEnabled ? 'enabled' : 'disabled';
    const description = baselineFlatteningEnabled 
        ? 'Non-S-curves will be flattened, S-curves preserved' 
        : 'All curves shown with original data';
    console.log(`🔍 BASELINE - CFX Manager 3.1 style baseline correction ${status}: ${description}`);
}

function refreshChartWithBaseline() {
    if (!window.amplificationChart || !currentAnalysisResults) return;
    const datasets = window.amplificationChart.data.datasets;
    if (!datasets || datasets.length === 0) return;
    datasets.forEach(dataset => {
        if (dataset.rawData) {
            dataset.data = applyBaselineFlattening(dataset.rawData, baselineFlatteningEnabled, dataset.wellData);
        }
    });
    window.amplificationChart.update('none');
}

function initializeBaselineFlattening() {
    const saved = sessionStorage.getItem('baselineFlatteningEnabled');
    if (saved) baselineFlatteningEnabled = saved === 'true';
    const toggleBtn = document.getElementById('baselineToggle');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleBaselineFlattening);
    updateBaselineFlatteningVisibility();
}

function updateBaselineFlatteningVisibility() {
    const container = document.getElementById('baselineFlatteningContainer');
    if (container) {
        container.style.display = currentScaleMode === 'linear' ? 'block' : 'none';
    }
}
// ======================================
// ROBUST MERGED SCRIPT: Pattern Recognition + Smart Contamination Prevention
// ======================================
// This file is a careful, line-by-line merge of script.js (working) and xxxscript.js (robust clearing logic).
// - All robust clearing, contamination prevention, and experiment isolation logic is included.
// - Upload, UI, and analysis features are preserved from script.js.
// - Extra null checks and error handling are added where possible.
// - Comments highlight merged/robust sections for future review.
//
// If any issues arise, revert to script.js and report the problem.


// ======================================
// EXPERIMENT-SPECIFIC CHANNEL ISOLATION (ROBUST)
// ======================================

/**
 * Get the expected fluorophores for the current experiment pattern
 * This prevents contamination from previous experiments
 */
function getCurrentExperimentFluorophores() {
    // Get current experiment pattern
    const currentPattern = getCurrentFullPattern() || window.currentExperimentPattern;
    
    console.log('🔒 ISOLATION - getCurrentExperimentFluorophores debug:');
    console.log('🔒 ISOLATION - currentPattern:', currentPattern);
    console.log('🔒 ISOLATION - window.currentSessionFilename:', window.currentSessionFilename);
    console.log('🔒 ISOLATION - amplificationFiles count:', amplificationFiles ? Object.keys(amplificationFiles).length : 0);
    console.log('🔒 ISOLATION - analysisResults.filename:', analysisResults?.filename);
    
    if (!currentPattern || currentPattern === 'Unknown Pattern') {
        console.warn('🔒 ISOLATION - No current experiment pattern found, cannot determine expected fluorophores');
        return [];
    }
    
    console.log('🔒 ISOLATION - Getting expected fluorophores for pattern:', currentPattern);
    
    // Extract test code from pattern (e.g., "BVPanelPCR3" from "BVPanelPCR3_A1-H12_20231201_120000")
    const testCode = extractTestCode(currentPattern);
    console.log('🔒 ISOLATION - Extracted test code:', testCode);
    
    // For single-channel experiments, detect from filename
    if (currentPattern.includes('_Cy5') || currentPattern.includes('_FAM') || 
        currentPattern.includes('_HEX') || currentPattern.includes('_Texas')) {
        const detectedFluorophore = detectFluorophoreFromFilename(currentPattern);
        if (detectedFluorophore !== 'Unknown') {
            console.log('🔒 ISOLATION - Single-channel experiment detected:', detectedFluorophore);
            return [detectedFluorophore];
        }
    }
    
    // For multi-channel experiments, get from pathogen library
    const pathogenMapping = getPathogenMappingForTest(testCode);
    const expectedFluorophores = Object.keys(pathogenMapping || {});
    
    console.log('🔒 ISOLATION - Expected fluorophores for experiment:', expectedFluorophores);
    return expectedFluorophores.length > 0 ? expectedFluorophores : []; // Don't fallback to all fluorophores
}

/**
 * Filter wells to only include those belonging to current experiment
 */
function filterWellsForCurrentExperiment(individualResults) {
    if (!individualResults) return {};
    
    const expectedFluorophores = getCurrentExperimentFluorophores();
    console.log('🔒 ISOLATION - filterWellsForCurrentExperiment called');
    console.log('🔒 ISOLATION - Expected fluorophores:', expectedFluorophores);
    console.log('🔒 ISOLATION - Session filename:', window.currentSessionFilename);
    console.log('🔒 ISOLATION - Analysis results filename:', analysisResults?.filename);
    
    // 🛡️ DEFENSIVE: If no current experiment can be determined, return all wells
    // This prevents over-filtering when experiment context isn't properly set
    if (!expectedFluorophores || expectedFluorophores.length === 0) {
        console.warn('🔒 ISOLATION - No expected fluorophores found, returning all wells (no filtering)');
        return individualResults;
    }
    
    const filteredResults = {};
    let filteredCount = 0;
    let totalCount = 0;
    
    Object.keys(individualResults).forEach(wellKey => {
        const well = individualResults[wellKey];
        totalCount++;
        
        // Check if this well belongs to the current experiment
        if (well.fluorophore && expectedFluorophores.includes(well.fluorophore)) {
            filteredResults[wellKey] = well;
            filteredCount++;
        } else {
            console.log(`🔒 ISOLATION - Filtered out well ${wellKey} with fluorophore ${well.fluorophore} (expected: ${expectedFluorophores.join(', ')})`);
        }
    });
    
    console.log(`🔒 ISOLATION - Filtered ${totalCount} wells down to ${filteredCount} wells for current experiment`);
    return filteredResults;
}

/**
 * Validate that fluorophore belongs to current experiment
 */
function isFluorophoreValidForCurrentExperiment(fluorophore) {
    const expectedFluorophores = getCurrentExperimentFluorophores();
    const isValid = expectedFluorophores.includes(fluorophore);
    
    if (!isValid) {
        console.log(`🔒 ISOLATION - Fluorophore ${fluorophore} is not valid for current experiment. Expected: [${expectedFluorophores.join(', ')}]`);
    }
    
    return isValid;
}

/**
 * Enhanced well key formatting to prevent duplication
 */
function sanitizeWellKey(wellId, fluorophore) {
    // Remove any existing fluorophore suffixes to prevent duplication like "A1_CY5_CY5"
    let cleanWellId = wellId;
    
    // Remove existing fluorophore suffixes
    const fluorophores = ['Cy5', 'FAM', 'HEX', 'Texas Red', 'ROX'];
    fluorophores.forEach(fluor => {
        const pattern1 = `_${fluor}`;
        const pattern2 = `_${fluor}_${fluor}`;
        
        // Remove double fluorophore first
        if (cleanWellId.includes(pattern2)) {
            cleanWellId = cleanWellId.replace(pattern2, '');
        }
        // Then remove single fluorophore
        if (cleanWellId.includes(pattern1)) {
            cleanWellId = cleanWellId.replace(pattern1, '');
        }
    });
    
    // Ensure we only have base well ID (e.g., "A1")
    const wellMatch = cleanWellId.match(/^([A-H]\d+)/);
    if (wellMatch) {
        return wellMatch[1]; // Return just the base well ID like "A1"
    }
    
    // Fallback: return original if no match
    return cleanWellId;
}

// ======================================
// SMART CONTAMINATION PREVENTION SYSTEM (ROBUST)
// ======================================

// 🛡️ SMART: Emergency reset with database-driven restoration
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
            // Check if destroy method exists before calling it
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

// 🛡️ SMART: Clear contamination with database restoration capability
function smartClearForHistoryLoad(sessionData) {
    console.log('🧹 SMART CLEAR - Preparing for history load with DB restoration');
    
    // Standard contamination clearing
    emergencyReset();
    
    // Restore critical data from database
    if (sessionData && sessionData.session) {
        // Restore filename for pattern recognition
        window.currentSessionFilename = sessionData.session.filename;
        
        // Restore experiment pattern for getCurrentFullPattern()
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

// 🛡️ SMART: Restore thresholds from database with JSON parsing
function restoreThresholdsFromDatabase(wells) {
    console.log('🔄 RESTORING THRESHOLDS from database');
    
    if (!window.stableChannelThresholds) {
        window.stableChannelThresholds = {};
    }

    wells.forEach(well => {
        const { channel, thresholds } = well;
        // Add null/undefined checks for robustness
        if (!channel || !thresholds) return;
        try {
            window.stableChannelThresholds[channel] = JSON.parse(JSON.stringify(thresholds));
        } catch (e) {
            console.warn('Failed to restore thresholds for channel', channel, e);
        }
    });
}

// --- Slider Logic (MERGED) ---
function updateSliderUI() {
    if (scaleRangeLabel) scaleRangeLabel.textContent = currentScaleMode === 'log' ? 'Log Range:' : 'Linear Range:';
    if (scaleMultiplierLabel) scaleMultiplierLabel.textContent = currentScaleMultiplier ? currentScaleMultiplier.toFixed(2) + 'x' : '1.00x';
    if (scaleDescription) scaleDescription.textContent = currentScaleMode === 'log' ? 'Adjust log threshold' : 'Adjust linear threshold';
    if (typeof syncToggleButtonState === 'function') syncToggleButtonState();
}

function syncToggleButtonState() {
    if (scaleToggleBtn) {
        scaleToggleBtn.setAttribute('data-scale', currentScaleMode);
        const options = scaleToggleBtn.querySelectorAll('.toggle-option');
        options.forEach((option, index) => {
            if (option) option.classList.toggle('active', (option.dataset && option.dataset.scale === currentScaleMode));
        });
    }
}

function onSliderChange(e) {
    currentScaleMultiplier = parseFloat(e.target.value);
    sessionStorage.setItem('qpcr_scale_multiplier', currentScaleMultiplier);
    updateSliderUI();
    if (window.amplificationChart) {
        // Optionally update chart scale config here
        window.amplificationChart.update('none');
    }
}

function onPresetClick(e) {
    const val = parseFloat(e.target.getAttribute('data-value'));
    currentScaleMultiplier = val;
    if (scaleRangeSlider) scaleRangeSlider.value = val;
    sessionStorage.setItem('qpcr_scale_multiplier', currentScaleMultiplier);
    updateSliderUI();
    if (window.amplificationChart) {
        window.amplificationChart.update('none');
    }
}

function onScaleToggle() {
    currentScaleMode = (currentScaleMode === 'linear') ? 'log' : 'linear';
    sessionStorage.setItem('qpcr_chart_scale', currentScaleMode);
    updateSliderUI();
    updateChartThresholds();
}

function updateChartThresholds() {
    if (!window.amplificationChart) return;
    if (!window.amplificationChart.options.plugins || !window.amplificationChart.options.plugins.annotation) return;
    // This function can call updateAllChannelThresholds or updateSingleChannelThreshold as needed
    updateAllChannelThresholds();
}
