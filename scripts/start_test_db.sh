#!/bin/bash
# Start Test Database for Integration Tests
# Usage: ./scripts/start_test_db.sh [method]
# Methods: docker, local, compose

set -e

METHOD=${1:-docker}
DB_NAME=${DB_NAME:-edgar_auto_shop_test}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}
DB_PORT=${DB_PORT:-5432}

echo "🚀 Starting test database using method: $METHOD"

case $METHOD in
    docker)
        echo "📦 Starting PostgreSQL container..."
        docker run -d \
            --name edgar-test-db \
            -e POSTGRES_DB=$DB_NAME \
            -e POSTGRES_USER=$DB_USER \
            -e POSTGRES_PASSWORD=$DB_PASSWORD \
            -p $DB_PORT:5432 \
            postgres:13-alpine

        echo "⏳ Waiting for database to be ready..."
        sleep 5

        # Wait for PostgreSQL to accept connections
        until docker exec edgar-test-db pg_isready -U $DB_USER; do
            echo "Waiting for PostgreSQL..."
            sleep 2
        done
        ;;

    compose)
        echo "🐳 Starting with docker-compose..."
        cat > docker-compose.test.yml << EOF
version: '3.8'
services:
  test-db:
    image: postgres:13-alpine
    environment:
      POSTGRES_DB: $DB_NAME
      POSTGRES_USER: $DB_USER
      POSTGRES_PASSWORD: $DB_PASSWORD
    ports:
      - "$DB_PORT:5432"
    volumes:
      - test_db_data:/var/lib/postgresql/data

volumes:
  test_db_data:
EOF
        docker-compose -f docker-compose.test.yml up -d
        ;;

    local)
        echo "🏠 Using local PostgreSQL installation..."
        echo "Creating test database: $DB_NAME"

        # Try to create database (ignore error if exists)
        createdb -h localhost -U $DB_USER $DB_NAME 2>/dev/null || true

        # Test connection
        psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null
        ;;

    *)
        echo "❌ Unknown method: $METHOD"
        echo "Available methods: docker, compose, local"
        exit 1
        ;;
esac

# Run basic migrations/schema setup if needed
echo "📋 Setting up test schema..."

# Export connection details for tests
export DB_HOST=localhost
export DB_PORT=$DB_PORT
export DB_NAME=$DB_NAME
export DB_USER=$DB_USER
export DB_PASSWORD=$DB_PASSWORD
export DB_SSLMODE=disable

echo "✅ Test database ready!"
echo "🔗 Connection: postgresql://$DB_USER:$DB_PASSWORD@localhost:$DB_PORT/$DB_NAME"
echo ""
echo "🧪 Run integration tests with:"
echo "   export DB_HOST=localhost DB_USER=$DB_USER DB_PASSWORD=$DB_PASSWORD DB_NAME=$DB_NAME DB_PORT=$DB_PORT DB_SSLMODE=disable"
echo "   pytest tests/api/v1/admin/invoices/test_integration.py"
echo ""
echo "🛑 Stop test database with:"
if [ "$METHOD" = "docker" ]; then
    echo "   docker stop edgar-test-db && docker rm edgar-test-db"
elif [ "$METHOD" = "compose" ]; then
    echo "   docker-compose -f docker-compose.test.yml down -v"
fi
