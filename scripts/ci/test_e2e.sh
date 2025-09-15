#!/usr/bin/env bash
set -Eeuo pipefail

echo "🎭 E2E Tests (Playwright)"

if ! curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
  echo "Starting backend for E2E..."
  cd backend
  FLASK_ENV=test python local_server.py &
  BACKEND_PID=$!
  cd ..

  for i in {1..30}; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
      echo "Backend ready"
      break
    fi
    sleep 1
  done

  trap "kill $BACKEND_PID 2>/dev/null || true" EXIT
fi

cd frontend
export API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"
npx playwright test --config=playwright.config.ts --workers=1 --reporter=list
