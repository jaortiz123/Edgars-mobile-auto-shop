"""API smoke test ensuring database connectivity paths work for CI."""

from contextlib import closing
from pathlib import Path
import sys

import pytest
from sqlalchemy import create_engine, text

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from backend.db import get_database_url


@pytest.mark.parametrize(
    "env,expected_prefix",
    [
        ({"TEST_DATABASE_URL": "postgresql://user:pass@host:1234/db"}, "postgresql://"),
        ({"FALLBACK_TO_MEMORY": "true"}, "sqlite"),
    ],
)
def test_get_database_url_priority(monkeypatch, env, expected_prefix):
    """get_database_url should respect test override and fallback flags."""
    monkeypatch.delenv("TEST_DATABASE_URL", raising=False)
    monkeypatch.delenv("FALLBACK_TO_MEMORY", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)

    for key, value in env.items():
        monkeypatch.setenv(key, value)

    url = get_database_url()
    assert url.startswith(expected_prefix)


@pytest.mark.integration
def test_database_smoke(monkeypatch):
    """Ensure we can connect to whichever database URL is configured."""
    monkeypatch.delenv("TEST_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("FALLBACK_TO_MEMORY", "true")

    database_url = get_database_url()
    engine = create_engine(database_url, future=True)
    with closing(engine.connect()) as conn:
        result = conn.execute(text("SELECT 1"))
        assert result.scalar_one() == 1
