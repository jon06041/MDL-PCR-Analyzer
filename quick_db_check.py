#!/usr/bin/env python3
"""Quick script to check database schema"""

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
    
    print("=== well_results table schema ===")
    cursor.execute("DESCRIBE well_results")
    columns = cursor.fetchall()
    for col in columns:
        print(f"{col[0]}: {col[1]} {col[2] if col[2] == 'YES' else 'NOT NULL'}")
    
    print("\n=== Checking for test_code column ===")
    test_code_exists = any(col[0] == 'test_code' for col in columns)
    print(f"test_code column exists: {test_code_exists}")
    
    if test_code_exists:
        print("\n=== Sample test_code values from session 275 ===")
        cursor.execute("SELECT well_id, test_code, calcj FROM well_results WHERE session_id = 275 LIMIT 3")
        results = cursor.fetchall()
        for row in results:
            print(f"Well: {row[0]}, test_code: {row[1]}, calcj: {row[2]}")
    
except Exception as e:
    print(f"Database error: {e}")
finally:
    if 'connection' in locals():
        connection.close()
