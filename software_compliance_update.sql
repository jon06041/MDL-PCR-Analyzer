-- Software-Specific Compliance Requirements (Compatible with existing schema)
-- Focus on compliance requirements that can ONLY be satisfied by running this qPCR software

-- Clear existing data to start fresh with software-specific requirements
DELETE FROM compliance_requirements;
DELETE FROM compliance_evidence;

-- Insert SOFTWARE-SPECIFIC compliance requirements only
INSERT OR REPLACE INTO compliance_requirements (
    requirement_code, requirement_title, requirement_description, 
    regulation_source, section_number, compliance_category, 
    criticality_level, frequency, auto_trackable, 
    tracking_method, evidence_required
) VALUES 

-- =============================================================================
-- ML MODEL VALIDATION & VERSIONING REQUIREMENTS
-- =============================================================================
('ML_MODEL_VALIDATION', 'ML Model Performance Validation', 
 'ML models must demonstrate consistent accuracy and be validated against expert decisions', 
 'SOFTWARE_VALIDATION', 'ML.001', 'ML_Validation', 'critical', 'continuous', 1,
 'ml_prediction_tracking', 'Model accuracy metrics, expert feedback, performance trends'),

('ML_VERSION_CONTROL', 'ML Model Version Management', 
 'Software must track ML model versions, training data, and deployment history', 
 'SOFTWARE_VALIDATION', 'ML.002', 'ML_Validation', 'critical', 'per_model_update', 1,
 'model_version_tracking', 'Model version history, training sample counts, deployment logs'),

('ML_PERFORMANCE_TRACKING', 'ML Performance Monitoring', 
 'Continuous monitoring of ML model performance with automated alerts for degradation', 
 'SOFTWARE_VALIDATION', 'ML.003', 'ML_Validation', 'critical', 'continuous', 1,
 'performance_metrics_tracking', 'Real-time accuracy metrics, prediction confidence scores, expert override rates'),

('ML_EXPERT_VALIDATION', 'Expert Feedback Integration', 
 'System must capture and integrate expert feedback for continuous model improvement', 
 'SOFTWARE_VALIDATION', 'ML.004', 'ML_Validation', 'critical', 'per_feedback', 1,
 'expert_feedback_tracking', 'Expert classifications, feedback timestamps, model learning outcomes'),

('ML_AUDIT_TRAIL', 'ML Decision Audit Trail', 
 'Complete audit trail of all ML predictions, expert decisions, and model changes', 
 'SOFTWARE_VALIDATION', 'ML.006', 'ML_Validation', 'critical', 'continuous', 1,
 'ml_audit_logging', 'Prediction logs, decision rationale, model change history'),

-- =============================================================================
-- CORE qPCR ANALYSIS SOFTWARE VALIDATION
-- =============================================================================
('ANALYSIS_EXECUTION_TRACKING', 'Analysis Execution Validation', 
 'Software must track and validate proper execution of qPCR analysis procedures', 
 'SOFTWARE_VALIDATION', 'QPCR.001', 'Analysis_Validation', 'critical', 'per_analysis', 1,
 'analysis_completion_logging', 'Analysis session logs, parameter validation, result generation'),

('ELECTRONIC_RECORDS_CREATION', 'Electronic Record Generation', 
 'Software must create complete, tamper-evident electronic records for all analyses', 
 'SOFTWARE_VALIDATION', 'QPCR.002', 'Data_Integrity', 'critical', 'per_analysis', 1,
 'electronic_record_creation', 'Complete analysis records, data integrity checksums, audit trails'),

('ELECTRONIC_REPORT_GENERATION', 'Electronic Report Validation', 
 'Software must generate validated, compliant electronic reports with required elements', 
 'SOFTWARE_VALIDATION', 'QPCR.003', 'Reporting', 'critical', 'per_report', 1,
 'report_generation_tracking', 'Report completeness validation, required element verification, format compliance'),

('SOFTWARE_CONFIGURATION_CONTROL', 'Configuration Change Control', 
 'Software must track and validate all configuration changes affecting analysis results', 
 'SOFTWARE_VALIDATION', 'QPCR.004', 'Configuration_Management', 'critical', 'per_change', 1,
 'configuration_change_tracking', 'Configuration change logs, impact assessments, validation results'),

('ANALYSIS_PARAMETER_TRACKING', 'Analysis Parameter Validation', 
 'Software must track and validate all analysis parameters and threshold adjustments', 
 'SOFTWARE_VALIDATION', 'QPCR.005', 'Analysis_Validation', 'critical', 'per_parameter_change', 1,
 'parameter_change_logging', 'Parameter change history, validation rationale, impact on results'),

('DATA_EXPORT_TRACKING', 'Data Export Validation', 
 'Software must track and validate all data exports maintaining data integrity', 
 'SOFTWARE_VALIDATION', 'QPCR.006', 'Data_Integrity', 'major', 'per_export', 1,
 'export_operation_tracking', 'Export logs, data integrity verification, format validation'),

('AUDIT_TRAIL_GENERATION', 'Comprehensive Audit Trail', 
 'Software must generate complete audit trails for all user actions and system operations', 
 'SOFTWARE_VALIDATION', 'QPCR.007', 'Audit_Trail', 'critical', 'continuous', 1,
 'comprehensive_audit_logging', 'User action logs, system operation logs, timestamp validation'),

-- =============================================================================
-- QUALITY CONTROL THROUGH SOFTWARE EXECUTION
-- =============================================================================
('QC_SOFTWARE_EXECUTION', 'QC Software Integration', 
 'Quality control procedures must be executed and tracked through the software', 
 'SOFTWARE_VALIDATION', 'QC.001', 'Quality_Control', 'critical', 'per_qc_run', 1,
 'qc_execution_tracking', 'QC procedure completion, results within limits, trend analysis'),

('CONTROL_SAMPLE_TRACKING', 'Control Sample Validation', 
 'Software must track and validate control sample results against expected ranges', 
 'SOFTWARE_VALIDATION', 'QC.002', 'Quality_Control', 'critical', 'per_control', 1,
 'control_sample_monitoring', 'Control sample results, range validation, trend monitoring'),

('NEGATIVE_CONTROL_TRACKING', 'Negative Control Monitoring', 
 'Software must track negative control results and detect contamination', 
 'SOFTWARE_VALIDATION', 'QC.004', 'Quality_Control', 'critical', 'per_negative_control', 1,
 'negative_control_monitoring', 'Negative control results, contamination detection, alert systems'),

('POSITIVE_CONTROL_TRACKING', 'Positive Control Verification', 
 'Software must verify positive control performance within expected parameters', 
 'SOFTWARE_VALIDATION', 'QC.005', 'Quality_Control', 'critical', 'per_positive_control', 1,
 'positive_control_verification', 'Positive control results, performance validation, trend analysis'),

-- =============================================================================
-- SYSTEM VALIDATION & SOFTWARE OPERATION
-- =============================================================================
('SOFTWARE_VALIDATION_EXECUTION', 'Software Validation Performance', 
 'Software must demonstrate validated operation through systematic testing and validation', 
 'SOFTWARE_VALIDATION', 'SYS.001', 'System_Validation', 'critical', 'periodic', 1,
 'validation_test_execution', 'Validation test results, system performance metrics, compliance verification'),

('SYSTEM_PERFORMANCE_VERIFICATION', 'System Performance Monitoring', 
 'Software must continuously monitor and verify system performance against specifications', 
 'SOFTWARE_VALIDATION', 'SYS.002', 'System_Validation', 'major', 'continuous', 1,
 'performance_monitoring', 'Performance metrics, response times, resource utilization, error rates'),

('SOFTWARE_FUNCTIONALITY_VALIDATION', 'Feature Functionality Validation', 
 'Software must validate proper operation of all analytical features and functions', 
 'SOFTWARE_VALIDATION', 'SYS.003', 'System_Validation', 'major', 'per_feature_use', 1,
 'feature_usage_tracking', 'Feature usage logs, operation validation, error tracking'),

('USER_INTERACTION_TRACKING', 'User Interaction Validation', 
 'Software must track and validate user interactions for proper system operation', 
 'SOFTWARE_VALIDATION', 'SYS.004', 'System_Validation', 'major', 'continuous', 1,
 'user_interaction_logging', 'User action logs, workflow completion, error handling'),

-- =============================================================================
-- USER TRAINING & COMPETENCY (SOFTWARE-SPECIFIC)
-- =============================================================================
('SOFTWARE_TRAINING_COMPLETION', 'Software Training Tracking', 
 'Software must track completion of software-specific training and competency verification', 
 'SOFTWARE_VALIDATION', 'TRAIN.001', 'Training', 'major', 'per_user', 1,
 'training_completion_tracking', 'Training completion records, competency assessments, certification tracking'),

('USER_COMPETENCY_SOFTWARE', 'Software Competency Validation', 
 'Software must validate user competency in software operation and analytical procedures', 
 'SOFTWARE_VALIDATION', 'TRAIN.002', 'Training', 'major', 'periodic', 1,
 'competency_validation_tracking', 'Competency test results, skill assessments, validation records'),

-- =============================================================================
-- SECURITY & ACCESS CONTROL (FUTURE IMPLEMENTATION)
-- =============================================================================
('ACCESS_CONTROL_SOFTWARE', 'Software Access Control', 
 'Software must implement validated access control preventing unauthorized use', 
 'SOFTWARE_VALIDATION', 'SEC.001', 'Security', 'critical', 'continuous', 1,
 'access_control_monitoring', 'Access logs, authentication records, authorization tracking'),

('USER_AUTHENTICATION_TRACKING', 'User Authentication Validation', 
 'Software must track and validate user authentication for all system access', 
 'SOFTWARE_VALIDATION', 'SEC.002', 'Security', 'critical', 'per_login', 1,
 'authentication_logging', 'Authentication attempts, success/failure logs, user session tracking'),

('SESSION_MANAGEMENT_SOFTWARE', 'Session Management Validation', 
 'Software must implement secure session management with proper timeout controls', 
 'SOFTWARE_VALIDATION', 'SEC.003', 'Security', 'critical', 'per_session', 1,
 'session_management_tracking', 'Session creation/termination logs, timeout enforcement, security events'),

('ROLE_BASED_ACCESS_CONTROL', 'Role-Based Access Control', 
 'Software must implement and validate role-based access control for different user types', 
 'SOFTWARE_VALIDATION', 'SEC.004', 'Security', 'critical', 'per_role_change', 1,
 'rbac_monitoring', 'Role assignments, permission changes, access control validation'),

('ENCRYPTION_SOFTWARE_IMPLEMENTATION', 'Data Encryption Implementation', 
 'Software must implement validated encryption for sensitive data protection', 
 'SOFTWARE_VALIDATION', 'SEC.007', 'Security', 'critical', 'continuous', 1,
 'encryption_monitoring', 'Encryption operations, key management, algorithm validation'),

-- =============================================================================
-- DATA INTEGRITY & ELECTRONIC RECORDS
-- =============================================================================
('DATA_MODIFICATION_TRACKING', 'Data Modification Audit Trail', 
 'Software must track all data modifications with complete audit trail', 
 'SOFTWARE_VALIDATION', 'DATA.001', 'Data_Integrity', 'critical', 'per_modification', 1,
 'data_change_logging', 'Data change logs, modification history, integrity verification'),

('FILE_INTEGRITY_TRACKING', 'File Integrity Validation', 
 'Software must validate and track file integrity for all uploaded data', 
 'SOFTWARE_VALIDATION', 'DATA.002', 'Data_Integrity', 'critical', 'per_upload', 1,
 'file_integrity_monitoring', 'File checksums, integrity validation, corruption detection'),

('DATA_INPUT_VALIDATION', 'Data Input Validation System', 
 'Software must validate all data inputs for format, range, and integrity', 
 'SOFTWARE_VALIDATION', 'DATA.003', 'Data_Integrity', 'critical', 'per_input', 1,
 'input_validation_tracking', 'Input validation results, error detection, data quality metrics'),

('CALCULATION_VALIDATION', 'Calculation Algorithm Validation', 
 'Software must validate all calculations and mathematical operations', 
 'SOFTWARE_VALIDATION', 'DATA.004', 'Data_Integrity', 'critical', 'per_calculation', 1,
 'calculation_validation_tracking', 'Calculation verification, algorithm testing, result validation'),

('RESULT_VERIFICATION_TRACKING', 'Result Verification System', 
 'Software must track verification of all analytical results and quality checks', 
 'SOFTWARE_VALIDATION', 'DATA.006', 'Data_Integrity', 'critical', 'per_result', 1,
 'result_verification_monitoring', 'Result verification logs, quality checks, validation status');

-- Create some sample compliance evidence to demonstrate tracking
INSERT OR REPLACE INTO compliance_evidence (
    requirement_code, evidence_type, evidence_source, evidence_data, 
    user_id, compliance_score, timestamp
) VALUES 
('ML_MODEL_VALIDATION', 'automated_log', 'system_event_ML_PREDICTION_MADE', 
 '{"prediction_accuracy": 0.95, "expert_feedback": "correct", "model_version": "v1.2", "confidence": 0.88}', 
 'system', 95, datetime('now', '-1 hour')),

('ANALYSIS_EXECUTION_TRACKING', 'automated_log', 'system_event_ANALYSIS_COMPLETED', 
 '{"session_id": "12345", "analysis_type": "qPCR", "samples_processed": 96, "completion_status": "success"}', 
 'user', 100, datetime('now', '-2 hours')),

('QC_SOFTWARE_EXECUTION', 'automated_log', 'system_event_QC_ANALYZED', 
 '{"qc_type": "positive_control", "result": "within_range", "expected_ct": 25.5, "actual_ct": 25.8}', 
 'user', 90, datetime('now', '-3 hours'));
