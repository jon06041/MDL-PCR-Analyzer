#!/usr/bin/env python3
"""
Alternative entry point for Railway deployment
This file imports and runs the Flask application from app.py
"""

# Import the Flask application
from app import app

if __name__ == '__main__':
    import os
    
    # Railway deployment configuration
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    
    # Run the application
    app.run(host=host, port=port, debug=False)