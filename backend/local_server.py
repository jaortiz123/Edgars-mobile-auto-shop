#!/usr/bin/env python3
"""
Edgar's Mobile Auto Shop — Refactored API server

This version has been updated to address key architectural and correctness issues.
It is now PostgreSQL-only, removing all SQLite fallback logic for consistency and robustness.

Key Changes:
- Removed all SQLite fallback code and wrappers.
- Added DELETE /api/admin/appointments/<id> endpoint.
- Fixed broken try/except block in get_customer_history.
- Fixed rate_limit function signature and usage.
- Unified all API response envelopes using _ok/_fail helpers.
- Standardized on a single DB connection pattern.
- Removed duplicate imports and functions.
- CORRECTED: CSV export logic and headers.
- CORRECTED: DELETE route child table cleanup and return value.
- CORRECTED: Syntax/formatting in board column generation.
- IMPROVED: Made CORS origins configurable via environment variables.
- IMPROVED: Made rate-limiter thread-safe.
- IMPROVED: Database connection now supports DATABASE_URL.
- IMPROVED: RBAC for DELETE route is now more flexible.
"""
from __future__ import annotations

import logging
import os
import traceback
import uuid
import csv
import io
import time
import json
import base64
import threading
from http import HTTPStatus
from datetime import datetime, date, timezone, timedelta, time as dtime
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse

from flask import Flask, jsonify, request, Response
from flask_cors import CORS
from werkzeug.exceptions import HTTPException, NotFound, BadRequest, Forbidden, MethodNotAllowed
from pythonjsonlogger import jsonlogger
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
from zoneinfo import ZoneInfo

# ----------------------------------------------------------------------------
# App setup
# ----------------------------------------------------------------------------

class RequestIdFilter(logging.Filter):
    """Injects the request ID into log records."""
    def filter(self, record):
        try:
            record.request_id = request.environ.get('REQUEST_ID', 'N/A')
        except RuntimeError:
            record.request_id = 'N/A'
        return True

app = Flask(__name__)

# IMPROVED: CORS origins are now configurable via a comma-separated env var.
# This is more secure and flexible for different environments (dev, staging, prod).
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(',')
# IMPROVED: Explicitly add DELETE to methods to avoid preflight issues.
CORS(app, supports_credentials=True, origins=CORS_ORIGINS, methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"])


app.config.setdefault("PROPAGATE_EXCEPTIONS", False)
app.config.setdefault("TRAP_HTTP_EXCEPTIONS", False)

REQUEST_ID_HEADER = "X-Request-Id"

# Setup logging
log = logging.getLogger("edgar.api")
log.setLevel(os.environ.get("LOG_LEVEL", "INFO"))
log.addFilter(RequestIdFilter())
handler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter('%(asctime)s %(name)s %(levelname)s %(request_id)s %(message)s')
handler.setFormatter(formatter)
if not log.handlers:
    log.addHandler(handler)

# Configuration constants
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-do-not-use-in-prod")
JWT_ALG = "HS256"

# Dev bypass for local testing
DEV_NO_AUTH = os.getenv("DEV_NO_AUTH", "true").lower() == "true"
SHOP_TZ = os.getenv("SHOP_TZ", "America/Los_Angeles")

def shop_day_window(target_date: Optional[str] = None) -> tuple[datetime, datetime]:
    """Returns (start_utc, end_utc) for the shop-local day.

    If target_date is provided, it must be YYYY-MM-DD; otherwise use today in shop TZ.
    """
    tz = ZoneInfo(SHOP_TZ)
    try:
        if target_date:
            d = datetime.strptime(target_date, "%Y-%m-%d").date()
        else:
            d = datetime.now(tz).date()
    except Exception:
        d = datetime.now(tz).date()
    start_local = datetime.combine(d, dtime(0, 0), tzinfo=tz)
    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)

def require_or_maybe(required: Optional[str] = None) -> Dict[str, Any]:
    """DEV_NO_AUTH bypass, else require token."""
    return maybe_auth(required) or require_auth_role(required)

def maybe_auth(required: Optional[str] = None) -> Optional[Dict[str, Any]]:
    if DEV_NO_AUTH:
        return {"sub": "dev", "role": "Owner"}
    try:
        return require_auth_role(required)
    except Exception:
        return None

# IMPROVED: The rate limiter is now thread-safe using a lock.
_RATE: Dict[str, Tuple[int, float]] = {}
_RATE_LOCK = threading.Lock()
RATE_LIMIT_PER_MINUTE = int(os.getenv("MOVE_RATE_LIMIT_PER_MIN", "60"))

@app.before_request
def before_request_hook():
    """Ensures a request ID is set for every request."""
    request.environ['REQUEST_ID'] = str(uuid.uuid4())

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

def _req_id() -> str:
    """Returns the request ID for the current request."""
    return request.environ.get("REQUEST_ID", "N/A")

def _ok(data: Any, status: int = HTTPStatus.OK):
    """Builds a standardized successful JSON response."""
    if status == HTTPStatus.NO_CONTENT:
        return "", status
    return jsonify({"data": data, "errors": None, "meta": {"request_id": _req_id()}}), status

def _fail(status: int, code: str, detail: str, meta: Optional[Dict] = None):
    """Builds a standardized error JSON response."""
    return (
        jsonify({
            "data": None,
            "errors": [{"status": str(status), "code": code, "detail": detail}],
            "meta": {"request_id": _req_id(), **(meta or {})},
        }),
        status,
    )

def utcnow() -> datetime:
    """Returns the current time in UTC."""
    return datetime.now(timezone.utc)

def db_conn():
    """
    Establishes a connection to the PostgreSQL database.
    IMPROVED: Prefers DATABASE_URL if set, otherwise falls back to individual POSTGRES_* vars.
    NOTE: For production, a connection pool (like psycopg.pool or SQLAlchemy's) is recommended.
    """
    try:
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            # Parse DATABASE_URL for connection params
            result = urlparse(database_url)
            cfg = {
                'user': result.username,
                'password': result.password,
                'host': result.hostname,
                'port': result.port,
                'dbname': result.path[1:] # Trim leading '/'
            }
        else:
            # Fallback to individual environment variables
            cfg = dict(
                host=os.getenv("POSTGRES_HOST", "db"),
                port=int(os.getenv("POSTGRES_PORT", 5432)),
                dbname=os.getenv("POSTGRES_DB", "autoshop"),
                user=os.getenv("POSTGRES_USER", "user"),
                password=os.getenv("POSTGRES_PASSWORD", "password"),
            )
        
        # Common settings
        cfg.update(
            connect_timeout=int(os.getenv("POSTGRES_CONNECT_TIMEOUT", "2")),
            cursor_factory=RealDictCursor,
        )
        return psycopg2.connect(**cfg)
    except Exception as e:
        log.error("Database connection failed: %s", e)
        raise RuntimeError("Database connection failed") from e

_STATUS_ALIASES = {
    "scheduled": "SCHEDULED",
    "in_progress": "IN_PROGRESS",
    "in-progress": "IN_PROGRESS",
    "ready": "READY",
    "completed": "COMPLETED",
    "no_show": "NO_SHOW",
    "no-show": "NO_SHOW",
    "canceled": "CANCELED",
}

ALLOWED_TRANSITIONS = {
    "SCHEDULED": {"IN_PROGRESS", "READY", "NO_SHOW", "CANCELED"},
    "IN_PROGRESS": {"READY", "COMPLETED"},
    "READY": {"COMPLETED"},
    "COMPLETED": set(),
    "NO_SHOW": set(),
    "CANCELED": set(),
}

def norm_status(s: str) -> str:
    """Normalizes a status string to its canonical uppercase form."""
    if not s:
        raise BadRequest("Status required")
    s2 = s.strip().lower()
    s2 = _STATUS_ALIASES.get(s2, s2).upper()
    if s2 not in ALLOWED_TRANSITIONS:
        raise BadRequest(f"Invalid status value: {s}")
    return s2

def require_auth_role(required: Optional[str] = None) -> Dict[str, Any]:
    """Validates JWT from Authorization header."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise Forbidden("Missing or invalid authorization token")
    token = auth.split(" ", 1)[1]
    try:
        # NOTE: For production, consider adding 'leeway' for clock skew.
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG], options={"verify_exp": True})
    except jwt.ExpiredSignatureError:
        raise Forbidden("Token has expired")
    except jwt.InvalidTokenError:
        raise Forbidden("Invalid token")

    role = payload.get("role", "Advisor")
    if required and role != required and role != "Owner":
        raise Forbidden(f"Insufficient permissions. Required role: {required}")
    return payload

def rate_limit(key: str, limit: int = RATE_LIMIT_PER_MINUTE, window: int = 60):
    """A simple, thread-safe in-memory rate limiter."""
    now = time.time()
    with _RATE_LOCK:
        count, start = _RATE.get(key, (0, now))
        if now - start >= window:
            _RATE[key] = (1, now)
            return
        if count + 1 > limit:
            log.warning("Rate limit exceeded for key: %s", key)
            raise Forbidden("Rate limit exceeded")
        _RATE[key] = (count + 1, start)

def audit(conn, user_id: str, action: str, entity: str, entity_id: str, before: Dict, after: Dict):
    """Logs an audit event to the database.

    In dev, user_id may not be a UUID; coerce to a valid UUID to avoid transaction aborts.
    """
    try:
        try:
            # Validate/normalize user_id to UUID string
            user_uuid = str(uuid.UUID(str(user_id)))
        except Exception:
            user_uuid = str(uuid.uuid4())
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO audit_logs (id, user_id, action, entity, entity_id, before, after, created_at)
                VALUES (gen_random_uuid(), %s::uuid, %s, %s, %s, %s::jsonb, %s::jsonb, now())
                """,
                (user_uuid, action, entity, entity_id, json.dumps(before), json.dumps(after)),
            )
    except Exception as e:
        log.warning("Audit log insert failed: %s", e)

# ----------------------------------------------------------------------------
# Error Handlers
# ----------------------------------------------------------------------------

def handle_http_exception(e: HTTPException):
    """Centralized handler for standard HTTP exceptions."""
    status = e.code or 500
    code_map = {
        400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN",
        404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 429: "RATE_LIMITED",
    }
    code = code_map.get(status, "HTTP_ERROR")
    log.warning(
        "HTTP exception caught: %s", e.description,
        extra={"status": status, "code": code, "path": request.path}
    )
    return _fail(status, code, e.description or e.name or "HTTP error")

def handle_unexpected_exception(e: Exception):
    """Centralized handler for unexpected (500-level) exceptions."""
    log.error(
        "Unhandled exception caught: %s", str(e),
        extra={"path": request.path, "traceback": traceback.format_exc()}
    )
    return _fail(HTTPStatus.INTERNAL_SERVER_ERROR, "INTERNAL_SERVER_ERROR", "An unexpected internal server error occurred.")

app.register_error_handler(HTTPException, handle_http_exception)
app.register_error_handler(Exception, handle_unexpected_exception)

# ----------------------------------------------------------------------------
# Health
# ----------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint to verify service and database connectivity."""
    try:
        conn = db_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return jsonify({"status": "ok", "db": "up"})
    except Exception as e:
        log.critical("Health check failed: %s", e)
        return jsonify({"status": "error", "db": "down", "detail": str(e)}), 503

# ----------------------------------------------------------------------------
# Board
# ----------------------------------------------------------------------------
@app.route("/api/admin/appointments/board", methods=["GET"]) 

def get_board():
    maybe_auth()
    frm = request.args.get("from")
    to = request.args.get("to")
    tech_id = request.args.get("techId")
    target_date = request.args.get("date")  # YYYY-MM-DD in shop TZ
    include_carry = (request.args.get("includeCarryover", "true").lower() != "false")

    conn = db_conn()
    with conn:
        with conn.cursor() as cur:
            rows = []
            params: list[Any] = []
            # If explicit from/to provided, use them; otherwise, use shop-local day window
            if frm or to:
                where = ["1=1"]
                if frm:
                    where.append("a.start_ts >= %s")
                    params.append(frm)
                if to:
                    where.append("a.end_ts <= %s")
                    params.append(to)
                if tech_id:
                    where.append("a.tech_id = %s")
                    params.append(tech_id)
                where_sql = " AND ".join(where)
                cur.execute(
                    f"""
              SELECT a.id::text,
                  a.status::text,
                  a.start_ts,
                  a.end_ts,
                                    a.tech_id,
                                    a.check_in_at,
                                    a.check_out_at,
                  COALESCE(c.name, 'Unknown Customer') AS customer_name,
                  v.make, v.model, v.year, v.license_plate AS vin,
                  COALESCE(a.total_amount, 0) AS price
                    FROM appointments a
                    LEFT JOIN customers c ON c.id = a.customer_id
                    LEFT JOIN vehicles  v ON v.id = a.vehicle_id
                    WHERE {where_sql}
                    ORDER BY a.start_ts ASC NULLS LAST, a.id ASC
                    LIMIT 500
                    """,
                    params,
                )
                rows = cur.fetchall()
            else:
                start_utc, end_utc = shop_day_window(target_date)
                base_params: list[Any] = [start_utc, end_utc]
                tech_clause = ""
                if tech_id:
                    tech_clause = " AND a.tech_id = %s"
                    base_params.append(tech_id)

                # Today's appointments in shop TZ
                cur.execute(
                    f"""
              SELECT a.id::text,
                  a.status::text,
                  a.start_ts,
                  a.end_ts,
                                    a.tech_id,
                                    a.check_in_at,
                                    a.check_out_at,
                  COALESCE(c.name, 'Unknown Customer') AS customer_name,
                  v.make, v.model, v.year, v.license_plate AS vin,
                  COALESCE(a.total_amount, 0) AS price
                FROM appointments a
                LEFT JOIN customers c ON c.id = a.customer_id
                LEFT JOIN vehicles  v ON v.id = a.vehicle_id
                WHERE a.start_ts >= %s AND a.start_ts < %s{tech_clause}
                ORDER BY a.start_ts ASC NULLS LAST, a.id ASC
                LIMIT 500
                    """,
                    base_params,
                )
                primary_rows = cur.fetchall()

                if include_carry:
                    # Carryover: started before start_utc and still on premises/in progress
                    carry_params: list[Any] = [start_utc]
                    if tech_id:
                        carry_params.append(tech_id)
                    cur.execute(
                        f"""
                  SELECT a.id::text,
                      a.status::text,
                      a.start_ts,
                      a.end_ts,
                                            a.tech_id,
                                            a.check_in_at,
                                            a.check_out_at,
                      COALESCE(c.name, 'Unknown Customer') AS customer_name,
                      v.make, v.model, v.year, v.license_plate AS vin,
                      COALESCE(a.total_amount, 0) AS price
                    FROM appointments a
                    LEFT JOIN customers c ON c.id = a.customer_id
                    LEFT JOIN vehicles  v ON v.id = a.vehicle_id
                    WHERE a.start_ts < %s
                      AND (
                        a.status IN ('IN_PROGRESS','READY')
                        OR (a.check_in_at IS NOT NULL AND a.check_out_at IS NULL)
                      ){tech_clause}
                    ORDER BY a.start_ts ASC NULLS LAST, a.id ASC
                    LIMIT 500
                        """,
                        carry_params,
                    )
                    carry_rows = cur.fetchall()
                else:
                    carry_rows = []

                # Merge de-duplicating by id
                seen = set()
                for r in primary_rows + carry_rows:
                    if r["id"] in seen:
                        continue
                    seen.add(r["id"])
                    rows.append(r)

    def vehicle_label(r: Dict[str, Any]) -> str:
        parts = [str(r.get("year") or "").strip(), r.get("make") or "", r.get("model") or ""]
        label = " ".join(p for p in parts if p).strip()
        return label or (r.get("vin") or "Vehicle")

    cards: list[Dict[str, Any]] = []
    position_by_status: Dict[str, int] = {k: 0 for k in [
        "SCHEDULED", "IN_PROGRESS", "READY", "COMPLETED", "NO_SHOW", "CANCELED"
    ]}
    for r in rows:
        status = r["status"]
        position_by_status[status] = position_by_status.get(status, 0) + 1
        cards.append({
            "id": r["id"],
            "customerName": r.get("customer_name") or "",
            "vehicle": vehicle_label(r),
            "price": float(r.get("price") or 0),
            "status": status,
            "position": position_by_status[status],
            "start": r.get("start_ts").isoformat() if r.get("start_ts") else None,
            "end": r.get("end_ts").isoformat() if r.get("end_ts") else None,
            # expose check-in/out to drive on-prem indicators and days-on-lot
            "checkInAt": r.get("check_in_at").isoformat() if r.get("check_in_at") else None,
            "checkOutAt": r.get("check_out_at").isoformat() if r.get("check_out_at") else None,
            "techAssigned": r.get("tech_id"),
            "vehicleYear": r.get("year"),
            "vehicleMake": r.get("make"),
            "vehicleModel": r.get("model"),
        })

    # Keep the 5-column layout expected by the UI (no explicit CANCELED column)
    titles = {
        "SCHEDULED": "Scheduled",
        "IN_PROGRESS": "In Progress",
        "READY": "Ready",
        "COMPLETED": "Completed",
        "NO_SHOW": "No-Show",
    }
    columns: list[Dict[str, Any]] = []
    for key in ["SCHEDULED", "IN_PROGRESS", "READY", "COMPLETED", "NO_SHOW"]:
        col_cards = [c for c in cards if c["status"] == key]
        columns.append({
            "key": key,
            "title": titles[key],
            "count": len(col_cards),
            "sum": round(sum(float(c.get("price") or 0) for c in col_cards), 2),
        })

    # IMPORTANT: Board endpoint returns raw shape, not the standard envelope
    return jsonify({"columns": columns, "cards": cards})

# ----------------------------------------------------------------------------
# Move endpoint
# ----------------------------------------------------------------------------
@app.route("/api/admin/appointments/<appt_id>/move", methods=["PATCH"])
def move_card(appt_id: str):
    user = require_or_maybe()
    key = f"move:{request.remote_addr}:{user.get('sub', 'anon')}"
    rate_limit(key)

    body = request.get_json(force=True, silent=False) or {}
    new_status = norm_status(str(body.get("status", "")))
    position = int(body.get("position", 1))

    conn = db_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id::text, status::text FROM appointments WHERE id = %s FOR UPDATE", (appt_id,))
            row = cur.fetchone()
            if not row:
                raise NotFound('Appointment not found')
            old_status = row["status"]
            if new_status not in ALLOWED_TRANSITIONS.get(old_status, set()):
                raise BadRequest(f"Invalid transition {old_status} -> {new_status}")

            cur.execute("UPDATE appointments SET status = %s WHERE id = %s", (new_status, appt_id))
            audit(conn, user.get("sub", "anon"), "STATUS_CHANGE", "appointment", appt_id, {"status": old_status}, {"status": new_status})

    return _ok({"id": appt_id, "status": new_status, "position": position})

# ----------------------------------------------------------------------------
# Drawer
# ----------------------------------------------------------------------------
@app.route("/api/appointments/<appt_id>", methods=["GET", "PATCH"])
def appointment_handler(appt_id: str):
    if request.method == "GET":
        return get_appointment(appt_id)
    elif request.method == "PATCH":
        return patch_appointment(appt_id)

def get_appointment(appt_id: str):
    """Gets full appointment details."""
    conn = db_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                """
          SELECT a.id::text,
                 a.status::text,
                 a.start_ts,
                 a.end_ts,
                 a.total_amount,
                 a.paid_amount,
                 a.location_address,
                 a.notes,
                 a.check_in_at,
                 a.check_out_at,
                 a.tech_id::text AS tech_id,
                 c.id::text AS customer_id,
                 c.name AS customer_name,
                 c.email,
                 c.phone,
                 v.id::text AS vehicle_id,
                 v.year,
                 v.make,
                 v.model,
                 v.license_plate AS vin
            FROM appointments a
            LEFT JOIN customers c ON c.id = a.customer_id
            LEFT JOIN vehicles  v ON v.id = a.vehicle_id
            WHERE a.id = %s
                """,
                (appt_id,),
            )
            row = cur.fetchone()
            if not row:
                raise NotFound("Appointment not found")

            cur.execute(
                """
                SELECT id::text, name, notes, estimated_hours, estimated_price
                FROM appointment_services
                WHERE appointment_id = %s ORDER BY created_at
                """,
                (appt_id,),
            )
            services = cur.fetchall()

    def iso(dt):
        return dt.isoformat() if dt else None

    appointment_data = {
        "appointment": {
            "id": row["id"], "status": row["status"],
            "start": iso(row.get("start_ts")), "end": iso(row.get("end_ts")),
            "total_amount": float(row.get("total_amount") or 0),
            "paid_amount": float(row.get("paid_amount") or 0),
            "location_address": row.get("location_address"),
            "notes": row.get("notes"),
            "check_in_at": iso(row.get("check_in_at")), "check_out_at": iso(row.get("check_out_at")),
            "tech_id": row.get("tech_id"),
        },
        "customer": {
            "id": row.get("customer_id"), "name": row.get("customer_name"),
            "email": row.get("email"), "phone": row.get("phone"),
        },
        "vehicle": {
            "id": row.get("vehicle_id"), "year": row.get("year"),
            "make": row.get("make"), "model": row.get("model"), "vin": row.get("vin"),
        },
        "services": [
            {
                "id": s["id"], "name": s["name"], "notes": s.get("notes"),
                "estimated_hours": float(s["estimated_hours"]) if s.get("estimated_hours") is not None else None,
                "estimated_price": float(s["estimated_price"]) if s.get("estimated_price") is not None else None,
            }
            for s in services
        ],
    }
    return _ok(appointment_data)

def patch_appointment(appt_id: str):
    user = require_or_maybe()
    body = request.get_json(force=True, silent=False) or {}
    if "status" in body:
        body["status"] = norm_status(str(body["status"]))

    fields = [
        ("status", "status"), ("start", "start_ts"), ("end", "end_ts"),
        ("total_amount", "total_amount"), ("paid_amount", "paid_amount"),
        ("check_in_at", "check_in_at"), ("check_out_at", "check_out_at"),
        ("tech_id", "tech_id"),
    ]
    sets = []
    params: list[Any] = []
    for key, col in fields:
        if key in body and body[key] is not None:
            sets.append(f"{col} = %s")
            params.append(body[key])
    if not sets:
        raise BadRequest("No valid fields to update")

    conn = db_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id::text, status::text FROM appointments WHERE id = %s FOR UPDATE", (appt_id,))
            old = cur.fetchone()
            if not old:
                raise NotFound("Appointment not found")

            params.append(appt_id)
            cur.execute(f"UPDATE appointments SET {', '.join(sets)} WHERE id = %s", params)
            audit(conn, user.get("sub", "system"), "APPT_PATCH", "appointment", appt_id, {"status": old["status"]}, {k: body[k] for k in body.keys()})

    return _ok({"id": appt_id, "updated_fields": list(body.keys())})

# ----------------------------------------------------------------------------
# Quick actions: start/ready/complete (sync Calendar with Board)
# ----------------------------------------------------------------------------

def _set_status(conn, appt_id: str, new_status: str, user: Dict[str, Any], *, check_in=False, check_out=False):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id::text, status::text, check_in_at, check_out_at FROM appointments WHERE id = %s FOR UPDATE",
            (appt_id,)
        )
        row = cur.fetchone()
        if not row:
            raise NotFound("Appointment not found")
        old_status = row["status"]
        if new_status != old_status and new_status not in ALLOWED_TRANSITIONS.get(old_status, set()):
            raise BadRequest(f"Invalid transition {old_status} -> {new_status}")

        sets = ["status = %s"]
        params: list[Any] = [new_status]
        if check_in:
            sets.append("check_in_at = COALESCE(check_in_at, now())")
        if check_out:
            sets.append("check_out_at = COALESCE(check_out_at, now())")
        params.append(appt_id)
        cur.execute(f"UPDATE appointments SET {', '.join(sets)} WHERE id = %s", params)
        audit(conn, user.get("sub", "dev"), "STATUS_CHANGE", "appointment", appt_id, {"status": old_status}, {"status": new_status})

@app.route("/api/appointments/<appt_id>/start", methods=["POST"]) 
def start_job(appt_id: str):
    user = require_or_maybe()
    conn = db_conn()
    with conn:
        _set_status(conn, appt_id, "IN_PROGRESS", user, check_in=True)
    return _ok({"id": appt_id, "status": "IN_PROGRESS"})

@app.route("/api/appointments/<appt_id>/ready", methods=["POST"]) 
def ready_job(appt_id: str):
    user = require_or_maybe()
    conn = db_conn()
    with conn:
        _set_status(conn, appt_id, "READY", user)
    return _ok({"id": appt_id, "status": "READY"})

@app.route("/api/appointments/<appt_id>/complete", methods=["POST"]) 
def complete_job(appt_id: str):
    user = require_or_maybe()
    conn = db_conn()
    with conn:
        _set_status(conn, appt_id, "COMPLETED", user, check_out=True)
    return _ok({"id": appt_id, "status": "COMPLETED"})

# ----------------------------------------------------------------------------
# Admin List & CRUD
# ----------------------------------------------------------------------------
@app.route("/api/admin/appointments", methods=["GET"])
def get_admin_appointments():
    """Returns a paginated list of appointments with filtering."""
    # Auth optional for read in dev/local; still enforced in prod when DEV_NO_AUTH is false
    maybe_auth()
    args = request.args
    limit = int(args.get("limit", 50))
    offset = int(args.get("offset", 0))
    if not (1 <= limit <= 200): raise BadRequest("limit must be between 1 and 200")
    if offset < 0: raise BadRequest("offset must be non-negative")

    where = ["1=1"]
    params = []
    if args.get("status"):
        where.append("a.status = %s")
        params.append(norm_status(args["status"]))
    if args.get("from"):
        where.append("a.start_ts >= %s")
        params.append(args["from"])
    if args.get("to"):
        where.append("a.end_ts <= %s")
        params.append(args["to"])
    if args.get("techId"):
        where.append("a.tech_id = %s")
        params.append(args.get("techId"))
    if args.get("q"):
        q = f"%{args.get('q')}%"
        where.append("(c.name ILIKE %s OR v.make ILIKE %s OR v.model ILIKE %s)")
        params.extend([q, q, q])

    where_sql = " AND ".join(where)
    query = f"""
         SELECT a.id::text, a.status::text, a.start_ts, a.end_ts,
                COALESCE(a.total_amount, 0) AS total_amount,
                c.name as customer_name,
                COALESCE(v.make, '') || ' ' || COALESCE(v.model, '') as vehicle_label
         FROM appointments a
         LEFT JOIN customers c ON c.id = a.customer_id
         LEFT JOIN vehicles v ON v.id = a.vehicle_id
         WHERE {where_sql}
         ORDER BY a.start_ts ASC, a.id ASC
         LIMIT %s OFFSET %s
     """
    conn = db_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute(query, (*params, limit, offset))
            appointments = cur.fetchall()

    for appt in appointments:
        if appt.get('start_ts'): appt['start_ts'] = appt['start_ts'].isoformat()
        if appt.get('end_ts'): appt['end_ts'] = appt['end_ts'].isoformat()
        if 'total_amount' in appt: appt['total_amount'] = float(appt['total_amount'])

    return _ok({"appointments": appointments})

@app.route("/api/admin/appointments", methods=["POST"])
def create_appointment():
    # Allow dev bypass; otherwise require Owner
    user = require_or_maybe("Owner")
    body = request.get_json(silent=True) or {}

    # Accept either 'start' or 'requested_time'
    start_val = body.get("start") or body.get("requested_time") or utcnow().isoformat()
    try:
        start_dt = datetime.fromisoformat(str(start_val).replace("Z", "+00:00"))
    except Exception:
        raise BadRequest("start/requested_time must be a valid ISO8601 timestamp")
    status = norm_status(str(body.get("status", "SCHEDULED")))

    total_amount = body.get("total_amount")
    paid_amount = body.get("paid_amount")

    # Customer fields
    customer_id = body.get("customer_id")
    customer_name = body.get("customer_name") or body.get("customer")
    customer_phone = body.get("customer_phone")
    customer_email = body.get("customer_email")

    # Vehicle fields
    license_plate = body.get("license_plate") or body.get("vin")
    vehicle_year = body.get("vehicle_year")
    vehicle_make = body.get("vehicle_make")
    vehicle_model = body.get("vehicle_model")

    notes = body.get("notes")
    location_address = body.get("location_address")

    conn = db_conn()
    with conn:
        with conn.cursor() as cur:
            # Resolve or create customer
            resolved_customer_id = None
            if customer_id:
                # Verify provided ID exists; if not a UUID or not found, treat as name
                try:
                    uuid.UUID(str(customer_id))
                    cur.execute("SELECT id::text FROM customers WHERE id = %s", (customer_id,))
                    row = cur.fetchone()
                    if row:
                        resolved_customer_id = row["id"]
                except Exception:
                    # Not a UUID; treat as name
                    if not customer_name:
                        customer_name = str(customer_id)
            if not resolved_customer_id:
                # Try to find by phone/email first
                if customer_phone:
                    cur.execute("SELECT id::text FROM customers WHERE phone = %s LIMIT 1", (customer_phone,))
                    row = cur.fetchone()
                    if row:
                        resolved_customer_id = row["id"]
                if not resolved_customer_id and customer_email:
                    cur.execute("SELECT id::text FROM customers WHERE email = %s LIMIT 1", (customer_email,))
                    row = cur.fetchone()
                    if row:
                        resolved_customer_id = row["id"]
                if not resolved_customer_id and customer_name:
                    cur.execute("SELECT id::text FROM customers WHERE LOWER(name) = LOWER(%s) LIMIT 1", (customer_name,))
                    row = cur.fetchone()
                    if row:
                        resolved_customer_id = row["id"]
                if not resolved_customer_id:
                    # Create a new customer (compatible with SERIAL or UUID schemas)
                    cur.execute(
                        """
                        INSERT INTO customers (name, phone, email)
                        VALUES (%s, %s, %s)
                        RETURNING id::text
                        """,
                        (customer_name or "Unknown Customer", customer_phone, customer_email),
                    )
                    resolved_customer_id = (cur.fetchone() or {}).get("id")

            # Resolve or create vehicle (by license plate when provided)
            resolved_vehicle_id = None
            if license_plate:
                cur.execute("SELECT id::text, customer_id::text FROM vehicles WHERE license_plate ILIKE %s LIMIT 1", (license_plate,))
                vrow = cur.fetchone()
                if vrow:
                    resolved_vehicle_id = vrow["id"]
                    # If this vehicle has no customer link but we created one, link it
                    if resolved_customer_id and (vrow.get("customer_id") != resolved_customer_id):
                        try:
                            cur.execute("UPDATE vehicles SET customer_id = %s WHERE id = %s", (resolved_customer_id, resolved_vehicle_id))
                        except Exception:
                            pass
                else:
                    # Create a vehicle associated to the customer
                    # Compatible with both INTEGER SERIAL and UUID id columns by not specifying id explicitly
                    cur.execute(
                        """
                        INSERT INTO vehicles (customer_id, year, make, model, license_plate)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING id::text
                        """,
                        (resolved_customer_id, vehicle_year, vehicle_make, vehicle_model, license_plate),
                    )
                    resolved_vehicle_id = (cur.fetchone() or {}).get("id")

            # Insert appointment
            cur.execute(
                """
                INSERT INTO appointments (status, start_ts, total_amount, paid_amount, customer_id, vehicle_id, notes, location_address)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id::text
                """,
                (status, start_dt, total_amount, paid_amount, resolved_customer_id, resolved_vehicle_id, notes, location_address),
            )
            row = cur.fetchone()
            if not row:
                raise RuntimeError("Failed to create appointment, no ID returned.")
            new_id = row["id"]
            audit(conn, user.get("sub", "system"), "APPT_CREATE", "appointment", new_id, {}, {
                "status": status,
                "start": start_val,
                "customer_id": resolved_customer_id,
                "vehicle_id": resolved_vehicle_id,
            })
    return _ok({"id": new_id}, HTTPStatus.CREATED)

@app.route("/api/admin/appointments/<appt_id>", methods=["DELETE"])
def delete_appointment(appt_id: str):
    """
    Deletes an appointment.
    CORRECTED: RBAC now allows Owner or Advisor.
    CORRECTED: Returns a proper empty 204 response.
    """
    # In dev, allow bypass; otherwise require a valid token
    user = maybe_auth()
    if not user:
        user = require_auth_role()
    if user.get("role") not in ["Owner", "Advisor"]:
        return _fail(HTTPStatus.FORBIDDEN, "RBAC_FORBIDDEN", "Only Owner and Advisor can delete appointments")
    
    conn = db_conn()
    with conn:
        with conn.cursor() as cur:
            # For production, ON DELETE CASCADE is preferred. Manually deleting for now.
            child_tables = ["appointment_services", "messages", "payments"]
            for table in child_tables:
                try:
                    cur.execute(f"DELETE FROM {table} WHERE appointment_id = %s", (appt_id,))
                except psycopg2.Error as e:
                    log.warning(f"Could not delete from child table {table} for appointment {appt_id}: {e}")
                    pass

            # Now delete the main appointment record.
            cur.execute("DELETE FROM appointments WHERE id = %s RETURNING id::text", (appt_id,))
            deleted = cur.fetchone()
            if not deleted:
                raise NotFound("Appointment not found")
            
            audit(conn, user.get("sub"), "APPT_DELETE", "appointment", appt_id, {"id": appt_id}, {})

    return "", HTTPStatus.NO_CONTENT

# ----------------------------------------------------------------------------
# Customer History
# ----------------------------------------------------------------------------
@app.route("/api/customers/<customer_id>/history", methods=["GET"])
def get_customer_history(customer_id: str):
    """Get customer's appointment and payment history."""
    require_auth_role("Advisor")
    conn = db_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, name FROM customers WHERE id = %s", (customer_id,))
                if not cur.fetchone():
                    raise NotFound("Customer not found")

                cur.execute(
                    """
                    SELECT a.id::text, a.status::text, a.start_ts, a.total_amount, a.paid_amount,
                           COALESCE(
                               JSON_AGG(
                                   JSON_BUILD_OBJECT('id', p.id::text, 'amount', p.amount, 'method', p.method, 'created_at', p.created_at)
                                   ORDER BY p.created_at DESC
                               ) FILTER (WHERE p.id IS NOT NULL), '[]'::json
                           ) as payments
                    FROM appointments a
                    LEFT JOIN payments p ON p.appointment_id = a.id
                    WHERE a.customer_id = %s AND a.status IN ('COMPLETED', 'NO_SHOW', 'CANCELED')
                    GROUP BY a.id
                    ORDER BY a.start_ts DESC
                    """,
                    (customer_id,)
                )
                appointments = cur.fetchall()

        past_appointments = [
            {
                "id": appt["id"], "status": appt["status"],
                "start": appt["start_ts"].isoformat() if appt.get("start_ts") else None,
                "total_amount": float(appt["total_amount"] or 0.0),
                "paid_amount": float(appt["paid_amount"] or 0.0),
                "payments": appt["payments"] or []
            }
            for appt in appointments
        ]
        return _ok({"pastAppointments": past_appointments})

    except Exception as e:
        log.error("Failed to get customer history for %s: %s", customer_id, e)
        raise

# ----------------------------------------------------------------------------
# CSV Exports
# ----------------------------------------------------------------------------
@app.route("/api/admin/reports/appointments.csv", methods=["GET"])
def export_appointments_csv():
    """
    Export appointments as CSV file.
    CORRECTED: This version is fully rewritten to be correct and robust.
    """
    user = require_auth_role("Advisor")
    rate_limit(f"csv_export:{user.get('sub')}", limit=5, window=3600)

    conn = db_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT a.id::text AS id,
                       c.name AS customer,
                       (v.year::text || ' ' || v.make || ' ' || v.model) AS vehicle,
                       a.start_ts,
                       a.status::text AS status,
                       a.total_amount,
                       a.paid_amount
                FROM appointments a
                LEFT JOIN customers c ON c.id = a.customer_id
                LEFT JOIN vehicles v ON v.id = a.vehicle_id
                ORDER BY a.start_ts DESC
            """)
            rows = cur.fetchall()

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id","customer","vehicle","start","status","total_amount","paid_amount"])
    for r in rows:
        start_iso = r["start_ts"].isoformat() if r.get("start_ts") else ""
        w.writerow([
            r["id"], r["customer"], r["vehicle"], start_iso,
            r["status"], float(r["total_amount"] or 0), float(r["paid_amount"] or 0)
        ])
    
    return Response(
        buf.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=appointments.csv"},
    )

# ----------------------------------------------------------------------------
# Root
# ----------------------------------------------------------------------------
@app.route("/", methods=["GET"])
def root():
    """Lists all available endpoints."""
    return jsonify({
        "message": "Edgar's Auto Shop API",
        "endpoints": sorted([
            "GET /health",
            "GET /api/admin/appointments/board",
            "GET /api/admin/appointments",
            "POST /api/admin/appointments",
            "DELETE /api/admin/appointments/<id>",
            "PATCH /api/admin/appointments/<id>/move",
            "GET /api/admin/customers/search",
            "GET /api/admin/customers/<id>/visits",
            "GET /api/admin/vehicles/<plate>/visits",
            "GET /api/appointments/<id>",
            "PATCH /api/appointments/<id>",
            "GET /api/customers/<id>/history",
            "GET /api/admin/reports/appointments.csv",
        ])
    })

# ----------------------------------------------------------------------------
# Admin dashboard stats (raw JSON expected by frontend)
# ----------------------------------------------------------------------------

@app.route("/api/admin/dashboard/stats", methods=["GET"])

def admin_dashboard_stats():
    # Auth optional for now (UI-friendly)
    try:
        require_auth_role()
    except Exception:
        pass

    conn = db_conn()
    with conn:
        with conn.cursor() as cur:
            # Define shop-local day window
            start, end = shop_day_window(None)

            def count_where(where_sql: str, params: list[Any]):
                cur.execute(f"SELECT count(1) AS c FROM appointments a WHERE {where_sql}", params)
                return int((cur.fetchone() or {}).get("c", 0))

            base = "a.start_ts >= %s AND a.start_ts < %s"
            base_params = [start, end]
            jobs_today = count_where(base, base_params)
            scheduled = count_where(base + " AND a.status = 'SCHEDULED'", base_params)
            in_progress = count_where(base + " AND a.status = 'IN_PROGRESS'", base_params)
            ready = count_where(base + " AND a.status = 'READY'", base_params)
            completed = count_where(base + " AND a.status = 'COMPLETED'", base_params)
            no_show = count_where(base + " AND a.status = 'NO_SHOW'", base_params)

    cars_on_premises = in_progress + ready
    unpaid_total = 0  # Fast path; can compute from payments later

    return jsonify({
        "jobsToday": jobs_today,
        "carsOnPremises": cars_on_premises,
        "scheduled": scheduled,
        "inProgress": in_progress,
        "ready": ready,
        "completed": completed,
        "noShow": no_show,
        "unpaidTotal": unpaid_total,
        "totals": {
            "today_completed": completed,
            "today_booked": scheduled,
            "avg_cycle": None,
            "avg_cycle_formatted": "N/A",
        },
    })


# ----------------------------------------------------------------------------
# Customers: search and visit history (vehicle plate as primary key)
# ----------------------------------------------------------------------------

@app.route("/api/admin/customers/search", methods=["GET"])
def admin_search_customers():
    """Search customers/vehicles by free text with license plate as primary anchor.

    Returns a vehicle-centric list so the license plate is the visible source of truth
    tying a customer to a car.
    """
    try:
        require_auth_role()
    except Exception:
        # Allow dev browsing
        pass

    q = (request.args.get("q") or "").strip()
    if not q:
        return _ok({"items": []})
    limit = min(int(request.args.get("limit", 25)), 100)

    conn = db_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                WITH hits AS (
                  SELECT v.id::text AS vehicle_id,
                         v.license_plate,
                         v.year, v.make, v.model,
                         c.id::text AS customer_id,
                         COALESCE(NULLIF(TRIM(c.name), ''), 'Unknown Customer') AS customer_name,
                         c.phone, c.email
                  FROM vehicles v
                  JOIN customers c ON c.id = v.customer_id
                  WHERE v.license_plate ILIKE %(pat)s
                  UNION ALL
                  SELECT v2.id::text, v2.license_plate, v2.year, v2.make, v2.model,
                         c2.id::text, COALESCE(NULLIF(TRIM(c2.name), ''), 'Unknown Customer'), c2.phone, c2.email
                  FROM customers c2
                  JOIN vehicles v2 ON v2.customer_id = c2.id
                  WHERE (c2.name ILIKE %(pat)s OR c2.phone ILIKE %(pat)s OR c2.email ILIKE %(pat)s)
                )
                SELECT h.vehicle_id, h.customer_id, h.customer_name, h.phone, h.email,
                       h.license_plate, h.year, h.make, h.model,
                       COUNT(a.id) AS visits_count,
                       MAX(a.start_ts) AS last_visit
                FROM hits h
                LEFT JOIN appointments a ON a.vehicle_id::text = h.vehicle_id
                GROUP BY h.vehicle_id, h.customer_id, h.customer_name, h.phone, h.email,
                         h.license_plate, h.year, h.make, h.model
                ORDER BY (h.license_plate ILIKE %(prefix)s) DESC, last_visit DESC NULLS LAST, h.customer_name ASC
                LIMIT %(limit)s
                """,
                {"pat": f"%{q}%", "prefix": f"{q}%", "limit": limit},
            )
            rows = cur.fetchall()

    items = []
    for r in rows:
        vehicle_label = " ".join(str(x) for x in [r.get("year"), r.get("make"), r.get("model")] if x)
        items.append({
            "vehicleId": r["vehicle_id"],
            "customerId": r["customer_id"],
            "name": r["customer_name"],
            "phone": r.get("phone"),
            "email": r.get("email"),
            "plate": r.get("license_plate"),
            "vehicle": vehicle_label or "Vehicle",
            "visitsCount": int(r.get("visits_count") or 0),
            "lastVisit": r.get("last_visit").isoformat() if r.get("last_visit") else None,
        })

    return _ok({"items": items})


def _visits_rows_to_payload(rows):
    visits = []
    for r in rows:
        visits.append({
            "id": r["id"],
            "status": r["status"],
            "start": r.get("start_ts").isoformat() if r.get("start_ts") else None,
            "end": r.get("end_ts").isoformat() if r.get("end_ts") else None,
            "price": float(r.get("total_amount") or 0),
            "checkInAt": r.get("check_in_at").isoformat() if r.get("check_in_at") else None,
            "checkOutAt": r.get("check_out_at").isoformat() if r.get("check_out_at") else None,
            "vehicle": " ".join(str(x) for x in [r.get("year"), r.get("make"), r.get("model")] if x) or "Vehicle",
            "plate": r.get("license_plate"),
            "services": r.get("services") or [],
            "notes": r.get("notes") or [],
        })
    return visits


@app.route("/api/admin/customers/<cust_id>/visits", methods=["GET"])
def admin_customer_visits(cust_id: str):
    """Return up to 200 recent appointments for a customer (all statuses)."""
    try:
        require_auth_role()
    except Exception:
        pass

    conn = db_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT a.id::text,
                       a.status::text,
                       a.start_ts, a.end_ts,
                       COALESCE(a.total_amount, 0) AS total_amount,
                       a.check_in_at, a.check_out_at,
                       v.year, v.make, v.model, v.license_plate,
                       COALESCE((
                         SELECT JSON_AGG(JSON_BUILD_OBJECT('id', s.id::text, 'name', s.name, 'notes', s.notes, 'estimated_price', s.estimated_price)
                                         ORDER BY s.created_at)
                         FROM appointment_services s WHERE s.appointment_id = a.id
                       ), '[]'::json) AS services,
                       COALESCE((
                         SELECT JSON_AGG(JSON_BUILD_OBJECT('id', m.id::text, 'channel', m.channel, 'direction', m.direction, 'body', m.body, 'status', m.status, 'created_at', m.sent_at)
                                         ORDER BY m.sent_at DESC)
                         FROM messages m WHERE m.appointment_id = a.id
                       ), '[]'::json) AS notes
                FROM appointments a
                LEFT JOIN vehicles v ON v.id = a.vehicle_id
                WHERE a.customer_id::text = %s
                ORDER BY a.start_ts DESC NULLS LAST, a.id DESC
                LIMIT 200
                """,
                (cust_id,),
            )
            rows = cur.fetchall()
    return _ok({"visits": _visits_rows_to_payload(rows)})


@app.route("/api/admin/vehicles/<license_plate>/visits", methods=["GET"])
def admin_vehicle_visits(license_plate: str):
    """Return up to 200 recent appointments for a given license plate (case-insensitive)."""
    try:
        require_auth_role()
    except Exception:
        pass

    conn = db_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT a.id::text,
                       a.status::text,
                       a.start_ts, a.end_ts,
                       COALESCE(a.total_amount, 0) AS total_amount,
                       a.check_in_at, a.check_out_at,
                       v.year, v.make, v.model, v.license_plate,
                       COALESCE((
                         SELECT JSON_AGG(JSON_BUILD_OBJECT('id', s.id::text, 'name', s.name, 'notes', s.notes, 'estimated_price', s.estimated_price)
                                         ORDER BY s.created_at)
                         FROM appointment_services s WHERE s.appointment_id = a.id
                       ), '[]'::json) AS services,
                       COALESCE((
                         SELECT JSON_AGG(JSON_BUILD_OBJECT('id', m.id::text, 'channel', m.channel, 'direction', m.direction, 'body', m.body, 'status', m.status, 'created_at', m.sent_at)
                                         ORDER BY m.sent_at DESC)
                         FROM messages m WHERE m.appointment_id = a.id
                       ), '[]'::json) AS notes
                FROM appointments a
                JOIN vehicles v ON v.id = a.vehicle_id
                WHERE v.license_plate ILIKE %s
                ORDER BY a.start_ts DESC NULLS LAST, a.id DESC
                LIMIT 200
                """,
                (license_plate,),
            )
            rows = cur.fetchall()
    return _ok({"visits": _visits_rows_to_payload(rows)})

# ----------------------------------------------------------------------------
# Cars on premises (raw JSON expected by frontend)
# ----------------------------------------------------------------------------

@app.route("/api/admin/cars-on-premises", methods=["GET"])

def cars_on_premises():
    try:
        require_auth_role()
    except Exception:
        pass
    # Minimal placeholder; can be enriched later
    return jsonify({"cars_on_premises": []})

# ----------------------------------------------------------------------------
# Route aliases without the '/api' prefix (frontend may call absolute URLs)
# ----------------------------------------------------------------------------

# Board
@app.route("/admin/appointments/board", methods=["GET"])  # alias
def get_board_alias():
    return get_board()

# Dashboard stats
@app.route("/admin/dashboard/stats", methods=["GET"])  # alias
def admin_dashboard_stats_alias():
    return admin_dashboard_stats()

# Cars on premises
@app.route("/admin/cars-on-premises", methods=["GET"])  # alias
def cars_on_premises_alias():
    return cars_on_premises()

# Appointments list/create
@app.route("/admin/appointments", methods=["GET"])  # alias
def list_appointments_alias():
    return get_admin_appointments()

@app.route("/admin/appointments", methods=["POST"])  # alias
def create_appointment_alias():
    return create_appointment()

# Appointment drawer GET/PATCH
@app.route("/appointments/<appt_id>", methods=["GET"])  # alias
def get_appointment_alias(appt_id: str):
    return get_appointment(appt_id)

@app.route("/appointments/<appt_id>", methods=["PATCH"])  # alias
def patch_appointment_alias(appt_id: str):
    return patch_appointment(appt_id)

# Delete appointment
@app.route("/admin/appointments/<appt_id>", methods=["DELETE"])  # alias
def delete_appointment_alias(appt_id: str):
    return delete_appointment(appt_id)

# Move appointment
@app.route("/admin/appointments/<appt_id>/move", methods=["PATCH"])  # alias
def move_appt_alias(appt_id: str):
    return move_card(appt_id)

# Customer history
@app.route("/customers/<cust_id>/history", methods=["GET"])  # alias
def customer_history_alias(cust_id: str):
    return get_customer_history(cust_id)

# Admin customers (aliases without /api)
@app.route("/admin/customers/search", methods=["GET"])  # alias
def admin_search_customers_alias():
    return admin_search_customers()

@app.route("/admin/customers/<cust_id>/visits", methods=["GET"])  # alias
def admin_customer_visits_alias(cust_id: str):
    return admin_customer_visits(cust_id)

@app.route("/admin/vehicles/<license_plate>/visits", methods=["GET"])  # alias
def admin_vehicle_visits_alias(license_plate: str):
    return admin_vehicle_visits(license_plate)

# Today endpoint used by some widgets
@app.route("/api/admin/appointments/today", methods=["GET"]) 
def today_appointments():
    maybe_auth()
    conn = db_conn()
    with conn:
        with conn.cursor() as cur:
            start, end = shop_day_window(None)
            cur.execute(
                """
                SELECT a.id::text, a.status::text, a.start_ts, a.end_ts,
                       c.name AS customer_name,
                       v.make, v.model, v.year, v.license_plate AS vin
                FROM appointments a
                LEFT JOIN customers c ON c.id = a.customer_id
                LEFT JOIN vehicles v ON v.id = a.vehicle_id
                WHERE a.start_ts >= %s AND a.start_ts < %s
                ORDER BY a.start_ts ASC NULLS LAST
                LIMIT 200
                """,
                (start, end),
            )
            rows = cur.fetchall()
    return jsonify({"appointments": rows})

# Alias without /api
@app.route("/admin/appointments/today", methods=["GET"]) 
def today_appointments_alias():
    return today_appointments()

# Quick action aliases
@app.route("/appointments/<appt_id>/start", methods=["POST"])  # alias
def start_job_alias(appt_id: str):
    return start_job(appt_id)

@app.route("/appointments/<appt_id>/ready", methods=["POST"])  # alias
def ready_job_alias(appt_id: str):
    return ready_job(appt_id)

@app.route("/appointments/<appt_id>/complete", methods=["POST"])  # alias
def complete_job_alias(appt_id: str):
    return complete_job(appt_id)

# ----------------------------------------------------------------------------
# Presence endpoints: check-in / check-out
# ----------------------------------------------------------------------------

@app.route("/api/appointments/<appt_id>/check-in", methods=["POST"]) 
def check_in(appt_id: str):
    # Allow dev bypass; otherwise require Advisor
    user = maybe_auth()
    if not user:
        user = require_auth_role("Advisor")
    body = request.get_json(silent=True) or {}
    at = body.get("at")
    try:
        at_dt = datetime.fromisoformat(at.replace("Z", "+00:00")) if at else utcnow()
    except Exception:
        at_dt = utcnow()

    conn = db_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id::text, check_in_at FROM appointments WHERE id = %s FOR UPDATE", (appt_id,))
            row = cur.fetchone()
            if not row:
                raise NotFound("Appointment not found")
            before = {"check_in_at": row.get("check_in_at").isoformat() if row.get("check_in_at") else None}
            cur.execute("UPDATE appointments SET check_in_at = %s WHERE id = %s", (at_dt, appt_id))
            audit(conn, user.get("sub", "system"), "APPT_CHECK_IN", "appointment", appt_id, before, {"check_in_at": at_dt.isoformat()})
    return _ok({"id": appt_id, "check_in_at": at_dt.isoformat()})

@app.route("/api/appointments/<appt_id>/check-out", methods=["POST"]) 
def check_out(appt_id: str):
    user = maybe_auth()
    if not user:
        user = require_auth_role("Advisor")
    body = request.get_json(silent=True) or {}
    at = body.get("at")
    try:
        at_dt = datetime.fromisoformat(at.replace("Z", "+00:00")) if at else utcnow()
    except Exception:
        at_dt = utcnow()

    conn = db_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id::text, check_out_at FROM appointments WHERE id = %s FOR UPDATE", (appt_id,))
            row = cur.fetchone()
            if not row:
                raise NotFound("Appointment not found")
            before = {"check_out_at": row.get("check_out_at").isoformat() if row.get("check_out_at") else None}
            cur.execute("UPDATE appointments SET check_out_at = %s WHERE id = %s", (at_dt, appt_id))
            audit(conn, user.get("sub", "system"), "APPT_CHECK_OUT", "appointment", appt_id, before, {"check_out_at": at_dt.isoformat()})
    return _ok({"id": appt_id, "check_out_at": at_dt.isoformat()})

# Aliases without /api
@app.route("/appointments/<appt_id>/check-in", methods=["POST"]) 
def check_in_alias(appt_id: str):
    return check_in(appt_id)

@app.route("/appointments/<appt_id>/check-out", methods=["POST"]) 
def check_out_alias(appt_id: str):
    return check_out(appt_id)

# ----------------------------------------------------------------------------
# Entrypoint
# ----------------------------------------------------------------------------
if __name__ == "__main__":
    # Configure host/port via env, default to 0.0.0.0:3001 for container and local use
    host = os.getenv("HOST", "0.0.0.0")
    try:
        port = int(os.getenv("PORT", "3001"))
    except ValueError:
        port = 3001
    debug = os.getenv("FLASK_DEBUG", "0") in ("1", "true", "True")

    log.info(
        "Starting API server",
        extra={
            "host": host,
            "port": port,
            "db_host": os.getenv("POSTGRES_HOST") or (urlparse(os.getenv("DATABASE_URL", "")).hostname if os.getenv("DATABASE_URL") else "db"),
        },
    )
    # Ensure the app listens externally so Docker/host can reach it
    app.run(host=host, port=port, threaded=True, use_reloader=False, debug=debug)
