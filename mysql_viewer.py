#!/usr/bin/env python3
"""
Simple standalone MySQL viewer for development
Run this script to get a web-based MySQL browser on port 8080
"""

from flask import Flask, render_template_string, jsonify, request
import mysql.connector
import os
import json
from datetime import datetime

app = Flask(__name__)

# MySQL config
MYSQL_CONFIG = {
    'host': os.environ.get("MYSQL_HOST", "127.0.0.1"),
    'port': int(os.environ.get("MYSQL_PORT", 3306)),
    'user': os.environ.get("MYSQL_USER", "qpcr_user"),
    'password': os.environ.get("MYSQL_PASSWORD", "qpcr_password"),
    'database': os.environ.get("MYSQL_DATABASE", "qpcr_analysis"),
    'charset': 'utf8mb4'
}

def get_connection():
    """Get MySQL connection"""
    return mysql.connector.connect(**MYSQL_CONFIG)

@app.route('/')
def index():
    """Main MySQL viewer interface"""
    return render_template_string('''
<!DOCTYPE html>
<html>
<head>
    <title>MySQL Viewer - Development</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #007bff; color: white; padding: 15px; margin-bottom: 20px; }
        .tables-list { background: #f8f9fa; padding: 15px; margin-bottom: 20px; }
        .table-item { 
            display: inline-block; 
            margin: 5px; 
            padding: 8px 12px; 
            background: white; 
            border: 1px solid #ddd; 
            cursor: pointer;
            border-radius: 4px;
        }
        .table-item:hover { background: #e9ecef; }
        .query-section { margin-bottom: 20px; }
        .query-input { width: 100%; height: 100px; padding: 10px; border: 1px solid #ddd; }
        .btn { 
            background: #007bff; 
            color: white; 
            padding: 10px 20px; 
            border: none; 
            cursor: pointer; 
            margin: 5px;
            border-radius: 4px;
        }
        .btn:hover { background: #0056b3; }
        .results-table { 
            width: 100%; 
            border-collapse: collapse; 
            background: white; 
            margin-top: 15px;
        }
        .results-table th, .results-table td { 
            border: 1px solid #ddd; 
            padding: 8px; 
            text-align: left; 
        }
        .results-table th { background: #f8f9fa; }
        .results-table tr:nth-child(even) { background: #f9f9f9; }
        .error { color: #dc3545; background: #f8d7da; padding: 10px; border-radius: 4px; }
        .success { color: #155724; background: #d4edda; padding: 10px; border-radius: 4px; }
        .loading { color: #856404; background: #fff3cd; padding: 10px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🗄️ MySQL Development Viewer</h1>
            <p>Database: {{ config.database }} @ {{ config.host }}:{{ config.port }}</p>
        </div>
        
        <div class="tables-list">
            <h3>📋 Database Tables</h3>
            <div id="tables-container">Loading tables...</div>
            <button class="btn" onclick="loadTables()">🔄 Refresh Tables</button>
        </div>
        
        <div class="query-section">
            <h3>🔍 Custom Query</h3>
            <textarea id="query-input" class="query-input" placeholder="Enter your SQL query here...">SELECT * FROM analysis_sessions LIMIT 5;</textarea>
            <br>
            <button class="btn" onclick="executeQuery()">▶️ Execute Query</button>
            <button class="btn" onclick="clearResults()">🗑️ Clear Results</button>
        </div>
        
        <div id="results-container"></div>
    </div>

    <script>
        let currentQuery = '';
        
        async function loadTables() {
            const container = document.getElementById('tables-container');
            container.innerHTML = '<div class="loading">Loading tables...</div>';
            
            try {
                const response = await fetch('/api/tables');
                const data = await response.json();
                
                if (data.success) {
                    container.innerHTML = data.tables.map(table => 
                        `<span class="table-item" onclick="selectTable('${table.name}')">${table.name} (${table.rows})</span>`
                    ).join('');
                } else {
                    container.innerHTML = `<div class="error">Error: ${data.error}</div>`;
                }
            } catch (error) {
                container.innerHTML = `<div class="error">Failed to load tables: ${error.message}</div>`;
            }
        }
        
        function selectTable(tableName) {
            const query = `SELECT * FROM ${tableName} LIMIT 20;`;
            document.getElementById('query-input').value = query;
            executeQuery();
        }
        
        async function executeQuery() {
            const query = document.getElementById('query-input').value.trim();
            if (!query) {
                alert('Please enter a query');
                return;
            }
            
            const container = document.getElementById('results-container');
            container.innerHTML = '<div class="loading">Executing query...</div>';
            
            try {
                const response = await fetch('/api/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: query })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    if (data.results && data.results.length > 0) {
                        const columns = Object.keys(data.results[0]);
                        let html = `
                            <div class="success">Query executed successfully. ${data.results.length} rows returned.</div>
                            <table class="results-table">
                                <thead>
                                    <tr>${columns.map(col => `<th>${col}</th>`).join('')}</tr>
                                </thead>
                                <tbody>
                        `;
                        
                        data.results.forEach(row => {
                            html += '<tr>';
                            columns.forEach(col => {
                                let value = row[col];
                                if (value === null) value = '<em>NULL</em>';
                                else if (typeof value === 'object') value = JSON.stringify(value);
                                else if (typeof value === 'string' && value.length > 100) value = value.substring(0, 100) + '...';
                                html += `<td>${value}</td>`;
                            });
                            html += '</tr>';
                        });
                        
                        html += '</tbody></table>';
                        container.innerHTML = html;
                    } else {
                        container.innerHTML = '<div class="success">Query executed successfully. No rows returned.</div>';
                    }
                } else {
                    container.innerHTML = `<div class="error">Query Error: ${data.error}</div>`;
                }
            } catch (error) {
                container.innerHTML = `<div class="error">Request failed: ${error.message}</div>`;
            }
        }
        
        function clearResults() {
            document.getElementById('results-container').innerHTML = '';
            document.getElementById('query-input').value = '';
        }
        
        // Load tables on page load
        loadTables();
    </script>
</body>
</html>
    ''', config=MYSQL_CONFIG)

@app.route('/api/tables')
def get_tables():
    """Get list of all tables with row counts"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get table names
        cursor.execute("SHOW TABLES")
        table_names = [row[0] for row in cursor.fetchall()]
        
        # Get row count for each table
        tables = []
        for table_name in table_names:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM `{table_name}`")
                row_count = cursor.fetchone()[0]
                tables.append({'name': table_name, 'rows': row_count})
            except Exception as e:
                tables.append({'name': table_name, 'rows': f'Error: {e}'})
        
        cursor.close()
        conn.close()
        
        return jsonify({'success': True, 'tables': tables})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/query', methods=['POST'])
def execute_query():
    """Execute a custom SQL query"""
    try:
        data = request.get_json()
        query = data.get('query', '').strip()
        
        if not query:
            return jsonify({'success': False, 'error': 'No query provided'})
        
        # Basic security check - only allow SELECT statements for safety
        if not query.upper().startswith('SELECT'):
            return jsonify({'success': False, 'error': 'Only SELECT queries are allowed for safety'})
        
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute(query)
        results = cursor.fetchall()
        
        # Convert datetime objects to strings for JSON serialization
        for row in results:
            for key, value in row.items():
                if isinstance(value, datetime):
                    row[key] = value.isoformat()
        
        cursor.close()
        conn.close()
        
        return jsonify({'success': True, 'results': results, 'count': len(results)})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/describe/<table_name>')
def describe_table(table_name):
    """Get table structure"""
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute(f"DESCRIBE `{table_name}`")
        structure = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return jsonify({'success': True, 'structure': structure})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    print("🚀 Starting MySQL Development Viewer...")
    print(f"📊 Database: {MYSQL_CONFIG['database']} @ {MYSQL_CONFIG['host']}:{MYSQL_CONFIG['port']}")
    print("🌐 Open your browser to: http://localhost:8080")
    print("⚠️  Note: Only SELECT queries are allowed for safety")
    
    app.run(host='0.0.0.0', port=8080, debug=True)
