#!/usr/bin/env python3
"""
Minimal health check test to identify what's causing Railway deployment issues
"""

import sys
import os

print("=== RAILWAY HEALTH CHECK DEBUG ===")
print(f"Python version: {sys.version}")
print(f"Current working directory: {os.getcwd()}")
print(f"PORT environment variable: {os.environ.get('PORT', 'Not set')}")
print(f"DATABASE_URL environment variable: {'Set' if os.environ.get('DATABASE_URL') else 'Not set'}")

# Test 1: Basic imports
print("\n1. Testing basic imports...")
try:
    import json
    import re
    import traceback
    import numpy as np
    from datetime import datetime
    print("✓ Basic imports successful")
except Exception as e:
    print(f"✗ Basic imports failed: {e}")
    sys.exit(1)

# Test 2: Flask import
print("\n2. Testing Flask import...")
try:
    from flask import Flask, request, jsonify, send_from_directory
    print("✓ Flask import successful")
except Exception as e:
    print(f"✗ Flask import failed: {e}")
    sys.exit(1)

# Test 3: Try qpcr_analyzer import (this might be the culprit)
print("\n3. Testing qpcr_analyzer import...")
try:
    from qpcr_analyzer import process_csv_data, validate_csv_structure
    print("✓ qpcr_analyzer import successful")
except Exception as e:
    print(f"✗ qpcr_analyzer import failed: {e}")
    print("This might be the cause of the health check failure!")

# Test 4: Try models import
print("\n4. Testing models import...")
try:
    from models import db, AnalysisSession, WellResult, ExperimentStatistics
    print("✓ models import successful")
except Exception as e:
    print(f"✗ models import failed: {e}")

# Test 5: Try SQLAlchemy imports
print("\n5. Testing SQLAlchemy imports...")
try:
    from sqlalchemy.orm import DeclarativeBase
    from sqlalchemy.exc import OperationalError, IntegrityError, DatabaseError
    print("✓ SQLAlchemy imports successful")
except Exception as e:
    print(f"✗ SQLAlchemy imports failed: {e}")

# Test 6: Create minimal Flask app
print("\n6. Testing minimal Flask app creation...")
try:
    app = Flask(__name__)
    app.secret_key = "test_key"
    
    @app.route('/health')
    def health():
        return jsonify({
            'status': 'healthy',
            'message': 'Minimal health check',
            'timestamp': datetime.utcnow().isoformat()
        })
    
    print("✓ Minimal Flask app created successfully")
    print("✓ Health route defined")
    
    # Test the health route without starting server
    with app.test_client() as client:
        response = client.get('/health')
        print(f"✓ Health endpoint test: {response.status_code}")
        print(f"✓ Health response: {response.get_json()}")
        
except Exception as e:
    print(f"✗ Flask app creation failed: {e}")

print("\n=== HEALTH CHECK DEBUG COMPLETE ===")
