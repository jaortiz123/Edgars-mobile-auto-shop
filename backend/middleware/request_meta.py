"""
Request metadata middleware
Handles correlation IDs, request timing, debug headers
Extracted from local_server.py @app.before_request/@app.after_request hooks
"""

import os
import uuid

from flask import Flask, Response, g, request


def init_request_meta(app: Flask) -> None:
    """
    Handle correlation IDs, request timing, debug headers

    This preserves the exact correlation ID and response header logic
    from local_server.py but in a clean, reusable middleware module.
    """

    @app.before_request
    def assign_correlation_id():
        """
        Assign correlation ID from headers or generate new one
        Preserves existing logic from local_server.py line ~373
        """
        try:
            cid = (
                request.headers.get("X-Request-Id")
                or request.headers.get("X-Correlation-Id")
                or str(uuid.uuid4())
            )
            g.correlation_id = cid
        except Exception:
            g.correlation_id = str(uuid.uuid4())

    @app.after_request
    def add_response_headers(resp: Response) -> Response:
        """
        Add standard response headers
        Preserves existing logic from local_server.py after_request hooks
        """
        try:
            # Correlation ID (required for tracing)
            resp.headers.setdefault("X-Correlation-Id", getattr(g, "correlation_id", "?"))

            # Debug headers (preserve existing behavior)
            resp.headers.setdefault("X-Debug-App-Instance", os.getenv("APP_INSTANCE_ID", "local"))
            resp.headers.setdefault("X-App-Version", os.getenv("APP_VERSION", "dev"))

            return resp
        except Exception:
            # Never break response due to header issues
            return resp
