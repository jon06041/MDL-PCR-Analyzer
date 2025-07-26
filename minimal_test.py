#!/usr/bin/env python3
"""
Minimal test to see what's causing the hang
"""

print("Starting minimal test...")

# Test basic imports first
print("1. Testing Flask import...")
from flask import Flask

print("2. Testing other imports...")
import os

print("3. Creating Flask app...")
app = Flask(__name__)

@app.route('/')
def home():
    return "Minimal test working"

print("4. App created successfully")

if __name__ == '__main__':
    print("5. Starting server...")
    app.run(host='0.0.0.0', port=5000, debug=False)
