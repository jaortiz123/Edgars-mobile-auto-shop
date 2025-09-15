#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Config
: "${TEST_DB_PORT:=55432}"  # NOT 5432
DB_CONTAINER=""
PGCTL_DIR=""

# Cleanup function
cleanup() {
  echo "🧹 cleanup"
  if [[ -n "$DB_CONTAINER" ]]; then
    docker rm -f "$DB_CONTAINER" >/dev/null 2>&1 || true
  fi
  if [[ -n "$PGCTL_DIR" ]]; then
    pg_ctl -D "$PGCTL_DIR" stop -m fast >/dev/null 2>&1 || true
    rm -rf "$PGCTL_DIR"
  fi
}
trap 'cleanup' EXIT ERR INT

# Load test env
load_env() {
  local file="$1"
  [ -f "$file" ] || return 0
  while IFS='=' read -r k v; do
    [[ "$k" =~ ^#|^$ ]] && continue
    export "$k"="$(echo "$v" | sed 's/^"//; s/"$//')"
  done < "$file"
}
load_env ".env.test"

echo "🚀 Local CI start"

# Call shared scripts
scripts/ci/setup.sh
scripts/ci/lint.sh
scripts/ci/test_unit.sh
scripts/ci/build.sh

# Start PostgreSQL for integration
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  DB_CONTAINER="test-postgres-$RANDOM"
  docker run -d --name "$DB_CONTAINER" \
    -e POSTGRES_DB=test_db \
    -e POSTGRES_USER=test_user \
    -e POSTGRES_PASSWORD=test_password \
    -p "${TEST_DB_PORT}:5432" \
    --health-cmd="pg_isready -U test_user" \
    --health-interval=2s --health-timeout=2s --health-retries=15 \
    postgres:13

  until [ "$(docker inspect -f '{{.State.Health.Status}}' "$DB_CONTAINER")" = "healthy" ]; do
    sleep 1
  done
else
  echo "🐘 Docker unavailable, starting local PostgreSQL"
  PGCTL_DIR="$(mktemp -d)"
  initdb -D "$PGCTL_DIR" -A trust >/tmp/pg-init.log 2>&1
  pg_ctl -D "$PGCTL_DIR" -o "-p ${TEST_DB_PORT}" -w start >/tmp/pg-start.log 2>&1
  psql -h localhost -p "${TEST_DB_PORT}" -d postgres -c "CREATE ROLE test_user LOGIN PASSWORD 'test_password';" >/tmp/pg-setup.log 2>&1
  psql -h localhost -p "${TEST_DB_PORT}" -d postgres -c "CREATE DATABASE test_db OWNER test_user;" >>/tmp/pg-setup.log 2>&1
fi

export DATABASE_URL="postgresql://test_user:test_password@localhost:${TEST_DB_PORT}/test_db"
scripts/ci/seed_test_db.sh
scripts/ci/test_integration.sh

# Run dual smoke tests
echo "💨 SQLite smoke test"
FALLBACK_TO_MEMORY=true python backend/tests/test_api_smoke.py

echo "💨 PostgreSQL smoke test"
TEST_DATABASE_URL="$DATABASE_URL" python backend/tests/test_api_smoke.py

scripts/ci/test_e2e.sh

echo "✅ LOCAL CI PASSED"
