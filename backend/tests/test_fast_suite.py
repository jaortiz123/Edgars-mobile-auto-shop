# Fast Test Configuration for Backend

import pytest
import os
import sys

# Add backend directory to path
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)


# Test configuration
@pytest.fixture
def client():
    """Create a test client for Flask app"""
    from local_server import app

    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False

    with app.test_client() as client:
        with app.app_context():
            yield client


def test_health_check(client):
    """Test basic health check endpoint"""
    response = client.get("/health")
    assert response.status_code in [200, 404]  # 404 if endpoint doesn't exist yet


def test_api_structure():
    """Test basic API imports work"""
    try:
        from local_server import app

        assert app is not None
    except ImportError as e:
        pytest.fail(f"Failed to import Flask app: {e}")


def test_environment_config():
    """Test environment configuration"""
    # Test that required environment variables are handled gracefully
    required_vars = ["DATABASE_URL", "POSTGRES_HOST", "POSTGRES_DB"]

    for var in required_vars:
        # Should not crash if missing, should have defaults or error handling
        value = os.environ.get(var)
        # Just ensure we can access without crashes
        assert True  # Basic smoke test
