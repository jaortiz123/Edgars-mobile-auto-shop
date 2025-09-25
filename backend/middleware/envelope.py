"""
JSON envelope middleware
Handles JSON response standardization, error envelopes, pagination
Extracted from local_server.py envelope and error handling logic
"""

import json
import os

from flask import Flask, Response, g, make_response
from werkzeug.exceptions import HTTPException


def init_envelope_middleware(app: Flask) -> None:
    """
    JSON envelope, pagination, error handling

    This preserves the exact envelope wrapping and error handling logic
    from local_server.py but in a clean, reusable middleware module.
    """

    # Pagination configuration (preserve existing defaults)
    DEFAULT_PAGE_SIZE = int(os.getenv("API_DEFAULT_PAGE_SIZE", "25"))
    MAX_PAGE_SIZE = int(os.getenv("API_MAX_PAGE_SIZE", "100"))

    def _is_json_response(resp: Response) -> bool:
        """Check if response should be treated as JSON"""
        try:
            mt = (resp.mimetype or "").lower()
            if mt == "application/json":
                return True
            return bool(getattr(resp, "is_json", False))
        except Exception:
            return False

    def _already_enveloped(obj) -> bool:
        """
        Check if response is already wrapped in envelope format
        Preserves existing logic from local_server.py
        """
        if isinstance(obj, dict):
            # Full envelope format
            if {"ok", "data", "error"}.issubset(set(obj.keys())):
                return True
            # _ok() format (data + meta)
            if {"data", "meta"}.issubset(set(obj.keys())):
                return True
            # _error() format (error + meta)
            if {"error", "meta"}.issubset(set(obj.keys())):
                return True
        return False

    def _wrap_envelope(obj, ok: bool, status: int, meta: dict = None):
        """
        Wrap response in standard envelope format
        Preserves existing envelope structure from local_server.py
        """
        err = None
        data = obj if ok else None

        if not ok:
            if isinstance(obj, dict) and ("error" in obj or "message" in obj):
                msg = obj.get("error") or obj.get("message")
                err = {"code": status, "message": msg}
            else:
                err = {"code": status, "message": str(obj)}

        env = {
            "ok": bool(ok),
            "data": data,
            "error": err,
            "correlation_id": getattr(g, "correlation_id", None),
        }

        if meta:
            env["meta"] = meta

        return env

    @app.errorhandler(Exception)
    def json_error_handler(e: Exception):
        """
        Handle all exceptions with JSON envelope format
        Preserves existing error handling logic from local_server.py
        """
        status = 500
        msg = "Internal Server Error"

        if isinstance(e, HTTPException):
            status = int(getattr(e, "code", 500) or 500)
            msg = getattr(e, "description", msg) or msg

        payload = _wrap_envelope({"message": msg}, ok=False, status=status)
        resp = make_response(json.dumps(payload), status)
        resp.mimetype = "application/json"
        resp.headers["X-Correlation-Id"] = getattr(g, "correlation_id", "?")

        return resp

    @app.after_request
    def standardize_json_envelope(resp: Response) -> Response:
        """
        Wrap JSON responses in standard envelope if not already wrapped
        Preserves existing envelope logic from local_server.py
        """
        try:
            # Add correlation ID to all responses
            resp.headers.setdefault("X-Correlation-Id", getattr(g, "correlation_id", "?"))

            # Only process JSON responses
            if not _is_json_response(resp):
                return resp

            # Get response body
            try:
                body = resp.get_data(as_text=True)
                if not body.strip():
                    return resp

                data = json.loads(body)
            except (json.JSONDecodeError, Exception):
                # If we can't parse JSON, leave response unchanged
                return resp

            # Skip if already enveloped
            if _already_enveloped(data):
                return resp

            # Wrap in envelope
            status = resp.status_code or 200
            ok = 200 <= status < 300

            # TODO: Add pagination meta extraction here
            meta = None

            envelope = _wrap_envelope(data, ok, status, meta)
            resp.set_data(json.dumps(envelope))

            return resp

        except Exception:
            # Never break response due to envelope issues
            return resp
