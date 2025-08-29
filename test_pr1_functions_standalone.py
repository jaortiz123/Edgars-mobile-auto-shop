#!/usr/bin/env python3
"""
Test PR1 normalization and validation functions directly (standalone).
"""


def _normalize_customer_patch_pr1(p):
    """PR1 version supporting full_name, tags, notes, sms_consent"""
    out = {}

    # Map full_name to name column for backward compatibility
    if "full_name" in p and p["full_name"] is not None:
        out["name"] = str(p["full_name"]).strip()

    if "email" in p:
        if p["email"] is None or p["email"] == "":
            out["email"] = None
        else:
            out["email"] = str(p["email"]).strip().lower()

    if "phone" in p:
        if p["phone"] is None or p["phone"] == "":
            out["phone"] = None
        else:
            # TODO: Add E.164 normalization per PR1 spec
            out["phone"] = str(p["phone"]).strip()

    if "tags" in p:
        if p["tags"] is None:
            out["tags"] = []
        else:
            # Dedupe and clean tags
            tags = p["tags"] if isinstance(p["tags"], list) else []
            cleaned_tags = [str(tag).strip() for tag in tags if str(tag).strip()]
            out["tags"] = list(dict.fromkeys(cleaned_tags))  # dedupe while preserving order

    if "notes" in p:
        if p["notes"] is None or p["notes"] == "":
            out["notes"] = None
        else:
            # Limit notes length per PR1 spec
            notes = str(p["notes"]).strip()
            out["notes"] = notes[:1000] if len(notes) > 1000 else notes

    if "sms_consent" in p:
        out["sms_consent"] = bool(p["sms_consent"]) if p["sms_consent"] is not None else False

    return out


def _validate_customer_patch_pr1(p):
    """PR1 validation supporting full_name, tags, notes, sms_consent"""
    import re

    errors = {}

    # Validate full_name (required)
    if "name" in p:  # mapped from full_name
        if not p["name"] or not str(p["name"]).strip():
            errors["full_name"] = "required"
        elif len(str(p["name"]).strip()) > 120:
            errors["full_name"] = "too_long"

    # Validate email format
    if "email" in p and p["email"]:
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", p["email"]):
            errors["email"] = "invalid_format"

    # Validate phone (basic validation, E.164 normalization would be added later)
    if "phone" in p and p["phone"]:
        phone = str(p["phone"]).strip()
        if len(phone) > 20:
            errors["phone"] = "too_long"

    # Validate tags
    if "tags" in p and p["tags"]:
        if not isinstance(p["tags"], list):
            errors["tags"] = "must_be_array"
        else:
            if len(p["tags"]) > 10:
                errors["tags"] = "too_many"
            for i, tag in enumerate(p["tags"]):
                tag_str = str(tag).strip() if tag else ""
                if len(tag_str) > 50:
                    errors[f"tags[{i}]"] = "tag_too_long"

    # Validate notes length
    if "notes" in p and p["notes"]:
        if len(str(p["notes"])) > 1000:
            errors["notes"] = "too_long"

    # sms_consent is just boolean, no additional validation needed

    return errors


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
        valid_ok = True
    else:
        print(f"❌ Valid data failed validation: {errors}")
        valid_ok = False

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

    return valid_ok and all_correct


if __name__ == "__main__":
    print("Testing PR1 normalization and validation functions...")

    norm_ok = test_normalization()
    val_ok = test_validation()

    if norm_ok and val_ok:
        print("\n🎉 All function tests passed!")
    else:
        print("\n💥 Some function tests failed!")
