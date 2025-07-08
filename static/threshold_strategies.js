// threshold_strategies.js
// Modular registry of scientific thresholding strategies for qPCR analysis
// Each strategy is a function with a name, description, and reference
// Default strategies are always present for safety

export const THRESHOLD_STRATEGIES = {
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
  "linear": {
    name: "Baseline + N × baseline_std",
    calculate: ({baseline, baseline_std, N = 10}) => baseline + N * baseline_std,
    description: "Linear threshold, often used for manual review or fallback.",
    reference: "See qPCR_Curve_Classification_Reference.md"
  },
  // Add additional scientific strategies here as needed
};

/**
 * Get a threshold value using the selected strategy.
 * Falls back to 'default' if strategy is missing.
 */
export function calculateThreshold(strategy, params) {
  const strat = THRESHOLD_STRATEGIES[strategy] || THRESHOLD_STRATEGIES["default"];
  try {
    return strat.calculate(params);
  } catch (e) {
    console.warn(`Threshold strategy '${strategy}' failed, using default.`, e);
    return THRESHOLD_STRATEGIES["default"].calculate(params);
  }
}
