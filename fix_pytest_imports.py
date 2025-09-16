#!/usr/bin/env python3
"""Fix pytest import issues in test files."""

from pathlib import Path


def fix_pytest_import(file_path):
    """Fix pytest import in a test file."""
    with open(file_path, encoding="utf-8") as f:
        content = f.read()

    lines = content.split("\n")

    # Check if pytest is imported properly
    has_proper_import = False
    for line in lines:
        if line.strip() == "import pytest" or "import pytest" in line:
            has_proper_import = True
            break

    if has_proper_import:
        return False  # No fix needed

    # Find where to insert the import (after shebang and docstrings, before other imports)
    insert_pos = 0
    in_docstring = False
    docstring_char = None

    for i, line in enumerate(lines):
        stripped = line.strip()

        # Skip shebang
        if stripped.startswith("#!"):
            insert_pos = i + 1
            continue

        # Handle docstrings
        if not in_docstring:
            if stripped.startswith('"""') or stripped.startswith("'''"):
                in_docstring = True
                docstring_char = stripped[:3]
                if stripped.endswith(docstring_char) and len(stripped) > 3:
                    in_docstring = False  # Single line docstring
                    insert_pos = i + 1
                continue
        else:
            if docstring_char in stripped:
                in_docstring = False
                insert_pos = i + 1
                continue

        # If we're not in a docstring and this is an import line
        if not in_docstring and (stripped.startswith("import ") or stripped.startswith("from ")):
            insert_pos = i
            break

        # If we hit non-comment, non-docstring, non-import code, insert before it
        if not in_docstring and stripped and not stripped.startswith("#"):
            if not (stripped.startswith("import ") or stripped.startswith("from ")):
                insert_pos = i
                break

    # Insert the import
    lines.insert(insert_pos, "import pytest")
    if insert_pos < len(lines) - 1 and lines[insert_pos + 1].strip():
        lines.insert(insert_pos + 1, "")

    # Write back
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return True


def main():
    backend_dir = Path("/Users/jesusortiz/Edgars-mobile-auto-shop/backend")
    tests_dir = backend_dir / "tests"

    fixed_files = []

    for test_file in tests_dir.glob("test_*.py"):
        if "@pytest.mark.integration" in test_file.read_text():
            if fix_pytest_import(test_file):
                fixed_files.append(test_file.name)
                print(f"Fixed: {test_file.name}")

    print(f"\nFixed {len(fixed_files)} files")


if __name__ == "__main__":
    main()
