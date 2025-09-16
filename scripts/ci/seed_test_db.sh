#!/usr/bin/env bash
set -Eeuo pipefail

echo "🌱 Seeding test database..."

if [ -n "${DATABASE_URL:-}" ]; then
  cd backend
  if [ -f "init_db.py" ]; then
    python init_db.py
  fi

  if [ -f "seeds/seed_s1.sql" ]; then
    psql "$DATABASE_URL" < seeds/seed_s1.sql
  fi

  echo "✅ Database seeded"
else
  echo "⚠️ No DATABASE_URL, skipping seed"
fi
