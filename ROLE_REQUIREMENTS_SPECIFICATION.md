# Role-Based Access Control (RBAC) Requirements

## 🏢 Organizational Roles & Permissions

### 1. **Viewer** (Read-Only Access)
**Purpose**: External stakeholders, observers, auditors who need read-only access

**Permissions**:
- ✅ `view_analysis_results` - View PCR analysis results and charts
- ✅ `view_compliance_dashboard` - Access compliance tracking dashboard  
- ✅ `export_data` - Export analysis results and reports
- ✅ `view_ml_statistics` - View ML model performance metrics

**Restrictions**:
- ❌ Cannot upload files or run analyses
- ❌ Cannot modify any settings or thresholds
- ❌ Cannot provide ML feedback or manage compliance
- ❌ No administrative functions

---

### 2. **Lab Technician** (Basic Operations)
**Purpose**: Laboratory staff performing routine PCR testing

**Permissions**:
- ✅ All Viewer permissions PLUS:
- ✅ `upload_files` - Upload PCR data files (CSV, amplification data)
- ✅ `run_basic_analysis` - Execute standard PCR curve analysis

**Restrictions**:
- ❌ Cannot run ML analysis or provide ML feedback
- ❌ Cannot modify thresholds or validate results
- ❌ Cannot manage compliance evidence or requirements
- ❌ No administrative functions

**Use Cases**:
- Daily PCR testing workflows
- Data upload and basic analysis
- Routine quality control testing

---

### 3. **QC Technician** (Analysis & Validation)
**Purpose**: Quality control specialists responsible for result validation

**Permissions**:
- ✅ All Lab Technician permissions PLUS:
- ✅ `run_ml_analysis` - Execute machine learning curve classification
- ✅ `modify_thresholds` - Adjust analysis thresholds and parameters
- ✅ `validate_results` - Mark results as validated/approved
- ✅ `manage_compliance_evidence` - Add evidence for regulatory compliance
- ✅ `view_ml_statistics` - Access ML model performance data
- ✅ `provide_ml_feedback` - Train ML models with expert feedback

**Key Responsibilities**:
- Result validation and approval workflows
- ML model training and optimization
- Threshold calibration and optimization
- Compliance evidence documentation

---

### 4. **Research User** (Experimental Upload Flexibility)
**Purpose**: Research scientists using the system for experimental studies and non-standard workflows

**Permissions**: 
- ✅ All QC Technician permissions PLUS:
- ✅ `upload_non_standard_files` - Upload amplification and summary files that don't follow standard naming conventions
- ✅ `manual_file_mapping` - Manually specify file types and channels for non-conforming uploads
- ✅ `experimental_analysis` - Access to experimental features and analysis methods

**Special Capabilities**:
- **Flexible File Upload**: Can upload files without strict naming convention requirements
- **Manual File Classification**: Can specify which files are amplification vs summary data
- **Channel Assignment**: Can manually assign fluorophore channels to uploaded files
- **Experimental Workflows**: Access to research-specific analysis features

**File Upload Requirements for Research Users**:
- ✅ **Must still be valid amplification data files** (CSV format with cycle/fluorescence data)
- ✅ **Must still provide summary files** for Cq value integration (can be non-standard naming)
- ✅ **Manual mapping interface** to specify file types and channels when naming convention not followed
- ✅ **Data validation** still applies (proper CSV structure, valid fluorescence values)

**Restrictions**:
- ❌ Cannot manage compliance requirements (only evidence)
- ❌ No audit access or user management
- ❌ No administrative functions

---

### 5. **Compliance Officer** (Regulatory Oversight)
**Purpose**: Regulatory compliance specialists ensuring FDA/regulatory adherence

**Permissions**:
- ✅ All QC Technician permissions PLUS:
- ✅ `manage_compliance_requirements` - Define and manage regulatory requirements
- ✅ `audit_access` - View audit logs and access reports

**Key Responsibilities**:
- Regulatory requirement management
- Compliance dashboard oversight
- Audit trail monitoring
- FDA validation documentation

---

### 6. **Administrator** (Full System Access + Exclusive Features)
**Purpose**: System administrators with complete access to all features plus exclusive administrative functions

**Permissions**:
- ✅ **ALL permissions from ALL roles** (complete system access)
- ✅ **EXCLUSIVE access to administrative functions:**
  - `system_reset` - **ONLY administrators** can access "Reset Everything" button
  - `database_management` - **ONLY administrators** can access database backups
  - `manage_users` - **ONLY administrators** can create/modify/delete user accounts
  - `system_administration` - **ONLY administrators** can configure system settings

**Full Access Includes**:
- ✅ All lab operations (upload, analysis, validation)
- ✅ All compliance features (evidence, requirements, audit)
- ✅ All ML features (analysis, feedback, statistics)
- ✅ All research features (experimental uploads, manual mapping)
- ✅ All QC features (threshold modification, result validation)

**Exclusive Administrative Access**:
- ✅ **"Reset Everything" Button**: Emergency system reset (ADMIN ONLY)
- ✅ **Database Backup Manager**: Full backup/restore operations (ADMIN ONLY)
- ✅ **User Management**: Create/modify/delete any user account (ADMIN ONLY)
- ✅ **System Configuration**: Authentication, security, system settings (ADMIN ONLY)

**Key Responsibilities**:
- Complete system oversight and management
- User account administration
- System maintenance and emergency recovery
- Database management and security
- All operational functions when needed

---

## 🔐 Permission Implementation Strategy

### Current Status ✅
- **Database Schema**: Authentication tables exist and working
- **Role Definitions**: Complete role hierarchy implemented
- **Permission Mapping**: All permissions mapped to roles
- **Authentication**: Dual Entra ID + local authentication working

### Next Steps 🚀

#### 1. **Research User File Upload Enhancement**
Implement flexible file upload system for research users:

```python
@require_permission('upload_non_standard_files')
@app.route('/api/upload-research')
def research_upload():
    # Allow files without naming convention requirements
    # Provide manual mapping interface for file type/channel assignment
```

#### 2. **Administrator Exclusive Features Protection**
Ensure ONLY administrators can access exclusive administrative functions:

```javascript
// Show administrative features ONLY for administrators
if (userPermissions.includes('system_reset')) {
    showResetButton();  // Only administrators see this
}
if (userPermissions.includes('database_management')) {
    showBackupManager();  // Only administrators see this
}
// Administrators have access to ALL other features too
```

#### 3. **Permission Middleware Implementation**
Create Flask decorators to enforce permissions on API endpoints:

```python
@require_permission('upload_files')
@app.route('/api/upload')
def upload_endpoint():
    # Only users with upload_files permission can access
```

#### 4. **Research User File Upload Interface**
Create specialized upload interface for research users:
- **Manual File Type Selection**: Dropdown to specify amplification vs summary files
- **Channel Assignment**: Manual fluorophore channel mapping
- **Validation Override**: Research-specific validation rules
- **Naming Convention Bypass**: Upload files with any naming pattern

#### 2. **Frontend Permission Control**
Hide/show UI elements based on user permissions:

```javascript
// Show upload button only if user has upload_files permission
if (userPermissions.includes('upload_files')) {
    showUploadButton();
}
```

#### 3. **Role Management Interface**
Create admin interface for:
- User role assignment
- Permission verification
- Audit log viewing
- Role-based reporting

#### 4. **Compliance Integration**
Link role permissions to FDA compliance requirements:
- QC Technician validation → 21 CFR Part 11 compliance
- Compliance Officer oversight → Audit trail requirements
- Administrator controls → System security requirements

---

## 🎯 Implementation Priority

### Phase 1: Core Permission Enforcement (HIGH PRIORITY)
1. **API Endpoint Protection**: Add permission decorators to all Flask routes
2. **Frontend Permission Gates**: Hide restricted UI elements
3. **File Upload Restrictions**: Enforce upload permissions
4. **Analysis Restrictions**: Protect ML and advanced analysis features

### Phase 2: Advanced Role Features (MEDIUM PRIORITY)
1. **Role Management UI**: Admin interface for user/role management
2. **Permission Audit**: Track permission usage and access patterns
3. **Role-Based Dashboards**: Customize dashboards per role
4. **Workflow Enforcement**: Multi-step approval workflows

### Phase 3: Compliance Integration (ONGOING)
1. **FDA Mapping**: Link permissions to specific FDA requirements
2. **Audit Reporting**: Generate compliance reports by role
3. **Validation Workflows**: Implement QC approval processes
4. **Access Documentation**: Automatic audit trail generation

---

## 🧪 Testing Strategy

### Role Testing Matrix
- [ ] **Viewer**: Can only view, cannot modify anything
- [ ] **Lab Technician**: Can upload and run basic analysis only
- [ ] **QC Technician**: Can validate results and train ML models
- [ ] **Research User**: Same as QC + flexible file uploads with manual mapping
- [ ] **Compliance Officer**: Can manage requirements and audit access
- [ ] **Administrator**: **FULL access to ALL features** + exclusive access to reset button and database backups

### Security Testing
- [ ] **Permission Bypass**: Verify users cannot access restricted features
- [ ] **Administrative Exclusivity**: Ensure ONLY administrators can access reset/backup functions
- [ ] **API Security**: Test API endpoints respect permission requirements
- [ ] **Session Security**: Verify role changes require re-authentication

---

## 📋 Current Database Schema

### Users Table (`local_users`)
- `user_id`, `username`, `password_hash`, `role`, `email`, `display_name`
- `created_at`, `last_login`, `is_active`

### Sessions Table (`user_sessions`) 
- `session_id`, `user_id`, `username`, `role`, `auth_method`
- `created_at`, `last_activity`, `expires_at`, `entra_oid`, `tenant_id`

### Audit Table (`auth_audit_log`)
- `username`, `auth_method`, `action`, `ip_address`, `user_agent`
- `timestamp`, `details` (JSON)

Ready for permission middleware implementation! 🚀
