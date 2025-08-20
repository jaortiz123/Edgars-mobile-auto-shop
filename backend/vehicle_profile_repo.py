"""Minimal vehicle profile repository used by tests.

Provides header, stats, timeline pagination, and weak ETag helpers.
Data sourced directly from existing tables (vehicles, appointments, invoices).
This module purposefully keeps logic simple – it is only exercised via tests.
"""

from __future__ import annotations

import base64
import hashlib
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from psycopg2.extras import RealDictCursor

try:  # runtime dual-import safety (package vs direct execution)
    from . import local_server as srv  # type: ignore
except Exception:  # pragma: no cover
    import local_server as srv  # type: ignore


def _connect():  # pragma: no cover - exercised indirectly through tests
    return srv.db_conn()


def _parse_vehicle_identifier(vehicle_id: str) -> Tuple[Optional[int], bool]:
    """Return (vehicle_id_int, by_plate)."""
    try:
        return int(vehicle_id), False
    except Exception:  # not an int – treat as license plate
        return None, True


def fetch_vehicle_header(vehicle_id: str) -> Optional[Dict[str, Any]]:
    vid_int, by_plate = _parse_vehicle_identifier(vehicle_id)
    conn = _connect()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if not by_plate:
                cur.execute(
                    """
                    SELECT v.id, v.customer_id, c.name AS customer_name,
                           v.year, v.make, v.model, v.license_plate, v.vin,
                           v.created_at, v.updated_at
                    FROM vehicles v
                    LEFT JOIN customers c ON c.id = v.customer_id
                    WHERE v.id = %s
                    """,
                    (vid_int,),
                )
            else:
                cur.execute(
                    """
                    SELECT v.id, v.customer_id, c.name AS customer_name,
                           v.year, v.make, v.model, v.license_plate, v.vin,
                           v.created_at, v.updated_at
                    FROM vehicles v
                    LEFT JOIN customers c ON c.id = v.customer_id
                    WHERE v.license_plate = %s
                    """,
                    (vehicle_id,),
                )
            row = cur.fetchone()
            if not row:
                return None
            vehicle = {
                "id": str(row["id"]),
                "customerId": (
                    str(row.get("customer_id")) if row.get("customer_id") is not None else None
                ),
                "customerName": row.get("customer_name"),
                "year": row.get("year"),
                "make": row.get("make"),
                "model": row.get("model"),
                "licensePlate": row.get("license_plate"),
                "vin": row.get("vin"),
            }
            return {"vehicle": vehicle}
    finally:
        try:
            conn.close()
        except Exception:
            pass


def fetch_vehicle_stats(vehicle_id: str) -> Dict[str, Any]:
    vid_int, by_plate = _parse_vehicle_identifier(vehicle_id)
    conn = _connect()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if not by_plate:
                cur.execute(
                    """
                    SELECT COUNT(*) AS visits,
                           COALESCE(SUM(CASE WHEN a.status='COMPLETED' THEN 1 ELSE 0 END),0) AS completed
                    FROM appointments a
                    WHERE a.vehicle_id = %s
                    """,
                    (vid_int,),
                )
            else:
                cur.execute(
                    """
                    SELECT COUNT(*) AS visits,
                           COALESCE(SUM(CASE WHEN a.status='COMPLETED' THEN 1 ELSE 0 END),0) AS completed
                    FROM appointments a
                    JOIN vehicles v ON v.id = a.vehicle_id
                    WHERE v.license_plate = %s
                    """,
                    (vehicle_id,),
                )
            agg = cur.fetchone() or {"visits": 0, "completed": 0}
            if not by_plate:
                cur.execute(
                    """SELECT COALESCE(SUM(total_amount),0) AS total_revenue FROM appointments WHERE vehicle_id=%s""",
                    (vid_int,),
                )
            else:
                cur.execute(
                    """SELECT COALESCE(SUM(a.total_amount),0) AS total_revenue FROM appointments a JOIN vehicles v ON v.id=a.vehicle_id WHERE v.license_plate=%s""",
                    (vehicle_id,),
                )
            rev = cur.fetchone() or {"total_revenue": 0}
            return {
                "visits": int(agg.get("visits", 0)),
                "completed": int(agg.get("completed", 0)),
                "totalRevenue": float(rev.get("total_revenue", 0) or 0.0),
            }
    finally:
        try:
            conn.close()
        except Exception:
            pass


def encode_cursor(dt: datetime, appt_id: str) -> str:
    raw = f"{dt.isoformat()}|{appt_id}".encode()
    return base64.urlsafe_b64encode(raw).decode()


def decode_cursor(cursor: str) -> Tuple[datetime, str]:
    raw = base64.urlsafe_b64decode(cursor.encode()).decode()
    ts, appt_id = raw.split("|", 1)
    return datetime.fromisoformat(ts), appt_id


def fetch_timeline_page(
    *,
    vehicle_id: str,
    cursor: str | None,
    date_from: str | None,
    date_to: str | None,
    include_invoices: bool,
    page_size: int,
) -> Dict[str, Any]:
    vid_int, by_plate = _parse_vehicle_identifier(vehicle_id)
    conn = _connect()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if not by_plate:
                params: List[Any] = [vid_int]
                where = ["a.vehicle_id = %s"]
            else:
                params = [vehicle_id]
                where = ["v.license_plate = %s"]

            if cursor:
                try:
                    c_dt, c_id = decode_cursor(cursor)
                    where.append("(a.start_ts, a.id) < (%s, %s)")
                    params.extend([c_dt, c_id])
                except Exception:  # invalid cursor – ignore
                    pass
            else:  # only apply date filters for the first page
                if date_from:
                    where.append("a.start_ts >= %s")
                    params.append(f"{date_from} 00:00:00")
                if date_to:
                    where.append("a.start_ts <= %s")
                    params.append(f"{date_to} 23:59:59")

            where_sql = " AND ".join(where)
            base_select = "SELECT a.id::text, a.status::text, a.start_ts, a.total_amount, a.paid_amount FROM appointments a"
            if by_plate:
                base_select += " JOIN vehicles v ON v.id=a.vehicle_id"
            query = f"{base_select} WHERE {where_sql} ORDER BY a.start_ts DESC, a.id DESC LIMIT %s"
            cur.execute(query, params + [page_size + 1])
            rows = cur.fetchall() or []
            has_more = len(rows) > page_size
            rows = rows[:page_size]
            next_cursor = None
            if has_more and rows:
                last = rows[-1]
                next_cursor = encode_cursor(last["start_ts"], last["id"])

            out_rows: List[Dict[str, Any]] = []
            appt_ids = [r["id"] for r in rows]
            invoice_map: Dict[str, Dict[str, Any]] = {}
            if include_invoices and appt_ids:
                cur.execute(
                    "SELECT id, appointment_id, status::text, total_cents, amount_paid_cents, amount_due_cents FROM invoices WHERE appointment_id = ANY(%s)",
                    (appt_ids,),
                )
                for inv in cur.fetchall() or []:
                    invoice_map[inv["appointment_id"]] = inv

            for r in rows:
                appt_obj: Dict[str, Any] = {
                    "id": str(r["id"]),
                    "status": r["status"],
                    "startTs": r["start_ts"].isoformat() if r.get("start_ts") else None,
                    "totalAmount": float(r.get("total_amount") or 0.0),
                    "paidAmount": float(r.get("paid_amount") or 0.0),
                }
                if include_invoices:
                    appt_obj["invoice"] = invoice_map.get(r["id"]) or None
                out_rows.append(appt_obj)

            return {
                "rows": out_rows,
                "has_more": has_more,
                "next_cursor": next_cursor,
                "page_size": page_size,
            }
    finally:
        try:
            conn.close()
        except Exception:
            pass


def compute_vehicle_profile_etag(vehicle_id: str) -> str:
    """Compute a weak ETag based on the max updated timestamp of related appointments.

    This mirrors a simplified cache-busting strategy suitable for tests.
    """
    vid_int, by_plate = _parse_vehicle_identifier(vehicle_id)
    conn = _connect()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if not by_plate:
                cur.execute(
                    "SELECT COALESCE(MAX(updated_at), NOW()) AS max_upd FROM appointments WHERE vehicle_id=%s",
                    (vid_int,),
                )
            else:
                cur.execute(
                    "SELECT COALESCE(MAX(a.updated_at), NOW()) AS max_upd FROM appointments a JOIN vehicles v ON v.id=a.vehicle_id WHERE v.license_plate=%s",
                    (vehicle_id,),
                )
            up = cur.fetchone() or {"max_upd": datetime.utcnow()}
            basis = f"{vehicle_id}:{up.get('max_upd')}".encode()
            return 'W/"' + hashlib.sha1(basis).hexdigest() + '"'
    finally:
        try:
            conn.close()
        except Exception:
            pass
