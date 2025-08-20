"""Vehicle ownership guard utilities & decorator.

Primary entry point for endpoints is the ``@vehicle_ownership_required``
decorator which enforces that the target vehicle belongs to the supplied
customer context. We keep the decorator *opt‑in* for endpoints that need to
bind a ``vehicle_id`` path parameter to an asserted customer id.

Design:
    * Underlying lookup implemented by :func:`vehicle_belongs_to_customer`.
    * Decorator parameters: ``vehicle_arg`` (path parameter / argument name) and
        optional ``customer_arg`` (query arg or callable) or ``customer_from`` to
        extract customer id from request.args.
    * Failure returns the unified error envelope (400 + message) via callback
        provided at decoration time (we inject a lightweight local import of
        ``_error`` to avoid cycle risks).
"""

from __future__ import annotations

# NOTE: Avoid importing local_server at module import time to prevent a circular
# import (local_server imports vehicle_ownership_required). We lazily resolve the
# reference the first time any guard logic executes.
import importlib
from functools import wraps
from typing import Any, Callable, Optional

from flask import request

_srv: Any | None = None


def _get_srv():  # pragma: no cover - trivial
    global _srv
    if _srv is None:
        try:
            _srv = importlib.import_module("backend.local_server")
        except Exception:
            _srv = importlib.import_module("local_server")
    return _srv


def vehicle_belongs_to_customer(vehicle_id: str, customer_id: str) -> bool:
    """Return True if vehicle belongs to customer_id.

    Accepts either numeric vehicle primary key or license plate token. We keep
    SQL simple & index‑friendly: id is primary key; license_plate assumed to be
    indexed/unique in practical environments (tests rely on deterministic rows).
    """
    if not vehicle_id or not customer_id:
        return False
    # Normalization: treat customer_id as text comparison (schema stores integer)
    try:
        cust_int = int(customer_id)
    except Exception:
        # Customer ids in current schema are integers; any non‑numeric immediately fails
        return False

    by_plate = False
    vid_int: Optional[int]
    try:
        vid_int = int(vehicle_id)
    except Exception:
        vid_int = None
        by_plate = True

    srv = _get_srv()
    conn = srv.db_conn()
    try:
        with conn.cursor() as cur:  # RealDictCursor ok; only need existence check
            if not by_plate:
                cur.execute(
                    "SELECT 1 FROM vehicles WHERE id = %s AND customer_id = %s",
                    (vid_int, cust_int),
                )
            else:
                cur.execute(
                    "SELECT 1 FROM vehicles WHERE license_plate = %s AND customer_id = %s",
                    (vehicle_id, cust_int),
                )
            return cur.fetchone() is not None
    finally:  # pragma: no cover - safety
        try:
            conn.close()
        except Exception:
            pass


def guard_vehicle_ownership(vehicle_id: str, customer_id: str) -> bool:
    """Alias kept for semantic clarity at call sites."""
    return vehicle_belongs_to_customer(vehicle_id, customer_id)


def vehicle_ownership_required(
    *,
    vehicle_arg: str = "vehicle_id",
    customer_query_arg: str = "customer_id",
    require_role: str = "Advisor",
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Decorator enforcing that the referenced vehicle belongs to customer.

    Parameters
    ----------
    vehicle_arg: str
        The keyword argument name passed to the route function representing the vehicle id.
    customer_query_arg: str
        Name of query parameter holding the customer id context.
    """

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # Role enforcement first; unauthorized => 403 (do not leak ownership info)
            srv = _get_srv()
            auth = srv.require_or_maybe(require_role)
            if not auth:
                return srv._error(403, "forbidden", "Not authorized")

            cust_id = request.args.get(customer_query_arg)
            vid = kwargs.get(vehicle_arg)
            if cust_id and vid:
                if not guard_vehicle_ownership(str(vid), str(cust_id)):
                    return srv._error(400, "bad_request", "vehicle does not belong to customer")
            return fn(*args, **kwargs)

        return wrapper

    return decorator
