#!/usr/bin/env python3
"""Test database initialization separately"""

import os
import sys

print("Starting database initialization test...")

try:
    print("1. Importing Flask and SQLAlchemy...")
    from flask import Flask
    from models import db
    from sqlalchemy.orm import DeclarativeBase
    print("✓ Imports OK")
except Exception as e:
    print(f"✗ Import failed: {e}")
    sys.exit(1)

try:
    print("2. Creating Flask app...")
    
    class Base(DeclarativeBase):
        pass

    app = Flask(__name__, static_folder='static', static_url_path='/static')
    app.secret_key = "test_secret_key"
    print("✓ Flask app created")
except Exception as e:
    print(f"✗ Flask app creation failed: {e}")
    sys.exit(1)

try:
    print("3. Configuring database...")
    database_url = os.environ.get("DATABASE_URL")
    if database_url and database_url.startswith("mysql"):
        # Production MySQL configuration
        app.config["SQLALCHEMY_DATABASE_URI"] = database_url
        app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
            "pool_recycle": 300,
            "pool_pre_ping": True,
            "pool_size": 10,
            "max_overflow": 20,
            "pool_timeout": 30,
        }
        print("Using MySQL database for production")
    else:
        # Development SQLite configuration
        sqlite_path = os.path.join(os.path.dirname(__file__), 'qpcr_analysis.db')
        app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{sqlite_path}"
        app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
            "pool_recycle": 300,
            "pool_pre_ping": True,
            "pool_timeout": 30,
            "pool_size": 10,
            "max_overflow": 20,
            "connect_args": {
                "timeout": 30,
                "check_same_thread": False
            }
        }
        print(f"Using SQLite database for development: {sqlite_path}")
    print("✓ Database configuration complete")
except Exception as e:
    print(f"✗ Database configuration failed: {e}")
    sys.exit(1)

try:
    print("4. Initializing database...")
    db.init_app(app)
    print("✓ Database initialization complete")
except Exception as e:
    print(f"✗ Database initialization failed: {e}")
    sys.exit(1)

try:
    print("5. Creating tables and applying optimizations...")
    # Create tables for database
    with app.app_context():
        # Configure SQLite for better concurrency and performance
        if not database_url or not database_url.startswith("mysql"):
            from sqlalchemy import text as sql_text
            try:
                # Set SQLite pragmas for better concurrency and performance
                db.session.execute(sql_text('PRAGMA journal_mode = WAL;'))        # Write-Ahead Logging
                db.session.execute(sql_text('PRAGMA synchronous = NORMAL;'))      # Faster writes
                db.session.execute(sql_text('PRAGMA cache_size = 10000;'))        # Larger cache
                db.session.execute(sql_text('PRAGMA temp_store = MEMORY;'))       # Memory temp store
                db.session.execute(sql_text('PRAGMA busy_timeout = 30000;'))      # 30 second timeout
                db.session.execute(sql_text('PRAGMA foreign_keys = ON;'))         # Enable foreign keys
                db.session.commit()
                print("SQLite performance optimizations applied")
            except Exception as e:
                print(f"Warning: Could not apply SQLite optimizations: {e}")
        
        db.create_all()
        print("✓ Tables created")
except Exception as e:
    print(f"✗ Table creation failed: {e}")
    sys.exit(1)

print("Database initialization test completed successfully!")
