"""CORS middleware."""

import os

from flask import Flask, make_response, request


# CORS configuration from local_server.py
def _get_allowed_origins():
    """Get CORS allowed origins."""
    origins_str = os.getenv("STAGING_ALLOWED_ORIGINS", "")
    if not origins_str:
        return ["http://localhost:3000", "http://127.0.0.1:3000"]  # dev defaults
    return [origin.strip() for origin in origins_str.split(",") if origin.strip()]


ALLOWED_ORIGINS = _get_allowed_origins()
ALLOWED_METHODS = "GET,POST,PATCH,PUT,DELETE,OPTIONS"
ALLOWED_HEADERS = "Content-Type,Authorization,X-Tenant-Id,X-Request-Id,X-Correlation-Id,Accept,Origin,User-Agent,X-Requested-With,If-Match,If-None-Match"


def register_cors_middleware(app: Flask) -> None:
    """Register CORS middleware."""

    @app.after_request
    def add_cors_headers(resp):
        """Add CORS headers to response."""
        origin = request.headers.get("Origin", "")
        if origin and origin in ALLOWED_ORIGINS:
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Vary"] = resp.headers.get("Vary", "Origin")
            resp.headers["Access-Control-Allow-Credentials"] = "true"
            resp.headers["Access-Control-Allow-Methods"] = ALLOWED_METHODS
            resp.headers["Access-Control-Allow-Headers"] = ALLOWED_HEADERS
        return resp

    @app.route("/api/", defaults={"path": ""}, methods=["OPTIONS"])
    @app.route("/api/<path:path>", methods=["OPTIONS"])
    def handle_cors_preflight(path):
        """Handle CORS preflight requests for /api/* paths."""
        resp = make_response("", 204)
        origin = request.headers.get("Origin", "")
        if origin and origin in ALLOWED_ORIGINS:
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Access-Control-Allow-Credentials"] = "true"
            resp.headers["Access-Control-Allow-Methods"] = ALLOWED_METHODS
            resp.headers["Access-Control-Allow-Headers"] = ALLOWED_HEADERS
        return resp
