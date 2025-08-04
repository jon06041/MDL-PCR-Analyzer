#!/usr/bin/env python3
"""
Quick script to remove console.log statements from ml_feedback_interface.js
Run this after testing is complete to clean up debug logs.
"""

import re

def remove_console_logs_from_file(file_path):
    """Remove console.log, console.warn, and console.error statements from a JavaScript file"""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_lines = len(content.split('\n'))
    
    # Patterns to match console statements
    patterns = [
        # Single line console statements
        r'^\s*console\.(log|warn|error|info|debug)\([^;]*\);\s*$',
        # Multi-line console statements
        r'^\s*console\.(log|warn|error|info|debug)\([^)]*(?:\n[^)]*)*\);\s*$',
    ]
    
    # Remove console statements line by line
    lines = content.split('\n')
    cleaned_lines = []
    skip_next = False
    
    for i, line in enumerate(lines):
        # Skip if previous line indicated we should skip this one
        if skip_next:
            skip_next = False
            continue
            
        # Check if this line is a console statement
        is_console_line = False
        for pattern in patterns:
            if re.match(pattern, line, re.MULTILINE):
                is_console_line = True
                break
        
        # Also check for multi-line console statements that start but don't end on same line
        if re.match(r'^\s*console\.(log|warn|error|info|debug)\(', line) and not line.rstrip().endswith(');'):
            # This is start of multi-line console statement, find the end
            bracket_count = line.count('(') - line.count(')')
            current_line = i
            while bracket_count > 0 and current_line < len(lines) - 1:
                current_line += 1
                bracket_count += lines[current_line].count('(') - lines[current_line].count(')')
            
            # Skip all lines in this console statement
            if bracket_count == 0 and lines[current_line].rstrip().endswith(');'):
                # Valid multi-line console statement found, skip all these lines
                for skip_line in range(i, current_line + 1):
                    if skip_line not in [j for j, _ in enumerate(lines) if j < i]:  # Don't double-mark
                        is_console_line = True
                        if skip_line > i:  # Mark future lines to skip
                            lines[skip_line] = "___SKIP_THIS_LINE___"
        
        if not is_console_line and line != "___SKIP_THIS_LINE___":
            cleaned_lines.append(line)
    
    cleaned_content = '\n'.join(cleaned_lines)
    final_lines = len(cleaned_content.split('\n'))
    
    # Write back to file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(cleaned_content)
    
    removed_lines = original_lines - final_lines
    print(f"✅ Removed {removed_lines} lines of console logs from {file_path}")
    print(f"📊 File size: {original_lines} → {final_lines} lines")
    
    return removed_lines

if __name__ == "__main__":
    file_path = "/workspaces/MDL-PCR-Analyzer/static/ml_feedback_interface.js"
    
    print("🧹 Removing console logs from ML feedback interface...")
    print(f"📁 Target file: {file_path}")
    
    try:
        removed_count = remove_console_logs_from_file(file_path)
        if removed_count > 0:
            print(f"🎉 Successfully cleaned up {removed_count} console log statements!")
        else:
            print("ℹ️  No console logs found to remove.")
    except Exception as e:
        print(f"❌ Error: {e}")
