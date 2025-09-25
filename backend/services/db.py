"""Database connection and utilities."""

import json
import logging
import os
import sys
import threading
import uuid
from typing import Any, Dict, Optional, Tuple
from urllib.parse import parse_qs, urlparse

import psycopg2
from psycopg2.extras import RealDictCursor

log = logging.getLogger(__name__)

# Thread-local storage for connection reentrant guard
_DB_CONN_SENTINEL = object()
_DB_CONN_TLS = threading.local()

# Global config cache for test stability
# NOTE: Tests monkeypatch this module so it needs to be available here
_DB_CONN_CONFIG_CACHE = None


class _LoggingCursorProxy:
    """Lightweight cursor wrapper to log executed SQL for tracing."""

    __slots__ = ("_cur",)

    def __init__(self, cur):
        self._cur = cur

    def execute(self, query, vars=None):  # pragma: no cover (diagnostic aid)
        try:
            q = query if isinstance(query, str) else str(query)
            q_single = " ".join(q.split())
            if len(q_single) > 500:
                q_single = q_single[:497] + "..."
            log.debug(
                "sql.execute",
                extra={
                    "sql": q_single,
                    "vars": repr(vars)[:400],
                },
            )
        except Exception:
            pass
        return self._cur.execute(query, vars)

    # delegate common cursor attributes
    def __getattr__(self, item):  # pragma: no cover simple delegation
        return getattr(self._cur, item)


def _raw_db_connect():
    """Actual psycopg2 connect wrapped so test monkeypatch logic can short‑circuit earlier."""
    global _DB_CONN_CONFIG_CACHE
    try:
        cache_disabled = os.getenv("DISABLE_DB_CONFIG_CACHE", "false").lower() == "true"
        if not cache_disabled and _DB_CONN_CONFIG_CACHE:
            cfg = dict(_DB_CONN_CONFIG_CACHE)
        else:
            database_url = os.getenv("DATABASE_URL")
            if database_url:
                result = urlparse(database_url)
                cfg = {
                    "user": result.username,
                    "host": result.hostname,
                    "port": result.port,
                    "dbname": (result.path[1:] if result.path.startswith("/") else result.path),
                }
                if result.password is not None:
                    cfg["password"] = result.password
                # Honor sslmode from URL query or environment
                try:
                    q = parse_qs(result.query)
                    url_sslmode = q.get("sslmode", [None])[0]
                except Exception:
                    url_sslmode = None
                env_sslmode = os.getenv("PGSSLMODE") or os.getenv("POSTGRES_SSLMODE")
                sslmode = url_sslmode or env_sslmode
                if sslmode:
                    cfg["sslmode"] = sslmode
            else:
                cfg = dict(
                    host=os.getenv("POSTGRES_HOST", "db"),
                    port=int(os.getenv("POSTGRES_PORT", 5432)),
                    dbname=os.getenv("POSTGRES_DB", "autoshop"),
                    user=os.getenv("POSTGRES_USER", "user"),
                    password=os.getenv("POSTGRES_PASSWORD", "password"),
                )
            cfg.update(
                connect_timeout=int(os.getenv("POSTGRES_CONNECT_TIMEOUT", "2")),
                cursor_factory=RealDictCursor,
            )
            # Store immutable reference for later stability
            if not cache_disabled:
                _DB_CONN_CONFIG_CACHE = dict(cfg)
        return psycopg2.connect(**cfg)
    except Exception:
        # On any failure, clear cache so recovery attempts can rebuild with new env
        if _DB_CONN_CONFIG_CACHE is not None:
            try:
                _DB_CONN_CONFIG_CACHE = None
            except Exception:
                pass
        raise


def _wrap_connection_for_logging(conn):
    """Wrap connection to add SQL logging for diagnostic purposes."""
    try:
        if getattr(conn, "_sql_logging_wrapped", False):
            return conn
        orig_cursor = conn.cursor

        def cursor(*a, **kw):  # pragma: no cover debugging helper
            real = orig_cursor(*a, **kw)
            return _LoggingCursorProxy(real)

        conn.cursor = cursor  # type: ignore
        conn._sql_logging_wrapped = True  # type: ignore
    except Exception:
        pass
    return conn


def db_conn():
    """Monkeypatch‑aware DB connection helper.

    Test suite imports this module sometimes as `local_server` and sometimes as
    `backend.local_server`. When tests monkeypatch `backend.local_server.db_conn`,
    our previously imported reference would bypass that patch resulting in real
    connection attempts and 500s.

    Strategy:
      1. Inspect sys.modules for the sibling module name.
      2. If a sibling module exists and exposes a *different* db_conn callable (patched), call it.
      3. If the sibling patched function returns None, propagate None (tests may rely on this).
      4. Otherwise perform a real connection via _raw_db_connect().
    """
    try:
        sib_names = ["backend.local_server", "local_server"]
        current = sys.modules.get(__name__)
        reentrant = getattr(_DB_CONN_TLS, "in_call", False)
        for name in sib_names:
            mod = sys.modules.get(name)
            if not mod or mod is current:
                continue
            patched = getattr(mod, "db_conn", None)
            if patched and patched is not db_conn:
                # Guard against infinite ping-pong between dual-loaded modules
                if reentrant:
                    break  # perform raw connect instead
                try:
                    _DB_CONN_TLS.in_call = True
                    return patched()
                finally:
                    _DB_CONN_TLS.in_call = False
        conn = _raw_db_connect()
        # Enable diagnostic SQL logging when E2E or explicit flag
        if os.getenv("E2E_SQL_TRACE", "true").lower() == "true" or os.getenv("PYTEST_CURRENT_TEST"):
            conn = _wrap_connection_for_logging(conn)
        return conn
    except RuntimeError:
        raise
    except Exception as e:
        log.error("Database connection failed: %s", e)
        raise RuntimeError("Database connection failed") from e


def safe_conn() -> Tuple[Optional[Any], bool, Optional[str]]:
    """Unified helper to obtain a DB connection or signal memory fallback.

    Returns (conn, use_memory, err) where:
      conn: psycopg2 connection or None
      use_memory: bool indicating whether memory fallback should be used
      err: original exception (or None) when connection failed and no memory fallback

    This consolidates scattered try/except blocks so endpoints can uniformly
    choose graceful degradation over 500s when FALLBACK_TO_MEMORY=true.
    """
    use_memory = os.getenv("FALLBACK_TO_MEMORY", "false").lower() == "true"
    try:
        conn = db_conn()
        if conn is None:  # Patched test variant explicitly returns None
            return None, use_memory, None
        return conn, False, None
    except Exception as e:  # pragma: no cover - exercised via tests
        if use_memory:
            return None, True, None
        return None, False, e


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


def audit_log(user_id: str, action: str, details: str):
    """Lightweight audit hook used by legacy CSV export tests.

    We intentionally keep this minimal; detailed auditing for most endpoints
    uses the richer `audit` function that writes rows to the database.
    """
    try:
        log.info("audit_log action=%s user=%s details=%s", action, user_id, details)
    except Exception:
        pass
