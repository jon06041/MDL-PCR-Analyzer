#!/usr/bin/env python3

import sys
sys.path.append('.')

print('🧪 Testing Enhanced Compliance API after MySQL migration')
print('=' * 50)

try:
    from enhanced_compliance_api import collect_compliance_evidence
    
    evidence = collect_compliance_evidence()
    print('✅ Compliance evidence collection successful!')
    print(f'Collected evidence for {len(evidence)} requirements')
    
    # Show some results
    for req_code, data in list(evidence.items())[:5]:  # Show first 5
        print(f'  {req_code}: {data.get("count", 0)} events')
        if data.get("events"):
            for event_type, event_data in list(data["events"].items())[:2]:  # Show first 2 events
                print(f'    - {event_type}: {len(event_data)} records')
    
except Exception as e:
    print(f'❌ Error: {e}')
    import traceback
    traceback.print_exc()
