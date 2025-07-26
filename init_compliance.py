#!/usr/bin/env python3
"""
Initialize the compliance database schema and sample data
"""

import sqlite3
import json
from unified_compliance_manager import UnifiedComplianceManager

def initialize_compliance_schema():
    """Initialize the full compliance schema with sample requirements"""
    
    # Connect to database
    conn = sqlite3.connect('qpcr_analysis.db', timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    
    print("Creating compliance schema...")
    
    # Create compliance_requirements table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS compliance_requirements (
            requirement_code TEXT PRIMARY KEY,
            requirement_title TEXT NOT NULL,
            requirement_description TEXT,
            regulation_source TEXT NOT NULL,
            section_number TEXT,
            compliance_category TEXT NOT NULL,
            criticality_level TEXT NOT NULL DEFAULT 'medium',
            frequency TEXT NOT NULL DEFAULT 'monthly',
            compliance_status TEXT NOT NULL DEFAULT 'unknown',
            auto_trackable BOOLEAN NOT NULL DEFAULT 1,
            created_date DATE DEFAULT CURRENT_DATE,
            last_assessed_date DATE,
            next_assessment_date DATE,
            assigned_to TEXT,
            tags TEXT
        )
    """)
    
    # Create other necessary tables
    conn.execute("""
        CREATE TABLE IF NOT EXISTS compliance_evidence (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requirement_code TEXT NOT NULL,
            evidence_type TEXT NOT NULL,
            evidence_source TEXT NOT NULL,
            evidence_data TEXT NOT NULL,
            user_id TEXT NOT NULL,
            compliance_score INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (requirement_code) REFERENCES compliance_requirements(requirement_code)
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS compliance_gaps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requirement_code TEXT NOT NULL,
            gap_description TEXT NOT NULL,
            gap_severity TEXT NOT NULL,
            identified_date DATE NOT NULL,
            target_resolution_date DATE,
            assigned_to TEXT,
            status TEXT DEFAULT 'open',
            FOREIGN KEY (requirement_code) REFERENCES compliance_requirements(requirement_code)
        )
    """)
    
    # Insert sample auto-trackable requirements
    sample_requirements = [
        {
            'requirement_code': 'FDA_820.30_ANALYSIS',
            'requirement_title': 'qPCR Analysis Documentation',
            'requirement_description': 'Document all qPCR analysis procedures and results',
            'regulation_source': 'FDA_21CFR_820',
            'section_number': '820.30',
            'compliance_category': 'quality_control',
            'criticality_level': 'critical',
            'frequency': 'per_test',
            'auto_trackable': 1
        },
        {
            'requirement_code': 'FDA_11.10_QPCR_RECORDS',
            'requirement_title': 'Electronic qPCR Records',
            'requirement_description': 'Maintain electronic records of qPCR test data',
            'regulation_source': 'FDA_21CFR_11',
            'section_number': '11.10',
            'compliance_category': 'electronic_records',
            'criticality_level': 'critical',
            'frequency': 'continuous',
            'auto_trackable': 1
        },
        {
            'requirement_code': 'CLIA_493.1105_QPCR',
            'requirement_title': 'qPCR Quality Control',
            'requirement_description': 'Perform quality control testing for qPCR assays',
            'regulation_source': 'CLIA_42CFR_493',
            'section_number': '493.1105',
            'compliance_category': 'quality_control',
            'criticality_level': 'critical',
            'frequency': 'daily',
            'auto_trackable': 1
        },
        {
            'requirement_code': 'FDA_820.70_THRESHOLD_CONTROLS',
            'requirement_title': 'Threshold Control Validation',
            'requirement_description': 'Validate and document threshold adjustments',
            'regulation_source': 'FDA_21CFR_820',
            'section_number': '820.70',
            'compliance_category': 'validation',
            'criticality_level': 'major',
            'frequency': 'per_change',
            'auto_trackable': 1
        },
        {
            'requirement_code': 'SOFTWARE_CHANGE_CONTROL',
            'requirement_title': 'Software Change Control',
            'requirement_description': 'Document and validate software changes',
            'regulation_source': 'FDA_21CFR_820',
            'section_number': '820.70',
            'compliance_category': 'change_control',
            'criticality_level': 'major',
            'frequency': 'per_change',
            'auto_trackable': 1
        }
    ]
    
    for req in sample_requirements:
        conn.execute("""
            INSERT OR REPLACE INTO compliance_requirements 
            (requirement_code, requirement_title, requirement_description, 
             regulation_source, section_number, compliance_category, 
             criticality_level, frequency, auto_trackable)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            req['requirement_code'], req['requirement_title'], req['requirement_description'],
            req['regulation_source'], req['section_number'], req['compliance_category'],
            req['criticality_level'], req['frequency'], req['auto_trackable']
        ))
    
    conn.commit()
    conn.close()
    
    print(f"Compliance schema initialized with {len(sample_requirements)} auto-trackable requirements")

if __name__ == '__main__':
    initialize_compliance_schema()
    
    # Test the compliance manager
    print("Testing compliance manager...")
    cm = UnifiedComplianceManager()
    
    # Test dashboard data
    dashboard_data = cm.get_dashboard_data()
    print(f"Dashboard data: {len(dashboard_data.get('status_summary', {}))} status categories")
    
    # Test requirements
    requirements = cm.get_requirements()
    print(f"Found {len(requirements)} compliance requirements")
    
    print("Compliance system initialization complete!")
