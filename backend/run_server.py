#!/usr/bin/env python3
"""Thin runner to start the Flask application.

The main module `local_server.py` defines the Flask `app` but does not invoke
`app.run()`. This runner imports the app and starts the development server.
"""

import sys
import traceback


# Enhanced error logging for CI debugging
def log_error(msg):
    """Log errors both to stdout and a debug file for CI visibility"""
    print(f"[RUN_SERVER_ERROR] {msg}")
    try:
        with open("/tmp/run_server_error.log", "a") as f:
            f.write(f"[RUN_SERVER_ERROR] {msg}\n")
    except Exception:
        pass


try:
    print("[RUN_SERVER_DEBUG] Starting import of local_server...")
    from local_server import app  # type: ignore

    print("[RUN_SERVER_DEBUG] Successfully imported local_server.app")
except Exception as e:
    error_msg = f"CRITICAL: Failed to import local_server.app: {str(e)}"
    traceback_msg = f"TRACEBACK: {traceback.format_exc()}"
    log_error(error_msg)
    log_error(traceback_msg)
    log_error(
        "This import error is preventing Flask from starting, causing appointment creation 500 errors"
    )
    sys.exit(1)


# Ensure raw SQL migrations are applied on container startup.
# This mirrors the behavior of start-dev.sh which runs run_sql_migrations.py.
# In docker-compose (python:3.9-slim image) we invoke this runner directly,
# so we proactively attempt migrations here. Failures are logged but non-fatal
# to avoid blocking developer feedback loop; schema errors will still surface.
def _apply_raw_sql_migrations():  # pragma: no cover - startup helper
    try:
        print("[RUN_SERVER_DEBUG] Applying raw SQL migrations...")
        import pathlib
        import subprocess
        import sys

        runner = pathlib.Path(__file__).parent / "run_sql_migrations.py"
        if runner.exists():
            result = subprocess.run(
                [sys.executable, str(runner)], check=False, capture_output=True, text=True
            )
            if result.returncode != 0:
                log_error(f"SQL migrations failed with return code {result.returncode}")
                log_error(f"STDOUT: {result.stdout}")
                log_error(f"STDERR: {result.stderr}")
            else:
                print("[RUN_SERVER_DEBUG] SQL migrations completed successfully")
        else:
            print("[RUN_SERVER_DEBUG] No SQL migrations file found")
    except Exception as e:  # best-effort
        error_msg = f"Warning: could not apply raw SQL migrations: {e}"
        print(f"[run_server] {error_msg}")
        log_error(error_msg)


print("[RUN_SERVER_DEBUG] Starting migration process...")
_apply_raw_sql_migrations()

if __name__ == "__main__":
    try:
        print("[RUN_SERVER_DEBUG] Starting Flask server...")
        # Bind to all interfaces so the container port mapping works.
        app.run(host="0.0.0.0", port=3001, debug=False, use_reloader=False)
    except Exception as e:
        error_msg = f"CRITICAL: Flask server failed to start: {str(e)}"
        traceback_msg = f"TRACEBACK: {traceback.format_exc()}"
        log_error(error_msg)
        log_error(traceback_msg)
        sys.exit(1)
