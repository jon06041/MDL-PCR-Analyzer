-- ML Configuration Management Schema
-- This provides pathogen-specific ML controls and safe data management

CREATE TABLE IF NOT EXISTS ml_pathogen_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pathogen_code TEXT NOT NULL,           -- e.g., 'BVAB', 'BVPanelPCR3', 'Cglab'
    fluorophore TEXT,                      -- e.g., 'HEX', 'FAM', 'Cy5', 'Texas Red' (NULL = all channels)
    ml_enabled BOOLEAN DEFAULT 1,         -- Enable/disable ML for this pathogen
    training_locked BOOLEAN DEFAULT 0,    -- Lock training data from modification
    min_confidence REAL DEFAULT 0.7,      -- Minimum confidence threshold for ML predictions
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,                       -- Future: user ID who made changes
    
    -- Ensure unique pathogen+fluorophore combinations
    UNIQUE(pathogen_code, fluorophore)
);

CREATE TABLE IF NOT EXISTS ml_system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description TEXT,
    requires_admin BOOLEAN DEFAULT 0,     -- Future: requires admin role
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default system configurations
INSERT OR IGNORE INTO ml_system_config (config_key, config_value, description, requires_admin) VALUES
('ml_global_enabled', 'true', 'Global ML system enable/disable', 1),
('training_data_version', '2.0', 'Current training data format version', 0),
('min_training_examples', '10', 'Minimum examples required for training', 1),
('reset_protection_enabled', 'true', 'Require confirmation for data reset', 1),
('auto_training_enabled', 'true', 'Automatically retrain after feedback', 0);

-- Insert default pathogen configurations for known test types
INSERT OR IGNORE INTO ml_pathogen_config (pathogen_code, fluorophore, ml_enabled, min_confidence) VALUES
('BVAB', 'HEX', 1, 0.7),   -- BVAB1
('BVAB', 'FAM', 1, 0.7),   -- BVAB2  
('BVAB', 'Cy5', 1, 0.7),   -- BVAB3
('BVPanelPCR3', 'Texas Red', 1, 0.7),  -- Prevotella bivia
('BVPanelPCR3', 'HEX', 1, 0.7),        -- Lactobacillus acidophilus
('BVPanelPCR3', 'FAM', 1, 0.7),        -- Gardnerella vaginalis
('BVPanelPCR3', 'Cy5', 1, 0.7),        -- Bifidobacterium breve
('Cglab', 'FAM', 1, 0.7),   -- Candida glabrata
('Calb', 'HEX', 1, 0.7),    -- Candida albicans
('Ngon', 'HEX', 1, 0.7),    -- Neisseria gonhorrea
('Ctrach', 'FAM', 1, 0.7),  -- Chlamydia trachomatis
('Tvag', 'FAM', 1, 0.7),    -- Trichomonas vaginalis
('Mgen', 'FAM', 1, 0.7);    -- Mycoplasma genitalium

-- Create audit trail for sensitive operations
CREATE TABLE IF NOT EXISTS ml_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,                  -- 'reset_training_data', 'toggle_ml', 'update_config'
    pathogen_code TEXT,                    -- NULL for system-wide actions
    fluorophore TEXT,                      
    old_value TEXT,                        -- Previous state
    new_value TEXT,                        -- New state
    user_id TEXT,                          -- Future: actual user ID
    user_ip TEXT,                          -- Request IP for audit
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT                             -- Additional context
);
