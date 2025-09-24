#!/bin/bash
echo "🛑 Stopping Edgar's Auto Shop development environment..."

# Docker compose helper - prefers modern "docker compose" with fallback
compose() {
    if docker compose version >/dev/null 2>&1; then
        docker compose "$@"
    elif command -v docker-compose >/dev/null 2>&1; then
        docker-compose "$@"
    else
        echo "Compose not found; skipping container stop"
        return 127
    fi
}

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
compose stop db redis

echo "✅ All services stopped"
