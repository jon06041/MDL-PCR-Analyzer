#!/usr/bin/env python3
"""
Simple test to verify JSON handling logic
"""
import json

def safe_json_dumps(value, default=None):
    if value is None:
        return None
    # If already a string, assume it's already JSON-encoded
    if isinstance(value, str):
        try:
            # Validate it's valid JSON
            json.loads(value)
            return value
        except (json.JSONDecodeError, TypeError):
            # If not valid JSON, treat as a raw string and encode it
            return json.dumps(value)
    # Otherwise, serialize the object/list to JSON
    return json.dumps(value if value is not None else default)

def test_json_logic():
    """Test various scenarios for JSON serialization"""
    
    test_cases = [
        # (input, expected_behavior, description)
        ([1, 2, 3], json.dumps([1, 2, 3]), "List should be JSON encoded"),
        ({"a": 1}, json.dumps({"a": 1}), "Dict should be JSON encoded"),
        ('["already", "json"]', '["already", "json"]', "Valid JSON string should remain unchanged"),
        ('{"already": "json"}', '{"already": "json"}', "Valid JSON object string should remain unchanged"),
        ("just a string", json.dumps("just a string"), "Plain string should be JSON encoded"),
        (None, None, "None should remain None"),
        ([], json.dumps([]), "Empty list should be JSON encoded"),
        ({}, json.dumps({}), "Empty dict should be JSON encoded"),
    ]
    
    print("Testing JSON serialization logic:")
    print("=" * 50)
    
    all_passed = True
    for i, (input_val, expected, description) in enumerate(test_cases):
        result = safe_json_dumps(input_val, [])
        passed = result == expected
        all_passed = all_passed and passed
        
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"Test {i+1}: {status}")
        print(f"  Description: {description}")
        print(f"  Input: {input_val} (type: {type(input_val)})")
        print(f"  Expected: {expected}")
        print(f"  Got: {result}")
        print()
    
    print("=" * 50)
    print(f"Overall result: {'All tests passed!' if all_passed else 'Some tests failed!'}")
    return all_passed

if __name__ == "__main__":
    test_json_logic()
