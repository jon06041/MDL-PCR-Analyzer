"""
Debug script to test compliance evidence collection
"""
import sqlite3

def test_compliance_queries():
    """Test individual queries to find the problematic one"""
    conn = sqlite3.connect('qpcr_analysis.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    print("Testing individual queries...")
    
    # Test 1: data_exports query
    try:
        cursor.execute("""
            SELECT upload_timestamp, session_id, filename, exported_wells, 
                   data_integrity_hash, exported_samples
            FROM data_exports
            ORDER BY upload_timestamp DESC
            LIMIT 10
        """)
        results = cursor.fetchall()
        print(f"✓ data_exports query works: {len(results)} rows")
    except Exception as e:
        print(f"✗ data_exports query failed: {e}")
    
    # Test 2: ml_validations query
    try:
        cursor.execute("""
            SELECT mv.timestamp, mv.model_name, mv.validation_type, mv.result,
                   mv.confidence_score, mv.passed, mv.validation_data
            FROM ml_validations mv
            WHERE mv.validation_type IN ('model_performance', 'accuracy_check', 'training_validation')
            ORDER BY mv.timestamp DESC
            LIMIT 25
        """)
        results = cursor.fetchall()
        print(f"✓ ml_validations query works: {len(results)} rows")
    except Exception as e:
        print(f"✗ ml_validations query failed: {e}")
    
    # Test 3: user_access_log query
    try:
        cursor.execute("""
            SELECT u.timestamp, u.user_id, u.action, u.ip_address, 
                   u.session_id, u.success, u.details
            FROM user_access_log u
            WHERE u.action LIKE ? OR u.action LIKE '%login%' OR u.action LIKE '%auth%'
            ORDER BY u.timestamp DESC
            LIMIT 20
        """, ('%USER_LOGIN%',))
        results = cursor.fetchall()
        print(f"✓ user_access_log query works: {len(results)} rows")
    except Exception as e:
        print(f"✗ user_access_log query failed: {e}")
    
    # Test 4: backup_logs query
    try:
        cursor.execute("""
            SELECT backup_timestamp as timestamp, 'System Validation' as activity_type,
                   'Backup operation completed successfully' as message
            FROM backup_logs
            ORDER BY backup_timestamp DESC
            LIMIT 15
        """)
        results = cursor.fetchall()
        print(f"✓ backup_logs query works: {len(results)} rows")
    except Exception as e:
        print(f"✗ backup_logs query failed: {e}")
    
    conn.close()
    print("Testing complete!")

if __name__ == "__main__":
    test_compliance_queries()
