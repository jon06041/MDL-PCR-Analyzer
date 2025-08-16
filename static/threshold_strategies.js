// threshold_strategies.js
// Modular registry of scientific thresholding strategies for qPCR analysis
// Each strategy is a function with a name, description, and reference
// Default strategies are always present for safety

// --- Linear strategies ---
const LINEAR_THRESHOLD_STRATEGIES = {
  "linear_fixed": {
    name: "Linear: Fixed Value (per-pathogen)",
    calculate: ({fixed_value}) => fixed_value,
    description: "User- or pathogen-specific fixed threshold value (loaded from JS or CSV).",
    reference: "Manual or pathogen-specific. See documentation."
  },
  "linear": {
    name: "Baseline + N × baseline_std",
    calculate: ({baseline, baseline_std, N = 10}) => baseline + N * baseline_std,
    description: "Linear threshold, often used for manual review or fallback.",
    reference: "See qPCR_Curve_Classification_Reference.md"
  },
  // Removed duplicate linear_baseline_plus_nsd
  "linear_max_slope": {
    name: "Linear: Max Slope",
    calculate: ({curve, cycles, rfu}) => {
      // Accept either 'curve' or 'rfu' parameter for flexibility
      const data = curve || rfu;
      if (!data || data.length < 3) {
        return null;
      }
      
      // Calculate actual slope (first derivative) at each point
      let maxSlope = -Infinity, maxIdx = 1;
      for (let i = 1; i < data.length - 1; i++) {
        // Calculate slope as (y2 - y1) / (x2 - x1) = (data[i+1] - data[i-1]) / 2
        // Using central difference for more stable derivative calculation
        const slope = (data[i + 1] - data[i - 1]) / 2;
        if (slope > maxSlope) {
          maxSlope = slope;
          maxIdx = i;
        }
      }
      
      // Return the RFU value at the point of maximum slope
      return data[maxIdx];
    },
    description: "Threshold at the point of maximum slope (first derivative) on the linear curve.",
    reference: "See qPCR_Curve_Classification_Reference.md"
  }
};

// --- Log strategies ---
const LOG_THRESHOLD_STRATEGIES = {
  "log_fixed": {
    name: "Log: Fixed Value (per-pathogen)",
    calculate: ({fixed_value}) => fixed_value,
    description: "User- or pathogen-specific fixed threshold value (loaded from JS or CSV).",
    reference: "Manual or pathogen-specific. See documentation."
  },
  "default": {
    name: "Log: Exponential Phase (L/2 + B, clamped, RFU units)",
    calculate: ({L, B}) => {
      const min_thresh = B + 0.10 * L;
      const max_thresh = B + 0.90 * L;
      const exp_phase = L / 2 + B;
      return Math.min(Math.max(exp_phase, min_thresh), max_thresh);
    },
    description: "Standard exponential phase threshold, clamped to 10–90% of amplitude. Returns RFU for both linear and log charts.",
    reference: "See qPCR_Curve_Classification_Reference.md"
  },
  "log_max_derivative": {
    name: "Log: Max First Derivative",
    calculate: ({rfu, cycles}) => {
      if (!rfu || rfu.length < 3) {
        return null;
      }
      let maxSlope = -Infinity, maxIdx = 1;
      for (let i = 1; i < rfu.length - 1; i++) {
        const slope = rfu[i + 1] - rfu[i - 1];
        if (slope > maxSlope) {
          maxSlope = slope;
          maxIdx = i;
        }
      }
      const result = rfu[maxIdx];
      return result;
    },
    description: "Threshold at the point of maximum slope (first derivative) on the log-transformed curve.",
    reference: "See qPCR_Curve_Classification_Reference.md"
  },
  "log_second_derivative_max": {
    name: "Log: Max Second Derivative",
    calculate: ({rfu, cycles, curve, log_rfu}) => {
      // Accept multiple parameter formats for flexibility
      const data = log_rfu || rfu || curve;
      if (!data || data.length < 5) {
        return null;
      }
      
      // Calculate second derivative (rate of change of slope) at each point
      let maxSecond = -Infinity, maxIdx = 2;
      for (let i = 2; i < data.length - 2; i++) {
        // Calculate second derivative using central difference: f''(x) = f(x+1) - 2*f(x) + f(x-1)
        const secondDerivative = (data[i + 1] - 2 * data[i] + data[i - 1]);
        if (secondDerivative > maxSecond) {
          maxSecond = secondDerivative;
          maxIdx = i;
        }
      }
      
      // Return the RFU value at the point of maximum second derivative (inflection point)
      return data[maxIdx];
    },
    description: "Threshold at the point of maximum second derivative (inflection) on the log-transformed curve.",
    reference: "See qPCR_Curve_Classification_Reference.md"
  }
};

// Pathogen-specific fixed threshold values (per channel/fluorophore)
window.PATHOGEN_FIXED_THRESHOLDS = {
  "BVAB": { 
    "FAM": { linear: 250, log: 250 },
    "HEX": { linear: 250, log: 250 },
    "Cy5": { linear: 250, log: 250 }
  },
  "BVPanelPCR1": {
    "FAM": { linear: 200, log: 200 },
    "HEX": { linear: 250, log: 250 },
    "Texas Red": { linear: 150, log: 150 },
    "Cy5": { linear: 200, log: 200 }
  },
  "BVPanelPCR2": {
    "FAM": { linear: 350, log: 350 },
    "HEX": { linear: 350, log: 350 },
    "Texas Red": { linear: 200, log: 200 },
    "Cy5": { linear: 350, log: 350 }
  },
  "BVPanelPCR3": { 
    "CY5": { linear: 100, log: 100 },      // Fixed: CY5 (uppercase)
    "Cy5": { linear: 100, log: 100 },      // Backup: Cy5 (mixed case)
    "FAM": { linear: 100, log: 100 },
    "HEX": { linear: 100, log: 100 },
    "Texas Red": { linear: 100, log: 100 }
  },
  "Calb": { 
    "HEX": { linear: 150, log: 150 }
  },
  "Cglab": { 
    "FAM": { linear: 150, log: 150 }
  },
  "CHVIC": { 
    "FAM": { linear: 250, log: 250 }
  },
  "Ckru": { 
    "FAM": { linear: 280, log: 280 }
  },
  "Cpara": { 
    "FAM": { linear: 200, log: 200 }
  },
  "Ctrach": { 
    "FAM": { linear: 150, log: 150 }
  },
  "Ctrop": { 
    "FAM": { linear: 200, log: 200 }
  },
  "Efaecalis": { 
    "FAM": { linear: 200, log: 200 }
  },
  "FLUA": { "FAM": { linear: 265, log: 265 } },
  "FLUB": { "Cy5": { linear: 225, log: 225 } },
  "GBS": { 
    "FAM": { linear: 300, log: 300 }
  },
  "Lacto": { 
    "FAM": { linear: 150, log: 150 }
  },
  "Mgen": { 
    "FAM": { linear: 500, log: 500 }
  },
  "Ngon": { 
    "HEX": { linear: 200, log: 200 }
  },
  "NOV": { 
    "FAM": { linear: 500, log: 500 }
  },
  "Saureus": { 
    "FAM": { linear: 250, log: 250 }
  },
  "Tvag": { 
    "FAM": { linear: 250, log: 250 }
  }
};


/**
 * Get a threshold value using the selected strategy and scale.
 * @param {string} strategy - The strategy key
 * @param {object} params - Parameters for the strategy
 * @param {string} scale - 'linear' or 'log'
 */
function calculateThreshold(strategy, params, scale = 'log') {
  let strat;
  if (scale === 'linear') {
    strat = LINEAR_THRESHOLD_STRATEGIES[strategy] || LINEAR_THRESHOLD_STRATEGIES[Object.keys(LINEAR_THRESHOLD_STRATEGIES)[0]];
    // For linear, if using the log default strategy, force returnLog: false
    if (strategy === 'default' && strat.calculate && typeof strat.calculate === 'function') {
      if (!params) params = {};
      params.returnLog = false;
    }
  } else {
    strat = LOG_THRESHOLD_STRATEGIES[strategy] || LOG_THRESHOLD_STRATEGIES[Object.keys(LOG_THRESHOLD_STRATEGIES)[0]];
    // For log, if using the default strategy, force returnLog: true
    if (strategy === 'default' && strat.calculate && typeof strat.calculate === 'function') {
      if (!params) params = {};
      params.returnLog = true;
    }
  }

  // Patch: If using a fixed strategy, auto-lookup the correct fixed_value for pathogen/channel/scale
  if ((strategy === 'linear_fixed' || strategy === 'log_fixed') && params && !('fixed_value' in params)) {
    // Try to auto-populate fixed_value from PATHOGEN_FIXED_THRESHOLDS
    const pathogen = params.pathogen || params.test_code || params.target || params.pathogen_code;
    const fluor = params.fluorophore || params.channel;
    
    if (window.PATHOGEN_FIXED_THRESHOLDS && pathogen) {
      const pathogenEntry = window.PATHOGEN_FIXED_THRESHOLDS[pathogen];
      
      if (pathogenEntry) {
        const channelEntry = (fluor && pathogenEntry[fluor]) ? pathogenEntry[fluor] : pathogenEntry['default'];
        
        if (channelEntry && typeof channelEntry === 'object' && scale in channelEntry) {
          // CRITICAL: Ensure fixed_value is always a number, not a string
          const rawValue = channelEntry[scale];
          params.fixed_value = typeof rawValue === 'string' ? parseFloat(rawValue) : rawValue;
        }
      }
    }
  }

  // Ensure all numeric parameters are actually numbers (database might return strings)
  if (params) {
    Object.keys(params).forEach(key => {
      if (['fixed_value', 'L', 'B', 'baseline', 'baseline_std', 'N'].includes(key)) {
        const value = params[key];
        if (value !== null && value !== undefined && typeof value === 'string' && !isNaN(value)) {
          params[key] = parseFloat(value);
        }
      }
    });
  }

  try {
    const result = strat.calculate(params);
    // Ensure result is always a number
    let finalResult = typeof result === 'string' ? parseFloat(result) : result;
    
    // CRITICAL: Validate threshold minimum values to prevent negative or invalid thresholds
    if (isNaN(finalResult) || finalResult < 0) {
      console.warn(`⚠️ THRESHOLD-STRATEGY - Invalid threshold calculated: ${finalResult} for ${params?.fluorophore || 'unknown'}, using fallback`);
      // Use a reasonable fallback based on scale
      finalResult = scale === 'linear' ? 0.1 : 1.0;
    }
    
    // Additional validation: ensure minimum practical thresholds
    const minThreshold = scale === 'linear' ? 0.01 : 0.1;
    if (finalResult < minThreshold) {
      console.warn(`⚠️ THRESHOLD-STRATEGY - Threshold too low: ${finalResult} for ${params?.fluorophore || 'unknown'}, using minimum: ${minThreshold}`);
      finalResult = minThreshold;
    }
    
    return finalResult;
  } catch (e) {
    // Threshold strategy failed, use fallback
    console.warn(`⚠️ THRESHOLD-STRATEGY - Strategy calculation failed for ${params?.fluorophore || 'unknown'}, using fallback`);
    let fallbackResult;
    if (scale === 'linear') {
      fallbackResult = LINEAR_THRESHOLD_STRATEGIES[Object.keys(LINEAR_THRESHOLD_STRATEGIES)[0]].calculate(params);
    } else {
      fallbackResult = LOG_THRESHOLD_STRATEGIES[Object.keys(LOG_THRESHOLD_STRATEGIES)[0]].calculate(params);
    }
    
    // Apply same validation to fallback
    const minThreshold = scale === 'linear' ? 0.01 : 0.1;
    if (isNaN(fallbackResult) || fallbackResult < minThreshold) {
      console.warn(`⚠️ THRESHOLD-STRATEGY - Fallback threshold invalid: ${fallbackResult}, using minimum: ${minThreshold}`);
      fallbackResult = minThreshold;
    }
    
    return fallbackResult;
  }
}

// Expose to window for browser compatibility
window.LINEAR_THRESHOLD_STRATEGIES = LINEAR_THRESHOLD_STRATEGIES;
window.LOG_THRESHOLD_STRATEGIES = LOG_THRESHOLD_STRATEGIES;
window.calculateThreshold = calculateThreshold;

/**
 * Main function called by frontend to calculate thresholds for a strategy
 * @param {string} strategy - Strategy name (e.g., 'fixed', 'exponential', 'manual')
 * @param {Object} analysisResults - Current analysis results with individual well data
 * @param {string} currentScale - Current scale mode ('linear' or 'log')
 * @returns {Object} Updated threshold values by channel/scale
 */
function calculateThresholdForStrategy(strategy, analysisResults, currentScale = 'log') {
    try {
        // Check if we have valid analysis results
        if (!analysisResults || typeof analysisResults !== 'object' || Object.keys(analysisResults).length === 0) {
            return null;
        }
        
        const updatedThresholds = {};
        
        // Get unique channels from analysis results
        const channels = new Set();
        Object.keys(analysisResults).forEach(wellKey => {
            const wellData = analysisResults[wellKey];
            if (wellData && wellData.fluorophore) {
                channels.add(wellData.fluorophore);
            }
        });
        
        if (channels.size === 0) {
            return null;
        }
        
        // Calculate threshold for each channel
        channels.forEach(channel => {
            // Get parameters for this channel from analysis data
            const channelWells = Object.keys(analysisResults).filter(wellKey => {
                const wellData = analysisResults[wellKey];
                return wellData && wellData.fluorophore === channel;
            });
            
            if (channelWells.length > 0) {
                // Extract parameters from first well of this channel
                const firstWell = analysisResults[channelWells[0]];
                
                // Extract RFU and cycle data for derivative strategies
                let rfu = null, cycles = null;
                try {
                    if (firstWell.raw_rfu) {
                        rfu = typeof firstWell.raw_rfu === 'string' ? JSON.parse(firstWell.raw_rfu) : firstWell.raw_rfu;
                    }
                    if (firstWell.raw_cycles) {
                        cycles = typeof firstWell.raw_cycles === 'string' ? JSON.parse(firstWell.raw_cycles) : firstWell.raw_cycles;
                    }
                } catch (parseError) {
                    console.warn(`⚠️ THRESHOLD-STRATEGY - Error parsing RFU/cycles data for ${channel}:`, parseError);
                }
                
                const params = {
                    fluorophore: channel,
                    pathogen: firstWell.pathogen || firstWell.test_code,
                    baseline: firstWell.baseline,
                    baseline_std: firstWell.baseline_std || (firstWell.baseline ? firstWell.baseline * 0.1 : 100), // Estimate if not available
                    L: firstWell.L || (firstWell.amplitude && firstWell.baseline ? firstWell.amplitude : null),
                    B: firstWell.B || firstWell.baseline,
                    // Add RFU and cycles data for derivative strategies
                    rfu: rfu,
                    cycles: cycles,
                    // Add other parameters as needed
                    fixed_value: null // Will be auto-populated by calculateThreshold if needed
                };
                
                try {
                    // Calculate threshold using the threshold_strategies.js logic
                    const thresholdValue = calculateThreshold(strategy, params, currentScale);
                    
                    // Additional validation at the application level
                    if (isNaN(thresholdValue) || thresholdValue <= 0) {
                        console.warn(`⚠️ THRESHOLD-STRATEGY - Invalid final threshold for ${channel}: ${thresholdValue}, skipping`);
                        return; // Skip this channel
                    }
                    
                    // Store result
                    if (!updatedThresholds[channel]) {
                        updatedThresholds[channel] = {};
                    }
                    updatedThresholds[channel][currentScale] = thresholdValue;
                    
                } catch (calcError) {
                    // Threshold calculation failed - skip this channel
                }
            }
        });
        
        // Update global threshold state if setChannelThreshold function exists
        if (typeof setChannelThreshold === 'function') {
            Object.keys(updatedThresholds).forEach(channel => {
                Object.keys(updatedThresholds[channel]).forEach(scale => {
                    setChannelThreshold(channel, scale, updatedThresholds[channel][scale]);
                });
            });
        }
        
        return updatedThresholds;
        
    } catch (error) {
        console.error(`❌ THRESHOLD-STRATEGY - Error calculating strategy "${strategy}":`, error);
        return null;
    }
}

// Expose the main function
window.calculateThresholdForStrategy = calculateThresholdForStrategy;

/**
 * Initialize channel thresholds after analysis results are loaded
 * This function is called after fresh analysis to set up proper thresholds
 * based on pathogen configuration and experimental patterns
 */
function initializeChannelThresholds() {
    console.log('🔍 THRESHOLD-INIT - Initializing channel thresholds after analysis');
    
    // Check if we have analysis results to work with
    if (!window.currentAnalysisResults && !window.analysisResults) {
        console.warn('⚠️ THRESHOLD-INIT - No analysis results available for threshold initialization');
        return;
    }
    
    const results = window.currentAnalysisResults || window.analysisResults;
    if (!results || !results.individual_results) {
        console.warn('⚠️ THRESHOLD-INIT - No individual results available for threshold initialization');
        return;
    }
    
    try {
        // Get current experiment pattern for pathogen detection
        const experimentPattern = window.getCurrentFullPattern ? window.getCurrentFullPattern() : null;
        const testCode = experimentPattern && window.extractTestCode ? window.extractTestCode(experimentPattern) : null;
        
        console.log('🔍 THRESHOLD-INIT - Experiment context:', {
            pattern: experimentPattern,
            testCode: testCode
        });
        
        // Get available channels from analysis results
        const channels = new Set();
        Object.values(results.individual_results).forEach(well => {
            if (well.channel || well.fluorophore) {
                channels.add(well.channel || well.fluorophore);
            }
        });
        
        console.log('🔍 THRESHOLD-INIT - Available channels:', Array.from(channels));
        
        // For each channel, determine the appropriate pathogen and set fixed threshold if available
        channels.forEach(channel => {
            let pathogen = null;
            
            // Try to get pathogen from test code + channel
            if (testCode && window.getPathogenTarget) {
                try {
                    pathogen = window.getPathogenTarget(testCode, channel);
                    console.log(`🔍 THRESHOLD-INIT - ${channel}: Pathogen from library: "${pathogen}"`);
                } catch (error) {
                    console.warn(`⚠️ THRESHOLD-INIT - ${channel}: Error getting pathogen from library:`, error);
                }
            }
            
            // If no pathogen found, try to extract from first well in this channel
            if (!pathogen || pathogen === 'Unknown') {
                const channelWells = Object.values(results.individual_results).filter(well => 
                    (well.channel || well.fluorophore) === channel
                );
                
                if (channelWells.length > 0) {
                    const firstWell = channelWells[0];
                    // Try multiple pathogen detection strategies for ML-updated wells
                    pathogen = firstWell.pathogen || 
                              firstWell.target || 
                              firstWell.specific_pathogen ||
                              (firstWell.curve_classification && firstWell.curve_classification.pathogen) ||
                              (firstWell.ml_classification && firstWell.ml_classification.pathogen) ||
                              testCode;
                    console.log(`🔍 THRESHOLD-INIT - ${channel}: Pathogen from well data: "${pathogen}"`);
                }
            }
            
            // Check if this pathogen has a fixed threshold configuration
            if (pathogen && window.PATHOGEN_FIXED_THRESHOLDS && window.PATHOGEN_FIXED_THRESHOLDS[pathogen]) {
                const pathogenThresholds = window.PATHOGEN_FIXED_THRESHOLDS[pathogen];
                const channelConfig = pathogenThresholds[channel];
                
                if (channelConfig) {
                    console.log(`✅ THRESHOLD-INIT - ${channel}: Found fixed threshold config for ${pathogen}:`, channelConfig);
                    
                    // Apply the fixed threshold for both linear and log scales
                    const fixedValue = channelConfig.threshold || channelConfig.value || channelConfig;
                    
                    if (typeof fixedValue === 'number' && fixedValue > 0) {
                        // Set the threshold using the global threshold system
                        if (window.setChannelThreshold) {
                            window.setChannelThreshold(channel, 'linear', fixedValue);
                            window.setChannelThreshold(channel, 'log', fixedValue);
                            console.log(`✅ THRESHOLD-INIT - ${channel}: Set fixed threshold ${fixedValue} for ${pathogen}`);
                        } else {
                            console.warn(`⚠️ THRESHOLD-INIT - ${channel}: setChannelThreshold function not available`);
                        }
                        
                        // Also store in the channel thresholds object if it exists
                        if (window.channelThresholds) {
                            if (!window.channelThresholds[channel]) {
                                window.channelThresholds[channel] = {};
                            }
                            window.channelThresholds[channel]['linear'] = fixedValue;
                            window.channelThresholds[channel]['log'] = fixedValue;
                        }
                    } else {
                        console.warn(`⚠️ THRESHOLD-INIT - ${channel}: Invalid fixed threshold value for ${pathogen}:`, fixedValue);
                    }
                } else {
                    console.log(`ℹ️ THRESHOLD-INIT - ${channel}: No threshold config for ${pathogen} in channel ${channel}`);
                }
            } else {
                console.log(`ℹ️ THRESHOLD-INIT - ${channel}: No fixed threshold found for pathogen "${pathogen}"`);
            }
        });
        
        console.log('✅ THRESHOLD-INIT - Channel threshold initialization complete');
        
    } catch (error) {
        console.error('❌ THRESHOLD-INIT - Error during threshold initialization:', error);
    }
}

// Expose the initialization function
window.initializeChannelThresholds = initializeChannelThresholds;

/**
 * Get fixed threshold value for a specific pathogen and channel
 * @param {string} pathogen - The pathogen name
 * @param {string} channel - The fluorophore channel (FAM, HEX, Cy5, etc.)
 * @returns {number|null} - The fixed threshold value or null if not found
 */
function getPathogenThreshold(pathogen, channel) {
    if (!pathogen || !channel) {
        return null;
    }
    
    if (!window.PATHOGEN_FIXED_THRESHOLDS || !window.PATHOGEN_FIXED_THRESHOLDS[pathogen]) {
        return null;
    }
    
    const pathogenConfig = window.PATHOGEN_FIXED_THRESHOLDS[pathogen];
    const channelConfig = pathogenConfig[channel];
    
    if (!channelConfig) {
        return null;
    }
    
    // Handle different configuration formats
    if (typeof channelConfig === 'number') {
        return channelConfig;
    }
    
    if (typeof channelConfig === 'object') {
        return channelConfig.threshold || channelConfig.value || null;
    }
    
    return null;
}

// Expose the pathogen threshold function
window.getPathogenThreshold = getPathogenThreshold;
