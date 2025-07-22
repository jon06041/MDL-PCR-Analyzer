# ML Configuration Management System

## Overview

The ML Configuration Management System provides comprehensive control over machine learning settings in the qPCR Analyzer. It allows pathogen-specific ML toggling, safe training data management, and full audit logging for all sensitive operations.

## Features

### 🎯 Pathogen-Specific ML Control
- **Enable/Disable ML per pathogen/fluorophore combination**
- **Preserves all training data when disabled**
- **Instant toggle without data loss**
- **Granular control for each pathogen type**

### ⚠️ Safe Training Data Management
- **Complete reset functionality with automatic backup**
- **Multi-step confirmation for dangerous operations**
- **Granular reset options (specific pathogen vs. all data)**
- **Backup file creation with timestamp**

### 🔒 Security & Auditing
- **Comprehensive audit logging for all changes**
- **User tracking and IP logging**
- **Multi-step confirmation for destructive operations**
- **Ready for future role-based access control**

### 📊 System Configuration
- **Global ML enable/disable toggle**
- **Configurable minimum training thresholds**
- **System-wide settings management**
- **Performance monitoring hooks**

## Files Structure

```
ml_config_schema.sql          # Database schema for ML configuration
ml_config_manager.py          # Backend Python class for config management
static/ml_config_manager.js   # Frontend JavaScript interface
static/ml_config_styles.css   # Styling for the configuration interface
static/ml_config_integration.js # Integration helpers for main app
ml_config.html               # Admin interface for ML configuration
```

## Database Schema

### Tables Created
- **ml_pathogen_config**: Pathogen-specific ML settings
- **ml_system_config**: Global system configuration
- **ml_audit_log**: Complete audit trail

### Initialization
```bash
sqlite3 qpcr_analysis.db < ml_config_schema.sql
```

## API Endpoints

### Pathogen Configuration
```http
GET    /api/ml-config/pathogen                    # Get all pathogen configs
PUT    /api/ml-config/pathogen/{code}/{fluoro}    # Toggle ML for specific pathogen
GET    /api/ml-config/check-enabled/{code}/{fluoro} # Quick ML status check
```

### System Configuration
```http
GET    /api/ml-config/system                      # Get system config
PUT    /api/ml-config/system/{key}                # Update system setting
```

### Training Data Management
```http
POST   /api/ml-config/reset-training-data         # Reset training data (DANGEROUS)
```

### Audit & Monitoring
```http
GET    /api/ml-config/audit-log                   # Get audit log entries
```

## Usage Examples

### Basic ML Status Check
```javascript
// Check if ML is enabled for a specific pathogen
const enabled = await checkMLEnabledForPathogen('BVAB', 'FAM');
if (enabled) {
    // Proceed with ML classification
    performMLClassification(wellData);
} else {
    // Use traditional analysis
    performTraditionalAnalysis(wellData);
}
```

### Toggle ML for Pathogen
```bash
curl -X PUT http://localhost:5000/api/ml-config/pathogen/BVAB/FAM \
  -H "Content-Type: application/json" \
  -H "X-User-ID: admin_user" \
  -d '{"enabled": false, "notes": "Temporarily disabled for testing"}'
```

### Reset Training Data (with safety)
```javascript
// This requires multiple confirmations and creates backups
await mlConfigManager.resetTrainingData('BVAB', 'FAM', 'Retraining due to bad data');
```

### Check Audit Log
```bash
curl -X GET http://localhost:5000/api/ml-config/audit-log?limit=10
```

## Integration with Main Application

### 1. Include the integration helper
```html
<script src="/static/ml_config_integration.js"></script>
```

### 2. Check ML status before classification
```javascript
async function analyzeWell(wellData) {
    const mlEnabled = await checkMLEnabledForPathogen(
        wellData.pathogen_code, 
        wellData.fluorophore
    );
    
    if (mlEnabled) {
        return await performMLClassification(wellData);
    } else {
        return await performTraditionalClassification(wellData);
    }
}
```

### 3. Bulk session processing
```javascript
// Check ML status for all wells in a session
const sessionWithMLStatus = await checkMLStatusForSession(sessionData);
```

## Admin Interface

Access the ML configuration interface at:
```
http://localhost:5000/ml-config
```

### Features
- **Visual status overview** of all pathogen configurations
- **Toggle controls** for each pathogen/fluorophore combination
- **System settings** management
- **Audit log viewer** with detailed change history
- **Training data reset** with safety confirmations

## Security Features

### Multi-Step Confirmation
Dangerous operations (like training data reset) require:
1. Initial confirmation dialog
2. Typing exact confirmation phrase
3. Automatic backup creation
4. Audit log entry

### Audit Trail
Every change is logged with:
- User ID and IP address
- Timestamp
- Old and new values
- Action performed
- Notes/reason for change

### Protection Mechanisms
- Global ML toggle to disable all ML operations
- Training data locking (future feature)
- Backup creation before destructive operations
- Rate limiting on sensitive operations

## Future Enhancements

### Role-Based Access Control
- **Admin Role**: Full access to all ML configuration
- **Analyst Role**: View-only access to ML status
- **Operator Role**: Limited toggle permissions
- **Auditor Role**: Read-only access to audit logs

### Advanced Features
- **Scheduled training data cleanup**
- **ML performance monitoring**
- **Automated backup management**
- **Configuration export/import**

## Troubleshooting

### Common Issues

#### ML Config Manager Not Initialized
```
Error: ML Configuration Manager not initialized
Solution: Ensure ml_config_schema.sql has been applied to the database
```

#### API Endpoints Not Responding
```
Error: 404 on /api/ml-config/* endpoints
Solution: Check that ml_config_manager import is added to app.py
```

#### Audit Log Not Recording
```
Error: Changes not appearing in audit log
Solution: Verify X-User-ID header is included in API requests
```

### Database Issues

#### Schema Not Applied
```bash
# Re-apply the schema
sqlite3 qpcr_analysis.db < ml_config_schema.sql
```

#### Reset All Configuration
```sql
-- WARNING: This will delete all ML configuration data
DELETE FROM ml_audit_log;
DELETE FROM ml_pathogen_config;
DELETE FROM ml_system_config;
-- Then re-run the schema initialization
```

## Testing

### API Testing
```bash
# Test pathogen configuration endpoint
curl -X GET http://localhost:5000/api/ml-config/pathogen

# Test ML toggle
curl -X PUT http://localhost:5000/api/ml-config/pathogen/BVAB/FAM \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test_user" \
  -d '{"enabled": false, "notes": "Testing"}'

# Check audit log
curl -X GET http://localhost:5000/api/ml-config/audit-log?limit=5
```

### Frontend Testing
1. Navigate to `/ml-config`
2. Verify pathogen list loads correctly
3. Test toggle functionality
4. Check audit log display
5. Test reset confirmation flows

## Configuration Files

### Environment Variables
```bash
# Optional: Set user ID for API requests
export ML_CONFIG_USER_ID="admin_user"

# Optional: Enable additional audit logging
export ML_CONFIG_VERBOSE_AUDIT="true"
```

### System Configuration Options
```json
{
  "ml_global_enabled": true,
  "min_training_examples": 10,
  "auto_training_enabled": true,
  "reset_protection_enabled": true,
  "training_data_version": "2.0"
}
```

---

## Enhanced ML Feedback Interface (July 2025)

### 🔧 Robust Data Handling
The ML feedback interface has been enhanced with comprehensive data recovery mechanisms to prevent "No well data available" errors:

#### **Multi-Source Data Recovery**
- **Primary Source**: Stored instance data (`currentWellData`, `currentWellKey`)
- **Fallback 1**: Modal state recovery (`window.currentModalWellKey`)
- **Fallback 2**: Global results recovery (`window.currentAnalysisResults.individual_results`)
- **Deep Cloning**: Prevents reference issues and data corruption

#### **Enhanced Pathogen Detection**
- **5-Strategy Fallback System**: Pathogen library → well data → test code → constructed → general PCR
- **Comprehensive Logging**: Detailed console output for debugging pathogen extraction
- **Multiple Data Sources**: Works with both stored and recovered well data

#### **Error Prevention Features**
- **Data Validation**: Multiple checkpoints throughout submission process
- **Graceful Degradation**: System continues to work even with missing data fields
- **Detailed Error Messages**: Clear indication of available data sources and recovery attempts
- **Backward Compatibility**: All existing functionality preserved while adding robustness

### 🎯 Key Improvements
- **Eliminated "No well data available" popup errors**
- **Robust pathogen extraction with comprehensive fallbacks**
- **Enhanced well data recovery from multiple sources**
- **Deep cloning prevents data corruption issues**
- **Maintains all existing ML feedback functionality**

---

## Summary

The ML Configuration Management System provides:

✅ **Safe, pathogen-specific ML control**
✅ **Comprehensive audit logging**
✅ **Training data protection with backup**
✅ **User-friendly admin interface**
✅ **Easy integration with existing code**
✅ **Future-ready for role-based access**

This system ensures that your ML configuration changes are safe, auditable, and reversible while providing the granular control needed for production qPCR analysis environments.
