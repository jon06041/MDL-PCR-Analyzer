#!/usr/bin/env python3
"""
SQLite to MySQL Migration Helper
This script helps identify and fix remaining SQLite references in the codebase.
"""

import os
import re
from pathlib import Path

def find_sqlite_references():
    """Find all SQLite references in Python files"""
    sqlite_patterns = [
        r'import sqlite3',
        r'sqlite3\.',
        r'\.db["\']',
        r'AUTOINCREMENT',
        r'INTEGER PRIMARY KEY',
        r'PRAGMA',
    ]
    
    python_files = []
    for root, dirs, files in os.walk('.'):
        for file in files:
            if file.endswith('.py') and not file.startswith('initialize_mysql'):
                python_files.append(os.path.join(root, file))
    
    issues = []
    for file_path in python_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            file_issues = []
            for line_num, line in enumerate(content.split('\n'), 1):
                for pattern in sqlite_patterns:
                    if re.search(pattern, line, re.IGNORECASE):
                        file_issues.append({
                            'line': line_num,
                            'content': line.strip(),
                            'pattern': pattern
                        })
            
            if file_issues:
                issues.append({
                    'file': file_path,
                    'issues': file_issues
                })
                
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
    
    return issues

def main():
    """Main function to identify SQLite issues"""
    print("🔍 Scanning for SQLite references that need MySQL conversion...")
    
    issues = find_sqlite_references()
    
    if not issues:
        print("✅ No SQLite references found! Migration appears complete.")
        return
    
    print(f"\n❌ Found SQLite references in {len(issues)} files:")
    
    for issue in issues:
        print(f"\n📄 {issue['file']}:")
        for item in issue['issues'][:5]:  # Show first 5 issues per file
            print(f"  Line {item['line']}: {item['content']}")
        if len(issue['issues']) > 5:
            print(f"  ... and {len(issue['issues']) - 5} more issues")
    
    print("\n🔧 Priority files to fix:")
    priority_files = [f for f in issues if any([
        'app.py' in f['file'],
        'models.py' in f['file'], 
        'compliance' in f['file'].lower(),
        'backup' in f['file'].lower()
    ])]
    
    for pf in priority_files:
        print(f"  🎯 {pf['file']} ({len(pf['issues'])} issues)")
    
    print("\n💡 Quick fixes:")
    print("  - Replace 'import sqlite3' with 'import pymysql' or use SQLAlchemy")
    print("  - Replace 'AUTOINCREMENT' with 'AUTO_INCREMENT'")
    print("  - Replace 'INTEGER PRIMARY KEY' with 'INT AUTO_INCREMENT PRIMARY KEY'")
    print("  - Replace '.db' file extensions with MySQL connection strings")
    print("  - Remove 'PRAGMA' statements (MySQL doesn't use them)")

if __name__ == "__main__":
    main()
