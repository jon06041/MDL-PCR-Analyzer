# cqj_calcj_utils.py
"""
Utility functions to calculate CQ-J and Calc-J for a well given its data and a threshold.
Assumes well['raw_rfu'] (list of RFU values) and well['raw_cycles'] (list of cycle numbers).
"""

def calculate_cqj(well, threshold):
    """
    Calculate CQ-J for a well given a threshold.
    Returns the interpolated cycle number where RFU crosses the threshold, or None if never crossed.
    """
    raw_rfu = well.get('raw_rfu')
    raw_cycles = well.get('raw_cycles')
    if not raw_rfu or not raw_cycles or len(raw_rfu) != len(raw_cycles):
        return None
    for i, rfu in enumerate(raw_rfu):
        if rfu >= threshold:
            if i == 0:
                return raw_cycles[0]
            x0 = raw_cycles[i - 1]
            x1 = raw_cycles[i]
            y0 = raw_rfu[i - 1]
            y1 = rfu
            if y1 == y0:
                return x1  # avoid div by zero
            return x0 + (threshold - y0) * (x1 - x0) / (y1 - y0)
    return None  # never crossed

def calculate_calcj(well, threshold):
    """
    Example: Calc-J = amplitude / threshold (replace with real formula if needed)
    """
    amplitude = well.get('amplitude')
    if amplitude is None or not threshold:
        return None
    return amplitude / threshold
