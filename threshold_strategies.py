"""
Threshold strategy logic for qPCR analysis
"""

from typing import List, Dict, Any
import numpy as np

def linear_threshold_strategy(rfu_values: List[float], baseline: float = 0.0, stddev: float = 1.0) -> float:
    """
    Example linear threshold strategy: baseline + 10 * stddev
    """
    return baseline + 10 * stddev

def log_threshold_strategy(rfu_values: List[float], baseline: float = 0.0, stddev: float = 1.0) -> float:
    """
    Example log threshold strategy: baseline + 2 * stddev (log scale)
    """
    return baseline + 2 * stddev

def get_threshold(strategy: str, rfu_values: List[float], baseline: float = 0.0, stddev: float = 1.0) -> float:
    if strategy == "linear":
        return linear_threshold_strategy(rfu_values, baseline, stddev)
    elif strategy == "log":
        return log_threshold_strategy(rfu_values, baseline, stddev)
    else:
        raise ValueError(f"Unknown threshold strategy: {strategy}")

# Add more strategies as needed

