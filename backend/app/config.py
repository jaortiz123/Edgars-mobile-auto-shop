"""Configuration module for Edgar's Mobile Auto Shop backend."""

import os
from typing import List


def get_jwt_secret() -> str:
    """Get JWT secret with dev fallback."""
    return os.getenv("JWT_SECRET", "dev_secret")


def get_jwt_algorithm() -> str:
    """Get JWT algorithm."""
    return os.getenv("JWT_ALG", "HS256")


def is_dev_no_auth() -> bool:
    """Check if dev auth bypass is enabled."""
    return os.getenv("DEV_NO_AUTH", "true").lower() == "true"


def get_staging_allowed_origins() -> List[str]:
    """Get CORS allowed origins for staging."""
    origins_str = os.getenv("STAGING_ALLOWED_ORIGINS", "")
    if not origins_str:
        return []
    return [origin.strip() for origin in origins_str.split(",") if origin.strip()]


def get_database_url() -> str:
    """Get database connection URL."""
    return os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/edgar_db")


def get_postgres_config() -> dict:
    """Get PostgreSQL connection configuration."""
    return {
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": int(os.getenv("POSTGRES_PORT", "5432")),
        "database": os.getenv("POSTGRES_DB", "edgar_db"),
        "user": os.getenv("POSTGRES_USER", "postgres"),
        "password": os.getenv("POSTGRES_PASSWORD", "postgres"),
    }
