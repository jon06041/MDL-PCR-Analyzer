# User Access Policy (Short Reference)

[See detailed permissions matrix](./PERMISSIONS_MATRIX.md)

This overview summarizes roles, multi‑role behavior, and key restrictions for documentation deletion and MySQL admin writes.

Multi‑Role
- Users can have multiple roles. Effective permissions are the union across roles.
- Sessions expose roles (array) and role (primary/highest) for legacy consumers.

Who can do what (highlights)
- Viewer: Read‑only (analysis, dashboards, exports). No uploads, no deletes, no admin DB.
- Lab Technician: Viewer + upload + run basic analysis.
- QC Technician: Lab + ML analysis, thresholds, validation, ML feedback, manage compliance evidence.
- Research User: QC + flexible uploads and manual mapping for non‑standard files.
- Compliance Officer: QC + manage requirements, view audit logs/reports.
- Administrator: Everything above + admin‑only (system reset, user mgmt, database mgmt, config).

Documentation deletion (evidence)
- Allowed roles: QC Technician, Compliance Officer, Administrator.
- API: DELETE /api/unified-compliance/evidence/documentation/delete/<id>
- Server verifies evidence_kind=documentation, removes file + DB row, and writes an audit entry.

MySQL admin writes
- Admin‑only access to MySQL viewer: /mysql-viewer, /mysql-admin, /api/mysql-admin/*.
- Dev flags: DEV_RELAXED_ADMIN_ACCESS=1 (UI badge), DEV_MYSQL_ADMIN_ALLOW_WRITES=1 (enable writes in dev).
- Restart Flask after schema/viewer route changes to refresh connection pools.

Security notes
- MySQL only; SQLite is forbidden. All uploads/serves/deletes are path‑safe and audited.

Testing checklist
- Viewer cannot delete or access DB tools.
- QC/Compliance/Admin can delete documentation; deletion is audited.
- Admin can perform DB writes in viewer when enabled by dev flags; otherwise read‑only.
