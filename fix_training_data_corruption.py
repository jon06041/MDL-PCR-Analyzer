#!/usr/bin/env python3
"""
Fix ML Training Data Corruption

This script identifies and corrects training data where good curves
were incorrectly labeled as NEGATIVE instead of POSITIVE.
"""

import json
import shutil
from datetime import datetime

def analyze_and_fix_training_data():
    """Analyze training data and fix obvious mislabeling"""
    
    # Load current training data
    with open('ml_training_data.json', 'r') as f:
        data = json.load(f)
    
    print("🔍 Analyzing ML training data for corruption...")
    
    # Backup original data
    backup_file = f'ml_training_data_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    shutil.copy('ml_training_data.json', backup_file)
    print(f"📁 Backed up original data to: {backup_file}")
    
    # Track changes
    corrections_made = 0
    total_negative = 0
    total_positive = 0
    
    print("\n🔍 Checking for good curves mislabeled as NEGATIVE...")
    
    for i, entry in enumerate(data):
        features = entry.get('features', {})
        expert_class = entry.get('expert_classification', '')
        well_id = entry.get('well_id', f'entry_{i}')
        
        # Count totals
        if expert_class == 'POSITIVE':
            total_positive += 1
        elif expert_class == 'NEGATIVE':
            total_negative += 1
        
        # Check if this is a good curve that should be positive
        r2 = features.get('r2', 0)
        steepness = features.get('steepness', 0)
        snr = features.get('snr', 0)
        amplitude = features.get('amplitude', 0)
        
        # Criteria for "obviously good curve that should be positive"
        # These are conservative criteria to avoid false corrections
        is_excellent_curve = (
            r2 > 0.92 and              # Excellent fit
            steepness > 0.15 and       # Good steepness 
            snr > 8 and                # High signal to noise
            amplitude > 800            # Substantial amplitude
        )
        
        # If it's an excellent curve but labeled negative, fix it
        if is_excellent_curve and expert_class == 'NEGATIVE':
            print(f"🚨 FIXING: {well_id}")
            print(f"   Metrics: r2={r2:.3f}, steep={steepness:.3f}, snr={snr:.1f}, amp={amplitude:.0f}")
            print(f"   Changed: NEGATIVE → POSITIVE")
            
            # Fix the label
            data[i]['expert_classification'] = 'POSITIVE'
            data[i]['correction_timestamp'] = datetime.now().isoformat()
            data[i]['correction_reason'] = 'Auto-corrected: excellent curve metrics incorrectly labeled negative'
            
            corrections_made += 1
            total_negative -= 1
            total_positive += 1
    
    print(f"\n📊 SUMMARY:")
    print(f"Total entries analyzed: {len(data)}")
    print(f"Corrections made: {corrections_made}")
    print(f"Final POSITIVE count: {total_positive}")
    print(f"Final NEGATIVE count: {total_negative}")
    
    if corrections_made > 0:
        # Save corrected data
        with open('ml_training_data.json', 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"\n✅ Corrected training data saved!")
        print(f"🔄 ML model should be retrained with corrected data")
        
        # Also create a specific corrections log
        corrections_log = {
            'timestamp': datetime.now().isoformat(),
            'corrections_made': corrections_made,
            'backup_file': backup_file,
            'summary': f"Fixed {corrections_made} excellent curves that were mislabeled as NEGATIVE"
        }
        
        with open('training_data_corrections.json', 'w') as f:
            json.dump(corrections_log, f, indent=2)
        
        return True
    else:
        print(f"\n✅ No obvious corruption found in training data")
        return False

def retrain_model():
    """Retrain the ML model with corrected data"""
    print("\n🤖 Retraining ML model with corrected data...")
    
    try:
        from ml_curve_classifier import ml_classifier
        
        # Retrain the model
        success = ml_classifier.train_model()
        
        if success:
            print("✅ ML model retrained successfully!")
            return True
        else:
            print("❌ ML model retraining failed")
            return False
            
    except Exception as e:
        print(f"❌ Error retraining model: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("ML Training Data Corruption Fix")
    print("=" * 60)
    
    # Fix training data
    corrections_made = analyze_and_fix_training_data()
    
    if corrections_made:
        # Retrain model with corrected data
        retrain_success = retrain_model()
        
        if retrain_success:
            print("\n🎉 COMPLETE: Training data fixed and ML model retrained!")
            print("The ML model should now correctly classify good curves as positive.")
        else:
            print("\n⚠️  Training data fixed but model retraining failed.")
            print("You may need to manually retrain the model.")
    else:
        print("\n✅ No corrections needed - training data appears clean.")
