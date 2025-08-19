import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
fileConfig(config.config_file_name)

# Build DB URL from env if present


def db_url_from_env():
    user = os.getenv("POSTGRES_USER", "user")
    pw = os.getenv("POSTGRES_PASSWORD", "password")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "autoshop")
    return f"postgresql+psycopg2://{user}:{pw}@{host}:{port}/{db}"


# allow env override of sqlalchemy.url
if "sqlalchemy.url" in config.get_section("alembic"):
    url = os.getenv("DATABASE_URL", db_url_from_env())
    config.set_section_option("alembic", "sqlalchemy.url", url)

target_metadata = None  # no ORM models


def run_migrations_offline():
    """
    Run migrations in 'offline' mode.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, literal_binds=True)

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """
    Run migrations in 'online' mode.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
