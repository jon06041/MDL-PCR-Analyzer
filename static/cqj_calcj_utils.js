// Utility to calculate CQ-J and Calc-J for a well given its data and a threshold
// Assumes well.raw_rfu (array of RFU values) and well.raw_cycles (array of cycle numbers)

function calculateCqj(well, threshold) {
    if (!well || !Array.isArray(well.raw_rfu) || !Array.isArray(well.raw_cycles)) return null;
    
    // Ensure threshold is a number (database might return string)
    const numericThreshold = typeof threshold === 'string' ? parseFloat(threshold) : threshold;
    if (isNaN(numericThreshold) || numericThreshold <= 0) {
        console.warn('[CQJ-DEBUG] Invalid threshold value:', threshold, 'converted to:', numericThreshold);
        return null;
    }
    
    console.log(`[CQJ-DEBUG] Calculating CQJ for well with ${well.raw_rfu.length} points, threshold: ${numericThreshold}`);
    
    // Find the first cycle where RFU crosses the threshold
    for (let i = 0; i < well.raw_rfu.length; i++) {
        const currentRfu = typeof well.raw_rfu[i] === 'string' ? parseFloat(well.raw_rfu[i]) : well.raw_rfu[i];
        const currentCycle = typeof well.raw_cycles[i] === 'string' ? parseFloat(well.raw_cycles[i]) : well.raw_cycles[i];
        
        if (currentRfu >= numericThreshold) {
            // Linear interpolation for more precise Cq
            if (i === 0) {
                console.log(`[CQJ-DEBUG] Threshold crossed at first point, returning cycle: ${currentCycle}`);
                return currentCycle;
            }
            
            const prevRfu = typeof well.raw_rfu[i - 1] === 'string' ? parseFloat(well.raw_rfu[i - 1]) : well.raw_rfu[i - 1];
            const prevCycle = typeof well.raw_cycles[i - 1] === 'string' ? parseFloat(well.raw_cycles[i - 1]) : well.raw_cycles[i - 1];
            
            if (currentRfu === prevRfu) {
                console.log(`[CQJ-DEBUG] No RFU change, returning current cycle: ${currentCycle}`);
                return currentCycle; // avoid div by zero
            }
            
            const interpolatedCq = prevCycle + (numericThreshold - prevRfu) * (currentCycle - prevCycle) / (currentRfu - prevRfu);
            console.log(`[CQJ-DEBUG] Interpolated CQJ: ${interpolatedCq} (between cycles ${prevCycle}-${currentCycle})`);
            return interpolatedCq;
        }
    }
    
    console.log(`[CQJ-DEBUG] Threshold ${numericThreshold} never crossed by well with max RFU: ${Math.max(...well.raw_rfu)}`);
    return null; // never crossed
}

function calculateCalcj(well, threshold) {
    // Example: Calc-J = amplitude / threshold (replace with real formula if needed)
    if (!well || typeof well.amplitude === 'undefined' || well.amplitude === null) {
        console.warn('[CALCJ-DEBUG] Well missing amplitude:', well);
        return null;
    }
    
    // Ensure both amplitude and threshold are numbers
    const numericAmplitude = typeof well.amplitude === 'string' ? parseFloat(well.amplitude) : well.amplitude;
    const numericThreshold = typeof threshold === 'string' ? parseFloat(threshold) : threshold;
    
    if (isNaN(numericAmplitude) || isNaN(numericThreshold) || numericThreshold <= 0) {
        console.warn('[CALCJ-DEBUG] Invalid values - amplitude:', well.amplitude, 'threshold:', threshold);
        return null;
    }
    
    const calcjResult = numericAmplitude / numericThreshold;
    console.log(`[CALCJ-DEBUG] Calculated CalcJ: ${calcjResult} (amplitude: ${numericAmplitude} / threshold: ${numericThreshold})`);
    return calcjResult;
}

// Export for use in script.js
window.calculateCqj = calculateCqj;
window.calculateCalcj = calculateCalcj;
