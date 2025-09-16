#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

cleanup() {
  :
}
trap 'cleanup' EXIT ERR INT

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "🔍 Running frontend lint"
(cd frontend && npm run lint:ci --if-present)

echo "🔍 Running backend lint"
python -m flake8 backend --count --select=E9,F63,F7,F82 --show-source --statistics
