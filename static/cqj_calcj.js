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
    // Description: Uses H, M, L control Cq values and concentrations from pathogen_library.js
    // For now, H = 1e7, M = 1e5, L = 1e3 for all tests (can be changed per test in pathogen_library.js)
    if (typeof cq !== 'number' || !window.pathogenLibrary) return null;
    const assay = window.pathogenLibrary[testCode];
    if (!assay || !assay.concentrationControls) return null;
    const { H, M, L } = assay.concentrationControls;
    // For demonstration, use a simple linear interpolation between H, M, L (real implementation may use standard curve)
    // TODO: Replace with log-linear regression if needed
    // Example: If cq is closer to H_Cq, return H; if closer to L_Cq, return L, etc.
    // This is a placeholder for demonstration.
    // You must provide H_Cq, M_Cq, L_Cq for the current run to use this function meaningfully.
    return null; // Placeholder
}

// --- Export functions for use in main script ---
window.calculateCqForWell = calculateCqForWell;
window.calculateConcentration = calculateConcentration;

// --- END OF cqj_calcj.js ---
