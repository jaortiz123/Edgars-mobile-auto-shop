#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

cleanup() {
  :
}
trap 'cleanup' EXIT ERR INT

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

: "${TEST_DB_PORT:=55432}"
: "${DATABASE_URL:=postgresql://test_user:test_password@localhost:${TEST_DB_PORT}/test_db}"

export DATABASE_URL
export FALLBACK_TO_MEMORY="false"
export TEST_DATABASE_URL="${TEST_DATABASE_URL:-$DATABASE_URL}"

echo "🧪 Running backend integration tests against ${DATABASE_URL}"
pytest -m integration
