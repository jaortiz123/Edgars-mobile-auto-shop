#!/bin/bash
echo "🚀 Starting Edgar's Mobile Auto Shop - Local Development Stack"
echo ""

# Kill existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "local_server.py" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2

# Start backend
echo "🔧 Starting backend server..."
cd backend
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=edgar_db
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/edgar_db
export DEV_NO_AUTH=true
export STAGING_ALLOWED_ORIGINS="http://localhost:5173,http://mobile-auto-shop-staging-b928aa27.s3-website-us-west-2.amazonaws.com,https://dhenpsl7bvqqp.cloudfront.net"
python local_server.py &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

# Wait for backend to start
sleep 5

# Test backend health
echo "🔍 Testing backend health..."
HEALTH_CHECK=$(curl -s http://localhost:3001/health | grep '"ok": true' || echo "FAILED")
if [[ "$HEALTH_CHECK" == "FAILED" ]]; then
    echo "❌ Backend health check failed!"
    exit 1
fi
echo "✅ Backend is healthy"

# Start frontend
echo "🎨 Starting frontend server..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID"

echo ""
echo "🎉 Both services are running!"
echo "   - Backend:  http://localhost:3001/health"
echo "   - Frontend: http://localhost:5173/"
echo "   - Admin:    http://localhost:5173/admin"
echo ""
echo "Press Ctrl+C to stop all services"

# Keep script running
wait
