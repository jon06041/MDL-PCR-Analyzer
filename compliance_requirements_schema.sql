-- Comprehensive Compliance Requirements Tracking Schema
-- Maps specific regulatory requirements to trackable events and compliance status

-- Master compliance requirements table with specific regulation numbers
CREATE TABLE IF NOT EXISTS compliance_requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requirement_code TEXT NOT NULL UNIQUE, -- e.g., "CLIA_493.1201", "CAP_GEN.40050"
    regulation_source TEXT NOT NULL, -- FDA_21CFR, CLIA_42CFR, CAP_LAB, NYSDOH_CLEP
    section_number TEXT NOT NULL, -- Specific regulation section
    requirement_title TEXT NOT NULL,
    requirement_description TEXT NOT NULL,
    compliance_category TEXT NOT NULL, -- QC, Personnel, Equipment, Documentation, etc.
    frequency TEXT NOT NULL, -- daily, weekly, monthly, annual, event_based
    criticality_level TEXT NOT NULL, -- critical, major, minor
    auto_trackable BOOLEAN DEFAULT FALSE, -- Can be automatically tracked by the system
    tracking_method TEXT, -- How the system tracks this requirement
    evidence_required TEXT, -- What evidence is needed for compliance
    non_compliance_consequence TEXT, -- What happens if not met
    implementation_status TEXT DEFAULT 'pending', -- pending, implemented, validated
    last_assessed_date DATE,
    next_assessment_date DATE,
    compliance_status TEXT DEFAULT 'unknown', -- compliant, non_compliant, partial, unknown
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Compliance evidence tracking - links requirements to actual system events
CREATE TABLE IF NOT EXISTS compliance_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requirement_code TEXT NOT NULL,
    evidence_type TEXT NOT NULL, -- automated_log, manual_entry, document_upload, test_result
    evidence_source TEXT NOT NULL, -- system_log, user_input, file_upload, api_call
    evidence_data TEXT NOT NULL, -- JSON with actual evidence
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    session_id TEXT,
    compliance_score INTEGER, -- 0-100 based on evidence quality
    verified_by TEXT,
    verification_date DATETIME,
    notes TEXT,
    FOREIGN KEY (requirement_code) REFERENCES compliance_requirements(requirement_code)
);

-- Real-time compliance status tracking
CREATE TABLE IF NOT EXISTS compliance_status_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requirement_code TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    change_reason TEXT,
    change_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    changed_by TEXT,
    system_triggered BOOLEAN DEFAULT TRUE,
    impact_assessment TEXT,
    FOREIGN KEY (requirement_code) REFERENCES compliance_requirements(requirement_code)
);

-- Compliance gaps and action items
CREATE TABLE IF NOT EXISTS compliance_gaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requirement_code TEXT NOT NULL,
    gap_description TEXT NOT NULL,
    gap_severity TEXT NOT NULL, -- critical, high, medium, low
    identified_date DATE NOT NULL,
    target_resolution_date DATE,
    actual_resolution_date DATE,
    assigned_to TEXT,
    corrective_actions TEXT,
    status TEXT DEFAULT 'open', -- open, in_progress, resolved, deferred
    cost_estimate REAL,
    business_impact TEXT,
    FOREIGN KEY (requirement_code) REFERENCES compliance_requirements(requirement_code)
);

-- Insert specific CLIA requirements
INSERT OR IGNORE INTO compliance_requirements (
    requirement_code, regulation_source, section_number, requirement_title, 
    requirement_description, compliance_category, frequency, criticality_level,
    auto_trackable, tracking_method, evidence_required
) VALUES 

-- CLIA Requirements (Software-Specific Only)
-- CLIA Quality Control (42 CFR 493 Subpart K) - As it relates to software QC
('CLIA_493.1201_QC', 'CLIA_42CFR', '493.1201', 'Daily Quality Control Tracking', 
 'Software must track and document quality control results as specified by manufacturer', 
 'Quality_Control', 'daily', 'critical', TRUE, 'qc_run_logging', 'Daily QC results and trending in software'),

('CLIA_493.1256', 'CLIA_42CFR', '493.1256', 'Control Procedures Tracking', 
 'Software must track control procedures and detect immediate errors in data', 
 'Quality_Control', 'daily', 'critical', TRUE, 'control_results_tracking', 'Control results within acceptable ranges tracked by software'),

-- CLIA Documentation (42 CFR 493 Subpart L) - Software record keeping
('CLIA_493.1105', 'CLIA_42CFR', '493.1105', 'Electronic Test Records', 
 'Software must maintain complete electronic records for all testing performed', 
 'Documentation', 'continuous', 'critical', TRUE, 'automated_record_keeping', 'Complete test records and audit trails in software'),

('CLIA_493.1291', 'CLIA_42CFR', '493.1291', 'Electronic Test Report Requirements', 
 'Software must generate test reports with all required elements and proper authorization', 
 'Documentation', 'per_test', 'critical', TRUE, 'report_generation', 'Compliant test reports with required elements'),

-- CAP Information Systems Requirements (Software-Specific)
('CAP_INF.11400', 'CAP_LAB', 'INF.11400', 'Information System Validation', 
 'Information systems must be validated before implementation and after significant changes', 
 'Information_Systems', 'per_change', 'critical', TRUE, 'system_validation', 'Validation protocols and results'),

('CAP_INF.11450', 'CAP_LAB', 'INF.11450', 'Data Integrity', 
 'Laboratory must ensure data integrity and security of information systems', 
 'Information_Systems', 'continuous', 'critical', TRUE, 'data_integrity_monitoring', 'Data integrity checks and audit logs'),

-- FDA Software Validation (21 CFR Part 820)
('FDA_820.30_SOFTWARE', 'FDA_21CFR', '820.30', 'Software Design Controls', 
 'Software used in device must be validated according to established procedures', 
 'Software_Validation', 'per_version', 'critical', TRUE, 'software_versioning', 'Software validation documentation'),

('FDA_820.70_SOFTWARE', 'FDA_21CFR', '820.70', 'Software Production Controls', 
 'Software changes must be controlled and validated before implementation', 
 'Software_Control', 'per_change', 'critical', TRUE, 'change_control', 'Change control records and validation'),

('FDA_820.100', 'FDA_21CFR', '820.100', 'Corrective and Preventive Actions', 
 'Procedures for CAPA must be established to address nonconforming product', 
 'Quality_System', 'as_needed', 'critical', TRUE, 'capa_tracking', 'CAPA records and effectiveness verification'),

-- FDA Electronic Records (21 CFR Part 11)
('FDA_11.10_CONTROLS', 'FDA_21CFR', '11.10', 'Electronic Record Controls', 
 'Electronic records must have appropriate controls to ensure authenticity and integrity', 
 'Electronic_Records', 'continuous', 'critical', TRUE, 'audit_trail_monitoring', 'Audit trails and access controls'),

('FDA_11.50_SIGNATURES', 'FDA_21CFR', '11.50', 'Electronic Signature Requirements', 
 'Electronic signatures must meet specific requirements for authentication', 
 'Electronic_Records', 'per_signature', 'critical', FALSE, 'signature_validation', 'Electronic signature validation'),

-- NY State Department of Health CLEP (Software-Specific Only)
('NYSDOH_CLEP_6.3', 'NYSDOH_CLEP', '6.3', 'Molecular Testing Controls Tracking', 
 'Software must track and validate that molecular tests include appropriate positive and negative controls', 
 'Molecular_Testing', 'per_run', 'critical', TRUE, 'molecular_control_tracking', 'Control results for each run tracked in software'),

('NYSDOH_CLEP_7.1', 'NYSDOH_CLEP', '7.1', 'Electronic Result Reporting', 
 'Software must ensure test results are reported according to NY State requirements', 
 'Result_Reporting', 'per_test', 'critical', TRUE, 'report_compliance_checking', 'Compliant result reports generated by software');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_compliance_req_code ON compliance_requirements(requirement_code);
CREATE INDEX IF NOT EXISTS idx_compliance_req_category ON compliance_requirements(compliance_category);
CREATE INDEX IF NOT EXISTS idx_compliance_req_auto_trackable ON compliance_requirements(auto_trackable);
CREATE INDEX IF NOT EXISTS idx_compliance_evidence_req_code ON compliance_evidence(requirement_code);
CREATE INDEX IF NOT EXISTS idx_compliance_evidence_timestamp ON compliance_evidence(timestamp);
CREATE INDEX IF NOT EXISTS idx_compliance_status_req_code ON compliance_status_log(requirement_code);
CREATE INDEX IF NOT EXISTS idx_compliance_gaps_status ON compliance_gaps(status, requirement_code);
