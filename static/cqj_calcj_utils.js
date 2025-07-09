// Utility to calculate CQ-J and Calc-J for a well given its data and a threshold
// Assumes well.raw_rfu (array of RFU values) and well.raw_cycles (array of cycle numbers)

function calculateCqj(well, threshold) {
    if (!well || !Array.isArray(well.raw_rfu) || !Array.isArray(well.raw_cycles)) return null;
    // Find the first cycle where RFU crosses the threshold
    for (let i = 0; i < well.raw_rfu.length; i++) {
        if (well.raw_rfu[i] >= threshold) {
            // Linear interpolation for more precise Cq
            if (i === 0) return well.raw_cycles[0];
            const x0 = well.raw_cycles[i - 1];
            const x1 = well.raw_cycles[i];
            const y0 = well.raw_rfu[i - 1];
            const y1 = well.raw_rfu[i];
            if (y1 === y0) return x1; // avoid div by zero
            return x0 + (threshold - y0) * (x1 - x0) / (y1 - y0);
        }
    }
    return null; // never crossed
}

function calculateCalcj(well, threshold) {
    // Example: Calc-J = amplitude / threshold (replace with real formula if needed)
    if (!well || typeof well.amplitude !== 'number' || !threshold) return null;
    return well.amplitude / threshold;
}

// Export for use in script.js
window.calculateCqj = calculateCqj;
window.calculateCalcj = calculateCalcj;
