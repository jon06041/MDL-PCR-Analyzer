#!/usr/bin/env python3
"""Test imports one by one to identify hanging module"""

import sys
print("Starting import tests...")

try:
    print("1. Importing Flask...")
    from flask import Flask, request, jsonify, send_from_directory
    print("✓ Flask imports OK")
except Exception as e:
    print(f"✗ Flask import failed: {e}")
    sys.exit(1)

try:
    print("2. Importing standard library...")
    import json
    import os
    import re
    import traceback
    import logging
    from logging.handlers import RotatingFileHandler
    print("✓ Standard library imports OK")
except Exception as e:
    print(f"✗ Standard library import failed: {e}")
    sys.exit(1)

try:
    print("3. Importing numpy...")
    import numpy as np
    print("✓ Numpy import OK")
except Exception as e:
    print(f"✗ Numpy import failed: {e}")
    sys.exit(1)

try:
    print("4. Importing datetime...")
    from datetime import datetime
    print("✓ Datetime import OK")
except Exception as e:
    print(f"✗ Datetime import failed: {e}")
    sys.exit(1)

try:
    print("5. Importing qpcr_analyzer...")
    from qpcr_analyzer import process_csv_data, validate_csv_structure
    print("✓ qpcr_analyzer import OK")
except Exception as e:
    print(f"✗ qpcr_analyzer import failed: {e}")
    sys.exit(1)

try:
    print("6. Importing models...")
    from models import db, AnalysisSession, WellResult, ExperimentStatistics
    print("✓ models import OK")
except Exception as e:
    print(f"✗ models import failed: {e}")
    sys.exit(1)

try:
    print("7. Importing SQLAlchemy...")
    from sqlalchemy.orm import DeclarativeBase
    from sqlalchemy.exc import OperationalError, IntegrityError, DatabaseError
    print("✓ SQLAlchemy imports OK")
except Exception as e:
    print(f"✗ SQLAlchemy import failed: {e}")
    sys.exit(1)

try:
    print("8. Importing threshold_backend...")
    from threshold_backend import create_threshold_routes
    print("✓ threshold_backend import OK")
except Exception as e:
    print(f"✗ threshold_backend import failed: {e}")
    sys.exit(1)

try:
    print("9. Importing cqj_calcj_utils...")
    from cqj_calcj_utils import calculate_cqj_calcj_for_well
    print("✓ cqj_calcj_utils import OK")
except Exception as e:
    print(f"✗ cqj_calcj_utils import failed: {e}")
    sys.exit(1)

try:
    print("10. Importing ml_config_manager...")
    from ml_config_manager import MLConfigManager
    print("✓ ml_config_manager import OK")
except Exception as e:
    print(f"✗ ml_config_manager import failed: {e}")
    sys.exit(1)

try:
    print("11. Importing fda_compliance_manager...")
    from fda_compliance_manager import FDAComplianceManager
    print("✓ fda_compliance_manager import OK")
except Exception as e:
    print(f"✗ fda_compliance_manager import failed: {e}")
    sys.exit(1)

try:
    print("12. Importing unified_compliance_manager...")
    from unified_compliance_manager import UnifiedComplianceManager
    print("✓ unified_compliance_manager import OK")
except Exception as e:
    print(f"✗ unified_compliance_manager import failed: {e}")
    sys.exit(1)

print("All imports completed successfully!")
