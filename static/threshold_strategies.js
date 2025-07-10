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
  "BVAB": { "default": { linear: 250, log: 250 } },
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
  "BVPanelPCR3": { "default": { linear: 100, log: 100 } },
  "Calb": { "default": { linear: 150, log: 150 } },
  "Cglab": { "default": { linear: 150, log: 150 } },
  "CHVIC": { "default": { linear: 250, log: 250 } },
  "Ckru": { "default": { linear: 280, log: 280 } },
  "Cpara": { "default": { linear: 200, log: 200 } },
  "Ctrach": { "default": { linear: 150, log: 150 } },
  "Ctrop": { "default": { linear: 200, log: 200 } },
  "Efaecalis": { "default": { linear: 200, log: 200 } },
  "FLUA": { "FAM": { linear: 265, log: 265 } },
  "FLUB": { "CY5": { linear: 225, log: 225 } },
  "GBS": { "default": { linear: 300, log: 300 } },
  "Lacto": { "default": { linear: 150, log: 150 } },
  "Mgen": { "default": { linear: 500, log: 500 } },
  "Ngon": { "default": { linear: 200, log: 200 } },
  "NOV": { "default": { linear: 500, log: 500 } },
  "Saureus": { "default": { linear: 250, log: 250 } },
  "Tvag": { "default": { linear: 250, log: 250 } }
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
          params.fixed_value = channelEntry[scale];
        }
      }
    }
  }

  try {
    return strat.calculate(params);
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
