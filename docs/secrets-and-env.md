# Secrets and Environment Setup

This repo avoids committing credentials. Use one of these patterns locally:

1) Passwordless DATABASE_URL + PGPASSWORD (recommended)

- Put these in `.env.local` (gitignored):

```env
DATABASE_URL=postgres://postgres@<rds-endpoint>:5432/edgar_db?sslmode=require
PGPASSWORD=<your-password>
```

1) ~/.pgpass file

- Create `~/.pgpass` with mode 600:

```text
<rds-endpoint>:5432:edgar_db:postgres:<your-password>
```

- Then use `DATABASE_URL=postgres://postgres@<rds-endpoint>:5432/edgar_db?sslmode=require`

1) Individual env vars

- POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD

The dev launcher (`start-dev.sh`) auto-loads `.env` then `.env.local` if present.
Backend accepts `sslmode` from URL `?sslmode=require` or env `PGSSLMODE`/`POSTGRES_SSLMODE`.
