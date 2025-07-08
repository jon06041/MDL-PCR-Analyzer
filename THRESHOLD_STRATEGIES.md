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

## 3. [Add new strategies here]
- **Description:**
- **Reference:**
- **Formula:**

---

**How to add a new strategy:**
1. Implement the function in `static/threshold_strategies.js`.
2. Add a section here with a description, reference, and formula.
3. Communicate with the team if the new strategy should become a default or be available in the UI.

---

**This document is a living reference.**
