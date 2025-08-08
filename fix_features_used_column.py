#!/usr/bin/env python3
"""
Add missing features_used column to ml_expert_decisions table
"""

import os
import logging
from sqlalchemy import create_engine, text

def fix_features_used_column():
    """Add features_used column if missing"""
    
    # MySQL connection
    mysql_host = os.environ.get("MYSQL_HOST", "127.0.0.1")
    mysql_port = os.environ.get("MYSQL_PORT", "3306")
    mysql_user = os.environ.get("MYSQL_USER", "qpcr_user")
    mysql_password = os.environ.get("MYSQL_PASSWORD", "qpcr_password")
    mysql_database = os.environ.get("MYSQL_DATABASE", "qpcr_analysis")
    
    database_url = f"mysql+pymysql://{mysql_user}:{mysql_password}@{mysql_host}:{mysql_port}/{mysql_database}?charset=utf8mb4"
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        try:
            # Check if features_used column exists
            result = conn.execute(text("""
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = :schema 
                AND TABLE_NAME = 'ml_expert_decisions' 
                AND COLUMN_NAME = 'features_used'
            """), {'schema': mysql_database}).fetchone()
            
            if not result:
                print("Adding features_used column to ml_expert_decisions table...")
                conn.execute(text("""
                    ALTER TABLE ml_expert_decisions 
                    ADD COLUMN features_used TEXT AFTER confidence
                """))
                conn.commit()
                print("✅ features_used column added successfully")
            else:
                print("✅ features_used column already exists")
                
            # Also check for user_id column
            result = conn.execute(text("""
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = :schema 
                AND TABLE_NAME = 'ml_expert_decisions' 
                AND COLUMN_NAME = 'user_id'
            """), {'schema': mysql_database}).fetchone()
            
            if not result:
                print("Adding user_id column to ml_expert_decisions table...")
                conn.execute(text("""
                    ALTER TABLE ml_expert_decisions 
                    ADD COLUMN user_id VARCHAR(255) AFTER teaching_outcome
                """))
                conn.commit()
                print("✅ user_id column added successfully")
            else:
                print("✅ user_id column already exists")
            
            # Show final table structure
            print("\nFinal table structure:")
            result = conn.execute(text("DESCRIBE ml_expert_decisions")).fetchall()
            for row in result:
                print(f"  {row[0]}: {row[1]}")
                
        except Exception as e:
            print(f"❌ Error: {e}")
            raise

if __name__ == "__main__":
    fix_features_used_column()
