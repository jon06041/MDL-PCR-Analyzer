#!/usr/bin/env python3
"""
Calculate R² and analyze curve fitting for A20 data
This will help understand why the curve fitting is failing
"""

import numpy as np
from scipy.optimize import curve_fit
from sklearn.metrics import r2_score
import matplotlib.pyplot as plt

# A20 RFU values from the user
a20_rfu_values = [
    5.629206285, -0.497233961, 0.721270973, 0.740456879, -1.134579086,
    -1.63993241, -0.18572334, -1.227521317, -1.795143183, 1.742258364,
    2.12353948, 2.084842812, -2.641083733, -0.429447372, -0.098692892,
    -2.986710902, 2.87665266, 2.776818686, 2.531654021, 2.697821217,
    2.262203058, 1.861741663, 1.042919976, 3.323533426, 3.389630729,
    5.511113819, 2.843835789, -0.425839655, 3.782908916, 4.310929355,
    3.248759876, 1.862342438, -0.861555414, -2.127279666, -0.51785214,
    1.191511558, 1.54774185, -1.219920249
]

# Generate cycles (1-38)
cycles = np.array(range(1, len(a20_rfu_values) + 1))
rfu = np.array(a20_rfu_values)

def sigmoid(x, L, k, x0, B):
    """Sigmoid function for curve fitting"""
    return L / (1 + np.exp(-k * (x - x0))) + B

def analyze_a20_curve_fitting():
    """Analyze why A20 curve fitting fails"""
    
    print("🔍 A20 CURVE FITTING ANALYSIS")
    print("=" * 50)
    
    # Basic statistics
    print(f"📊 Data Statistics:")
    print(f"   Cycles: {len(cycles)} points ({cycles.min()}-{cycles.max()})")
    print(f"   RFU min: {rfu.min():.3f}")
    print(f"   RFU max: {rfu.max():.3f}")
    print(f"   RFU range: {rfu.max() - rfu.min():.3f}")
    print(f"   RFU mean: {rfu.mean():.3f}")
    print(f"   RFU std: {rfu.std():.3f}")
    print()
    
    # Check for typical qPCR curve characteristics
    print(f"🧬 qPCR Curve Analysis:")
    
    # Baseline (first 5 cycles)
    baseline_rfu = rfu[:5]
    baseline_mean = baseline_rfu.mean()
    baseline_std = baseline_rfu.std()
    print(f"   Baseline (cycles 1-5): {baseline_mean:.3f} ± {baseline_std:.3f}")
    
    # Exponential phase (cycles 15-25)
    exp_mask = (cycles >= 15) & (cycles <= 25)
    exp_rfu = rfu[exp_mask]
    exp_growth = np.diff(exp_rfu).max() if len(exp_rfu) > 1 else 0
    print(f"   Max growth in exp phase: {exp_growth:.3f}")
    
    # Plateau (last 5 cycles)
    plateau_rfu = rfu[-5:]
    plateau_mean = plateau_rfu.mean()
    print(f"   Plateau (last 5 cycles): {plateau_mean:.3f}")
    
    # Signal-to-noise ratio
    signal = rfu.max() - baseline_mean
    noise = baseline_std
    snr = signal / noise if noise > 0 else float('inf')
    print(f"   Signal-to-noise ratio: {snr:.3f}")
    print()
    
    # Attempt curve fitting with same parameters as qpcr_analyzer.py
    print(f"🔧 Sigmoid Curve Fitting:")
    
    # Initial parameter guesses (from qpcr_analyzer.py)
    rfu_range = rfu.max() - rfu.min()
    L_guess = rfu_range * 1.1  # Amplitude with buffer
    k_guess = 0.5  # Steepness
    x0_guess = cycles[len(cycles) // 2]  # Midpoint
    B_guess = rfu.min()  # Baseline
    
    print(f"   Initial guesses:")
    print(f"     L (amplitude): {L_guess:.3f}")
    print(f"     k (steepness): {k_guess:.3f}")
    print(f"     x0 (midpoint): {x0_guess:.3f}")
    print(f"     B (baseline): {B_guess:.3f}")
    
    # Bounds (from qpcr_analyzer.py)
    cycle_range = cycles.max() - cycles.min()
    bounds = (
        [rfu_range * 0.1, 0.01, cycles.min(), rfu.min() - rfu_range * 0.1],  # Lower bounds
        [rfu_range * 5, 10, cycles.max(), rfu.max()]  # Upper bounds
    )
    
    print(f"   Bounds:")
    print(f"     L: [{bounds[0][0]:.3f}, {bounds[1][0]:.3f}]")
    print(f"     k: [{bounds[0][1]:.3f}, {bounds[1][1]:.3f}]")
    print(f"     x0: [{bounds[0][2]:.3f}, {bounds[1][2]:.3f}]")
    print(f"     B: [{bounds[0][3]:.3f}, {bounds[1][3]:.3f}]")
    print()
    
    # Try curve fitting
    try:
        print("🔄 Attempting curve fitting...")
        popt, pcov = curve_fit(
            sigmoid, cycles, rfu,
            p0=[L_guess, k_guess, x0_guess, B_guess],
            bounds=bounds,
            maxfev=5000,
            method='trf'
        )
        
        # Calculate fitted curve
        fit_rfu = sigmoid(cycles, *popt)
        
        # Calculate R²
        r2 = r2_score(rfu, fit_rfu)
        
        # Calculate residuals
        residuals = rfu - fit_rfu
        rmse = np.sqrt(np.mean(residuals**2))
        
        print("✅ Curve fitting successful!")
        print(f"📈 Results:")
        print(f"   L (amplitude): {popt[0]:.3f}")
        print(f"   k (steepness): {popt[1]:.3f}")
        print(f"   x0 (midpoint): {popt[2]:.3f}")
        print(f"   B (baseline): {popt[3]:.3f}")
        print(f"   R² score: {r2:.6f}")
        print(f"   RMSE: {rmse:.3f}")
        
        # Analyze quality
        print(f"\n🎯 Quality Assessment:")
        print(f"   R² > 0.9: {'✅' if r2 > 0.9 else '❌'} ({r2:.6f})")
        print(f"   Steepness > 0.1: {'✅' if popt[1] > 0.1 else '❌'} ({popt[1]:.3f})")
        print(f"   Amplitude > 100: {'✅' if popt[0] > 100 else '❌'} ({popt[0]:.3f})")
        
        return True, r2, popt, fit_rfu
        
    except Exception as e:
        print(f"❌ Curve fitting failed: {e}")
        print(f"   This explains why A20 shows 'No Data' - the algorithm can't fit a sigmoid")
        print(f"   The data is too noisy/irregular for sigmoid curve fitting")
        
        # Try simpler linear fit for comparison
        try:
            print(f"\n🔄 Trying linear fit for comparison...")
            linear_coef = np.polyfit(cycles, rfu, 1)
            linear_fit = np.polyval(linear_coef, cycles)
            linear_r2 = r2_score(rfu, linear_fit)
            print(f"   Linear R²: {linear_r2:.6f}")
            print(f"   Slope: {linear_coef[0]:.6f}")
        except:
            print("   Linear fit also failed")
            
        return False, 0.0, None, None

if __name__ == "__main__":
    success, r2, params, fitted = analyze_a20_curve_fitting()
    
    if success:
        print(f"\n🎯 CONCLUSION: A20 curve fitting succeeds with R² = {r2:.6f}")
        print(f"   The issue might be in the qPCR analyzer's error handling or bounds")
    else:
        print(f"\n🎯 CONCLUSION: A20 curve fitting fails - data doesn't follow sigmoid pattern")
        print(f"   This is likely a genuinely negative/noisy sample that should be classified as NEGATIVE")
