#!/usr/bin/env python3
"""
Fix Railway production database schema by adding missing columns
"""

import os
import sys

def fix_railway_schema():
    """Add missing columns to Railway production database"""
    
    # Import after sys.path setup
    try:
        from sqlalchemy import create_engine, text
    except ImportError:
        print("❌ SQLAlchemy not available")
        return False
    
    # Get Railway DATABASE_URL
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not found - this should run in Railway environment")
        return False
    
    # Convert mysql:// to mysql+pymysql://
    if database_url.startswith('mysql://'):
        database_url = database_url.replace('mysql://', 'mysql+pymysql://', 1)
    
    print(f"🔍 Connecting to Railway database...")
    
    try:
        engine = create_engine(database_url)
        
        with engine.connect() as conn:
            print("✅ Connected to Railway database")
            
            # Check current columns in analysis_sessions
            print("🔍 Checking current analysis_sessions columns...")
            result = conn.execute(text("DESCRIBE analysis_sessions"))
            existing_columns = [row[0] for row in result.fetchall()]
            print(f"📋 Existing columns: {existing_columns}")
            
            # Add missing columns if they don't exist
            columns_to_add = [
                ("confirmation_status", "VARCHAR(50) DEFAULT 'pending'"),
                ("confirmed_by", "VARCHAR(255) DEFAULT NULL"),
                ("confirmed_at", "TIMESTAMP DEFAULT NULL")
            ]
            
            for column_name, column_def in columns_to_add:
                if column_name not in existing_columns:
                    print(f"➕ Adding missing column: {column_name}")
                    alter_sql = f"ALTER TABLE analysis_sessions ADD COLUMN {column_name} {column_def}"
                    conn.execute(text(alter_sql))
                    conn.commit()
                    print(f"✅ Added column: {column_name}")
                else:
                    print(f"✅ Column already exists: {column_name}")
            
            # Verify the fix
            print("🔍 Verifying schema fix...")
            result = conn.execute(text("SELECT COUNT(*) FROM analysis_sessions WHERE confirmation_status = 'pending'"))
            pending_count = result.fetchone()[0]
            print(f"✅ Found {pending_count} pending sessions")
            
            return True
            
    except Exception as e:
        print(f"❌ Error fixing Railway schema: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Railway Schema Fix Tool")
    print("=" * 50)
    
    success = fix_railway_schema()
    
    if success:
        print("=" * 50)
        print("✅ Railway schema fix completed successfully!")
        print("🎯 Sessions endpoints should now work in production")
    else:
        print("=" * 50)
        print("❌ Railway schema fix failed")
        print("🔧 Manual intervention may be required")
        sys.exit(1)
