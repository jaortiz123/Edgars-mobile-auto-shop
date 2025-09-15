import os


def get_database_url() -> str:
    # Test URL takes priority
    test_url = os.getenv("TEST_DATABASE_URL")
    if test_url:
        return test_url

    # Fallback for smoke tests
    if os.getenv("FALLBACK_TO_MEMORY", "false").lower() == "true":
        return "sqlite:///:memory:"

    # Production/integration URL
    env_url = os.getenv("DATABASE_URL")
    if not env_url:
        raise RuntimeError("DATABASE_URL not set and FALLBACK_TO_MEMORY!=true")
    return env_url
