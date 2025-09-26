"""Persistence adapter for mobile appointments service."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, Iterable, List, Optional

from .db import safe_conn


@dataclass(frozen=True)
class AppointmentRecord:
    """Immutable representation of an appointment row."""

    id: str
    status: str
    title: Optional[str]
    start_ts: Optional[datetime]
    end_ts: Optional[datetime]
    customer_name: Optional[str]
    vehicle_label: Optional[str]
    total_amount_cents: int
    created_at: Optional[datetime]
    customer_id: Optional[int]


class AppointmentsRepository:
    """Repository providing read access to appointments."""

    def __init__(self) -> None:
        self._memory_rows: List[AppointmentRecord] = []

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def list(
        self,
        *,
        tenant_id: str,
        filters: Dict[str, Any],
        limit: int,
        offset: int,
    ) -> List[AppointmentRecord]:
        """Return appointments for the tenant honoring the supplied filters."""

        conn, use_memory, err = safe_conn()
        if err and not use_memory:
            raise err
        if conn:
            try:
                rows = self._list_from_db(conn, tenant_id, filters, limit, offset)
            finally:
                try:
                    conn.close()
                except Exception:  # pragma: no cover - connection close best-effort
                    pass
            return rows
        if use_memory:
            return self._list_from_memory(filters, limit, offset)
        raise RuntimeError("Database unavailable and memory fallback disabled")

    def seed_memory(self, rows: Iterable[Dict[str, Any]]) -> None:
        """Seed the in-memory store for tests or offline usage."""

        self._memory_rows = [self._build_record(row) for row in rows]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _list_from_db(
        self,
        conn,
        tenant_id: str,
        filters: Dict[str, Any],
        limit: int,
        offset: int,
    ) -> List[AppointmentRecord]:
        where_clauses = ["a.tenant_id = %s"]
        params: List[Any] = [tenant_id]

        status = filters.get("status")
        if status:
            where_clauses.append("a.status = %s")
            params.append(status)

        from_dt = filters.get("from")
        if from_dt:
            where_clauses.append("a.start_ts >= %s")
            params.append(from_dt)

        to_dt = filters.get("to")
        if to_dt:
            where_clauses.append("a.start_ts <= %s")
            params.append(to_dt)

        customer_id = filters.get("customer_id")
        if customer_id is not None:
            where_clauses.append("a.customer_id = %s")
            params.append(customer_id)

        where_sql = " AND ".join(where_clauses)

        query = f"""
            SELECT
                a.id::text AS id,
                a.status::text AS status,
                a.title,
                a.start_ts,
                a.end_ts,
                COALESCE(NULLIF(TRIM(c.name), ''), 'Unknown Customer') AS customer_name,
                NULLIF(TRIM(CONCAT_WS(' ', v.make, v.model)), '') AS vehicle_label,
                a.total_amount AS total_amount,
                a.created_at,
                a.customer_id
            FROM appointments a
            LEFT JOIN customers c ON c.id = a.customer_id
            LEFT JOIN vehicles v ON v.id = a.vehicle_id
            WHERE {where_sql}
            ORDER BY a.start_ts IS NULL, a.start_ts ASC, a.created_at DESC, a.id ASC
            LIMIT %s OFFSET %s
        """

        params.extend([limit, offset])

        with conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                rows = cur.fetchall() or []

        return [self._build_record(dict(row)) for row in rows]

    def _list_from_memory(
        self,
        filters: Dict[str, Any],
        limit: int,
        offset: int,
    ) -> List[AppointmentRecord]:
        def _matches(rec: AppointmentRecord) -> bool:
            if filters.get("status") and rec.status != filters["status"]:
                return False
            from_dt = filters.get("from")
            if from_dt and rec.start_ts and rec.start_ts < from_dt:
                return False
            to_dt = filters.get("to")
            if to_dt and rec.start_ts and rec.start_ts > to_dt:
                return False
            cust_id = filters.get("customer_id")
            if cust_id is not None and rec.customer_id != cust_id:
                return False
            return True

        filtered = [rec for rec in self._memory_rows if _matches(rec)]

        def _sort_key(rec: AppointmentRecord):
            start_ts = _ensure_utc(rec.start_ts)
            created_at = _ensure_utc(rec.created_at)
            created_ts = created_at.timestamp() if created_at else 0.0
            return (
                start_ts is None,
                start_ts or datetime.min.replace(tzinfo=timezone.utc),
                -created_ts,
                rec.id,
            )

        sorted_rows = sorted(filtered, key=_sort_key)

        return sorted_rows[offset : offset + limit]

    # ------------------------------------------------------------------
    @staticmethod
    def _decimal_to_cents(value: Optional[Any]) -> int:
        if value is None:
            return 0
        if isinstance(value, Decimal):
            cents = (value * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            return int(cents)
        try:
            dec_value = Decimal(str(value))
            cents = (dec_value * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            return int(cents)
        except Exception:
            return 0

    def _build_record(self, row: Dict[str, Any]) -> AppointmentRecord:
        start_ts = _ensure_utc(self._ensure_datetime(row.get("start_ts")))
        end_ts = _ensure_utc(self._ensure_datetime(row.get("end_ts")))
        created_at = _ensure_utc(self._ensure_datetime(row.get("created_at")))
        customer_id = row.get("customer_id")
        try:
            customer_id = int(customer_id) if customer_id is not None else None
        except Exception:
            customer_id = None
        return AppointmentRecord(
            id=str(row.get("id")),
            status=(row.get("status") or "").upper(),
            title=row.get("title"),
            start_ts=start_ts,
            end_ts=end_ts,
            customer_name=row.get("customer_name"),
            vehicle_label=row.get("vehicle_label"),
            total_amount_cents=self._decimal_to_cents(row.get("total_amount")),
            created_at=created_at,
            customer_id=customer_id,
        )

    @staticmethod
    def _ensure_datetime(value: Any) -> Optional[datetime]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        try:
            return datetime.fromisoformat(str(value))
        except Exception:
            return None


def _ensure_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
