#!/usr/bin/env python3
"""
Configuration Management Script for MDL-PCR-Analyzer

This script provides tools to manage centralized configuration values,
particularly concentration controls for qPCR analysis.

Usage:
    python manage_config.py list-controls
    python manage_config.py update-control Cglab FAM H 2e7
    python manage_config.py add-test NewTest FAM H=1e7,M=1e5,L=1e3
    python manage_config.py sync-from-js  # Sync from existing JS file
"""

import json
import os
import sys
import argparse
from typing import Dict, Any

CONFIG_FILE = 'config/concentration_controls.json'
JS_FILE = 'static/concentration_controls.js'

def load_config() -> Dict[str, Any]:
    """Load current configuration from JSON file"""
    if not os.path.exists(CONFIG_FILE):
        return {"version": "1.0", "controls": {}}
    
    with open(CONFIG_FILE, 'r') as f:
        return json.load(f)

def save_config(config: Dict[str, Any]):
    """Save configuration to JSON file"""
    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
    
    # Update timestamp
    from datetime import datetime
    config['last_updated'] = datetime.now().strftime('%Y-%m-%d')
    
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)
    
    print(f"✅ Configuration saved to {CONFIG_FILE}")

def list_controls():
    """List all current concentration controls"""
    config = load_config()
    controls = config.get('controls', {})
    
    if not controls:
        print("No concentration controls found.")
        return
    
    print("Current Concentration Controls:")
    print("=" * 50)
    
    for test_code, channels in controls.items():
        print(f"\n📋 {test_code}:")
        for channel, values in channels.items():
            h = values.get('H', 'N/A')
            m = values.get('M', 'N/A')
            l = values.get('L', 'N/A')
            print(f"  🔬 {channel}: H={h}, M={m}, L={l}")

def update_control(test_code: str, channel: str, control_type: str, value: float):
    """Update a specific control value"""
    config = load_config()
    
    if test_code not in config['controls']:
        config['controls'][test_code] = {}
    
    if channel not in config['controls'][test_code]:
        config['controls'][test_code][channel] = {}
    
    config['controls'][test_code][channel][control_type] = value
    
    save_config(config)
    print(f"✅ Updated {test_code}/{channel}/{control_type} = {value}")

def add_test(test_code: str, channel: str, controls_str: str):
    """Add a new test with control values (format: H=1e7,M=1e5,L=1e3)"""
    config = load_config()
    
    # Parse controls string
    controls = {}
    for item in controls_str.split(','):
        control_type, value = item.split('=')
        controls[control_type.strip()] = float(value.strip())
    
    if test_code not in config['controls']:
        config['controls'][test_code] = {}
    
    config['controls'][test_code][channel] = controls
    
    save_config(config)
    print(f"✅ Added test {test_code}/{channel} with controls {controls}")

def sync_from_js():
    """Sync configuration from existing JavaScript file"""
    if not os.path.exists(JS_FILE):
        print(f"❌ JavaScript file {JS_FILE} not found")
        return
    
    print(f"🔄 Syncing from {JS_FILE}...")
    
    # This is a simplified parser - for production, you might want a more robust solution
    with open(JS_FILE, 'r') as f:
        content = f.read()
    
    # Extract the CONCENTRATION_CONTROLS object (this is a basic implementation)
    # For production, consider using a proper JavaScript parser
    
    print("⚠️  Manual sync required. Please review the JavaScript file and update the JSON config manually.")
    print("   The centralized config is now the source of truth.")

def main():
    parser = argparse.ArgumentParser(description='Manage qPCR concentration controls configuration')
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # List controls
    subparsers.add_parser('list-controls', help='List all concentration controls')
    
    # Update control
    update_parser = subparsers.add_parser('update-control', help='Update a specific control value')
    update_parser.add_argument('test_code', help='Test code (e.g., Cglab)')
    update_parser.add_argument('channel', help='Channel/fluorophore (e.g., FAM)')
    update_parser.add_argument('control_type', choices=['H', 'M', 'L'], help='Control type')
    update_parser.add_argument('value', type=float, help='Concentration value')
    
    # Add test
    add_parser = subparsers.add_parser('add-test', help='Add a new test with controls')
    add_parser.add_argument('test_code', help='Test code (e.g., NewTest)')
    add_parser.add_argument('channel', help='Channel/fluorophore (e.g., FAM)')
    add_parser.add_argument('controls', help='Controls in format H=1e7,M=1e5,L=1e3')
    
    # Sync from JS
    subparsers.add_parser('sync-from-js', help='Sync from existing JavaScript file')
    
    args = parser.parse_args()
    
    if args.command == 'list-controls':
        list_controls()
    elif args.command == 'update-control':
        update_control(args.test_code, args.channel, args.control_type, args.value)
    elif args.command == 'add-test':
        add_test(args.test_code, args.channel, args.controls)
    elif args.command == 'sync-from-js':
        sync_from_js()
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
