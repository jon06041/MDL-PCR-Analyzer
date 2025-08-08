#!/usr/bin/env python3
"""
Comprehensive pathogen library population script
Extracts all pathogen/fluorophore combinations from pathogen_library.js and populates MySQL ML config
"""

import pymysql
import os
import re
import json

# MySQL connection
mysql_config = {
    'host': os.environ.get('MYSQL_HOST', 'localhost'),
    'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
    'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
    'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis'),
    'charset': 'utf8mb4'
}

def extract_pathogen_library():
    """Extract all pathogen/fluorophore combinations from pathogen_library.js"""
    with open('static/pathogen_library.js', 'r') as f:
        content = f.read()
    
    # Extract the pathogen library object
    start = content.find('const PATHOGEN_LIBRARY = {')
    end = content.find('};', start) + 2
    library_str = content[start:end]
    
    # Parse the JavaScript object manually
    pathogen_combinations = []
    current_test_code = None
    
    lines = library_str.split('\n')
    for line in lines:
        line = line.strip()
        
        # Match test code lines: "TestCode": {
        test_match = re.match(r'"([A-Za-z0-9]+)":\s*{', line)
        if test_match:
            current_test_code = test_match.group(1)
            continue
        
        # Match fluorophore lines: "FAM": "Pathogen Name"
        fluor_match = re.match(r'"(FAM|HEX|Texas Red|Cy5)":\s*"([^"]+)"', line)
        if fluor_match and current_test_code:
            fluorophore = fluor_match.group(1)
            pathogen_name = fluor_match.group(2)
            
            if pathogen_name != "Unknown":  # Skip Unknown entries
                pathogen_combinations.append({
                    'test_code': current_test_code,
                    'fluorophore': fluorophore,
                    'pathogen_name': pathogen_name
                })
    
    return pathogen_combinations

def populate_ml_config(pathogen_combinations):
    """Populate MySQL ML config tables with all pathogen combinations"""
    try:
        connection = pymysql.connect(**mysql_config)
        cursor = connection.cursor()
        
        # Clear existing pathogen configs
        cursor.execute("DELETE FROM ml_pathogen_config")
        print("🧹 Cleared existing ML pathogen configs")
        
        # Insert all combinations
        insert_query = """
        INSERT INTO ml_pathogen_config 
        (pathogen_code, fluorophore, ml_enabled, confidence_threshold, min_training_samples, max_training_samples, auto_retrain, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
        ml_enabled = VALUES(ml_enabled),
        confidence_threshold = VALUES(confidence_threshold),
        updated_at = NOW()
        """
        
        count = 0
        for combo in pathogen_combinations:
            cursor.execute(insert_query, (
                combo['pathogen_name'],  # Use pathogen name as pathogen_code
                combo['fluorophore'],
                True,  # ml_enabled
                0.85,  # confidence_threshold
                10,   # min_training_samples
                1000, # max_training_samples
                True  # auto_retrain
            ))
            count += 1
        
        connection.commit()
        print(f"✅ Successfully populated {count} pathogen/fluorophore combinations")
        
        # Verify population
        cursor.execute("SELECT COUNT(*) FROM ml_pathogen_config")
        total = cursor.fetchone()[0]
        print(f"📊 Total ML pathogen configs in database: {total}")
        
        # Show sample of what was inserted
        cursor.execute("SELECT pathogen_code, fluorophore FROM ml_pathogen_config LIMIT 10")
        samples = cursor.fetchall()
        print("\n🔍 Sample configurations:")
        for pathogen, fluor in samples:
            print(f"  - {pathogen} / {fluor}")
        
        cursor.close()
        connection.close()
        
        return count
        
    except Exception as e:
        print(f"❌ Error populating ML config: {e}")
        return 0

def main():
    print("🚀 Starting comprehensive pathogen library population...")
    
    # Extract pathogen combinations
    combinations = extract_pathogen_library()
    print(f"📋 Extracted {len(combinations)} pathogen/fluorophore combinations")
    
    # Show first few combinations
    print("\n🔍 First 10 combinations:")
    for i, combo in enumerate(combinations[:10]):
        print(f"  {i+1}. {combo['test_code']} -> {combo['pathogen_name']} / {combo['fluorophore']}")
    
    # Populate database
    populated_count = populate_ml_config(combinations)
    
    print(f"\n✅ Population complete: {populated_count} configurations added")

if __name__ == "__main__":
    main()
