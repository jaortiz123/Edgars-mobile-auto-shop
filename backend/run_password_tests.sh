#!/bin/bash
# Mutation testing runner for passwords.py module
# Focused test execution avoiding problematic test discovery

cd /Users/jesusortiz/Edgars-mobile-auto-shop/backend

# Set test mode and run only the password unit tests
export TEST_MODE=unit
python -m pytest tests/test_app_security_passwords_unit.py -x --tb=no -q --no-header
