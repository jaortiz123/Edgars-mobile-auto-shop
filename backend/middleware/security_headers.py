"""Security headers middleware."""

from flask import Flask


def register_security_headers_middleware(app: Flask) -> None:
    """Register security headers middleware."""

    @app.after_request
    def add_security_headers(resp):
        """Add security headers to all responses."""
        # Security headers from local_server.py
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-XSS-Protection"] = "1; mode=block"
        resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # CSP header
        csp_policy = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )
        resp.headers["Content-Security-Policy"] = csp_policy

        return resp
