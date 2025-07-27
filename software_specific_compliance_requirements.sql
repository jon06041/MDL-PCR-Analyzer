-- Enhanced Software-Specific Compliance Requirements
-- Focus on compliance requirements that can ONLY be satisfied by running this qPCR software
-- Auto-trackable requirements that demonstrate real software validation

-- Clear existing data to start fresh
DELETE FROM compliance_requirements;
DELETE FROM compliance_evidence;
DELETE FROM compliance_status_log;
DELETE FROM compliance_gaps;

-- Insert SOFTWARE-SPECIFIC compliance requirements only
INSERT OR IGNORE INTO compliance_requirements (
    requirement_code, regulation_source, section_number, requirement_title, 
    requirement_description, compliance_category, frequency, criticality_level,
    auto_trackable, tracking_method, evidence_required
) VALUES 

-- =============================================================================
-- ML MODEL VALIDATION & VERSIONING REQUIREMENTS
-- =============================================================================
('ML_MODEL_VALIDATION', 'SOFTWARE_VALIDATION', 'ML.001', 'ML Model Performance Validation', 
 'ML models must demonstrate consistent accuracy and be validated against expert decisions', 
 'ML_Validation', 'continuous', 'critical', TRUE, 'ml_prediction_tracking', 'Model accuracy metrics, expert feedback, performance trends'),

('ML_VERSION_CONTROL', 'SOFTWARE_VALIDATION', 'ML.002', 'ML Model Version Management', 
 'Software must track ML model versions, training data, and deployment history', 
 'ML_Validation', 'per_model_update', 'critical', TRUE, 'model_version_tracking', 'Model version history, training sample counts, deployment logs'),

('ML_PERFORMANCE_TRACKING', 'SOFTWARE_VALIDATION', 'ML.003', 'ML Performance Monitoring', 
 'Continuous monitoring of ML model performance with automated alerts for degradation', 
 'ML_Validation', 'continuous', 'critical', TRUE, 'performance_metrics_tracking', 'Real-time accuracy metrics, prediction confidence scores, expert override rates'),

('ML_EXPERT_VALIDATION', 'SOFTWARE_VALIDATION', 'ML.004', 'Expert Feedback Integration', 
 'System must capture and integrate expert feedback for continuous model improvement', 
 'ML_Validation', 'per_feedback', 'critical', TRUE, 'expert_feedback_tracking', 'Expert classifications, feedback timestamps, model learning outcomes'),

('ML_CONTINUOUS_LEARNING', 'SOFTWARE_VALIDATION', 'ML.005', 'Continuous Learning Validation', 
 'ML system must demonstrate learning from expert feedback and improving over time', 
 'ML_Validation', 'continuous', 'major', TRUE, 'learning_progression_tracking', 'Learning curves, accuracy improvements, training data growth'),

('ML_AUDIT_TRAIL', 'SOFTWARE_VALIDATION', 'ML.006', 'ML Decision Audit Trail', 
 'Complete audit trail of all ML predictions, expert decisions, and model changes', 
 'ML_Validation', 'continuous', 'critical', TRUE, 'ml_audit_logging', 'Prediction logs, decision rationale, model change history'),

-- =============================================================================
-- CORE qPCR ANALYSIS SOFTWARE VALIDATION
-- =============================================================================
('ANALYSIS_EXECUTION_TRACKING', 'SOFTWARE_VALIDATION', 'QPCR.001', 'Analysis Execution Validation', 
 'Software must track and validate proper execution of qPCR analysis procedures', 
 'Analysis_Validation', 'per_analysis', 'critical', TRUE, 'analysis_completion_logging', 'Analysis session logs, parameter validation, result generation'),

('ELECTRONIC_RECORDS_CREATION', 'SOFTWARE_VALIDATION', 'QPCR.002', 'Electronic Record Generation', 
 'Software must create complete, tamper-evident electronic records for all analyses', 
 'Data_Integrity', 'per_analysis', 'critical', TRUE, 'electronic_record_creation', 'Complete analysis records, data integrity checksums, audit trails'),

('ELECTRONIC_REPORT_GENERATION', 'SOFTWARE_VALIDATION', 'QPCR.003', 'Electronic Report Validation', 
 'Software must generate validated, compliant electronic reports with required elements', 
 'Reporting', 'per_report', 'critical', TRUE, 'report_generation_tracking', 'Report completeness validation, required element verification, format compliance'),

('SOFTWARE_CONFIGURATION_CONTROL', 'SOFTWARE_VALIDATION', 'QPCR.004', 'Configuration Change Control', 
 'Software must track and validate all configuration changes affecting analysis results', 
 'Configuration_Management', 'per_change', 'critical', TRUE, 'configuration_change_tracking', 'Configuration change logs, impact assessments, validation results'),

('ANALYSIS_PARAMETER_TRACKING', 'SOFTWARE_VALIDATION', 'QPCR.005', 'Analysis Parameter Validation', 
 'Software must track and validate all analysis parameters and threshold adjustments', 
 'Analysis_Validation', 'per_parameter_change', 'critical', TRUE, 'parameter_change_logging', 'Parameter change history, validation rationale, impact on results'),

('DATA_EXPORT_TRACKING', 'SOFTWARE_VALIDATION', 'QPCR.006', 'Data Export Validation', 
 'Software must track and validate all data exports maintaining data integrity', 
 'Data_Integrity', 'per_export', 'major', TRUE, 'export_operation_tracking', 'Export logs, data integrity verification, format validation'),

('AUDIT_TRAIL_GENERATION', 'SOFTWARE_VALIDATION', 'QPCR.007', 'Comprehensive Audit Trail', 
 'Software must generate complete audit trails for all user actions and system operations', 
 'Audit_Trail', 'continuous', 'critical', TRUE, 'comprehensive_audit_logging', 'User action logs, system operation logs, timestamp validation'),

-- =============================================================================
-- QUALITY CONTROL THROUGH SOFTWARE EXECUTION
-- =============================================================================
('QC_SOFTWARE_EXECUTION', 'SOFTWARE_VALIDATION', 'QC.001', 'QC Software Integration', 
 'Quality control procedures must be executed and tracked through the software', 
 'Quality_Control', 'per_qc_run', 'critical', TRUE, 'qc_execution_tracking', 'QC procedure completion, results within limits, trend analysis'),

('CONTROL_SAMPLE_TRACKING', 'SOFTWARE_VALIDATION', 'QC.002', 'Control Sample Validation', 
 'Software must track and validate control sample results against expected ranges', 
 'Quality_Control', 'per_control', 'critical', TRUE, 'control_sample_monitoring', 'Control sample results, range validation, trend monitoring'),

('CONTROL_SAMPLE_VALIDATION', 'SOFTWARE_VALIDATION', 'QC.003', 'Control Sample Performance', 
 'Software must validate control sample performance and flag out-of-range results', 
 'Quality_Control', 'per_control', 'critical', TRUE, 'control_performance_validation', 'Control performance metrics, range checking, alert generation'),

('NEGATIVE_CONTROL_TRACKING', 'SOFTWARE_VALIDATION', 'QC.004', 'Negative Control Monitoring', 
 'Software must track negative control results and detect contamination', 
 'Quality_Control', 'per_negative_control', 'critical', TRUE, 'negative_control_monitoring', 'Negative control results, contamination detection, alert systems'),

('POSITIVE_CONTROL_TRACKING', 'SOFTWARE_VALIDATION', 'QC.005', 'Positive Control Verification', 
 'Software must verify positive control performance within expected parameters', 
 'Quality_Control', 'per_positive_control', 'critical', TRUE, 'positive_control_verification', 'Positive control results, performance validation, trend analysis'),

-- =============================================================================
-- SYSTEM VALIDATION & SOFTWARE OPERATION
-- =============================================================================
('SOFTWARE_VALIDATION_EXECUTION', 'SOFTWARE_VALIDATION', 'SYS.001', 'Software Validation Performance', 
 'Software must demonstrate validated operation through systematic testing and validation', 
 'System_Validation', 'periodic', 'critical', TRUE, 'validation_test_execution', 'Validation test results, system performance metrics, compliance verification'),

('SYSTEM_PERFORMANCE_VERIFICATION', 'SOFTWARE_VALIDATION', 'SYS.002', 'System Performance Monitoring', 
 'Software must continuously monitor and verify system performance against specifications', 
 'System_Validation', 'continuous', 'major', TRUE, 'performance_monitoring', 'Performance metrics, response times, resource utilization, error rates'),

('SOFTWARE_FUNCTIONALITY_VALIDATION', 'SOFTWARE_VALIDATION', 'SYS.003', 'Feature Functionality Validation', 
 'Software must validate proper operation of all analytical features and functions', 
 'System_Validation', 'per_feature_use', 'major', TRUE, 'feature_usage_tracking', 'Feature usage logs, operation validation, error tracking'),

('USER_INTERACTION_TRACKING', 'SOFTWARE_VALIDATION', 'SYS.004', 'User Interaction Validation', 
 'Software must track and validate user interactions for proper system operation', 
 'System_Validation', 'continuous', 'major', TRUE, 'user_interaction_logging', 'User action logs, workflow completion, error handling'),

('CHANGE_CONTROL_TRACKING', 'SOFTWARE_VALIDATION', 'SYS.005', 'Change Control Implementation', 
 'Software must implement and track change control procedures for all modifications', 
 'Change_Control', 'per_change', 'critical', TRUE, 'change_control_logging', 'Change requests, approval workflows, implementation tracking, validation results'),

-- =============================================================================
-- USER TRAINING & COMPETENCY (SOFTWARE-SPECIFIC)
-- =============================================================================
('SOFTWARE_TRAINING_COMPLETION', 'SOFTWARE_VALIDATION', 'TRAIN.001', 'Software Training Tracking', 
 'Software must track completion of software-specific training and competency verification', 
 'Training', 'per_user', 'major', TRUE, 'training_completion_tracking', 'Training completion records, competency assessments, certification tracking'),

('USER_COMPETENCY_SOFTWARE', 'SOFTWARE_VALIDATION', 'TRAIN.002', 'Software Competency Validation', 
 'Software must validate user competency in software operation and analytical procedures', 
 'Training', 'periodic', 'major', TRUE, 'competency_validation_tracking', 'Competency test results, skill assessments, validation records'),

('SOFTWARE_TRAINING_TRACKING', 'SOFTWARE_VALIDATION', 'TRAIN.003', 'Training Progress Monitoring', 
 'Software must track training progress and identify training gaps', 
 'Training', 'continuous', 'major', TRUE, 'training_progress_monitoring', 'Training progress metrics, gap analysis, completion tracking'),

('COMPETENCY_VERIFICATION', 'SOFTWARE_VALIDATION', 'TRAIN.004', 'Competency Verification System', 
 'Software must verify and maintain records of user competency in software operation', 
 'Training', 'periodic', 'major', TRUE, 'competency_verification_system', 'Competency verification records, skill validation, certification maintenance'),

-- =============================================================================
-- SECURITY & ACCESS CONTROL (WHEN IMPLEMENTED)
-- =============================================================================
('ACCESS_CONTROL_SOFTWARE', 'SOFTWARE_VALIDATION', 'SEC.001', 'Software Access Control', 
 'Software must implement validated access control preventing unauthorized use', 
 'Security', 'continuous', 'critical', TRUE, 'access_control_monitoring', 'Access logs, authentication records, authorization tracking'),

('USER_AUTHENTICATION_TRACKING', 'SOFTWARE_VALIDATION', 'SEC.002', 'User Authentication Validation', 
 'Software must track and validate user authentication for all system access', 
 'Security', 'per_login', 'critical', TRUE, 'authentication_logging', 'Authentication attempts, success/failure logs, user session tracking'),

('SESSION_MANAGEMENT_SOFTWARE', 'SOFTWARE_VALIDATION', 'SEC.003', 'Session Management Validation', 
 'Software must implement secure session management with proper timeout controls', 
 'Security', 'per_session', 'critical', TRUE, 'session_management_tracking', 'Session creation/termination logs, timeout enforcement, security events'),

('ROLE_BASED_ACCESS_CONTROL', 'SOFTWARE_VALIDATION', 'SEC.004', 'Role-Based Access Control', 
 'Software must implement and validate role-based access control for different user types', 
 'Security', 'per_role_change', 'critical', TRUE, 'rbac_monitoring', 'Role assignments, permission changes, access control validation'),

('USER_PERMISSION_MANAGEMENT', 'SOFTWARE_VALIDATION', 'SEC.005', 'Permission Management System', 
 'Software must manage and track user permissions with proper validation', 
 'Security', 'per_permission_change', 'critical', TRUE, 'permission_tracking', 'Permission changes, access level modifications, validation records'),

('PERMISSION_AUDIT_TRAIL', 'SOFTWARE_VALIDATION', 'SEC.006', 'Permission Change Audit Trail', 
 'Software must maintain complete audit trail of all permission and access changes', 
 'Security', 'continuous', 'critical', TRUE, 'permission_audit_logging', 'Permission change history, approval records, audit trails'),

('ENCRYPTION_SOFTWARE_IMPLEMENTATION', 'SOFTWARE_VALIDATION', 'SEC.007', 'Data Encryption Implementation', 
 'Software must implement validated encryption for sensitive data protection', 
 'Security', 'continuous', 'critical', TRUE, 'encryption_monitoring', 'Encryption operations, key management, algorithm validation'),

('DATA_SECURITY_TRACKING', 'SOFTWARE_VALIDATION', 'SEC.008', 'Data Security Monitoring', 
 'Software must track and validate data security measures and encryption status', 
 'Security', 'continuous', 'critical', TRUE, 'security_status_monitoring', 'Encryption status, security events, vulnerability assessments'),

('ENCRYPTION_ALGORITHM_VALIDATION', 'SOFTWARE_VALIDATION', 'SEC.009', 'Encryption Algorithm Validation', 
 'Software must use validated encryption algorithms with proper implementation', 
 'Security', 'per_algorithm', 'critical', TRUE, 'algorithm_validation_tracking', 'Algorithm validation records, implementation testing, compliance verification'),

('CRYPTO_SOFTWARE_VALIDATION', 'SOFTWARE_VALIDATION', 'SEC.010', 'Cryptographic Software Validation', 
 'Software must validate all cryptographic functions and key management procedures', 
 'Security', 'periodic', 'critical', TRUE, 'crypto_validation_monitoring', 'Cryptographic testing results, key management validation, security assessments'),

('SECURITY_EVENT_TRACKING', 'SOFTWARE_VALIDATION', 'SEC.011', 'Security Event Monitoring', 
 'Software must track and respond to security events and potential threats', 
 'Security', 'continuous', 'critical', TRUE, 'security_event_logging', 'Security events, threat detection, incident response logs'),

('TIMEOUT_POLICY_ENFORCEMENT', 'SOFTWARE_VALIDATION', 'SEC.012', 'Timeout Policy Implementation', 
 'Software must enforce session timeout policies for security compliance', 
 'Security', 'continuous', 'major', TRUE, 'timeout_enforcement_tracking', 'Timeout events, policy enforcement, session security validation'),

('PASSWORD_POLICY_ENFORCEMENT', 'SOFTWARE_VALIDATION', 'SEC.013', 'Password Policy Validation', 
 'Software must enforce and validate password policies for user security', 
 'Security', 'per_password_change', 'major', TRUE, 'password_policy_tracking', 'Password policy compliance, change history, strength validation'),

('SECURITY_TRACKING', 'SOFTWARE_VALIDATION', 'SEC.014', 'Comprehensive Security Tracking', 
 'Software must track all security-related events and maintain security posture', 
 'Security', 'continuous', 'critical', TRUE, 'comprehensive_security_monitoring', 'Security metrics, threat assessments, compliance status'),

-- =============================================================================
-- DATA INTEGRITY & ELECTRONIC RECORDS
-- =============================================================================
('DATA_MODIFICATION_TRACKING', 'SOFTWARE_VALIDATION', 'DATA.001', 'Data Modification Audit Trail', 
 'Software must track all data modifications with complete audit trail', 
 'Data_Integrity', 'per_modification', 'critical', TRUE, 'data_change_logging', 'Data change logs, modification history, integrity verification'),

('FILE_INTEGRITY_TRACKING', 'SOFTWARE_VALIDATION', 'DATA.002', 'File Integrity Validation', 
 'Software must validate and track file integrity for all uploaded data', 
 'Data_Integrity', 'per_upload', 'critical', TRUE, 'file_integrity_monitoring', 'File checksums, integrity validation, corruption detection'),

('DATA_INPUT_VALIDATION', 'SOFTWARE_VALIDATION', 'DATA.003', 'Data Input Validation System', 
 'Software must validate all data inputs for format, range, and integrity', 
 'Data_Integrity', 'per_input', 'critical', TRUE, 'input_validation_tracking', 'Input validation results, error detection, data quality metrics'),

('CALCULATION_VALIDATION', 'SOFTWARE_VALIDATION', 'DATA.004', 'Calculation Algorithm Validation', 
 'Software must validate all calculations and mathematical operations', 
 'Data_Integrity', 'per_calculation', 'critical', TRUE, 'calculation_validation_tracking', 'Calculation verification, algorithm testing, result validation'),

('ALGORITHM_VERIFICATION', 'SOFTWARE_VALIDATION', 'DATA.005', 'Algorithm Performance Verification', 
 'Software must verify performance and accuracy of all analytical algorithms', 
 'Data_Integrity', 'periodic', 'critical', TRUE, 'algorithm_performance_monitoring', 'Algorithm performance metrics, accuracy validation, verification testing'),

('RESULT_VERIFICATION_TRACKING', 'SOFTWARE_VALIDATION', 'DATA.006', 'Result Verification System', 
 'Software must track verification of all analytical results and quality checks', 
 'Data_Integrity', 'per_result', 'critical', TRUE, 'result_verification_monitoring', 'Result verification logs, quality checks, validation status'),

('QUALITY_ASSURANCE_SOFTWARE', 'SOFTWARE_VALIDATION', 'DATA.007', 'Software Quality Assurance', 
 'Software must implement quality assurance measures for all operations', 
 'Data_Integrity', 'continuous', 'critical', TRUE, 'qa_monitoring', 'Quality metrics, error rates, process validation, compliance tracking');
