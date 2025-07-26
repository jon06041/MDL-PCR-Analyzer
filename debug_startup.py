#!/usr/bin/env python3
"""
Debug startup to find exactly where app.py hangs
"""

print("=== DEBUG STARTUP TEST ===")

# Test step by step what app.py does at module level
print("1. Testing basic Flask import...")
from flask import Flask, request, jsonify, render_template, send_file, redirect, url_for, session, send_from_directory

print("2. Testing other imports...")
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

print("3. Testing ML imports...")
try:
    from sklearn.preprocessing import StandardScaler
    from sklearn.ensemble import RandomForestClassifier, IsolationForest
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, accuracy_score
    import joblib
    print("   ML imports successful")
except Exception as e:
    print(f"   ML import error: {e}")

print("4. Testing custom module imports...")
try:
    from qpcr_analyzer import QPCRAnalyzer
    print("   QPCRAnalyzer imported")
except Exception as e:
    print(f"   QPCRAnalyzer error: {e}")

try:
    from models import AnalysisSession, AnalysisResult, ControlData, ValidationStatus
    print("   Models imported")
except Exception as e:
    print(f"   Models error: {e}")

try:
    from sql_integration import DatabaseManager
    print("   DatabaseManager imported")
except Exception as e:
    print(f"   DatabaseManager error: {e}")

try:
    from threshold_backend import ThresholdBackend
    print("   ThresholdBackend imported")
except Exception as e:
    print(f"   ThresholdBackend error: {e}")

# This is where it might hang - ML managers
print("5. Testing ML manager imports...")
try:
    from ml_config_manager import MLConfigManager
    print("   MLConfigManager imported")
    ml_config = MLConfigManager()
    print("   MLConfigManager instantiated")
except Exception as e:
    print(f"   MLConfigManager error: {e}")

try:
    from ml_validation_manager import MLModelValidationManager
    print("   MLModelValidationManager imported")
    ml_validation = MLModelValidationManager('qpcr_analysis.db')
    print("   MLModelValidationManager instantiated")
except Exception as e:
    print(f"   MLModelValidationManager error: {e}")

try:
    from unified_compliance_manager import UnifiedComplianceManager
    print("   UnifiedComplianceManager imported")
    compliance = UnifiedComplianceManager()
    print("   UnifiedComplianceManager instantiated")
except Exception as e:
    print(f"   UnifiedComplianceManager error: {e}")

print("6. Creating Flask app...")
app = Flask(__name__)

print("7. All imports and initializations successful!")
print("8. Would start Flask server here...")
