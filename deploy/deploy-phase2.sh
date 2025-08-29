#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL, e.g. postgres://app_user:***@127.0.0.1:5432/db}"
ROOT=$(cd "$(dirname "$0")/.." && pwd)

echo "🚀 Applying Phase 2 production cutover SQL..."
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f "$ROOT/sql/production-cutover-bundle-v2.sql"

echo "🔍 Verifying RLS security configuration..."
bash "$ROOT/verify/verify-rls-production-v2.sh"

echo ""
echo "✅ Phase 2 cutover SQL applied and verified."
echo "🛡️ Production tenant isolation is now active."
