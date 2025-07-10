// cqj_calcj.js
// ======================================
// CQ-J and Calc-J Logic for qPCR Analysis
// ======================================
// This file contains all logic for CQ-J (Cq value based on threshold) and Calc-J (calculated concentration based on H, M, L controls).
// All functions are modular and can be easily removed or updated.
//
// CQ-J: Calculates Cq for each well/sample using the current threshold.
// Calc-J: Calculates sample concentration based on H, M, L controls defined per assay in pathogen_library.js.
//
// Both functions dynamically reference H, M, L values from pathogen_library.js for each test/assay.

// Example usage:
//   const cq = calculateCqForWell(wellData, threshold);
//   const concentration = calculateConcentration(cq, testCode);

// --- CQ-J: Calculate Cq value for a well based on threshold ---
function calculateCqForWell(wellData, threshold) {
    // wellData: { cycles: [...], rfu: [...] }
    // threshold: number
    // Returns: Cq value (cycle number where RFU crosses threshold), or null if not found
    // Description: Finds the first cycle where RFU >= threshold
    if (!wellData || !Array.isArray(wellData.cycles) || !Array.isArray(wellData.rfu)) return null;
    for (let i = 0; i < wellData.rfu.length; i++) {
        if (wellData.rfu[i] >= threshold) {
            return wellData.cycles[i];
        }
    }
    return null; // No crossing found
}

// --- Calc-J: Calculate sample concentration based on H, M, L controls ---
function calculateConcentration(cq, testCode) {
    // cq: Cq value for the sample
    // testCode: string (e.g., 'BVAB', 'AcBVAB', etc.)
    // Returns: calculated concentration (copies/mL or similar)
    // Uses H, M, L control Cq values and concentrations from pathogen_library.js
    if (typeof cq !== 'number' || !window.pathogenLibrary) return null;
    const assay = window.pathogenLibrary[testCode];
    if (!assay || !assay.concentrationControls) return null;
    const { H, M, L, H_Cq, M_Cq, L_Cq } = assay.concentrationControls;
    // If H_Cq, M_Cq, L_Cq are not present, cannot calculate
    if ([H_Cq, M_Cq, L_Cq].some(v => typeof v !== 'number')) return null;
    // Prepare arrays for regression
    const cqVals = [H_Cq, M_Cq, L_Cq];
    const concVals = [H, M, L];
    // Log-transform concentrations
    const logConc = concVals.map(x => Math.log10(x));
    // Linear regression: logConc = slope * Cq + intercept
    // Fit slope and intercept using two-point formula (since only 3 points)
    // Use least squares for 3 points
    const n = 3;
    const sumX = cqVals.reduce((a, b) => a + b, 0);
    const sumY = logConc.reduce((a, b) => a + b, 0);
    const sumXY = cqVals.reduce((a, b, i) => a + b * logConc[i], 0);
    const sumX2 = cqVals.reduce((a, b) => a + b * b, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    // Predict log concentration for sample Cq
    const logConcSample = slope * cq + intercept;
    const concSample = Math.pow(10, logConcSample);
    return concSample;
}

// --- Export functions for use in main script ---
window.calculateCqForWell = calculateCqForWell;
window.calculateConcentration = calculateConcentration;

// --- END OF cqj_calcj.js ---
