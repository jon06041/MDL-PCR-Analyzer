# Threshold Strategies for qPCR Analysis

This document lists and describes all scientific thresholding strategies available in the codebase. Update this file when new strategies are added to `static/threshold_strategies.js`.

---

## 1. Exponential Phase (L/2 + B, clamped)
- **Description:** Sets the threshold at the midpoint of the fitted sigmoid (L/2 + B), clamped to 10–90% of amplitude above baseline.
- **Reference:** Standard in many qPCR analysis pipelines.
- **Formula:**
  - `threshold = min(max(L/2 + B, B + 0.10*L), B + 0.90*L)`

## 2. Linear (Baseline + N × baseline_std)
- **Description:** Sets the threshold at baseline plus N times the baseline standard deviation. Used for manual review or as a fallback.
- **Reference:** Common in early qPCR software and for visual/manual review.
- **Formula:**
  - `threshold = baseline + N × baseline_std` (N typically 10)

## 3. Manual Threshold
- **Description:** User-defined fixed threshold value entered manually or adjusted via UI controls.
- **Reference:** Allows for expert override and custom threshold values.
- **Formula:**
  - `threshold = user_defined_value`

---

## Threshold Change Behavior (Expected)

When thresholds are changed (either through strategy change or manual adjustment), the following behavior is expected:

### CQJ (Threshold Crossing) Values
- **Should Change:** CQJ values represent the cycle number where the amplification curve crosses the threshold
- **Calculation:** Linear interpolation between data points where crossing occurs
- **Impact:** All wells (samples and controls) will have recalculated CQJ values based on new threshold

### CalcJ (Concentration) Values

#### Controls (H, M, L)
- **Should Remain Constant:** Control wells get FIXED CalcJ values from centralized config (`config/concentration_controls.json`)
  - Values vary by test/channel (e.g., Cglab FAM: H=1e7, M=1e5, L=1e3)
  - Loaded via `config_loader.py` (backend) and `config_manager.js` (frontend)
- **Logic:** Controls represent known concentrations and should not change when threshold changes
- **Implementation:** Both frontend and backend assign fixed values to detected control wells before any calculation

#### Sample Wells
- **Should Change:** Sample CalcJ values are calculated using the standard curve from H/M/L control CQJ averages
- **Calculation:** Log-linear interpolation based on sample CQJ vs control CQJ averages
- **Impact:** As control CQJ values change, the standard curve slope/intercept changes, affecting sample concentrations

### Troubleshooting Threshold Issues

If controls are not maintaining constant CalcJ values:

1. **Check Control Detection:** Use browser console to see `[CONTROL-DETECT]` log messages
2. **Verify Control Patterns:** Ensure control wells have detectable naming (H-, M-, L-, NTC patterns)
3. **Check CONCENTRATION_CONTROLS:** Verify test code and channel mapping exists
4. **Debug Function:** Use `window.debugCalcJMath(wellKey)` to trace calculation logic

### Centralized Configuration Management

⚠️ **IMPORTANT**: Concentration control values are now managed centrally to avoid maintenance issues.

#### Single Source of Truth
- **Primary Config**: `config/concentration_controls.json` - Edit this file to change control values
- **Frontend**: `static/concentration_controls.js` - Loads from centralized config  
- **Backend**: `cqj_calcj_utils.py` - Imports from `config_loader.py`

#### Updating Control Values

**Option 1: Direct JSON Editing**
```bash
# Edit the centralized config file
vim config/concentration_controls.json
```

**Option 2: Management Script**
```bash
# List current controls
python manage_config.py list-controls

# Update a specific control value
python manage_config.py update-control Cglab FAM H 2e7

# Add a new test
python manage_config.py add-test NewTest FAM H=1e7,M=1e5,L=1e3
```

#### Files That Reference Control Values
- `config/concentration_controls.json` - **PRIMARY SOURCE** 
- `static/concentration_controls.js` - Loads from JSON config
- `static/config_manager.js` - Handles loading logic
- `config_loader.py` - Python config loader
- `cqj_calcj_utils.py` - Uses config loader
- Documentation files (auto-updated)

---

**How to add a new strategy:**
1. Implement the function in `static/threshold_strategies.js`.
2. Add a section here with a description, reference, and formula.
3. Communicate with the team if the new strategy should become a default or be available in the UI.

---

**This document is a living reference.**
