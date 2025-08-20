# User Access Policy (RBAC) — Multi‑Role, Evidence Deletion, MySQL Admin Writes

This document replaces the previous single‑role RBAC specification. It defines how users authenticate and what they can do, including multi‑role membership, who may delete uploaded documentation, and who can write to MySQL.

## Multi‑Role Model

- A user may hold multiple roles at once: roles: [string].
- Effective permissions are the union of all role permissions: permissions: [string].
- For backward compatibility, a primary role is exposed as role: string (the highest role).
- Authorization checks should consume permissions; role checks use the highest role when required.

Examples
- Viewer-only: roles [viewer] → read-only.
- QC + Viewer: roles [qc_technician, viewer] → all QC capabilities plus read-only.
- Admin: roles [administrator, …] → full access including admin-only features.

Status
- Sessions and APIs must expose roles (array) and role (primary). Legacy consumers keep working with role.

## Roles and Core Capabilities

Viewer (read-only)
- View analysis results, compliance dashboard, ML statistics; export data.

Lab Technician (operations)
- All Viewer; upload files; run basic analysis.

QC Technician (validation)
- All Lab Technician; run ML analysis; modify thresholds; validate results; provide ML feedback; manage compliance evidence.

Research User (flexible uploads)
- All QC Technician; upload non‑standard files; manual file/channel mapping; use experimental analysis.

Compliance Officer (regulatory)
- All QC Technician; manage compliance requirements; view audit logs/reports.

Administrator (system admin)
- All permissions from all roles plus exclusive admin functions: system reset, user management, database management, system configuration.

Note: Exact permission IDs map to the backend (e.g., RUN_BASIC_ANALYSIS, RUN_ML_ANALYSIS, MANAGE_COMPLIANCE_EVIDENCE, DATABASE_MANAGEMENT). UI should gate features using the permissions returned by /auth/api/current-user.

## Deleting Uploaded Documentation (Evidence)

- Who may delete: only QC Technician, Compliance Officer, and Administrator.
- Enforcement: server enforces a role allow‑list on DELETE /api/unified-compliance/evidence/documentation/delete/<evidence_id> and audits every deletion.
- Scope: deletion removes the stored file (path‑validated) and the corresponding compliance_evidence row when evidence_kind=documentation.
- UX: unauthorized users do not see the Delete control; server returns 403 if called directly.

Audit and Safety
- Uploads are logged (DOCUMENTATION_UPLOADED). Deletions are logged (DOCUMENTATION_DELETED). File serving is path‑safe and logged (DATA_EXPORTED).

## MySQL Admin Access and Writes

- Admin‑only: Only users with the Administrator role can access database management and perform write operations via the integrated MySQL viewer.
- Viewer URLs: /mysql-viewer (inline), /mysql-admin (standalone); API: /api/mysql-admin/*.
- Dev flags
    - DEV_RELAXED_ADMIN_ACCESS=1: shows relaxed admin indicator in UI (dev only).
    - DEV_MYSQL_ADMIN_ALLOW_WRITES=1: enables write queries in dev; writes stay blocked otherwise.
- Operational notes
    - After schema/route changes, restart Flask to refresh MySQL pools and viewer routes.
    - The viewer header shows the signed‑in user, roles, and an Admin badge when applicable; sign‑in/out links provided.

Security
- SQLite is forbidden; MySQL only (pymysql/mysql.connector). Backups run via mysqldump; admin features are audited.

## Backward Compatibility and Checks

- Session payloads: expose both roles (array) and role (primary). Compute effective permissions as the union.
- Role hierarchy: checks use the highest role among roles; permission checks use current_user.permissions.
- Frontend: prefer permission‑based gating; may display the primary role with a tooltip listing all roles.

## Quick Testing Matrix

- Viewer: cannot upload, delete, or access admin DB tools.
- Lab Technician: can upload/run basic analysis; cannot delete documentation or access DB tools.
- QC Technician: can delete documentation; can validate results and provide ML feedback.
- Compliance Officer: can delete documentation; can manage requirements and view audits.
- Administrator: can delete documentation; can write via MySQL viewer (subject to env flags in dev); sees admin badges.

— End of policy —
