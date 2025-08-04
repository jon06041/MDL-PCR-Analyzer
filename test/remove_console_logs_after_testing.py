#!/usr/bin/env python3
"""
Script to remove console logs from ml_feedback_interface.js after testing is complete.
Run this script when you're ready to clean up all the debug logging.
"""

import re
import os

def remove_console_logs(file_path):
    """Remove or comment out console.log statements from the file."""
    
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Count existing console logs
    console_log_pattern = r'^\s*console\.(log|warn|error|info|debug)\([^;]*\);?\s*$'
    existing_logs = re.findall(console_log_pattern, content, re.MULTILINE)
    
    print(f"Found {len(existing_logs)} console log statements")
    
    # Remove console.log, console.warn, console.info, console.debug (but keep console.error)
    # Pattern to match console logs while preserving indentation and structure
    patterns_to_remove = [
        r'^\s*console\.log\([^;]*\);?\s*\n',
        r'^\s*console\.warn\([^;]*\);?\s*\n', 
        r'^\s*console\.info\([^;]*\);?\s*\n',
        r'^\s*console\.debug\([^;]*\);?\s*\n'
    ]
    
    # Apply each pattern
    for pattern in patterns_to_remove:
        content = re.sub(pattern, '', content, flags=re.MULTILINE)
    
    # Clean up any double newlines that might have been created
    content = re.sub(r'\n\n\n+', '\n\n', content)
    
    # Write the cleaned content back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    # Count remaining console logs
    remaining_logs = re.findall(console_log_pattern, content, re.MULTILINE)
    removed_count = len(existing_logs) - len(remaining_logs)
    
    print(f"Removed {removed_count} console log statements")
    print(f"Kept {len(remaining_logs)} console.error statements for debugging")
    print(f"Cleaned file: {file_path}")

if __name__ == "__main__":
    file_path = "/workspaces/MDL-PCR-Analyzer/static/ml_feedback_interface.js"
    
    print("🧹 Console Log Cleanup Tool")
    print("=" * 40)
    print(f"Target file: {file_path}")
    print()
    
    # Confirm before proceeding
    response = input("Are you sure you want to remove console logs? (y/N): ")
    if response.lower() != 'y':
        print("Cancelled.")
        exit(0)
    
    # Create backup first
    backup_path = file_path + ".backup"
    try:
        import shutil
        shutil.copy2(file_path, backup_path)
        print(f"✅ Created backup: {backup_path}")
    except Exception as e:
        print(f"❌ Failed to create backup: {e}")
        exit(1)
    
    # Remove console logs
    try:
        remove_console_logs(file_path)
        print("✅ Console log cleanup completed successfully!")
        print()
        print("💡 If you need to restore, use:")
        print(f"   cp {backup_path} {file_path}")
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        # Restore from backup on error
        try:
            shutil.copy2(backup_path, file_path)
            print("✅ Restored from backup due to error")
        except:
            print("❌ Failed to restore from backup")
