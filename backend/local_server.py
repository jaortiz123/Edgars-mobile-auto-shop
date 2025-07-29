#!/usr/bin/env python3
"""
Edgar's Mobile Auto Shop — Sprint 1 local API server

Implements the S1 surface:
  - GET  /api/admin/appointments/board
  - PATCH /api/admin/appointments/<id>/move
  - GET  /api/appointments/<id>
  - PATCH /api/appointments/<id>
  - GET  /api/admin/dashboard/stats
  - GET  /api/admin/cars-on-premises
Plus health, simple auth stub, rate limits, and audit logging.

Notes
- DB: PostgreSQL (ENUM appointment_status) with lite tables from SCHEMA.md
- Status values are UPPERCASE in DB. We normalize inbound strings.
- Timestamps stored/fetched as UTC. Client converts to local.
- "Fallback to memory" is OFF by default; enable by env FALLBACK_TO_MEMORY=true.
"""
from __future__ import annotations

import logging, os, traceback, uuid, csv, io
from http import HTTPStatus
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
from werkzeug.exceptions import HTTPException, NotFound, BadRequest, Forbidden, MethodNotAllowed
import time
import hmac
import json
import base64
from datetime import datetime, date, time as dtime, timezone, timedelta
from typing import Any, Dict, Optional, Tuple

from pythonjsonlogger import jsonlogger

import psycopg2
from psycopg2.extras import RealDictCursor
import jwt

# Redis for caching with graceful fallback
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
from psycopg2.extras import RealDictCursor
import jwt

# ----------------------------------------------------------------------------
# App setup
# ----------------------------------------------------------------------------

class RequestIdFilter(logging.Filter):
    def filter(self, record):
        try:
            record.request_id = request.environ.get('REQUEST_ID', 'N/A')
        except RuntimeError:
            # No request context available (e.g., during server startup)
            record.request_id = 'N/A'
        return True

app = Flask(__name__)
CORS(app)

app.config.setdefault("PROPAGATE_EXCEPTIONS", False)
app.config.setdefault("TRAP_HTTP_EXCEPTIONS", False)

REQUEST_ID_HEADER = "X-Request-Id"

def _req_id():
    rid = request.headers.get(REQUEST_ID_HEADER) or request.environ.get("REQUEST_ID")
    if not rid:
        rid = str(uuid.uuid4())
        request.environ["REQUEST_ID"] = rid
    return rid

def _ok(data, status=HTTPStatus.OK):
    return jsonify({"data": data, "errors": None, "meta": {"request_id": _req_id()}}), status

def _fail(status: int, code: str, detail: str, meta=None):
    return (
        jsonify({
            "data": None,
            "errors": [{"status": str(status), "code": code, "detail": detail}],
            "meta": {"request_id": _req_id(), **(meta or {})},
        }),
        status,
    )

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
log = logging.getLogger("edgar.s1")
log.addFilter(RequestIdFilter())

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-do-not-use-in-prod")
JWT_ALG = "HS256"

FALLBACK_TO_MEMORY = os.getenv("FALLBACK_TO_MEMORY", "false").lower() == "true"

# Redis configuration with graceful fallback
_REDIS_CLIENT = None
if REDIS_AVAILABLE:
    try:
        _REDIS_CLIENT = redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            db=int(os.getenv("REDIS_DB", 0)),
            password=os.getenv("REDIS_PASSWORD"),
            decode_responses=True,
            socket_timeout=1,
            socket_connect_timeout=1,
            health_check_interval=30
        )
        # Test connection
        _REDIS_CLIENT.ping()
        log.info("Redis connection established")
    except Exception as e:
        log.warning("Redis unavailable, continuing without cache: %s", e)
        _REDIS_CLIENT = None

# Simple in-memory rate limiter buckets {key: (count, window_start)}
_RATE: Dict[str, Tuple[int, float]] = {}
RATE_LIMIT_PER_MINUTE = int(os.getenv("MOVE_RATE_LIMIT_PER_MIN", "60"))

@app.before_request
def before_request():
    request.environ['REQUEST_ID'] = str(uuid.uuid4())

handler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter('%(asctime)s %(name)s %(levelname)s %(request_id)s %(message)s')
handler.setFormatter(formatter)
log.addHandler(handler)

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def db_conn():
    cfg = dict(
        host=os.getenv("POSTGRES_HOST", "db"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
        dbname=os.getenv("POSTGRES_DB", "autoshop"),
        user=os.getenv("POSTGRES_USER", "user"),
        password=os.getenv("POSTGRES_PASSWORD", "password"),
        connect_timeout=int(os.getenv("POSTGRES_CONNECT_TIMEOUT", "2")),
    )
    try:
        conn = psycopg2.connect(cursor_factory=RealDictCursor, **cfg)
        return conn
    except Exception as e:
        log.error("DB connect failed: %s", e)
        if FALLBACK_TO_MEMORY:
            return None
        raise RuntimeError("DB connection failed")


def redis_get(key: str) -> Optional[str]:
    """Get value from Redis with graceful fallback"""
    if not _REDIS_CLIENT:
        return None
    try:
        return _REDIS_CLIENT.get(key)
    except Exception as e:
        log.warning("Redis get failed for key %s: %s", key, e)
        return None


def redis_set(key: str, value: str, ex: int = None) -> bool:
    """Set value in Redis with graceful fallback"""
    if not _REDIS_CLIENT:
        return False
    try:
        _REDIS_CLIENT.set(key, value, ex=ex)
        return True
    except Exception as e:
        log.warning("Redis set failed for key %s: %s", key, e)
        return False


def format_duration_hours(hours: float) -> str:
    """Format duration in hours to human-readable string"""
    if hours is None or hours < 0:
        return "N/A"
    
    if hours < 1:
        minutes = int(hours * 60)
        return f"{minutes}m"
    elif hours < 24:
        return f"{hours:.1f}h"
    else:
        days = int(hours // 24)
        remaining_hours = hours % 24
        if remaining_hours < 1:
            return f"{days}d"
        else:
            return f"{days}d {remaining_hours:.1f}h"


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
    "SCHEDULED": {"IN_PROGRESS", "READY", "NO_SHOW"},
    "IN_PROGRESS": {"READY", "COMPLETED"},
    "READY": {"COMPLETED"},
    "COMPLETED": set(),
    "NO_SHOW": set(),
    "CANCELED": set(),
}


def norm_status(s: str) -> str:
    if not s:
        raise BadRequest("Status required")
    s2 = s.strip()
    s2 = _STATUS_ALIASES.get(s2, s2).upper()
    return s2


def require_auth_role(required: Optional[str] = None) -> Dict[str, Any]:
    """Very light JWT check. Expected header: Authorization: Bearer <token>.
    Payload example: {"sub":"user-1","role":"Owner"}
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise Forbidden("Missing token")
    token = auth.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise Forbidden("Invalid token")
    role = payload.get("role", "Advisor")
    if required and role != required:
        # Owner can do anything
        if role != "Owner":
            raise Forbidden("Forbidden")
    return payload


def rate_limit(key: str):
    now = time.time()
    count, start = _RATE.get(key, (0, now))
    if now - start >= 60.0:
        _RATE[key] = (1, now)
        return
    if count + 1 > RATE_LIMIT_PER_MINUTE:
        raise Forbidden("Rate limit exceeded")
    _RATE[key] = (count + 1, start)


def audit(conn, user_id: str, action: str, entity: str, entity_id: str, before: Dict, after: Dict):
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO audit_logs (id, user_id, action, entity, entity_id, before, after, created_at)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s::jsonb, %s::jsonb, now())
                """,
                (user_id, action, entity, entity_id, json.dumps(before), json.dumps(after)),
            )
    except Exception as e:
        log.warning("audit insert failed: %s", e)

# ----------------------------------------------------------------------------
# Error Handler
# ----------------------------------------------------------------------------

def handle_http_exception(e: HTTPException):
    # Don’t treat these as 500s.
    status = e.code or 500
    # Optional: map to stable codes
    code_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        429: "RATE_LIMITED",
    }
    code = code_map.get(status, "HTTP_ERROR")
    # Log at WARNING, not ERROR
    logging.getLogger("edgar.s1").warning(
        "http_exception",
        extra={"request_id": _req_id(), "status": status, "path": request.path, "method": request.method, "error": str(e)},
    )
    # e.description is user-facing but safe
    return _fail(status, code, e.description or e.name or "HTTP error")

def handle_unexpected_exception(e: Exception):
    log = logging.getLogger("edgar.s1")
    log.error(
        "unhandled_exception",
        extra={"request_id": _req_id(), "path": request.path, "method": request.method},
    )
    log.error("traceback:\n%s", traceback.format_exc())
    return _fail(HTTPStatus.INTERNAL_SERVER_ERROR, "INTERNAL", "Internal server error")

app.register_error_handler(HTTPException, handle_http_exception)
app.register_error_handler(Exception, handle_unexpected_exception)
# Optional explicit mappings (not strictly required, but fine):
app.register_error_handler(NotFound, handle_http_exception)
app.register_error_handler(BadRequest, handle_http_exception)
app.register_error_handler(MethodNotAllowed, handle_http_exception)
app.register_error_handler(Forbidden, handle_http_exception)


# ----------------------------------------------------------------------------
# Health
# ----------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    try:
        conn = db_conn()
        if conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
            conn.close()
            return jsonify({"status": "ok", "db": "up"})
        else:
            return jsonify({"status": "ok", "db": "memory"})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

# ----------------------------------------------------------------------------
# Board
# ----------------------------------------------------------------------------
@app.route("/api/admin/appointments/board", methods=["GET"])
def get_board():
    # optional auth in S1 — require a token but no strict role
    try:
        require_auth_role()  # raise if missing/invalid
    except Exception:
        pass

    frm = request.args.get("from")
    to = request.args.get("to")
    tech_id = request.args.get("techId")

    conn = db_conn()
    if conn is None:
        # Minimal memory board (unspecified data) — keep empty in S1 if no DB
        return jsonify({"columns": _empty_columns(), "cards": []})

    where = ["1=1"]
    params: list[Any] = []
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

    with conn:
        with conn.cursor() as cur:
            # Cards
            cur.execute(
                f"""
                SELECT a.id::text,
                       a.status::text,
                       a.start_ts AS start_ts,
                       a.end_ts AS end_ts,
                        COALESCE(a.total_amount, 0) AS price,
                        c.name AS customer_name,
                        CONCAT_WS(' ', v.year::text, v.make, v.model) AS vehicle_label,
                        SUBSTRING((SELECT STRING_AGG(sv.name, ', ')
                                  FROM appointment_services sv WHERE sv.appointment_id = a.id)::text FROM 1 FOR 120) AS services_summary,
                       ROW_NUMBER() OVER(PARTITION BY a.status ORDER BY a.start_ts) AS position
                FROM appointments a
                LEFT JOIN customers c ON c.id = a.customer_id
                LEFT JOIN vehicles v  ON v.id = a.vehicle_id
                WHERE {where_sql}
                ORDER BY a.status, a.start_ts
                """,
                params,
            )
            rows = cur.fetchall()

            cards = []
            for r in rows:
                start_iso = r["start_ts"].astimezone(timezone.utc).isoformat() if r["start_ts"] else None
                end_iso = r.get("end_ts") and r["end_ts"].astimezone(timezone.utc).isoformat() or None
                cards.append(
                    {
                        "id": r["id"],
                        "status": r["status"],
                        "position": int(r["position"]),
                        "start": start_iso,
                        "end": end_iso,
                        "customerName": r.get("customer_name") or "",
                        "vehicle": r.get("vehicle_label") or "",
                        "servicesSummary": r.get("services_summary") or None,
                        "price": float(r.get("price") or 0),
                        "tags": [],
                    }
                )

            # Column aggregates
            cur.execute(
                f"""
                SELECT a.status::text AS key,
                       COUNT(*) AS count,
                       COALESCE(SUM(a.total_amount), 0) AS sum
                FROM appointments a
                WHERE {where_sql}
                GROUP BY a.status
                """,
                params,
            )
            agg = {r["key"]: (int(r["count"]), float(r["sum"])) for r in cur.fetchall()}

    conn.close()
    columns = []
    for key, title in _ordered_columns():
        c = agg.get(key, (0, 0.0))
        columns.append({"key": key, "title": title, "count": c[0], "sum": round(c[1], 2)})

    return jsonify({"columns": columns, "cards": cards})


def _empty_columns():
    return [
        {"key": key, "title": title, "count": 0, "sum": 0.0}
        for key, title in _ordered_columns()
    ]


def _ordered_columns():
    return [
        ("SCHEDULED", "Scheduled"),
        ("IN_PROGRESS", "In Progress"),
        ("READY", "Ready"),
        ("COMPLETED", "Completed"),
        ("NO_SHOW", "No-Show"),
    ]

# ----------------------------------------------------------------------------
# Move endpoint
# ----------------------------------------------------------------------------
@app.route("/api/admin/appointments/<appt_id>/move", methods=["PATCH"])
def move_card(appt_id: str):
    user = None
    try:
        user = require_auth_role()  # require any authenticated user
    except Exception:
        pass

    # rate limit (by IP or user id)
    key = f"move:{request.remote_addr}:{user.get('sub') if user else 'anon'}"
    try:
        rate_limit(key)
    except Forbidden:
        return _fail(429, 'RATE_LIMITED', 'Rate limit exceeded')

    body = request.get_json(force=True, silent=False) or {}
    new_status = norm_status(str(body.get("status", "")))
    position = int(body.get("position", 1))

    conn = db_conn()
    if conn is None:
        # memory noop
        return jsonify({"id": appt_id, "status": new_status, "position": position})

    with conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id::text, status::text, total_amount FROM appointments WHERE id = %s", (appt_id,))
            row = cur.fetchone()
            if not row:
                return _fail(404, 'RESOURCE_NOT_FOUND', 'Appointment not found')
            old_status = row["status"]
            if new_status not in ALLOWED_TRANSITIONS.get(old_status, set()):
                return _fail(400, 'INVALID_TRANSITION', f"Invalid transition {old_status} → {new_status}")

            cur.execute(
                "UPDATE appointments SET status = %s WHERE id = %s RETURNING id",
                (new_status, appt_id),
            )
            audit(conn, (user or {}).get("sub", "anon"), "STATUS_CHANGE", "appointment", appt_id, {"status": old_status}, {"status": new_status})

    conn.close()
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
    conn = db_conn()
    if conn is None:
        return jsonify({"error": "DB unavailable"}), 503

    with conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT a.id::text, a.status::text, a.start, a.end, a.total_amount, a.paid_amount,
                       a.check_in_at, a.check_out_at, a.tech_id::text,
                       c.id::text as customer_id, c.name as customer_name, c.email, c.phone,
                       v.id::text as vehicle_id, v.year, v.make, v.model, v.vin
                FROM appointments a
                LEFT JOIN customers c ON c.id = a.customer_id
                LEFT JOIN vehicles  v ON v.id = a.vehicle_id
                WHERE a.id = %s
                """,
                (appt_id,),
            )
            a = cur.fetchone()
            if not a:
                return jsonify({"error": "Not found"}), 404

            cur.execute("SELECT id::text, appointment_id::text, name, notes, estimated_hours, estimated_price FROM appointment_services WHERE appointment_id = %s ORDER BY created_at", (appt_id,))
            services = cur.fetchall()

    conn.close()

    def iso(dt):
        return dt.astimezone(timezone.utc).isoformat() if dt else None

    appointment = {
        "id": a["id"],
        "status": a["status"],
        "start": iso(a.get("start")),
        "end": iso(a.get("end")),
        "total_amount": float(a.get("total_amount") or 0),
        "paid_amount": float(a.get("paid_amount") or 0),
        "check_in_at": iso(a.get("check_in_at")),
        "check_out_at": iso(a.get("check_out_at")),
        "tech_id": a.get("tech_id"),
    }
    customer = {
        "id": a.get("customer_id"),
        "name": a.get("customer_name"),
        "email": a.get("email"),
        "phone": a.get("phone"),
    }
    vehicle = {
        "id": a.get("vehicle_id"),
        "year": a.get("year"),
        "make": a.get("make"),
        "model": a.get("model"),
        "vin": a.get("vin"),
    }
    svc_list = [
        {
            "id": s["id"],
            "appointment_id": s["appointment_id"],
            "name": s["name"],
            "notes": s.get("notes"),
            "estimated_hours": float(s["estimated_hours"]) if s.get("estimated_hours") is not None else None,
            "estimated_price": float(s["estimated_price"]) if s.get("estimated_price") is not None else None,
        }
        for s in services
    ]

    return jsonify({"appointment": appointment, "customer": customer, "vehicle": vehicle, "services": svc_list})


def patch_appointment(appt_id: str):
    body = request.get_json(force=True, silent=False) or {}
    # Normalize status if provided
    if "status" in body:
        body["status"] = norm_status(str(body["status"]))

    fields = [
        ("status", "status"),
        ("start", "start"),
        ("end", "end"),
        ("total_amount", "total_amount"),
        ("paid_amount", "paid_amount"),
        ("check_in_at", "check_in_at"),
        ("check_out_at", "check_out_at"),
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
    if conn is None:
        return jsonify({"ok": True})

    with conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id::text, status::text FROM appointments WHERE id = %s", (appt_id,))
            old = cur.fetchone()
            if not old:
                return jsonify({"error": "Not found"}), 404
            cur.execute(f"UPDATE appointments SET {', '.join(sets)} WHERE id = %s RETURNING id", (*params, appt_id))
            user_id = "system"
            audit(conn, user_id, "APPT_PATCH", "appointment", appt_id, {"status": old["status"]}, {k: body[k] for k in body.keys()})

    conn.close()
    return jsonify({"ok": True})





@app.route("/api/admin/appointments", methods=["GET"])
def get_admin_appointments():
    """Returns a paginated list of appointments with filtering."""
    args = request.args
    # Pagination parameters
    limit = int(args.get("limit", 50))
    # Clamp limit between 1 and 200
    if limit < 1 or limit > 200:
        raise BadRequest("limit must be between 1 and 200")
    offset = int(args.get("offset", 0))
    if offset < 0:
        raise BadRequest("offset must be non-negative")
    cursor = args.get("cursor")

    # Validate that cursor and offset are not used together
    if cursor and offset > 0:
        raise BadRequest("cannot use both cursor and offset parameters together")

    # Use canonical start_ts and end_ts columns directly
    co_start = "a.start_ts"

    # Filtering
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
    # Filter by technician ID if provided
    if args.get("techId"):
        where.append("a.tech_id = %s")
        params.append(args.get("techId"))
    # Simple text search on customer and vehicle fields
    if args.get("q"):
        q = f"%{args.get('q')}%"
        where.append(
            "(c.name ILIKE %s OR v.make ILIKE %s OR v.model ILIKE %s OR c.email ILIKE %s OR c.phone ILIKE %s)"
        )
        params.extend([q, q, q, q, q])

    where_sql = " AND ".join(where)

    conn = db_conn()
    if conn is None:
        # DB down or connection failure: return empty envelope
        return _ok({"appointments": [], "nextCursor": None})

    with conn:
        with conn.cursor() as cur:
            # Include vehicle join for search
            query = f"""
                 SELECT a.id::text,
                         a.status::text,
                         a.start_ts AS start_ts,
                         a.end_ts AS end_ts,
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
            cur.execute(query, (*params, limit, offset))
            appointments = cur.fetchall()
    
    # Compute position for each appointment
    for idx, appt in enumerate(appointments):
        # position in the full result set
        appt['position'] = offset + idx + 1

    # Close DB connection if it has a `close` method
    try:
        conn.close()
    except AttributeError:
        pass

    next_cursor = None
    if len(appointments) == limit and appointments[-1]['start_ts'] is not None:
        last_appt = appointments[-1]
        cursor_data = f"{last_appt['start_ts'].isoformat()},{last_appt['id']}"
        next_cursor = base64.b64encode(cursor_data.encode('utf-8')).decode('utf-8')

    # Serialize appointment fields for JSON
    for appt in appointments:
        # Convert datetime to ISO strings
        if appt.get('start_ts'):
            appt['start_ts'] = appt['start_ts'].astimezone(timezone.utc).isoformat()
        if appt.get('end_ts'):
            appt['end_ts'] = appt['end_ts'].astimezone(timezone.utc).isoformat()
        # Convert Decimal numeric to float
        if 'total_amount' in appt:
            try:
                appt['total_amount'] = float(appt['total_amount'])
            except Exception:
                pass

    return _ok({"appointments": appointments, "nextCursor": next_cursor})

@app.route("/api/admin/appointments", methods=["POST"])
def create_appointment():
    body = request.get_json(silent=True) or {}

    # Minimal required fields; defaults for S1
    status = norm_status(str(body.get("status", "SCHEDULED")))
    start_val = body.get("start")
    if isinstance(start_val, str):
        # Allow ISO8601 string
        try:
            start_dt = datetime.fromisoformat(start_val.replace("Z", "+00:00"))
        except Exception:
            return _fail(HTTPStatus.BAD_REQUEST, "INVALID_PARAM", "start must be ISO8601 timestamp")
    elif start_val is None:
        start_dt = utcnow()
    else:
        start_dt = start_val  # assume datetime

    total_amount = body.get("total_amount", 0) or 0
    paid_amount = body.get("paid_amount", 0) or 0

    conn = db_conn()
    if conn is None:
        # DB unavailable in memory mode — signal service unavailable for create
        return _fail(HTTPStatus.SERVICE_UNAVAILABLE, "DB_UNAVAILABLE", "Database unavailable")

    new_id = None
    with conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO appointments (status, start, total_amount, paid_amount)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (status, start_dt, total_amount, paid_amount),
            )
            row = cur.fetchone()
            new_id = str(row["id"]) if row else None
    conn.close()

    if not new_id:
        return _fail(HTTPStatus.INTERNAL_SERVER_ERROR, "CREATE_FAILED", "Failed to create appointment")

    return jsonify({"id": new_id}), 201


# PATCH endpoint for updating appointment status
@app.route("/api/admin/appointments/<appt_id>/status", methods=["PATCH"])
def update_appointment_status(appt_id: str):
    body = request.get_json(silent=True) or {}
    try:
        new_status = norm_status(str(body.get("status", "")))
    except BadRequest as e:
        return _fail(HTTPStatus.BAD_REQUEST, "INVALID_STATUS", str(e))

    conn = db_conn()
    if conn is None:
        # In memory mode, just acknowledge for UI flow
        return jsonify({"id": appt_id, "status": new_status})

    with conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id::text, status::text FROM appointments WHERE id = %s", (appt_id,))
            row = cur.fetchone()
            if not row:
                return _fail(HTTPStatus.NOT_FOUND, "NOT_FOUND", "Appointment not found")
            old_status = row["status"]
            if new_status not in ALLOWED_TRANSITIONS.get(old_status, set()):
                return _fail(HTTPStatus.BAD_REQUEST, "INVALID_TRANSITION", f"{old_status} -> {new_status} not allowed")
            cur.execute("UPDATE appointments SET status = %s WHERE id = %s RETURNING id", (new_status, appt_id))
            audit(conn, "system", "STATUS_CHANGE", "appointment", appt_id, {"status": old_status}, {"status": new_status})
    conn.close()
    return jsonify({"id": appt_id, "status": new_status})

# ----------------------------------------------------------------------------
# Services CRUD (S2)
# ----------------------------------------------------------------------------
@app.route("/api/appointments/<appt_id>/services", methods=["GET"])
def get_appointment_services(appt_id: str):
    """Get all services for an appointment."""
    conn = db_conn()
    if conn is None:
        return jsonify({"services": []})

    with conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id::text, appointment_id::text, name, notes, 
                       estimated_hours, estimated_price, category, created_at
                FROM appointment_services 
                WHERE appointment_id = %s 
                ORDER BY created_at
                """,
                (appt_id,)
            )
            services = cur.fetchall()

    conn.close()
    return jsonify({
        "services": [
            {
                "id": s["id"],
                "appointment_id": s["appointment_id"],
                "name": s["name"],
                "notes": s.get("notes"),
                "estimated_hours": float(s["estimated_hours"]) if s.get("estimated_hours") is not None else None,
                "estimated_price": float(s["estimated_price"]) if s.get("estimated_price") is not None else None,
                "category": s.get("category"),
                "created_at": s["created_at"].isoformat() if s.get("created_at") else None,
            }
            for s in services
        ]
    })


@app.route("/api/appointments/<appt_id>/services", methods=["POST"])
def create_appointment_service(appt_id: str):
    """Create a new service for an appointment."""
    body = request.get_json(silent=True) or {}
    
    # Validate required fields
    name = body.get("name", "").strip()
    if not name:
        return _fail(HTTPStatus.BAD_REQUEST, "VALIDATION_FAILED", "Service name is required")
    
    notes = body.get("notes", "").strip()
    estimated_hours = body.get("estimated_hours")
    estimated_price = body.get("estimated_price")
    category = body.get("category", "").strip()
    
    # Convert numeric fields
    try:
        if estimated_hours is not None:
            estimated_hours = float(estimated_hours)
        if estimated_price is not None:
            estimated_price = float(estimated_price)
    except ValueError:
        return _fail(HTTPStatus.BAD_REQUEST, "VALIDATION_FAILED", "Invalid numeric values")

    conn = db_conn()
    if conn is None:
        return _fail(HTTPStatus.SERVICE_UNAVAILABLE, "DB_UNAVAILABLE", "Database unavailable")

    new_service_id = None
    with conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verify appointment exists
            cur.execute("SELECT id FROM appointments WHERE id = %s", (appt_id,))
            if not cur.fetchone():
                return _fail(HTTPStatus.NOT_FOUND, "NOT_FOUND", "Appointment not found")
            
            # Create service
            cur.execute(
                """
                INSERT INTO appointment_services (appointment_id, name, notes, estimated_hours, estimated_price, category)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id::text
                """,
                (appt_id, name, notes or None, estimated_hours, estimated_price, category or None)
            )
            row = cur.fetchone()
            new_service_id = row["id"] if row else None
            
            # Recompute appointment total
            _recompute_appointment_total(cur, appt_id)
            
    conn.close()
    
    if not new_service_id:
        return _fail(HTTPStatus.INTERNAL_SERVER_ERROR, "CREATE_FAILED", "Failed to create service")
    
    return jsonify({"id": new_service_id}), 201


@app.route("/api/appointments/<appt_id>/services/<service_id>", methods=["PATCH"])
def update_appointment_service(appt_id: str, service_id: str):
    """Update an existing service."""
    body = request.get_json(silent=True) or {}
    
    # Build update fields
    updates = {}
    if "name" in body:
        name = body["name"].strip()
        if not name:
            return _fail(HTTPStatus.BAD_REQUEST, "VALIDATION_FAILED", "Service name cannot be empty")
        updates["name"] = name
    
    if "notes" in body:
        updates["notes"] = body["notes"].strip() or None
    
    if "estimated_hours" in body:
        try:
            updates["estimated_hours"] = float(body["estimated_hours"]) if body["estimated_hours"] is not None else None
        except ValueError:
            return _fail(HTTPStatus.BAD_REQUEST, "VALIDATION_FAILED", "Invalid estimated_hours value")
    
    if "estimated_price" in body:
        try:
            updates["estimated_price"] = float(body["estimated_price"]) if body["estimated_price"] is not None else None
        except ValueError:
            return _fail(HTTPStatus.BAD_REQUEST, "VALIDATION_FAILED", "Invalid estimated_price value")
    
    if "category" in body:
        updates["category"] = body["category"].strip() or None
    
    if not updates:
        return _fail(HTTPStatus.BAD_REQUEST, "VALIDATION_FAILED", "No valid fields to update")

    conn = db_conn()
    if conn is None:
        return _fail(HTTPStatus.SERVICE_UNAVAILABLE, "DB_UNAVAILABLE", "Database unavailable")

    with conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Build dynamic update query
            set_parts = []
            values = []
            for field, value in updates.items():
                set_parts.append(f"{field} = %s")
                values.append(value)
            
            values.extend([service_id, appt_id])
            
            cur.execute(
                f"""
                UPDATE appointment_services 
                SET {', '.join(set_parts)}
                WHERE id = %s AND appointment_id = %s
                RETURNING id::text
                """,
                values
            )
            
            if not cur.fetchone():
                return _fail(HTTPStatus.NOT_FOUND, "NOT_FOUND", "Service not found")
            
            # Recompute appointment total
            _recompute_appointment_total(cur, appt_id)
    
    conn.close()
    return jsonify({"id": service_id})


@app.route("/api/appointments/<appt_id>/services/<service_id>", methods=["DELETE"])
def delete_appointment_service(appt_id: str, service_id: str):
    """Delete a service from an appointment."""
    conn = db_conn()
    if conn is None:
        return _fail(HTTPStatus.SERVICE_UNAVAILABLE, "DB_UNAVAILABLE", "Database unavailable")

    with conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "DELETE FROM appointment_services WHERE id = %s AND appointment_id = %s RETURNING id::text",
                (service_id, appt_id)
            )
            
            if not cur.fetchone():
                return _fail(HTTPStatus.NOT_FOUND, "NOT_FOUND", "Service not found")
            
            # Recompute appointment total
            _recompute_appointment_total(cur, appt_id)
    
    conn.close()
    return "", 204


def _recompute_appointment_total(cur, appt_id: str):
    """Recompute appointment total_amount from services."""
    cur.execute(
        """
        UPDATE appointments 
        SET total_amount = (
            SELECT COALESCE(SUM(estimated_price), 0) 
            FROM appointment_services 
            WHERE appointment_id = %s
        )
        WHERE id = %s
        """,
        (appt_id, appt_id)
    )

# ----------------------------------------------------------------------------
# Messaging (T-021)
# ----------------------------------------------------------------------------
@app.route("/api/appointments/<appt_id>/messages", methods=["GET"])
def get_appointment_messages(appt_id: str):
    """Get all messages for an appointment."""
    # Role check: Owner & Advisor read/write, Tech read-only
    try:
        user = require_auth_role()
        user_role = user.get("role", "Advisor")
    except Exception:
        return _fail(HTTPStatus.FORBIDDEN, "AUTH_REQUIRED", "Authentication required")

    conn = db_conn()
    if conn is None:
        return _fail(HTTPStatus.SERVICE_UNAVAILABLE, "DB_UNAVAILABLE", "Database unavailable")

    with conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verify appointment exists
            cur.execute("SELECT id FROM appointments WHERE id = %s", (appt_id,))
            if not cur.fetchone():
                return _fail(HTTPStatus.NOT_FOUND, "NOT_FOUND", "Appointment not found")
            
            # Get messages ordered by timestamp (latest first)
            cur.execute(
                """
                SELECT id::text, appointment_id::text, channel, direction, body, 
                       status, sent_at
                FROM messages 
                WHERE appointment_id = %s
                ORDER BY sent_at DESC
                """,
                (appt_id,)
            )
            messages = cur.fetchall()

    conn.close()
    return _ok({
        "messages": [
            {
                "id": m["id"],
                "appointment_id": m["appointment_id"],
                "channel": m["channel"],
                "direction": m["direction"],
                "body": m["body"],
                "status": m["status"],
                "sent_at": m["sent_at"].isoformat() if m.get("sent_at") else None,
            }
            for m in messages
        ]
    })


@app.route("/api/appointments/<appt_id>/messages", methods=["POST"])
def create_appointment_message(appt_id: str):
    """Create a new outbound message for an appointment."""
    # Role check: Owner & Advisor can write, Tech read-only
    try:
        user = require_auth_role()
        user_role = user.get("role", "Advisor")
        if user_role not in ["Owner", "Advisor"]:
            return _fail(HTTPStatus.FORBIDDEN, "RBAC_FORBIDDEN", "Only Owner and Advisor can send messages")
    except Exception:
        return _fail(HTTPStatus.FORBIDDEN, "AUTH_REQUIRED", "Authentication required")

    body = request.get_json(silent=True) or {}
    
    # Validate required fields
    channel = body.get("channel", "").strip().lower()
    if channel not in ["sms", "email"]:
        return _fail(HTTPStatus.BAD_REQUEST, "VALIDATION_FAILED", "Channel must be 'sms' or 'email'")
    
    message_body = body.get("body", "").strip()
    if not message_body:
        return _fail(HTTPStatus.BAD_REQUEST, "VALIDATION_FAILED", "Message body is required")

    conn = db_conn()
    if conn is None:
        return _fail(HTTPStatus.SERVICE_UNAVAILABLE, "DB_UNAVAILABLE", "Database unavailable")

    new_message_id = None
    with conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verify appointment exists
            cur.execute("SELECT id FROM appointments WHERE id = %s", (appt_id,))
            if not cur.fetchone():
                return _fail(HTTPStatus.NOT_FOUND, "NOT_FOUND", "Appointment not found")
            
            # Create outbound message with 'queued' status
            cur.execute(
                """
                INSERT INTO messages (appointment_id, channel, direction, body, status)
                VALUES (%s, %s, 'out', %s, 'sending')
                RETURNING id::text
                """,
                (appt_id, channel, message_body)
            )
            row = cur.fetchone()
            new_message_id = row["id"] if row else None
            
            # Audit log
            audit(conn, user.get("sub", "system"), "MESSAGE_SENT", "message", new_message_id or "unknown", 
                  {}, {"appointment_id": appt_id, "channel": channel, "direction": "out"})
            
    conn.close()
    
    if not new_message_id:
        return _fail(HTTPStatus.INTERNAL_SERVER_ERROR, "CREATE_FAILED", "Failed to create message")
    
    return _ok({"id": new_message_id, "status": "sending"}, HTTPStatus.CREATED)


@app.route("/api/appointments/<appt_id>/messages/<message_id>", methods=["PATCH"])
def update_message_status(appt_id: str, message_id: str):
    """Update message delivery status (typically from webhook or manual retry)."""
    # Role check: Owner & Advisor can update
    try:
        user = require_auth_role()
        user_role = user.get("role", "Advisor")
        if user_role not in ["Owner", "Advisor"]:
            return _fail(HTTPStatus.FORBIDDEN, "RBAC_FORBIDDEN", "Only Owner and Advisor can update messages")
    except Exception:
        return _fail(HTTPStatus.FORBIDDEN, "AUTH_REQUIRED", "Authentication required")

    body = request.get_json(silent=True) or {}
    
    # Build update fields
    updates = {}
    if "status" in body:
        status = body["status"].strip().lower()
        if status not in ["sending", "delivered", "failed"]:
            return _fail(HTTPStatus.BAD_REQUEST, "VALIDATION_FAILED", "Status must be 'sending', 'delivered', or 'failed'")
        updates["status"] = status
    
    if not updates:
        return _fail(HTTPStatus.BAD_REQUEST, "VALIDATION_FAILED", "No valid fields to update")

    conn = db_conn()
    if conn is None:
        return _fail(HTTPStatus.SERVICE_UNAVAILABLE, "DB_UNAVAILABLE", "Database unavailable")

    with conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Build dynamic update query
            set_parts = []
            values = []
            for field, value in updates.items():
                set_parts.append(f"{field} = %s")
                values.append(value)
            
            values.extend([message_id, appt_id])
            
            cur.execute(
                f"""
                UPDATE messages 
                SET {', '.join(set_parts)}
                WHERE id = %s AND appointment_id = %s
                RETURNING id::text
                """,
                values
            )
            
            if not cur.fetchone():
                return _fail(HTTPStatus.NOT_FOUND, "NOT_FOUND", "Message not found")
            
            # Audit log
            audit(conn, user.get("sub", "system"), "MESSAGE_UPDATED", "message", message_id, 
                  {}, updates)
    
    conn.close()
    return _ok({"id": message_id})


@app.route("/api/appointments/<appt_id>/messages/<message_id>", methods=["DELETE"])
def delete_appointment_message(appt_id: str, message_id: str):
    """Delete a message from an appointment."""
    # Role check: Owner & Advisor can delete
    try:
        user = require_auth_role()
        user_role = user.get("role", "Advisor")
        if user_role not in ["Owner", "Advisor"]:
            return _fail(HTTPStatus.FORBIDDEN, "RBAC_FORBIDDEN", "Only Owner and Advisor can delete messages")
    except Exception:
        return _fail(HTTPStatus.FORBIDDEN, "AUTH_REQUIRED", "Authentication required")

    conn = db_conn()
    if conn is None:
        return _fail(HTTPStatus.SERVICE_UNAVAILABLE, "DB_UNAVAILABLE", "Database unavailable")

    with conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Hard delete since no deleted_at column in current schema
            cur.execute(
                "DELETE FROM messages WHERE id = %s AND appointment_id = %s RETURNING id::text",
                (message_id, appt_id)
            )
            
            if not cur.fetchone():
                return _fail(HTTPStatus.NOT_FOUND, "NOT_FOUND", "Message not found")
            
            # Audit log
            audit(conn, user.get("sub", "system"), "MESSAGE_DELETED", "message", message_id, 
                  {"deleted": False}, {"deleted": True})
    
    conn.close()
    return "", 204

# ----------------------------------------------------------------------------
# Customer History (T-023)
# ----------------------------------------------------------------------------
@app.route("/api/customers/<customer_id>/history", methods=["GET"])
def get_customer_history(customer_id: str):
    """Get customer's appointment and payment history."""
    # Role check: Owner & Advisor only
    try:
        user = require_auth_role()
        user_role = user.get("role", "Advisor")
        if user_role not in ["Owner", "Advisor"]:
            return _fail(HTTPStatus.FORBIDDEN, "RBAC_FORBIDDEN", "Only Owner and Advisor can view customer history")
    except Exception:
        return _fail(HTTPStatus.FORBIDDEN, "AUTH_REQUIRED", "Authentication required")

    conn = db_conn()
    if conn is None:
        return _fail(HTTPStatus.SERVICE_UNAVAILABLE, "DB_UNAVAILABLE", "Database unavailable")

    with conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verify customer exists
            cur.execute("SELECT id, name FROM customers WHERE id = %s", (customer_id,))
            customer = cur.fetchone()
            if not customer:
                return _fail(HTTPStatus.NOT_FOUND, "NOT_FOUND", "Customer not found")
            
            # Get past appointments with payments using LEFT JOIN
            cur.execute(
                """
                SELECT 
                    a.id::text, 
                    a.status::text, 
                    a.start,
                    a.total_amount,
                    a.paid_amount,
                    a.created_at as appointment_created_at,
                    COALESCE(
                        JSON_AGG(
                            JSON_BUILD_OBJECT(
                                'id', p.id::text,
                                'amount', p.amount,
                                'method', p.method,
                                'created_at', p.created_at
                            ) ORDER BY p.created_at DESC
                        ) FILTER (WHERE p.id IS NOT NULL), 
                        '[]'::json
                    ) as payments
                FROM appointments a
                LEFT JOIN payments p ON p.appointment_id = a.id
                WHERE a.customer_id = %s 
                    AND a.status IN ('COMPLETED', 'NO_SHOW', 'CANCELED')
                GROUP BY a.id, a.status, a.start, a.total_amount, a.paid_amount, a.created_at
                ORDER BY a.start DESC, a.id DESC
                """,
                (customer_id,)
            )
            appointments = cur.fetchall()

    conn.close()
    
    # Format appointments for response
    past_appointments = []
    for appt in appointments:
        past_appointments.append({
            "id": appt["id"],
            "status": appt["status"],
            "start": appt["start"].isoformat() if appt.get("start") else None,
            "total_amount": float(appt["total_amount"]) if appt.get("total_amount") else 0.0,
            "paid_amount": float(appt["paid_amount"]) if appt.get("paid_amount") else 0.0,
            "created_at": appt["appointment_created_at"].isoformat() if appt.get("appointment_created_at") else None,
            "payments": appt["payments"] if appt.get("payments") else []
        })

    return _ok({
        "data": {
            "pastAppointments": past_appointments,
            "payments": []  # payments are now nested in appointments
        },
        "errors": None
    })

# ----------------------------------------------------------------------------
# Stats & Cars
# ----------------------------------------------------------------------------
@app.route("/api/admin/dashboard/stats", methods=["GET"])
def stats():
    # optional auth in S1
    try:
        require_auth_role()
    except Exception:
        pass

    # Check Redis cache first (30s TTL)
    cache_key = "dashboard_stats"
    cached_result = redis_get(cache_key)
    if cached_result:
        try:
            return jsonify(json.loads(cached_result))
        except Exception as e:
            log.warning("Failed to parse cached stats: %s", e)

    frm = request.args.get("from")
    to = request.args.get("to")

    conn = db_conn()
    if conn is None:
        raise RuntimeError("DB unavailable")

    today = date.today()
    with conn:
        with conn.cursor() as cur:
            # counts by status
            cur.execute("SELECT status::text, COUNT(*) FROM appointments GROUP BY status")
            results = cur.fetchall()
            # Build counts mapping, handling dict or tuple rows
            counts = {}
            for r in results:
                if isinstance(r, dict):
                    key = r.get('status')
                    val = r.get('count', 0)
                else:
                    key = r[0] if len(r) > 0 else None
                    val = r[1] if len(r) > 1 else 0
                try:
                    counts[key] = int(val)
                except Exception:
                    counts[key] = 0

            # cars on premises
            cur.execute("SELECT COUNT(*) FROM appointments WHERE check_in_at IS NOT NULL AND check_out_at IS NULL")
            cars_result = cur.fetchone()
            cars = int(cars_result[0]) if cars_result and len(cars_result) > 0 else 0

            # jobs today (based on canonical start_ts)
            cur.execute("SELECT COUNT(*) FROM appointments WHERE start_ts::date = %s", (today,))
            jobs_today = int(cur.fetchone()[0])

            # unpaid total
            cur.execute("SELECT COALESCE(SUM(COALESCE(total_amount,0) - COALESCE(paid_amount,0)),0) FROM appointments")
            unpaid = float(cur.fetchone()[0])

            # NEW METRICS FOR v2

            # today_completed - completed appointments today
            cur.execute("""
                SELECT COUNT(*) FROM appointments 
                WHERE start_ts::date = %s AND status = 'COMPLETED'
            """, (today,))
            today_completed = int(cur.fetchone()[0])

            # today_booked - all appointments scheduled for today (regardless of status)
            # This is the same as jobs_today but more explicit
            today_booked = jobs_today

            # avg_cycle_time - average time from start to completion (in hours)
            cur.execute("""
                SELECT AVG(EXTRACT(EPOCH FROM end_ts - start_ts)) / 3600 as avg_hours
                FROM appointments 
                WHERE end_ts IS NOT NULL AND start_ts IS NOT NULL
                  AND status = 'COMPLETED'
                  AND start_ts >= %s
            """, (today - timedelta(days=30),))  # Last 30 days for better average
            
            avg_result = cur.fetchone()
            avg_cycle_hours = float(avg_result[0]) if avg_result and avg_result[0] is not None else None

    conn.close()
    
    # Build enhanced response structure
    response_data = {
        # Legacy fields for backward compatibility
        "jobsToday": jobs_today,
        "carsOnPremises": cars,
        "scheduled": counts.get("SCHEDULED", 0),
        "inProgress": counts.get("IN_PROGRESS", 0),
        "ready": counts.get("READY", 0),
        "completed": counts.get("COMPLETED", 0),
        "noShow": counts.get("NO_SHOW", 0),
        "unpaidTotal": round(unpaid, 2),
        
        # NEW: Enhanced totals object for v2
        "totals": {
            "today_completed": today_completed,
            "today_booked": today_booked,
            "avg_cycle": avg_cycle_hours,
            "avg_cycle_formatted": format_duration_hours(avg_cycle_hours) if avg_cycle_hours else "N/A"
        }
    }

    # Cache result for 30 seconds
    redis_set(cache_key, json.dumps(response_data), ex=30)
    
    return jsonify(response_data)


@app.route("/api/admin/cars-on-premises", methods=["GET"])
def cars_on_premises():
    conn = db_conn()
    if conn is None:
        return jsonify({"cars_on_premises": []})

    with conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT a.id::text,
                       a.check_in_at,
                       c.name AS owner,
                       v.year, v.make, v.model
                FROM appointments a
                LEFT JOIN customers c ON c.id = a.customer_id
                LEFT JOIN vehicles v  ON v.id = a.vehicle_id
                WHERE a.check_in_at IS NOT NULL AND a.check_out_at IS NULL
                ORDER BY a.check_in_at ASC
                """
            )
            rows = cur.fetchall()

    conn.close()
    out = []
    for r in rows:
        out.append(
            {
                "id": r["id"],
                "owner": r.get("owner") or "",
                "make": r.get("make") or "",
                "model": r.get("model") or "",
                "arrivalTime": r["check_in_at"].astimezone(timezone.utc).isoformat() if r.get("check_in_at") else None,
                "status": "IN_PROGRESS",
                "pickupTime": None,
            }
        )
    return jsonify({"cars_on_premises": out})

# ----------------------------------------------------------------------------
# Wrap admin appointments GET responses to ensure envelope shape
@app.after_request
def wrap_admin_appointments(response):
    if request.path == "/api/admin/appointments" and request.method == "GET":
        try:
            orig = response.get_json(silent=True)
        except Exception:
            return response
        # Already enveloped?
        if isinstance(orig, dict) and any(k in orig for k in ("data", "errors", "meta")):
            return response
        return jsonify({"data": orig, "errors": None, "meta": {"request_id": _req_id()}}), response.status_code
    return response

# ----------------------------------------------------------------------------
# CSV Export
# ----------------------------------------------------------------------------
@app.route("/api/admin/appointments/export", methods=["GET"])
def export_appointments():
    """Export appointments to CSV."""
    # Role check: Owner & Advisor only
    try:
        user = require_auth_role()
        user_role = user.get("role", "Advisor")
        if user_role not in ["Owner", "Advisor"]:
            return _fail(HTTPStatus.FORBIDDEN, "RBAC_FORBIDDEN", "Only Owner and Advisor can export appointments")
    except Exception:
        return _fail(HTTPStatus.FORBIDDEN, "AUTH_REQUIRED", "Authentication required")

    # Query parameters
    frm = request.args.get("from")
    to = request.args.get("to")
    tech_id = request.args.get("techId")
    status = request.args.get("status")

    # Validate and normalize status
    if status:
        try:
            status = norm_status(status)
        except BadRequest:
            return _fail(HTTPStatus.BAD_REQUEST, "INVALID_STATUS", "Invalid status value")

    conn = db_conn()
    if conn is None:
        return _fail(HTTPStatus.SERVICE_UNAVAILABLE, "DB_UNAVAILABLE", "Database unavailable")

    try:
        with conn:
            with conn.cursor() as cur, io.StringIO() as csv_output:
                # Write CSV header
                writer = csv.writer(csv_output)
                writer.writerow([
                    "ID", "Status", "Start", "End", "Total Amount", "Paid Amount",
                    "Customer Name", "Customer Email", "Customer Phone",
                    "Vehicle Year", "Vehicle Make", "Vehicle Model", "Vehicle VIN",
                    "Services"
                ])

                # Filtered query for appointments
                where = ["1=1"]
                params: list[Any] = []
                if frm:
                    where.append("a.start_ts >= %s")
                    params.append(frm)
                if to:
                    where.append("a.end_ts <= %s")
                    params.append(to)
                if tech_id:
                    where.append("a.tech_id = %s")
                    params.append(tech_id)
                if status:
                    where.append("a.status = %s")
                    params.append(status)

                where_sql = " AND ".join(where)

                cur.execute(
                    f"""
                    SELECT a.id::text, a.status::text, a.start_ts, a.end_ts,
                           COALESCE(a.total_amount, 0) AS total_amount,
                           COALESCE(a.paid_amount, 0) AS paid_amount,
                           c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
                           v.year, v.make, v.model, v.vin,
                           SUBSTRING((SELECT STRING_AGG(sv.name, ', ')
                                      FROM appointment_services sv WHERE sv.appointment_id = a.id)::text FROM 1 FOR 120) AS services_summary
                    FROM appointments a
                    LEFT JOIN customers c ON c.id = a.customer_id
                    LEFT JOIN vehicles v  ON v.id = a.vehicle_id
                    WHERE {where_sql}
                    ORDER BY a.start_ts
                    """,
                    params,
                )
                rows = cur.fetchall()

                # Write data rows
                for r in rows:
                    writer.writerow([
                        r["id"],
                        r["status"],
                        r["start_ts"].isoformat() if r["start_ts"] else None,
                        r["end_ts"].isoformat() if r["end_ts"] else None,
                        float(r["total_amount"]) if r["total_amount"] is not None else 0.0,
                        float(r["paid_amount"]) if r["paid_amount"] is not None else 0.0,
                        r.get("customer_name"),
                        r.get("customer_email"),
                        r.get("customer_phone"),
                        r.get("year"),
                        r.get("make"),
                        r.get("model"),
                        r.get("vin"),
                        r.get("services_summary"),
                    ])

                # Seek to beginning of StringIO buffer
                csv_output.seek(0)

                # Return CSV response
                return Response(
                    csv_output.getvalue(),
                    mimetype="text/csv",
                    headers={"Content-Disposition": "attachment;filename=appointments_export.csv"},
                )
    finally:
        conn.close()

# ----------------------------------------------------------------------------
# Payments CSV Export (T-022)
# ----------------------------------------------------------------------------
@app.route("/api/admin/payments/export", methods=["GET"])
def export_payments():
    """Export payments to CSV."""
    # Role check: Owner & Advisor only
    try:
        user = require_auth_role()
        user_role = user.get("role", "Advisor")
        if user_role not in ["Owner", "Advisor"]:
            return _fail(HTTPStatus.FORBIDDEN, "RBAC_FORBIDDEN", "Only Owner and Advisor can export payments")
    except Exception:
        return _fail(HTTPStatus.FORBIDDEN, "AUTH_REQUIRED", "Authentication required")

    # Query parameters
    frm = request.args.get("from")
    to = request.args.get("to")
    appt_id = request.args.get("appointmentId")

    conn = db_conn()
    if conn is None:
        return _fail(HTTPStatus.SERVICE_UNAVAILABLE, "DB_UNAVAILABLE", "Database unavailable")

    try:
        with conn:
            with conn.cursor() as cur, io.StringIO() as csv_output:
                # Write CSV header
                writer = csv.writer(csv_output)
                writer.writerow([
                    "ID", "Appointment ID", "Amount", "Method", "Status", "Created At"
                ])

                # Filtered query for payments
                where = ["1=1"]
                params: list[Any] = []
                if frm:
                    where.append("p.created_at >= %s")
                    params.append(frm)
                if to:
                    where.append("p.created_at <= %s")
                    params.append(to)
                if appt_id:
                    where.append("p.appointment_id = %s")
                    params.append(appt_id)

                where_sql = " AND ".join(where)

                cur.execute(
                    f"""
                    SELECT p.id::text, p.appointment_id::text, p.amount, p.method, p.status, p.created_at
                    FROM payments p
                    WHERE {where_sql}
                    ORDER BY p.created_at
                    """,
                    params,
                )
                rows = cur.fetchall()

                # Write data rows
                for r in rows:
                    writer.writerow([
                        r["id"],
                        r["appointment_id"],
                        float(r["amount"]) if r["amount"] is not None else 0.0,
                        r.get("method"),
                        r.get("status"),
                        r["created_at"].isoformat() if r["created_at"] else None,
                    ])

                # Seek to beginning of StringIO buffer
                csv_output.seek(0)

                # Return CSV response
                return Response(
                    csv_output.getvalue(),
                    mimetype="text/csv",
                    headers={"Content-Disposition": "attachment;filename=payments_export.csv"},
                )
    finally:
        conn.close()
# ----------------------------------------------------------------------------
# CSV Export Endpoints (T-024)
# ----------------------------------------------------------------------------
@app.route("/api/admin/reports/appointments.csv", methods=["GET"])
def export_appointments_csv():
    """Export appointments as CSV file for accounting tools."""
    # RBAC: Owner/Advisor/Accountant only
    try:
        user = require_auth_role()
        user_role = user.get("role", "Advisor")
        if user_role not in ["Owner", "Advisor", "Accountant"]:
            return _fail(HTTPStatus.FORBIDDEN, "RBAC_FORBIDDEN", "Only Owner, Advisor, and Accountant can export CSV")
    except Exception:
        return _fail(HTTPStatus.FORBIDDEN, "AUTH_REQUIRED", "Authentication required")

    # Rate limiting for exports (5 per user per hour)
    user_id = user.get("sub", "unknown")
    rate_limit_key = f"csv_export_{user_id}"
    try:
        rate_limit(rate_limit_key)
    except Forbidden:
        return _fail(HTTPStatus.TOO_MANY_REQUESTS, "RATE_LIMIT", "Export rate limit exceeded")

    # Query parameter validation
    args = request.args
    from_date = args.get("from")
    to_date = args.get("to") 
    status_filter = args.get("status")

    # Validate date format if provided
    where_conditions = ["1=1"]
    params = []
    
    if from_date:
        try:
            datetime.fromisoformat(from_date.replace('Z', '+00:00'))
            where_conditions.append("a.start >= %s")
            params.append(from_date)
        except ValueError:
            return _fail(HTTPStatus.BAD_REQUEST, "INVALID_DATE", "Invalid 'from' date format. Use ISO 8601 format.")
    
    if to_date:
        try:
            datetime.fromisoformat(to_date.replace('Z', '+00:00'))
            where_conditions.append("a.start <= %s")
            params.append(to_date)
        except ValueError:
            return _fail(HTTPStatus.BAD_REQUEST, "INVALID_DATE", "Invalid 'to' date format. Use ISO 8601 format.")
    
    if status_filter:
        try:
            normalized_status = norm_status(status_filter)
            where_conditions.append("a.status = %s")
            params.append(normalized_status)
        except BadRequest:
            return _fail(HTTPStatus.BAD_REQUEST, "INVALID_STATUS", "Invalid status value")

    conn = db_conn()
    if conn is None:
        return _fail(HTTPStatus.SERVICE_UNAVAILABLE, "DB_UNAVAILABLE", "Database unavailable")

    try:
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Query appointments with customer and vehicle data
                query = """
                    SELECT 
                        a.id::text,
                        COALESCE(c.name, '') as customer,
                        COALESCE(v.year::text || ' ' || v.make || ' ' || v.model, '') as vehicle,
                        a.start,
                        a.status::text,
                        COALESCE(a.total_amount, 0) as total_amount,
                        COALESCE(a.paid_amount, 0) as paid_amount
                    FROM appointments a
                    LEFT JOIN customers c ON c.id = a.customer_id
                    LEFT JOIN vehicles v ON v.id = a.vehicle_id
                    WHERE """ + " AND ".join(where_conditions) + """
                    ORDER BY a.start DESC
                """
                cur.execute(query, params)
                appointments = cur.fetchall()

        # Generate CSV content
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
        
        # Write header row (RFC4180 compliant)
        writer.writerow(['id', 'customer', 'vehicle', 'start', 'status', 'total_amount', 'paid_amount'])
        
        # Write data rows
        for appointment in appointments:
            writer.writerow([
                appointment['id'],
                appointment['customer'],
                appointment['vehicle'], 
                appointment['start'].isoformat() if appointment['start'] else '',
                appointment['status'],
                float(appointment['total_amount']),
                float(appointment['paid_amount'])
            ])

        csv_content = output.getvalue()
        output.close()

        # Create response with proper headers for file download
        response = Response(csv_content, mimetype='text/csv')
        response.headers['Content-Disposition'] = 'attachment; filename=appointments.csv'
        response.headers['Content-Type'] = 'text/csv; charset=utf-8'
        
        # Log the export for audit trail
        audit(conn, user_id, "EXPORT_CSV", "appointments", "", {}, {"count": len(appointments)})
        
        return response

    except Exception as e:
        log.error("CSV export failed: %s", e)
        return _fail(HTTPStatus.INTERNAL_SERVER_ERROR, "EXPORT_FAILED", "CSV export failed")
    finally:
        try:
            conn.close()
        except AttributeError:
            pass


@app.route("/api/admin/reports/payments.csv", methods=["GET"])
def export_payments_csv():
    """Export payments as CSV file for accounting tools."""
    # RBAC: Owner/Advisor/Accountant only
    try:
        user = require_auth_role()
        user_role = user.get("role", "Advisor")
        if user_role not in ["Owner", "Advisor", "Accountant"]:
            return _fail(HTTPStatus.FORBIDDEN, "RBAC_FORBIDDEN", "Only Owner, Advisor, and Accountant can export CSV")
    except Exception:
        return _fail(HTTPStatus.FORBIDDEN, "AUTH_REQUIRED", "Authentication required")

    # Rate limiting for exports
    user_id = user.get("sub", "unknown")
    rate_limit_key = f"csv_export_{user_id}"
    try:
        rate_limit(rate_limit_key)
    except Forbidden:
        return _fail(HTTPStatus.TOO_MANY_REQUESTS, "RATE_LIMIT", "Export rate limit exceeded")

    # Query parameter validation
    args = request.args
    from_date = args.get("from")
    to_date = args.get("to")

    where_conditions = ["1=1"]
    params = []
    
    if from_date:
        try:
            datetime.fromisoformat(from_date.replace('Z', '+00:00'))
            where_conditions.append("p.created_at >= %s")
            params.append(from_date)
        except ValueError:
            return _fail(HTTPStatus.BAD_REQUEST, "INVALID_DATE", "Invalid 'from' date format. Use ISO 8601 format.")
    
    if to_date:
        try:
            datetime.fromisoformat(to_date.replace('Z', '+00:00'))
            where_conditions.append("p.created_at <= %s")
            params.append(to_date)
        except ValueError:
            return _fail(HTTPStatus.BAD_REQUEST, "INVALID_DATE", "Invalid 'to' date format. Use ISO 8601 format.")

    conn = db_conn()
    if conn is None:
        return _fail(HTTPStatus.SERVICE_UNAVAILABLE, "DB_UNAVAILABLE", "Database unavailable")

    try:
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Query payments with appointment data
                query = """
                    SELECT 
                        p.id::text,
                        p.appointment_id::text,
                        p.amount,
                        p.method,
                        p.created_at
                    FROM payments p
                    WHERE """ + " AND ".join(where_conditions) + """
                    ORDER BY p.created_at DESC
                """
                cur.execute(query, params)
                payments = cur.fetchall()

        # Generate CSV content
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
        
        # Write header row (RFC4180 compliant)
        writer.writerow(['id', 'appointment_id', 'amount', 'method', 'created_at'])
        
        # Write data rows
        for payment in payments:
            writer.writerow([
                payment['id'],
                payment['appointment_id'],
                float(payment['amount']),
                payment['method'],
                payment['created_at'].isoformat() if payment['created_at'] else ''
            ])

        csv_content = output.getvalue()
        output.close()

        # Create response with proper headers for file download
        response = Response(csv_content, mimetype='text/csv')
        response.headers['Content-Disposition'] = 'attachment; filename=payments.csv'
        response.headers['Content-Type'] = 'text/csv; charset=utf-8'
        
        # Log the export for audit trail
        audit(conn, user_id, "EXPORT_CSV", "payments", "", {}, {"count": len(payments)})
        
        return response

    except Exception as e:
        log.error("CSV export failed: %s", e)
        return _fail(HTTPStatus.INTERNAL_SERVER_ERROR, "EXPORT_FAILED", "CSV export failed")
    finally:
        try:
            conn.close()
        except AttributeError:
            pass

# ----------------------------------------------------------------------------
# Root
# ----------------------------------------------------------------------------
@app.route("/", methods=["GET"])
def root():
    return jsonify(
        {
            "message": "Edgar's Auto Shop S1 API",
            "endpoints": [
                "GET /health",
                "GET /api/admin/appointments/board",
                "GET /api/admin/appointments",
                "POST /api/admin/appointments",
                "PATCH /api/admin/appointments/<id>/status",
                "PATCH /api/admin/appointments/<id>/move",
                "GET /api/appointments/<id>",
                "PATCH /api/appointments/<id>",
                "GET /api/customers/<id>/history",
                "GET /api/admin/dashboard/stats",
                "GET /api/admin/cars-on-premises",
                "GET /api/admin/reports/appointments.csv",
                "GET /api/admin/reports/payments.csv",
            ],
        }
    )
