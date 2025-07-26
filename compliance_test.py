#!/usr/bin/env python3
"""
Test just the compliance functionality
"""
from flask import Flask, jsonify
from unified_compliance_manager import UnifiedComplianceManager

app = Flask(__name__)

# Initialize compliance manager
compliance_manager = UnifiedComplianceManager()

@app.route('/')
def home():
    return "Compliance test server running"

@app.route('/api/compliance/dashboard')
def compliance_dashboard():
    try:
        data = compliance_manager.get_dashboard_data()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/compliance/requirements')
def compliance_requirements():
    try:
        requirements = compliance_manager.get_requirements()
        return jsonify({'requirements': requirements})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Starting compliance test server...")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
