// threshold_strategies.js
// Modular registry of scientific thresholding strategies for qPCR analysis
// Each strategy is a function with a name, description, and reference
// Default strategies are always present for safety

// --- Linear strategies ---
const LINEAR_THRESHOLD_STRATEGIES = {
  "linear": {
    name: "Baseline + N × baseline_std",
    calculate: ({baseline, baseline_std, N = 10}) => baseline + N * baseline_std,
    description: "Linear threshold, often used for manual review or fallback.",
    reference: "See qPCR_Curve_Classification_Reference.md"
  },
  // Removed duplicate linear_baseline_plus_nsd
  "linear_max_slope": {
    name: "Linear: Max Slope",
    calculate: ({curve, cycles}) => {
      if (!curve || curve.length < 3) return null;
      let maxSlope = -Infinity, maxIdx = 1;
      for (let i = 1; i < curve.length - 1; i++) {
        const slope = curve[i + 1] - curve[i - 1];
        if (slope > maxSlope) {
          maxSlope = slope;
          maxIdx = i;
        }
      }
      return curve[maxIdx];
    },
    description: "Threshold at the point of maximum slope (first derivative) on the linear curve.",
    reference: "See qPCR_Curve_Classification_Reference.md"
  },
  "linear_fixed": {
    name: "Linear: Fixed Value (per-pathogen)",
    calculate: ({fixed_value}) => fixed_value,
    description: "User- or pathogen-specific fixed threshold value (loaded from JS or CSV).",
    reference: "Manual or pathogen-specific. See documentation."
  }
};

// --- Log strategies ---
const LOG_THRESHOLD_STRATEGIES = {
  "default": {
    name: "Exponential Phase (L/2 + B, clamped, RFU units)",
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
      if (!rfu || rfu.length < 3) return null;
      let maxSlope = -Infinity, maxIdx = 1;
      for (let i = 1; i < rfu.length - 1; i++) {
        const slope = rfu[i + 1] - rfu[i - 1];
        if (slope > maxSlope) {
          maxSlope = slope;
          maxIdx = i;
        }
      }
      return rfu[maxIdx];
    },
    description: "Threshold at the point of maximum slope (first derivative) on the log-transformed curve.",
    reference: "See qPCR_Curve_Classification_Reference.md"
  },
  "log_second_derivative_max": {
    name: "Log: Max Second Derivative",
    calculate: ({rfu, cycles}) => {
      if (!rfu || rfu.length < 5) return null;
      let maxSecond = -Infinity, maxIdx = 2;
      for (let i = 2; i < rfu.length - 2; i++) {
        const second = (rfu[i + 1] - 2 * rfu[i] + rfu[i - 1]);
        if (second > maxSecond) {
          maxSecond = second;
          maxIdx = i;
        }
      }
      return rfu[maxIdx];
    },
    description: "Threshold at the point of maximum second derivative (inflection) on the log-transformed curve.",
    reference: "See qPCR_Curve_Classification_Reference.md"
  },
  "log_fixed": {
    name: "Log: Fixed Value (per-pathogen)",
    calculate: ({fixed_value}) => fixed_value,
    description: "User- or pathogen-specific fixed threshold value (loaded from JS or CSV).",
    reference: "Manual or pathogen-specific. See documentation."
  }
};

// Pathogen-specific fixed threshold values (per channel/fluorophore)
window.PATHOGEN_FIXED_THRESHOLDS = {
  "BVAB": { 
    "FAM": { linear: 250, log: 250 }
  },
  "BVPanelPCR1": {
    "FAM": { linear: 200, log: 200 },
    "HEX": { linear: 250, log: 250 },
    "Texas Red": { linear: 150, log: 150 },
    "CY5": { linear: 200, log: 200 }
  },
  "BVPanelPCR2": {
    "FAM": { linear: 350, log: 350 },
    "HEX": { linear: 350, log: 350 },
    "Texas Red": { linear: 200, log: 200 },
    "CY5": { linear: 350, log: 350 }
  },
  "BVPanelPCR3": { 
    "CY5": { linear: 250, log: 250 },      // Fixed: CY5 (uppercase)
    "Cy5": { linear: 250, log: 250 },      // Backup: Cy5 (mixed case)
    "FAM": { linear: 300, log: 300 },
    "HEX": { linear: 275, log: 275 },
    "Texas Red": { linear: 225, log: 225 }
  },
  "Calb": { 
    "FAM": { linear: 150, log: 150 }
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
  "FLUB": { "CY5": { linear: 225, log: 225 } },
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
    "FAM": { linear: 200, log: 200 }
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
    
    console.log(`🔍 FIXED-THRESHOLD-DEBUG - Strategy: ${strategy}, Scale: ${scale}`);
    console.log(`🔍 FIXED-THRESHOLD-DEBUG - Pathogen: "${pathogen}" (from params.pathogen=${params.pathogen}, params.test_code=${params.test_code})`);
    console.log(`🔍 FIXED-THRESHOLD-DEBUG - Fluorophore: "${fluor}" (from params.fluorophore=${params.fluorophore}, params.channel=${params.channel})`);
    console.log(`🔍 FIXED-THRESHOLD-DEBUG - PATHOGEN_FIXED_THRESHOLDS available:`, Object.keys(window.PATHOGEN_FIXED_THRESHOLDS || {}));
    
    if (window.PATHOGEN_FIXED_THRESHOLDS && pathogen) {
      const pathogenEntry = window.PATHOGEN_FIXED_THRESHOLDS[pathogen];
      console.log(`🔍 FIXED-THRESHOLD-DEBUG - Pathogen entry for "${pathogen}":`, pathogenEntry);
      
      if (pathogenEntry) {
        console.log(`🔍 FIXED-THRESHOLD-DEBUG - Available fluorophores in ${pathogen}:`, Object.keys(pathogenEntry));
        const channelEntry = (fluor && pathogenEntry[fluor]) ? pathogenEntry[fluor] : pathogenEntry['default'];
        console.log(`🔍 FIXED-THRESHOLD-DEBUG - Channel entry for "${fluor}":`, channelEntry);
        
        if (channelEntry && typeof channelEntry === 'object' && scale in channelEntry) {
          // CRITICAL: Ensure fixed_value is always a number, not a string
          const rawValue = channelEntry[scale];
          params.fixed_value = typeof rawValue === 'string' ? parseFloat(rawValue) : rawValue;
          console.log(`🔍 FIXED-THRESHOLD-DEBUG - SUCCESS: Using fixed threshold for ${pathogen}/${fluor}/${scale}: ${params.fixed_value} (type: ${typeof params.fixed_value})`);
        } else {
          console.warn(`🔍 FIXED-THRESHOLD-DEBUG - FAIL: No ${scale} threshold found for ${pathogen}/${fluor}. channelEntry:`, channelEntry);
        }
      } else {
        console.warn(`🔍 FIXED-THRESHOLD-DEBUG - FAIL: Pathogen "${pathogen}" not found in PATHOGEN_FIXED_THRESHOLDS`);
      }
    } else {
      console.warn(`🔍 FIXED-THRESHOLD-DEBUG - FAIL: Missing data - PATHOGEN_FIXED_THRESHOLDS:`, !!window.PATHOGEN_FIXED_THRESHOLDS, `pathogen: "${pathogen}"`);
    }
  }

  // Ensure all numeric parameters are actually numbers (database might return strings)
  if (params) {
    Object.keys(params).forEach(key => {
      if (['fixed_value', 'L', 'B', 'baseline', 'baseline_std', 'N'].includes(key)) {
        const value = params[key];
        if (value !== null && value !== undefined && typeof value === 'string' && !isNaN(value)) {
          params[key] = parseFloat(value);
          console.log(`🔍 THRESHOLD-DEBUG - Converted ${key} from string to number: ${params[key]}`);
        }
      }
    });
  }

  try {
    const result = strat.calculate(params);
    // Ensure result is always a number
    const finalResult = typeof result === 'string' ? parseFloat(result) : result;
    console.log(`🔍 THRESHOLD-DEBUG - Strategy '${strategy}' calculated: ${finalResult} (type: ${typeof finalResult})`);
    return finalResult;
  } catch (e) {
    console.warn(`Threshold strategy '${strategy}' failed, using default.`, e);
    if (scale === 'linear') {
      return LINEAR_THRESHOLD_STRATEGIES[Object.keys(LINEAR_THRESHOLD_STRATEGIES)[0]].calculate(params);
    } else {
      return LOG_THRESHOLD_STRATEGIES[Object.keys(LOG_THRESHOLD_STRATEGIES)[0]].calculate(params);
    }
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
    console.log(`🔍 THRESHOLD-STRATEGY - Calculating strategy "${strategy}" for scale "${currentScale}"`);
    
    try {
        // Check if we have valid analysis results
        if (!analysisResults || typeof analysisResults !== 'object' || Object.keys(analysisResults).length === 0) {
            console.warn(`⚠️ THRESHOLD-STRATEGY - No valid analysis results provided. Skipping threshold calculation.`);
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
            console.warn(`⚠️ THRESHOLD-STRATEGY - No channels found in analysis results. Available wells:`, Object.keys(analysisResults).slice(0, 3));
            return null;
        }
        
        console.log(`🔍 THRESHOLD-STRATEGY - Found channels:`, Array.from(channels));
        
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
                const params = {
                    fluorophore: channel,
                    pathogen: firstWell.pathogen || firstWell.test_code,
                    baseline: firstWell.baseline,
                    baseline_std: firstWell.baseline_std || (firstWell.baseline ? firstWell.baseline * 0.1 : 100), // Estimate if not available
                    // Add other parameters as needed
                };
                
                try {
                    // Calculate threshold using the threshold_strategies.js logic
                    const thresholdValue = calculateThreshold(strategy, params, currentScale);
                    
                    // Store result
                    if (!updatedThresholds[channel]) {
                        updatedThresholds[channel] = {};
                    }
                    updatedThresholds[channel][currentScale] = thresholdValue;
                    
                    console.log(`🔍 THRESHOLD-STRATEGY - ${channel} ${currentScale}: ${thresholdValue}`);
                } catch (calcError) {
                    console.warn(`⚠️ THRESHOLD-STRATEGY - Failed to calculate threshold for ${channel}:`, calcError);
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
