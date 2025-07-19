"""
CQJ/CalcJ calculation utilities for qPCR analysis
"""

from typing import List, Optional
import numpy as np

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
    
    for i in range(start_index, len(raw_rfu)):
        if raw_rfu[i] >= threshold:
            # Check if this is the first valid cycle we're examining
            if i == start_index:
                # If cycle 5 (first valid cycle) already exceeds threshold, 
                # this is likely baseline noise or pre-amplification artifact - return None
                well_id = well.get('well_id') or well.get('wellKey') or well.get('well_key') or 'UNKNOWN'
                print(f"[CQJ-DEBUG] Well {well_id}: Cycle 5 already above threshold ({raw_rfu[i]} >= {threshold}), ignoring as baseline noise")
                return None
            x0 = raw_cycles[i - 1]
            x1 = raw_cycles[i]
            y0 = raw_rfu[i - 1]
            y1 = raw_rfu[i]
            if y1 == y0:
                return x1  # avoid div by zero
            interpolated = x0 + (threshold - y0) * (x1 - x0) / (y1 - y0)
            well_id = well.get('well_id') or well.get('wellKey') or well.get('well_key') or 'UNKNOWN'
            print(f"[CQJ-DEBUG] Well {well_id}: CQJ={interpolated:.2f} (threshold crossing between cycles {x0}-{x1})")
            return interpolated
    
    well_id = well.get('well_id') or well.get('wellKey') or well.get('well_key') or 'UNKNOWN'
    print(f"[CQJ-DEBUG] Well {well_id}: No threshold crossing found (max RFU: {max(raw_rfu) if raw_rfu else 'N/A'})")
    return None  # never crossed

def calculate_calcj_with_controls(well_data, threshold, all_well_results, test_code, channel):
    """
    Calculate CalcJ using H/M/L control-based standard curve.
    
    Args:
        well_data: The well data dict with RFU values
        threshold: The threshold value
        all_well_results: Dict of all wells for finding controls
        test_code: The test code (e.g., 'Cglab', 'Ngon')
        channel: The fluorophore channel (e.g., 'FAM', 'HEX')
    
    Returns:
        dict with calcj_value and method used
    """
    # Try multiple ways to get well identifier
    well_id = well_data.get('well_id') or well_data.get('wellKey') or well_data.get('well_key') or 'UNKNOWN'
    
    # Standard concentration values from concentration_controls.js
    CONCENTRATION_CONTROLS = {
        'Lacto': {
            'Cy5': {'H': 1e7, 'M': 1e5, 'L': 1e3}, 'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3},
            'HEX': {'H': 1e7, 'M': 1e5, 'L': 1e3}, 'TexasRed': {'H': 1e7, 'M': 1e5, 'L': 1e3}
        },
        'Calb': {'HEX': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 'Ctrach': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'Ngon': {'HEX': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 'Tvag': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'Cglab': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 'Cpara': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'Ctrop': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 'Gvag': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'BVAB2': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 'CHVIC': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'AtopVag': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 'Megasphaera': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}, 'HEX': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'Efaecalis': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 'Saureus': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'Ecoli': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 'AtopVagNY': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'BVAB2NY': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}}, 'GvagNY': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'MegasphaeraNY': {'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}, 'HEX': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'LactoNY': {'Cy5': {'H': 1e7, 'M': 1e5, 'L': 1e3}, 'FAM': {'H': 1e7, 'M': 1e5, 'L': 1e3}, 'HEX': {'H': 1e7, 'M': 1e5, 'L': 1e3}, 'TexasRed': {'H': 1e7, 'M': 1e5, 'L': 1e3}},
        'RNaseP': {'HEX': {'H': 1e7, 'M': 1e5, 'L': 1e3}}
    }
    
    # Get concentration values for this test/channel
    conc_values = CONCENTRATION_CONTROLS.get(test_code, {}).get(channel, {})
    if not conc_values:
        print(f"[CALCJ-DEBUG] Well {well_id}: No concentration controls found for {test_code}/{channel}, using basic method")
        return {'calcj_value': calculate_calcj(well_data, threshold), 'method': 'basic'}
    
    # Find H/M/L control wells
    control_cqj = {}
    for well_key, well in all_well_results.items():
        if not well_key or not well:
            continue
            
        # Check if this is a control well with comprehensive pattern matching
        control_type = None
        upper_key = well_key.upper()
        
        # HIGH control patterns
        if (well_key.startswith('H_') or '_H_' in well_key or upper_key.startswith('HIGH') or
            'HIGH' in upper_key or 'H1' in upper_key or 'H2' in upper_key or 'H3' in upper_key or
            'POS' in upper_key or 'POSITIVE' in upper_key or 
            '1E7' in upper_key or '10E7' in upper_key or '1E+7' in upper_key):
            control_type = 'H'
        # MEDIUM control patterns  
        elif (well_key.startswith('M_') or '_M_' in well_key or upper_key.startswith('MEDIUM') or
              'MEDIUM' in upper_key or 'M1' in upper_key or 'M2' in upper_key or 'M3' in upper_key or
              'MED' in upper_key or '1E5' in upper_key or '10E5' in upper_key or '1E+5' in upper_key):
            control_type = 'M'
        # LOW control patterns
        elif (well_key.startswith('L_') or '_L_' in well_key or upper_key.startswith('LOW') or
              'LOW' in upper_key or 'L1' in upper_key or 'L2' in upper_key or 'L3' in upper_key or
              '1E3' in upper_key or '10E3' in upper_key or '1E+3' in upper_key):
            control_type = 'L'
        # Also check sample_name if available
        elif well.get('sample_name'):
            upper_sample = well.get('sample_name', '').upper()
            if ('HIGH' in upper_sample or 'POS' in upper_sample or 'H1' in upper_sample or
                '1E7' in upper_sample or '10E7' in upper_sample or '1E+7' in upper_sample):
                control_type = 'H'
            elif ('MEDIUM' in upper_sample or 'MED' in upper_sample or 'M1' in upper_sample or
                  '1E5' in upper_sample or '10E5' in upper_sample or '1E+5' in upper_sample):
                control_type = 'M'
            elif ('LOW' in upper_sample or 'L1' in upper_sample or
                  '1E3' in upper_sample or '10E3' in upper_sample or '1E+3' in upper_sample):
                control_type = 'L'
            
        if control_type and well.get('cqj_value') is not None:
            if control_type not in control_cqj:
                control_cqj[control_type] = []
            control_cqj[control_type].append(well.get('cqj_value'))
            print(f"[CALCJ-DEBUG] Found {control_type} control: {well_key} (CQJ: {well.get('cqj_value')})")
    
    # Calculate average CQJ for each control level
    avg_control_cqj = {}
    for control_type, cqj_list in control_cqj.items():
        if cqj_list:
            avg_control_cqj[control_type] = sum(cqj_list) / len(cqj_list)
            print(f"[CALCJ-DEBUG] {control_type} control average CQJ: {avg_control_cqj[control_type]:.2f} (n={len(cqj_list)})")
    
    # Check if we have enough controls for standard curve
    if len(avg_control_cqj) < 2:
        print(f"[CALCJ-DEBUG] Well {well_id}: Insufficient controls found ({len(avg_control_cqj)}), using basic method")
        return {'calcj_value': calculate_calcj(well_data, threshold), 'method': 'basic'}
    
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
            slope = (math.log10(h_val) - math.log10(l_val)) / (l_cq - h_cq)
            intercept = math.log10(h_val) - slope * h_cq
            log_conc = slope * current_cqj + intercept
            calcj_result = 10 ** log_conc
            
            print(f"[CALCJ-DEBUG] Well {well_id}: Control-based CalcJ = {calcj_result:.2e} (CQJ: {current_cqj:.2f})")
            return {'calcj_value': calcj_result, 'method': 'control_based'}
        else:
            print(f"[CALCJ-DEBUG] Well {well_id}: Missing H/L controls, using basic method")
            return {'calcj_value': calculate_calcj(well_data, threshold), 'method': 'basic'}
            
    except Exception as e:
        print(f"[CALCJ-DEBUG] Well {well_id}: Error in control-based calculation: {e}, using basic method")
        return {'calcj_value': calculate_calcj(well_data, threshold), 'method': 'basic'}

def calculate_calcj(well, threshold):
    """
    Example: Calc-J = amplitude / threshold (replace with real formula if needed)
    """
    # Try multiple ways to get well identifier: well_id, wellKey, or fallback
    well_id = well.get('well_id') or well.get('wellKey') or well.get('well_key') or 'UNKNOWN'
    amplitude = well.get('amplitude')
    if amplitude is None or not threshold:
        print(f"[CALCJ-DEBUG] Well {well_id}: Missing amplitude ({amplitude}) or threshold ({threshold})")
        return None
    result = amplitude / threshold
    print(f"[CALCJ-DEBUG] Well {well_id}: CalcJ = {amplitude} / {threshold} = {result}")
    return result

def calculate_cqj_calcj_for_well(well_data, strategy, threshold):
    """
    Calculate both CQJ and CalcJ for a well with the given threshold strategy.
    Returns a dict with cqj_value and calcj_value.
    """
    # Try multiple ways to get well identifier: well_id, wellKey, or fallback
    well_id = well_data.get('well_id') or well_data.get('wellKey') or well_data.get('well_key') or 'UNKNOWN'
    print(f"[CQJ-CALCJ-DEBUG] Starting calculation for well_id: '{well_id}' with threshold: {threshold}")
    
    result = {
        'cqj_value': None,
        'calcj_value': None,
        'threshold_value': threshold,
        'strategy': strategy
    }
    
    try:
        # Calculate CQJ
        cqj_value = calculate_cqj(well_data, threshold)
        result['cqj_value'] = cqj_value
        
        # Calculate CalcJ
        calcj_value = calculate_calcj(well_data, threshold)
        result['calcj_value'] = calcj_value
        
        # Add strategy-specific CQJ and CalcJ objects for compatibility
        result['cqj'] = {strategy: cqj_value} if cqj_value is not None else {strategy: None}
        result['calcj'] = {strategy: calcj_value} if calcj_value is not None else {strategy: None}
        
        print(f"[CQJ-CALCJ-DEBUG] Final result for {well_id}: CQJ={cqj_value}, CalcJ={calcj_value}")
        return result
        
    except Exception as e:
        # Try multiple ways to get well identifier for error messages too
        well_id = well_data.get('well_id') or well_data.get('wellKey') or well_data.get('well_key') or 'UNKNOWN'
        print(f"[CQJ-CALCJ-ERROR] Error calculating for well {well_id}: {e}")
        return result
