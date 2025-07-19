#!/usr/bin/env python3
"""
Safely comment out all console logs in JavaScript files without causing syntax errors.
Handles multiline console statements and preserves code structure.
"""

import re
import sys
import os

def comment_console_logs(content):
    """
    Comment out all console log statements while preserving syntax.
    Handles multiline statements correctly.
    """
    # Pattern to match console.log, console.warn, console.error, console.info, console.debug
    # This pattern handles multiline console statements by matching opening parenthesis
    # and finding the corresponding closing parenthesis
    
    lines = content.split('\n')
    result_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Check if this line contains a console statement
        console_match = re.search(r'(\s*)(console\.(log|warn|error|info|debug)\s*\()', line)
        
        if console_match:
            indent = console_match.group(1)
            
            # Check if this line is already commented
            if line.strip().startswith('//'):
                result_lines.append(line)
                i += 1
                continue
            
            # Start collecting the complete console statement
            console_lines = [line]
            paren_count = line.count('(') - line.count(')')
            j = i + 1
            
            # If parentheses are balanced on this line, we're done
            if paren_count <= 0:
                # Comment out this single line
                result_lines.append(f"{indent}// {line.strip()}")
                i += 1
                continue
            
            # Collect additional lines until parentheses are balanced
            while j < len(lines) and paren_count > 0:
                next_line = lines[j]
                console_lines.append(next_line)
                paren_count += next_line.count('(') - next_line.count(')')
                j += 1
            
            # Comment out all lines of the multiline console statement
            for k, console_line in enumerate(console_lines):
                if k == 0:
                    # First line - add comment and preserve indentation
                    result_lines.append(f"{indent}// {console_line.strip()}")
                else:
                    # Subsequent lines - maintain their indentation but comment them out
                    line_indent = len(console_line) - len(console_line.lstrip())
                    if console_line.strip():
                        result_lines.append(f"{' ' * line_indent}// {console_line.strip()}")
                    else:
                        result_lines.append(console_line)  # Preserve empty lines
            
            i = j
        else:
            result_lines.append(line)
            i += 1
    
    return '\n'.join(result_lines)

def process_file(file_path):
    """Process a single JavaScript file."""
    print(f"Processing {file_path}...")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Comment out console logs
        new_content = comment_console_logs(content)
        
        # Write back to file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"✅ Successfully commented out console logs in {file_path}")
        return True
        
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return False

def main():
    """Main function."""
    files_to_process = [
        'static/script.js',
        'static/threshold_frontend.js'
    ]
    
    success_count = 0
    for file_path in files_to_process:
        if os.path.exists(file_path):
            if process_file(file_path):
                success_count += 1
        else:
            print(f"⚠️  File not found: {file_path}")
    
    print(f"\n✅ Successfully processed {success_count} files")

if __name__ == "__main__":
    main()
