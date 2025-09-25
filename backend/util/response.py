"""Response utilities for consistent API responses."""

from http import HTTPStatus
from typing import Any, Dict, Optional

from flask import jsonify, request


def _req_id() -> str:
    """Returns the request ID for the current request."""
    return request.environ.get("REQUEST_ID", "N/A")


def _ok(data: Any, status: int = HTTPStatus.OK):
    """Build final success envelope without legacy errors key."""
    if status == HTTPStatus.NO_CONTENT:
        return "", status
    return jsonify({"data": data, "meta": {"request_id": _req_id()}}), status


def _error(status: int, code: str, message: str, details: Optional[Dict[str, Any]] = None):
    """Unified error helper returning the final contract shape.

    Shape:
        {
          "error": { "code": <lowercase>, "message": <str>, "details"?: {..} },
          "meta": { "request_id": <RID> }
        }
    """
    normalized_code = (code or "error").lower()
    payload: Dict[str, Any] = {
        "error": {"code": normalized_code, "message": message},
        "meta": {"request_id": _req_id()},
    }
    if details:
        payload["error"]["details"] = details
    return jsonify(payload), status


def format_duration_hours(hours: Optional[float]) -> str:
    """Formats a duration in hours into a compact human string.

    Test expectations (see test_stats.py):
      None / negative => "N/A"
      0.5 => "30m"
      1.5 => "1.5h"
      25.5 => "1d 1.5h"
      48 => "2d"
    """
    if hours is None:
        return "N/A"
    try:
        h = float(hours)
    except Exception:
        return "N/A"
    if h < 0:
        return "N/A"
    # Days component
    days = int(h // 24)
    rem = h - days * 24
    parts: list[str] = []
    if days:
        parts.append(f"{days}d")
    # If less than 1 hour show minutes, else show fractional hours (trim .0)
    if rem:
        if rem < 1:
            mins = int(round(rem * 60))
            if mins:
                parts.append(f"{mins}m")
        else:
            # show at most one decimal if fractional
            if abs(rem - int(rem)) < 1e-6:
                parts.append(f"{int(rem)}h")
            else:
                parts.append(f"{round(rem, 1)}h")
    if not parts:
        return "0h"
    return " ".join(parts)
