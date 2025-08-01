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
        
        # Add CQJ and CalcJ features - handle invalid values properly
        cqj_raw = existing_metrics.get('cqj')
        calcj_raw = existing_metrics.get('calcj')
        
        # Validate CQJ - should never be 1, -1, or any unrealistic value
        if (cqj_raw is None or cqj_raw == -1 or cqj_raw == 1 or 
            (isinstance(cqj_raw, (int, float)) and (cqj_raw <= 1 or cqj_raw > 50))):
            features['cqj'] = -999  # Use sentinel value to indicate invalid/no crossing
        else:
            features['cqj'] = cqj_raw
            
        # Validate CalcJ - should be None/invalid if CQJ is invalid
        if (calcj_raw is None or calcj_raw == -1 or calcj_raw == 1 or
            features['cqj'] == -999 or  # If CQJ invalid, CalcJ must be invalid too
            (isinstance(calcj_raw, (int, float)) and calcj_raw <= 0)):
            features['calcj'] = -999  # Use sentinel value to indicate invalid
        else:
            features['calcj'] = calcj_raw
        
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
            
            # Add 12 visual metrics for comprehensive curve analysis
            visual_metrics = self._extract_visual_metrics(rfu_data, cycles)
            features.update(visual_metrics)
            
        else:
            # Default values for short curves
            for key in ['max_slope', 'max_slope_cycle', 'baseline_std', 'curve_auc',
                       'early_cycles_mean', 'late_cycles_mean', 'plateau_detection',
                       'curve_efficiency', 'derivative_peak', 'second_derivative_max']:
                features[key] = 0
            
            # Default values for visual metrics
            for i in range(12):
                features[f'visual_{i+1}'] = 0.0
                
        return features
    
    def _extract_visual_metrics(self, rfu_values, cycles):
        """Extract 12 visual metrics that characterize qPCR curve shape and quality"""
        visual_metrics = {}
        
        if len(rfu_values) < 5:
            # Return default values for insufficient data
            return {f'visual_{i+1}': 0.0 for i in range(12)}
        
        rfu_array = np.array(rfu_values)
        cycles_array = np.array(cycles)
        
        try:
            # Visual Metric 1: Baseline stability (variance in first 10 cycles)
            baseline_cycles = min(10, len(rfu_values) // 3)
            baseline_variance = np.var(rfu_array[:baseline_cycles]) if baseline_cycles > 1 else 0.0
            visual_metrics['visual_1'] = baseline_variance
            
            # Visual Metric 2: Exponential phase steepness (max derivative)
            if len(rfu_array) > 2:
                derivatives = np.diff(rfu_array)
                max_derivative = np.max(derivatives) if len(derivatives) > 0 else 0.0
            else:
                max_derivative = 0.0
            visual_metrics['visual_2'] = max_derivative
            
            # Visual Metric 3: Plateau stability (variance in last 10 cycles)
            plateau_cycles = min(10, len(rfu_values) // 3)
            plateau_variance = np.var(rfu_array[-plateau_cycles:]) if plateau_cycles > 1 else 0.0
            visual_metrics['visual_3'] = plateau_variance
            
            # Visual Metric 4: Curve smoothness (average of second derivatives)
            if len(rfu_array) > 3:
                second_derivatives = np.diff(rfu_array, n=2)
                smoothness = np.mean(np.abs(second_derivatives)) if len(second_derivatives) > 0 else 0.0
            else:
                smoothness = 0.0
            visual_metrics['visual_4'] = smoothness
            
            # Visual Metric 5: Signal trend (correlation with cycle numbers)
            correlation = np.corrcoef(cycles_array, rfu_array)[0, 1] if len(cycles_array) > 1 else 0.0
            visual_metrics['visual_5'] = correlation if not np.isnan(correlation) else 0.0
            
            # Visual Metric 6: Noise level (standard deviation / mean in plateau)
            plateau_data = rfu_array[-plateau_cycles:]
            noise_level = np.std(plateau_data) / np.mean(plateau_data) if len(plateau_data) > 1 and np.mean(plateau_data) > 0 else 0.0
            visual_metrics['visual_6'] = noise_level if not np.isnan(noise_level) else 0.0
            
            # Visual Metric 7: Exponential phase length (cycles with derivative > 50% of max)
            if len(derivatives) > 0 and max_derivative > 0:
                exp_threshold = max_derivative * 0.5
                exp_length = np.sum(derivatives > exp_threshold)
            else:
                exp_length = 0
            visual_metrics['visual_7'] = float(exp_length)
            
            # Visual Metric 8: Curve asymmetry (difference between rise and plateau phases)
            mid_point = len(rfu_array) // 2
            rise_mean = np.mean(rfu_array[:mid_point]) if mid_point > 0 else 0.0
            plateau_mean = np.mean(rfu_array[mid_point:]) if mid_point < len(rfu_array) else 0.0
            asymmetry = plateau_mean - rise_mean
            visual_metrics['visual_8'] = asymmetry
            
            # Visual Metric 9: Signal consistency (inverse of coefficient of variation)
            cv = np.std(rfu_array) / np.mean(rfu_array) if np.mean(rfu_array) > 0 else float('inf')
            consistency = 1.0 / (1.0 + cv) if cv != float('inf') else 0.0
            visual_metrics['visual_9'] = consistency
            
            # Visual Metric 10: Cycle efficiency (RFU gain per cycle in exponential phase)
            if len(derivatives) > 0:
                exp_derivatives = derivatives[derivatives > max_derivative * 0.3]
                efficiency = np.mean(exp_derivatives) if len(exp_derivatives) > 0 else 0.0
            else:
                efficiency = 0.0
            visual_metrics['visual_10'] = efficiency
            
            # Visual Metric 11: Background drift (linear trend in first 15 cycles)
            baseline_extended = min(15, len(rfu_values) // 2)
            if baseline_extended > 2:
                baseline_cycles_arr = cycles_array[:baseline_extended]
                baseline_rfu_arr = rfu_array[:baseline_extended]
                # Calculate linear regression slope
                x_mean = np.mean(baseline_cycles_arr)
                y_mean = np.mean(baseline_rfu_arr)
                numerator = np.sum((baseline_cycles_arr - x_mean) * (baseline_rfu_arr - y_mean))
                denominator = np.sum((baseline_cycles_arr - x_mean) ** 2)
                drift = numerator / denominator if denominator > 0 else 0.0
            else:
                drift = 0.0
            visual_metrics['visual_11'] = drift
            
            # Visual Metric 12: Saturation indicator (flatness in final cycles)
            final_cycles = min(8, len(rfu_values) // 4)
            if final_cycles > 1:
                final_rfu = rfu_array[-final_cycles:]
                saturation = 1.0 - (np.var(final_rfu) / (np.mean(final_rfu) + 1e-6))
                saturation = max(0.0, min(1.0, saturation))  # Clamp between 0 and 1
            else:
                saturation = 0.0
            visual_metrics['visual_12'] = saturation
            
        except Exception as e:
            print(f"Warning: Error calculating visual metrics: {e}")
            # Return default values on error
            visual_metrics = {f'visual_{i+1}': 0.0 for i in range(12)}
        
        return visual_metrics
    
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
        
        # 🔧 SAFETY CHECK: Use rule-based classification for obviously negative curves
        r2 = existing_metrics.get('r2', 0)
        amplitude = existing_metrics.get('amplitude', 0)
        snr = existing_metrics.get('snr', 0)
        cqj = existing_metrics.get('cqj')  # Don't default to -1, use None if missing
        
        # Validate CQJ - it should never be 1, -1, or any invalid value
        invalid_cqj = (cqj is None or 
                       (isinstance(cqj, (int, float)) and (cqj == -1 or cqj == 1 or 
                                                          (cqj > 0 and cqj <= 1) or cqj > 50 or cqj == -999)))
        
        # If curve is clearly negative, use rule-based classification instead of ML
        if (r2 < 0.1 or amplitude < 5.0 or snr < 0.1 or invalid_cqj):
            print(f"🔍 ML Debug: Obviously negative curve detected - using rule-based classification")
            print(f"   Reason: r2={r2:.3f}, amplitude={amplitude:.2f}, snr={snr:.2f}, cqj={cqj}")
            return self.fallback_classification(existing_metrics)
        
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
            
            # 🔧 VALIDATION CHECK: If ML predicts positive but curve looks negative, override with rule-based
            if prediction in ['POSITIVE', 'STRONG_POSITIVE', 'WEAK_POSITIVE'] and (r2 < 0.1 or amplitude < 5.0):
                print(f"🔍 ML Debug: ML predicted {prediction} but curve appears negative - using rule-based override")
                return self.fallback_classification(existing_metrics)
            
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
        try:
            from curve_classification import classify_curve
            
            print(f"🔍 ML Debug: Using fallback classification with metrics: {existing_metrics}")
            
            result = classify_curve(
                existing_metrics.get('r2', 0),
                existing_metrics.get('steepness', 0),
                existing_metrics.get('snr', 0),
                existing_metrics.get('midpoint', 0),
                existing_metrics.get('baseline', 0),
                existing_metrics.get('amplitude', 0)
            )
            
            print(f"🔍 ML Debug: Rule-based classification result: {result}")
            
            # Ensure all values are JSON serializable
            result['method'] = 'Rule-based'
            result['confidence'] = float(1.0 - result.get('confidence_penalty', 0))
            
            # Convert any numpy types to Python types
            for key, value in result.items():
                if isinstance(value, (np.integer, np.floating)):
                    result[key] = float(value)
                elif isinstance(value, np.ndarray):
                    result[key] = value.tolist()
                    
            print(f"🔍 ML Debug: Final fallback result: {result}")
            return result
            
        except Exception as e:
            print(f"❌ Fallback classification error: {e}")
            # Ultimate fallback if rule-based classification fails
            return {
                'classification': 'NEGATIVE',
                'confidence': 0.5,
                'method': 'Emergency Fallback',
                'reason': f'Rule-based classification failed: {e}'
            }
    
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
