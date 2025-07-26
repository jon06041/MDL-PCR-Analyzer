#!/usr/bin/env python3
"""
Quick test to see where the app hangs during startup
"""

print("1. Starting imports...")

from flask import Flask
print("2. Flask imported")

import sqlite3
print("3. SQLite imported")

# Test database connection
print("4. Testing database connection...")
conn = sqlite3.connect('qpcr_analysis.db', timeout=30.0)
conn.row_factory = sqlite3.Row
conn.execute('PRAGMA journal_mode=WAL')
conn.close()
print("5. Database connection successful")

# Try importing our managers
print("6. Importing ML Config Manager...")
from ml_config_manager import MLConfigManager
print("7. ML Config Manager imported")

print("8. Creating ML Config Manager instance...")
ml_config = MLConfigManager()
print("9. ML Config Manager created")

print("10. Importing other managers...")
try:
    from ml_validation_manager import MLValidationManager
    print("11. ML Validation Manager imported")
    ml_validation = MLValidationManager()
    print("12. ML Validation Manager created")
except Exception as e:
    print(f"Error with ML Validation Manager: {e}")

try:
    from unified_compliance_manager import UnifiedComplianceManager
    print("13. Unified Compliance Manager imported")
    compliance = UnifiedComplianceManager()
    print("14. Unified Compliance Manager created")
except Exception as e:
    print(f"Error with Compliance Manager: {e}")

print("15. All managers loaded successfully!")

# Test a simple Flask app
print("16. Creating Flask app...")
app = Flask(__name__)

@app.route('/')
def home():
    return "Test successful"

print("17. Flask app created, ready to run")
print("18. Starting Flask server...")
app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
