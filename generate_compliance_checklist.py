#!/usr/bin/env python3
"""
Generate Printable Compliance Tracking Checklist
Creates a comprehensive list of all compliance requirements with tracking mechanisms
"""

import sys
import os
sys.path.append('/workspaces/MDL-PCR-Analyzer')

from software_compliance_requirements import (
    get_all_trackable_requirements, 
    get_requirements_by_organization,
    get_trackable_events
)
from datetime import datetime

def generate_compliance_checklist():
    """Generate a printable compliance tracking checklist"""
    
    print("=" * 100)
    print("MDL PCR ANALYZER - COMPLIANCE TRACKING CHECKLIST")
    print("=" * 100)
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Get all requirements organized by organization
    by_org = get_requirements_by_organization()
    
    total_requirements = 0
    
    for org, requirements in by_org.items():
        print(f"\n{'#' * 80}")
        print(f"ORGANIZATION: {org}")
        print(f"{'#' * 80}")
        print(f"Total Requirements: {len(requirements)}")
        print()
        
        for i, req in enumerate(requirements, 1):
            total_requirements += 1
            
            # Status indicator
            status = req.get('implementation_status', 'active')
            status_symbol = {
                'active': '✅',
                'partial': '⚠️ ',
                'ready_to_implement': '🔄',
                'planned': '📋'
            }.get(status, '❓')
            
            print(f"{i:2d}. {status_symbol} {req['title']}")
            print(f"     Code: {req['code']}")
            print(f"     Section: {req.get('section', 'N/A')}")
            print(f"     Status: {status.upper()}")
            
            # Tracking mechanism
            tracked_events = req.get('tracked_by', [])
            if tracked_events:
                print(f"     Tracking Events: {', '.join(tracked_events)}")
            else:
                print(f"     Tracking Events: NONE DEFINED")
            
            # Evidence type
            evidence = req.get('evidence_type', 'Not specified')
            print(f"     Evidence Type: {evidence}")
            
            # Implementation features (if planned/ready)
            if 'implementation_features' in req:
                print(f"     Implementation Features:")
                for feature in req['implementation_features']:
                    print(f"       - {feature}")
            
            print(f"     Regulation: {req.get('regulation_title', 'N/A')}")
            print()
    
    # Summary statistics
    print(f"\n{'=' * 80}")
    print(f"SUMMARY STATISTICS")
    print(f"{'=' * 80}")
    print(f"Total Compliance Requirements: {total_requirements}")
    
    # Count by status
    all_reqs = get_all_trackable_requirements()
    status_counts = {}
    for req in all_reqs.values():
        status = req.get('implementation_status', 'active')
        status_counts[status] = status_counts.get(status, 0) + 1
    
    print(f"\nBy Implementation Status:")
    for status, count in sorted(status_counts.items()):
        symbol = {
            'active': '✅',
            'partial': '⚠️ ',
            'ready_to_implement': '🔄',
            'planned': '📋'
        }.get(status, '❓')
        print(f"  {symbol} {status.upper().replace('_', ' ')}: {count}")
    
    # All trackable events
    all_events = get_trackable_events()
    print(f"\nAll Trackable Events ({len(all_events)} total):")
    for event in sorted(all_events):
        print(f"  - {event}")

if __name__ == '__main__':
    generate_compliance_checklist()
