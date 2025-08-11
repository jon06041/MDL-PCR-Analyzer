#!/usr/bin/env python3
"""
Duplicate Prevention Module for PCR Analyzer

This module provides validation functions to prevent duplicates before they are created.
Import and use these functions in the main application to avoid accumulating duplicates.

Usage:
    from duplicate_prevention import prevent_ml_run_duplicate, prevent_evidence_duplicate
    
    # Before creating ML run
    if not prevent_ml_run_duplicate(file_name, pathogen_codes):
        # Create the ML run
        
    # Before logging evidence
    if not prevent_evidence_duplicate(requirement_id, description, file_name, fluorophore):
        # Log the evidence
"""

import mysql.connector
import os
import hashlib
from datetime import datetime, timedelta

def get_mysql_connection():
    """Get MySQL database connection"""
    mysql_config = {
        'host': os.environ.get('MYSQL_HOST', 'localhost'),
        'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
        'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
        'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis')
    }
    return mysql.connector.connect(**mysql_config)

def extract_base_filename(filename):
    """Extract base filename by removing channel-specific suffixes"""
    if not filename:
        return ""
    
    # Remove channel-specific suffixes
    base = filename.split(' - ')[0]  # Remove " - Quantification..." part
    
    # Remove CSV and channel suffixes
    suffixes = ['_FAM.csv', '_HEX.csv', '_Texas Red.csv', '_Cy5.csv', '.csv']
    for suffix in suffixes:
        if base.endswith(suffix):
            base = base[:-len(suffix)]
    
    return base

def prevent_ml_run_duplicate(file_name, pathogen_codes, hours_window=24):
    """
    Check if an ML run for this base file already exists within the time window.
    
    Args:
        file_name: Full filename (may include channel suffix)
        pathogen_codes: Pathogen codes for this run
        hours_window: How many hours to look back for duplicates (default 24)
    
    Returns:
        True if duplicate found (should prevent creation)
        False if no duplicate (safe to create)
    """
    try:
        conn = get_mysql_connection()
        cursor = conn.cursor()
        
        # Extract base filename
        base_file = extract_base_filename(file_name)
        
        # Look for existing pending runs with same base file in time window
        time_threshold = datetime.now() - timedelta(hours=hours_window)
        
        cursor.execute('''
            SELECT id, file_name, logged_at 
            FROM ml_analysis_runs 
            WHERE status = 'pending' 
              AND logged_at > %s
              AND (file_name LIKE %s OR file_name LIKE %s)
        ''', (time_threshold, f"{base_file}%", f"%{base_file}%"))
        
        existing_runs = cursor.fetchall()
        
        # Check if any existing run has the same base file
        for run_id, existing_file, logged_at in existing_runs:
            existing_base = extract_base_filename(existing_file)
            if existing_base == base_file:
                print(f"🚨 DUPLICATE PREVENTION: ML run for '{base_file}' already exists (ID: {run_id}, logged: {logged_at})")
                cursor.close()
                conn.close()
                return True  # Duplicate found, prevent creation
        
        cursor.close()
        conn.close()
        return False  # No duplicate, safe to create
        
    except Exception as e:
        print(f"⚠️  Error checking ML run duplicates: {e}")
        return False  # On error, allow creation (better than blocking)

def prevent_evidence_duplicate(requirement_id, description, file_name=None, fluorophore=None, hours_window=1):
    """
    Check if identical evidence already exists within the time window.
    
    Args:
        requirement_id: FDA requirement ID
        description: Evidence description
        file_name: File name (optional)
        fluorophore: Fluorophore channel (optional)
        hours_window: How many hours to look back for duplicates (default 1)
    
    Returns:
        True if duplicate found (should prevent creation)
        False if no duplicate (safe to create)
    """
    try:
        conn = get_mysql_connection()
        cursor = conn.cursor()
        
        # Look for existing evidence with same key fields in time window
        time_threshold = datetime.now() - timedelta(hours=hours_window)
        
        cursor.execute('''
            SELECT id, logged_at 
            FROM compliance_evidence 
            WHERE requirement_id = %s
              AND description = %s
              AND COALESCE(file_name, '') = COALESCE(%s, '')
              AND COALESCE(fluorophore, '') = COALESCE(%s, '')
              AND logged_at > %s
        ''', (requirement_id, description, file_name, fluorophore, time_threshold))
        
        existing_evidence = cursor.fetchall()
        
        if existing_evidence:
            evidence_id, logged_at = existing_evidence[0]
            print(f"🚨 DUPLICATE PREVENTION: Evidence for '{requirement_id}' already exists (ID: {evidence_id}, logged: {logged_at})")
            cursor.close()
            conn.close()
            return True  # Duplicate found, prevent creation
        
        cursor.close()
        conn.close()
        return False  # No duplicate, safe to create
        
    except Exception as e:
        print(f"⚠️  Error checking evidence duplicates: {e}")
        return False  # On error, allow creation (better than blocking)

def log_duplicate_prevention(category, details):
    """Log when duplicate prevention occurs for monitoring purposes."""
    timestamp = datetime.now().isoformat()
    print(f"[{timestamp}] DUPLICATE PREVENTED - {category}: {details}")
    
    # Optionally log to a file for monitoring
    try:
        with open('duplicate_prevention.log', 'a') as f:
            f.write(f"[{timestamp}] {category}: {details}\n")
    except:
        pass  # Don't fail if logging fails

# Integration helpers for existing code
def validate_ml_run_creation(file_name, pathogen_codes):
    """Wrapper function with logging for ML run validation."""
    if prevent_ml_run_duplicate(file_name, pathogen_codes):
        base_file = extract_base_filename(file_name)
        log_duplicate_prevention("ML_RUN", f"Prevented duplicate ML run for {base_file}")
        return False  # Don't create
    return True  # Safe to create

def validate_evidence_creation(requirement_id, description, file_name=None, fluorophore=None):
    """Wrapper function with logging for evidence validation."""
    if prevent_evidence_duplicate(requirement_id, description, file_name, fluorophore):
        log_duplicate_prevention("EVIDENCE", f"Prevented duplicate evidence for {requirement_id}: {description[:50]}...")
        return False  # Don't create
    return True  # Safe to create

if __name__ == "__main__":
    # Test the validation functions
    print("🧪 Testing duplicate prevention functions...")
    
    # Test ML run validation
    test_file = "AcBVPanelPCR3_2576724_CFX366953_FAM.csv"
    test_pathogen = "BVAB1,CTRACH,NGON"
    
    result = prevent_ml_run_duplicate(test_file, test_pathogen)
    print(f"ML run duplicate check for '{test_file}': {'DUPLICATE FOUND' if result else 'NO DUPLICATE'}")
    
    # Test evidence validation
    test_req = "CFR_11_10_A"
    test_desc = "Data integrity checks and file validation logs"
    test_fluoro = "FAM"
    
    result = prevent_evidence_duplicate(test_req, test_desc, test_file, test_fluoro)
    print(f"Evidence duplicate check for '{test_req}': {'DUPLICATE FOUND' if result else 'NO DUPLICATE'}")
