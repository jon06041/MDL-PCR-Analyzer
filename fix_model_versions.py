#!/usr/bin/env python3
"""
Fix model versions based on training sample count:
- Set to version 1.0 for pathogens with <40 training samples
- Keep existing versions for pathogens with 40+ samples (they've reached teaching milestone)
"""

import sqlite3
from datetime import datetime

def fix_model_versions():
    """Update model versions based on training sample counts"""
    
    # Connect to database
    conn = sqlite3.connect('qpcr_analysis.db')
    cursor = conn.cursor()
    
    try:
        # Get actual training sample counts from training history
        cursor.execute("""
            SELECT pathogen_code, COUNT(*) as actual_training_samples 
            FROM ml_training_history 
            GROUP BY pathogen_code
        """)
        
        training_counts = {}
        for row in cursor.fetchall():
            training_counts[row[0]] = row[1]
        
        print("📊 Current training sample counts:")
        for pathogen, count in training_counts.items():
            print(f"   {pathogen}: {count} samples")
        
        # Get current model versions
        cursor.execute("""
            SELECT id, pathogen_code, version_number, training_samples_count
            FROM ml_model_versions 
            WHERE model_type = 'pathogen_specific'
            ORDER BY pathogen_code
        """)
        
        models_to_update = []
        models_to_keep = []
        
        for row in cursor.fetchall():
            model_id, pathogen_code, current_version, recorded_samples = row
            actual_samples = training_counts.get(pathogen_code, 0)
            
            if actual_samples < 40:
                # Should be version 1.0 (teaching phase)
                if current_version != "1.0":
                    models_to_update.append((model_id, pathogen_code, current_version, actual_samples))
                else:
                    models_to_keep.append((pathogen_code, current_version, actual_samples))
            else:
                # Has reached teaching milestone - keep existing version
                models_to_keep.append((pathogen_code, current_version, actual_samples))
        
        print(f"\n🔄 Models to update to version 1.0 (teaching phase):")
        for model_id, pathogen, old_version, samples in models_to_update:
            print(f"   {pathogen}: {old_version} → 1.0 ({samples} samples)")
        
        print(f"\n✅ Models to keep as-is (teaching complete or already correct):")
        for pathogen, version, samples in models_to_keep:
            status = "teaching complete" if samples >= 40 else "already correct"
            print(f"   {pathogen}: {version} ({samples} samples, {status})")
        
        # Update models that need fixing
        if models_to_update:
            print(f"\n🔧 Updating {len(models_to_update)} model versions...")
            
            for model_id, pathogen_code, old_version, actual_samples in models_to_update:
                # Update version to 1.0 and correct training samples count
                cursor.execute("""
                    UPDATE ml_model_versions 
                    SET version_number = '1.0',
                        training_samples_count = ?,
                        performance_notes = ?,
                        creation_date = ?
                    WHERE id = ?
                """, (
                    actual_samples,
                    f"Reset to v1.0 teaching phase - {actual_samples} samples (was {old_version})",
                    datetime.now().isoformat(),
                    model_id
                ))
                
                print(f"   ✅ Updated {pathogen_code}: {old_version} → 1.0")
            
            conn.commit()
            print(f"\n✅ Successfully updated {len(models_to_update)} model versions")
        else:
            print(f"\n✅ No model versions need updating - all are correct!")
        
        # Show final state
        cursor.execute("""
            SELECT pathogen_code, version_number, training_samples_count
            FROM ml_model_versions 
            WHERE model_type = 'pathogen_specific'
            ORDER BY pathogen_code
        """)
        
        print(f"\n📋 Final model version summary:")
        for row in cursor.fetchall():
            pathogen, version, samples = row
            actual = training_counts.get(pathogen, 0)
            status = "🎓 teaching complete" if actual >= 40 else "📚 teaching phase"
            print(f"   {pathogen}: v{version} ({actual} actual samples) {status}")
            
    except Exception as e:
        print(f"❌ Error fixing model versions: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()
    
    return True

if __name__ == "__main__":
    print("🔄 Fixing ML model versions based on training sample counts...")
    print("=" * 70)
    
    if fix_model_versions():
        print("\n🎉 Model version fix completed successfully!")
    else:
        print("\n❌ Model version fix failed!")
