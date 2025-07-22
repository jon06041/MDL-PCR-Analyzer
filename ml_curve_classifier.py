# ml_curve_classifier.py
"""
Machine Learning Curve Classifier with Modal-based Training Interface
Uses the curve modal visualization for expert feedback and training data collection
"""

import numpy as np
import pandas as pd
import json
from datetime import datetime
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import os

class MLCurveClassifier:
    def __init__(self):
        self.model = RandomForestClassifier(
            n_estimators=100,
            random_state=42,
            class_weight='balanced'
        )
        self.scaler = StandardScaler()
        self.feature_names = [
            'r2', 'steepness', 'snr', 'midpoint', 'baseline', 'amplitude',
            'max_slope', 'max_slope_cycle', 'baseline_std', 'curve_auc',
            'early_cycles_mean', 'late_cycles_mean', 'plateau_detection',
            'curve_efficiency', 'derivative_peak', 'second_derivative_max',
            'cqj', 'calcj'  # Added CQJ and CalcJ features
        ]
        self.classes = [
            'STRONG_POSITIVE', 'POSITIVE', 'WEAK_POSITIVE', 
            'INDETERMINATE', 'REDO', 'SUSPICIOUS', 'NEGATIVE'
        ]
        self.training_data = []
        self.model_trained = False
        self.last_accuracy = 0.0  # Track last training accuracy
        self.pathogen_models = {}  # Separate models per pathogen
        self.pathogen_scalers = {}  # Separate scalers per pathogen
        
    def extract_advanced_features(self, rfu_data, cycles, existing_metrics):
        """Extract comprehensive features from curve data"""
        features = {}
        
        # Use existing metrics
        features['r2'] = existing_metrics.get('r2', 0)
        features['steepness'] = existing_metrics.get('steepness', 0)
        features['snr'] = existing_metrics.get('snr', 0)
        features['midpoint'] = existing_metrics.get('midpoint', 0)
        features['baseline'] = existing_metrics.get('baseline', 0)
        features['amplitude'] = existing_metrics.get('amplitude', 0)
        
        # Add CQJ and CalcJ features
        features['cqj'] = existing_metrics.get('cqj', 0)
        features['calcj'] = existing_metrics.get('calcj', 0)
        
        # Advanced curve analysis
        if len(rfu_data) > 5:
            # Derivative analysis
            first_deriv = np.gradient(rfu_data)
            second_deriv = np.gradient(first_deriv)
            
            features['max_slope'] = np.max(first_deriv)
            features['max_slope_cycle'] = cycles[np.argmax(first_deriv)] if len(cycles) == len(rfu_data) else 0
            features['baseline_std'] = np.std(rfu_data[:5])
            features['curve_auc'] = np.trapz(rfu_data, cycles) if len(cycles) == len(rfu_data) else 0
            
            # Early vs late cycle analysis
            mid_point = len(rfu_data) // 2
            features['early_cycles_mean'] = np.mean(rfu_data[:mid_point])
            features['late_cycles_mean'] = np.mean(rfu_data[mid_point:])
            
            # Plateau detection
            last_10_values = rfu_data[-10:] if len(rfu_data) >= 10 else rfu_data
            features['plateau_detection'] = np.std(last_10_values)
            
            # PCR efficiency estimation
            log_phase = self.detect_log_phase(rfu_data)
            features['curve_efficiency'] = self.calculate_efficiency(rfu_data, log_phase)
            
            # Peak characteristics
            features['derivative_peak'] = np.max(first_deriv)
            features['second_derivative_max'] = np.max(second_deriv)
        else:
            # Default values for short curves
            for key in ['max_slope', 'max_slope_cycle', 'baseline_std', 'curve_auc',
                       'early_cycles_mean', 'late_cycles_mean', 'plateau_detection',
                       'curve_efficiency', 'derivative_peak', 'second_derivative_max']:
                features[key] = 0
                
        return features
    
    def detect_log_phase(self, rfu_data):
        """Detect the exponential/log phase of amplification"""
        if len(rfu_data) < 10:
            return range(len(rfu_data))
            
        # Find the steepest continuous section
        first_deriv = np.gradient(rfu_data)
        window_size = 5
        max_avg_slope = 0
        best_window = range(len(rfu_data))
        
        for i in range(len(first_deriv) - window_size):
            window_slope = np.mean(first_deriv[i:i+window_size])
            if window_slope > max_avg_slope:
                max_avg_slope = window_slope
                best_window = range(i, i+window_size)
                
        return best_window
    
    def calculate_efficiency(self, rfu_data, log_phase):
        """Calculate PCR efficiency from log phase"""
        if len(log_phase) < 3:
            return 0
            
        try:
            log_rfu = np.log10(np.array(rfu_data)[log_phase])
            cycles = np.array(range(len(log_phase)))
            
            # Linear regression on log phase
            slope = np.polyfit(cycles, log_rfu, 1)[0]
            efficiency = (10**(-1/slope) - 1) * 100
            
            # Clamp to reasonable range
            return max(0, min(200, efficiency))
        except:
            return 0
    
    def predict_classification(self, rfu_data, cycles, existing_metrics, pathogen=None):
        """Predict curve classification using ML model"""
        # Ensure pathogen is a valid string or None
        if pathogen is not None:
            pathogen = str(pathogen).strip()
            if pathogen == '' or pathogen == 'Unknown':
                pathogen = None
        
        # Try pathogen-specific model first
        if pathogen and pathogen in self.pathogen_models:
            model = self.pathogen_models[pathogen]
            scaler = self.pathogen_scalers[pathogen]
            model_type = f"pathogen-specific ({pathogen})"
        elif self.model_trained:
            model = self.model
            scaler = self.scaler
            model_type = "general ML"
        else:
            print(f"🔍 ML Debug: No trained model available, using fallback classification")
            return self.fallback_classification(existing_metrics)
            
        features = self.extract_advanced_features(rfu_data, cycles, existing_metrics)
        feature_vector = np.array([features[name] for name in self.feature_names]).reshape(1, -1)
        
        # Debug logging for feature extraction consistency
        print(f"🔍 ML Debug: Feature extraction for prediction ({model_type})")
        print(f"   Pathogen: {pathogen}")
        print(f"   Key features: amplitude={features.get('amplitude', 'N/A'):.2f}, "
              f"r2={features.get('r2', 'N/A'):.3f}, snr={features.get('snr', 'N/A'):.2f}")
        print(f"   CQJ/CalcJ: cqj={features.get('cqj', 'N/A')}, calcj={features.get('calcj', 'N/A')}")
        
        try:
            feature_vector_scaled = scaler.transform(feature_vector)
            prediction = model.predict(feature_vector_scaled)[0]
            confidence = np.max(model.predict_proba(feature_vector_scaled))
            
            # Additional debug logging for prediction
            print(f"🔍 ML Debug: Prediction result: {prediction} (confidence: {confidence:.3f})")
            
            # Convert numpy values to Python native types for JSON serialization
            return {
                'classification': str(prediction),
                'confidence': float(confidence),
                'method': f'ML{"_" + pathogen if pathogen else ""}',
                'features_used': {k: float(v) if isinstance(v, (np.integer, np.floating)) else v 
                                for k, v in features.items()},
                'pathogen': pathogen
            }
        except Exception as e:
            print(f"ML prediction failed: {e}")
            return self.fallback_classification(existing_metrics)
    
    def fallback_classification(self, existing_metrics):
        """Fallback to rule-based classification"""
        from curve_classification import classify_curve
        
        result = classify_curve(
            existing_metrics.get('r2', 0),
            existing_metrics.get('steepness', 0),
            existing_metrics.get('snr', 0),
            existing_metrics.get('midpoint', 0),
            existing_metrics.get('baseline', 0),
            existing_metrics.get('amplitude', 0)
        )
        
        # Ensure all values are JSON serializable
        result['method'] = 'Rule-based'
        result['confidence'] = float(1.0 - result.get('confidence_penalty', 0))
        
        # Convert any numpy types to Python types
        for key, value in result.items():
            if isinstance(value, (np.integer, np.floating)):
                result[key] = float(value)
            elif isinstance(value, np.ndarray):
                result[key] = value.tolist()
                
        return result
    
    def add_training_sample(self, rfu_data, cycles, existing_metrics, expert_classification, well_id, pathogen=None):
        """Add a training sample from expert feedback"""
        features = self.extract_advanced_features(rfu_data, cycles, existing_metrics)
        
        # Create unique sample identifier for duplicate prevention
        # This should match the frontend logic: full_sample_name||pathogen||channel
        sample_name = existing_metrics.get('sample', 'Unknown_Sample')
        channel = existing_metrics.get('channel', existing_metrics.get('fluorophore', 'Unknown_Channel'))
        pathogen_safe = pathogen or 'General_PCR'
        sample_identifier = f"{sample_name}||{pathogen_safe}||{channel}"
        
        # Debug logging for feature extraction consistency 
        print(f"🔍 ML Debug: Adding training sample for feedback")
        print(f"   Well ID: {well_id}")
        print(f"   Sample Identifier: {sample_identifier}")
        print(f"   Expert classification: {expert_classification}")
        print(f"   Pathogen: {pathogen}")
        print(f"   Key features: amplitude={features.get('amplitude', 'N/A'):.2f}, "
              f"r2={features.get('r2', 'N/A'):.3f}, snr={features.get('snr', 'N/A'):.2f}")
        print(f"   CQJ/CalcJ: cqj={features.get('cqj', 'N/A')}, calcj={features.get('calcj', 'N/A')}")
        
        # Check if this sample identifier already exists and remove it (for retraining)
        self.training_data = [
            sample for sample in self.training_data 
            if sample.get('sample_identifier') != sample_identifier
        ]
        
        if len(self.training_data) != len([s for s in self.training_data if s.get('sample_identifier') != sample_identifier]):
            print(f"🔄 ML Debug: Removed previous training data for sample: {sample_identifier}")
        
        training_sample = {
            'timestamp': datetime.now().isoformat(),
            'well_id': well_id,
            'sample_identifier': sample_identifier,  # Add unique identifier
            'sample_name': sample_name,              # Store sample name
            'channel': channel,                      # Store channel
            'pathogen': pathogen,
            'features': features,
            'expert_classification': expert_classification,
            'existing_classification': existing_metrics.get('classification', 'UNKNOWN'),
            'ml_classification': self.predict_classification(rfu_data, cycles, existing_metrics, pathogen).get('classification', 'UNKNOWN')
        }
        
        print(f"🔍 ML Debug: Training sample created with ML classification: {training_sample['ml_classification']}")
        
        self.training_data.append(training_sample)
        self.save_training_data()
        
        total_samples = len(self.training_data)
        
        # Enhanced retraining logic - retrain at key milestones and regularly
        should_retrain = False
        retrain_reason = ""
        
        # Initial training thresholds
        if total_samples == 10:
            should_retrain = True
            retrain_reason = "initial training (10 samples)"
        elif total_samples == 20:
            should_retrain = True
            retrain_reason = "production ready (20 samples)"
        # Regular retraining every 5 samples after 20
        elif total_samples > 20 and (total_samples - 20) % 5 == 0:
            should_retrain = True
            retrain_reason = f"regular update ({total_samples} samples)"
        # Force retrain if we haven't retrained in a while (every 15 samples after 20)
        elif total_samples > 20 and (total_samples - 20) % 15 == 0:
            should_retrain = True
            retrain_reason = f"periodic refresh ({total_samples} samples)"
        
        if should_retrain:
            print(f"🔄 ML Debug: Triggering general model retrain - {retrain_reason}")
            success = self.retrain_model()
            if success:
                print(f"✅ ML Debug: Model successfully retrained with {total_samples} samples")
            else:
                print(f"❌ ML Debug: Model retraining failed with {total_samples} samples")
        else:
            print(f"📊 ML Debug: No retraining needed yet ({total_samples} samples, next at {self._get_next_retrain_threshold(total_samples)})")
            
        # Also retrain pathogen-specific model if we have enough samples
        if pathogen:
            # Safely filter training data with pathogen validation
            pathogen_samples = []
            for s in self.training_data:
                sample_pathogen = s.get('pathogen')
                if sample_pathogen is not None and str(sample_pathogen) == str(pathogen):
                    pathogen_samples.append(s)
            
            pathogen_count = len(pathogen_samples)
            # More frequent pathogen-specific retraining
            if pathogen_count >= 5 and (pathogen_count == 5 or pathogen_count % 3 == 0):
                print(f"🔄 ML Debug: Triggering pathogen-specific model retrain for {pathogen} with {pathogen_count} samples")
                self.retrain_pathogen_model(pathogen)
                
    def _get_next_retrain_threshold(self, current_samples):
        """Calculate when the next retraining will occur"""
        if current_samples < 10:
            return 10
        elif current_samples < 20:
            return 20
        else:
            # Next multiple of 5 after 20
            return 20 + ((current_samples - 20) // 5 + 1) * 5
                
    def check_sample_already_trained(self, sample_identifier, full_sample_name, pathogen, channel):
        """Check if a sample has already been used for training"""
        # Check if the sample identifier exists in training data
        for sample in self.training_data:
            if sample.get('sample_identifier') == sample_identifier:
                print(f"🚫 ML Duplicate Check: Sample already trained - {sample_identifier}")
                return True
        
        print(f"✅ ML Duplicate Check: Sample not previously trained - {sample_identifier}")
        return False
        
    def get_trained_sample_identifiers(self):
        """Get list of all trained sample identifiers"""
        identifiers = []
        for sample in self.training_data:
            sample_id = sample.get('sample_identifier')
            if sample_id:
                identifiers.append(sample_id)
        
        print(f"📚 ML Training Data: Retrieved {len(identifiers)} trained sample identifiers")
        return identifiers
    
    def save_training_data(self):
        """Save training data to file"""
        with open('ml_training_data.json', 'w') as f:
            json.dump(self.training_data, f, indent=2)
    
    def load_training_data(self):
        """Load existing training data"""
        try:
            with open('ml_training_data.json', 'r') as f:
                self.training_data = json.load(f)
        except FileNotFoundError:
            self.training_data = []
    
    def retrain_model(self):
        """Retrain the ML model with current training data"""
        if len(self.training_data) < 10:
            print("Insufficient training data for ML model")
            return False
            
        # Prepare training data
        X = []
        y = []
        
        for sample in self.training_data:
            feature_vector = [sample['features'][name] for name in self.feature_names]
            X.append(feature_vector)
            y.append(sample['expert_classification'])
        
        X = np.array(X)
        y = np.array(y)
        
        # Handle missing classes
        unique_classes = np.unique(y)
        print(f"Training with {len(X)} samples, {len(unique_classes)} classes: {unique_classes}")
        
        # Split data
        if len(X) > 20:
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        else:
            X_train, X_test, y_train, y_test = X, X, y, y
        
        # Scale features
        self.scaler.fit(X_train)
        X_train_scaled = self.scaler.transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train model
        self.model.fit(X_train_scaled, y_train)
        self.model_trained = True
        
        accuracy = 0.0
        
        # Evaluate
        if len(X_test) > 0:
            predictions = self.model.predict(X_test_scaled)
            accuracy = np.mean(predictions == y_test)
            print(f"Model retrained. Accuracy: {accuracy:.2f}")
            
            # Save model
            self.save_model()
        
        # Store accuracy in model stats
        self.last_accuracy = accuracy
        
        return True
    
    def retrain_pathogen_model(self, pathogen):
        """Retrain pathogen-specific ML model"""
        # Safely filter training data with pathogen validation
        pathogen_samples = []
        for s in self.training_data:
            sample_pathogen = s.get('pathogen')
            if sample_pathogen is not None and str(sample_pathogen) == str(pathogen):
                pathogen_samples.append(s)
        
        if len(pathogen_samples) < 5:
            print(f"Insufficient training data for {pathogen} model")
            return False
            
        # Prepare training data
        X = []
        y = []
        
        for sample in pathogen_samples:
            feature_vector = [sample['features'][name] for name in self.feature_names]
            X.append(feature_vector)
            y.append(sample['expert_classification'])
        
        X = np.array(X)
        y = np.array(y)
        
        # Create pathogen-specific model
        pathogen_model = RandomForestClassifier(
            n_estimators=50,  # Smaller for pathogen-specific
            random_state=42,
            class_weight='balanced'
        )
        pathogen_scaler = StandardScaler()
        
        # Scale features
        X_scaled = pathogen_scaler.fit_transform(X)
        
        # Train model
        pathogen_model.fit(X_scaled, y)
        
        # Store pathogen-specific model
        self.pathogen_models[pathogen] = pathogen_model
        self.pathogen_scalers[pathogen] = pathogen_scaler
        
        print(f"Pathogen-specific model trained for {pathogen} with {len(X)} samples")
        
        # Save pathogen models
        self.save_pathogen_models()
        
        return True
    
    def save_model(self):
        """Save trained model to disk"""
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names,
            'classes': self.classes
        }, 'ml_curve_classifier.pkl')
    
    def save_pathogen_models(self):
        """Save pathogen-specific models to disk"""
        pathogen_data = {
            'pathogen_models': self.pathogen_models,
            'pathogen_scalers': self.pathogen_scalers
        }
        joblib.dump(pathogen_data, 'ml_pathogen_models.pkl')
    
    def load_model(self):
        """Load trained model from disk"""
        try:
            saved_data = joblib.load('ml_curve_classifier.pkl')
            self.model = saved_data['model']
            self.scaler = saved_data['scaler']
            self.feature_names = saved_data['feature_names']
            self.classes = saved_data['classes']
            self.model_trained = True
            return True
        except FileNotFoundError:
            print("No saved model found")
            return False
    
    def load_pathogen_models(self):
        """Load pathogen-specific models from disk"""
        try:
            pathogen_data = joblib.load('ml_pathogen_models.pkl')
            self.pathogen_models = pathogen_data['pathogen_models']
            self.pathogen_scalers = pathogen_data['pathogen_scalers']
            print(f"Loaded {len(self.pathogen_models)} pathogen-specific models")
            return True
        except FileNotFoundError:
            print("No saved pathogen models found")
            return False
    
    def get_model_stats(self):
        """Get statistics about the current model"""
        stats = {
            'training_samples': len(self.training_data),
            'model_trained': self.model_trained,
            'accuracy': self.last_accuracy,  # Add accuracy to stats
            'feature_count': len(self.feature_names),
            'class_count': len(self.classes)
        }
        
        if self.training_data:
            # Class distribution
            classifications = [sample['expert_classification'] for sample in self.training_data]
            unique, counts = np.unique(classifications, return_counts=True)
            # Convert numpy int64 to regular Python ints for JSON serialization
            stats['class_distribution'] = dict(zip(unique, [int(count) for count in counts]))
            
            # Pathogen-specific training sample counts
            pathogen_training_counts = {}
            for sample in self.training_data:
                pathogen = sample.get('pathogen', 'unknown')
                if pathogen not in pathogen_training_counts:
                    pathogen_training_counts[pathogen] = 0
                pathogen_training_counts[pathogen] += 1
            
            # Create detailed pathogen models info with training counts
            stats['pathogen_models'] = []
            for pathogen in self.pathogen_models.keys():
                training_count = pathogen_training_counts.get(pathogen, 0)
                stats['pathogen_models'].append({
                    'pathogen_code': pathogen,
                    'test_code': pathogen,  # For compatibility
                    'training_samples': training_count,
                    'model_trained': True
                })
            
            # Add any pathogens with training data but no model yet
            for pathogen, count in pathogen_training_counts.items():
                if pathogen not in self.pathogen_models:
                    stats['pathogen_models'].append({
                        'pathogen_code': pathogen,
                        'test_code': pathogen,  # For compatibility
                        'training_samples': count,
                        'model_trained': False
                    })
        else:
            # No training data yet
            stats['pathogen_models'] = []
        
        return stats

def extract_pathogen_from_well_data(well_data):
    """Extract pathogen information from well data using pathogen library"""
    
    print(f"ML: Extracting pathogen from well_data: {well_data}")
    
    # Priority 1: Use channel-specific pathogen if available (for multichannel experiments)
    if 'specific_pathogen' in well_data and well_data['specific_pathogen']:
        pathogen = str(well_data['specific_pathogen']).strip()
        if pathogen and pathogen != 'Unknown' and pathogen != '':
            print(f"ML: Using channel-specific pathogen: {pathogen}")
            return pathogen
    
    # Priority 2: Use target field (specific pathogen for this channel)
    if 'target' in well_data and well_data['target']:
        target = str(well_data['target']).strip()
        if target and target != 'Unknown' and target != '':
            print(f"ML: Using target field pathogen: {target}")
            return target
    
    # Priority 3: Use pathogen field directly
    if 'pathogen' in well_data and well_data['pathogen']:
        pathogen = str(well_data['pathogen']).strip()
        if pathogen and pathogen != 'Unknown' and pathogen != '':
            print(f"ML: Using pathogen field: {pathogen}")
            return pathogen
    
    # Priority 4: Extract from experiment pattern (fallback for single-channel experiments)
    test_code = None
    
    # Check various fields that might contain the test code
    for field in ['test_code', 'experiment_pattern', 'sample_name']:
        if field in well_data and well_data[field]:
            test_code = str(well_data[field]).strip()
            if test_code and test_code != '':
                break
    
    if not test_code:
        print("ML: No pathogen information found in well data")
        return "General_PCR"  # Return fallback instead of None
    
    print(f"ML: Using experiment-level pathogen: {test_code}")
    return test_code

# Global instance
ml_classifier = MLCurveClassifier()
ml_classifier.load_training_data()
ml_classifier.load_model()
ml_classifier.load_pathogen_models()
