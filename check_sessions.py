#!/usr/bin/env python3
"""Check session 275 details"""

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
    
    print("=== Session 275 details ===")
    cursor.execute("SELECT id, experiment_name, created_at FROM sessions WHERE id = 275")
    session = cursor.fetchone()
    if session:
        print(f"Session ID: {session[0]}")
        print(f"Experiment: {session[1]}")
        print(f"Created: {session[2]}")
    else:
        print("Session 275 not found")
    
    print("\n=== Latest sessions ===")
    cursor.execute("SELECT id, experiment_name, created_at FROM sessions ORDER BY id DESC LIMIT 5")
    sessions = cursor.fetchall()
    for session in sessions:
        print(f"Session {session[0]}: {session[1]} - {session[2]}")
    
    print("\n=== Latest well with test_code ===")
    cursor.execute("SELECT session_id, well_id, test_code FROM well_results WHERE test_code IS NOT NULL ORDER BY id DESC LIMIT 3")
    wells = cursor.fetchall()
    for well in wells:
        print(f"Session {well[0]}, Well {well[1]}, test_code: {well[2]}")
    
except Exception as e:
    print(f"Database error: {e}")
finally:
    if 'connection' in locals():
        connection.close()
