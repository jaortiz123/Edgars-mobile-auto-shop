#!/bin/bash
# Edgar's Auto Shop - Simple startup script

echo "🚀 Starting Edgar's Mobile Auto Shop..."

# Start Docker services
echo "Starting database services..."
docker-compose up -d db redis

# Wait a moment for DB to start
echo "Waiting for database..."
sleep 5

# Stop any existing processes
echo "Stopping existing processes..."
pkill -f "local_server.py" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2

# Start backend
echo "Starting backend..."
cd backend
POSTGRES_HOST=localhost python3 local_server.py &
cd ..

# Wait for backend
echo "Waiting for backend..."
sleep 3

# Start frontend (install deps if needed)
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo "Starting frontend..."
cd frontend
npm run dev &
cd ..

echo ""
echo "✅ Services starting..."
echo "   • Frontend: http://localhost:5173"
echo "   • Backend API: http://localhost:3001"
echo "   • Admin Dashboard: http://localhost:5173/admin/dashboard"
echo ""
echo "Press Ctrl+C to stop all services"

# Create stop script
cat > stop-dev.sh << 'EOF'
#!/bin/bash
echo "Stopping services..."
pkill -f "vite" 2>/dev/null || true
pkill -f "local_server.py" 2>/dev/null || true
docker-compose stop db redis
echo "✅ Stopped"
EOF
chmod +x stop-dev.sh

# Keep running
trap 'echo "Stopping..."; pkill -f "vite" 2>/dev/null; pkill -f "local_server.py" 2>/dev/null; docker-compose stop db redis; exit 0' INT
while true; do sleep 1; done
