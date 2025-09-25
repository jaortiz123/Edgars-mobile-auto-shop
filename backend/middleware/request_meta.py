"""Request metadata middleware."""

import os
import re
import time
import uuid

from flask import Flask, request

# Request ID handling from local_server.py
REQUEST_ID_HEADER = "X-Request-Id"
REQUEST_ID_REGEX = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

# Process start time for cold/warm classification
PROCESS_START_TIME = time.time()
COLD_START_SECONDS = 120


def register_request_meta_middleware(app: Flask) -> None:
    """Register request metadata middleware."""

    @app.before_request
    def before_request_hook():
        """Assign or validate request id + start monotonic timer.

        Enforces canonical lowercase UUIDv4 format. Inbound header (if valid) is
        lowercased; otherwise a new UUID is generated.
        """
        rid = request.headers.get(REQUEST_ID_HEADER)
        if rid:
            rid = rid.strip().lower()
            if not REQUEST_ID_REGEX.match(rid):
                rid = None
        if not rid:
            rid = str(uuid.uuid4()).lower()
        request.environ["REQUEST_ID"] = rid
        # Monotonic perf counter (immune to wall-clock changes) for duration
        # Record handler start (high resolution monotonic)
        request.environ["REQUEST_START_PERF"] = time.perf_counter()
        # Mark whether first byte has been written yet (for first-byte latency measurement)
        request.environ["FIRST_BYTE_TS"] = None
        # Pre-compute cold/warm classification (process uptime <120s => cold)
        proc_uptime = time.time() - PROCESS_START_TIME
        request.environ["START_TYPE"] = "cold" if proc_uptime < COLD_START_SECONDS else "warm"

    @app.after_request
    def mark_first_byte(resp):  # pragma: no cover - simple timestamp setter
        # Set FIRST_BYTE_TS the first time after_request runs (Flask builds full response before sending)
        if request.environ.get("FIRST_BYTE_TS") is None:
            request.environ["FIRST_BYTE_TS"] = time.perf_counter()
        return resp

    @app.after_request
    def after_request_hook(resp):
        # Always echo request id header
        rid = request.environ.get("REQUEST_ID")
        if rid:
            resp.headers[REQUEST_ID_HEADER] = rid
        # Inject version header (short git SHA) once per response so tests / tools
        # can quickly verify the running code version. Falls back to 'dev'.
        try:  # pragma: no cover simple metadata injection
            if "X-App-Version" not in resp.headers:
                # Cache the computed version on the app object to avoid repeated git calls
                ver = getattr(app, "_cached_app_version", None)
                if not ver:
                    ver = os.getenv("APP_VERSION")  # allow explicit override
                    if not ver:
                        try:
                            import subprocess

                            result = subprocess.run(
                                ["git", "rev-parse", "--short=7", "HEAD"],
                                capture_output=True,
                                text=True,
                                timeout=2,
                            )
                            ver = result.stdout.strip() if result.returncode == 0 else "dev"
                        except Exception:
                            ver = "dev"
                    app._cached_app_version = ver
                resp.headers["X-App-Version"] = ver
        except Exception:
            pass
        return resp
