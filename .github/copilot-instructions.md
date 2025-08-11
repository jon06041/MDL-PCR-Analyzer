# MDL PCR Analyzer - AI Coding Agent Instructions

## 🚨 CRITICAL ALERT: NO SQLITE ALLOWED 🚨

**SQLITE IS COMPLETELY DEPRECATED AND FORBIDDEN IN THIS PROJECT**

❌ **NEVER use SQLite in any form:**
- No `import sqlite3` statements
- No `sqlite3.connect()` calls  
- No `.db` file references
- No SQLite syntax in any new code

✅ **ALWAYS use MySQL exclusively:**
- All database operations must use MySQL
- Use `pymysql` or `mysql.connector` for connections
- Legacy SQLite files archived in `legacy_sqlite_files/`

**Why this matters:** SQLite was causing recurring database connectivity issues, missing ML requirements, and frontend failures. The system has been completely migrated to MySQL for reliability and performance.

## 🔍 CRITICAL ISSUE ANALYSIS (2025-08-09)

### **ML Validation Dashboard Root Cause Analysis**

**ISSUE**: Dashboard shows "Loading pending runs..." indefinitely despite API returning correct data.

**ROOT CAUSES IDENTIFIED**:

1. **Frontend JavaScript Error**: Dashboard API works (returns 2 pending runs) but JavaScript fails to process response
   - **Location**: `ml_validation_enhanced_dashboard.html` lines 240-270
   - **Fix needed**: Add console.log debugging to `loadDashboardData()` function
   - **Status**: API endpoints fixed, frontend processing broken

2. **Pending Run Creation Logic**: Only edge cases create pending runs (by design)
   - **Location**: `app.py` line 1091 - `if ml_samples_analyzed > 0:`
   - **Current behavior**: Only files with `edge_case: true` or ML predictions get tracked
   - **Design decision needed**: Track ALL files vs only edge cases
   - **Database proof**: 2 pending runs exist, API returns them correctly

3. **Slow Run Creation**: Most files with good curves don't create pending runs
   - **Root cause**: `ml_samples_analyzed` only increments for edge cases
   - **Location**: `app.py` lines 1067-1083
   - **Options**: Lower edge case thresholds OR track all analysis runs

**IMMEDIATE FIXES REQUIRED**:
```javascript
// CRITICAL DISCOVERY: JavaScript completely broken due to missing element
// Root cause: logRunForm element doesn't exist, crashes entire script
// Status: Attempted fix failed, need complete rebuild
```

```python
# Fix 2: Track all files (if desired) in app.py line 1091
# Change from: if ml_samples_analyzed > 0:
# To: if True:  # Track all analysis runs
```

**DASHBOARD REBUILD REQUIRED (2025-08-09)**:
- ✅ API confirmed working (test page shows 2 pending runs)
- ✅ Database confirmed working (data exists and accessible)
- ❌ Main dashboard JavaScript completely broken
- ❌ Missing HTML elements causing script crashes
- 🔧 **SOLUTION**: Rebuild dashboard using working test page as template

**NEXT SESSION ACTION**: Copy working JavaScript from test_dashboard_simple.html to ml_validation_enhanced_dashboard.html

**VERIFICATION**: Database contains 2 pending runs, API returns them, frontend rebuild needed.

## 🧹 DUPLICATE PREVENTION & CLEANUP SYSTEM (2025-08-11)

### **Critical Duplicate Issues Fixed**

**DUPLICATE ML ANALYSIS RUNS**:
- **Problem**: Same base file creates multiple pending runs for each fluorophore channel (FAM, HEX, Texas Red, Cy5)
- **Example**: `AcBVPanelPCR3_2576724_CFX366953` had 4 duplicate sessions (225-229)
- **Root Cause**: ML analysis system creates separate runs per channel instead of consolidating per base file
- **Solution**: Use `fix_comprehensive_duplicates_v2.py` for cleanup and prevention

**COMPLIANCE EVIDENCE COUNT MISMATCHES**:
- **Problem**: Dashboard shows "Evidence Found (20)" but database has only 4 records
- **Root Cause**: API vs database count discrepancies, regulation number mismatches between modal and container
- **Solution**: Comprehensive validation and cleanup script with dry-run capability

### **Duplicate Prevention Tools**

**Main Cleanup Script**: `fix_comprehensive_duplicates_v2.py`
```bash
# Dry run to see what would be fixed
python3 fix_comprehensive_duplicates_v2.py --dry-run

# Actually fix the duplicates
python3 fix_comprehensive_duplicates_v2.py

# Fix only ML duplicates
python3 fix_comprehensive_duplicates_v2.py --ml-only

# Fix only compliance evidence
python3 fix_comprehensive_duplicates_v2.py --compliance-only
```

**Prevention Module**: `duplicate_prevention.py`
- Validates base filenames before creating ML runs
- Prevents multiple pending runs for same file
- Provides deduplication utilities for compliance evidence
- Use `from duplicate_prevention import validate_unique_ml_run` in new code

**Critical Pattern - Always Check Before Creating ML Runs**:
```python
from duplicate_prevention import validate_unique_ml_run

# Before creating ML analysis run
base_filename = filename.split(' - ')[0]  # Remove channel suffix
if not validate_unique_ml_run(base_filename):
    print(f"Skipping duplicate ML run for {base_filename}")
    return
    
# Proceed with ML run creation...
```

**Database Maintenance Commands**:
```bash
# Quick duplicate check
python3 -c "from duplicate_prevention import quick_duplicate_check; quick_duplicate_check()"

# Cross-environment cleanup (when switching computers/databases)
python3 fix_comprehensive_duplicates_v2.py --cross-env
```

## Architecture Overview

This is a **Flask-based qPCR analysis system** with machine learning capabilities for curve classification and FDA compliance tracking. The system has been **completely migrated from SQLite to MySQL**.

### Core Components
- **Flask API** (`app.py`) - Main application with 4400+ lines handling analysis, ML, and compliance
- **MySQL Database** - Primary data store (**SQLite completely removed**)
- **ML Classification** (`ml_curve_classifier.py`) - Weighted scoring system for curve analysis
- **Compliance Dashboard** (`unified_compliance_dashboard.html`) - Single dashboard for all validation workflows
- **Threshold Management** (`static/threshold_frontend.js`) - Advanced threshold calculation with loading guards

## Critical Development Patterns

### Database Layer - MYSQL ONLY
**ALWAYS use MySQL**, SQLite is forbidden. Connection pattern:
```python
# Use this pattern for ALL database connections
mysql_config = {
    'host': os.environ.get('MYSQL_HOST', 'localhost'),
    'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
    'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
    'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis')
}
```

**Key MySQL Tables**:
- `ml_prediction_tracking` - ML model predictions and confidence scores
- `ml_expert_decisions` - Expert feedback with `improvement_score` column
- `unified_compliance_requirements` - FDA compliance tracking
- `ml_model_versions` - ML model versioning and performance

### ML Classification System
**Uses weighted scoring, NOT hard cutoffs**. Critical pattern in `curve_classification.py`:
```python
# WRONG: Hard cutoffs
if snr < 3.0: return "NEGATIVE"

# CORRECT: Weighted scoring
scores = {'positive_evidence': 0.0, 'negative_evidence': 0.0}
# Consider ~30 criteria with weights
```

**Edge Case Detection for Targeted ML**:
- Classification function returns `edge_case: true` for borderline samples
- Frontend highlights edge cases with subtle visual indicators
- ML analysis triggered ONLY for edge cases, not all samples
- Reduces computational overhead while focusing on uncertain classifications

### CQJ vs Cq Value Data Flow (CRITICAL)
**Distinguish between imported Cq and calculated CQJ**:
- `cq_value` = imported Cq from original data
- `CQJ` = calculated Cq at specific threshold (currently same number, but may differ)
- Classification function expects CQJ, not imported cq_value

**CRITICAL CSV Cq Import Rules**:
- **NEVER import CSV Cq values for negative samples** - they often contain invalid placeholder values
- Only import CSV Cq for confirmed positive classifications (POSITIVE, STRONG_POSITIVE, WEAK_POSITIVE)
- CSV often contains invalid Cq values like 13.06 for negative samples that must be rejected
- Strict validation: only accept Cq values in range 10.0-40.0 for positive samples

```python
# CORRECT sequencing in qpcr_analyzer.py
# 1. Calculate CQJ BEFORE classification
cqj_val = py_cqj(well_for_cqj, threshold)
analysis['cqj'] = {channel_name: cqj_val}

# 2. Pass CQJ to classification, not imported cq_value
cqj_for_channel = analysis['cqj'].get(channel_name)
classify_curve(..., cq_value=cqj_for_channel)  # cq_value param gets CQJ!

# 3. In sql_integration.py: NEVER import CSV Cq for negative samples
if classification in ['POSITIVE', 'STRONG_POSITIVE', 'WEAK_POSITIVE'] and 10.0 <= csv_cq <= 40.0:
    well_result['cq_value'] = csv_cq  # Only for confirmed positives
else:
    well_result['cq_value'] = None    # Force None for negatives
```

### Frontend Loading Guards
**Threshold frontend requires loading state management** to prevent infinite loops:
```javascript
// ALWAYS check loading state before operations
if (window.appState?.uiState?.isThresholdLoading) return;

// Set loading flag
window.appState.uiState.isThresholdLoading = true;
try {
    // Your operation
} finally {
    window.appState.uiState.isThresholdLoading = false;
}
```

### Edge Case Detection & ML Batch Analysis
**New workflow for targeted ML analysis**:
- **Frontend Edge Case Highlighting**: Light visual highlight on curve classification badges for edge cases
- **Edge Case Identification**: Use `edge_case: true` flag from classification results to mark borderline samples
- **Targeted ML Analysis**: Run ML batch analysis ONLY on identified edge cases, not all samples
- **Edge Case UI Pattern**: Subtle styling (light background, border, or icon) to make edge cases easily identifiable
- **Batch Processing**: Count visible edge cases, then trigger ML analysis specifically for those samples

```javascript
// Frontend edge case detection pattern
if (result.curve_classification.edge_case === true) {
    // Apply light highlight styling
    curveClassBadgeHTML += ' edge-case-highlight';
}

// ML batch analysis trigger for edge cases only
const edgeCases = getVisibleEdgeCases();
if (edgeCases.length > 0) {
    triggerMLBatchAnalysis(edgeCases);
}
```

## Essential Development Commands

### Database Operations
```bash
# Initialize missing MySQL tables
python3 initialize_mysql_tables.py

# Fix ML table schema issues
python3 fix_ml_expert_decisions.py

# Check database migration status
python3 sqlite_to_mysql_scanner.py
```

### Application Development
```bash
# Start application (development)
python3 app.py  # Runs on localhost:5000

# Test ML classification
python3 test_realistic_ml_learning.py

# Database backups (automatic)
python3 backup_scheduler.py
```

### Key File Locations
- **Main app**: `app.py` (4400+ lines, all API endpoints)
- **ML training**: `ml_curve_classifier.py` (weighted classification)
- **Frontend charts**: `static/threshold_frontend.js` (with loading guards)
- **Compliance**: `unified_compliance_dashboard.html` (single dashboard)
- **Config**: `config/concentration_controls.json` (pathogen-specific settings)

## Integration Points

### Flask → ML Classification
```python
# Calls weighted classification system
result = classify_curve_with_ml(r2, steepness, snr, midpoint)
# Returns: NEGATIVE, WEAK_POSITIVE, POSITIVE, STRONG_POSITIVE
```

### Dashboard → API Communication
```javascript
// Unified compliance dashboard loads data from multiple endpoints
await fetch('/api/unified-compliance/summary')
await fetch('/api/ml-validation-dashboard')
await fetch('/api/ml-runs/statistics')
```

### MySQL → Chart Display
Data flows: `MySQL tables` → `Flask API` → `Chart.js visualization` → `User interaction` → `Threshold updates` → `MySQL storage`

## Common Issues & Solutions

### Database Connection Errors
- **Problem**: Mixed SQLite/MySQL references
- **Solution**: Use `initialize_mysql_tables.py` and remove all SQLite imports
- **Frontend Error**: "Database connectivity not initialized - missing requirements"
- **Root Cause**: MySQL tables not created or SQLite code still in use
- **Fix**: Run `python3 initialize_mysql_tables.py` and check for SQLite imports

### ML Config & Feedback Modal Issues  
- **Problem**: ML config page loads but shows no data, feedback modal fails
- **Frontend Message**: "⚠️ Database connectivity required for ML features"
- **Root Cause**: Missing MySQL tables (`ml_prediction_tracking`, `ml_expert_decisions`, etc.)
- **Solution**: Initialize MySQL tables and ensure no SQLite references in active files
- **Critical Files**: `ml_config_manager.py`, `sql_integration.py`, `ml_validation_tracker.py`

### ML Classification Issues
- **Problem**: Hard cutoff rejecting good curves
- **Solution**: Use weighted classification in `curve_classification.py`

### CQJ Classification Problems
- **Problem**: "Good curve without CQJ crossing" error for perfect positives
- **Root Cause**: CQJ dict `{'channel': cqj_val}` empty or CQJ retrieval failing
- **Debug**: Check `analysis['cqj']` storage and `cqj_for_channel` retrieval
- **Solution**: Ensure CQJ calculated before classification and channel names match

### Invalid CSV Cq Import for Negative Samples
- **Problem**: Negative samples showing invalid Cq values (e.g., 13.06) instead of N/A
- **Root Cause**: CSV contains placeholder Cq values for negative samples that get imported
- **Debug**: Check classification result vs CSV Cq value - negatives should have cq_value=None
- **Solution**: Only import CSV Cq for confirmed positive classifications, reject all others

### S-Curve Detection Too Strict
- **Problem**: Excellent curves (R² 0.99+, steepness 0.18+) showing "Poor S-Curve" in visual analysis
- **Root Cause**: Steepness thresholds too strict (k > 0.05 original, k > 0.1 high confidence)
- **Debug**: Check backend is_good_scurve flag vs actual steepness values
- **Solution**: Lowered steepness criteria: original k > 0.02, high confidence k > 0.05, ML potential k > 0.05

### Frontend Freezing
- **Problem**: Infinite loops in threshold updates
- **Solution**: Implement loading guards and recursion prevention

### Missing Compliance Data
- **Problem**: Empty evidence tracking
- **Solution**: Check `unified_compliance_requirements` table population

## Current Remaining Issues (2025-08-08)

### MySQL Compliance Manager Missing Method
- **Problem**: `'MySQLUnifiedComplianceManager' object has no attribute 'track_compliance_event'`
- **Status**: ✅ FIXED - Added track_compliance_event method as alias to log_compliance_event
- **Impact**: Compliance tracking now working properly
- **Root Cause**: Missing method implementation in mysql_unified_compliance_manager.py
- **Solution**: ✅ Added track_compliance_event method to MySQLUnifiedComplianceManager class

### Edge Case Integration Status
- **Fixed**: triggerMLBatchAnalysisForEdgeCases() function added to index.html
- **Fixed**: SUSPICIOUS curves marked as edge cases
- **Fixed**: Progress bar modal implemented
- **Remaining**: Need to verify pending runs creation for edge cases
- **Remaining**: Need to test full edge case → ML analysis workflow

### ML Statistics Fixed
- **Fixed**: No more hardcoded values (was showing "6 6" training samples)
- **Fixed**: Real data now shows: 19 training samples, 5 classes, model v1.12
- **Fixed**: ML feedback 500 error resolved (database schema column mismatch)

### Feedback Submission
- **Fixed**: Database schema issue (features_used vs features column)
- **Status**: Should be working but needs testing with real submissions

## Project-Specific Conventions

1. **Pathogen Codes**: Use uppercase (BVAB1, CTRACH, NGON) consistently
2. **Fluorophore Order**: Always FAM, HEX, Texas Red, Cy5
3. **Classification Hierarchy**: STRONG_POSITIVE > POSITIVE > WEAK_POSITIVE > NEGATIVE
4. **Threshold Storage**: Use `window.stableChannelThresholds` for persistence
5. **Database Naming**: All MySQL tables use snake_case with descriptive prefixes

## Authentication Setup (Future)
```python
# Entra ID integration ready
CLIENT_ID = "6345cabe-25c6-4f2d-a81f-dbc6f392f234"
CLIENT_SECRET = "aaee4e07-3143-4df5-a1f9-7c306a227677"
TENANT_ID = "5d79b88b-9063-46f3-92a6-41f3807a3d60"
```
