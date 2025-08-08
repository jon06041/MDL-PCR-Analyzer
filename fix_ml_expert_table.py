#!/usr/bin/env python3
"""
Fix ml_expert_decisions table to add missing features_used column
"""

import os
from sqlalchemy import create_engine, text

def fix_ml_expert_table():
    # MySQL connection
    mysql_host = os.environ.get('MYSQL_HOST', '127.0.0.1')
    mysql_port = os.environ.get('MYSQL_PORT', '3306')
    mysql_user = os.environ.get('MYSQL_USER', 'qpcr_user')
    mysql_password = os.environ.get('MYSQL_PASSWORD', 'qpcr_password')
    mysql_database = os.environ.get('MYSQL_DATABASE', 'qpcr_analysis')
    database_url = f'mysql+pymysql://{mysql_user}:{mysql_password}@{mysql_host}:{mysql_port}/{mysql_database}?charset=utf8mb4'
    
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        try:
            # Check current schema
            print("Checking current ml_expert_decisions schema...")
            result = conn.execute(text('DESCRIBE ml_expert_decisions')).fetchall()
            columns = [row[0] for row in result]
            print(f"Current columns: {columns}")
            
            # Add features_used column if missing
            if 'features_used' not in columns:
                print("Adding features_used column...")
                conn.execute(text("""
                    ALTER TABLE ml_expert_decisions 
                    ADD COLUMN features_used TEXT AFTER confidence
                """))
                conn.commit()
                print("✅ Added features_used column")
            else:
                print("✅ features_used column already exists")
            
            # Check final schema
            result = conn.execute(text('DESCRIBE ml_expert_decisions')).fetchall()
            print("\nFinal schema:")
            for row in result:
                print(f"  {row[0]} - {row[1]} - {row[2]} - {row[3]}")
                
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    fix_ml_expert_table()
