#!/bin/bash
# Production Deployment Script for Edgar's Mobile Auto Shop
# Implements critical performance fixes: Gunicorn + Connection Pooling

set -e  # Exit on any error

echo "🚀 Edgar's Mobile Auto Shop - Production Deployment"
echo "Implementing critical performance fixes..."

# Configuration
WORKERS=${WORKERS:-4}
PORT=${PORT:-5000}
BIND=${BIND:-"0.0.0.0:$PORT"}
TIMEOUT=${TIMEOUT:-30}
MAX_REQUESTS=${MAX_REQUESTS:-1000}

# Database pool configuration
DB_POOL_MIN=${DB_POOL_MIN:-5}
DB_POOL_MAX=${DB_POOL_MAX:-20}

# Set production environment
export APP_ENV=production
export FLASK_ENV=production
export FLASK_DEBUG=0

# Set production secrets (required for security validation)
export JWT_SECRET=${JWT_SECRET:-"production_jwt_secret_$(date +%s)_$(openssl rand -hex 16)"}
export FLASK_SECRET_KEY=${FLASK_SECRET_KEY:-"production_flask_secret_$(date +%s)_$(openssl rand -hex 16)"}

echo "📊 Configuration:"
echo "  Workers: $WORKERS"
echo "  Bind: $BIND"
echo "  Timeout: $TIMEOUT"
echo "  Max Requests: $MAX_REQUESTS"
echo "  DB Pool: $DB_POOL_MIN-$DB_POOL_MAX connections"

# Stop any existing Gunicorn processes
echo "🛑 Stopping existing processes..."
pkill -f gunicorn || true

# Wait for processes to stop
sleep 2

# Create PID directory
mkdir -p /tmp/edgar_auto_shop

# Start Gunicorn with optimized configuration
echo "🔄 Starting Gunicorn production server..."

cd "$(dirname "$0")"  # Ensure we're in the backend directory
cd ..  # Go to project root

exec gunicorn \
    --bind "$BIND" \
    --workers "$WORKERS" \
    --worker-class sync \
    --timeout "$TIMEOUT" \
    --max-requests "$MAX_REQUESTS" \
    --max-requests-jitter 50 \
    --pid /tmp/edgar_auto_shop/gunicorn.pid \
    --access-logfile - \
    --error-logfile - \
    --log-level info \
    backend.wsgi:application
