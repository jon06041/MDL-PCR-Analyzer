# MDL PCR Analyzer - AI Coding Agent Instructions

## Architecture Overview

This is a **Flask-based qPCR analysis system** with machine learning capabilities for curve classification and FDA compliance tracking. The system recently migrated from SQLite to MySQL.

### Core Components
- **Flask API** (`app.py`) - Main application with 4400+ lines handling analysis, ML, and compliance
- **MySQL Database** - Primary data store (recently migrated from SQLite)
- **ML Classification** (`ml_curve_classifier.py`) - Weighted scoring system for curve analysis
- **Compliance Dashboard** (`unified_compliance_dashboard.html`) - Single dashboard for all validation workflows
- **Threshold Management** (`static/threshold_frontend.js`) - Advanced threshold calculation with loading guards

## Critical Development Patterns

### Database Layer
**ALWAYS use MySQL**, never SQLite. Connection pattern:
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

### ML Classification Issues
- **Problem**: Hard cutoff rejecting good curves
- **Solution**: Use weighted classification in `curve_classification.py`

### Frontend Freezing
- **Problem**: Infinite loops in threshold updates
- **Solution**: Implement loading guards and recursion prevention

### Missing Compliance Data
- **Problem**: Empty evidence tracking
- **Solution**: Check `unified_compliance_requirements` table population

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
