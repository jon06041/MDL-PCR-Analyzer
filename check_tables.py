#!/usr/bin/env python3
"""Check all tables"""

import pymysql
import os

mysql_config = {
    'host': os.environ.get('MYSQL_HOST', 'localhost'),
    'user': os.environ.get('MYSQL_USER', 'qpcr_user'), 
    'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
    'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis'),
    'charset': 'utf8mb4'
}

try:
    connection = pymysql.connect(**mysql_config)
    cursor = connection.cursor()
    
    print("=== All tables ===")
    cursor.execute("SHOW TABLES")
    tables = cursor.fetchall()
    for table in tables:
        print(f"Table: {table[0]}")
    
    print("\n=== Session-related tables ===")
    session_tables = [table[0] for table in tables if 'session' in table[0].lower()]
    for table in session_tables:
        print(f"Session table: {table}")
        cursor.execute(f"DESCRIBE {table}")
        columns = cursor.fetchall()
        print(f"  Columns: {[col[0] for col in columns[:5]]}")  # First 5 columns
    
except Exception as e:
    print(f"Database error: {e}")
finally:
    if 'connection' in locals():
        connection.close()
