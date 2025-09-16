#!/usr/bin/env bash
set -Eeuo pipefail

export CI=true TZ=UTC PYTHONHASHSEED=0
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-west-2}"
export FALLBACK_TO_MEMORY=false

# Check if DATABASE_URL is provided (CI mode vs local mode)
if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "🐘 Using provided DATABASE_URL (CI mode)"
  echo "DATABASE_URL: ${DATABASE_URL//:[^@]*@/:***@}"

  # Ensure individual components are also set for compatibility
  export POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
  export POSTGRES_PORT="${POSTGRES_PORT:-55432}"
  export POSTGRES_DB="${POSTGRES_DB:-test_autoshop}"
  export POSTGRES_USER="${POSTGRES_USER:-test_user}"
  export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-test_password}"

  # No need to start local Postgres - using CI service
  LOCAL_POSTGRES=false
else
  # For local use, start our own Postgres
  export POSTGRES_HOST="127.0.0.1"
  export POSTGRES_PORT="55432"
  export POSTGRES_DB="${POSTGRES_DB:-test_autoshop}"
  export POSTGRES_USER="${POSTGRES_USER:-test_user}"
  export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-test_password}"
  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"

  DB_CONTAINER="ci-postgres-$RANDOM"

  echo "🐘 Starting local Postgres ${DB_CONTAINER} on ${POSTGRES_HOST}:${POSTGRES_PORT}"
  docker run -d --rm --name "${DB_CONTAINER}" \
    -e POSTGRES_USER="${POSTGRES_USER}" \
    -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
    -e POSTGRES_DB="${POSTGRES_DB}" \
    -p "${POSTGRES_PORT}:5432" \
    postgres:16

  echo "⏳ Waiting for local health..."
  for i in {1..40}; do
    if docker exec "${DB_CONTAINER}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  # Run migrations/seeds for local
  echo "🔧 Running local schema + migrations + seed..."
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f database/init.sql 2>/dev/null || echo "No schema file database/init.sql"
  cd backend && python run_sql_migrations.py && cd ..
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f backend/seeds/seed_s1.sql 2>/dev/null || echo "No seed file backend/seeds/seed_s1.sql"

  LOCAL_POSTGRES=true
fi

# Test DB connection before running tests
echo "🔍 Testing DB connection..."
psql "${DATABASE_URL}" -c "SELECT 1" >/dev/null 2>&1 || {
  echo "❌ Cannot connect to database at ${DATABASE_URL//:[^@]*@/:***@}"
  [[ "${LOCAL_POSTGRES:-false}" == "true" ]] && docker stop "${DB_CONTAINER}" >/dev/null || true
  exit 1
}
echo "✅ Database connection successful"

# Export Python path for tests
export PYTHONPATH="${PYTHONPATH:-}:$(pwd)/backend"

echo "🧪 Running integration tests..."
pushd backend >/dev/null
pytest -q -m "integration" --tb=short
popd >/dev/null

# Cleanup local container if we started one
if [[ "${LOCAL_POSTGRES}" == "true" ]]; then
  echo "🧹 Cleaning up local Postgres..."
  docker stop "${DB_CONTAINER}" >/dev/null
fi

echo "✅ Integration tests complete"
