#!/usr/bin/env python3
"""
Best-effort MySQL schema bootstrapper.

Purpose
- Ensure critical ML tables exist in production and add missing columns/fields safely.
- Avoid crashes if permissions are limited; log and continue.

Covers
- ml_expert_decisions: creates if missing; adds commonly referenced columns (is_correction, feedback_context, ml_prediction, expert_decision, feedback_timestamp, fluorophore, sample_name, expert_user, decision_reason, improvement_score, teaching_outcome).
- ml_prediction_tracking: creates if missing.
- ml_model_versions, ml_model_performance: delegates to initialize_mysql_tables if available.

Notes
- Uses MySQL 8.0 ADD COLUMN IF NOT EXISTS to be idempotent.
- Intended to be called once at Flask startup (best-effort; non-fatal on errors).
"""

import os
import sys
from typing import Optional


def _connect():
    try:
        import mysql.connector
        cfg = {
            'host': os.environ.get('MYSQL_HOST', '127.0.0.1'),
            'port': int(os.environ.get('MYSQL_PORT', 3306)),
            'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
            'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
            'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis'),
            'charset': 'utf8mb4'
        }
        return mysql.connector.connect(**cfg)
    except Exception as e:
        print(f"[SCHEMA] ❌ MySQL connect failed: {e}")
        return None


def _exec(cursor, sql: str, params: Optional[tuple] = None):
    try:
        cursor.execute(sql) if params is None else cursor.execute(sql, params)
        return True
    except Exception as e:
        print(f"[SCHEMA] ⚠️ SQL error for:\n{sql}\n→ {e}")
        return False


def ensure_ml_prediction_tracking(cursor):
    _exec(cursor, """
        CREATE TABLE IF NOT EXISTS ml_prediction_tracking (
            id INT AUTO_INCREMENT PRIMARY KEY,
            performance_id INT,
            well_id VARCHAR(255),
            sample_name VARCHAR(255),
            pathogen_code VARCHAR(50),
            fluorophore VARCHAR(20),
            ml_prediction VARCHAR(50),
            ml_confidence DECIMAL(5,4),
            final_classification VARCHAR(50),
            model_version_used VARCHAR(50),
            feature_data TEXT,
            prediction_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_expert_override BOOLEAN DEFAULT FALSE,
            is_correct_prediction BOOLEAN DEFAULT TRUE,
            INDEX idx_pathogen_timestamp (pathogen_code, prediction_timestamp),
            INDEX idx_well_pathogen (well_id, pathogen_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)


def ensure_ml_expert_decisions(cursor):
    # Base table
    _exec(cursor, """
        CREATE TABLE IF NOT EXISTS ml_expert_decisions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            session_id VARCHAR(100) NULL,
            well_id VARCHAR(50) NULL,
            sample_name VARCHAR(255) NULL,
            expert_user VARCHAR(100) NULL,
            user_id VARCHAR(100) NULL,
            pathogen VARCHAR(50) NULL,
            fluorophore VARCHAR(20) NULL,
            original_prediction VARCHAR(50) NULL,
            expert_correction VARCHAR(50) NULL,
            ml_prediction VARCHAR(50) NULL,
            expert_decision VARCHAR(50) NULL,
            confidence DECIMAL(5,4) NULL,
            ml_confidence DECIMAL(5,4) NULL,
            expert_confidence INT NULL,
            features_used TEXT NULL,
            feedback_context TEXT NULL,
            decision_reason TEXT NULL,
            teaching_outcome VARCHAR(50) NULL,
            improvement_score DECIMAL(5,4) DEFAULT 0.0,
            is_correction TINYINT(1) NULL,
            is_validated BOOLEAN DEFAULT FALSE,
            validation_date TIMESTAMP NULL,
            feedback_timestamp TIMESTAMP NULL,
            notes TEXT NULL,
            INDEX idx_timestamp_pathogen (timestamp, pathogen),
            INDEX idx_user_decisions (user_id, timestamp),
            INDEX idx_teaching_outcome (teaching_outcome, timestamp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)

    # Add newer fields if missing (MySQL 8+)
    for coldef in [
        "ADD COLUMN IF NOT EXISTS is_correction TINYINT(1) NULL",
        "ADD COLUMN IF NOT EXISTS feedback_context TEXT NULL",
        "ADD COLUMN IF NOT EXISTS ml_prediction VARCHAR(50) NULL",
        "ADD COLUMN IF NOT EXISTS expert_decision VARCHAR(50) NULL",
        "ADD COLUMN IF NOT EXISTS feedback_timestamp TIMESTAMP NULL",
        "ADD COLUMN IF NOT EXISTS fluorophore VARCHAR(20) NULL",
        "ADD COLUMN IF NOT EXISTS sample_name VARCHAR(255) NULL",
        "ADD COLUMN IF NOT EXISTS expert_user VARCHAR(100) NULL",
        "ADD COLUMN IF NOT EXISTS decision_reason TEXT NULL",
        "ADD COLUMN IF NOT EXISTS improvement_score DECIMAL(5,4) DEFAULT 0.0",
        "ADD COLUMN IF NOT EXISTS teaching_outcome VARCHAR(50) NULL",
    ]:
        _exec(cursor, f"ALTER TABLE ml_expert_decisions {coldef};")


def ensure_model_version_tables(cursor):
    # Keep consistent with initialize_mysql_tables.py but safe to re-run
    _exec(cursor, """
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
    """)

    _exec(cursor, """
        CREATE TABLE IF NOT EXISTS ml_model_performance (
            id INT AUTO_INCREMENT PRIMARY KEY,
            model_version_id INT NOT NULL,
            run_file_name VARCHAR(255) NOT NULL,
            session_id VARCHAR(100),
            total_predictions INT NOT NULL DEFAULT 0,
            correct_predictions INT NOT NULL DEFAULT 0,
            expert_overrides INT NOT NULL DEFAULT 0,
            accuracy_percentage DECIMAL(5,2) NULL,
            run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            pathogen_code VARCHAR(50),
            fluorophore VARCHAR(20),
            test_type VARCHAR(50),
            notes TEXT,
            INDEX idx_performance_pathogen (pathogen_code, fluorophore),
            INDEX idx_performance_date (run_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)


def ensure_mysql_schema(verbose: bool = False):
    conn = _connect()
    if not conn:
        return False
    try:
        cur = conn.cursor()
        if verbose:
            print("[SCHEMA] Ensuring MySQL schema for ML tables…")
        ensure_model_version_tables(cur)
        ensure_ml_prediction_tracking(cur)
        ensure_ml_expert_decisions(cur)
        try:
            conn.commit()
        except Exception:
            pass
        if verbose:
            print("[SCHEMA] ✅ Schema ensured")
        return True
    except Exception as e:
        print(f"[SCHEMA] ❌ Ensure failed: {e}")
        return False
    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    ok = ensure_mysql_schema(verbose=True)
    sys.exit(0 if ok else 1)
