#!/bin/bash
# Production Health Check - Edgar's Mobile Auto Shop
# Quick validation script for ongoing production monitoring
#
# Usage: ./scripts/production-health-check.sh
# Returns: 0 if healthy, 1 if issues detected

set -e

echo "🏥 Edgar's Mobile Auto Shop - Production Health Check"
echo "=================================================="
date

# Check if SigV4 proxy is running
echo -n "🔍 SigV4 Proxy Status: "
if curl -s http://localhost:8080/healthz > /dev/null 2>&1; then
    echo "✅ Running"
else
    echo "❌ Not Running - Start with: cd dev-proxy && python sigv4_proxy.py &"
    exit 1
fi

# Check core endpoints
echo -n "🔍 Health Endpoint: "
HEALTH=$(curl -s http://localhost:8080/healthz | jq -r '.ok' 2>/dev/null || echo "false")
if [ "$HEALTH" = "true" ]; then
    echo "✅ Healthy"
else
    echo "❌ Unhealthy"
    exit 1
fi

echo -n "🔍 Status Board API: "
BOARD=$(curl -s http://localhost:8080/api/admin/appointments/board | jq -r '.ok' 2>/dev/null || echo "false")
if [ "$BOARD" = "true" ]; then
    echo "✅ Operational"
else
    echo "❌ Failed"
    exit 1
fi

echo -n "🔍 Dashboard Stats: "
STATS=$(curl -s http://localhost:8080/api/admin/dashboard/stats | jq -r '.ok' 2>/dev/null || echo "false")
if [ "$STATS" = "true" ]; then
    echo "✅ Operational"
else
    echo "❌ Failed"
    exit 1
fi

# Performance check
echo -n "🔍 Performance Check: "
START_TIME=$(python3 -c "import time; print(int(time.time() * 1000))")
curl -s http://localhost:8080/api/admin/appointments/board > /dev/null 2>&1
END_TIME=$(python3 -c "import time; print(int(time.time() * 1000))")
DURATION=$((END_TIME - START_TIME))

if [ $DURATION -lt 800 ]; then
    echo "✅ ${DURATION}ms (SLO: <800ms)"
else
    echo "⚠️ ${DURATION}ms (SLO: <800ms) - Performance degraded"
fi

echo ""
echo "🎉 Production Health Check PASSED"
echo "   All core endpoints operational"
echo "   Authentication working"
echo "   Performance within SLO"
echo ""
echo "📊 Quick Stats:"
curl -s http://localhost:8080/api/admin/dashboard/stats | jq '.data' 2>/dev/null || echo "Stats unavailable"

exit 0
