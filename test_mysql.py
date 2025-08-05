#!/usr/bin/env python3

import mysql.connector
import os

print('🔍 Testing MySQL Connection')
print('=' * 30)

try:
    mysql_config = {
        'host': os.environ.get('MYSQL_HOST', '127.0.0.1'),
        'port': int(os.environ.get('MYSQL_PORT', 3306)),
        'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
        'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
        'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis'),
        'charset': 'utf8mb4'
    }
    
    print(f'Connecting to: {mysql_config["host"]}:{mysql_config["port"]}')
    print(f'Database: {mysql_config["database"]}')
    print(f'User: {mysql_config["user"]}')
    
    conn = mysql.connector.connect(**mysql_config)
    cursor = conn.cursor(dictionary=True)
    
    # Test query
    cursor.execute('SHOW TABLES')
    tables = cursor.fetchall()
    print(f'✅ Connected! Found {len(tables)} tables')
    
    # Check if ml_validations table exists
    cursor.execute('SHOW TABLES LIKE "ml_validations"')
    ml_val_exists = cursor.fetchone()
    print(f'ml_validations table exists: {bool(ml_val_exists)}')
    
    conn.close()
    
except Exception as e:
    print(f'❌ MySQL connection failed: {e}')
    print('Environment variables:')
    for key in ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']:
        value = os.environ.get(key, 'NOT_SET')
        print(f'  {key}: {value}')
