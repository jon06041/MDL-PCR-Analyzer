#!/usr/bin/env python3
"""
ML Config Safeguard - Prevents ML config database from being empty
This script ensures that the ML config database is always populated with 
pathogen library entries. Run this anytime there's a concern about missing configs.
"""

import os
import sys

def check_and_restore_ml_config():
    """Check ML config and restore if needed"""
    try:
        from ml_config_manager import ml_config_manager
        
        print("🔍 Checking ML config database...")
        
        # Get current configs
        configs = ml_config_manager.get_all_pathogen_configs()
        config_count = len(configs)
        
        print(f"📊 Found {config_count} ML configurations")
        
        # Expected minimum (should be around 127+ based on pathogen library)
        EXPECTED_MIN = 100
        
        if config_count < EXPECTED_MIN:
            print(f"⚠️  Config count ({config_count}) below expected minimum ({EXPECTED_MIN})")
            print("🔄 Repopulating from pathogen library...")
            
            result = ml_config_manager.populate_from_pathogen_library()
            if result:
                new_configs = ml_config_manager.get_all_pathogen_configs()
                print(f"✅ Repopulation successful: {len(new_configs)} configurations")
                return True
            else:
                print("❌ Repopulation failed")
                return False
        else:
            print("✅ ML config database is properly populated")
            return True
            
    except Exception as e:
        print(f"❌ Error checking ML config: {e}")
        return False

def validate_pathogen_mapping():
    """Validate that key pathogens are mapped"""
    try:
        from ml_config_manager import ml_config_manager
        
        # Key pathogens that should always be present
        key_pathogens = ['BVAB1', 'CTRACH', 'NGON', 'AtopVag', 'BVAB']
        key_fluorophores = ['FAM', 'HEX', 'Texas Red', 'Cy5']
        
        missing = []
        for pathogen in key_pathogens:
            for fluorophore in key_fluorophores:
                config = ml_config_manager.get_pathogen_config(pathogen, fluorophore)
                if not config:
                    missing.append(f"{pathogen}/{fluorophore}")
        
        if missing:
            print(f"⚠️  Missing key configurations: {missing}")
            print("🔄 Triggering repopulation...")
            ml_config_manager.populate_from_pathogen_library()
            return False
        else:
            print("✅ All key pathogen/fluorophore combinations are mapped")
            return True
            
    except Exception as e:
        print(f"❌ Error validating pathogen mapping: {e}")
        return False

if __name__ == "__main__":
    print("🛡️  ML Config Safeguard - Protecting against config loss")
    print("="*60)
    
    # Check and restore if needed
    config_ok = check_and_restore_ml_config()
    mapping_ok = validate_pathogen_mapping()
    
    if config_ok and mapping_ok:
        print("\n✅ ML Config safeguard check passed - all systems normal")
        sys.exit(0)
    else:
        print("\n❌ ML Config safeguard check failed - manual intervention needed")
        sys.exit(1)
