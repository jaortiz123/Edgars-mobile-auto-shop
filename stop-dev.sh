#!/bin/bash
echo "Stopping services..."
pkill -f "vite" 2>/dev/null || true
pkill -f "local_server.py" 2>/dev/null || true
docker-compose stop db redis
echo "✅ Stopped"
