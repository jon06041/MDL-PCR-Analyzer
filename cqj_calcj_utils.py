"""
CQJ/CalcJ calculation utilities for qPCR analysis
"""

from typing import List, Optional, Dict, Any
import numpy as np

# Import centralized concentration controls
try:
    from config_loader import CONCENTRATION_CONTROLS
except ImportError:
    print("[CONFIG-WARNING] Could not import centralized config, using fallback values")
    # Fallback values if config loader fails - MUST match config/concentration_controls.json
    CONCENTRATION_CONTROLS = {
        # Lacto has special lower concentrations
        'Lacto': {
            'Cy5': {'H': 1e6, 'M': 1e4, 'L': 1e2}, 'FAM': {'H': 1e6, 'M': 1e4, 'L': 1e2},
            'HEX': {'H': 1e6, 'M': 1e4, 'L': 1e2}, 'TexasRed': {'H': 1e6, 'M': 1e4, 'L': 1e2}
        },
        # Standard concentrations (1e7, 1e5, 1e3)
        'Calb': {'HEX': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 
        'Ctrach': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'Ngon': {'HEX': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 
        'Tvag': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'Cglab': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 
        'Cpara': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'Ctrop': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 
        'Gvag': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'BVAB2': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 
        'CHVIC': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'AtopVag': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 
        'Megasphaera': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}, 'HEX': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'Efaecalis': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 
        'Saureus': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'Ecoli': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 
        'AtopVagNY': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'BVAB2NY': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 
        'GvagNY': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'MegasphaeraNY': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}, 'HEX': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'LactoNY': {'Cy5': {'H': 1e7, 'M': 1e5, 'L': 1e3}, 'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}, 'HEX': {'H': 1e7, 'M': 1e5, 'L': 1e3}, 'TexasRed': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'RNaseP': {'HEX': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'Mgen': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        # BVPanel tests have higher concentrations (1e8, 1e6, 1e4)
        'BVPanelPCR3': {
            'FAM': {'H': 1e8, 'M': 1e6, 'L': 1e4}, 'HEX': {'H': 1e8, 'M': 1e6, 'L': 1e4},
            'TexasRed': {'H': 1e8, 'M': 1e6, 'L': 1e4}, 'Cy5': {'H': 1e8, 'M': 1e6, 'L': 1e4}
        },
        'BVPanelPCR2': {
            'FAM': {'H': 1e8, 'M': 1e6, 'L': 1e4}, 'HEX': {'H': 1e8, 'M': 1e6, 'L': 1e4},
            'TexasRed': {'H': 1e8, 'M': 1e6, 'L': 1e4}, 'Cy5': {'H': 1e8, 'M': 1e6, 'L': 1e4}
        },
        'BVPanelPCR1': {
            'FAM': {'H': 1e8, 'M': 1e6, 'L': 1e4}, 'HEX': {'H': 1e8, 'M': 1e6, 'L': 1e4},
            'TexasRed': {'H': 1e8, 'M': 1e6, 'L': 1e4}, 'Cy5': {'H': 1e8, 'M': 1e6, 'L': 1e4}
        },
        'BVAB': {
            'FAM': {'H': 1e8, 'M': 1e6, 'L': 1e4}, 'HEX': {'H': 1e8, 'M': 1e6, 'L': 1e4}, 'Cy5': {'H': 1e8, 'M': 1e6, 'L': 1e4}
        }
    }

def calculate_cqj_simple(rfu: List[float], cycles: List[float], threshold: float) -> Optional[float]:
    """
    Calculate the cycle at which RFU crosses the threshold (linear interpolation).
    Skips first 5 cycles for baseline noise reduction.
    """
    start_cycle = 5
    for i in range(start_cycle, len(rfu)):
        if rfu[i] >= threshold:
            if i == start_cycle:
                return cycles[i]
            prev_rfu = rfu[i - 1]
            prev_cycle = cycles[i - 1]
            if rfu[i] == prev_rfu:
                return cycles[i]
            # Linear interpolation
            interpolated_cq = prev_cycle + (threshold - prev_rfu) * (cycles[i] - prev_cycle) / (rfu[i] - prev_rfu)
            return interpolated_cq
    return None

def calculate_calcj_simple(amplitude: float, threshold: float) -> Optional[float]:
    """
    Example CalcJ calculation: amplitude / threshold
    """
    if threshold <= 0:
        return None
    return amplitude / threshold

# Add more CQJ/CalcJ related utilities as needed
# cqj_calcj_utils.py
"""
Utility functions to calculate CQ-J and Calc-J for a well given its data and a threshold.
Assumes well['raw_rfu'] (list of RFU values) and well['raw_cycles'] (list of cycle numbers).
"""

def calculate_cqj(well, threshold):
    """
    Calculate CQ-J for a well given a threshold.
    Returns the interpolated cycle number where RFU crosses the threshold, or None if never crossed.
    Skip early cycles to avoid baseline noise.
    """
    raw_rfu = well.get('raw_rfu')
    raw_cycles = well.get('raw_cycles')
    if not raw_rfu or not raw_cycles or len(raw_rfu) != len(raw_cycles):
        return None
    
    # Skip first 5 cycles to avoid baseline noise - threshold crossings before cycle 5 are ignored
    start_index = 5
    
    # Ensure we have enough data points after skipping early cycles
    if len(raw_rfu) <= start_index:
        # Try multiple ways to get well identifier: well_id, wellKey, or fallback
        well_id = well.get('well_id') or well.get('wellKey') or well.get('well_key') or 'UNKNOWN'
        print(f"[CQJ-DEBUG] Well {well_id}: Insufficient data after skipping first 5 cycles")
        return None
    
    # Find all valid threshold crossings, ignoring early crossings before cycle 5
    well_id = well.get('well_id') or well.get('wellKey') or well.get('well_key') or 'UNKNOWN'
    
    # Look for the first valid positive threshold crossing starting from cycle 5
    for i in range(start_index, len(raw_rfu)):
        if raw_rfu[i] >= threshold:
            # Check if this is the first valid cycle we're examining (cycle 5)
            if i == start_index:
                # If cycle 5 already exceeds threshold, check if previous cycle was below
                # If so, this could be a valid crossing; if not, it's likely baseline noise
                if raw_rfu[i - 1] < threshold:
                    # Valid crossing from below threshold to above threshold
                    x0 = raw_cycles[i - 1]
                    x1 = raw_cycles[i]
                    y0 = raw_rfu[i - 1]
                    y1 = raw_rfu[i]
                    if y1 == y0:
                        interpolated = x1
                    else:
                        interpolated = x0 + (threshold - y0) * (x1 - x0) / (y1 - y0)
                    print(f"[CQJ-DEBUG] Well {well_id}: CQJ={interpolated:.2f} (threshold crossing at cycle 5, from {y0:.2f} to {y1:.2f})")
                    return interpolated
                else:
                    # Cycle 5 already above threshold and previous cycle was also above - skip this
                    print(f"[CQJ-DEBUG] Well {well_id}: Cycle 5 already above threshold ({raw_rfu[i]} >= {threshold}), but previous cycle was also above - continuing search")
                    continue
            else:
                # Normal threshold crossing after cycle 5
                x0 = raw_cycles[i - 1]
                x1 = raw_cycles[i]
                y0 = raw_rfu[i - 1]
                y1 = raw_rfu[i]
                if y1 == y0:
                    interpolated = x1
                else:
                    interpolated = x0 + (threshold - y0) * (x1 - x0) / (y1 - y0)
                print(f"[CQJ-DEBUG] Well {well_id}: CQJ={interpolated:.2f} (threshold crossing between cycles {x0}-{x1})")
                return interpolated
    
    well_id = well.get('well_id') or well.get('wellKey') or well.get('well_key') or 'UNKNOWN'
    print(f"[CQJ-DEBUG] Well {well_id}: No threshold crossing found (max RFU: {max(raw_rfu) if raw_rfu else 'N/A'})")
    return None  # never crossed

def determine_control_type_python(well_id, well_data):
    """
    Python version of determineControlType function from JavaScript
    Determine if a well is a control well and what type (H, M, L, NTC)
    """
    if not well_id or not well_data:
        return None
    
    sample_name = well_data.get('sample_name', '')
    upper_sample_name = sample_name.upper()
    
    # Check for NTC first
    if 'NTC' in sample_name or 'NTC' in upper_sample_name:
        print(f"[CONTROL-DETECT-PY] Found NTC control: {well_id} (sample: {sample_name})")
        return 'NTC'
    
    # Method 1: Look for H-, M-, L- patterns (most reliable)
    if 'H-' in sample_name:
        print(f"[CONTROL-DETECT-PY] Found H control: {well_id} (H- pattern in: {sample_name})")
        return 'H'
    if 'M-' in sample_name:
        print(f"[CONTROL-DETECT-PY] Found M control: {well_id} (M- pattern in: {sample_name})")
        return 'M'
    if 'L-' in sample_name:
        print(f"[CONTROL-DETECT-PY] Found L control: {well_id} (L- pattern in: {sample_name})")
        return 'L'
    
    # Method 2: Look for explicit concentration indicators
    if any(conc in upper_sample_name for conc in ['1E7', '10E7', '1E+7']):
        print(f"[CONTROL-DETECT-PY] Found H control by concentration: {well_id} (sample: {sample_name})")
        return 'H'
    if any(conc in upper_sample_name for conc in ['1E5', '10E5', '1E+5']):
        print(f"[CONTROL-DETECT-PY] Found M control by concentration: {well_id} (sample: {sample_name})")
        return 'M'
    if any(conc in upper_sample_name for conc in ['1E3', '10E3', '1E+3']):
        print(f"[CONTROL-DETECT-PY] Found L control by concentration: {well_id} (sample: {sample_name})")
        return 'L'
    
    # Method 3: Look for explicit control words (only if very clear)
    if any(ctrl in upper_sample_name for ctrl in ['HIGH CONTROL', 'POSITIVE CONTROL']):
        print(f"[CONTROL-DETECT-PY] Found H control by explicit name: {well_id} (sample: {sample_name})")
        return 'H'
    if any(ctrl in upper_sample_name for ctrl in ['MEDIUM CONTROL', 'MED CONTROL']):
        print(f"[CONTROL-DETECT-PY] Found M control by explicit name: {well_id} (sample: {sample_name})")
        return 'M'
    if 'LOW CONTROL' in upper_sample_name:
        print(f"[CONTROL-DETECT-PY] Found L control by explicit name: {well_id} (sample: {sample_name})")
        return 'L'
    
    # DO NOT classify as control well - be very conservative
    print(f"[CONTROL-DETECT-PY] Sample well (not control): {well_id} (sample: {sample_name})")
    return None

def calculate_calcj_with_controls(well_data, threshold, all_well_results, test_code, channel):
    """
    Calculate CalcJ using H/M/L control-based standard curve.
    Requires at least 2 control wells with valid CQJ values. No fallback or estimated values are used.
    
    Args:
        well_data: The well data dict with RFU values
        threshold: The threshold value
        all_well_results: Dict of all wells for finding controls
        test_code: The test code (e.g., 'Cglab', 'Ngon')
        channel: The fluorophore channel (e.g., 'FAM', 'HEX')
    
    Returns:
        dict with calcj_value and method used
    """
    import re
    import math
    
    # Try multiple ways to get well identifier
    well_id = well_data.get('well_id') or well_data.get('wellKey') or well_data.get('well_key') or 'UNKNOWN'
    
    # CRITICAL FIX: Check if the current well itself is a control well first
    # If it is, return fixed concentration value from centralized config instead of calculating
    current_well_control_type = determine_control_type_python(well_id, well_data)
    if current_well_control_type and current_well_control_type in ['H', 'M', 'L']:
        # Get fixed value from centralized configuration
        conc_values = CONCENTRATION_CONTROLS.get(test_code, {}).get(channel, {})
        fixed_value = conc_values.get(current_well_control_type)
        if fixed_value:
            print(f"[CALCJ-DEBUG] Control well {well_id} ({current_well_control_type}) getting FIXED value from config: {fixed_value}")
            return {
                'calcj_value': fixed_value, 
                'method': f'fixed_{current_well_control_type.lower()}_control_backend_centralized'
            }
        else:
            print(f"[CALCJ-DEBUG] Control well {well_id} ({current_well_control_type}) has no concentration value in config")
            return {'calcj_value': None, 'method': 'missing_control_config'}
    
    # Get CQJ value for current well - skip if no threshold crossing
    current_cqj = well_data.get('cqj_value')
    if current_cqj is None:
        print(f"[CALCJ-DEBUG] Well {well_id}: No CQJ value, skipping CalcJ calculation")
        return {'calcj_value': None, 'method': 'no_cqj_value'}
    
    # Get concentration values for this test/channel
    conc_values = CONCENTRATION_CONTROLS.get(test_code, {}).get(channel, {})
    if not conc_values:
        print(f"[CALCJ-DEBUG] Well {well_id}: No concentration controls found for {test_code}/{channel}, CalcJ unavailable")
        return {'calcj_value': None, 'method': 'no_controls_available'}
    
    # Find H/M/L control wells - improved detection with outlier handling
    control_cqj = {'H': [], 'M': [], 'L': []}
    print(f"[CALCJ-DEBUG] Well {well_id}: Searching for controls in {len(all_well_results)} wells")
    
    # Scan all wells for controls matching this test code
    for well_key, well in all_well_results.items():
        if not well_key or not well:
            continue
            
        # Use the same strict control detection logic
        control_type = determine_control_type_python(well_key, well)
        
        # Only include controls that have valid CQJ values
        if control_type and control_type in ['H', 'M', 'L'] and well.get('cqj_value') is not None:
            control_cqj[control_type].append(well.get('cqj_value'))
            print(f"[CALCJ-DEBUG] Found {control_type} control: {well_key} (CQJ: {well.get('cqj_value')})")
    
    # Calculate average CQJ for each control level with outlier detection
    avg_control_cqj = {}
    for control_type, cqj_list in control_cqj.items():
        if cqj_list:
            if len(cqj_list) == 1:
                # Only one control, use it
                avg_control_cqj[control_type] = cqj_list[0]
                print(f"[CALCJ-DEBUG] Single {control_type} control: {cqj_list[0]}")
            else:
                # Multiple controls - remove outliers (>5 cycles from median)
                sorted_cqj = sorted(cqj_list)
                median = sorted_cqj[len(sorted_cqj) // 2]
                filtered_cqj = [cqj for cqj in cqj_list if abs(cqj - median) <= 5.0]
                
                if len(filtered_cqj) < len(cqj_list):
                    print(f"[CALCJ-DEBUG] Removed {len(cqj_list) - len(filtered_cqj)} outliers from {control_type} controls")
                
                if filtered_cqj:
                    avg_control_cqj[control_type] = sum(filtered_cqj) / len(filtered_cqj)
                    print(f"[CALCJ-DEBUG] {control_type} control average CQJ: {avg_control_cqj[control_type]:.2f} (n={len(filtered_cqj)})")
    
    # We need at least 1 control with valid CQJ values
    if len(avg_control_cqj) < 1:
        print(f"[CALCJ-DEBUG] Well {well_id}: No controls found with CQJ, CalcJ unavailable")
        return {'calcj_value': None, 'method': 'insufficient_controls'}
    
    print(f"[CALCJ-DEBUG] Well {well_id}: Found {len(avg_control_cqj)} control(s) with valid CQJ values")
    
    # Create standard curve using best available control combination
    # Prioritize H and L for maximum curve spread
    if 'H' in avg_control_cqj and 'L' in avg_control_cqj:
        h_cqj = avg_control_cqj['H']
        l_cqj = avg_control_cqj['L'] 
        h_val = conc_values.get('H', 1e7)
        l_val = conc_values.get('L', 1e3)
        method = f'standard_curve_pathogen_specific_{test_code.lower()}'
    elif 'H' in avg_control_cqj and 'M' in avg_control_cqj:
        h_cqj = avg_control_cqj['H']
        l_cqj = avg_control_cqj['M']
        h_val = conc_values.get('H', 1e7)
        l_val = conc_values.get('M', 1e5)
        method = f'standard_curve_h_m_{test_code.lower()}'
    elif 'M' in avg_control_cqj and 'L' in avg_control_cqj:
        h_cqj = avg_control_cqj['M']
        l_cqj = avg_control_cqj['L']
        h_val = conc_values.get('M', 1e5)
        l_val = conc_values.get('L', 1e3)
        method = f'standard_curve_m_l_{test_code.lower()}'
    else:
        print(f"[CALCJ-DEBUG] Well {well_id}: Unable to create standard curve")
        return {'calcj_value': None, 'method': 'insufficient_control_combination'}
    
    # Calculate CalcJ using log-linear standard curve
    try:
        # Validate that we have reasonable control data
        if abs(h_cqj - l_cqj) < 0.5:
            print(f"[CALCJ-DEBUG] Well {well_id}: Controls too close together (H:{h_cqj}, L:{l_cqj})")
            return {'calcj_value': None, 'method': 'controls_too_close'}
        
        if h_val <= 0 or l_val <= 0:
            print(f"[CALCJ-DEBUG] Well {well_id}: Invalid concentration values")
            return {'calcj_value': None, 'method': 'invalid_concentration_values'}
        
        # Log-linear interpolation using control values
        log_h = math.log10(h_val)
        log_l = math.log10(l_val)
        
        # Calculate slope and intercept of standard curve
        slope = (log_h - log_l) / (h_cqj - l_cqj)
        intercept = log_h - slope * h_cqj
        
        # Calculate concentration for current CQJ
        log_conc = slope * current_cqj + intercept
        calcj_value = math.pow(10, log_conc)
        
        # Sanity checks: result should be within reasonable range
        if not math.isfinite(calcj_value) or calcj_value < 0 or calcj_value > 1e12:
            print(f"[CALCJ-DEBUG] Well {well_id}: CalcJ result out of range: {calcj_value}")
            return {'calcj_value': None, 'method': 'unreasonable_result'}
        
        print(f"[CALCJ-DEBUG] Well {well_id}: Control-based CalcJ = {calcj_value:.2e} (CQJ: {current_cqj})")
        print(f"[CALCJ-DEBUG] Standard curve: slope={slope:.4f}, intercept={intercept:.4f}")
        
        return {'calcj_value': calcj_value, 'method': method}
        
    except Exception as e:
        print(f"[CALCJ-DEBUG] Well {well_id}: Error calculating CalcJ: {e}")
        return {'calcj_value': None, 'method': 'calculation_error'}


def calculate_calcj_cqj_for_well(well_data, threshold_value, all_wells, test_code, channel):
    """
    Calculate both CQJ and CalcJ for a single well. 
    
    Args:
        well_data: Dict with RFU data and analysis results
        threshold_value: The RFU threshold value to use
        all_wells: Dict of all wells (for finding controls)
        test_code: The test/pathogen code
        channel: The fluorescence channel (e.g., 'FAM', 'HEX')
    
    Returns:
        Tuple of (cqj_value, calcj_result_dict)
    """
    from cqj_python import calculate_cqj as py_cqj
    
    # Calculate CQJ value first
    well_for_cqj = {
        'rfus': well_data.get('rfu_data', well_data.get('rfus', [])),
        'temperatures': well_data.get('temperatures', [])
    }
    
    cqj_value = py_cqj(well_for_cqj, threshold_value)
    
    # Store CQJ in well_data for CalcJ calculation
    if 'cqj_value' not in well_data:
        well_data['cqj_value'] = cqj_value
    
    # Calculate CalcJ using controls
    calcj_result = calculate_calcj_with_controls(well_data, test_code, channel, well_data.get('well_id', 'unknown'))
    
    return cqj_value, calcj_result
    
    # Calculate average CQJ for each control level
    avg_control_cqj = {}
    for control_type, cqj_list in control_cqj.items():
        if cqj_list:
            avg_control_cqj[control_type] = sum(cqj_list) / len(cqj_list)
            print(f"[CALCJ-DEBUG] {control_type} control average CQJ: {avg_control_cqj[control_type]:.2f} (n={len(cqj_list)})")
    
    # Check if we have enough controls for standard curve
    # We need at least 1 control with valid CQJ values
    if len(avg_control_cqj) < 1:
        print(f"[CALCJ-DEBUG] Well {well_id}: No controls found with CQJ, CalcJ unavailable")
        return {'calcj_value': None, 'method': 'insufficient_controls'}
    
    # Check if we have sufficient controls for CalcJ calculation
    if len(avg_control_cqj) < 2:
        print(f"[CALCJ-DEBUG] Well {well_id}: Only {len(avg_control_cqj)} control(s) with CQJ, need at least 2 for CalcJ")
        return {'calcj_value': None, 'method': 'insufficient_controls'}
    
    # Handle outlier detection for controls
    # If we have 3+ controls, check for outliers and exclude them
    if len(avg_control_cqj) >= 3:
        ctrl_values = list(avg_control_cqj.values())
        ctrl_types = list(avg_control_cqj.keys())
        
        # Simple outlier detection: if one control is >5 cycles different from median
        ctrl_values_sorted = sorted(ctrl_values)
        median = ctrl_values_sorted[len(ctrl_values_sorted)//2]
        
        outliers_removed = {}
        for ctrl_type in ctrl_types:
            cqj_val = avg_control_cqj[ctrl_type]
            if abs(cqj_val - median) <= 5.0:  # Within 5 cycles of median
                outliers_removed[ctrl_type] = cqj_val
            else:
                print(f"[CALCJ-DEBUG] Excluding outlier {ctrl_type} control: CQJ={cqj_val} (>5 cycles from median {median})")
        
        # Use non-outlier controls if we still have at least 2
        if len(outliers_removed) >= 2:
            avg_control_cqj = outliers_removed
            print(f"[CALCJ-DEBUG] Using {len(avg_control_cqj)} controls after outlier removal")
    
    # Get CQJ for current well
    current_cqj = well_data.get('cqj_value')
    if current_cqj is None:
        print(f"[CALCJ-DEBUG] Well {well_id}: No CQJ value, cannot calculate CalcJ")
        return {'calcj_value': None, 'method': 'control_based_failed'}
    
    # Use existing calculate_calcj function from qpcr_analyzer.py
    # Try H/M/L first, then fallback to available controls
    h_cq = avg_control_cqj.get('H')
    m_cq = avg_control_cqj.get('M') 
    l_cq = avg_control_cqj.get('L')
    h_val = conc_values.get('H')
    m_val = conc_values.get('M')
    l_val = conc_values.get('L')
    
    # Check for early crossing (crossing before lowest control)
    min_control_cqj = None
    if avg_control_cqj:
        min_control_cqj = min(avg_control_cqj.values())
        if current_cqj < min_control_cqj:
            print(f"[CALCJ-DEBUG] Well {well_id}: Early crossing detected (CQJ {current_cqj:.2f} < min control {min_control_cqj:.2f})")
            return {'calcj_value': 'N/A', 'method': 'early_crossing'}
    
    try:
        if h_cq is not None and l_cq is not None and h_val and l_val:
            # Use the existing calculate_calcj function
            import math
            # FIXED: Slope should be negative (higher CQJ = lower concentration)
            slope = (math.log10(h_val) - math.log10(l_val)) / (h_cq - l_cq)
            intercept = math.log10(h_val) - slope * h_cq
            log_conc = slope * current_cqj + intercept
            calcj_result = 10 ** log_conc
            
            print(f"[CALCJ-DEBUG] Well {well_id}: Control-based CalcJ = {calcj_result:.2e} (CQJ: {current_cqj:.2f})")
            print(f"[CALCJ-DEBUG] Standard curve: slope={slope:.4f}, intercept={intercept:.4f}")
            return {'calcj_value': calcj_result, 'method': 'control_based'}
        else:
            print(f"[CALCJ-DEBUG] Well {well_id}: Missing H/L controls, CalcJ unavailable")
            return {'calcj_value': None, 'method': 'missing_hl_controls'}
            
    except Exception as e:
        print(f"[CALCJ-DEBUG] Well {well_id}: Error in control-based calculation: {e}, CalcJ unavailable")
        return {'calcj_value': None, 'method': 'calculation_error'}

# Function removed - deprecated amplitude/threshold calculation  
# All CalcJ calculations now use control-based method: calculate_calcj_with_controls()

# Function removed - deprecated amplitude/threshold calculation
# All CalcJ calculations now use control-based method: calculate_calcj_with_controls()
