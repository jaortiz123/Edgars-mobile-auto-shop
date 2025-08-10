import os
from typing import Optional, Mapping, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

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

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True, expire_on_commit=False)

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
