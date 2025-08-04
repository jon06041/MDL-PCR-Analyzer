#!/usr/bin/env python3
"""
Step-by-step diagnostic to find where app.py hangs
"""

print("=== APP.PY HANG DIAGNOSTIC ===")

# Step 1: Basic imports
print("1. Testing basic imports...")
try:
    from flask import Flask, request, jsonify, render_template, send_file, redirect, url_for, session, send_from_directory
    import os
    import json
    import sqlite3
    import pandas as pd
    import numpy as np
    from datetime import datetime, timedelta
    import tempfile
    import shutil
    import zipfile
    import threading
    import time
    import uuid
    import logging
    import io
    print("   ✓ Basic imports successful")
except Exception as e:
    print(f"   ✗ Basic import error: {e}")
    exit(1)

# Step 2: ML imports  
print("2. Testing ML imports...")
try:
    from sklearn.preprocessing import StandardScaler
    from sklearn.ensemble import RandomForestClassifier, IsolationForest
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, accuracy_score
    import joblib
    print("   ✓ ML imports successful")
except Exception as e:
    print(f"   ✗ ML import error: {e}")

# Step 3: Check each custom module one by one
print("3. Testing custom module imports individually...")

print("   3a. Testing qpcr_analyzer...")
try:
    import qpcr_analyzer
    print("      ✓ qpcr_analyzer module loaded")
    # Check what's actually in the module
    items = [item for item in dir(qpcr_analyzer) if not item.startswith('_')]
    print(f"      Available classes/functions: {items}")
except Exception as e:
    print(f"      ✗ qpcr_analyzer error: {e}")

print("   3b. Testing models...")
try:
    import models
    print("      ✓ models module loaded")
    items = [item for item in dir(models) if not item.startswith('_')]
    print(f"      Available classes/functions: {items}")
except Exception as e:
    print(f"      ✗ models error: {e}")

print("   3c. Testing sql_integration...")
try:
    import sql_integration
    print("      ✓ sql_integration module loaded")
    items = [item for item in dir(sql_integration) if not item.startswith('_')]
    print(f"      Available classes/functions: {items}")
except Exception as e:
    print(f"      ✗ sql_integration error: {e}")

print("   3d. Testing threshold_backend...")
try:
    import threshold_backend
    print("      ✓ threshold_backend module loaded")
    items = [item for item in dir(threshold_backend) if not item.startswith('_')]
    print(f"      Available classes/functions: {items}")
except Exception as e:
    print(f"      ✗ threshold_backend error: {e}")

print("   3e. Testing curve_classification...")
try:
    import curve_classification
    print("      ✓ curve_classification module loaded")
    items = [item for item in dir(curve_classification) if not item.startswith('_')]
    print(f"      Available classes/functions: {items}")
except Exception as e:
    print(f"      ✗ curve_classification error: {e}")

print("   3f. Testing ml_curve_classifier...")
try:
    import ml_curve_classifier
    print("      ✓ ml_curve_classifier module loaded")
    items = [item for item in dir(ml_curve_classifier) if not item.startswith('_')]
    print(f"      Available classes/functions: {items}")
    
    # This might be where it hangs - test ml_classifier instantiation
    print("      Testing ml_classifier instantiation...")
    if hasattr(ml_curve_classifier, 'ml_classifier'):
        print("      ✓ ml_classifier found")
        # Don't actually instantiate yet, just check it exists
    else:
        print("      ✗ ml_classifier not found")
        
except Exception as e:
    print(f"      ✗ ml_curve_classifier error: {e}")

print("4. All module imports tested. Creating minimal Flask app...")

app = Flask(__name__)

@app.route('/')
def home():
    return "Diagnostic app running"

print("5. Flask app created successfully!")
print("6. If we got here, the issue is likely in the ML classifier initialization")
print("   or in one of the manager instantiations in the main app.py")

if __name__ == '__main__':
    print("7. Starting Flask server...")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
