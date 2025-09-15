#!/usr/bin/env python3
"""
Quick test of pytest-rerunfailures functionality for flake detection.
This script demonstrates how the plugin works with a simulated flaky test.
"""

import os
import random
import time

import pytest

pytestmark = pytest.mark.skipif(
    os.getenv("DISABLE_FLAKE_DEMO", "false").lower() == "true",
    reason="Flaky demo disabled for CI runs",
)

# Simulate a flaky test that fails intermittently
_call_count = 0


def test_simulated_flaky_behavior():
    """
    This test simulates a flaky test that fails roughly 60% of the time
    to demonstrate pytest-rerunfailures functionality.
    """
    global _call_count
    _call_count += 1

    # Simulate some timing-dependent behavior
    time.sleep(0.1)

    # Fail roughly 60% of the time on first run, but usually pass on retry
    if _call_count == 1:
        # First call - simulate high failure rate
        assert random.random() > 0.6, f"Simulated flaky failure (attempt {_call_count})"
    else:
        # Subsequent calls - much higher success rate
        assert random.random() > 0.1, f"Retry usually succeeds (attempt {_call_count})"


def test_stable_test():
    """
    This test should always pass to show normal test behavior.
    """
    assert True, "This test is stable and should always pass"


def test_another_stable_test():
    """
    Another stable test to show the difference.
    """
    assert 2 + 2 == 4, "Math still works"


if __name__ == "__main__":
    print("🔄 Flake Detection Test")
    print("This script demonstrates pytest-rerunfailures functionality.")
    print("Run with: pytest --reruns 2 --reruns-delay 1 -v test_flake_demo.py")
