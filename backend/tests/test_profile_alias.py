#!/usr/bin/env python3
"""Regression test for /api/customers/profile route alias.

Ensures that the public (namespaced) customer profile alias is wired and
returns 401 Unauthorized (auth required) instead of 404 Not Found when
hit without credentials. This guards against route registration or
import-order regressions that previously produced 404s in the dashboard
flow, triggering noisy retry loops and CORS confusion.
"""

try:
    from backend import local_server  # preferred
except ImportError:  # pragma: no cover
    import local_server  # type: ignore

app = local_server.app


def test_profile_alias_requires_auth_and_is_not_404():
    app.config["TESTING"] = True
    with app.test_client() as c:
        resp = c.get("/api/customers/profile")
        # Alias must exist (not 404)
        assert resp.status_code != 404, f"Expected non-404; got 404 body={resp.data!r}"
        # Should enforce auth => 401
        assert resp.status_code == 401, f"Expected 401; got {resp.status_code} body={resp.data!r}"
        # CORS dev header should not be injected without Origin, but Request ID should be present
        assert "X-Request-Id" in resp.headers
