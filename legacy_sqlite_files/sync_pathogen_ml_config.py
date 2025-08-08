#!/usr/bin/env python3
"""
Sync all pathogen library tests to ML configuration
This will ensure ALL tests from pathogen_library.js are present in ml_pathogen_config
"""

import sqlite3
import json
import re
import os

# Read pathogen library from JavaScript file
def extract_pathogen_library():
    """Extract all test codes and their fluorophores from pathogen_library.js"""
    pathogen_file = 'static/pathogen_library.js'
    
    if not os.path.exists(pathogen_file):
        print(f"❌ Pathogen library file not found: {pathogen_file}")
        return {}
    
    with open(pathogen_file, 'r') as f:
        content = f.read()
    
    # Extract all test codes and their fluorophores using regex
    # Pattern: "TestCode": { "FAM": "target", "HEX": "target2", ... }
    test_pattern = r'"([A-Z][a-zA-Z0-9_]+)":\s*\{([^}]+)\}'
    fluorophore_pattern = r'"(FAM|HEX|Cy5|Texas Red)":\s*"([^"]+)"'
    
    pathogen_configs = {}
    
    for test_match in re.finditer(test_pattern, content):
        test_code = test_match.group(1)
        fluorophore_block = test_match.group(2)
        
        # Extract all fluorophores for this test
        fluorophores = []
        for fluor_match in re.finditer(fluorophore_pattern, fluorophore_block):
            fluorophore = fluor_match.group(1)
            target = fluor_match.group(2)
            fluorophores.append(fluorophore)
        
        if fluorophores:
            pathogen_configs[test_code] = fluorophores
            print(f"📊 Found test: {test_code} with fluorophores: {', '.join(fluorophores)}")
    
    return pathogen_configs

# Sync to database
def sync_to_ml_config(pathogen_configs):
    """Sync all pathogen configurations to ml_pathogen_config table"""
    db_path = 'qpcr_analysis.db'
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        return False
    
    try:
        with sqlite3.connect(db_path) as conn:
            # Get existing configurations
            cursor = conn.execute("""
                SELECT pathogen_code, fluorophore, ml_enabled 
                FROM ml_pathogen_config
            """)
            existing = {(row[0], row[1]): row[2] for row in cursor.fetchall()}
            
            print(f"📋 Found {len(existing)} existing ML configurations")
            
            # Sync each test code and fluorophore combination
            added = 0
            updated = 0
            
            for test_code, fluorophores in pathogen_configs.items():
                for fluorophore in fluorophores:
                    key = (test_code, fluorophore)
                    
                    if key in existing:
                        print(f"✅ Already exists: {test_code} / {fluorophore} (enabled: {existing[key]})")
                        updated += 1
                    else:
                        # Add new configuration (default enabled)
                        conn.execute("""
                            INSERT INTO ml_pathogen_config 
                            (pathogen_code, fluorophore, ml_enabled, updated_at)
                            VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                        """, (test_code, fluorophore))
                        
                        print(f"🆕 Added: {test_code} / {fluorophore} (enabled: True)")
                        added += 1
            
            conn.commit()
            
            print(f"\n📊 Sync Summary:")
            print(f"   Added: {added} new configurations")
            print(f"   Existing: {updated} configurations")
            print(f"   Total: {added + updated} configurations")
            
            # Verify final count
            cursor = conn.execute("SELECT COUNT(*) FROM ml_pathogen_config")
            total_count = cursor.fetchone()[0]
            print(f"   Database total: {total_count} ML configurations")
            
            return True
            
    except Exception as e:
        print(f"❌ Database sync error: {e}")
        return False

def main():
    print("🔄 Syncing Pathogen Library to ML Configuration...")
    print("="*60)
    
    # Extract pathogen library
    pathogen_configs = extract_pathogen_library()
    
    if not pathogen_configs:
        print("❌ No pathogen configurations found!")
        return
    
    print(f"\n📊 Found {len(pathogen_configs)} test codes with {sum(len(fluors) for fluors in pathogen_configs.values())} total fluorophore combinations")
    
    # Sync to database
    if sync_to_ml_config(pathogen_configs):
        print("\n✅ Pathogen library sync completed successfully!")
        print("\nℹ️  All tests from pathogen_library.js are now available in ML Config")
        print("   Go to /ml-config to enable/disable ML for specific tests")
    else:
        print("\n❌ Pathogen library sync failed!")

if __name__ == "__main__":
    main()
