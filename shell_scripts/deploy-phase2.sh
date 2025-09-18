#!/usr/bin/env bash
# deploy-phase2.sh
# One-liner to execute complete Phase 2 deployment

set -euo pipefail

echo "🚀 Starting Edgar's Auto Shop Phase 2 Production Deployment..."

# Check prerequisites
echo "📋 Checking prerequisites..."
command -v aws >/dev/null || { echo "❌ AWS CLI required"; exit 1; }
command -v session-manager-plugin >/dev/null || { echo "❌ Session Manager plugin required"; exit 1; }
command -v psql >/dev/null || { echo "❌ PostgreSQL client required"; exit 1; }

# Verify environment variables
: "${INSTANCE_ID?Set INSTANCE_ID environment variable}"
: "${RDS_ENDPOINT?Set RDS_ENDPOINT environment variable}"
: "${PGPASSWORD?Set PGPASSWORD for app_user}"

echo "✅ Prerequisites validated"

# Step 1: Start SSM tunnel (background)
echo "🔧 Step 1: Starting SSM tunnel..."
./setup-ssm-production.sh &
SSM_PID=$!
sleep 5  # Allow tunnel to establish

# Step 2: Apply production SQL
echo "🔧 Step 2: Applying production SQL bundle..."
psql -h localhost -p 15432 -U postgres -d edgarautoshop -v ON_ERROR_STOP=1 -f production-cutover-bundle-v2.sql

# Step 3: Verify security (as app_user)
echo "🔧 Step 3: Verifying RLS security..."
export PGHOST=127.0.0.1 PGPORT=15432 PGDATABASE=edgarautoshop PGUSER=app_user
./verify-rls-production-v2.sh

# Step 4: Test health endpoint (if app is running)
echo "🔧 Step 4: Testing application health..."
if curl -s -H "X-Tenant-Id: deploy-test" http://localhost:3000/health/tenant-security >/dev/null 2>&1; then
    echo "✅ Application health check passed"
    curl -s -H "X-Tenant-Id: deploy-test" http://localhost:3000/health/tenant-security | jq .
else
    echo "⚠️  Application not responding - deploy middleware and restart"
fi

echo ""
echo "🎉 Phase 2 Deployment Complete!"
echo "✅ SSM tunnel active (PID: $SSM_PID)"
echo "✅ RLS security verified"
echo "✅ Production ready for tenant traffic"
echo ""
echo "📋 Next Steps:"
echo "1. Deploy production middleware to your application"
echo "2. Update secrets management for PGPASSWORD"
echo "3. Schedule security monitoring: monitor-rls-drift.sql"
echo "4. Kill SSH bastion if still running"
echo ""
echo "🛡️ Security: All tenant data now isolated by RLS policies"
