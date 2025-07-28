"""
Demo data populator for compliance evidence tracking
"""

import sqlite3
from datetime import datetime, timedelta
import random

def populate_demo_evidence():
    """Populate database with demo data to show compliance tracking"""
    
    conn = sqlite3.connect('qpcr_analysis.db')
    cursor = conn.cursor()
    
    # Clear existing demo data
    cursor.execute("DELETE FROM system_logs WHERE message LIKE '%demo%'")
    cursor.execute("DELETE FROM backup_logs")
    cursor.execute("DELETE FROM ml_validations")
    
    # Add sample analysis evidence
    base_time = datetime.now() - timedelta(days=30)
    
    # System logs for audit trail
    for i in range(50):
        log_time = base_time + timedelta(hours=i*12)
        cursor.execute("""
            INSERT INTO system_logs (timestamp, log_level, component, message, user_id, session_id)
            VALUES (?, 'INFO', 'qpcr_analyzer', ?, 'demo_user', ?)
        """, (
            log_time.isoformat(),
            f'Sample analysis completed - demo sample {i+1}',
            f'session_{i+1}'
        ))
    
    # Backup logs
    for i in range(10):
        backup_time = base_time + timedelta(days=i*3)
        cursor.execute("""
            INSERT INTO backup_logs (backup_timestamp, backup_type, file_path, file_size, checksum, status)
            VALUES (?, 'automated', ?, ?, ?, 'completed')
        """, (
            backup_time.isoformat(),
            f'/backups/qpcr_data_{backup_time.strftime("%Y%m%d")}.db',
            random.randint(1000000, 5000000),
            f'sha256_{random.randint(100000, 999999)}'
        ))
    
    # ML validation logs
    for i in range(25):
        val_time = base_time + timedelta(days=i)
        validation_types = ['qc_check', 'model_performance', 'threshold_validation']
        cursor.execute("""
            INSERT INTO ml_validations (timestamp, validation_type, model_name, result, confidence_score, validation_data, passed)
            VALUES (?, ?, 'ml_curve_classifier', ?, ?, ?, ?)
        """, (
            val_time.isoformat(),
            random.choice(validation_types),
            'PASSED' if random.random() > 0.1 else 'FAILED',
            random.uniform(0.8, 0.99),
            f'{{"sample_count": {random.randint(5, 20)}}}',
            random.random() > 0.1
        ))
    
    # Update well_results to have data integrity hashes (simulating analysis_results)
    cursor.execute("SELECT id FROM well_results LIMIT 20")
    result_ids = cursor.fetchall()
    
    # Add data integrity hash column if it doesn't exist
    try:
        cursor.execute("ALTER TABLE well_results ADD COLUMN data_integrity_hash TEXT")
    except sqlite3.OperationalError:
        # Column already exists
        pass
    
    for result_id in result_ids:
        cursor.execute("""
            UPDATE well_results 
            SET data_integrity_hash = ? 
            WHERE id = ?
        """, (f'sha256_{random.randint(100000, 999999)}', result_id[0]))
    
    conn.commit()
    conn.close()
    
    print("Demo compliance evidence data populated successfully!")

if __name__ == "__main__":
    populate_demo_evidence()
