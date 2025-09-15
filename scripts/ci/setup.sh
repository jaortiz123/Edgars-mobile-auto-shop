#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

cleanup() {
  :
}
trap 'cleanup' EXIT ERR INT

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "📦 Installing root Node dependencies"
npm ci

echo "📦 Installing frontend Node dependencies"
(cd frontend && npm ci)

echo "🐍 Installing Python dependencies"
python -m pip install --upgrade pip setuptools packaging wheel
python -m pip install -r backend/requirements.txt
python -m pip install ruff
