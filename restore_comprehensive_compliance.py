#!/usr/bin/env python3
"""
Restore comprehensive compliance requirements
Based on the working 77.1% compliance system from commit 1504648
"""

import sqlite3
from datetime import datetime
import sys
import os

def restore_all_compliance_requirements():
    """Restore all 48 compliance requirements - auto-trackable when implemented"""
    
    print("🔄 Restoring comprehensive compliance requirements...")
    print("📋 Including future security features for auto-tracking when implemented")
    
    db_path = '/workspaces/MDL-PCR-Analyzer/qpcr_analysis.db'
    
    # 37 CRITICAL auto-trackable requirements (primary compliance focus)
    critical_requirements = [
        # ML Model Validation & Versioning (7)
        'ML_MODEL_VALIDATION',
        'ML_VERSION_CONTROL', 
        'ML_PERFORMANCE_TRACKING',
        'ML_AUDIT_TRAIL',
        'ML_EXPERT_VALIDATION',
        'ML_CONTINUOUS_LEARNING',
        'ML_PERFORMANCE_VALIDATION',
        
        # Core qPCR Analysis Activities (8)
        'ANALYSIS_EXECUTION_TRACKING',
        'ELECTRONIC_RECORDS_CREATION',
        'ELECTRONIC_REPORT_GENERATION',
        'DATA_INTEGRITY_TRACKING',
        'SOFTWARE_CONFIGURATION_CONTROL',
        'ANALYSIS_PARAMETER_TRACKING',
        'DATA_EXPORT_TRACKING',
        'AUDIT_TRAIL_GENERATION',
        
        # Quality Control Through Software (5)
        'QC_SOFTWARE_EXECUTION',
        'CONTROL_SAMPLE_TRACKING',
        'CONTROL_SAMPLE_VALIDATION',
        'NEGATIVE_CONTROL_TRACKING',
        'POSITIVE_CONTROL_TRACKING',
        
        # System Validation & Software Operation (5)
        'SOFTWARE_VALIDATION_EXECUTION',
        'SYSTEM_PERFORMANCE_VERIFICATION',
        'SOFTWARE_FUNCTIONALITY_VALIDATION',
        'USER_INTERACTION_TRACKING',
        'CHANGE_CONTROL_TRACKING',
        
        # Data Integrity & Electronic Records (7)
        'DATA_MODIFICATION_TRACKING',
        'FILE_INTEGRITY_TRACKING',
        'DATA_INPUT_VALIDATION',
        'CALCULATION_VALIDATION',
        'ALGORITHM_VERIFICATION',
        'RESULT_VERIFICATION_TRACKING',
        'QUALITY_ASSURANCE_SOFTWARE',
        
        # Core Security & Access (5) - Basic tracking ready
        'ACCESS_CONTROL_SOFTWARE',
        'SESSION_MANAGEMENT_SOFTWARE',
        'DATA_SECURITY_TRACKING',
        'SYSTEM_ACCESS_CONTROL',
        'DATA_STORAGE_SECURITY'
    ]
    
    # 11 NON-CRITICAL auto-trackable requirements (important but not critical)
    non_critical_requirements = [
        # User Training & Competency (4)
        'SOFTWARE_TRAINING_COMPLETION',
        'USER_COMPETENCY_SOFTWARE', 
        'SOFTWARE_TRAINING_TRACKING',
        'COMPETENCY_VERIFICATION',
        
        # Major Security Features (4) - Important for compliance  
        'USER_AUTHENTICATION_TRACKING',
        'ROLE_BASED_ACCESS_CONTROL',
        'PASSWORD_POLICY_ENFORCEMENT',
        'SECURITY_EVENT_TRACKING',
        
        # Documentation & Change Management (3)
        'BACKUP_RECOVERY_PROCEDURES',
        'SOFTWARE_CHANGE_VALIDATION',
        'SYSTEM_DOCUMENTATION'
    ]
    
    # Combine all requirements (exactly 48 total: 37 critical + 11 non-critical)
    all_requirements = critical_requirements + non_critical_requirements
    
    # Define comprehensive requirement details
    requirement_definitions = {}
    
    for req_code in all_requirements:
        # Generate meaningful names and descriptions
        name = req_code.replace('_', ' ').title()
        
        # Determine if this is a critical requirement
        is_critical = req_code in critical_requirements
        
        # Categorize requirements
        if 'ML_' in req_code:
            category = 'Machine Learning'
            compliance_category = 'Software Validation'
        elif any(x in req_code for x in ['QC_', 'CONTROL_', 'QUALITY_']):
            category = 'Quality Control'
            compliance_category = 'Quality Assurance'
        elif any(x in req_code for x in ['ACCESS_', 'USER_', 'SECURITY_', 'SESSION_', 'PASSWORD_', 'PERMISSION_', 'ENCRYPTION_', 'CRYPTO_']):
            category = 'Security'
            compliance_category = 'Access Control'
        elif any(x in req_code for x in ['DATA_', 'FILE_', 'ELECTRONIC_', 'AUDIT_']):
            category = 'Data Management'
            compliance_category = 'Data Integrity'
        elif any(x in req_code for x in ['SOFTWARE_', 'SYSTEM_', 'ALGORITHM_', 'CALCULATION_']):
            category = 'System Validation'
            compliance_category = 'Software Validation'
        else:
            category = 'General Compliance'
            compliance_category = 'Validation'
        
        # Generate descriptions based on implementation status and priority
        if req_code in ['ENCRYPTION_SOFTWARE_IMPLEMENTATION', 'ENCRYPTION_ALGORITHM_VALIDATION', 'CRYPTO_SOFTWARE_VALIDATION']:
            description = f'Advanced {name.lower()} - auto-trackable when encryption features are implemented'
            status = 'not_implemented'  # Future features
            priority = 'low'
        elif req_code in ['PASSWORD_POLICY_ENFORCEMENT', 'TIMEOUT_POLICY_ENFORCEMENT', 'SECURITY_EVENT_TRACKING']:
            description = f'Major security {name.lower()} - important for regulatory compliance'
            status = 'not_implemented'  # Major but not yet implemented
            priority = 'high'
        elif 'TRAINING' in req_code:
            description = f'User {name.lower()} - trackable through documentation and usage analytics'
            status = 'partial'
            priority = 'medium'
        elif 'VALIDATION' in req_code:
            description = f'Validation of {name.lower()} to ensure compliance with regulatory requirements'
            status = 'partial'
            priority = 'high'
        elif 'TRACKING' in req_code:
            description = f'Automated tracking and monitoring of {name.lower()} for audit trail purposes'
            status = 'partial'
            priority = 'high'
        elif 'CONTROL' in req_code:
            description = f'Control and management of {name.lower()} according to regulatory standards'
            status = 'partial'
            priority = 'high'
        else:
            description = f'Implementation and maintenance of {name.lower()} compliance measures'
            status = 'partial'
            priority = 'medium'
        
        requirement_definitions[req_code] = {
            'name': name,
            'title': f'{category} - {name}',
            'category': category,
            'compliance_category': compliance_category,
            'description': description,
            'status': status,
            'auto_trackable': 1,  # ALL requirements are auto-trackable
            'criticality_level': 'critical' if is_critical else 'major',
            'priority_level': priority
        }
    
    # Connect to database and restore requirements
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        
        # Check current state
        cursor.execute("SELECT COUNT(*) FROM compliance_requirements")
        initial_count = cursor.fetchone()[0]
        print(f"Initial requirements count: {initial_count}")
        
        # Insert all requirements
        added_count = 0
        updated_count = 0
        
        for req_code, details in requirement_definitions.items():
            try:
                # Check if exists
                cursor.execute("SELECT requirement_code FROM compliance_requirements WHERE requirement_code = ?", (req_code,))
                exists = cursor.fetchone()
                
                if exists:
                    # Update existing
                    cursor.execute("""
                        UPDATE compliance_requirements 
                        SET requirement_name = ?,
                            requirement_title = ?,
                            category = ?,
                            compliance_category = ?,
                            description = ?,
                            auto_trackable = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE requirement_code = ?
                    """, (
                        details['name'],
                        details['title'], 
                        details['category'],
                        details['compliance_category'],
                        details['description'],
                        details['auto_trackable'],
                        req_code
                    ))
                    updated_count += 1
                    print(f"  📝 Updated: {req_code}")
                else:
                    # Insert new
                    cursor.execute("""
                        INSERT INTO compliance_requirements (
                            requirement_code, requirement_name, requirement_title,
                            category, compliance_category, description, 
                            compliance_status, auto_trackable,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """, (
                        req_code,
                        details['name'],
                        details['title'],
                        details['category'], 
                        details['compliance_category'],
                        details['description'],
                        details['status'],
                        details['auto_trackable']
                    ))
                    added_count += 1
                    print(f"  ✅ Added: {req_code}")
                    
            except Exception as e:
                print(f"  ❌ Error with {req_code}: {e}")
        
        conn.commit()
        
        # Check final state
        cursor.execute("SELECT COUNT(*) FROM compliance_requirements")
        final_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM compliance_requirements WHERE auto_trackable = 1")
        trackable_count = cursor.fetchone()[0]
        
        print(f"\n📊 Results:")
        print(f"  Initial requirements: {initial_count}")
        print(f"  Final requirements: {final_count}")
        print(f"  Auto-trackable: {trackable_count}")
        print(f"  Added: {added_count}")
        print(f"  Updated: {updated_count}")
        
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
        restore_all_compliance_requirements()
        print("\n🎉 Comprehensive compliance requirements restored!")
    except Exception as e:
        print(f"❌ Error: {e}")
        raise
