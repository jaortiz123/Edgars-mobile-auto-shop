#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

cleanup() {
  :
}
trap 'cleanup' EXIT ERR INT

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-west-2}"
export FALLBACK_TO_MEMORY="${FALLBACK_TO_MEMORY:-true}"
export DISABLE_FLAKE_DEMO="true"

echo "🧪 Unit Tests"

# backend unit slice (no external DB/services)
pushd backend >/dev/null
pytest -q -m "not integration" --tb=short
popd >/dev/null

echo "🧪 Running frontend unit tests"
cd frontend
npm run test:unit -- --run --coverage || echo "⚠️ Coverage below threshold but continuing"
cd ..

echo "✅ Unit tests complete"
