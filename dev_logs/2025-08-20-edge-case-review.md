# Edge Case Review Log — 2025-08-20

Purpose: Track a sample that should have been flagged as an edge-case REDO for follow-up analysis across machines.

## Case 1: P1 — Suspected Edge Case (REDO)
- Well ID: P1
- Sample: 13801162-1-2539786
- Pathogen: Mycoplasma genitalium (FAM)
- Result (current): NEG
- R² Score: 0.2584
- RMSE: 377.33
- Amplitude: 1138.75
- Steepness: 0.274
- Midpoint: 3.81
- Baseline: -1038.14
- Cq Value: 23.03
- CQJ: N/A
- CalcJ: N/A

Notes
- Low R² combined with large RMSE and high amplitude suggests atypical curve behavior; consider edge-case REDO.
- Log retained to reproduce, validate detection heuristics, and iterate on thresholds/ML signals.

Next steps (dev)
- Re-run edge-case heuristic on this well in isolation; capture decision trace.
- Verify threshold strategy and CQJ omission path.
- If warranted, add/adjust heuristic weights for REDO classification boundaries.
