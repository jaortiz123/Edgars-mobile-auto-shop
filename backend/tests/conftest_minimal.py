"""
Minimal conftest for coverage testing without Docker dependencies.
"""

import os
import sys
from pathlib import Path

# Add backend to sys.path
tests_dir = Path(__file__).resolve().parent
backend_dir = tests_dir.parent
sys.path.insert(0, str(backend_dir))

# Set environment variables for in-memory/mock mode
os.environ.update(
    {
        "FALLBACK_TO_MEMORY": "true",
        "DISABLE_DB_CONFIG_CACHE": "true",
        "DATABASE_URL": "sqlite:///memory:",
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_DB": "test_db",
        "POSTGRES_USER": "test_user",
        "POSTGRES_PASSWORD": "test_pass",
    }
)

import pytest


@pytest.fixture
def mock_db():
    """Mock database connection for unit tests."""
    return {"connection": "mocked"}


def pytest_sessionstart(session):
    """Skip Docker container start for coverage run."""
    pass


def pytest_sessionfinish(session, exitstatus):
    """Skip cleanup for coverage run."""
    pass
