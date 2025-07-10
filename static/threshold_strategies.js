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
  "linear_baseline_plus_nsd": {
    name: "Linear: Baseline + N × SD",
    calculate: ({baseline, baseline_std, N = 10}) => baseline + N * baseline_std,
    description: "Linear threshold at baseline plus N times the standard deviation.",
    reference: "See qPCR_Curve_Classification_Reference.md"
  },
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
  }
};

// --- Log strategies ---
const LOG_THRESHOLD_STRATEGIES = {
  "default": {
    name: "Exponential Phase (L/2 + B, clamped)",
    calculate: ({L, B}) => {
      const min_thresh = B + 0.10 * L;
      const max_thresh = B + 0.90 * L;
      const exp_phase = L / 2 + B;
      return Math.min(Math.max(exp_phase, min_thresh), max_thresh);
    },
    description: "Standard exponential phase threshold, clamped to 10–90% of amplitude.",
    reference: "See qPCR_Curve_Classification_Reference.md"
  },
  "log_max_derivative": {
    name: "Log: Max First Derivative",
    calculate: ({log_curve, cycles}) => {
      if (!log_curve || log_curve.length < 3) return null;
      let maxSlope = -Infinity, maxIdx = 1;
      for (let i = 1; i < log_curve.length - 1; i++) {
        const slope = log_curve[i + 1] - log_curve[i - 1];
        if (slope > maxSlope) {
          maxSlope = slope;
          maxIdx = i;
        }
      }
      return log_curve[maxIdx];
    },
    description: "Threshold at the point of maximum slope (first derivative) on the log-transformed curve.",
    reference: "See qPCR_Curve_Classification_Reference.md"
  },
  "log_second_derivative_max": {
    name: "Log: Max Second Derivative",
    calculate: ({log_curve, cycles}) => {
      if (!log_curve || log_curve.length < 5) return null;
      let maxSecond = -Infinity, maxIdx = 2;
      for (let i = 2; i < log_curve.length - 2; i++) {
        const second = (log_curve[i + 1] - 2 * log_curve[i] + log_curve[i - 1]);
        if (second > maxSecond) {
          maxSecond = second;
          maxIdx = i;
        }
      }
      return log_curve[maxIdx];
    },
    description: "Threshold at the point of maximum second derivative (inflection) on the log-transformed curve.",
    reference: "See qPCR_Curve_Classification_Reference.md"
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
  } else {
    strat = LOG_THRESHOLD_STRATEGIES[strategy] || LOG_THRESHOLD_STRATEGIES[Object.keys(LOG_THRESHOLD_STRATEGIES)[0]];
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
