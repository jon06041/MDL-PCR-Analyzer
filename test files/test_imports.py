#!/usr/bin/env python3
"""
Test individual imports from qpcr_analyzer to find what's hanging
"""

import sys

print("=== TESTING QPCR_ANALYZER IMPORTS ===")

# Test each import individually
imports_to_test = [
    ("numpy", "import numpy as np"),
    ("scipy", "from scipy.optimize import curve_fit"),
    ("matplotlib_base", "import matplotlib"),
    ("matplotlib_backend", "matplotlib.use('Agg')"),
    ("matplotlib_pyplot", "import matplotlib.pyplot as plt"),
    ("sklearn", "from sklearn.metrics import r2_score"),
    ("pandas", "import pandas as pd"),
    ("warnings", "import warnings")
]

for name, import_stmt in imports_to_test:
    print(f"\nTesting {name}: {import_stmt}")
    try:
        exec(import_stmt)
        print(f"✓ {name} imported successfully")
    except Exception as e:
        print(f"✗ {name} import failed: {e}")
        sys.exit(1)

print("\n✓ All imports successful - issue might be elsewhere in qpcr_analyzer.py")

# Now test if there's any module-level code executing
print("\nTesting if qpcr_analyzer has module-level execution...")
try:
    import qpcr_analyzer
    print("✓ qpcr_analyzer imported successfully")
except Exception as e:
    print(f"✗ qpcr_analyzer import failed: {e}")
