#!/usr/bin/env python3
"""
Restore realistic compliance requirements - 48 auto-trackable requirements
Based on the working 77.1% compliance system, focusing only on what can actually be tracked
"""

import sqlite3
from datetime import datetime
import sys
import os

def restore_realistic_compliance_requirements():
    """Restore exactly 48 auto-trackable compliance requirements"""
    
    print("🔄 Restoring 48 realistic auto-trackable compliance requirements...")
    
    db_path = '/workspaces/MDL-PCR-Analyzer/qpcr_analysis.db'
    
    # 48 requirements that can actually be auto-tracked by the current system
    # 37 critical + 11 non-critical
    all_requirements = [
        # CRITICAL REQUIREMENTS (37) - Core functionality that can be tracked
        
        # ML Model Validation & Versioning (7 critical)
        ('ML_MODEL_VALIDATION', 'critical'),
        ('ML_VERSION_CONTROL', 'critical'), 
        ('ML_PERFORMANCE_TRACKING', 'critical'),
        ('ML_AUDIT_TRAIL', 'critical'),
        ('ML_EXPERT_VALIDATION', 'critical'),
        ('ML_CONTINUOUS_LEARNING', 'critical'),
        ('ML_PERFORMANCE_VALIDATION', 'critical'),
        
        # Core qPCR Analysis Activities (8 critical)
        ('ANALYSIS_EXECUTION_TRACKING', 'critical'),
        ('ELECTRONIC_RECORDS_CREATION', 'critical'),
        ('ELECTRONIC_REPORT_GENERATION', 'critical'),
        ('DATA_INTEGRITY_TRACKING', 'critical'),
        ('SOFTWARE_CONFIGURATION_CONTROL', 'critical'),
        ('ANALYSIS_PARAMETER_TRACKING', 'critical'),
        ('DATA_EXPORT_TRACKING', 'critical'),
        ('AUDIT_TRAIL_GENERATION', 'critical'),
        
        # Quality Control Through Software (5 critical)
        ('QC_SOFTWARE_EXECUTION', 'critical'),
        ('CONTROL_SAMPLE_TRACKING', 'critical'),
        ('CONTROL_SAMPLE_VALIDATION', 'critical'),
        ('NEGATIVE_CONTROL_TRACKING', 'critical'),
        ('POSITIVE_CONTROL_TRACKING', 'critical'),
        
        # System Validation & Software Operation (5 critical)
        ('SOFTWARE_VALIDATION_EXECUTION', 'critical'),
        ('SYSTEM_PERFORMANCE_VERIFICATION', 'critical'),
        ('SOFTWARE_FUNCTIONALITY_VALIDATION', 'critical'),
        ('USER_INTERACTION_TRACKING', 'critical'),
        ('CHANGE_CONTROL_TRACKING', 'critical'),
        
        # Data Integrity & Electronic Records (7 critical)
        ('DATA_MODIFICATION_TRACKING', 'critical'),
        ('FILE_INTEGRITY_TRACKING', 'critical'),
        ('DATA_INPUT_VALIDATION', 'critical'),
        ('CALCULATION_VALIDATION', 'critical'),
        ('ALGORITHM_VERIFICATION', 'critical'),
        ('RESULT_VERIFICATION_TRACKING', 'critical'),
        ('QUALITY_ASSURANCE_SOFTWARE', 'critical'),
        
        # Documentation & Storage (5 critical)
        ('DATA_STORAGE_SECURITY', 'critical'),
        ('BACKUP_RECOVERY_PROCEDURES', 'critical'),
        ('SOFTWARE_CHANGE_VALIDATION', 'critical'),
        ('USER_TRAINING_DOCUMENTATION', 'critical'),
        ('SYSTEM_DOCUMENTATION', 'critical'),
        
        # NON-CRITICAL REQUIREMENTS (11) - Important but not essential
        
        # Training & Competency (4 non-critical)
        ('SOFTWARE_TRAINING_COMPLETION', 'non-critical'),
        ('USER_COMPETENCY_SOFTWARE', 'non-critical'),
        ('SOFTWARE_TRAINING_TRACKING', 'non-critical'),
        ('COMPETENCY_VERIFICATION', 'non-critical'),
        
        # Extended Analysis Features (4 non-critical)
        ('THRESHOLD_VALIDATION_TRACKING', 'non-critical'),
        ('SAMPLE_IDENTIFICATION_TRACKING', 'non-critical'),
        ('RESULT_INTERPRETATION_TRACKING', 'non-critical'),
        ('PATHOGEN_DETECTION_VALIDATION', 'non-critical'),
        
        # System Monitoring (3 non-critical)
        ('PERFORMANCE_MONITORING', 'non-critical'),
        ('ERROR_HANDLING_TRACKING', 'non-critical'),
        ('SYSTEM_HEALTH_MONITORING', 'non-critical')
    ]
    
    print(f"Total requirements: {len(all_requirements)}")
    critical_count = len([r for r in all_requirements if r[1] == 'critical'])
    non_critical_count = len([r for r in all_requirements if r[1] == 'non-critical'])
    print(f"Critical: {critical_count}, Non-critical: {non_critical_count}")
    
    # Define requirement details
    requirement_definitions = {}
    
    for req_code, criticality in all_requirements:
        # Generate meaningful names and descriptions
        name = req_code.replace('_', ' ').title()
        
        # Categorize requirements
        if 'ML_' in req_code:
            category = 'Machine Learning'
            compliance_category = 'Software Validation'
        elif any(x in req_code for x in ['QC_', 'CONTROL_', 'QUALITY_']):
            category = 'Quality Control'
            compliance_category = 'Quality Assurance'
        elif any(x in req_code for x in ['TRAINING_', 'COMPETENCY_', 'USER_']):
            category = 'Training'
            compliance_category = 'User Competency'
        elif any(x in req_code for x in ['DATA_', 'FILE_', 'ELECTRONIC_', 'AUDIT_']):
            category = 'Data Management'
            compliance_category = 'Data Integrity'
        elif any(x in req_code for x in ['SOFTWARE_', 'SYSTEM_', 'ALGORITHM_', 'CALCULATION_']):
            category = 'System Validation'
            compliance_category = 'Software Validation'
        elif any(x in req_code for x in ['THRESHOLD_', 'SAMPLE_', 'RESULT_', 'PATHOGEN_']):
            category = 'Analysis Features'
            compliance_category = 'Feature Validation'
        elif any(x in req_code for x in ['PERFORMANCE_', 'ERROR_', 'HEALTH_']):
            category = 'System Monitoring'
            compliance_category = 'System Performance'
        else:
            category = 'General Compliance'
            compliance_category = 'Validation'
        
        # Generate descriptions based on actual capabilities
        if 'ML_' in req_code:
            description = f'Machine learning {name.lower()} automatically tracked through model operations and feedback'
        elif 'TRACKING' in req_code:
            description = f'Automated tracking and monitoring of {name.lower()} through system logging'
        elif 'VALIDATION' in req_code:
            description = f'Validation of {name.lower()} through automated testing and verification'
        elif 'CONTROL' in req_code:
            description = f'Control and management of {name.lower()} through software operations'
        elif 'DOCUMENTATION' in req_code:
            description = f'Documentation of {name.lower()} maintained through system records'
        else:
            description = f'Implementation and maintenance of {name.lower()} through automated processes'
        
        requirement_definitions[req_code] = {
            'name': name,
            'title': f'{category} - {name}',
            'category': category,
            'compliance_category': compliance_category,
            'description': description,
            'criticality': criticality,
            'status': 'partial',  # Most will be partial to start
            'auto_trackable': 1
        }
    
    # Connect to database and restore requirements
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        
        # Clear existing requirements to start fresh
        cursor.execute("DELETE FROM compliance_requirements")
        print("🗑️  Cleared existing requirements")
        
        # Insert all 48 requirements
        added_count = 0
        
        for req_code, details in requirement_definitions.items():
            try:
                cursor.execute("""
                    INSERT INTO compliance_requirements (
                        requirement_code, requirement_name, requirement_title,
                        category, compliance_category, description, 
                        compliance_status, auto_trackable, criticality_level,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (
                    req_code,
                    details['name'],
                    details['title'],
                    details['category'], 
                    details['compliance_category'],
                    details['description'],
                    details['status'],
                    details['auto_trackable'],
                    details['criticality']
                ))
                added_count += 1
                print(f"  ✅ Added {details['criticality']}: {req_code}")
                    
            except Exception as e:
                print(f"  ❌ Error with {req_code}: {e}")
        
        conn.commit()
        
        # Check final state
        cursor.execute("SELECT COUNT(*) FROM compliance_requirements")
        final_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM compliance_requirements WHERE auto_trackable = 1")
        trackable_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM compliance_requirements WHERE criticality_level = 'critical'")
        critical_final = cursor.fetchone()[0]
        
        print(f"\n📊 Results:")
        print(f"  Total requirements: {final_count}")
        print(f"  Auto-trackable: {trackable_count}")
        print(f"  Critical: {critical_final}")
        print(f"  Non-critical: {final_count - critical_final}")
        print(f"  Added: {added_count}")
        
        # Show status breakdown
        cursor.execute("""
            SELECT compliance_status, COUNT(*) as count 
            FROM compliance_requirements 
            WHERE auto_trackable = 1 
            GROUP BY compliance_status
        """)
        
        status_breakdown = dict(cursor.fetchall())
        print(f"\n📈 Status breakdown: {status_breakdown}")
        
        compliant_count = status_breakdown.get('compliant', 0)
        percentage = (compliant_count / trackable_count * 100) if trackable_count > 0 else 0
        print(f"📊 Current compliance: {compliant_count}/{trackable_count} = {percentage:.1f}%")

if __name__ == "__main__":
    try:
        restore_realistic_compliance_requirements()
        print("\n🎉 Realistic 48-requirement compliance system restored!")
    except Exception as e:
        print(f"❌ Error: {e}")
        raise
