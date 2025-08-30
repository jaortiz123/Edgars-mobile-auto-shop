-- 001_tenants_and_user_tenants.sql
BEGIN;

-- Create users table first (required for tenant relationships)
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenants (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Users table is assumed existing: users(id, email, password_hash, is_active, created_at, ...)
-- Use bcrypt/argonid cost ~12 for bcrypt.

CREATE TYPE user_role AS ENUM ('OWNER','ADVISOR','ACCOUNTANT','VIEWER');

CREATE TABLE IF NOT EXISTS user_tenants (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role      user_role NOT NULL DEFAULT 'VIEWER',
  PRIMARY KEY (user_id, tenant_id)
);

-- Optional: a default tenant selection per user (for multi‑org users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_tenant_id TEXT NULL REFERENCES tenants(id);

COMMIT;
