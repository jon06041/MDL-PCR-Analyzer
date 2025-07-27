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
    
    def predict_classification(self, rfu_data, cycles, existing_metrics, pathogen=None, well_id=None):
        """Predict curve classification using ML model"""
        from ml_validation_tracker import ml_tracker
        
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
            model_version = f"pathogen_{pathogen}_1.0"
        elif self.model_trained:
            model = self.model
            scaler = self.scaler
            model_type = "general ML"
            model_version = f"general_1.{len(self.training_data)}"
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
            
            # Track prediction for dashboard (only if well_id provided to avoid duplicate tracking)
            if well_id:
                ml_tracker.track_model_prediction(
                    well_id=well_id,
                    pathogen=pathogen or 'General_PCR',
                    prediction=str(prediction),
                    confidence=float(confidence),
                    features_used=features,
                    model_version=model_version,
                    user_id='ml_system'
                )
            
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
        from ml_validation_tracker import ml_tracker
        from ml_qc_validation_system import ml_qc_system
        
        pathogen_safe = pathogen or 'General_PCR'
        
        # Check if training should be paused for this pathogen
        if ml_qc_system.should_pause_training(pathogen_safe):
            print(f"⏸️  Training paused for {pathogen_safe} - 40+ sample milestone reached")
            print(f"   Expert feedback logged but no retraining triggered")
            print(f"   Focus on validation runs to establish capability evidence")
            
            # Still log the expert feedback for record keeping
            features = self.extract_advanced_features(rfu_data, cycles, existing_metrics)
            ml_prediction_result = self.predict_classification(rfu_data, cycles, existing_metrics, pathogen)
            ml_classification = ml_prediction_result.get('classification', 'UNKNOWN')
            ml_confidence = ml_prediction_result.get('confidence', 0.0)
            
            ml_tracker.track_expert_decision(
                well_id=well_id,
                original_prediction=ml_classification,
                expert_correction=expert_classification,
                pathogen=pathogen_safe,
                confidence=ml_confidence,
                features_used=features,
                user_id='expert'
            )
            
            return  # Exit without retraining
        
        features = self.extract_advanced_features(rfu_data, cycles, existing_metrics)
        
        # Create unique sample identifier for duplicate prevention
        # This should match the frontend logic: full_sample_name||pathogen||channel
        sample_name = existing_metrics.get('sample', 'Unknown_Sample')
        channel = existing_metrics.get('channel', existing_metrics.get('fluorophore', 'Unknown_Channel'))
        sample_identifier = f"{sample_name}||{pathogen_safe}||{channel}"
        
        # Get ML prediction before expert correction
        ml_prediction_result = self.predict_classification(rfu_data, cycles, existing_metrics, pathogen)
        ml_classification = ml_prediction_result.get('classification', 'UNKNOWN')
        ml_confidence = ml_prediction_result.get('confidence', 0.0)
        
        # Debug logging for feature extraction consistency 
        print(f"🔍 ML Debug: Adding training sample for feedback")
        print(f"   Well ID: {well_id}")
        print(f"   Sample Identifier: {sample_identifier}")
        print(f"   Expert classification: {expert_classification}")
        print(f"   ML prediction: {ml_classification} (confidence: {ml_confidence:.3f})")
        print(f"   Pathogen: {pathogen}")
        print(f"   Key features: amplitude={features.get('amplitude', 'N/A'):.2f}, "
              f"r2={features.get('r2', 'N/A'):.3f}, snr={features.get('snr', 'N/A'):.2f}")
        print(f"   CQJ/CalcJ: cqj={features.get('cqj', 'N/A')}, calcj={features.get('calcj', 'N/A')}")
        
        # Track expert decision for compliance and dashboard
        ml_tracker.track_expert_decision(
            well_id=well_id,
            original_prediction=ml_classification,
            expert_correction=expert_classification,
            pathogen=pathogen_safe,
            confidence=ml_confidence,
            features_used=features,
            user_id='expert'
        )
        
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
            'ml_classification': ml_classification
        }
        
        print(f"🔍 ML Debug: Training sample created with ML classification: {training_sample['ml_classification']}")
        
        self.training_data.append(training_sample)
        self.save_training_data()
        
        total_samples = len(self.training_data)
        
        # Check for TEACHING milestone (40+ samples) - this triggers training pause
        teaching_milestone = ml_qc_system.check_training_milestone(pathogen_safe, total_samples)
        
        if teaching_milestone:
            print(f"🎓 TEACHING MILESTONE: {pathogen_safe} - Training will be paused after this retrain")
        
        # Enhanced retraining logic - milestone-based instead of frequent
        should_retrain = False
        retrain_reason = ""
        
        # Initial training thresholds
        if total_samples == 10:
            should_retrain = True
            retrain_reason = "initial training (10 samples)"
        elif total_samples == 20:
            should_retrain = True
            retrain_reason = "production ready (20 samples)"
        elif total_samples == 40:
            should_retrain = True
            retrain_reason = "teaching milestone (40 samples) - FINAL TRAINING"
        # After 40 samples, only retrain for significant milestones
        elif total_samples > 40 and total_samples % 20 == 0:
            should_retrain = True
            retrain_reason = f"major milestone ({total_samples} samples)"
        
        if should_retrain:
            print(f"🔄 ML Debug: Triggering general model retrain - {retrain_reason}")
            success = self.retrain_model()
            if success:
                print(f"✅ ML Debug: Model successfully retrained with {total_samples} samples")
            else:
                print(f"❌ ML Debug: Model retraining failed with {total_samples} samples")
        else:
            print(f"📊 ML Debug: No retraining needed yet ({total_samples} samples, next at {self._get_next_retrain_threshold(total_samples)})")
            
        # Also retrain pathogen-specific model if we have enough samples (but respect pause)
        if pathogen and not ml_qc_system.should_pause_training(pathogen_safe):
            # Safely filter training data with pathogen validation
            pathogen_samples = []
            for s in self.training_data:
                sample_pathogen = s.get('pathogen')
                if sample_pathogen is not None and str(sample_pathogen) == str(pathogen):
                    pathogen_samples.append(s)
            
            pathogen_count = len(pathogen_samples)
            # More conservative pathogen-specific retraining
            if pathogen_count >= 5 and (pathogen_count == 5 or pathogen_count % 10 == 0):
                print(f"🔄 ML Debug: Triggering pathogen-specific model retrain for {pathogen} with {pathogen_count} samples")
                self.retrain_pathogen_model(pathogen)
        
        # Milestone-based retraining logic - only retrain at significant milestones
        should_retrain = False
        retrain_reason = ""
        
        # Milestone-based versioning (40+ samples minimum for production)
        if total_samples == 10:
            should_retrain = True
            retrain_reason = "initial training milestone (10 samples)"
        elif total_samples == 25:
            should_retrain = True
            retrain_reason = "validation milestone (25 samples)"
        elif total_samples == 40:
            should_retrain = True
            retrain_reason = "production readiness milestone (40 samples)"
        elif total_samples >= 40 and total_samples % 25 == 0:
            should_retrain = True
            retrain_reason = f"milestone checkpoint ({total_samples} samples)"
        
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
        """Calculate when the next retraining will occur - milestone-based"""
        if current_samples < 10:
            return 10
        elif current_samples < 20:
            return 20
        elif current_samples < 40:
            return 40  # Teaching milestone
        elif current_samples >= 40:
            # After teaching milestone, only major milestones (every 20 samples)
            return ((current_samples // 20) + 1) * 20
        else:
            return current_samples + 10  # Fallback
                
    def register_prediction_run_for_qc(self, run_samples, pathogen=None):
        """Register a prediction run for QC validation"""
        from ml_qc_validation_system import ml_qc_system
        
        pathogen_safe = pathogen or 'General_PCR'
        
        # Only register runs that are in validation or production phase
        phase = ml_qc_system.get_pathogen_phase(pathogen_safe)
        
        if phase == 'teaching':
            print(f"📚 Teaching phase for {pathogen_safe} - predictions not registered for QC yet")
            return None
        
        print(f"📊 Registering prediction run for QC validation: {pathogen_safe} ({phase} phase)")
        
        # Prepare sample data for QC tracking
        samples_data = []
        for sample in run_samples:
            samples_data.append({
                'sample_id': sample.get('sample_id', sample.get('well_id')),
                'well_id': sample.get('well_id'),
                'ml_prediction': sample.get('ml_prediction'),
                'ml_confidence': sample.get('ml_confidence', 0.0),
                'expected_result': sample.get('expected_result'),  # If known
                'is_correct': sample.get('is_correct', False)  # Will be determined by QC
            })
        
        # Get current model version
        model_version = self.get_current_model_version(pathogen_safe)
        
        # Register with QC system
        run_id = ml_qc_system.register_prediction_run(
            pathogen_code=pathogen_safe,
            samples_data=samples_data,
            model_version=model_version
        )
        
        if run_id:
            print(f"✅ QC run registered: {run_id} ({len(samples_data)} samples)")
            print(f"   QC can now validate this run for evidence-based capability assessment")
        
        return run_id
    
    def get_current_model_version(self, pathogen=None):
        """Get current model version for pathogen"""
        from ml_qc_validation_system import ml_qc_system
        
        pathogen_safe = pathogen or 'General_PCR'
        phase = ml_qc_system.get_pathogen_phase(pathogen_safe)
        
        # Base version on training samples and phase
        if pathogen and pathogen in self.pathogen_models:
            base_samples = len([s for s in self.training_data 
                              if s.get('pathogen') == pathogen])
        else:
            base_samples = len(self.training_data)
        
        if phase == 'production':
            return f"v2.0_validated"
        elif phase == 'validation':
            return f"v1.{base_samples}_validation"
        else:
            return f"v0.{base_samples}_teaching"
                
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
        from ml_validation_tracker import ml_tracker
        
        if len(self.training_data) < 10:
            print("Insufficient training data for ML model")
            return False
            
        # Prepare training data
        X = []
        y = []
        
        for sample in self.training_data:
            feature_vector = []
            for name in self.feature_names:
                value = sample['features'][name]
                # Handle dictionary features (like cqj/calcj) by extracting numeric value
                if isinstance(value, dict):
                    # Try to get a numeric value from the dict
                    numeric_value = None
                    for key, val in value.items():
                        if val is None:
                            # None means no threshold crossing (negative well)
                            numeric_value = -1.0
                            break
                        elif isinstance(val, (int, float)):
                            numeric_value = float(val)
                            break
                        elif isinstance(val, str) and val.replace('.', '').replace('-', '').isdigit():
                            numeric_value = float(val)
                            break
                    # Use -1 if no numeric value found (indicates no threshold crossing)
                    feature_vector.append(numeric_value if numeric_value is not None else -1.0)
                elif value is None:
                    feature_vector.append(-1.0)  # None also means no threshold crossing
                elif isinstance(value, (int, float)):
                    feature_vector.append(float(value))
                elif isinstance(value, str):
                    # Try to convert string to float
                    try:
                        feature_vector.append(float(value))
                    except ValueError:
                        feature_vector.append(0.0)
                else:
                    # Fallback for any other type
                    feature_vector.append(0.0)
            
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
        
        # Track training event for general PCR model
        model_version = f"1.{len(self.training_data)}"
        ml_tracker.track_training_event(
            pathogen='General_PCR',
            training_samples=len(self.training_data),
            accuracy=accuracy,
            model_version=model_version,
            trigger_reason=f"expert_feedback_retrain_{len(self.training_data)}_samples",
            user_id='ml_system'
        )
        
        # Update model version in database
        ml_tracker.update_pathogen_model_version(
            pathogen='General_PCR',
            version=model_version,
            accuracy=accuracy,
            training_samples=len(self.training_data),
            deployment_status='active'
        )
        
        return True
    
    def retrain_pathogen_model(self, pathogen):
        """Retrain pathogen-specific ML model"""
        from ml_validation_tracker import ml_tracker
        
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
            feature_vector = []
            for name in self.feature_names:
                value = sample['features'][name]
                # Handle dictionary features (like cqj/calcj) by extracting numeric value
                if isinstance(value, dict):
                    # Try to get a numeric value from the dict
                    numeric_value = None
                    for key, val in value.items():
                        if val is None:
                            # None means no threshold crossing (negative well)
                            numeric_value = -1.0
                            break
                        elif isinstance(val, (int, float)):
                            numeric_value = float(val)
                            break
                        elif isinstance(val, str) and val.replace('.', '').replace('-', '').isdigit():
                            numeric_value = float(val)
                            break
                    # Use -1 if no numeric value found (indicates no threshold crossing)
                    feature_vector.append(numeric_value if numeric_value is not None else -1.0)
                elif value is None:
                    feature_vector.append(-1.0)  # None also means no threshold crossing
                elif isinstance(value, (int, float)):
                    feature_vector.append(float(value))
                elif isinstance(value, str):
                    # Try to convert string to float
                    try:
                        feature_vector.append(float(value))
                    except ValueError:
                        feature_vector.append(0.0)
                else:
                    # Fallback for any other type
                    feature_vector.append(0.0)
            
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
        
        # Calculate accuracy (simple evaluation on training data for pathogen-specific models)
        predictions = pathogen_model.predict(X_scaled)
        accuracy = np.mean(predictions == y)
        
        # Store pathogen-specific model
        self.pathogen_models[pathogen] = pathogen_model
        self.pathogen_scalers[pathogen] = pathogen_scaler
        
        print(f"Pathogen-specific model trained for {pathogen} with {len(X)} samples (accuracy: {accuracy:.2f})")
        
        # Track pathogen-specific training event
        model_version = f"1.{len(pathogen_samples)}"
        ml_tracker.track_training_event(
            pathogen=pathogen,
            training_samples=len(pathogen_samples),
            accuracy=accuracy,
            model_version=model_version,
            trigger_reason=f"pathogen_specific_retrain_{len(pathogen_samples)}_samples",
            user_id='ml_system'
        )
        
        # Update pathogen-specific model version
        ml_tracker.update_pathogen_model_version(
            pathogen=pathogen,
            version=model_version,
            accuracy=accuracy,
            training_samples=len(pathogen_samples),
            deployment_status='active'
        )
        
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
    
    # Priority 4: Use current experiment pattern from frontend (NEW - enhanced approach)
    current_pattern = well_data.get('current_experiment_pattern')
    extracted_test_code = well_data.get('extracted_test_code')
    channel = well_data.get('channel') or well_data.get('fluorophore', '')
    
    if current_pattern and extracted_test_code and channel:
        print(f"ML: Trying current experiment pattern: {current_pattern} -> test_code: {extracted_test_code} + channel: {channel}")
        # Try to get pathogen using the extracted test code and channel
        # This would require importing pathogen library functions, but we can construct the pathogen name
        constructed_pathogen = f"{extracted_test_code}_{channel}"
        if constructed_pathogen and constructed_pathogen != 'Unknown_':
            print(f"ML: Using constructed pathogen from experiment: {constructed_pathogen}")
            return constructed_pathogen
    
    # Priority 5: Extract from experiment pattern (fallback for single-channel experiments)
    test_code = None
    
    # Check various fields that might contain the test code
    for field in ['test_code', 'experiment_pattern', 'sample_name', 'extracted_test_code']:
        if field in well_data and well_data[field]:
            test_code = str(well_data[field]).strip()
            if test_code and test_code != '':
                print(f"ML: Found test code '{test_code}' from field '{field}'")
                break
    
    # Priority 6: Use channel alone as pathogen for multichannel (fallback)
    if not test_code and channel:
        print(f"ML: Using channel as pathogen fallback: {channel}")
        return channel
    
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
