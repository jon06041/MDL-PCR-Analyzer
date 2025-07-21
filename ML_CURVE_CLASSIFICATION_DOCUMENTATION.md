# ML Curve Classification & qPCR Logic Reference

## Overview

The MDL PCR Analyzer includes an advanced Machine Learning (ML) curve classification system that can learn from expert feedback to improve qPCR result classification accuracy. This system uses a RandomForestClassifier trained on 18 curve-focused features to predict POS/NEG/REDO classifications.

This document serves as a comprehensive reference for both ML classification and traditional rule-based qPCR curve analysis logic.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    qPCR Analysis Pipeline                       │
├─────────────────────────────────────────────────────────────────┤
│  Raw qPCR Data  →  Curve Fitting  →  Feature Extraction       │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                   │
│  │  Rule-Based     │    │  ML Classifier  │                   │
│  │  Classification │    │  (if trained)   │                   │
│  │  (Fallback)     │    │                 │                   │
│  └─────────────────┘    └─────────────────┘                   │
│                                                                 │
│                    ↓                                           │
│              Final Classification                               │
│              (POS / NEG / REDO)                                │
└─────────────────────────────────────────────────────────────────┘
```

## S-Curve Definition & Quality Metrics

### What is an S-Curve?
An **S-curve** in qPCR is a characteristic amplification curve that rises slowly at first (baseline), then rapidly (exponential phase), and finally plateaus (saturation). A good S-curve indicates true amplification and is the foundation for calling a well positive.

### S-curve Quality Criteria

**Original S-curve criteria:**
- The curve must fit a sigmoid model: `sigmoid(cycles, L, k, x0, B)`
- **Fit quality (R²):** Must be >0.9 (if >20 cycles) or >0.85 (if ≤20 cycles)
- **Steepness (k):** Must be >0.05
- **Amplitude (L):** Must be >max(50, rfu_range * 0.3)

**Enhanced S-curve criteria:**
- All original criteria, **plus** additional quality filters:
  - **Amplification start cycle:** Must be after a minimum cycle (e.g., ≥8)
  - **Minimum amplitude:** Must be above a set value (e.g., ≥100)
  - **Plateau significance:** The curve must reach a high enough plateau (e.g., ≥50 RFU)
  - **Signal-to-noise ratio (SNR):** Must be ≥3.0
  - **Exponential growth rate:** Must be ≥5.0
- **Steepness (k) in enhanced version:** Sometimes raised to >0.1 for stricter classification

**If any of these criteria fail, a rejection reason is recorded (e.g., "Poor R² fit", "Insufficient amplitude").**

## Classification Methods

### 1. Rule-Based Classification (Default)
When no trained ML model is available, the system uses threshold-based logic:

**POS Criteria:**
- ✅ Good S-curve fit (`is_good_scurve = true`)
- ✅ Amplitude ≥ 400 RFU
- ✅ No anomalies detected
- ✅ Valid Cq value (not NaN)

**NEG Criteria:**
- ❌ Amplitude < 400 RFU, OR
- ❌ Poor S-curve fit, OR  
- ❌ Invalid Cq value

**REDO Criteria:**
- ⚠️ Everything else (e.g., has anomalies but meets other POS criteria)

### 2. ML Classification (When Trained)
After sufficient expert feedback is provided, the system switches to ML-based classification using 18 numerical features extracted from the amplification curves.

## ML Feature Set (18 Features)

The ML classifier analyzes these curve characteristics:

| Feature Category | Features | Description |
|-----------------|----------|-------------|
| **Curve Quality** | R² Score, RMSE | Goodness of fit metrics |
| **Amplitude Metrics** | Amplitude, SNR (Signal-to-Noise Ratio) | Signal strength indicators |
| **Curve Shape** | Steepness, Midpoint, Baseline | S-curve geometry parameters |
| **Cycle Metrics** | Cq Value, CQJ, CalcJ | Quantification cycle measurements |
| **Raw Data Stats** | Min/Max/Mean/Std RFU, Min/Max Cycles | Statistical properties of raw data |
| **Advanced Metrics** | Dynamic Range, Efficiency, Plateau Level | Derived curve characteristics |

### Visual Feature Representation

```
RFU
 ↑
 │     ┌─── Plateau Level
 │    ╱│
 │   ╱ │ ← Amplitude
 │  ╱  │
 │ ╱   │ ← Steepness
 │╱    │
 └──────────────→ Cycles
   ↑    ↑
Baseline Midpoint (Cq)
```

## User Interface Components

### ML Feedback Interface Location
The ML feedback interface appears **after** the sample details in the modal:

```
┌─────────────────────────────────────┐
│           Modal Chart               │
├─────────────────────────────────────┤
│        Sample Details Grid          │
│  • Well ID: A1                     │
│  • Sample: Patient-001             │
│  • Pathogen: BVAB1 (HEX)          │
│  • Result: POS                     │
│  • R² Score: 0.9856               │
│  • Amplitude: 1250.32             │
│  • etc...                         │
├─────────────────────────────────────┤
│      🤖 ML Curve Classification     │  ← Appears here
│                                     │
│  Current Analysis:                  │
│  Method: Rule-based                 │
│  Prediction: POS                    │
│  Confidence: N/A                    │
│                                     │
│  Expert Feedback:                   │
│  ○ Positive  ○ Negative  ○ Redo     │
│  [Submit Feedback]                  │
└─────────────────────────────────────┘
```

## Training Process

### Phase 1: Data Collection
1. **Expert Review**: Users open sample modals and review automated classifications
2. **Feedback Submission**: When automation is incorrect, experts provide correct classification
3. **Feature Extraction**: System automatically extracts 18 numerical features from curve data
4. **Data Storage**: Training examples are saved to `ml_training_data.json`

### Phase 2: Model Training
Training occurs automatically when sufficient data is available:
- **Minimum Threshold**: 10 training examples required
- **Trigger**: Automatic training after each feedback submission
- **Algorithm**: RandomForestClassifier (scikit-learn)
- **Parameters**: 100 estimators, max_depth=10, random_state=42

### Phase 3: ML Activation
Once a model is trained successfully:
- **Method Display**: Changes from "Rule-based" to "ML"
- **Confidence Scores**: Shows prediction confidence (0-100%)
- **Fallback Protection**: Rule-based classification remains as backup

## Training Data Structure

```json
{
  "version": "1.0",
  "feature_names": [
    "amplitude", "r2_score", "steepness", "snr", "midpoint",
    "baseline", "cq_value", "cqj", "calcj", "rmse",
    "min_rfu", "max_rfu", "mean_rfu", "std_rfu",
    "min_cycle", "max_cycle", "dynamic_range", "efficiency"
  ],
  "training_examples": [
    {
      "features": [1250.32, 0.9856, 0.245, 15.2, 18.5, ...],
      "label": "POS",
      "metadata": {
        "well_id": "A1",
        "sample": "Patient-001",
        "target": "BVAB1",
        "fluorophore": "HEX",
        "timestamp": "2025-01-15T10:30:00Z"
      }
    }
  ]
}
```

## Technical Implementation

### Backend Components
- **`ml_curve_classifier.py`**: Core ML training and prediction logic
- **`threshold_backend.py`**: Handles feature extraction and data persistence
- **`qpcr_analyzer.py`**: Integrates ML predictions into analysis pipeline

### Frontend Components
- **`ml_feedback_interface.js`**: User interface for feedback collection
- **`script.js`**: Modal integration and data handling
- **Result classification logic**: Determines POS/NEG/REDO based on method

## Variable Definitions & Core Metrics

All calculations and classifications are performed **per channel** (i.e., for each fluorophore independently).

### Core Sigmoid Parameters
- **L (Amplitude):** The height of the fitted sigmoid curve, representing the maximum RFU (Relative Fluorescence Units) minus baseline. Example: If baseline is 100 and max RFU is 600, then L ≈ 500.
- **k (Steepness):** The slope of the sigmoid at its inflection point. Must be >0.05 for a good S-curve.
- **x0 (Inflection Point):** The cycle at which the curve rises most steeply.
- **B (Baseline):** The average RFU of the first 5 cycles (background signal).
- **r2_score:** The coefficient of determination for the sigmoid fit. Must be >0.9 (if >20 cycles) or >0.85 (if ≤20 cycles) for a good S-curve.

### Quality Metrics
- **amplitude:** Usually the same as L.
- **plateau_level:** The mean RFU of the last 5 cycles, used to check if the curve plateaus at a high enough value.
- **snr (Signal-to-Noise Ratio):** Ratio of the amplitude to the standard deviation of the baseline. Must be ≥3.0 for a good S-curve.
- **growth_rate:** The maximum slope in the exponential phase. Must be ≥5.0 for a good S-curve.
- **threshold_value:** The calculated threshold for calling amplification, usually set to the inflection point (L/2 + B), but clamped between 10% and 90% of the amplitude above baseline.
- **linear_threshold:** In some cases, a linear threshold may be used (e.g., baseline + N × std), where N is typically 10.0.

### Anomaly Detection
Anomalies are specific curve features or problems that may indicate poor data quality or non-standard amplification. They are detected per well and used in both curve classification and POS/NEG/REDO logic.

- **low_amplitude:** The total RFU change (max-min) is less than 50, or less than 10% of the expected range. Indicates little or no amplification.
- **early_plateau:** The curve plateaus (becomes flat) before the midpoint of the run, suggesting non-specific or failed amplification.
- **unstable_baseline:** The standard deviation of the baseline (cycles 6–10) is >50 or >15% of the RFU range. Indicates noisy or drifting background.
- **negative_amplification:** The RFU decreases during the expected exponential phase, which is not typical for true amplification.
- **negative_rfu_values:** The RFU is negative for a significant portion of the curve, but not consistently (i.e., not just a baseline offset). Indicates possible instrument or sample prep issues.
- **high_noise:** The standard deviation of the difference between consecutive RFU values is >30% of the RFU range. Indicates erratic signal.
- **insufficient_data:** Fewer than 5 cycles or RFU points are present.
- **insufficient_valid_data:** Fewer than 5 valid (non-NaN) cycles or RFU points.

**Note:** Anomalies are stored as a list per well. If the list is empty or only contains 'None', the curve is considered free of anomalies for POS/NEG/REDO logic.

## Curve Classification Logic

### Multi-Class Curve Classification (Backend)
The `curve_classification` logic uses a series of conditionals based on fit quality (R²), steepness, SNR, midpoint, baseline, and amplitude. These are separate from the strict S-curve boolean and POS/NEG/REDO logic.

**Classification logic (in order):**

- **SUSPICIOUS:**
  - If steepness > 0.8 and SNR < 5:
    - `classification = 'SUSPICIOUS'` (reason: "Possible noise spike", always flagged for review)

- **NEGATIVE:**
  - If R² is less than 0.75:
    - `classification = 'NEGATIVE'` (reason: "Poor fit")
  - If SNR is less than 2.0:
    - `classification = 'NEGATIVE'` (reason: "Low signal")

- **STRONG_POSITIVE:**
  - If R² is greater than 0.95 and steepness is greater than 0.4 and SNR is greater than 15.0:
    - `classification = 'STRONG_POSITIVE'` (reason: "Meets all strong positive criteria")

- **POSITIVE:**
  - If R² is greater than 0.85 and steepness is greater than 0.3 and SNR is greater than 8.0:
    - `classification = 'POSITIVE'` (reason: "Meets positive criteria")
  - If steepness is greater than 0.6 and SNR is greater than 3 and R² is greater than 0.80:
    - `classification = 'POSITIVE'` (reason: "Sharp transition")
  - If SNR is greater than 12 and steepness is greater than 0.15 and R² is greater than 0.85:
    - `classification = 'POSITIVE'` (reason: "Strong signal")

- **WEAK_POSITIVE:**
  - If R² is greater than 0.80 and steepness is greater than 0.2 and SNR is greater than 4.0:
    - `classification = 'WEAK_POSITIVE'` (reason: "Meets weak positive criteria")

- **INDETERMINATE:**
  - If R² is greater than 0.75 and steepness is greater than 0.1 and SNR is greater than 2.5:
    - `classification = 'INDETERMINATE'` (reason: "Manual review")

- **NEGATIVE (default):**
  - If none of the above, `classification = 'NEGATIVE'` (reason: "Does not meet criteria")

**SNR Cutoffs Summary:**
- Strong_Positive: 15.0
- Positive: 8.0
- Weak_Positive: 4.0
- Indeterminate: 2.5
- Negative: 2.0

### POS/NEG/REDO Result Logic
**Purpose:** Strict, user-facing result classification for each well.

**Logic (Both Backend & Frontend):**
- **NEG:**
  - `amplitude < 400` **OR**
  - `!is_good_scurve` **OR**
  - `Cq` is not a number
- **POS:**
  - `is_good_scurve` **AND**
  - `amplitude > 500` **AND**
  - `no anomalies`
- **REDO:**
  - All other cases (e.g., amplitude 400–500, or amplitude >500 with anomalies)

## Threshold Calculations

**Backend:**
- **Exponential Phase Threshold:**
  - `exp_phase_threshold = L / 2 + B`
  - Clamped to 10–90% of max RFU:
    ```python
    min_thresh = B + 0.10 * L
    max_thresh = B + 0.90 * L
    threshold_value = min(max(exp_phase_threshold, min_thresh), max_thresh)
    ```
- **Linear Threshold Calculation:**
  - Sometimes, a linear threshold is used for calling amplification:
    ```python
    linear_threshold = baseline + N * baseline_std
    # where N is typically 10.0
    ```
  - This is most often used for visual/manual review or as a fallback if the sigmoid fit fails.
- **User/Channel Thresholds:**
  - Used for visualization and manual overrides (frontend).

**Frontend:**
- User-settable per channel, stored in `window.userSetThresholds`.
- Used for chart overlays and UI controls.

## System States

### State 1: Initial Deployment
```
Method: Rule-based
Status: No training data available
Action: Collect expert feedback
```

### State 2: Training Phase
```
Method: Rule-based
Status: Collecting training data (X/10 examples)
Action: Continue providing feedback
```

### State 3: ML Active
```
Method: ML
Status: Model trained with X examples
Confidence: XX% (for current prediction)
Action: Continue feedback for model improvement
```

## Visual Workflow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Upload    │ →  │   Analyze   │ →  │   Review    │
│ qPCR Data   │    │   Curves    │    │  Results    │
└─────────────┘    └─────────────┘    └─────────────┘
                                             │
                                             ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Improve   │ ← │   Train ML  │ ← │   Provide   │
│   Future    │    │   Model     │    │  Feedback   │
│   Results   │    │             │    │   (Expert)  │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Guidance for Updates

### Adding New Classification Criteria
- **Backend Updates:** Update both `qpcr_analyzer.py` and `curve_classification.py`
- **Frontend Updates:** Modify classification logic in `static/script.js`
- **Documentation:** Update variable definitions and thresholds in this document
- **Testing:** Verify consistency between single-channel and multichannel analysis

### Changing Threshold Values
- **Update Values:** Modify thresholds in both backend Python and frontend JavaScript
- **Document Changes:** Update threshold calculations section
- **Test Impact:** Verify POS/NEG/REDO logic still functions correctly

### Adding New Result Classes
- **Extend Logic:** Update `curve_classification` logic in `curve_classification.py`
- **Update UI:** Modify badge mapping and display logic in frontend
- **ML Integration:** Ensure new classes are supported in ML training pipeline

### ML Model Updates
- **Feature Changes:** Update feature extraction in both backend and frontend
- **Model Retraining:** Clear existing model and retrain with new feature set
- **Version Control:** Update training data format version when making breaking changes

## Code Locations & Key Functions

### Backend Components
- **`qpcr_analyzer.py`**: Main qPCR analysis logic, S-curve fitting, anomaly detection
- **`curve_classification.py`**: Multi-class curve classification (`classify_curve` function)
- **`ml_curve_classifier.py`**: ML training, prediction, and model management
- **`threshold_backend.py`**: Threshold calculations and CQJ/CalcJ processing
- **`app.py`**: Flask routes, API endpoints, session management

### Frontend Components
- **`static/script.js`**: 
  - `classifyResult()` function for POS/NEG/REDO logic
  - `populateResultsTable()` for result display
  - Modal integration and curve visualization
- **`static/ml_feedback_interface.js`**: ML feedback collection and display
- **`static/threshold_strategies.js`**: Threshold calculation strategies
- **`static/cqj_calcj_utils.js`**: CQJ/CalcJ calculation utilities
- **`static/pathogen_library.js`**: Pathogen mapping and configuration

### Key Functions for Classification
```javascript
// Frontend POS/NEG/REDO Classification
function classifyResult(wellData) {
    const amplitude = wellData.amplitude || 0;
    const isGoodSCurve = wellData.is_good_scurve || false;
    const hasAnomalies = /* anomaly parsing logic */;
    const cqValue = wellData.cq_value;
    
    if (amplitude < 400 || !isGoodSCurve || isNaN(Number(cqValue))) {
        return 'NEG';
    } else if (isGoodSCurve && amplitude > 500 && !hasAnomalies) {
        return 'POS';
    } else {
        return 'REDO';
    }
}
```

```python
# Backend Multi-class Classification
def classify_curve(r2_score, steepness, snr, midpoint, baseline, amplitude):
    # SUSPICIOUS criteria
    if steepness > 0.8 and snr < 5:
        return 'SUSPICIOUS', "Possible noise spike"
    
    # NEGATIVE criteria
    if r2_score < 0.75:
        return 'NEGATIVE', "Poor fit"
    if snr < 2.0:
        return 'NEGATIVE', "Low signal"
    
    # STRONG_POSITIVE criteria
    if r2_score > 0.95 and steepness > 0.4 and snr > 15.0:
        return 'STRONG_POSITIVE', "Meets all strong positive criteria"
    
    # ... additional classification logic
```

### Database Schema
```sql
-- ML Training Data
CREATE TABLE ml_training_data (
    id INTEGER PRIMARY KEY,
    features TEXT,  -- JSON array of 18 features
    label TEXT,     -- Expert classification (POS/NEG/REDO)
    metadata TEXT,  -- Well information (JSON)
    created_at TIMESTAMP
);

-- Analysis Sessions
CREATE TABLE analysis_sessions (
    id INTEGER PRIMARY KEY,
    session_data TEXT,  -- Complete analysis results (JSON)
    filename TEXT,
    created_at TIMESTAMP
);
```

---

**This document is a living reference for qPCR curve classification and ML implementation. Please update when making changes to classification logic, thresholds, or ML features.**
│ Predictions │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Benefits of ML Classification

### Accuracy Improvements
- **Learning from Experts**: Captures nuanced decision-making patterns
- **Complex Pattern Recognition**: Identifies subtle curve characteristics
- **Reduced Subjectivity**: Consistent application of learned patterns

### Operational Benefits  
- **Faster Review**: Automatic classification of routine cases
- **Quality Assurance**: Confidence scores highlight uncertain cases
- **Continuous Improvement**: Model accuracy increases with more feedback

### Laboratory Efficiency
- **Reduced Manual Review**: Focus expert time on borderline cases
- **Standardization**: Consistent classification across different technicians
- **Audit Trail**: Complete history of training decisions and model evolution

## Best Practices

### For Training Data Quality
1. **Diverse Examples**: Include various curve types and quality levels
2. **Expert Consensus**: Have experienced technicians provide feedback
3. **Regular Updates**: Continuously provide feedback to improve the model
4. **Balance Classes**: Ensure good representation of POS/NEG/REDO examples

### For Operational Use
1. **Monitor Confidence**: Review low-confidence predictions manually
2. **Validate Predictions**: Spot-check ML classifications regularly
3. **Update Training**: Add feedback for any incorrect ML predictions
4. **Backup Planning**: Always maintain rule-based classification as fallback

## Troubleshooting

### Common Issues

**"Method: Rule-based" persists after feedback:**
- Check that at least 10 training examples are collected
- Verify feedback is being saved to `ml_training_data.json`
- Ensure no training errors in backend logs

**Low prediction confidence:**
- Model needs more diverse training examples
- Current sample may be edge case requiring expert review
- Consider adding similar examples to training set

**Inconsistent predictions:**
- Model may be overfitting to limited training data
- Add more balanced examples across all classification types
- Review feature extraction for data quality issues

## Data Analysis Features

### Training Progress Monitoring
The system provides visibility into ML training progress:
- Number of training examples collected
- Distribution across POS/NEG/REDO classes  
- Model performance metrics
- Feature importance rankings

### Performance Metrics
When a model is active, the system tracks:
- Classification accuracy on new cases
- Confidence score distributions
- Expert agreement rates
- False positive/negative rates

## Security and Data Handling

### Data Privacy
- Training data stored locally only
- No external transmission of sample data
- Anonymizable metadata structure
- User-controlled data retention

### Model Persistence
- Training data saved in JSON format
- Model files saved using joblib serialization
- Automatic backup before model updates
- Version control for training iterations

---

## Quick Start Guide

### For New Users:
1. Upload qPCR data and run analysis
2. Review results in modal interface
3. When you disagree with classification, use ML feedback interface
4. Submit 10+ expert feedback examples
5. System automatically trains ML model
6. Future analyses use ML predictions with confidence scores

### For Advanced Users:
- Monitor `ml_training_data.json` for training progress
- Review model confidence scores for quality assurance
- Use feedback interface to continuously improve model accuracy
- Export training data for external analysis if needed

This documentation provides a complete overview of the ML curve classification system, from basic usage to advanced technical details. The system is designed to learn from expert knowledge and continuously improve qPCR analysis accuracy while maintaining transparency and user control.
