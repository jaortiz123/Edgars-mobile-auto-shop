#!/usr/bin/env bash
set -Eeuo pipefail

echo "🎭 E2E Tests (Playwright)"

export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-west-2}"

# Use docker-compose for E2E (better isolation)
echo "🐳 Starting services with docker-compose..."

# Set compose database URL for backend container
export DATABASE_URL_COMPOSE="postgresql://test_user:test_password@db:5432/test_autoshop"

# Start services
docker-compose up -d --build

echo "⏳ Waiting for DB (compose network)..."
for i in {1..60}; do
  if docker-compose exec -T db pg_isready -h localhost -p 5432 -U test_user -d test_autoshop >/dev/null 2>&1; then
    echo "✅ DB ready"
    break
  fi
  sleep 1
done

echo "🔧 Running migrations + seed inside backend container..."
docker-compose exec -T backend python run_sql_migrations.py 2>/dev/null || echo "Migration script not found"
docker-compose exec -T backend psql "postgresql://test_user:test_password@db:5432/test_autoshop" -v ON_ERROR_STOP=1 -f /app/backend/seeds/seed_s1.sql 2>/dev/null || echo "No seed file found"

echo "⏳ Waiting for backend health (E2E)..."
timeout 90 bash -c 'until curl -fsS http://localhost:3001/health; do sleep 2; done' || {
  echo "❌ Backend health check failed"
  docker-compose logs backend
  docker-compose down
  exit 1
}

echo "🧪 Running Playwright tests..."
cd frontend
export API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"
npx playwright test --config=playwright.config.ts --workers=1 --reporter=list

# Cleanup
echo "🧹 Stopping services..."
cd ..
docker-compose down

echo "✅ E2E tests complete"
