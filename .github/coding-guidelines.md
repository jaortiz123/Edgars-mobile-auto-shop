# Copilot Code Review Guidelines

Use this guide to provide feedback on code changes:

## Python / Flask
- Validate and sanitize inputs; use parameterized queries only
- Enforce RBAC on admin endpoints
- Use JSON error envelopes consistently
- Structured JSON logging with request_id; avoid PII
- Handle HTTPException and unexpected exceptions appropriately

## SQL
- Use explicit column lists
- Index columns used in filters and sorts (e.g., start_ts, status, tech_id)
- Use UTC for all date/time operations
- Stable ordering for pagination (start_ts, id)

## Migrations
- Use Alembic for schema changes
- Include both upgrade and downgrade
- Validate backfill and index creation

## Frontend / React
- Strict TypeScript (avoid `any`)
- Accessible components (ARIA, labels, focus states)
- Centralized API layer with error normalization
- Optimistic updates with rollback and toast notifications

## Testing
- Backend: pytest for happy, empty, invalid, error cases; use fixtures for fake DB
- Frontend: RTL + vitest + jest-axe for unit & accessibility tests

## Performance & Security
- Rate limit mutation endpoints
- Audit SQL for injection risks
- Verify indexes support query patterns
- Review performance impact of queries

## Commit Message Guidelines
- Use imperative, concise commit headers (e.g., `fix(api): validate cursor parsing`)
- Include a brief description of why and what changed
- Reference issues in the footer (e.g., `Closes #123`)
- Add a `Risk` and `Rollback` note when applicable

## Pull Request Checklist
- Problem / intent clearly described
- List of changes with bullet points
- Tests added or updated with commands to run
- Documentation updated (API.md, SCHEMA.md, coding-guidelines.md)
- Verified migrations in dev (`alembic upgrade head`, `make check-migration`)
- No high-severity lint or test failures
- Self-reviewed against the coding-guidelines
