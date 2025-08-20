# Ensure project root is on sys.path for reliable 'backend' package discovery
import os
import sys

import pytest

try:
    import backend.local_server as ls  # type: ignore
except Exception:  # pragma: no cover
    ls = None  # type: ignore
PROJECT_ROOT = os.path.dirname(os.path.abspath(os.path.join(__file__, os.pardir)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


@pytest.fixture(autouse=True)
def _reset_telemetry_counters(request, monkeypatch):
    if ls and hasattr(ls, "_test_reset_telemetry_counters"):
        ls._test_reset_telemetry_counters()
        # Inflate limits for all tests except the explicit quota test module
        path = getattr(request.node, "fspath", "")
        if "test_telemetry_quota" not in str(path):
            # Monkeypatch increment to always allow
            try:
                monkeypatch.setattr(ls, "_telemetry_increment", lambda kind: True)
            except Exception:
                pass
    yield
