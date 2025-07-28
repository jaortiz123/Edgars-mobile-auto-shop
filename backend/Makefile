# Makefile for backend tasks

# Load environment variables from .env (copy from .env.example if needed)
-include .env

alembic-up:
	alembic upgrade head

alembic-down:
	alembic downgrade -1

alembic-rev:
	alembic revision -m "$(m)"

db-psql:
	psql -h $(POSTGRES_HOST) -U $(POSTGRES_USER) -d $(POSTGRES_DB)

check-migration:
	@command -v psql >/dev/null 2>&1 || { echo >&2 "psql not installed, skipping migration check"; exit 0; }
	psql -h $(POSTGRES_HOST) -U $(POSTGRES_USER) -d $(POSTGRES_DB) -c "\d appointments" -c "\di+ ix_appointments_start_ts"
