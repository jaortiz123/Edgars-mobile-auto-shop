#!/bin/bash
echo "🛑 Stopping Edgar's Auto Shop development environment..."

# Stop frontend and backend processes
if pgrep -f "vite" > /dev/null; then
    echo "Stopping frontend..."
    pkill -f "vite"
fi

if pgrep -f "local_server.py" > /dev/null; then
    echo "Stopping backend..."
    pkill -f "local_server.py"
fi

# Stop Docker services
echo "Stopping database services..."
docker-compose stop db redis

echo "✅ All services stopped"
