# Role-Based Feature Implementation Plan

## 🎯 Priority Implementation Tasks

### 1. **Research User - Flexible File Upload** (HIGH PRIORITY)

#### Backend Changes Required:
- [ ] **New Upload Endpoint**: `/api/upload-research` for non-standard file uploads
- [ ] **File Type Detection**: Logic to identify amplification vs summary files by content analysis
- [ ] **Manual Mapping API**: Endpoint to manually assign file types and channels
- [ ] **Validation Relaxation**: Reduce naming convention requirements for research uploads

#### Frontend Changes Required:
- [ ] **Research Upload Interface**: Specialized upload form for research users
- [ ] **File Type Selector**: Dropdown to manually specify amplification/summary files
- [ ] **Channel Assignment**: Interface to map files to fluorophore channels
- [ ] **Upload Progress**: Enhanced progress indicator for manual mapping workflow

#### Implementation Steps:
```python
# 1. Create research-specific upload route
@require_permission('upload_non_standard_files')
@app.route('/api/upload-research', methods=['POST'])
def research_upload():
    # Accept files without naming convention validation
    # Provide manual file type assignment
    
# 2. Add file content analysis
def analyze_file_content(file_path):
    # Detect if file contains amplification or summary data
    # Return file type and suggested channel assignments
    
# 3. Manual mapping endpoint
@require_permission('manual_file_mapping')
@app.route('/api/map-files', methods=['POST'])
def map_research_files():
    # Allow manual assignment of file types and channels
```

---

### 2. **Administrator Exclusive Features** (MEDIUM PRIORITY)

#### Current Requirement:
- Administrators have access to ALL features (analysis, compliance, research, etc.)
- **ONLY administrators** can access "Reset Everything" button and database backups
- Other roles should NOT see these administrative functions

#### Required Changes:
- [ ] **UI Element Hiding**: Hide "Reset Everything" and "Database Backup" buttons for non-administrators
- [ ] **Route Protection**: Protect administrative endpoints with `system_reset` and `database_management` permissions
- [ ] **Navigation Control**: Show administrative menu items only for administrators
- [ ] **Permission Enforcement**: Ensure only administrators can access exclusive features

#### Implementation:
```javascript
// Frontend permission-based UI control
function initializeUserInterface(userPermissions) {
    // Show administrative features ONLY for administrators
    if (userPermissions.includes('system_reset')) {
        document.getElementById('resetButton').style.display = 'block';
    } else {
        document.getElementById('resetButton').style.display = 'none';
    }
    
    if (userPermissions.includes('database_management')) {
        document.getElementById('backupManager').style.display = 'block';
    } else {
        document.getElementById('backupManager').style.display = 'none';
    }
    
    // All other features visible to administrators + their respective roles
}
```

---

### 3. **Permission Middleware System** (HIGH PRIORITY)

#### Create Flask Permission Decorators:
```python
from functools import wraps
from flask import session, jsonify
from unified_auth_manager import UnifiedAuthManager

def require_permission(permission):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_manager = UnifiedAuthManager()
            session_id = session.get('session_id')
            
            if not session_id:
                return jsonify({'error': 'Authentication required'}), 401
                
            user_data = auth_manager.validate_session(session_id)
            if not user_data:
                return jsonify({'error': 'Invalid session'}), 401
                
            if permission not in user_data.get('permissions', []):
                return jsonify({'error': 'Insufficient permissions'}), 403
                
            return f(*args, **kwargs)
        return decorated_function
    return decorator
```

#### Apply to Existing Routes:
```python
# File upload routes
@require_permission('upload_files')
@app.route('/api/upload')
def standard_upload():
    # Standard file upload for lab users

@require_permission('upload_non_standard_files')
@app.route('/api/upload-research')
def research_upload():
    # Research file upload with flexible naming

# Analysis routes  
@require_permission('run_ml_analysis')
@app.route('/api/ml-analysis')
def ml_analysis():
    # ML analysis functionality

# Administrative routes
@require_permission('system_reset')
@app.route('/api/emergency-reset')
def emergency_reset():
    # Emergency system reset

@require_permission('database_management')
@app.route('/api/backup')
def database_backup():
    # Database backup functionality
```

---

### 4. **Research File Upload Interface** (MEDIUM PRIORITY)

#### New UI Components Needed:
- [ ] **Research Upload Modal**: Specialized interface for non-standard uploads
- [ ] **File Type Assignment**: Dropdown for amplification/summary selection
- [ ] **Channel Mapping**: Drag-and-drop or dropdown for fluorophore assignment
- [ ] **Validation Feedback**: Real-time validation of research uploads

#### Workflow Design:
1. **File Selection**: Research user selects multiple files (any naming pattern)
2. **Content Analysis**: System analyzes file content to suggest types
3. **Manual Mapping**: User confirms/modifies file type and channel assignments
4. **Upload Confirmation**: Display mapping summary before final upload
5. **Processing**: Standard analysis pipeline with research metadata

---

### 5. **Role-Based Dashboard Customization** (LOW PRIORITY)

#### Dashboard Variants by Role:
- **Lab Technician**: File upload + basic analysis results
- **QC Technician**: Analysis + validation + ML feedback tools
- **Research User**: Flexible upload + experimental features + analysis
- **Compliance Officer**: Compliance dashboard + audit tools + analysis
- **Administrator**: User management + system maintenance + backups

---

## 🧪 Testing Strategy

### Permission Testing Matrix:
- [ ] **Research User**: Can upload non-standard files and manually map them
- [ ] **Administrator**: Can only access reset button and backup manager
- [ ] **Standard Users**: Cannot access research upload features
- [ ] **Permission Bypass**: Verify users cannot access unauthorized endpoints

### File Upload Testing:
- [ ] **Standard Upload**: Normal naming convention still works for all users
- [ ] **Research Upload**: Non-standard files work only for research users
- [ ] **Manual Mapping**: File type and channel assignment functions correctly
- [ ] **Validation**: Research uploads still validate file content properly

---

## 📋 Implementation Priority

### Phase 1 (Immediate):
1. Create permission middleware decorators
2. Apply permission checks to existing routes
3. Update administrator permissions in database

### Phase 2 (Next Week):
1. Implement research user flexible upload
2. Create manual file mapping interface
3. Restrict administrator UI access

### Phase 3 (Later):
1. Role-based dashboard customization
2. Advanced research user features
3. Enhanced validation workflows

**Ready to begin implementation!** 🚀
