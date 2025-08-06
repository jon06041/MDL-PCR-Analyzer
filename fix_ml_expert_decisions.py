#!/usr/bin/env python3
"""
Fix ML Expert Decisions table - add missing improvement_score column
"""

import os
import mysql.connector
from mysql.connector import Error

def fix_ml_expert_decisions_table():
    """Add missing improvement_score column to ml_expert_decisions table"""
    try:
        # MySQL connection configuration
        mysql_config = {
            'host': os.environ.get('MYSQL_HOST', 'localhost'),
            'port': int(os.environ.get('MYSQL_PORT', '3306')),
            'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
            'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
            'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis'),
            'charset': 'utf8mb4',
            'autocommit': True
        }
        
        print("🔧 Connecting to MySQL to fix ml_expert_decisions table...")
        connection = mysql.connector.connect(**mysql_config)
        cursor = connection.cursor()
        
        # Check if improvement_score column exists
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'qpcr_analysis' 
            AND TABLE_NAME = 'ml_expert_decisions' 
            AND COLUMN_NAME = 'improvement_score'
        """)
        
        if cursor.fetchone():
            print("✅ improvement_score column already exists")
        else:
            print("📝 Adding improvement_score column...")
            cursor.execute("""
                ALTER TABLE ml_expert_decisions 
                ADD COLUMN improvement_score DECIMAL(5,3) DEFAULT NULL
            """)
            print("✅ Added improvement_score column")
        
        # Check if session_id column exists
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'qpcr_analysis' 
            AND TABLE_NAME = 'ml_expert_decisions' 
            AND COLUMN_NAME = 'session_id'
        """)
        
        if cursor.fetchone():
            print("✅ session_id column already exists")
        else:
            print("📝 Adding session_id column...")
            cursor.execute("""
                ALTER TABLE ml_expert_decisions 
                ADD COLUMN session_id VARCHAR(255) DEFAULT NULL
            """)
            print("✅ Added session_id column")
        
        # Check if teaching_outcome column exists
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'qpcr_analysis' 
            AND TABLE_NAME = 'ml_expert_decisions' 
            AND COLUMN_NAME = 'teaching_outcome'
        """)
        
        if cursor.fetchone():
            print("✅ teaching_outcome column already exists")
        else:
            print("📝 Adding teaching_outcome column...")
            cursor.execute("""
                ALTER TABLE ml_expert_decisions 
                ADD COLUMN teaching_outcome VARCHAR(255) DEFAULT NULL
            """)
            print("✅ Added teaching_outcome column")
        
        # Verify table structure
        cursor.execute("DESCRIBE ml_expert_decisions")
        columns = cursor.fetchall()
        print("\\n📋 Current ml_expert_decisions table structure:")
        for column in columns:
            print(f"   {column[0]} - {column[1]}")
        
        print("\\n✅ ml_expert_decisions table structure fixed!")
        
    except Error as e:
        print(f"❌ Error fixing ml_expert_decisions table: {e}")
        return False
    
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()
    
    return True

if __name__ == "__main__":
    fix_ml_expert_decisions_table()
