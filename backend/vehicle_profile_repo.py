"""Vehicle profile repository & helpers.

Services:
 - DB connection helper
 - Cursor encode/decode (base64 "timestamp|id")
 - Vehicle header fetch
 - Lifetime stats aggregation
 - Timeline pagination (appointments + optional invoice summary)
 - Weak ETag computation

Schema note: appointments.start_ts is surfaced as scheduled_at.
"""

from __future__ import annotations

import hashlib
import os
from base64 import b64decode, b64encode
from typing import Any, Dict, Optional, Tuple

import psycopg2
from psycopg2.extras import RealDictCursor

DB_DSN = os.getenv("DATABASE_URL")


def _connect() -> psycopg2.extensions.connection:  # type: ignore
    """Return a database connection (prefers local helper)."""
    try:  # pragma: no cover
        import local_server as srv  # type: ignore

        return srv.db_conn()
    except Exception:  # pragma: no cover
        if DB_DSN:
            return psycopg2.connect(DB_DSN, cursor_factory=RealDictCursor)
        return psycopg2.connect(
            "postgresql://postgres:postgres@localhost:5432/postgres",
            cursor_factory=RealDictCursor,
        )


def encode_cursor(ts_iso: str, row_id: str) -> str:
    """Encode a timeline cursor to base64."""
    raw = f"{ts_iso}|{row_id}".encode()
    return b64encode(raw).decode()


def decode_cursor(cur: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """Decode a cursor -> (timestamp, id)."""
    if not cur:
        return None, None
    try:
        raw = b64decode(cur).decode()
        ts, rid = raw.split("|", 1)
        return ts, rid
    except Exception:  # pragma: no cover
        return None, None


def fetch_vehicle_header(vehicle_id: str) -> Optional[Dict[str, Any]]:
    """Return vehicle header & org readability or None."""
    vehicle_id = _resolve_vehicle_id(vehicle_id)
    if vehicle_id is None:
        return None
    sql = (
        "SELECT v.id, v.year, v.make, v.model, v.license_plate AS plate, "
        "v.license_plate AS vin, NULL AS notes, v.customer_id, TRUE AS "
        "org_readable FROM vehicles v WHERE v.id = %(vid)s::int"
    )
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(sql, {"vid": vehicle_id})
        row = cur.fetchone()
        if not row:
            return None
        return {
            "vehicle": {
                "id": row["id"],
                "year": row["year"],
                "make": row["make"],
                "model": row["model"],
                "plate": row.get("plate"),
                "vin": row.get("vin"),
                "notes": row.get("notes"),
                "customer_id": row["customer_id"],
            },
            "org_readable": bool(row["org_readable"]),
        }


def fetch_vehicle_stats(vehicle_id: str) -> Dict[str, Any]:
    """Return lifetime stats (dollars) for the vehicle."""
    vid = _resolve_vehicle_id(vehicle_id)
    if vid is None:
        return {
            "lifetime_spend": 0.0,
            "total_visits": 0,
            "last_service_at": None,
            "avg_ticket": 0.0,
        }
    sql = (
        "WITH ap AS (\n"
        "  SELECT a.id, a.start_ts AS scheduled_at, a.status\n"
        "  FROM appointments a\n"
        "  WHERE a.vehicle_id = %(vid)s::int\n"
        "), inv AS (\n"
        "  SELECT i.id, (i.total_cents / 100.0) AS total,\n"
        "         (i.amount_paid_cents / 100.0) AS paid_total,\n"
        "         i.updated_at, i.appointment_id\n"
        "  FROM invoices i\n"
        "  JOIN ap ON ap.id = i.appointment_id\n"
        ")\n"
        "SELECT COALESCE((SELECT ROUND(SUM(i.total)::numeric, 2)\n"
        "        FROM inv i), 0.0) AS lifetime_spend,\n"
        "       (SELECT COUNT(*) FROM ap\n"
        "         WHERE status = 'COMPLETED') AS total_visits,\n"
        "       (SELECT to_char(MAX(ap.scheduled_at) AT TIME ZONE 'UTC',\n"
        '               \'YYYY-MM-DD"T"HH24:MI:SS"Z"\') FROM ap\n'
        "         WHERE status = 'COMPLETED') AS last_service_at,\n"
        "       CASE WHEN COALESCE((SELECT COUNT(*) FROM inv),0) > 0 THEN\n"
        "            ROUND((SELECT SUM(inv.total) FROM inv) / NULLIF(\n"
        "                 (SELECT COUNT(*) FROM inv), 0), 2)\n"
        "            ELSE 0.0 END AS avg_ticket"
    )
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(sql, {"vid": vid})
        r = cur.fetchone() or {}
    return {
        "lifetime_spend": float(r.get("lifetime_spend") or 0.0),
        "total_visits": int(r.get("total_visits") or 0),
        "last_service_at": r.get("last_service_at"),
        "avg_ticket": float(r.get("avg_ticket") or 0.0),
    }


def fetch_timeline_page(
    *,
    vehicle_id: str,
    cursor: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    include_invoices: bool,
    page_size: int,
) -> Dict[str, Any]:
    """Return a timeline page of appointments for the vehicle."""
    vid = _resolve_vehicle_id(vehicle_id)
    if vid is None:
        return {
            "rows": [],
            "page_size": page_size,
            "has_more": False,
            "next_cursor": None,
        }
    c_ts, c_id = decode_cursor(cursor)
    where_cursor = (
        "AND ("  # ensure precedence
        "%(c_ts)s IS NULL AND %(c_id)s IS NULL OR "
        "(a.start_ts, a.id) < (%(c_ts)s::timestamptz, %(c_id)s)"
        ")"
    )
    where_dates = (
        "AND (%(from)s IS NULL OR a.start_ts >= %(from)s::date) "
        "AND (%(to)s IS NULL OR a.start_ts < ("
        "%(to)s::date + INTERVAL '1 day'))"
    )
    filter_sql = where_cursor if cursor else where_dates
    sql = f"""
WITH base AS (
    SELECT a.id, a.start_ts, a.status
    FROM appointments a
    WHERE a.vehicle_id = %(vid)s::int
    {filter_sql}
    ORDER BY a.start_ts DESC, a.id DESC
    LIMIT LEAST(%(limit)s, 100)
), rows AS (
        SELECT b.id,
                     to_char(
                         b.start_ts AT TIME ZONE 'UTC',
                         'YYYY-MM-DD"T"HH24:MI:SS"Z"'
                     ) AS scheduled_at,
                     UPPER(b.status::text) AS status,
                 (
                     SELECT COALESCE(
                         json_agg(
                             jsonb_build_object(
                                 'service_id', li.service_operation_id,
                                 'name', so.name
                             ) ORDER BY so.name
                         ),
                         '[]'::json
                     )
                     FROM invoices i
                                         JOIN invoice_line_items li
                                             ON li.invoice_id = i.id
                                         JOIN service_operations so
                                             ON so.id = li.service_operation_id
                     WHERE i.appointment_id = b.id
                 ) AS services,
                 (
                     CASE WHEN %(inc)s IS TRUE THEN (
                         SELECT jsonb_build_object(
                             'id', i.id,
                             'total', ROUND(
                                 i.total_cents/100.0,
                                 2
                             ),
                             'paid', ROUND(
                                 i.amount_paid_cents/100.0,
                                 2
                             ),
                             'unpaid', ROUND(
                                 GREATEST(
                                     (
                                         i.total_cents -
                                         i.amount_paid_cents
                                     )/100.0,
                                     0
                                 ),
                                 2
                             )
                         )
                         FROM invoices i
                         WHERE i.appointment_id = b.id
                     ) ELSE NULL END
                 ) AS invoice
    FROM base b
)
SELECT * FROM rows
"""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            sql,
            {
                "vid": vid,
                "c_ts": c_ts,
                "c_id": c_id,
                "from": date_from,
                "to": date_to,
                "limit": page_size,
                "inc": include_invoices,
            },
        )
        rows = cur.fetchall()
    has_more = len(rows) == page_size
    next_cursor = None
    if rows and has_more:
        last = rows[-1]
        next_cursor = encode_cursor(last["scheduled_at"], last["id"])
    return {
        "rows": [dict(r) for r in rows],
        "page_size": page_size,
        "has_more": has_more,
        "next_cursor": next_cursor,
    }


def compute_vehicle_profile_etag(vehicle_id: str) -> str:
    """Compute weak ETag from related updated timestamps."""
    vid = _resolve_vehicle_id(vehicle_id)
    if vid is None:
        return 'W/"empty"'
    sql = """
SELECT
  (SELECT GREATEST(MAX(a.updated_at), MAX(a.created_at))
      FROM appointments a
      WHERE a.vehicle_id = %(vid)s::int) AS ap_u,
  (SELECT GREATEST(MAX(i.updated_at), MAX(i.created_at))
      FROM invoices i
      JOIN appointments a ON a.id = i.appointment_id
      WHERE a.vehicle_id = %(vid)s::int) AS inv_u,
  (SELECT MAX(i.updated_at)
      FROM invoices i
      JOIN appointments a ON a.id = i.appointment_id
      WHERE a.vehicle_id = %(vid)s::int) AS li_u,
  (SELECT COALESCE(v.updated_at, v.created_at)
      FROM (
         SELECT id, created_at, created_at AS updated_at
         FROM vehicles
      ) v
      WHERE v.id = %(vid)s::int) AS v_u,
  (SELECT COALESCE(c.updated_at, c.created_at)
      FROM customers c
      JOIN vehicles v ON v.customer_id = c.id
      WHERE v.id = %(vid)s::int) AS c_u
"""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(sql, {"vid": vid})
        row = cur.fetchone() or {}
    pieces = [str(row.get(k) or "") for k in ["v_u", "c_u", "ap_u", "inv_u", "li_u"]]
    h = hashlib.sha1("|".join(pieces).encode()).hexdigest()
    return f'W/"{h}"'


def _resolve_vehicle_id(vehicle_id: str) -> Optional[str]:
    """Return numeric vehicle id; resolve license plate if needed."""
    try:
        int(vehicle_id)
        return vehicle_id
    except ValueError:
        pass
    sql = "SELECT id FROM vehicles WHERE license_plate = %(p)s ORDER BY id " "LIMIT 1"
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(sql, {"p": vehicle_id})
        r = cur.fetchone()
    if not r:
        return None
    return str(r.get("id") if isinstance(r, dict) else r[0])
