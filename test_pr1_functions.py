#!/usr/bin/env python3
"""
Test PR1 normalization and validation functions directly.
"""

import sys

sys.path.append("./backend")

# Import the functions from local_server
try:
    from local_server import _normalize_customer_patch_pr1, _validate_customer_patch_pr1

    print("✅ Successfully imported PR1 functions")
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)


def test_normalization():
    """Test the PR1 normalization function."""
    print("\n=== Testing Normalization ===")

    # Test valid data
    test_data = {
        "full_name": "  John Doe  ",
        "email": "  JOHN.DOE@EXAMPLE.COM  ",
        "phone": "  555-1234  ",
        "tags": ["  vip  ", "loyal", "  premium  ", "vip"],  # With duplicates and whitespace
        "notes": "  Some customer notes  ",
        "sms_consent": True,
    }

    normalized = _normalize_customer_patch_pr1(test_data)
    print("Input:", test_data)
    print("Normalized:", normalized)

    # Check expected results
    expected = {
        "name": "John Doe",  # full_name mapped to name
        "email": "john.doe@example.com",
        "phone": "555-1234",
        "tags": ["vip", "loyal", "premium"],  # deduplicated and trimmed
        "notes": "Some customer notes",
        "sms_consent": True,
    }

    all_correct = True
    for key, expected_val in expected.items():
        actual_val = normalized.get(key)
        if actual_val == expected_val:
            print(f"✅ {key}: {actual_val}")
        else:
            print(f"❌ {key}: expected {expected_val}, got {actual_val}")
            all_correct = False

    return all_correct


def test_validation():
    """Test the PR1 validation function."""
    print("\n=== Testing Validation ===")

    # Test valid data (after normalization)
    valid_data = {
        "name": "John Doe",
        "email": "john.doe@example.com",
        "phone": "555-1234",
        "tags": ["vip", "loyal"],
        "notes": "Some notes",
        "sms_consent": True,
    }

    errors = _validate_customer_patch_pr1(valid_data)
    print("Valid data errors:", errors)
    if not errors:
        print("✅ Valid data passed validation")
    else:
        print(f"❌ Valid data failed validation: {errors}")

    # Test invalid data
    invalid_data = {
        "name": "",  # empty name should fail
        "email": "invalid-email",  # invalid format
        "phone": "x" * 25,  # too long
        "tags": ["x" * 60],  # tag too long
        "notes": "x" * 1100,  # notes too long
        "sms_consent": True,
    }

    errors = _validate_customer_patch_pr1(invalid_data)
    print("Invalid data errors:", errors)

    expected_errors = {
        "full_name": "required",
        "email": "invalid_format",
        "phone": "too_long",
        "tags[0]": "tag_too_long",
        "notes": "too_long",
    }

    # Check if we get expected validation errors
    all_correct = True
    for key, expected_error in expected_errors.items():
        if key not in errors:
            print(f"❌ Missing expected error for {key}")
            all_correct = False
        elif errors[key] != expected_error:
            print(f"❌ Wrong error for {key}: expected {expected_error}, got {errors[key]}")
            all_correct = False
        else:
            print(f"✅ {key}: {errors[key]}")

    return all_correct


if __name__ == "__main__":
    print("Testing PR1 normalization and validation functions...")

    norm_ok = test_normalization()
    val_ok = test_validation()

    if norm_ok and val_ok:
        print("\n🎉 All function tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some function tests failed!")
        sys.exit(1)
