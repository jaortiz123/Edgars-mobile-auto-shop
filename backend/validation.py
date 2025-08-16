from __future__ import annotations
from dataclasses import dataclass, field as dc_field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
import re

VALID_STATUSES = {"SCHEDULED","IN_PROGRESS","READY","COMPLETED","NO_SHOW","CANCELED"}
ALLOWED_TRANSITIONS = {
    "SCHEDULED": {"IN_PROGRESS","READY","NO_SHOW","CANCELED"},
    "IN_PROGRESS": {"READY","COMPLETED"},
    "READY": {"COMPLETED"},
    "COMPLETED": set(),
    "NO_SHOW": set(),
    "CANCELED": set(),
}
DEFAULT_BLOCK_HOURS = 2
MAX_DURATION_HOURS = 48
PAST_GRACE_MINUTES = 15

@dataclass
class ValidationError:
    code: str
    detail: str
    field: Optional[str] = None
    status: int = 400
    extra: Dict[str, Any] = dc_field(default_factory=dict)  # type: ignore

@dataclass
class ValidationResult:
    cleaned: Dict[str, Any]
    errors: List[ValidationError] = dc_field(default_factory=list)  # type: ignore

ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")

def _parse_dt(val: Any) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, str) and ISO_RE.match(val):
        try:
            # Assume UTC if no offset; replace 'Z'
            if val.endswith('Z'):
                return datetime.fromisoformat(val.replace('Z', '+00:00'))
            return datetime.fromisoformat(val)
        except ValueError:
            return None
    return None


def validate_appointment_payload(payload: Dict[str, Any], mode: str = 'create', existing: Optional[Dict[str, Any]] = None) -> ValidationResult:
    cleaned: Dict[str, Any] = {}
    errs: List[ValidationError] = []
    now = datetime.now(timezone.utc)

    # Basic fields
    status = (payload.get('status') or (existing or {}).get('status') or 'SCHEDULED').upper()
    if status not in VALID_STATUSES:
        errs.append(ValidationError(code='VALIDATION_FAILED', field='status', detail='Invalid status'))
    cleaned['status'] = status

    start_raw = payload.get('start_ts') or payload.get('start') or (existing or {}).get('start_ts')
    start_dt = _parse_dt(start_raw)
    if mode == 'create' and not start_dt:
        errs.append(ValidationError(code='VALIDATION_FAILED', field='start_ts', detail='start_ts required'))
    if start_dt:
        if start_dt < now - timedelta(minutes=PAST_GRACE_MINUTES):
            errs.append(ValidationError(code='VALIDATION_FAILED', field='start_ts', detail='start_ts too far in past'))
        cleaned['start_ts'] = start_dt

    end_raw = payload.get('end_ts') or (existing or {}).get('end_ts')
    end_dt = _parse_dt(end_raw)
    if end_dt and start_dt and end_dt < start_dt:
        errs.append(ValidationError(code='VALIDATION_FAILED', field='end_ts', detail='end_ts before start_ts'))
    if end_dt and start_dt and (end_dt - start_dt).total_seconds() > MAX_DURATION_HOURS * 3600:
        errs.append(ValidationError(code='VALIDATION_FAILED', field='end_ts', detail='duration exceeds maximum'))
    if end_dt:
        cleaned['end_ts'] = end_dt

    # Monetary
    total_amount = payload.get('total_amount', (existing or {}).get('total_amount'))
    paid_amount = payload.get('paid_amount', (existing or {}).get('paid_amount'))
    if total_amount is not None:
        try:
            total_amount = float(total_amount)
            if total_amount < 0:
                raise ValueError
        except Exception:
            errs.append(ValidationError(code='VALIDATION_FAILED', field='total_amount', detail='total_amount must be non-negative number'))
        else:
            cleaned['total_amount'] = total_amount
    if paid_amount is not None:
        try:
            paid_amount = float(paid_amount)
            if paid_amount < 0:
                raise ValueError
        except Exception:
            errs.append(ValidationError(code='VALIDATION_FAILED', field='paid_amount', detail='paid_amount must be non-negative number'))
        else:
            cleaned['paid_amount'] = paid_amount
    if (total_amount is not None and paid_amount is not None and isinstance(total_amount, float) and isinstance(paid_amount, float)):
        if paid_amount > total_amount:
            errs.append(ValidationError(code='VALIDATION_FAILED', field='paid_amount', detail='paid_amount cannot exceed total_amount'))

    # Customer / vehicle basics (light for now)
    for field_name in ['customer_id', 'vehicle_id', 'tech_id']:
        if field_name in payload:
            cleaned[field_name] = payload[field_name]

    # Transition validation (when editing status)
    if existing and 'status' in payload:
        prev = existing.get('status')
        if prev != status:
            allowed = ALLOWED_TRANSITIONS.get(prev, set())
            if status not in allowed:
                errs.append(ValidationError(code='INVALID_TRANSITION', field='status', detail=f'Cannot transition {prev} -> {status}', status=409))

    return ValidationResult(cleaned=cleaned, errors=errs)


def find_conflicts(conn, *, tech_id: Optional[str], vehicle_id: Optional[int], start_ts: datetime, end_ts: Optional[datetime], exclude_id: Optional[int] = None) -> Dict[str, List[int]]:
    """Return conflicting appointment ids keyed by 'tech' and 'vehicle'.
    Uses simplistic overlap on start_ts..COALESCE(end_ts, start_ts + default block)."""
    cur = conn.cursor()
    conflicts = {"tech": [], "vehicle": []}
    # Compute effective end (for open-ended appts)
    eff_end = end_ts or (start_ts + timedelta(hours=DEFAULT_BLOCK_HOURS))

    params: List[Any] = [start_ts, eff_end]
    exclude_clause = ''
    if exclude_id is not None:
        exclude_clause = 'AND a.id <> %s'
        params.append(exclude_id)

    # Technician conflicts
    if tech_id:
        cur.execute(f"""
            SELECT a.id FROM appointments a
            WHERE a.tech_id = %s
              AND a.status NOT IN ('CANCELED','NO_SHOW')
              {exclude_clause}
              AND tsrange(a.start_ts, COALESCE(a.end_ts, a.start_ts + INTERVAL '{DEFAULT_BLOCK_HOURS} hour')) && tsrange(%s, %s)
        """, [tech_id] + params + ([] if exclude_id is None else []))
        conflicts['tech'] = [r[0] for r in cur.fetchall()]

    # Vehicle conflicts
    if vehicle_id:
        cur.execute(f"""
            SELECT a.id FROM appointments a
            WHERE a.vehicle_id = %s
              AND a.status NOT IN ('CANCELED','NO_SHOW')
              {exclude_clause}
              AND tsrange(a.start_ts, COALESCE(a.end_ts, a.start_ts + INTERVAL '{DEFAULT_BLOCK_HOURS} hour')) && tsrange(%s, %s)
        """, [vehicle_id] + params + ([] if exclude_id is None else []))
        conflicts['vehicle'] = [r[0] for r in cur.fetchall()]

    return conflicts
