# Migrate sequential integer IDs to opaque UUIDs to mitigate IDOR risk

## Summary

- Risk: Several externally referenced resources use incremental integer IDs. While RLS mitigates cross-tenant access at the DB layer, guessable IDs remain a defense-in-depth concern (IDOR/A01:2021).

## Scope

- Affected entities: customers, vehicles, appointments (and FKs).

## Approach

- Introduce UUID primary keys for new rows (uuid_generate_v4 or application-level UUIDs).
- Add parallel uuid columns with NOT NULL default for entities; backfill existing rows.
- Update foreign keys to reference UUIDs; maintain integer IDs for internal joins temporarily.
- Add unique indexes and ensure RLS policies reference tenant_id as today.
- Add application mappers to accept either id or uuid during transition; prefer uuid in URLs and API payloads.
- Plan phased rollout: dual-write + read-by-uuid, then cutover, then remove int IDs from external surfaces.

## Migration Steps (high-level)

1) DB: add uuid columns + defaults + unique indexes.
2) DB: backfill uuids and validate counts.
3) App: surface uuids in read APIs; accept uuids in write APIs.
4) Clients: update to use uuids exclusively for external references.
5) DB/App: drop public exposure of integer IDs; keep ints internal or remove if feasible.

## Operational

- Create feature flag to gate UUID-only routing.
- Update tests and fixtures to use UUIDs.

## Links

- OWASP IDOR: [https://owasp.org/www-community/attacks/IDOR](https://owasp.org/www-community/attacks/IDOR)
