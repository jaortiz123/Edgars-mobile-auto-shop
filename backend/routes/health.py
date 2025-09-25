"""Health check blueprint."""

from flask import Blueprint

from ..services.db import safe_conn
from ..util.response import _ok

health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    # Check database connection
    conn, use_memory, err = safe_conn()
    if err:
        db_status = "error"
        mode = "error"
    elif use_memory:
        db_status = "up"
        mode = "memory"
    else:
        db_status = "up"
        mode = "database"

    if conn:
        try:
            conn.close()
        except Exception:
            pass

    return _ok({"db": db_status, "mode": mode, "status": "ok"})
