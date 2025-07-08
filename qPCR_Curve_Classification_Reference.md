# qPCR Curve Classification: Unified Logic and Criteria Reference

**Last updated:** July 8, 2025

---

## Table of Contents
1. Overview
2. `is_good_scurve` (Strict S-curve Boolean)
3. `curve_classification` (Descriptive Multi-class Label)
4. POS/NEG/REDO Result Logic
5. Threshold Calculations
6. Variable Definitions
7. Guidance for Updates
8. Code Locations

---

## 1. Overview
This document unifies and documents all logic, variable definitions, and equations for qPCR curve classification, including:
- `is_good_scurve` (strict S-curve boolean)
- `curve_classification` (multi-class label)
- POS/NEG/REDO result logic
- Threshold calculations
- All relevant variable definitions

Criteria and logic are extracted from both backend (Python) and frontend (JavaScript) code. This document is intended as a living reference for future updates.

---


## 2. S-Curve Definition (Plain English)

An **S-curve** in qPCR is a characteristic amplification curve that rises slowly at first (baseline), then rapidly (exponential phase), and finally plateaus (saturation). A good S-curve indicates true amplification and is the foundation for calling a well positive.

### S-curve Quality Metrics (Original and Enhanced)

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

**Summary:**
- The **original S-curve** is a basic check for a good sigmoid fit, sufficient steepness, and amplitude.
- The **enhanced S-curve** adds stricter requirements for noise, growth, and timing, making it more robust against artifacts and borderline cases.

**If any of these criteria fail, a rejection reason is recorded (e.g., "Poor R² fit", "Insufficient amplitude").**

**Frontend (JavaScript, `static/script.js`):**
- The `is_good_scurve` property is set per well and used for UI badges, filtering, and as a key input to POS/NEG/REDO logic.

---

---

## 3. `curve_classification` (Descriptive Multi-class Label)

**Purpose:**
Provides a detailed, multi-class label for each curve, e.g., STRONG_POSITIVE, WEAK_POSITIVE, NEGATIVE, INDETERMINATE, SUSPICIOUS.

**Backend:**
- Set in `qpcr_analyzer.py`:
  - If error: `{ classification: 'No Data', reason: ... }`
  - Else:
    ```python
    analysis['curve_classification'] = classify_curve(
        r2_score, steepness, snr, midpoint, baseline, amplitude
    )
    ```
  - The `classify_curve` function (in `curve_classification.py`) determines the class and reason.

**Frontend:**
- Rendered as a badge in the UI.
- Used for display and advanced filtering.

---

## 4. POS/NEG/REDO Result Logic

**Purpose:**
Strict, user-facing result classification for each well.

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

**Frontend Implementation:**
```js
function classifyResult(wellData) {
    const amplitude = wellData.amplitude || 0;
    const isGoodSCurve = wellData.is_good_scurve || false;
    let hasAnomalies = ...; // parsed from wellData.anomalies
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

---

## 5. Threshold Calculations


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

---


## 6. Variable Definitions (with Values and Plain English)

All calculations and classifications are performed **per channel** (i.e., for each fluorophore independently).

### Core Variables
- **L (Amplitude):** The height of the fitted sigmoid curve, representing the maximum RFU (Relative Fluorescence Units) minus baseline. Example: If baseline is 100 and max RFU is 600, then L ≈ 500.
- **k (Steepness):** The slope of the sigmoid at its inflection point. Must be >0.05 for a good S-curve.
- **x0 (Inflection Point):** The cycle at which the curve rises most steeply.
- **B (Baseline):** The average RFU of the first 5 cycles (background signal).
- **r2_score:** The coefficient of determination for the sigmoid fit. Must be >0.9 (if >20 cycles) or >0.85 (if ≤20 cycles) for a good S-curve.
- **amplitude:** Usually the same as L.
- **plateau_level:** The mean RFU of the last 5 cycles, used to check if the curve plateaus at a high enough value.
- **snr (Signal-to-Noise Ratio):** Ratio of the amplitude to the standard deviation of the baseline. Must be ≥3.0 for a good S-curve.
- **growth_rate:** The maximum slope in the exponential phase. Must be ≥5.0 for a good S-curve.
- **threshold_value:** The calculated threshold for calling amplification, usually set to the inflection point (L/2 + B), but clamped between 10% and 90% of the amplitude above baseline.
- **linear_threshold:** In some cases, a linear threshold may be used (e.g., baseline + N × std), where N is typically 10.0.

### Anomalies (Plain English Definitions)
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

---

---



## 7. Curve Classification Conditionals (Detailed, as implemented in `curve_classification.py`)

The `curve_classification` logic (backend, in `classify_curve`) uses a series of conditionals based on fit quality (R²), steepness, SNR, midpoint, baseline, and amplitude. These are separate from the strict S-curve boolean and POS/NEG/REDO logic.

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

**Additional notes:**
- If the midpoint is outside the range 10 to 45, a confidence penalty of 0.5 is applied.
- If the baseline is high relative to amplitude (baseline divided by amplitude is greater than 0.3), the result is flagged for review.
- Each classification includes a `reason`, a `confidence_penalty` (if any), and a `flag_for_review` boolean.

**SNR Cutoffs:**
  - Strong_Positive: 15.0
  - Positive: 8.0
  - Weak_Positive: 4.0
  - Indeterminate: 2.0
  - Negative: 2.0

See `curve_classification.py` for the exact logic and thresholds.

---

## 8. Guidance for Updates
- **Add new criteria:**
  - Update both backend and frontend logic, and document new variables and thresholds here.
- **Change thresholds:**
  - Update values in both codebases and this document.
- **Add new result classes:**
  - Extend `curve_classification` logic and update UI badge mapping.

---

---


## 9. Code Locations
- Backend: `qpcr_analyzer.py` (main logic), `curve_classification.py` (classify_curve)
- Frontend: `static/script.js` (classification, UI), `window.classifyResult`, result rendering

---

**This document is a living reference. Please update as requirements or code change.**

---

**This document is a living reference. Please update as requirements or code change.**
