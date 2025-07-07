#!/usr/bin/env python3
"""Test script to identify startup issues for Railway deployment"""

import os
import sys

# Set production environment
os.environ['PORT'] = '5000'
os.environ['FLASK_ENV'] = 'production'

def test_step(step_name, func):
    """Test a specific step and report results"""
    try:
        print(f"✓ Testing {step_name}...")
        result = func()
        print(f"  ✓ {step_name} completed successfully")
        return result
    except Exception as e:
        print(f"  ✗ {step_name} failed: {e}")
        return None

def import_flask():
    from flask import Flask, jsonify
    return Flask, jsonify

def import_models():
    import models
    return models

def import_qpcr():
    import qpcr_analyzer
    return qpcr_analyzer

def create_minimal_app():
    from flask import Flask, jsonify
    app = Flask(__name__)
    
    @app.route('/ping')
    def ping():
        return jsonify({'status': 'ok', 'message': 'Server is running'})
    
    return app

def test_routes():
    app = create_minimal_app()
    with app.test_client() as client:
        response = client.get('/ping')
        return response.status_code, response.get_json()

if __name__ == '__main__':
    print("🚀 Railway Deployment Startup Test")
    print("=" * 50)
    
    # Test individual imports
    Flask, jsonify = test_step("Flask import", import_flask)
    if not Flask:
        sys.exit(1)
    
    models = test_step("Models import", import_models)
    qpcr = test_step("QPCR analyzer import", import_qpcr)
    
    # Test minimal app creation
    app = test_step("Minimal app creation", create_minimal_app)
    if not app:
        sys.exit(1)
    
    # Test routes
    status_code, response = test_step("Route testing", test_routes)
    if status_code:
        print(f"  Route response: {status_code} - {response}")
    
    print("=" * 50)
    print("🎉 All tests completed!")
    
    # Try importing the full app
    print("🔄 Testing full app import...")
    try:
        from app import app as full_app
        print("✓ Full app imported successfully!")
        
        # Test health endpoints
        with full_app.test_client() as client:
            ping_resp = client.get('/ping')
            print(f"✓ Ping endpoint: {ping_resp.status_code}")
            
            health_resp = client.get('/health')
            print(f"✓ Health endpoint: {health_resp.status_code}")
            
    except Exception as e:
        print(f"✗ Full app import failed: {e}")
        sys.exit(1)
        
    print("🎉 Full app startup test completed successfully!")
