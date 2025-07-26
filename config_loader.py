"""
Centralized configuration loader for concentration controls.
This ensures all concentration control values come from a single source.
"""

import json
import os
from typing import Dict, Any, Optional

def load_concentration_controls() -> Dict[str, Any]:
    """
    Load concentration controls from the centralized JSON config file.
    
    Returns:
        Dict containing concentration control values organized by test_code -> channel -> control_type -> value
    """
    try:
        # Get the directory where this script is located
        script_dir = os.path.dirname(os.path.abspath(__file__))
        config_path = os.path.join(script_dir, 'config', 'concentration_controls.json')
        
        with open(config_path, 'r') as f:
            config = json.load(f)
            
        return config.get('controls', {})
    
    except FileNotFoundError:
        print(f"[CONFIG-ERROR] Concentration controls config file not found at {config_path}")
        return {}
    except json.JSONDecodeError as e:
        print(f"[CONFIG-ERROR] Invalid JSON in concentration controls config: {e}")
        return {}
    except Exception as e:
        print(f"[CONFIG-ERROR] Error loading concentration controls: {e}")
        return {}

def get_control_value(test_code: str, channel: str, control_type: str) -> Optional[float]:
    """
    Get a specific control concentration value.
    
    Args:
        test_code: Test code (e.g., 'Cglab', 'Ngon')
        channel: Channel/fluorophore (e.g., 'FAM', 'HEX')
        control_type: Control type ('H', 'M', 'L')
    
    Returns:
        Concentration value or None if not found
    """
    controls = load_concentration_controls()
    return controls.get(test_code, {}).get(channel, {}).get(control_type)

def get_test_controls(test_code: str, channel: str) -> Dict[str, float]:
    """
    Get all control values for a specific test/channel combination.
    
    Args:
        test_code: Test code (e.g., 'Cglab', 'Ngon')
        channel: Channel/fluorophore (e.g., 'FAM', 'HEX')
    
    Returns:
        Dict with keys 'H', 'M', 'L' and their concentration values
    """
    controls = load_concentration_controls()
    return controls.get(test_code, {}).get(channel, {})

# For backward compatibility, expose the controls dictionary directly
CONCENTRATION_CONTROLS = load_concentration_controls()
