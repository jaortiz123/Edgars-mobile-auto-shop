#!/usr/bin/env python3
"""
Script to automatically mark integration tests based on common patterns.
"""

import os
import re
from pathlib import Path

# Integration test indicators
INTEGRATION_PATTERNS = [
    r"pg_container",  # PostgreSQL container fixture
    r"no_auto_auth_client",  # Integration auth fixture
    r"integration_client",  # Integration client fixture (but this might already be marked)
    r"sqlite3\.OperationalError",  # SQLite errors in logs indicate PostgreSQL-specific SQL
    r"license_plate",  # Column that doesn't exist in SQLite schema
    r"vehicle_id",  # Column references that may not exist
    r"template_usage_events",  # Table that may not exist in SQLite
]

# Files that had errors/failures in CI logs - these clearly need integration marking
FAILING_FILES = [
    "test_csrf_cookie_auth.py",
    "test_customer_auth.py",
    "test_customer_history_broken.py",
    "test_customer_history_clean.py",
    "test_customer_history_debug.py",
    "test_customer_history_new.py",
    "test_customer_history_old.py",
    "test_customer_history_simple.py",
    "test_customer_history_working.py",
    "test_invoice_generation.py",
    "test_invoice_get_single.py",
    "test_invoice_list.py",
    "test_invoice_payments.py",
    "test_invoice_void.py",
    "test_password_policy.py",
    "test_rbac_matrix.py",
    "test_robustness_simple.py",
    "test_technician_progress.py",
    "test_template_analytics.py",
    "test_tenant_membership_enforcement.py",
    "test_get_single_appointment.py",
    "test_unified_customer_profile.py",
]


def should_mark_as_integration(file_path, content):
    """Check if a test file should be marked as integration."""
    filename = os.path.basename(file_path)

    # Check if it's in our failing files list
    if filename in FAILING_FILES:
        return True

    # Check for integration patterns in content
    for pattern in INTEGRATION_PATTERNS:
        if re.search(pattern, content):
            return True

    return False


def add_integration_marker(content):
    """Add @pytest.mark.integration to all test functions/classes."""
    lines = content.split("\n")
    new_lines = []

    # Track imports to add pytest import if needed
    has_pytest_import = False
    import_section_end = 0

    for i, line in enumerate(lines):
        if "import pytest" in line or "from pytest" in line:
            has_pytest_import = True
        if line.strip() and not line.startswith(("import ", "from ")):
            import_section_end = i
            break

    # Add pytest import if missing
    if not has_pytest_import:
        # Find where to insert import
        insert_pos = import_section_end
        for i, line in enumerate(lines[:20]):  # Check first 20 lines
            if line.strip() and not line.startswith(("#", '"""', "'''")):
                if not line.startswith(("import ", "from ")):
                    insert_pos = i
                    break

        lines.insert(insert_pos, "import pytest")
        lines.insert(insert_pos + 1, "")

    # Add markers to test functions and classes
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Check for test function or test class
        if (
            stripped.startswith("def test_")
            or stripped.startswith("async def test_")
            or (stripped.startswith("class Test") and ":" in stripped)
        ):
            # Check if already has integration marker
            prev_line = lines[i - 1].strip() if i > 0 else ""
            if "@pytest.mark.integration" not in prev_line:
                # Add the marker with same indentation as the def/class
                indent = len(line) - len(line.lstrip())
                marker_line = " " * indent + "@pytest.mark.integration"
                new_lines.append(marker_line)

        new_lines.append(line)

    return "\n".join(new_lines)


def process_test_files():
    """Process all test files in the tests directory."""
    backend_dir = Path("/Users/jesusortiz/Edgars-mobile-auto-shop/backend")
    tests_dir = backend_dir / "tests"

    if not tests_dir.exists():
        print(f"Tests directory not found: {tests_dir}")
        return

    modified_files = []

    for test_file in tests_dir.glob("test_*.py"):
        try:
            with open(test_file, encoding="utf-8") as f:
                original_content = f.read()

            if should_mark_as_integration(test_file, original_content):
                print(f"Marking as integration: {test_file.name}")

                # Check if already has integration markers
                if "@pytest.mark.integration" in original_content:
                    print("  - Already has some integration markers, skipping")
                    continue

                new_content = add_integration_marker(original_content)

                # Write back if changed
                if new_content != original_content:
                    with open(test_file, "w", encoding="utf-8") as f:
                        f.write(new_content)
                    modified_files.append(test_file.name)
                    print("  - Modified")
                else:
                    print("  - No changes needed")
            else:
                print(f"Keeping as unit test: {test_file.name}")

        except Exception as e:
            print(f"Error processing {test_file}: {e}")

    print(f"\nModified {len(modified_files)} files:")
    for f in modified_files:
        print(f"  - {f}")


if __name__ == "__main__":
    process_test_files()
