#!/usr/bin/env python3
"""
Initialize missing MySQL tables for ML validation and expert decisions
This script creates the tables that the dashboard is looking for.
"""

import os
import pymysql
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_mysql_connection():
    """Get MySQL connection using environment variables"""
    mysql_host = os.environ.get("MYSQL_HOST", "127.0.0.1")
    mysql_port = int(os.environ.get("MYSQL_PORT", "3306"))
    mysql_user = os.environ.get("MYSQL_USER", "qpcr_user")
    mysql_password = os.environ.get("MYSQL_PASSWORD", "qpcr_password")
    mysql_database = os.environ.get("MYSQL_DATABASE", "qpcr_analysis")
    
    return pymysql.connect(
        host=mysql_host,
        port=mysql_port,
        user=mysql_user,
        password=mysql_password,
        database=mysql_database,
        charset='utf8mb4',
        autocommit=True
    )

def create_ml_prediction_tracking_table(connection):
    """Create ml_prediction_tracking table"""
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS ml_prediction_tracking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        performance_id INT,
        well_id VARCHAR(10) NOT NULL,
        sample_name VARCHAR(255),
        pathogen_code VARCHAR(50),
        fluorophore VARCHAR(20),
        ml_prediction VARCHAR(50) NOT NULL,
        ml_confidence DECIMAL(5,4),
        expert_decision VARCHAR(50),
        final_classification VARCHAR(50) NOT NULL,
        is_expert_override BOOLEAN DEFAULT FALSE,
        is_correct_prediction BOOLEAN DEFAULT TRUE,
        prediction_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        model_version_used VARCHAR(50),
        feature_data TEXT,
        notes TEXT,
        INDEX idx_pathogen_timestamp (pathogen_code, prediction_timestamp),
        INDEX idx_well_pathogen (well_id, pathogen_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    
    with connection.cursor() as cursor:
        cursor.execute(create_table_sql)
        print("✅ Created ml_prediction_tracking table")

def create_ml_expert_decisions_table(connection):
    """Create ml_expert_decisions table with improvement_score column"""
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS ml_expert_decisions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(100),
        expert_user VARCHAR(100),
        pathogen VARCHAR(50),
        fluorophore VARCHAR(20),
        original_prediction VARCHAR(50),
        expert_correction VARCHAR(50),
        ml_confidence DECIMAL(5,4),
        expert_confidence INT,
        improvement_score DECIMAL(5,4) DEFAULT 0.0,
        teaching_outcome VARCHAR(50) DEFAULT 'correction',
        decision_reason TEXT,
        user_id VARCHAR(100),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        well_id VARCHAR(10),
        sample_name VARCHAR(255),
        is_validated BOOLEAN DEFAULT FALSE,
        validation_date TIMESTAMP NULL,
        notes TEXT,
        INDEX idx_timestamp_pathogen (timestamp, pathogen),
        INDEX idx_user_decisions (user_id, timestamp),
        INDEX idx_teaching_outcome (teaching_outcome, timestamp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    
    with connection.cursor() as cursor:
        cursor.execute(create_table_sql)
        print("✅ Created ml_expert_decisions table with improvement_score column")

def create_ml_model_versions_table(connection):
    """Create ml_model_versions table"""
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS ml_model_versions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        model_type VARCHAR(50) NOT NULL,
        pathogen_code VARCHAR(50),
        fluorophore VARCHAR(20),
        version_number VARCHAR(20) NOT NULL,
        model_file_path VARCHAR(500),
        training_samples_count INT NOT NULL DEFAULT 0,
        creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        performance_notes TEXT,
        trained_by VARCHAR(100),
        UNIQUE KEY unique_model_version (model_type, pathogen_code, fluorophore, version_number),
        INDEX idx_active_models (model_type, pathogen_code, is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    
    with connection.cursor() as cursor:
        cursor.execute(create_table_sql)
        print("✅ Created ml_model_versions table")

def create_ml_model_performance_table(connection):
    """Create ml_model_performance table"""
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS ml_model_performance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        model_version_id INT NOT NULL,
        run_file_name VARCHAR(255) NOT NULL,
        session_id VARCHAR(100),
        total_predictions INT NOT NULL DEFAULT 0,
        correct_predictions INT NOT NULL DEFAULT 0,
        expert_overrides INT NOT NULL DEFAULT 0,
        accuracy_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
            CASE 
                WHEN total_predictions > 0 THEN 
                    (correct_predictions / total_predictions) * 100 
                ELSE 0 
            END
        ) STORED,
        run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        pathogen_code VARCHAR(50),
        fluorophore VARCHAR(20),
        test_type VARCHAR(50),
        notes TEXT,
        FOREIGN KEY (model_version_id) REFERENCES ml_model_versions(id),
        INDEX idx_performance_pathogen (pathogen_code, fluorophore),
        INDEX idx_performance_date (run_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    
    with connection.cursor() as cursor:
        cursor.execute(create_table_sql)
        print("✅ Created ml_model_performance table")

def insert_initial_data(connection):
    """Insert initial model version data"""
    insert_sql = """
    INSERT IGNORE INTO ml_model_versions (
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
    """
    
    with connection.cursor() as cursor:
        try:
            cursor.execute(insert_sql)
            print("✅ Inserted initial model version data")
        except Exception as e:
            print(f"⚠️  Initial data insert skipped: {e}")
            print("🔧 This is likely because existing data conflicts - tables are ready")

def main():
    """Initialize all MySQL tables for ML validation"""
    print("🚀 Initializing MySQL tables for ML validation...")
    
    try:
        # Connect to MySQL
        connection = get_mysql_connection()
        print("✅ Connected to MySQL database")
        
        # Create all required tables
        create_ml_model_versions_table(connection)
        create_ml_model_performance_table(connection)
        create_ml_prediction_tracking_table(connection)
        create_ml_expert_decisions_table(connection)
        
        # Insert initial data
        insert_initial_data(connection)
        
        # Close connection
        connection.close()
        print("✅ All MySQL tables initialized successfully!")
        print("🎉 The dashboard should now work without table errors")
        
    except Exception as e:
        print(f"❌ Error initializing MySQL tables: {e}")
        print("💡 Check your MySQL connection and credentials")
        raise

if __name__ == "__main__":
    main()
