#!/usr/bin/env python3
"""Test manager initializations separately"""

import os
import sys

print("Starting manager initialization test...")

sqlite_path = os.path.join(os.path.dirname(__file__), 'qpcr_analysis.db')
print(f"Using database: {sqlite_path}")

try:
    print("1. Testing MLConfigManager...")
    from ml_config_manager import MLConfigManager
    ml_config_manager = MLConfigManager(sqlite_path)
    print("✓ MLConfigManager initialized")
except Exception as e:
    print(f"✗ MLConfigManager failed: {e}")

try:
    print("2. Testing MLModelValidationManager...")
    from ml_validation_manager import MLModelValidationManager
    ml_validation_manager = MLModelValidationManager(sqlite_path)
    print("✓ MLModelValidationManager initialized")
except Exception as e:
    print(f"✗ MLModelValidationManager failed: {e}")

try:
    print("3. Testing FDAComplianceManager...")
    from fda_compliance_manager import FDAComplianceManager
    fda_compliance_manager = FDAComplianceManager(sqlite_path)
    print("✓ FDAComplianceManager initialized")
except Exception as e:
    print(f"✗ FDAComplianceManager failed: {e}")

try:
    print("4. Testing UnifiedComplianceManager...")
    from unified_compliance_manager import UnifiedComplianceManager
    unified_compliance_manager = UnifiedComplianceManager(sqlite_path)
    print("✓ UnifiedComplianceManager initialized")
except Exception as e:
    print(f"✗ UnifiedComplianceManager failed: {e}")

try:
    print("5. Testing threshold_backend...")
    from flask import Flask
    test_app = Flask(__name__)
    from threshold_backend import create_threshold_routes
    create_threshold_routes(test_app)
    print("✓ threshold_backend initialized")
except Exception as e:
    print(f"✗ threshold_backend failed: {e}")

print("Manager initialization test completed successfully!")
