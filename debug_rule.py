#!/usr/bin/env python3
"""
Debug the rule-based classification bug
"""

def test_suspicious_rule():
    # Test the exact metrics from our strong positive
    amplitude = 35000
    r2 = 0.999  
    snr = 35.0
    
    print('🔍 DEBUGGING SUSPICIOUS RULE')
    print('=' * 50)
    print('Testing rule: amplitude > 500 and (r2 < 0.8 or snr < 3)')
    print(f'amplitude = {amplitude}')
    print(f'r2 = {r2}')
    print(f'snr = {snr}')
    print()
    
    # Break down the logic
    amp_check = amplitude > 500
    r2_check = r2 < 0.8
    snr_check = snr < 3
    or_condition = (r2_check or snr_check)
    final_condition = amp_check and or_condition
    
    print(f'amplitude > 500: {amp_check}')
    print(f'r2 < 0.8: {r2_check}')  
    print(f'snr < 3: {snr_check}')
    print(f'(r2 < 0.8 or snr < 3): {or_condition}')
    print(f'Final condition: {final_condition}')
    print()
    
    if final_condition:
        print('❌ BUG: Excellent curve incorrectly flagged as SUSPICIOUS!')
        print('   This should be FALSE for high-quality curves')
    else:
        print('✅ CORRECT: Excellent curve properly passes the rule')
        print('   Rule is working as intended')
    
    print()
    print('Expected behavior:')
    print('- Strong positive with R²=0.999 and SNR=35 should NOT be suspicious')
    print('- Only curves with truly poor quality (R²<0.8 OR SNR<3) should be suspicious')

if __name__ == "__main__":
    test_suspicious_rule()
