#!/usr/bin/env python3
"""
Set Training Enabled by Default Script

Updates the ml_pathogen_config table to enable training by default for all 
pathogen-fluorophore combinations, eliminating the need for user action.
"""

import mysql.connector
import os

def get_mysql_config():
    """Get MySQL configuration"""
    return {
        'host': os.environ.get('MYSQL_HOST', 'localhost'),
        'user': os.environ.get('MYSQL_USER', 'qpcr_user'), 
        'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
        'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis')
    }

def set_training_enabled_by_default():
    """Set training enabled by default for all pathogen-fluorophore combinations"""
    
    mysql_config = get_mysql_config()
    
    try:
        connection = mysql.connector.connect(**mysql_config)
        cursor = connection.cursor(dictionary=True)
        
        print("🔧 Setting training enabled by default...")
        
        # Step 1: Update the table default to TRUE for new records
        print("📝 Updating table default to TRUE...")
        cursor.execute("""
            ALTER TABLE ml_pathogen_config 
            MODIFY ml_enabled BOOLEAN DEFAULT TRUE
        """)
        print("✅ Table default updated to TRUE")
        
        # Step 2: Enable training for all existing pathogen-fluorophore combinations
        print("🔄 Enabling training for existing pathogen combinations...")
        cursor.execute("""
            UPDATE ml_pathogen_config 
            SET ml_enabled = TRUE 
            WHERE ml_enabled = FALSE
        """)
        
        updated_rows = cursor.rowcount
        print(f"✅ Enabled training for {updated_rows} existing pathogen-fluorophore combinations")
        
        # Step 3: Create default enabled records for common pathogen-fluorophore combinations
        # if they don't exist yet
        print("➕ Creating default enabled records for common combinations...")
        
        common_combinations = [
            ('Calb', 'HEX'),           # Candida albicans on HEX
            ('Ctrach', 'FAM'),         # Chlamydia trachomatis on FAM  
            ('Ngon', 'HEX'),           # Neisseria gonorrhoeae on HEX
            ('Tvag', 'FAM'),           # Trichomonas vaginalis on FAM
            ('BVAB1', 'FAM'),          # Bacterial vaginosis on FAM
            ('BVAB2', 'FAM'),          # Bacterial vaginosis on FAM
            ('Gvag', 'FAM'),           # Gardnerella vaginalis on FAM
            ('Lacto', 'Cy5'),          # Lactobacillus on Cy5
            ('Lacto', 'FAM'),          # Lactobacillus on FAM
            ('Lacto', 'HEX'),          # Lactobacillus on HEX
            ('Lacto', 'Texas Red'),    # Lactobacillus on Texas Red
        ]
        
        created_count = 0
        for pathogen_code, fluorophore in common_combinations:
            try:
                cursor.execute("""
                    INSERT INTO ml_pathogen_config 
                    (pathogen_code, fluorophore, ml_enabled, confidence_threshold, min_training_samples, max_training_samples, auto_retrain)
                    VALUES (%s, %s, TRUE, 0.7, 50, 1000, TRUE)
                    ON DUPLICATE KEY UPDATE ml_enabled = TRUE
                """, (pathogen_code, fluorophore))
                
                if cursor.rowcount > 0:
                    created_count += 1
                    print(f"  ✅ {pathogen_code}/{fluorophore}: Enabled")
                    
            except Exception as e:
                print(f"  ⚠️  {pathogen_code}/{fluorophore}: {e}")
        
        print(f"✅ Processed {len(common_combinations)} common pathogen-fluorophore combinations")
        
        # Step 4: Verify the changes
        print("🔍 Verifying changes...")
        cursor.execute("""
            SELECT pathogen_code, fluorophore, ml_enabled, created_at, updated_at
            FROM ml_pathogen_config 
            ORDER BY pathogen_code, fluorophore
        """)
        
        configs = cursor.fetchall()
        enabled_count = sum(1 for config in configs if config['ml_enabled'])
        
        print(f"📊 Total pathogen configurations: {len(configs)}")
        print(f"📊 Enabled configurations: {enabled_count}")
        print(f"📊 Disabled configurations: {len(configs) - enabled_count}")
        
        if configs:
            print("\n🔍 Current configurations:")
            for config in configs:
                status = "✅ ENABLED" if config['ml_enabled'] else "❌ DISABLED"
                print(f"  {config['pathogen_code']}/{config['fluorophore']}: {status}")
        
        connection.commit()
        cursor.close()
        connection.close()
        
        print("\n🎯 Training enabled by default configuration complete!")
        print("🚀 All pathogen training now works immediately without user action required")
        return True
        
    except Exception as e:
        print(f"❌ Error setting training enabled by default: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Setting Training Enabled by Default")
    print("=" * 50)
    
    if set_training_enabled_by_default():
        print("\n✅ SUCCESS: Training now enabled by default!")
        print("   - No user action required")
        print("   - Training actively working immediately") 
        print("   - Users can disable if needed")
    else:
        print("\n❌ FAILED: Could not set training enabled by default")
