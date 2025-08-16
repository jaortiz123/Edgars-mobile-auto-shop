#!/usr/bin/env python3
"""Thin runner to start the Flask application.

The main module `local_server.py` defines the Flask `app` but does not invoke
`app.run()`. This runner imports the app and starts the development server.
"""
from local_server import app  # type: ignore

# Ensure raw SQL migrations are applied on container startup.
# This mirrors the behavior of start-dev.sh which runs run_sql_migrations.py.
# In docker-compose (python:3.9-slim image) we invoke this runner directly,
# so we proactively attempt migrations here. Failures are logged but non-fatal
# to avoid blocking developer feedback loop; schema errors will still surface.
def _apply_raw_sql_migrations():  # pragma: no cover - startup helper
    try:
        import subprocess, sys, pathlib
        runner = pathlib.Path(__file__).parent / 'run_sql_migrations.py'
        if runner.exists():
            subprocess.run([sys.executable, str(runner)], check=False)
    except Exception as e:  # best-effort
        print(f"[run_server] Warning: could not apply raw SQL migrations: {e}")

_apply_raw_sql_migrations()

if __name__ == "__main__":
    # Bind to all interfaces so the container port mapping works.
    app.run(host="0.0.0.0", port=3001, debug=False, use_reloader=False)
