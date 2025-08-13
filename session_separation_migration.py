#!/usr/bin/env python3
"""
Session Type Separation Migration Script

Creates a new table structure to separate:
1. Analysis Sessions - For viewing/reloading runs
2. Pending Confirmations - For ML training accuracy determination

This ensures that deleting one doesn't affect the other.
"""

import mysql.connector
import os
import json
from datetime import datetime

def get_mysql_config():
    """Get MySQL configuration"""
    return {
        'host': os.environ.get('MYSQL_HOST', 'localhost'),
        'user': os.environ.get('MYSQL_USER', 'qpcr_user'), 
        'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
        'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis')
    }

def create_pending_confirmations_table():
    """Create the new pending_confirmations table"""
    
    mysql_config = get_mysql_config()
    
    try:
        connection = mysql.connector.connect(**mysql_config)
        cursor = connection.cursor()
        
        print("🔧 Creating pending_confirmations table...")
        
        # Create pending_confirmations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pending_confirmations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                analysis_session_id INT NOT NULL,
                confirmation_session_id VARCHAR(255) UNIQUE NOT NULL,
                filename VARCHAR(255) NOT NULL,
                fluorophore VARCHAR(20),
                pathogen_code VARCHAR(50),
                total_wells INT NOT NULL DEFAULT 0,
                good_curves INT NOT NULL DEFAULT 0,
                success_rate FLOAT NOT NULL DEFAULT 0.0,
                pathogen_breakdown TEXT,
                ml_analysis_triggered BOOLEAN DEFAULT FALSE,
                ml_model_version VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                confirmed_at TIMESTAMP NULL,
                confirmed_by VARCHAR(255) NULL,
                is_confirmed BOOLEAN DEFAULT FALSE,
                confirmation_status ENUM('pending', 'confirmed', 'rejected') DEFAULT 'pending',
                rejection_reason TEXT NULL,
                
                INDEX idx_analysis_session_id (analysis_session_id),
                INDEX idx_confirmation_session_id (confirmation_session_id),
                INDEX idx_pathogen_code (pathogen_code),
                INDEX idx_fluorophore (fluorophore),
                INDEX idx_confirmation_status (confirmation_status),
                INDEX idx_is_confirmed (is_confirmed),
                INDEX idx_ml_analysis_triggered (ml_analysis_triggered),
                
                FOREIGN KEY (analysis_session_id) REFERENCES analysis_sessions(id) ON DELETE CASCADE
            )
        """)
        
        print("✅ pending_confirmations table created successfully")
        
        # Add session_type column to analysis_sessions for clarity (check if exists first)
        try:
            cursor.execute("SHOW COLUMNS FROM analysis_sessions LIKE 'session_type'")
            if not cursor.fetchone():
                cursor.execute("""
                    ALTER TABLE analysis_sessions 
                    ADD COLUMN session_type ENUM('analysis', 'combined') DEFAULT 'analysis'
                """)
                print("✅ Added session_type column to analysis_sessions")
            else:
                print("ℹ️  session_type column already exists in analysis_sessions")
        except Exception as e:
            print(f"⚠️  Could not add session_type column: {e}")
        
        # Add metadata columns for better tracking (check if exists first)
        try:
            cursor.execute("SHOW COLUMNS FROM analysis_sessions LIKE 'created_by'")
            if not cursor.fetchone():
                cursor.execute("""
                    ALTER TABLE analysis_sessions 
                    ADD COLUMN created_by VARCHAR(255) NULL
                """)
                print("✅ Added created_by column to analysis_sessions")
            else:
                print("ℹ️  created_by column already exists in analysis_sessions")
                
            cursor.execute("SHOW COLUMNS FROM analysis_sessions LIKE 'updated_at'")
            if not cursor.fetchone():
                cursor.execute("""
                    ALTER TABLE analysis_sessions 
                    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                """)
                print("✅ Added updated_at column to analysis_sessions")
            else:
                print("ℹ️  updated_at column already exists in analysis_sessions")
        except Exception as e:
            print(f"⚠️  Could not add metadata columns: {e}")
        
        cursor.close()
        connection.close()
        
        print("🎯 Session separation table structure created successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error creating pending_confirmations table: {e}")
        return False

def migrate_existing_pending_sessions():
    """Migrate existing pending sessions to the new structure"""
    
    mysql_config = get_mysql_config()
    
    try:
        connection = mysql.connector.connect(**mysql_config)
        cursor = connection.cursor(dictionary=True)
        
        print("🔄 Migrating existing pending sessions...")
        
        # Find sessions that are currently considered "pending" 
        # (all existing sessions should become pending confirmations)
        cursor.execute("""
            SELECT id, filename, total_wells, good_curves, success_rate, 
                   pathogen_breakdown, upload_timestamp
            FROM analysis_sessions 
            ORDER BY upload_timestamp DESC
        """)
        
        existing_sessions = cursor.fetchall()
        print(f"📊 Found {len(existing_sessions)} existing sessions to process")
        
        migrated_count = 0
        for session in existing_sessions:
            # Extract fluorophore from filename if possible
            fluorophore = None
            filename = session['filename']
            for fluor in ['Cy5', 'FAM', 'HEX', 'Texas Red']:
                if f'_{fluor}.csv' in filename or f'_{fluor}_' in filename:
                    fluorophore = fluor
                    break
            
            # Extract pathogen code from filename pattern
            pathogen_code = None
            if '_' in filename:
                test_code = filename.split('_')[0]
                if test_code.startswith('Ac'):
                    pathogen_code = test_code[2:]  # Remove "Ac" prefix
                else:
                    pathogen_code = test_code
            
            # Generate confirmation session ID
            confirmation_session_id = f"CONF_{session['id']}_{int(datetime.now().timestamp())}"
            
            # Check if already migrated
            cursor.execute("SELECT id FROM pending_confirmations WHERE analysis_session_id = %s", (session['id'],))
            if cursor.fetchone():
                print(f"⏭️  Session {session['id']} already migrated, skipping")
                continue
            
            # Create pending confirmation entry
            cursor.execute("""
                INSERT INTO pending_confirmations 
                (analysis_session_id, confirmation_session_id, filename, fluorophore, 
                 pathogen_code, total_wells, good_curves, success_rate, pathogen_breakdown)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                session['id'],
                confirmation_session_id, 
                filename,
                fluorophore,
                pathogen_code,
                session['total_wells'],
                session['good_curves'], 
                session['success_rate'],
                session['pathogen_breakdown']
            ))
            
            migrated_count += 1
            print(f"✅ Migrated session {session['id']}: {filename}")
        
        # Commit the migration
        connection.commit()
        cursor.close()
        connection.close()
        
        print(f"✅ Migrated {migrated_count} sessions to pending_confirmations table")
        return True
        
    except Exception as e:
        print(f"❌ Error migrating existing sessions: {e}")
        return False

def verify_migration():
    """Verify the migration was successful"""
    
    mysql_config = get_mysql_config()
    
    try:
        connection = mysql.connector.connect(**mysql_config)
        cursor = connection.cursor()
        
        print("🔍 Verifying migration...")
        
        # Check analysis_sessions table
        cursor.execute("SELECT COUNT(*) FROM analysis_sessions")
        analysis_count = cursor.fetchone()[0]
        
        # Check pending_confirmations table  
        cursor.execute("SELECT COUNT(*) FROM pending_confirmations")
        confirmation_count = cursor.fetchone()[0]
        
        # Check foreign key relationships
        cursor.execute("""
            SELECT COUNT(*) FROM pending_confirmations pc
            INNER JOIN analysis_sessions a ON pc.analysis_session_id = a.id
        """)
        linked_count = cursor.fetchone()[0]
        
        cursor.close()
        connection.close()
        
        print(f"📊 Analysis sessions: {analysis_count}")
        print(f"📊 Pending confirmations: {confirmation_count}")
        print(f"📊 Linked confirmations: {linked_count}")
        
        if confirmation_count > 0 and linked_count == confirmation_count:
            print("✅ Migration verification successful!")
            return True
        else:
            print("⚠️  Migration verification found issues")
            return False
            
    except Exception as e:
        print(f"❌ Error verifying migration: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Starting Session Type Separation Migration")
    print("=" * 50)
    
    # Step 1: Create new table structure
    if create_pending_confirmations_table():
        print()
        
        # Step 2: Migrate existing data
        if migrate_existing_pending_sessions():
            print()
            
            # Step 3: Verify migration
            if verify_migration():
                print()
                print("🎯 Session separation migration completed successfully!")
                print()
                print("📋 Next steps:")
                print("1. Update API endpoints to use new table structure")
                print("2. Update frontend to handle separate session types")
                print("3. Add admin-only delete buttons") 
                print("4. Test independent deletion functionality")
            else:
                print("❌ Migration verification failed")
        else:
            print("❌ Data migration failed")
    else:
        print("❌ Table creation failed")
