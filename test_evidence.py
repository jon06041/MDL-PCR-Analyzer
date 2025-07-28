"""
Quick test to debug evidence collection
"""
import sqlite3
from software_compliance_requirements import SOFTWARE_TRACKABLE_REQUIREMENTS, get_requirements_by_implementation_status

def test_evidence_collection():
    """Test basic evidence collection"""
    
    # Check the structure of requirements
    print("=== Requirements Structure ===")
    print(f"Top level keys: {list(SOFTWARE_TRACKABLE_REQUIREMENTS.keys())}")
    
    # Get requirements by status
    requirements_by_status = get_requirements_by_implementation_status()
    print(f"\nRequirements by status keys: {list(requirements_by_status.keys())}")
    
    for status, reqs in requirements_by_status.items():
        print(f"{status}: {len(reqs)} requirements")
        if reqs:
            print(f"  First requirement: {reqs[0]['code']} - {reqs[0]['title']}")
    
    # Test database connection
    print("\n=== Database Test ===")
    try:
        conn = sqlite3.connect('qpcr_analysis.db')
        cursor = conn.cursor()
        
        # Check what tables exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        print(f"Available tables: {[t[0] for t in tables]}")
        
        # Check some basic data
        cursor.execute("SELECT COUNT(*) FROM well_results")
        well_count = cursor.fetchone()[0]
        print(f"Well results count: {well_count}")
        
        cursor.execute("SELECT COUNT(*) FROM system_logs")
        log_count = cursor.fetchone()[0]
        print(f"System logs count: {log_count}")
        
        cursor.execute("SELECT COUNT(*) FROM ml_validations")
        ml_count = cursor.fetchone()[0]
        print(f"ML validations count: {ml_count}")
        
        cursor.execute("SELECT COUNT(*) FROM backup_logs")
        backup_count = cursor.fetchone()[0]
        print(f"Backup logs count: {backup_count}")
        
        conn.close()
        
    except Exception as e:
        print(f"Database error: {e}")

if __name__ == "__main__":
    test_evidence_collection()
