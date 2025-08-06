import numpy as np
from scipy.optimize import curve_fit
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend for Railway deployment
import matplotlib.pyplot as plt
from sklearn.metrics import r2_score
import pandas as pd
import warnings
from curve_classification import classify_curve

warnings.filterwarnings('ignore')


def sigmoid(x, L, k, x0, B):
    """Sigmoid function for qPCR amplification curves"""
    return L / (1 + np.exp(-k * (x - x0))) + B


def detect_amplification_start(cycles, rfu, threshold_factor=0.1):
    """
    Detect when amplifi                             # FALLBACK TO RULE-BASED CLASSIFICATION
                analysis['curve_classification'] = classify_curve(
                    analysis.get('r2_score'),
                    analysis.get('steepness'),
                    analysis.get('quality_filters', {}).get('snr_check', {}).get('snr'),
                    analysis.get('midpoint'),
                    analysis.get('baseline'),
                    analysis.get('amplitude')
                )
                # Mark as rule-based method - confidence already calculated by classify_curve
                analysis['curve_classification']['method'] = 'Rule-based (ML failed)'
                print(f"🔄 Fallback Result: {analysis['curve_classification'].get('classification')} via Rule-based (confidence: {analysis['curve_classification'].get('confidence', 0.5):.3f})")K TO RULE-BASED CLASSIFICATION
                analysis['curve_classification'] = classify_curve(
                    analysis.get('r2_score'),
                    analysis.get('steepness'),
                    analysis.get('quality_filters', {}).get('snr_check', {}).get('snr'),
                    analysis.get('midpoint'),
                    analysis.get('baseline'),
                    analysis.get('amplitude')
                )
                # Mark as rule-based method and ensure confidence is present
                analysis['curve_classification']['method'] = 'Rule-based (ML failed)'
                if 'confidence' not in analysis['curve_classification']:
                    analysis['curve_classification']['confidence'] = 0.5  # Default fallback confidence
                print(f"🔄 Fallback Result: {analysis['curve_classification'].get('classification')} via Rule-based (confidence: {analysis['curve_classification'].get('confidence', 0.5):.3f})")lly starts
    Returns the cycle number where significant amplification begins
    """
    cycles = np.array(cycles)
    rfu = np.array(rfu)

    # Calculate baseline (first few cycles)
    baseline = np.mean(rfu[:5])
    baseline_std = np.std(rfu[:5])

    # Define threshold as baseline + some factor of max signal
    threshold = baseline + (threshold_factor * np.max(rfu))

    # Find first cycle where signal exceeds threshold consistently
    for i in range(len(rfu) - 2):
        if (rfu[i] > threshold and 
            rfu[i+1] > threshold and 
            rfu[i+2] > threshold):
            return cycles[i]  # Return actual cycle number

    return cycles[-1] if len(cycles) > 0 else 999  # If no clear start found


def check_minimum_amplitude(rfu, min_amplitude_threshold=100):
    """
    Check if the curve has sufficient amplitude to be considered real amplification
    """
    baseline = np.mean(rfu[:5])  # First 5 cycles as baseline
    max_signal = np.max(rfu)

    amplitude = max_signal - baseline

    return {
        'amplitude': amplitude,
        'baseline': baseline,
        'max_signal': max_signal,
        'passes_amplitude_filter': amplitude >= min_amplitude_threshold
    }


def check_plateau_significance(rfu, min_plateau_rfu=50):
    """
    Check if the plateau level is significantly above zero/baseline
    """
    # Get plateau (last 25% of cycles)
    plateau_start = int(len(rfu) * 0.75)
    plateau_values = rfu[plateau_start:]
    plateau_level = np.mean(plateau_values)

    # Check if plateau is above minimum RFU threshold
    plateau_significant = plateau_level >= min_plateau_rfu

    return {
        'plateau_level': plateau_level,
        'plateau_cycles': len(plateau_values),
        'passes_plateau_filter': plateau_significant
    }


def check_signal_to_noise(rfu, min_snr=3.0):
    """
    Check if signal-to-noise ratio indicates real amplification
    """
    # Baseline statistics (first 5 cycles)
    baseline_values = rfu[:5]
    baseline_mean = np.mean(baseline_values)
    baseline_std = np.std(baseline_values)

    # Signal level (plateau region)
    plateau_start = int(len(rfu) * 0.75)
    signal_level = np.mean(rfu[plateau_start:])

    # Calculate SNR with improved logic for baseline-subtracted data
    amplitude = signal_level - baseline_mean
    
    if baseline_std > 0.01:  # Use standard SNR calculation when there's measurable noise
        snr = amplitude / baseline_std
    else:
        # For very stable baselines (low noise), use amplitude-based calculation
        # Handle baseline-subtracted data where baseline_mean can be negative
        baseline_abs = abs(baseline_mean) if baseline_mean != 0 else 1.0
        
        if amplitude > 0:
            # Use amplitude relative to baseline magnitude for SNR
            snr = amplitude / baseline_abs
        else:
            snr = 0
        
        # For baseline-subtracted data, ensure reasonable SNR scaling
        if amplitude > 100:  # Significant amplification (>100 RFU)
            snr = max(snr, 5.0)  # Minimum SNR for clear amplification
        elif amplitude > 50:  # Moderate amplification
            snr = max(snr, 3.0)  # Minimum SNR for moderate amplification
        elif amplitude > 20:  # Weak amplification  
            snr = max(snr, 1.5)  # Minimum SNR for weak amplification
    
    # Debug output for SNR calculation issues (including baseline-subtracted data)
    if snr <= 0:
        print(f"🔍 SNR Debug: baseline_mean={baseline_mean:.2f}, baseline_std={baseline_std:.4f}, "
              f"signal_level={signal_level:.2f}, amplitude={amplitude:.2f}, calculated_snr={snr:.2f}")
        print(f"   Note: For baseline-subtracted data, negative baseline_mean is normal")

    return {
        'baseline_mean': baseline_mean,
        'baseline_std': baseline_std,
        'signal_level': signal_level,
        'snr': max(snr, 0.1),  # Ensure SNR is never zero or negative
        'passes_snr_filter': snr >= min_snr
    }


def check_exponential_growth(rfu, min_max_growth_rate=5.0):
    """
    Check if there's sufficient exponential growth (not just drift)
    """
    # Calculate cycle-to-cycle differences
    growth_rates = np.diff(rfu)
    max_growth_rate = np.max(growth_rates)

    # Count cycles with significant growth
    significant_growth_cycles = len([rate for rate in growth_rates if rate > max_growth_rate * 0.3])

    return {
        'max_growth_rate': max_growth_rate,
        'significant_growth_cycles': significant_growth_cycles,
        'passes_growth_filter': max_growth_rate >= min_max_growth_rate
    }


def analyze_curve_quality(cycles, rfu, plot=False, 
                         # Quality filter parameters
                         min_start_cycle=5,
                         min_amplitude=100,
                         min_plateau_rfu=50,
                         min_snr=3.0,
                         min_growth_rate=5.0,
                         threshold_factor=10.0):
    """Analyze if a curve matches S-shaped pattern and return quality metrics
    threshold_factor: multiplier for baseline std to set threshold line (default 10.0)
    """
    try:
        # Ensure we have enough data points
        if len(cycles) < 5 or len(rfu) < 5:
            return {
                'error': 'Insufficient data points',
                'is_good_scurve': False
            }

        # Convert to numpy arrays
        cycles = np.array(cycles)
        rfu = np.array(rfu)

        # Remove any NaN or infinite values
        valid_indices = np.isfinite(cycles) & np.isfinite(rfu)
        cycles = cycles[valid_indices]
        rfu = rfu[valid_indices]

        if len(cycles) < 5:
            return {
                'error': 'Insufficient valid data points',
                'is_good_scurve': False
            }

        # Calculate exponential phase threshold (inflection point of sigmoid)
        baseline = np.mean(rfu[:5])
        baseline_std = np.std(rfu[:5])
        # threshold_value will be set after sigmoid fit (see below)
        threshold_value = None  # placeholder

        # Dynamic initial parameter guesses based on data characteristics
        rfu_range = np.max(rfu) - np.min(rfu)
        L_guess = rfu_range * 1.1  # Amplitude with some buffer
        k_guess = 0.5  # Steepness - start conservative
        x0_guess = cycles[len(cycles) // 2]  # Midpoint
        B_guess = np.min(rfu)  # Baseline

        # Adaptive bounds based on data
        cycle_range = np.max(cycles) - np.min(cycles)
        bounds = (
            [
                rfu_range * 0.1, 0.01,
                np.min(cycles),
                np.min(rfu) - rfu_range * 0.1
            ],  # Lower bounds
            [rfu_range * 5, 10, np.max(cycles),
             np.max(rfu)]  # Upper bounds
        )

        # Fit sigmoid with bounds
        popt, pcov = curve_fit(sigmoid,
                               cycles,
                               rfu,
                               p0=[L_guess, k_guess, x0_guess, B_guess],
                               bounds=bounds,
                               maxfev=5000,
                               method='trf')

        # Calculate fit quality
        fit_rfu = sigmoid(cycles, *popt)
        r2 = r2_score(rfu, fit_rfu)

        # Calculate residuals
        residuals = rfu - fit_rfu
        rmse = np.sqrt(np.mean(residuals**2))

        # Extract parameters
        L, k, x0, B = popt

        # --- Exponential phase targeting for threshold ---
        # Inflection point (steepest slope) for sigmoid: RFU = L/2 + B
        exp_phase_threshold = L / 2 + B
        # Ensure threshold is within 10-90% of max RFU (exponential phase window)
        min_thresh = B + 0.10 * (L)
        max_thresh = B + 0.90 * (L)
        threshold_value = min(max(exp_phase_threshold, min_thresh), max_thresh)

        # Calculate additional steepness focusing on post-cycle 8 exponential phase
        post_cycle8_mask = cycles >= 8
        if np.sum(post_cycle8_mask) >= 3:  # Need at least 3 points after cycle 8
            cycles_post8 = cycles[post_cycle8_mask]

            # Calculate derivative (steepness) at each point after cycle 8
            steepness_values = []
            for cycle in cycles_post8:
                # Derivative of sigmoid: L*k*exp(-k*(x-x0)) / (1 + exp(-k*(x-x0)))^2
                exp_term = np.exp(-k * (cycle - x0))
                derivative = L * k * exp_term / ((1 + exp_term) ** 2)
                steepness_values.append(derivative)

            # Use maximum steepness in the exponential phase
            post_cycle8_steepness = max(steepness_values) if steepness_values else k
        else:
            # Fallback to original steepness if insufficient post-cycle 8 data
            post_cycle8_steepness = k

        # === NEW QUALITY FILTERS ===
        # Check amplification start cycle
        amplification_start_cycle = detect_amplification_start(cycles, rfu)
        start_cycle_valid = amplification_start_cycle >= min_start_cycle

        # Check minimum amplitude
        amplitude_check = check_minimum_amplitude(rfu, min_amplitude)

        # Check plateau significance
        plateau_check = check_plateau_significance(rfu, min_plateau_rfu)

        # Check signal-to-noise ratio
        snr_check = check_signal_to_noise(rfu, min_snr)

        # Check exponential growth
        growth_check = check_exponential_growth(rfu, min_growth_rate)

        # Combine all quality checks
        all_quality_checks_pass = all([
            start_cycle_valid,
            amplitude_check['passes_amplitude_filter'],
            plateau_check['passes_plateau_filter'],
            snr_check['passes_snr_filter'],
            growth_check['passes_growth_filter']
        ])

        # Dynamic quality criteria based on data characteristics (ORIGINAL LOGIC)
        min_amplitude_original = max(50, rfu_range * 0.3)  # Adaptive amplitude threshold
        r2_threshold = 0.9 if len(cycles) > 20 else 0.85  # Relaxed for shorter runs

        # Original S-curve quality criteria
        original_s_curve_criteria = bool(r2 > r2_threshold and k > 0.05 and L > min_amplitude_original)

        # ENHANCED FINAL CLASSIFICATION: Use original criteria for high-quality curves
        # If original criteria pass with very high confidence, don't apply strict filters
        high_confidence_curve = (r2 > 0.99 and L > 1000 and k > 0.1)
        
        if high_confidence_curve:
            # For obviously excellent curves, use original criteria only
            enhanced_is_good_scurve = original_s_curve_criteria
        else:
            # For borderline curves, apply additional quality filters
            enhanced_is_good_scurve = original_s_curve_criteria and all_quality_checks_pass

        # Determine rejection reason
        rejection_reason = None
        if not original_s_curve_criteria:
            if r2 <= r2_threshold:
                rejection_reason = f"Poor R² fit ({r2:.3f} <= {r2_threshold})"
            elif k <= 0.05:
                rejection_reason = f"Insufficient steepness ({k:.4f} <= 0.05)"
            elif L <= min_amplitude_original:
                rejection_reason = f"Insufficient amplitude ({L:.1f} <= {min_amplitude_original:.1f})"
        elif not start_cycle_valid:
            rejection_reason = f"Amplification starts too early (cycle {amplification_start_cycle:.1f} < {min_start_cycle})"
        elif not amplitude_check['passes_amplitude_filter']:
            rejection_reason = f"Insufficient amplitude ({amplitude_check['amplitude']:.1f} < {min_amplitude})"
        elif not plateau_check['passes_plateau_filter']:
            rejection_reason = f"Plateau too low ({plateau_check['plateau_level']:.1f} < {min_plateau_rfu})"
        elif not snr_check['passes_snr_filter']:
            rejection_reason = f"Poor signal-to-noise ratio ({snr_check['snr']:.1f} < {min_snr})"
        elif not growth_check['passes_growth_filter']:
            rejection_reason = f"Insufficient growth rate ({growth_check['max_growth_rate']:.1f} < {min_growth_rate})"

        # Quality criteria for S-curve identification - convert numpy types to Python types
        criteria = {
            'r2_score': float(r2),
            'rmse': float(rmse),
            'amplitude': float(L),
            'steepness': float(k),
            'midpoint': float(x0),
            'baseline': float(B),

            # ORIGINAL CLASSIFICATION (commented but preserved)
            # 'is_good_scurve': bool(r2 > r2_threshold and k > 0.05 and L > min_amplitude_original),

            # ENHANCED CLASSIFICATION WITH QUALITY FILTERS
            'is_good_scurve': enhanced_is_good_scurve,
            'original_s_curve_criteria': original_s_curve_criteria,

            # Quality filter results
            'quality_filters': {
                'amplification_start_cycle': float(amplification_start_cycle),
                'start_cycle_valid': start_cycle_valid,
                'amplitude_check': amplitude_check,
                'plateau_check': plateau_check,
                'snr_check': snr_check,
                'growth_check': growth_check,
                'all_quality_checks_pass': all_quality_checks_pass
            },
            
            # Add SNR as a top-level field for ML classification
            'snr': float(snr_check['snr']),
            
            'rejection_reason': rejection_reason,

            'fit_parameters': [float(x) for x in popt],
            'parameter_errors': [float(x) for x in np.sqrt(np.diag(pcov))],
            'fitted_curve': [float(x) for x in fit_rfu],
            'data_points': int(len(cycles)),
            'cycle_range': float(cycle_range),
            'anomalies': detect_curve_anomalies(cycles, rfu),
            'raw_cycles': [float(x) for x in cycles],
            'raw_rfu': [float(x) for x in rfu],
            'residuals': [float(x) for x in residuals],
            'post_cycle8_steepness': float(post_cycle8_steepness),

            # Add threshold_value to criteria for frontend use
            'threshold_value': float(threshold_value)
        }

        if plot:
            plt.figure(figsize=(15, 10))

            # Main plot - curve fitting
            plt.subplot(2, 3, 1)
            plt.plot(cycles, rfu, 'bo', label='Data', markersize=4)
            plt.plot(cycles,
                     fit_rfu,
                     'r-',
                     label='Sigmoid Fit (R²={:.3f})'.format(r2),
                     linewidth=2)
            # Add threshold line
            plt.axhline(y=threshold_value, color='orange', linestyle='--', label=f'Threshold ({threshold_value:.1f})')
            plt.xlabel('Cycle')
            plt.ylabel('RFU')
            plt.legend()
            plt.title('qPCR Amplification Curve\nEnhanced Good S-curve: {}'.format(
                criteria['is_good_scurve']))
            plt.grid(True, alpha=0.3)

            # Residuals plot
            plt.subplot(2, 3, 2)
            plt.plot(cycles, residuals, 'go-', markersize=3)
            plt.axhline(y=0, color='r', linestyle='--', alpha=0.7)
            plt.xlabel('Cycle')
            plt.ylabel('Residuals')
            plt.title('Fit Residuals (RMSE: {:.2f})'.format(rmse))
            plt.grid(True, alpha=0.3)

            # Logarithmic scale plot for exponential phase analysis
            plt.subplot(2, 3, 3)
            plt.semilogy(cycles, rfu, 'bo', markersize=3, label='Data')
            plt.semilogy(cycles, fit_rfu, 'r-', linewidth=2, label='Fit')
            plt.xlabel('Cycle')
            plt.ylabel('RFU (log scale)')
            plt.title('Exponential Phase Analysis')
            plt.grid(True, alpha=0.3)
            plt.legend()

            # Parameters display
            plt.subplot(2, 3, 4)
            plt.axis('off')
            param_errors = np.sqrt(np.diag(pcov))
            param_text = f"""Curve Parameters:
Amplitude (L): {L:.2f} ± {param_errors[0]:.2f}
Steepness (k): {k:.4f} ± {param_errors[1]:.4f}
Midpoint (x0): {x0:.2f} ± {param_errors[2]:.2f}
Baseline (B): {B:.2f} ± {param_errors[3]:.2f}

Quality Metrics:
R² Score: {r2:.4f}
RMSE: {rmse:.2f}
Data Points: {len(cycles)}
Cycle Range: {int(min(cycles))}-{int(max(cycles))}

Quality Filters:
Start Cycle: {amplification_start_cycle:.1f} (≥{min_start_cycle}: {start_cycle_valid})
Amplitude: {amplitude_check['amplitude']:.1f} (≥{min_amplitude}: {amplitude_check['passes_amplitude_filter']})
Plateau: {plateau_check['plateau_level']:.1f} (≥{min_plateau_rfu}: {plateau_check['passes_plateau_filter']})
SNR: {snr_check['snr']:.1f} (≥{min_snr}: {snr_check['passes_snr_filter']})
Growth: {growth_check['max_growth_rate']:.1f} (≥{min_growth_rate}: {growth_check['passes_growth_filter']})"""

            anomalies = criteria['anomalies']
            if anomalies:
                param_text += f"\n\nAnomalies Detected:\n{', '.join(anomalies)}"
            else:
                param_text += "\n\nNo anomalies detected"

            if rejection_reason:
                param_text += f"\n\nRejection Reason:\n{rejection_reason}"

            plt.text(0.05,
                     0.95,
                     param_text,
                     transform=plt.gca().transAxes,
                     verticalalignment='top',
                     fontfamily='monospace',
                     fontsize=8)

            # Derivative analysis - rate of change
            plt.subplot(2, 3, 5)
            if len(cycles) > 2:
                derivative = np.gradient(rfu, cycles)
                plt.plot(cycles, derivative, 'mo-', markersize=3)
                plt.xlabel('Cycle')
                plt.ylabel('dRFU/dCycle')
                plt.title('Rate of Change Analysis')
                plt.grid(True, alpha=0.3)

            # Quality assessment visualization
            plt.subplot(2, 3, 6)
            plt.axis('off')
            quality_metrics = [
                ('R² Score', r2, 0.9), 
                ('Steepness', k, 0.1),
                ('Amplitude', L / max(100, rfu_range), 0.3),
                ('Start Cycle', 1.0 if start_cycle_valid else 0.0, 0.5),
                ('SNR', min(snr_check['snr']/min_snr, 1.0), 0.5),
                ('Growth Rate', min(growth_check['max_growth_rate']/min_growth_rate, 1.0), 0.5)
            ]

            y_pos = np.arange(len(quality_metrics))
            values = [m[1] for m in quality_metrics]
            thresholds = [m[2] for m in quality_metrics]
            colors = [
                'green' if v >= t else 'red'
                for v, t in zip(values, thresholds)
            ]

            plt.barh(y_pos, values, color=colors, alpha=0.7)
            plt.axvline(x=0.5, color='black', linestyle='--', alpha=0.5)
            plt.yticks(y_pos, [m[0] for m in quality_metrics])
            plt.xlabel('Quality Score')
            plt.title('Enhanced Quality Assessment')
            plt.xlim(0, max(1.0, max(values) * 1.1))

            plt.tight_layout()
            plt.show()

        return criteria

    except Exception as e:
        return {'error': str(e), 'is_good_scurve': False}


def batch_analyze_wells(data_dict, **quality_filter_params):
    """Analyze multiple wells/samples for S-curve patterns with quality filters"""
    results = {}
    good_curves = []
    cycle_info = None


    # --- Import new CQJ/CalcJ utils ---
    from cqj_calcj_utils import calculate_cqj as py_cqj, calculate_calcj as py_calcj

    for well_id, data in data_dict.items():
        cycles = data['cycles']
        rfu = data['rfu']

        # Ensure fluorophore/channel is present for each well
        channel_name = data.get('fluorophore')
        if not channel_name:
            # Extract fluorophore from well_id if available (e.g., "A1_HEX" -> "HEX")
            if '_' in well_id and len(well_id.split('_')) >= 2:
                potential_fluorophore = well_id.split('_')[-1]
                # Validate it's a known fluorophore
                if potential_fluorophore in ['FAM', 'HEX', 'Texas Red', 'Cy5', 'TexasRed']:
                    channel_name = potential_fluorophore
                else:
                    channel_name = 'Unknown'
            else:
                channel_name = 'Unknown'  # Don't default to FAM
            data['fluorophore'] = channel_name

        # Store cycle info from first well - convert to Python types
        if cycle_info is None and len(cycles) > 0:
            cycle_info = {
                'min': int(min(cycles)),
                'max': int(max(cycles)),
                'count': int(len(cycles))
            }

        # Pass quality filter parameters to analysis
        analysis = analyze_curve_quality(cycles, rfu, **quality_filter_params)

        # Add anomaly detection
        anomalies = detect_curve_anomalies(cycles, rfu)
        analysis['anomalies'] = anomalies
        # Add curve classification - ML ENABLED WITH CONFIDENCE SAFEGUARDS + RULE-BASED FALLBACK
        if 'error' in analysis:
            analysis['curve_classification'] = {
                'classification': 'No Data',
                'reason': analysis.get('error', 'Invalid or missing data'),
                'confidence': 0.1,  # Very low confidence for error cases
                'review_flag': True,
                'method': 'Error'
            }
        else:
            # TRY ML CLASSIFICATION WITH CONFIDENCE SAFEGUARDS FIRST
            try:
                from ml_curve_classifier import ml_classifier
                
                # Get pathogen from test_code if available
                pathogen = None
                test_code = data.get('test_code', None)
                if test_code:
                    pathogen = test_code
                
                # Prepare comprehensive metrics for ML classifier (30+ metrics)
                ml_metrics = analysis.copy()
                # Add CQJ value if we have a threshold
                threshold = analysis.get('threshold_value')
                if threshold is not None:
                    well_for_cqj = {
                        'raw_cycles': analysis.get('raw_cycles'),
                        'raw_rfu': analysis.get('raw_rfu'),
                        'cycles': cycles,
                        'rfu': rfu
                    }
                    cqj_val = py_cqj(well_for_cqj, threshold)
                    ml_metrics['cqj'] = cqj_val
                
                print(f"🤖 ML Analysis: Attempting ML classification for {well_id} with {len(ml_metrics)} metrics")
                ml_result = ml_classifier.predict_classification(
                    rfu, cycles, ml_metrics, pathogen, well_id
                )
                analysis['curve_classification'] = ml_result
                print(f"🤖 ML Result: {ml_result.get('classification')} via {ml_result.get('method')} (confidence: {ml_result.get('confidence', 'N/A')})")
                
            except Exception as e:
                print(f"⚠️ ML Failed for {well_id}: {e}")
                print(f"🔄 Falling back to rule-based classification")
                # FALLBACK TO RULE-BASED CLASSIFICATION
                analysis['curve_classification'] = classify_curve(
                    analysis.get('r2_score'),
                    analysis.get('steepness'),
                    analysis.get('quality_filters', {}).get('snr_check', {}).get('snr'),
                    analysis.get('midpoint'),
                    analysis.get('baseline'),
                    analysis.get('amplitude')
                )
                # Mark as rule-based method
                analysis['curve_classification']['method'] = 'Rule-based (ML failed)'
                print(f"� Fallback Result: {analysis['curve_classification'].get('classification')} via Rule-based")

        # --- Per-channel CQJ/CalcJ integration (dict, robust) ---
        # Prepare well dict for CQJ/CalcJ utils
        well_for_cqj = {
            'raw_cycles': analysis.get('raw_cycles'),
            'raw_rfu': analysis.get('raw_rfu'),
            'amplitude': analysis.get('amplitude')
        }
        threshold = analysis.get('threshold_value')
        cqj_val = py_cqj(well_for_cqj, threshold) if threshold is not None else None
        # CalcJ calculation moved to frontend - backend should not calculate it
        # calcj_val = py_calcj(well_for_cqj, threshold) if threshold is not None else None

        # Store as dict for per-channel support (even if only one channel)
        analysis['cqj'] = {channel_name: cqj_val}
        # analysis['calcj'] = {channel_name: calcj_val}

        from app import get_pathogen_target
        test_code = data.get('test_code', None)
        analysis['pathogen_target'] = get_pathogen_target(test_code, channel_name) if test_code else channel_name

        results[well_id] = analysis

        if analysis.get('is_good_scurve', False):
            good_curves.append(well_id)

    # <-- The return statement should be here, outside the for-loop!
    return {
        'individual_results': results,
        'good_curves': good_curves,
        'cycle_info': cycle_info,
        'summary': {
            'total_wells': len(results),
            'good_curves': len(good_curves),
            'success_rate': len(good_curves) / len(results) * 100 if len(results) > 0 else 0,
            'quality_filter_params': quality_filter_params
        }
    }
def detect_curve_anomalies(cycles, rfu):
    """Detect common qPCR curve problems - adapted for variable cycle counts"""
    anomalies = []

    if len(cycles) < 5 or len(rfu) < 5:
        anomalies.append('insufficient_data')
        return anomalies

    cycles = np.array(cycles)
    rfu = np.array(rfu)

    # Remove NaN values
    valid_indices = np.isfinite(cycles) & np.isfinite(rfu)
    cycles = cycles[valid_indices]
    rfu = rfu[valid_indices]

    if len(cycles) < 5:
        anomalies.append('insufficient_valid_data')
        return anomalies

    rfu_range = np.max(rfu) - np.min(rfu)

    # Check for plateau curves (no exponential phase) - adaptive threshold
    min_amplitude = max(50, rfu_range * 0.1)
    if rfu_range < min_amplitude:
        anomalies.append('low_amplitude')

    # Check for early plateau - adaptive to cycle count
    plateau_check_point = min(len(rfu) // 2, len(rfu) - 5)
    if plateau_check_point > 0:
        plateau_std = np.std(rfu[plateau_check_point:])
        if plateau_std < max(20, rfu_range * 0.05):
            anomalies.append('early_plateau')

    # Check for irregular baseline - EXCLUDE first 5 cycles from baseline calculation
    # Original version (preserved):
    # baseline_points = max(3, len(rfu) // 5)
    # baseline_rfu = rfu[:baseline_points]
    # baseline_std = np.std(baseline_rfu)
    # if baseline_std > max(50, rfu_range * 0.15):
    #     anomalies.append('unstable_baseline')

    # New version: exclude first 5 cycles from baseline calculation
    baseline_points = max(3, len(rfu) // 5)
    baseline_start = 5 if len(rfu) > 5 else 0
    baseline_end = baseline_start + baseline_points
    baseline_rfu = rfu[baseline_start:baseline_end]
    if len(baseline_rfu) > 0:
        baseline_std = np.std(baseline_rfu)
        if baseline_std > max(50, rfu_range * 0.15):
            anomalies.append('unstable_baseline')

    # Check for negative amplification in potential exponential phase
    exp_start = max(baseline_points, len(rfu) // 4)
    exp_end = min(len(rfu) - 1, exp_start + len(rfu) // 3)
    if exp_end > exp_start:
        exp_phase_rfu = rfu[exp_start:exp_end]
        if len(exp_phase_rfu) > 2:
            max_decrease = np.min(np.diff(exp_phase_rfu))
            if max_decrease < -max(30, rfu_range * 0.1):
                anomalies.append('negative_amplification')

    # Check for data quality issues
    if np.any(rfu < 0):
        # Don't flag as anomaly if RFU stays consistently negative (baseline offset)
        # or if amplitude is substantial (>50), indicating real amplification despite negative baseline
        # or if curve has negative values but maximum is low (<20), indicating baseline offset
        all_negative = np.all(rfu < 0)
        amplitude_substantial = rfu_range > 50
        low_maximum_with_negatives = np.any(rfu < 0) and np.max(rfu) < 20  # Extended from 10 to 20

        if not (all_negative or amplitude_substantial or low_maximum_with_negatives):
            anomalies.append('negative_rfu_values')

    # Check for extremely high noise
    if len(rfu) > 5:
        noise_level = np.std(np.diff(rfu))
        if noise_level > rfu_range * 0.3:
            anomalies.append('high_noise')

    # Filter out negative-related anomalies before returning
    filtered_anomalies = [anomaly for anomaly in anomalies 
                         if anomaly not in ['negative_rfu_values', 'negative_amplification']]
    
    return filtered_anomalies


def process_csv_data(data_dict, **quality_filter_params):
    """Process uploaded CSV data and perform comprehensive analysis with quality filters"""
    try:
        if not data_dict:
            return {'error': 'No data provided', 'success': False}

        print(f"Processing {len(data_dict)} wells for analysis")

        # Perform batch analysis with quality filters
        results = batch_analyze_wells(data_dict, **quality_filter_params)
        print(
            f"Batch analysis completed, found {len(results.get('good_curves', []))} good curves"
        )

        # Add processing metadata
        results['processing_info'] = {
            'data_points_per_well':
            len(list(data_dict.values())[0]['cycles']) if data_dict else 0,
            'processing_timestamp':
            pd.Timestamp.now().isoformat(),
            'total_wells_processed':
            len(data_dict),
            'quality_filters_applied': quality_filter_params
        }

        results['success'] = True
        return results

    except Exception as e:
        return {'error': str(e), 'success': False}


def validate_csv_structure(data_dict):
    """Validate the structure of uploaded CSV data"""
    errors = []
    warnings = []

    if not data_dict:
        errors.append("No data provided")
        return errors, warnings

    # Check each well
    for well_id, well_data in data_dict.items():
        if 'cycles' not in well_data or 'rfu' not in well_data:
            errors.append(f"Well {well_id}: Missing cycles or rfu data")
            continue

        cycles = well_data['cycles']
        rfu = well_data['rfu']

        if len(cycles) != len(rfu):
            errors.append(
                f"Well {well_id}: Cycles and RFU data length mismatch")
            continue

        if len(cycles) < 5:
            warnings.append(
                f"Well {well_id}: Very few data points ({len(cycles)})")

        # Check for reasonable cycle values
        if len(cycles) > 0:
            if min(cycles) < 0 or max(cycles) > 100:
                warnings.append(
                    f"Well {well_id}: Unusual cycle range ({min(cycles)}-{max(cycles)})"
                )

        # Check for reasonable RFU values
        if len(rfu) > 0:
            if any(val < 0 for val in rfu):
                warnings.append(
                    f"Well {well_id}: Contains negative RFU values")

    return errors, warnings


# Export functionality for results
def export_results_to_csv(results, filename="qpcr_analysis_results.csv"):
    """Export analysis results to CSV format"""
    if 'individual_results' not in results:
        return None

    export_data = []
    for well_id, well_result in results['individual_results'].items():
        quality_filters = well_result.get('quality_filters', {})

        row = {
            'Well': well_id,
            'Status': 'Good' if well_result.get('is_good_scurve', False) else 'Poor',
            'Original_S_Curve': well_result.get('original_s_curve_criteria', 'N/A'),
            'Enhanced_Classification': well_result.get('is_good_scurve', False),
            'Rejection_Reason': well_result.get('rejection_reason', ''),
            'R2_Score': well_result.get('r2_score', 'N/A'),
            'RMSE': well_result.get('rmse', 'N/A'),
            'Amplitude': well_result.get('amplitude', 'N/A'),
            'Steepness': well_result.get('steepness', 'N/A'),
            'Midpoint': well_result.get('midpoint', 'N/A'),
            'Baseline': well_result.get('baseline', 'N/A'),
            'Data_Points': well_result.get('data_points', 'N/A'),
            'Cycle_Range': well_result.get('cycle_range', 'N/A'),
            'Start_Cycle': quality_filters.get('amplification_start_cycle', 'N/A'),
            'Plateau_Level': quality_filters.get('plateau_check', {}).get('plateau_level', 'N/A'),
            'SNR': quality_filters.get('snr_check', {}).get('snr', 'N/A'),
            'Max_Growth_Rate': quality_filters.get('growth_check', {}).get('max_growth_rate', 'N/A'),
            'Anomalies': ';'.join(well_result.get('anomalies', []))
        }
        export_data.append(row)

    df = pd.DataFrame(export_data)
    df.to_csv(filename, index=False)
    return df


def main():
    """Main function for testing the enhanced analyzer"""
    # Example with variable cycle counts
    print('=== Enhanced qPCR S-Curve Analysis with Quality Filters ===')

    # Test with different scenarios including problematic curves
    test_cases = [
        {
            'name': 'Good Positive Curve',
            'cycles': list(range(1, 41)),
            'rfu': [50] * 10 + [60 + i * 15 for i in range(15)] + [300] * 15
        },
        {
            'name': 'Weak Curve (Negative to Zero)',
            'cycles': list(range(1, 41)),
            'rfu': [-10 + i * 0.5 for i in range(40)]  # Goes from -10 to ~10
        },
        {
            'name': 'Early Start Curve (Before Cycle 8)',
            'cycles': list(range(1, 41)),
            'rfu': [100 + i * 10 for i in range(40)]  # Starts amplifying immediately
        },
        {
            'name': 'Low Amplitude Curve',
            'cycles': list(range(1, 41)),
            'rfu': [20 + i * 1 for i in range(40)]  # Very low amplitude
        }
    ]

    for test_case in test_cases:
        print(f"\n--- {test_case['name']} ---")
        # Enable plotting for each test case
        results = analyze_curve_quality(test_case['cycles'], test_case['rfu'], plot=True)

        if 'error' in results:
            print(f'Error: {results["error"]}')
            continue

        print(f'Original S-curve Criteria: {results["original_s_curve_criteria"]}')
        print(f'Enhanced Classification: {results["is_good_scurve"]}')
        print(f'R² Score: {results["r2_score"]:.4f}')

        if results.get('rejection_reason'):
            print(f'Rejection Reason: {results["rejection_reason"]}')

        quality_filters = results['quality_filters']
        print(f'Start Cycle: {quality_filters["amplification_start_cycle"]}')
        print(f'Amplitude Check: {quality_filters["amplitude_check"]["amplitude"]:.1f}')
        print(f'Plateau Level: {quality_filters["plateau_check"]["plateau_level"]:.1f}')
        print(f'SNR: {quality_filters["snr_check"]["snr"]:.1f}')
        print(f'Growth Rate: {quality_filters["growth_check"]["max_growth_rate"]:.1f}')
        print('-' * 50)

def calculate_cqj(well_data, threshold):
    """Calculate Cq-J for a well: first cycle where RFU >= threshold."""
    cycles = well_data.get('cycles', [])
    rfu = well_data.get('rfu', [])
    for i, val in enumerate(rfu):
        if val >= threshold:
            return cycles[i]
    return None

def calculate_calcj(cqj, h_cq, m_cq, l_cq, h_val, m_val, l_val):
    """Calculate Calc-J using log-linear interpolation between H, M, L controls."""
    # Requires all Cq and value controls to be present
    if None in (cqj, h_cq, m_cq, l_cq, h_val, m_val, l_val):
        return None
    # Log-linear interpolation (standard curve):
    # log10(conc) = slope * (Cq - intercept)
    # For now, use two-point slope between H and L
    try:
        import math
        slope = (math.log10(h_val) - math.log10(l_val)) / (l_cq - h_cq)
        intercept = math.log10(h_val) - slope * h_cq
        log_conc = slope * cqj + intercept
        return 10 ** log_conc
    except Exception:
        return None

# In batch_analyze_wells or after per-well analysis:
# For each well, after analysis, add:
#   well_result['cqj'] = {channel: cqj_value, ...}
#   well_result['calcj'] = {channel: calcj_value, ...}
# (You will need to pass thresholds and control Cq/values per channel from your pipeline.)

if __name__ == "__main__":
    main()