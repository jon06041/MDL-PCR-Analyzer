#!/usr/bin/env python3
"""
Compliance Tracking Verification Tool
Tests and verifies all compliance tracking items from the checklist
"""

import sqlite3
import json
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

# Set up logging with minimal output 
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

class ComplianceVerificationTool:
    def __init__(self, db_path='qpcr_analysis.db'):
        self.db_path = db_path
        self.base_url = 'http://localhost:5000'  # Assuming Flask app runs on 5000
        self.results = {}
        
    def get_db_connection(self):
        """Get database connection"""
        return sqlite3.connect(self.db_path, timeout=30.0)
    
    def test_database_connectivity(self):
        """Test if we can connect to the database"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            conn.close()
            return True, f"Connected successfully. Found {len(tables)} tables."
        except Exception as e:
            return False, f"Database connection failed: {str(e)}"
    
    def check_compliance_tables(self):
        """Check if required compliance tables exist"""
        required_tables = [
            'compliance_evidence',
            'ml_model_versions', 
            'ml_model_performance',
            'ml_prediction_tracking',
            'ml_training_history'
        ]
        
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            existing_tables = [row[0] for row in cursor.fetchall()]
            conn.close()
            
            missing_tables = [table for table in required_tables if table not in existing_tables]
            
            return {
                'status': 'pass' if not missing_tables else 'partial',
                'existing_tables': existing_tables,
                'missing_tables': missing_tables,
                'total_tables': len(existing_tables)
            }
        except Exception as e:
            return {'status': 'fail', 'error': str(e)}
    
    def check_ml_compliance_tracking(self):
        """Check ML compliance tracking status"""
        try:
            # Check if safe compliance tracker is available
            try:
                from safe_compliance_tracker import get_compliance_tracker
                tracker = get_compliance_tracker()
                status = tracker.get_status()
                safe_tracker_available = status['running']
            except ImportError:
                safe_tracker_available = False
                status = {}
            
            # Check recent ML compliance events using correct column names
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            # Check for recent ML compliance evidence
            cursor.execute("""
                SELECT requirement_code, COUNT(*) as count
                FROM compliance_evidence 
                WHERE requirement_code LIKE 'AI_ML_%' 
                AND timestamp >= datetime('now', '-7 days')
                GROUP BY requirement_code
                ORDER BY count DESC
            """)
            ml_events = cursor.fetchall()
            
            # Check ML validation manager tables
            cursor.execute("""
                SELECT COUNT(*) FROM ml_prediction_tracking 
                WHERE prediction_timestamp >= datetime('now', '-7 days')
            """)
            recent_predictions = cursor.fetchone()[0]
            
            conn.close()
            
            # Determine status
            ml_status = 'enabled' if safe_tracker_available else 'disabled'
            if len(ml_events) > 0:
                ml_status = 'active'
            
            return {
                'status': ml_status,
                'safe_tracker_available': safe_tracker_available,
                'tracker_status': status,
                'recent_ml_events': dict(ml_events) if ml_events else {},
                'recent_predictions': recent_predictions,
                'total_ml_event_types': len(ml_events)
            }
        except Exception as e:
            return {'status': 'error', 'error': str(e)}
    
    def verify_fda_requirements(self):
        """Verify FDA compliance requirements (21 CFR Part 11)"""
        fda_requirements = [
            'CFR_11_10_A', 'CFR_11_10_B', 'CFR_11_10_C', 'CFR_11_10_D',  # Electronic records
            'AI_ML_VALIDATION', 'AI_ML_VERSION_CONTROL', 'AI_ML_PERFORMANCE_MONITORING'  # AI/ML
        ]
        
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            results = {}
            for req in fda_requirements:
                cursor.execute("""
                    SELECT COUNT(*) FROM compliance_evidence 
                    WHERE requirement_code = ? AND timestamp >= datetime('now', '-30 days')
                """, (req,))
                count = cursor.fetchone()[0]
                results[req] = count
            
            conn.close()
            
            total_events = sum(results.values())
            active_requirements = len([k for k, v in results.items() if v > 0])
            
            return {
                'status': 'active' if active_requirements >= 4 else 'partial' if active_requirements > 0 else 'inactive',
                'requirement_counts': results,
                'total_events': total_events,
                'active_requirements': active_requirements,
                'coverage_percentage': round((active_requirements / len(fda_requirements)) * 100, 1)
            }
        except Exception as e:
            return {'status': 'error', 'error': str(e)}
    
    def verify_clia_requirements(self):
        """Verify CLIA compliance requirements (42 CFR 493)"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            # Check for CLIA-related compliance evidence (by requirement codes)
            cursor.execute("""
                SELECT requirement_code, COUNT(*) as count
                FROM compliance_evidence 
                WHERE requirement_code LIKE 'CLIA_%' 
                AND timestamp >= datetime('now', '-30 days')
                GROUP BY requirement_code
                ORDER BY count DESC
            """)
            clia_requirements = cursor.fetchall()
            
            # Also check for events that map to CLIA
            clia_event_types = [
                'QC_ANALYZED', 'CONTROL_ANALYZED', 'NEGATIVE_CONTROL_VERIFIED',
                'ANALYSIS_COMPLETED', 'REPORT_GENERATED', 'RESULT_VERIFIED'
            ]
            
            event_counts = {}
            for event_type in clia_event_types:
                cursor.execute("""
                    SELECT COUNT(*) FROM compliance_evidence 
                    WHERE evidence_data LIKE ? 
                    AND timestamp >= datetime('now', '-30 days')
                """, (f'%{event_type}%',))
                count = cursor.fetchone()[0]
                event_counts[event_type] = count
            
            conn.close()
            
            total_events = sum(event_counts.values())
            active_events = len([k for k, v in event_counts.items() if v > 0])
            requirement_count = sum([count for _, count in clia_requirements])
            
            return {
                'status': 'active' if active_events >= 3 else 'partial' if active_events > 0 else 'inactive',
                'event_counts': event_counts,
                'requirement_counts': dict(clia_requirements) if clia_requirements else {},
                'total_events': total_events,
                'total_requirement_events': requirement_count,
                'active_event_types': active_events,
                'coverage_percentage': round((active_events / len(clia_event_types)) * 100, 1)
            }
        except Exception as e:
            return {'status': 'error', 'error': str(e)}
    
    def check_ml_model_versioning(self):
        """Check ML model version tracking"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            # Check if ml_model_versions table exists and has data
            cursor.execute("""
                SELECT COUNT(*) FROM sqlite_master 
                WHERE type='table' AND name='ml_model_versions'
            """)
            table_exists = cursor.fetchone()[0] > 0
            
            if not table_exists:
                conn.close()
                return {'status': 'missing_table', 'error': 'ml_model_versions table not found'}
            
            # Check for model versions
            cursor.execute("SELECT COUNT(*) FROM ml_model_versions")
            total_versions = cursor.fetchone()[0]
            
            # Check for recent training events
            cursor.execute("""
                SELECT pathogen_code, MAX(training_date) as last_training
                FROM ml_training_history 
                GROUP BY pathogen_code
            """)
            pathogen_training = cursor.fetchall()
            
            # Check model performance data
            cursor.execute("""
                SELECT COUNT(*) FROM ml_model_performance 
                WHERE run_date >= datetime('now', '-30 days')
            """)
            recent_performance = cursor.fetchone()[0]
            
            conn.close()
            
            return {
                'status': 'active' if total_versions > 0 else 'inactive',
                'total_model_versions': total_versions,
                'pathogen_models': dict(pathogen_training) if pathogen_training else {},
                'recent_performance_records': recent_performance,
                'pathogen_count': len(pathogen_training)
            }
        except Exception as e:
            return {'status': 'error', 'error': str(e)}
    
    def test_api_endpoints(self):
        """Test key ML validation API endpoints"""
        # Skip API testing since requests module not available
        return {
            'status': 'skipped',
            'endpoints': {},
            'working_count': 0,
            'total_count': 0,
            'note': 'API testing skipped - install requests module to test endpoints'
        }
    
    def run_comprehensive_verification(self):
        """Run all verification tests"""
        print("🔍 Starting Compliance Tracking Verification...")
        print("=" * 60)
        
        # Test 1: Database connectivity
        print("\n1. 📊 Database Connectivity")
        db_success, db_message = self.test_database_connectivity()
        print(f"   Status: {'✅ PASS' if db_success else '❌ FAIL'}")
        print(f"   Details: {db_message}")
        self.results['database'] = {'status': 'pass' if db_success else 'fail', 'message': db_message}
        
        if not db_success:
            print("\n❌ Cannot proceed without database access.")
            return self.results
        
        # Test 2: Compliance tables
        print("\n2. 🗃️  Compliance Tables")
        table_results = self.check_compliance_tables()
        status_icon = "✅" if table_results['status'] == 'pass' else "⚠️" if table_results['status'] == 'partial' else "❌"
        print(f"   Status: {status_icon} {table_results['status'].upper()}")
        print(f"   Tables Found: {table_results.get('total_tables', 0)}")
        if table_results.get('missing_tables'):
            print(f"   Missing: {', '.join(table_results['missing_tables'])}")
        self.results['tables'] = table_results
        
        # Test 3: ML compliance tracking
        print("\n3. 🧠 ML Compliance Tracking")
        ml_results = self.check_ml_compliance_tracking()
        status_icon = "✅" if ml_results['status'] in ['enabled', 'active'] else "⚠️" if ml_results['status'] == 'disabled' else "❌"
        print(f"   Status: {status_icon} {ml_results['status'].upper()}")
        print(f"   Safe Tracker Available: {ml_results.get('safe_tracker_available', False)}")
        print(f"   Recent ML Events: {len(ml_results.get('recent_ml_events', {}))}")
        print(f"   Recent Predictions: {ml_results.get('recent_predictions', 0)}")
        if ml_results.get('tracker_status'):
            tracker_status = ml_results['tracker_status']
            print(f"   Tracker Queue: {tracker_status.get('queue_size', 0)}")
            print(f"   Processed Events: {tracker_status.get('processed_count', 0)}")
        self.results['ml_compliance'] = ml_results
        
        # Test 4: FDA requirements
        print("\n4. 📋 FDA Requirements (21 CFR Part 11)")
        fda_results = self.verify_fda_requirements()
        status_icon = "✅" if fda_results['status'] == 'active' else "⚠️" if fda_results['status'] == 'partial' else "❌"
        print(f"   Status: {status_icon} {fda_results['status'].upper()}")
        print(f"   Coverage: {fda_results.get('coverage_percentage', 0)}%")
        print(f"   Active Events: {fda_results.get('active_event_types', 0)}")
        print(f"   Total Events: {fda_results.get('total_events', 0)}")
        self.results['fda'] = fda_results
        
        # Test 5: CLIA requirements
        print("\n5. 🔬 CLIA Requirements (42 CFR 493)")
        clia_results = self.verify_clia_requirements()
        status_icon = "✅" if clia_results['status'] == 'active' else "⚠️" if clia_results['status'] == 'partial' else "❌"
        print(f"   Status: {status_icon} {clia_results['status'].upper()}")
        print(f"   Coverage: {clia_results.get('coverage_percentage', 0)}%")
        print(f"   Active Events: {clia_results.get('active_event_types', 0)}")
        print(f"   Total Events: {clia_results.get('total_events', 0)}")
        print(f"   Requirement Events: {clia_results.get('total_requirement_events', 0)}")
        self.results['clia'] = clia_results
        
        # Test 6: ML model versioning
        print("\n6. 🏷️  ML Model Versioning")
        version_results = self.check_ml_model_versioning()
        status_icon = "✅" if version_results['status'] == 'active' else "⚠️" if version_results['status'] == 'partial' else "❌"
        print(f"   Status: {status_icon} {version_results['status'].upper()}")
        print(f"   Model Versions: {version_results.get('total_model_versions', 0)}")
        print(f"   Pathogen Models: {version_results.get('pathogen_count', 0)}")
        print(f"   Recent Performance Records: {version_results.get('recent_performance_records', 0)}")
        self.results['ml_versioning'] = version_results
        
        # Test 7: API endpoints
        print("\n7. 🌐 API Endpoints")
        api_results = self.test_api_endpoints()
        status_icon = "✅" if api_results['working_count'] > 0 else "❌"
        print(f"   Status: {status_icon} {api_results['status'].upper()}")
        print(f"   Working Endpoints: {api_results['working_count']}/{api_results['total_count']}")
        self.results['api'] = api_results
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 VERIFICATION SUMMARY")
        print("=" * 60)
        
        total_tests = 7
        passing_tests = 0
        critical_issues = []
        
        if self.results['database']['status'] == 'pass':
            passing_tests += 1
        else:
            critical_issues.append("Database connectivity failed")
            
        if self.results['ml_compliance']['status'] in ['disabled', 'error']:
            critical_issues.append("ML compliance tracking needs attention")
        elif self.results['ml_compliance']['status'] in ['enabled', 'active']:
            passing_tests += 1
            
        if self.results['fda']['status'] in ['active', 'partial']:
            passing_tests += 1
        elif self.results['fda']['status'] == 'inactive':
            critical_issues.append("FDA compliance tracking inactive")
            
        if self.results['clia']['status'] in ['active', 'partial']:
            passing_tests += 1
            
        if self.results['ml_versioning']['status'] == 'active':
            passing_tests += 1
        elif self.results['ml_versioning']['status'] == 'inactive':
            critical_issues.append("ML model versioning not working")
            
        print(f"✅ Tests Passing: {passing_tests}/{total_tests}")
        
        if critical_issues:
            print("🚨 CRITICAL ISSUES TO FIX:")
            for issue in critical_issues:
                print(f"   • {issue}")
        
        # Specific recommendations
        print("\n🔧 RECOMMENDATIONS:")
        
        if not self.results['ml_compliance'].get('safe_tracker_available', False):
            print("   1. Safe ML compliance tracker not available - check safe_compliance_tracker.py")
            
        if self.results['ml_versioning']['total_model_versions'] == 0:
            print("   2. Initialize ML model versioning system")
            
        if self.results['api']['working_count'] == 0:
            print("   3. Start Flask application to test API endpoints")
            
        return self.results

if __name__ == "__main__":
    verifier = ComplianceVerificationTool()
    results = verifier.run_comprehensive_verification()
