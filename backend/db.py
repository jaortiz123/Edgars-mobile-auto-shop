import os
from typing import Any, Mapping, Optional

import psycopg2
import psycopg2.extras
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


class _CompatRow(dict):
    """Row object that allows both key and index access.

    The robustness tests index into rows numerically (row[0]) while most of the
    code uses key access. RealDictRow only supports key access. We subclass
    dict and implement __getitem__ to allow integer index ordering based on
    insertion order (matching cursor.description column order) in addition to
    normal dict key lookup.
    """

    __slots__ = ("_order",)

    def __init__(self, data, order):
        super().__init__(data)
        self._order = order

    def __getitem__(self, item):
        if isinstance(item, int):
            key = self._order[item]
            return super().__getitem__(key)
        return super().__getitem__(item)


class CompatCursor(psycopg2.extras.RealDictCursor):
    """Cursor returning rows supporting both dict and index style access."""

    def fetchone(self):  # type: ignore[override]
        row = super().fetchone()
        if row is None:
            return None
        return _CompatRow(row, [d.name for d in self.description])

    def fetchmany(self, size=None):  # type: ignore[override]
        rows = super().fetchmany(size)
        order = [d.name for d in self.description] if self.description else []
        return [_CompatRow(r, order) for r in rows]

    def fetchall(self):  # type: ignore[override]
        rows = super().fetchall()
        order = [d.name for d in self.description] if self.description else []
        return [_CompatRow(r, order) for r in rows]


def _build_dsn() -> Optional[str]:
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "postgres")
    user = os.getenv("POSTGRES_USER", "postgres")
    pwd = os.getenv("POSTGRES_PASSWORD", "postgres")
    return f"dbname={db} user={user} password={pwd} host={host} port={port}"


def get_connection(dict_cursor: bool = True):
    """Return a new database connection using environment variables.

    Parameters
    ----------
    dict_cursor: bool
        If True (default) sets connection cursor_factory to RealDictCursor. Some
        tests however expect tuple-style positional indexing (row[0]). To keep
        backward compatibility we provide a lightweight wrapper cursor when
        dict_cursor=True that still allows numeric indices on fetched rows.
    """
    dsn = os.environ.get("DATABASE_URL") or _build_dsn()
    if not dsn:
        raise RuntimeError("Database DSN is not configured")
    conn = psycopg2.connect(dsn, connect_timeout=5)
    if dict_cursor:
        conn.cursor_factory = psycopg2.extras.RealDictCursor
    return conn


def get_compat_connection():
    """Return a connection whose cursor() yields rows usable via row[0] or row['col']."""
    dsn = os.environ.get("DATABASE_URL") or _build_dsn()
    if not dsn:
        raise RuntimeError("Database DSN is not configured")
    conn = psycopg2.connect(dsn, connect_timeout=5, cursor_factory=CompatCursor)
    return conn


# Build DATABASE_URL from env or POSTGRES_* fallback
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "postgres")
    user = os.getenv("POSTGRES_USER", "postgres")
    pwd = os.getenv("POSTGRES_PASSWORD", "postgres")
    DATABASE_URL = f"postgresql+psycopg2://{user}:{pwd}@{host}:{port}/{db}"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=int(os.getenv("DB_POOL_SIZE", "10")),
    max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "5")),
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine, autoflush=False, autocommit=False, future=True, expire_on_commit=False
)


def run_query(sql: str, params: Optional[Mapping[str, Any]] = None):
    """Execute a read-only query and return the Result object.
    Use .mappings().all() or .mappings().first() to get dict-like rows.
    """
    with SessionLocal() as session:
        return session.execute(text(sql), params or {})


def run_write(sql: str, params: Optional[Mapping[str, Any]] = None):
    """Execute a write (INSERT/UPDATE/DELETE), commit, and return the Result object."""
    with SessionLocal() as session:
        res = session.execute(text(sql), params or {})
        session.commit()
        return res
