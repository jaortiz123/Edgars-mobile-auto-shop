#!/usr/bin/env python3
"""
Isolated mutation testing runner for passwords.py
This script bypasses pytest discovery issues by running tests directly
"""

import os
import subprocess
import tempfile


def run_focused_mutation_test():
    """Run mutation testing on passwords.py with isolated test execution"""

    # Change to backend directory
    backend_dir = "/Users/jesusortiz/Edgars-mobile-auto-shop/backend"
    os.chdir(backend_dir)

    # Set environment for unit testing
    os.environ["TEST_MODE"] = "unit"

    # Create a temporary pytest config to avoid discovery issues
    with tempfile.NamedTemporaryFile(mode="w", suffix=".ini", delete=False) as f:
        f.write(
            """[pytest]
addopts = -q --no-header --tb=no
testpaths = tests/test_app_security_passwords_unit.py
python_files = test_app_security_passwords_unit.py
python_classes = Test*
python_functions = test_*
"""
        )
        temp_config = f.name

    try:
        # Run mutation testing with isolated config
        cmd = [
            "mutmut",
            "run",
            "--runner",
            f"python -m pytest -c {temp_config} tests/test_app_security_passwords_unit.py -x",
        ]

        # Also set paths directly in command
        os.environ["MUTMUT_PATHS_TO_MUTATE"] = "app/security/passwords.py"

        result = subprocess.run(cmd, capture_output=True, text=True)
        print("STDOUT:", result.stdout)
        print("STDERR:", result.stderr)
        print("Return code:", result.returncode)

    finally:
        # Clean up temp config
        os.unlink(temp_config)


if __name__ == "__main__":
    run_focused_mutation_test()
