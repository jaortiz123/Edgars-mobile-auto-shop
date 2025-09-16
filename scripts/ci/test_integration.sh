#!/usr/bin/env bash
set -Eeuo pipefail

export CI=true TZ=UTC PYTHONHASHSEED=0
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-west-2}"
export FALLBACK_TO_MEMORY=false

# Force host/port visible on the runner (not 'db')
export POSTGRES_HOST="127.0.0.1"
export POSTGRES_PORT="55432"
export POSTGRES_DB="${POSTGRES_DB:-test_autoshop}"
export POSTGRES_USER="${POSTGRES_USER:-test_user}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-test_password}"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"

DB_CONTAINER="ci-postgres-$RANDOM"

echo "🐘 Starting Postgres ${DB_CONTAINER} on ${POSTGRES_HOST}:${POSTGRES_PORT}"
docker run -d --rm --name "${DB_CONTAINER}" \
  -e POSTGRES_USER="${POSTGRES_USER}" \
  -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  -e POSTGRES_DB="${POSTGRES_DB}" \
  -p "${POSTGRES_PORT}:5432" \
  postgres:16

echo "⏳ Waiting for health..."
for i in {1..40}; do
  if docker exec "${DB_CONTAINER}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

# Run migrations/seeds here if you have them
# python run_sql_migrations.py

pushd backend >/dev/null
pytest -q -m "integration" --tb=short
popd >/dev/null

docker stop "${DB_CONTAINER}" >/dev/null
