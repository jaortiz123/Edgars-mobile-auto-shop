"""
Idempotency middleware
Handles idempotency cache for critical POST operations
Extracted from local_server.py idempotency logic
"""

import hashlib
import os
import re
import time

from flask import Flask, g, make_response, request


def init_idempotency_middleware(app: Flask) -> None:
    """
    Idempotency cache for critical POST operations

    This preserves the exact idempotency caching logic from local_server.py
    but in a clean, reusable middleware module.
    """

    # Idempotency configuration (preserve existing settings)
    IDEMPOTENCY_TTL_SEC = int(os.getenv("API_IDEMPOTENCY_TTL_SEC", "86400"))

    # In-memory cache (preserve existing implementation)
    # TODO: Replace with Redis in production
    _idem_cache: dict[str, tuple[float, int, str]] = {}

    def _critical_post_path(path: str) -> bool:
        """
        Check if path requires idempotency protection
        Preserves existing regex pattern from local_server.py
        """
        return bool(
            re.search(r"/(payments|appointments|vehicles|invoices|service-operations)(/|$)", path)
        )

    def _make_idem_key() -> str:
        """
        Generate idempotency key from request headers and body
        Preserves existing key generation logic from local_server.py
        """
        key = request.headers.get("Idempotency-Key") or request.headers.get("X-Idempotency-Key")
        if not key:
            return None

        tenant = request.headers.get("X-Tenant-Id") or request.headers.get("x-tenant-id") or "-"
        path = request.path

        try:
            body = request.get_data(cache=True) or b""
        except Exception:
            body = b""

        h = hashlib.sha256()
        h.update(path.encode())
        h.update(b"|")
        h.update(tenant.encode())
        h.update(b"|")
        h.update(body)

        return f"{key}:{h.hexdigest()}"

    @app.before_request
    def idempotency_replay_check():
        """
        Check for idempotency cache hit and return cached response
        Preserves existing idempotency logic from local_server.py
        """
        try:
            # Only apply to POST requests
            if request.method.upper() != "POST":
                return None

            # Only apply to critical paths
            if not _critical_post_path(request.path):
                return None

            # Generate cache key
            cache_key = _make_idem_key()
            if not cache_key:
                return None

            # Check cache
            ent = _idem_cache.get(cache_key)
            now = time.time()

            if not ent:
                return None

            ts, status, body = ent

            # Check TTL
            if now - ts > IDEMPOTENCY_TTL_SEC:
                _idem_cache.pop(cache_key, None)
                return None

            # Return cached response
            resp = make_response(body, status)
            resp.mimetype = "application/json"
            resp.headers["X-Idempotency-Status"] = "replayed"
            resp.headers.setdefault("X-Correlation-Id", getattr(g, "correlation_id", "?"))

            return resp

        except Exception:
            # Never break request due to idempotency issues
            return None

    # TODO: Add response caching logic for successful POST requests
    # This would complete the idempotency implementation by storing
    # successful responses in the cache for future replay
