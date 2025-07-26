-- ML Model Validation Tracking Schema for FDA Compliance
-- This schema tracks model performance, versioning, and expert overrides

-- Model Versions Table
CREATE TABLE IF NOT EXISTS ml_model_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_type TEXT NOT NULL, -- 'general_pcr', 'pathogen_specific'
    pathogen_code TEXT, -- NULL for general PCR model, specific pathogen for pathogen-specific
    fluorophore TEXT, -- Channel (FAM, HEX, etc.)
    version_number TEXT NOT NULL, -- e.g., 'v1.0', 'v1.1', 'v2.0'
    model_file_path TEXT, -- Path to the actual model file
    training_samples_count INTEGER NOT NULL DEFAULT 0,
    creation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE, -- Only one active version per model type/pathogen combo
    performance_notes TEXT,
    trained_by TEXT, -- User who triggered the training
    UNIQUE(model_type, pathogen_code, fluorophore, version_number)
);

-- Model Performance Tracking Table
CREATE TABLE IF NOT EXISTS ml_model_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_version_id INTEGER NOT NULL,
    run_file_name TEXT NOT NULL, -- Name of the qPCR run file
    session_id TEXT, -- Link to analysis session
    total_predictions INTEGER NOT NULL DEFAULT 0,
    correct_predictions INTEGER NOT NULL DEFAULT 0,
    expert_overrides INTEGER NOT NULL DEFAULT 0, -- Number of expert corrections
    accuracy_percentage REAL GENERATED ALWAYS AS (
        CASE 
            WHEN total_predictions > 0 THEN 
                (CAST(correct_predictions AS REAL) / total_predictions) * 100 
            ELSE 0 
        END
    ) STORED,
    run_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    pathogen_code TEXT, -- For easy filtering
    fluorophore TEXT,
    test_type TEXT, -- e.g., 'BVAB', 'Cglab', etc.
    notes TEXT,
    FOREIGN KEY (model_version_id) REFERENCES ml_model_versions(id)
);

-- Individual Prediction Tracking
CREATE TABLE IF NOT EXISTS ml_prediction_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    performance_id INTEGER NOT NULL,
    well_id TEXT NOT NULL, -- e.g., 'A1', 'B2'
    sample_name TEXT,
    pathogen_code TEXT,
    fluorophore TEXT,
    ml_prediction TEXT NOT NULL, -- Original ML prediction
    ml_confidence REAL, -- Confidence score
    expert_decision TEXT, -- Expert override classification (if any)
    final_classification TEXT NOT NULL, -- Final accepted classification
    is_expert_override BOOLEAN DEFAULT FALSE,
    is_correct_prediction BOOLEAN DEFAULT TRUE, -- Whether ML was correct
    prediction_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    model_version_used TEXT,
    feature_data TEXT, -- JSON of features used for prediction
    notes TEXT,
    FOREIGN KEY (performance_id) REFERENCES ml_model_performance(id)
);

-- Expert Review Sessions
CREATE TABLE IF NOT EXISTS expert_review_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    expert_user TEXT, -- Will be used for role-based access later
    review_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_samples_reviewed INTEGER DEFAULT 0,
    total_overrides INTEGER DEFAULT 0,
    confirmed_correct INTEGER DEFAULT 0, -- ML predictions confirmed as correct
    session_notes TEXT,
    is_validated BOOLEAN DEFAULT FALSE, -- For FDA validation workflow
    validation_date DATETIME,
    validated_by TEXT
);

-- Model Training History
CREATE TABLE IF NOT EXISTS ml_training_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_version_id INTEGER NOT NULL,
    training_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    training_samples_count INTEGER NOT NULL,
    pathogen_code TEXT,
    fluorophore TEXT,
    training_trigger TEXT, -- 'manual', 'milestone', 'feedback'
    training_data_summary TEXT, -- JSON summary of training data
    model_metrics TEXT, -- JSON of training metrics (accuracy, etc.)
    previous_version TEXT,
    improvement_notes TEXT,
    FOREIGN KEY (model_version_id) REFERENCES ml_model_versions(id)
);

-- FDA Compliance Audit Log
CREATE TABLE IF NOT EXISTS fda_compliance_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL, -- 'model_training', 'expert_override', 'validation', 'performance_review'
    event_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    model_version TEXT,
    pathogen_code TEXT,
    session_id TEXT,
    event_data TEXT, -- JSON with event details
    compliance_notes TEXT,
    regulatory_impact TEXT -- 'low', 'medium', 'high'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_model_performance_pathogen ON ml_model_performance(pathogen_code, fluorophore);
CREATE INDEX IF NOT EXISTS idx_model_performance_date ON ml_model_performance(run_date);
CREATE INDEX IF NOT EXISTS idx_prediction_tracking_well ON ml_prediction_tracking(well_id, pathogen_code);
CREATE INDEX IF NOT EXISTS idx_model_versions_active ON ml_model_versions(model_type, pathogen_code, is_active);
CREATE INDEX IF NOT EXISTS idx_expert_sessions_date ON expert_review_sessions(review_date);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON fda_compliance_audit(event_timestamp);

-- Initial data for general PCR model
INSERT OR IGNORE INTO ml_model_versions (
    model_type, 
    pathogen_code, 
    fluorophore, 
    version_number, 
    training_samples_count, 
    performance_notes,
    trained_by
) VALUES (
    'general_pcr', 
    NULL, 
    'ALL', 
    'v1.0', 
    0, 
    'Initial general PCR classification model',
    'system'
);
