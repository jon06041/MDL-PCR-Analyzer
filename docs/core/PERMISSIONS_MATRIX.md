# Permissions Matrix (Detailed)

This document defines permission IDs, what they control, and how roles compose them. It complements `USER_ACCESS_POLICY.md`.

## Permission IDs and meanings

- VIEW_ANALYSIS_RESULTS
  - View qPCR analysis results and charts.
  - UI: Results pages, charts. API: GET endpoints for results.
- VIEW_COMPLIANCE_DASHBOARD
  - Access the unified compliance dashboard and evidence lists.
  - UI: compliance dashboard. API: /api/unified-compliance/* (GET).
- EXPORT_DATA
  - Export analysis results and reports.
  - UI: Export buttons. API: CSV/JSON export endpoints.
- VIEW_ML_STATISTICS
  - View ML model performance metrics and dashboards.
  - UI: ML dashboards. API: /api/ml-config/* (GET), /api/ml-runs/* (GET).
- UPLOAD_FILES
  - Upload standard PCR data files.
  - UI: standard upload; API: /api/upload, /analyze (where applicable).
- RUN_BASIC_ANALYSIS
  - Run basic curve analysis workflows.
  - API: analysis routes invoked by uploads/basic analyze.
- RUN_ML_ANALYSIS
  - Execute ML curve classification.
  - API: /api/ml-analysis, ML pipelines.
- MODIFY_THRESHOLDS
  - Adjust analysis thresholds/parameters (frontend + persisted when allowed).
  - UI: threshold controls; API: threshold save endpoints.
- VALIDATE_RESULTS
  - Mark results as validated/approved.
  - UI: validation controls; API: result status update endpoints.
- PROVIDE_ML_FEEDBACK
  - Submit expert decisions/feedback to improve ML.
  - API: /api/ml-submit-feedback.
- MANAGE_COMPLIANCE_EVIDENCE
  - Create and manage compliance evidence (documentation uploads included).
  - API: /api/unified-compliance/evidence/documentation/upload, list, serve (GET), and other evidence creation endpoints.
- MANAGE_COMPLIANCE_REQUIREMENTS
  - Define and manage regulatory requirements metadata.
  - API/UI: compliance requirements editor, admin views.
- UPLOAD_NON_STANDARD_FILES
  - Upload amplification/summary files without strict naming; intended for research workflows.
  - UI: research upload; API: /api/upload-research (planned).
- MANUAL_FILE_MAPPING
  - Manually assign file types/channels for non‑standard uploads.
  - UI/API: mapping interfaces (planned).
- EXPERIMENTAL_ANALYSIS
  - Access experimental analysis methods.
  - UI/API: experimental features (guarded).
- AUDIT_ACCESS
  - View audit logs and reports.
  - API/UI: audit log pages and APIs.
- DATABASE_MANAGEMENT
  - Access MySQL admin viewer; in dev, may allow writes with flag.
  - UI: /mysql-viewer, /mysql-admin; API: /api/mysql-admin/*.
- SYSTEM_RESET
  - Use Reset Everything (dangerous admin operation).
  - UI/API: reset controls.
- MANAGE_USERS
  - Create/modify/delete user accounts.
  - UI/API: user admin screens.
- SYSTEM_ADMINISTRATION
  - Configure system settings and authentication/security options.
  - UI/API: admin config pages.

Special action: Delete documentation evidence
- Controlled by role allow‑list (QC Technician, Compliance Officer, Administrator). Not exposed as a standalone permission ID yet.
- API: DELETE /api/unified-compliance/evidence/documentation/delete/<id> (audited).

## Role → permission composition

Viewer
- VIEW_ANALYSIS_RESULTS, VIEW_COMPLIANCE_DASHBOARD, EXPORT_DATA, VIEW_ML_STATISTICS

Lab Technician
- All Viewer + UPLOAD_FILES, RUN_BASIC_ANALYSIS

QC Technician
- All Lab Technician + RUN_ML_ANALYSIS, MODIFY_THRESHOLDS, VALIDATE_RESULTS, PROVIDE_ML_FEEDBACK, MANAGE_COMPLIANCE_EVIDENCE

Research User
- All QC Technician + UPLOAD_NON_STANDARD_FILES, MANUAL_FILE_MAPPING, EXPERIMENTAL_ANALYSIS

Compliance Officer
- All QC Technician + MANAGE_COMPLIANCE_REQUIREMENTS, AUDIT_ACCESS

Administrator
- All permissions from all roles + DATABASE_MANAGEMENT, SYSTEM_RESET, MANAGE_USERS, SYSTEM_ADMINISTRATION

Notes
- Documentation deletion is permitted for QC Technician, Compliance Officer, Administrator irrespective of MANAGE_COMPLIANCE_EVIDENCE.
- Administrator can perform MySQL viewer writes only when DEV_MYSQL_ADMIN_ALLOW_WRITES=1 in dev; otherwise viewer is read‑only.

## Effective permissions and checks

- Multi‑role users: effective permissions = union across roles.
- Primary role (highest) is still provided for legacy checks.
- Prefer permission checks for features; use role checks only where explicitly required (e.g., documentation deletion allow‑list, admin‑only ops).

## API surfaces for auth/permissions

- GET /auth/api/current-user
  - Returns either flat or nested shape; normalize to include: username, roles [..], role (primary), permissions [..].
- Optional: /api/permissions/check (if present)
  - Can be used by UI to gate controls.

## Testing guide (targeted)

- Viewer
  - Cannot upload, delete documentation, or access MySQL viewer.
- Lab Technician
  - Can upload and run basic analysis; cannot delete documentation or access MySQL admin tools.
- QC Technician
  - Can delete documentation; can run ML, adjust thresholds, validate, submit ML feedback.
- Compliance Officer
  - Can delete documentation; can manage requirements and view audits.
- Administrator
  - Can delete documentation; can access MySQL viewer; writes allowed only with DEV_MYSQL_ADMIN_ALLOW_WRITES=1 in dev.

---

SQLite is forbidden. Use MySQL exclusively for all database operations.
