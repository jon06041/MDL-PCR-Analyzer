-- Comprehensive FDA Compliance Schema for Pathogen Testing Software
-- Covers all FDA requirements beyond just ML validation

-- Software Version Control and Change Management (21 CFR 820.30)
CREATE TABLE IF NOT EXISTS software_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_number TEXT NOT NULL UNIQUE, -- e.g., 'v2.1.0'
    release_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    change_description TEXT NOT NULL,
    risk_assessment TEXT, -- High/Medium/Low risk change
    validation_status TEXT DEFAULT 'pending', -- pending, validated, approved
    regulatory_impact TEXT, -- none, 510k_required, pma_supplement
    approved_by TEXT,
    approval_date DATETIME,
    installation_sites TEXT, -- JSON array of installation locations
    rollback_procedure TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    release_notes TEXT
);

-- User Management and Access Control (21 CFR Part 11)
CREATE TABLE IF NOT EXISTS user_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_role TEXT NOT NULL, -- operator, supervisor, admin, quality_manager
    action_type TEXT NOT NULL, -- login, logout, data_access, configuration_change
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    session_id TEXT,
    resource_accessed TEXT,
    action_details TEXT, -- JSON with specific action data
    success BOOLEAN NOT NULL,
    failure_reason TEXT
);

-- Quality Control and CLIA Compliance
CREATE TABLE IF NOT EXISTS quality_control_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    qc_date DATE NOT NULL,
    qc_type TEXT NOT NULL, -- daily_qc, weekly_qc, monthly_qc, proficiency_testing
    test_type TEXT NOT NULL, -- BVAB, Cglab, Mgen, etc.
    operator_id TEXT NOT NULL,
    supervisor_id TEXT,
    control_lot_numbers TEXT, -- JSON object with control lot info
    expected_results TEXT, -- JSON with expected control results
    actual_results TEXT, -- JSON with actual control results
    acceptance_criteria TEXT, -- JSON with pass/fail criteria
    qc_status TEXT NOT NULL, -- pass, fail, invalid, repeat_required
    deviation_notes TEXT,
    corrective_actions TEXT,
    review_date DATETIME,
    reviewed_by TEXT,
    clia_compliant BOOLEAN DEFAULT TRUE
);

-- Method Validation and Performance Studies
CREATE TABLE IF NOT EXISTS method_validation_studies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    study_id TEXT NOT NULL UNIQUE,
    method_name TEXT NOT NULL,
    pathogen_target TEXT NOT NULL,
    study_type TEXT NOT NULL, -- accuracy, precision, sensitivity, specificity, linearity
    study_start_date DATE NOT NULL,
    study_end_date DATE,
    study_status TEXT DEFAULT 'active', -- active, completed, failed, discontinued
    sample_size INTEGER NOT NULL,
    reference_method TEXT,
    acceptance_criteria TEXT, -- JSON with criteria
    results_summary TEXT, -- JSON with statistical results
    analytical_sensitivity REAL,
    analytical_specificity REAL,
    clinical_sensitivity REAL,
    clinical_specificity REAL,
    positive_predictive_value REAL,
    negative_predictive_value REAL,
    study_director TEXT NOT NULL,
    validated_by TEXT,
    validation_date DATETIME,
    regulatory_submission_required BOOLEAN DEFAULT FALSE
);

-- Instrument Qualification and Calibration
CREATE TABLE IF NOT EXISTS instrument_qualification (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instrument_id TEXT NOT NULL,
    instrument_type TEXT NOT NULL, -- qpcr_cycler, pipette, centrifuge, etc.
    serial_number TEXT,
    manufacturer TEXT,
    model TEXT,
    qualification_type TEXT NOT NULL, -- IQ, OQ, PQ, maintenance, calibration
    qualification_date DATE NOT NULL,
    next_qualification_date DATE NOT NULL,
    performed_by TEXT NOT NULL,
    qualification_status TEXT NOT NULL, -- pass, fail, conditional
    temperature_verification TEXT, -- JSON with temp data
    performance_parameters TEXT, -- JSON with performance data
    deviations TEXT,
    corrective_actions TEXT,
    certificate_path TEXT, -- Path to calibration certificate
    compliance_status TEXT DEFAULT 'compliant' -- compliant, non_compliant, pending
);

-- Data Integrity and Electronic Records (21 CFR Part 11)
CREATE TABLE IF NOT EXISTS data_integrity_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id TEXT NOT NULL,
    record_type TEXT NOT NULL, -- analysis_result, qc_data, user_action, configuration
    original_data TEXT, -- JSON of original data
    modified_data TEXT, -- JSON of modified data (if any)
    modification_reason TEXT,
    modified_by TEXT,
    modification_timestamp DATETIME,
    electronic_signature TEXT, -- Cryptographic signature
    witness_signature TEXT,
    data_integrity_check TEXT, -- Hash or checksum
    alcoa_compliance TEXT, -- JSON with ALCOA+ assessment
    audit_trail_complete BOOLEAN DEFAULT TRUE,
    data_retention_date DATE -- When data can be archived/deleted
);

-- Adverse Event Reporting (MDR - Medical Device Reporting)
CREATE TABLE IF NOT EXISTS adverse_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,
    event_date DATE NOT NULL,
    discovery_date DATE NOT NULL,
    reported_date DATE,
    event_type TEXT NOT NULL, -- software_malfunction, incorrect_result, system_failure
    severity TEXT NOT NULL, -- death, serious_injury, malfunction
    patient_affected BOOLEAN NOT NULL,
    event_description TEXT NOT NULL,
    root_cause_analysis TEXT,
    corrective_actions TEXT,
    preventive_actions TEXT,
    fda_reportable BOOLEAN NOT NULL,
    fda_report_number TEXT,
    fda_submission_date DATE,
    investigation_status TEXT DEFAULT 'open', -- open, closed, pending
    investigated_by TEXT,
    follow_up_required BOOLEAN DEFAULT FALSE,
    manufacturer_notified BOOLEAN DEFAULT FALSE
);

-- Risk Management (ISO 14971)
CREATE TABLE IF NOT EXISTS risk_assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    risk_id TEXT NOT NULL UNIQUE,
    hazard_description TEXT NOT NULL,
    hazardous_situation TEXT NOT NULL,
    harm_description TEXT NOT NULL,
    probability_before INTEGER NOT NULL, -- 1-5 scale
    severity_before INTEGER NOT NULL, -- 1-5 scale
    risk_score_before INTEGER GENERATED ALWAYS AS (probability_before * severity_before) STORED,
    risk_control_measures TEXT, -- JSON array of control measures
    probability_after INTEGER,
    severity_after INTEGER,
    risk_score_after INTEGER GENERATED ALWAYS AS (probability_after * severity_after) STORED,
    risk_acceptability TEXT, -- acceptable, unacceptable, alarp
    verification_activities TEXT,
    verification_status TEXT DEFAULT 'pending',
    risk_owner TEXT NOT NULL,
    review_date DATE,
    next_review_date DATE,
    risk_status TEXT DEFAULT 'active' -- active, closed, transferred
);

-- Cybersecurity and System Security
CREATE TABLE IF NOT EXISTS security_assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_date DATE NOT NULL,
    assessment_type TEXT NOT NULL, -- vulnerability_scan, penetration_test, security_review
    assessor TEXT NOT NULL,
    system_components TEXT, -- JSON array of assessed components
    vulnerabilities_found TEXT, -- JSON array of vulnerabilities
    security_controls TEXT, -- JSON array of implemented controls
    compliance_frameworks TEXT, -- JSON array: NIST, ISO27001, etc.
    overall_risk_rating TEXT NOT NULL, -- low, medium, high, critical
    remediation_plan TEXT,
    remediation_deadline DATE,
    assessment_report_path TEXT,
    next_assessment_date DATE,
    cybersecurity_compliant BOOLEAN DEFAULT TRUE
);

-- Training and Personnel Qualification
CREATE TABLE IF NOT EXISTS personnel_training (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    role TEXT NOT NULL, -- operator, supervisor, quality_manager
    training_type TEXT NOT NULL, -- initial, refresher, competency, clia_training
    training_topic TEXT NOT NULL,
    training_date DATE NOT NULL,
    trainer TEXT NOT NULL,
    training_duration_hours REAL,
    competency_assessment TEXT, -- JSON with assessment results
    assessment_score REAL,
    passing_score REAL,
    training_status TEXT NOT NULL, -- pass, fail, incomplete
    certification_expiry_date DATE,
    training_records_path TEXT,
    clia_compliant BOOLEAN DEFAULT TRUE
);

-- Proficiency Testing and External QA
CREATE TABLE IF NOT EXISTS proficiency_testing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pt_program TEXT NOT NULL, -- CAP, AACC, etc.
    pt_round TEXT NOT NULL,
    testing_date DATE NOT NULL,
    submission_date DATE NOT NULL,
    pathogen_targets TEXT, -- JSON array of pathogens tested
    sample_results TEXT, -- JSON with our results
    reference_results TEXT, -- JSON with reference results
    performance_score REAL,
    pass_fail_status TEXT NOT NULL,
    z_scores TEXT, -- JSON with z-scores per analyte
    corrective_actions TEXT,
    follow_up_required BOOLEAN DEFAULT FALSE,
    accreditation_impact TEXT, -- none, warning, suspension_risk
    next_pt_date DATE
);

-- Software Validation Documentation
CREATE TABLE IF NOT EXISTS validation_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_type TEXT NOT NULL, -- SRS, SDS, VVP, IQ, OQ, PQ, clinical_evaluation
    document_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    version TEXT NOT NULL,
    author TEXT NOT NULL,
    reviewer TEXT,
    approver TEXT,
    creation_date DATE NOT NULL,
    review_date DATE,
    approval_date DATE,
    effective_date DATE,
    expiry_date DATE,
    document_status TEXT DEFAULT 'draft', -- draft, review, approved, obsolete
    file_path TEXT,
    document_hash TEXT, -- For integrity verification
    change_summary TEXT,
    regulatory_impact TEXT,
    distribution_list TEXT -- JSON array of who has access
);

-- Post-Market Surveillance
CREATE TABLE IF NOT EXISTS post_market_surveillance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    surveillance_period_start DATE NOT NULL,
    surveillance_period_end DATE NOT NULL,
    total_analyses_performed INTEGER DEFAULT 0,
    software_malfunctions INTEGER DEFAULT 0,
    user_errors INTEGER DEFAULT 0,
    incorrect_results INTEGER DEFAULT 0,
    customer_complaints INTEGER DEFAULT 0,
    field_safety_notices INTEGER DEFAULT 0,
    software_updates_deployed INTEGER DEFAULT 0,
    trending_analysis TEXT, -- JSON with trend data
    risk_benefit_assessment TEXT,
    regulatory_actions_required TEXT,
    surveillance_report_path TEXT,
    submitted_to_fda BOOLEAN DEFAULT FALSE,
    submission_date DATE
);

-- Supplier and Third-Party Software Management
CREATE TABLE IF NOT EXISTS supplier_management (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_name TEXT NOT NULL,
    supplier_type TEXT NOT NULL, -- software_vendor, service_provider, component_supplier
    product_service TEXT NOT NULL,
    iso13485_certified BOOLEAN DEFAULT FALSE,
    fda_registered BOOLEAN DEFAULT FALSE,
    supplier_audit_date DATE,
    audit_score INTEGER, -- 1-100
    audit_findings TEXT,
    corrective_actions TEXT,
    risk_rating TEXT NOT NULL, -- low, medium, high
    contract_start_date DATE,
    contract_end_date DATE,
    performance_metrics TEXT, -- JSON with KPIs
    supplier_status TEXT DEFAULT 'active' -- active, suspended, terminated
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_software_versions_active ON software_versions(is_active, version_number);
CREATE INDEX IF NOT EXISTS idx_user_access_timestamp ON user_access_log(timestamp, user_id);
CREATE INDEX IF NOT EXISTS idx_qc_runs_date ON quality_control_runs(qc_date, test_type);
CREATE INDEX IF NOT EXISTS idx_validation_studies_status ON method_validation_studies(study_status, pathogen_target);
CREATE INDEX IF NOT EXISTS idx_instrument_next_qual ON instrument_qualification(next_qualification_date, compliance_status);
CREATE INDEX IF NOT EXISTS idx_adverse_events_severity ON adverse_events(severity, fda_reportable);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_score ON risk_assessments(risk_score_after, risk_status);
CREATE INDEX IF NOT EXISTS idx_security_risk_rating ON security_assessments(overall_risk_rating, next_assessment_date);
CREATE INDEX IF NOT EXISTS idx_training_expiry ON personnel_training(certification_expiry_date, employee_id);
CREATE INDEX IF NOT EXISTS idx_pt_performance ON proficiency_testing(pass_fail_status, testing_date);
CREATE INDEX IF NOT EXISTS idx_validation_docs_status ON validation_documents(document_status, document_type);
CREATE INDEX IF NOT EXISTS idx_surveillance_period ON post_market_surveillance(surveillance_period_end);

-- Insert initial data for software version tracking
INSERT OR IGNORE INTO software_versions (
    version_number, 
    change_description, 
    risk_assessment, 
    validation_status,
    approved_by,
    is_active
) VALUES (
    'v1.0.0', 
    'Initial FDA-compliant release with ML validation tracking', 
    'Medium - New ML validation features added',
    'validated',
    'system',
    TRUE
);
