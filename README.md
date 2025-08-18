# Edgar's Mobile Auto Repair Hub

[![CI/CD Pipeline](https://github.com/jesus-orduno/Edgars-mobile-auto-shop/actions/workflows/ci.yml/badge.svg)](https://github.com/jesus-orduno/Edgars-mobile-auto-shop/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/jesus-orduno/Edgars-mobile-auto-shop/graph/badge.svg?token=YOUR_CODECOV_TOKEN)](https://codecov.io/gh/jesus-orduno/Edgars-mobile-auto-shop)
[![Coverage Status](https://codecov.io/gh/jesus-orduno/Edgars-mobile-auto-shop/branch/main/graph/badge.svg)](https://codecov.io/gh/jesus-orduno/Edgars-mobile-auto-shop)

This repository contains the serverless backend for "Edgar's Mobile Auto Repair Hub," a conversational AI system for generating service quotes. The project is built entirely on AWS and managed via Terraform, demonstrating modern cloud architecture and DevOps practices.

## ⚠️ Critical Setup Step (Local Dev & Fresh Environments)

After the database is created and raw SQL/Alembic migrations have run, you MUST seed the service catalog or appointment service selection will be EMPTY (P0 outage condition for scheduling).

Seed now:

```bash
psql $DATABASE_URL -f backend/seeds/seed_s1.sql
```

Verification:

```bash
psql $DATABASE_URL -c "SELECT count(*) AS total, count(*) FILTER (WHERE is_active) AS active FROM service_operations;"
# Phase 2: endpoint now returns a flat array. Use length directly. (Add ?legacy=1 for temporary wrapped shape.)
curl -s http://localhost:3001/api/admin/service-operations | jq 'length'
```

### Service Catalog Response Header: `X-Catalog-Handler`

The `/api/admin/service-operations` endpoint now emits an `X-Catalog-Handler` header to make
runtime behavior observable during phased schema migrations or partial rollouts.

| Value | Meaning | Typical Scenario | Action Required |
|-------|---------|------------------|-----------------|
| `v2-flat` | Normal execution using full, current projection (includes new columns) | Healthy environment with up‑to‑date schema | None |
| `v2-flat-newcol` | Legacy projection failed due to renamed column; automatic retry using new column set succeeded | Rolling deploy where code with new name hits node missing old compatibility view | Ensure all nodes / DB migrations are up to date; harmless if transient |
| `v1-fallback` | Both primary projections failed; minimal legacy-safe subset returned (id, name, category, default_hours, default_price/base_labor_rate, is_active) | Drift / partial migration or hotfix scenario | Prioritize completing schema migration; monitor logs |
| `v2-empty` | Table missing (brand-new DB) so empty array returned gracefully | Fresh environment before seeding | Seed catalog immediately (see seeding steps above) |

Operational Notes:

* Any value other than `v2-flat` should be considered transitional; add a deployment check to alert if sustained > 5 minutes.
* Fallbacks are defensive; remove once all environments guarantee the new column set.
* The regression test `backend/tests/test_service_operations_fallback.py` covers the `v2-flat-newcol` retry path.


Example curl with headers:

```bash
curl -i http://localhost:3001/api/admin/service-operations | sed -n '1,15p'
```

Look for `X-Catalog-Handler: v2-flat` in healthy steady state.

Expected: > 0 total and active rows. If zero, re-run the seed.

The docker initialization now emits a WARNING if the `service_operations` table exists but is empty. Treat that as a blocking issue before using the app.


## Core Technologies

- **Cloud Provider:** AWS
- **Compute:** AWS Lambda (Python)
- **API:** Amazon API Gateway (HTTP API)
- **Database:** Amazon DynamoDB
- **Conversational AI:** Amazon Lex (planned integration)
- **Infrastructure as Code:** Terraform
- **CI/CD:** GitHub Actions

## 🎨 Design System & UI Standards

Edgar's Mobile Auto Shop uses a comprehensive **Typography and Spacing System** for consistent, maintainable UI development.

### 📖 **[Complete UI Standards Guide](docs/UI-Standards.md)**

Our design system features:

- **🔤 Typography Scale**: 7-level modular scale with CSS variables (`--fs-0` to `--fs-6`)
- **📐 Spacing System**: 8px base unit with micro-spacing support (`--sp-0` to `--sp-8`)
- **🛠 Utility Classes**: Tailwind-integrated design system classes
- **🎯 Real Examples**: Copy-paste code from actual components
- **✅ Automated Testing**: Validation tests ensure system compliance

### Quick Start Examples

```tsx
// Typography - Use design system scales
<h1 className="text-fs-5 font-bold">Page Title</h1>      {/* 32px */}
<h2 className="text-fs-3 font-semibold">Card Title</h2>  {/* 20px */}
<p className="text-fs-2">Body text content</p>           {/* 16px */}
<span className="text-fs-0 text-gray-500">Caption</span> {/* 12px */}

// Spacing - Consistent 8px grid system
<div className="p-sp-3 space-y-sp-2">     {/* 24px padding, 16px vertical spacing */}
  <button className="px-sp-4 py-sp-2">    {/* 32px horizontal, 16px vertical padding */}
    Action Button
  </button>
</div>
```

### Component Examples

| Component | Typography | Spacing | Example |
|-----------|------------|---------|---------|
| **Dashboard Cards** | `text-fs-3` titles, `text-fs-1` labels | `p-sp-3` padding, `gap-sp-2` | Revenue cards, stats displays |
| **Forms** | `text-fs-1` labels, `text-fs-2` inputs | `space-y-sp-4` fields, `p-sp-2` inputs | Login, appointment forms |
| **Navigation** | `text-fs-1` links | `px-sp-3 py-sp-2` items, `space-y-sp-1` | Sidebar, top navigation |
| **Buttons** | `text-fs-1` or `text-fs-2` | `px-sp-3 py-sp-2` standard | Action buttons, form submits |


### Development Benefits

- ✅ **Consistent Visual Hierarchy** across all components
- ✅ **Maintainable Codebase** with centralized design tokens
- ✅ **Developer Productivity** with clear guidelines and examples
- ✅ **Automated Quality Control** via linting and testing
- ✅ **Future-Proof** system for easy theme updates and scaling

**📋 [View the complete cheat sheet, migration guide, and real-world examples →](docs/UI-Standards.md)**

## � State Management (Frontend)

The legacy React context (AppointmentContext) has been fully replaced by a centralized **Zustand** store found in `frontend/src/state/useBoardStore.ts`.

### Why the Change?

- Simplifies data flow – one canonical source of truth for board columns & cards.
- Enables fine‑grained subscription (components re-render only for the slices they use).
- Supports optimistic updates with built‑in rollback for critical mutations.
- Easier to test – store actions are pure async functions that can be invoked directly.

### Core Concepts

| Concern | Where | Notes |
|---------|-------|-------|
| Canonical board data | `useBoardStore` state (`columns`, `cardsById`, `cardIds`) | Populated by `useBoardStoreInitializer()` bridging existing React Query fetch. |
| Derived / filtered cards | `selectFilteredCards` selector | Applies search, status, technician & date filters. |
| Optimistic mutations | `moveAppointment`, `assignTechnician` | Apply local change, call API, rollback + error on failure. |
| Filters | `filters` + `setFilters` | Pure client-side refinements. |
| Devtools | Enabled in development only | Zustand devtools middleware auto-attached when `NODE_ENV=development`. |

### Usage Pattern

```tsx
import { useBoardStore, selectFilteredCards } from '@/state/useBoardStore';

// Subscribe to derived cards
const cards = useBoardStore(selectFilteredCards);

// Invoke an optimistic mutation
const move = useBoardStore(s => s.moveAppointment);
await move(cardId, { status: 'IN_PROGRESS', position: 0 });
```

### Initialization

`<BoardStoreProvider>` (thin wrapper) mounts once near the application root and simply invokes `useBoardStoreInitializer(true)`, which:

1. Wires React Query's existing `useBoardData()` results into the store.
2. Mirrors loading & error state.
3. Replaces store contents whenever fresh data arrives.

### Testing

Store success & rollback behaviours are covered by targeted Vitest suites:

- `useBoardStore.move.success/rollback.test.ts`
- `useBoardStore.assignTechnician.success/rollback.test.ts`

These assert:

- State shape updates correctly after optimistic apply.
- API call contract (payload & endpoint) is respected.
- Rollback restores previous snapshot on thrown error.

### Devtools

The store now auto-enables Zustand devtools only in development builds (no runtime overhead in production bundles). Use your browser's Redux/Zustand extension to inspect actions & state diffs.

### Migration Status

✅ AppointmentContext removed. All consumers should now rely on the store & selectors.

If you still find `AppointmentProvider` references in feature branches, remove them and wrap your tree with `BoardStoreProvider` instead.

## �📋 Testing Framework

The project includes comprehensive testing infrastructure across multiple layers:

### Test Suites

- **Unit Tests**: Backend (pytest) and Frontend (Vitest)
- **Integration Tests**: End-to-end testing with Playwright
- **Cross-Browser Testing**: Chrome, Firefox, Safari support
- **Performance Tests**: Latency monitoring for critical endpoints
- **Accessibility Tests**: Automated a11y compliance checks

### Running Tests

```bash
# All tests
npm test

# Specific test suites
npm run test:backend     # Backend unit tests
npm run test:frontend    # Frontend unit tests
npm run test:e2e         # End-to-end tests
npm run test:browsers    # Cross-browser tests
npm run test:perf        # Performance smoke tests
```

### CI/CD Integration

All tests run automatically on pull requests and main branch pushes. Performance tests enforce a P95 latency threshold of 500ms for critical endpoints, failing the build if exceeded.

#### Coverage Gate

The CI pipeline enforces strict coverage thresholds to prevent regressions:

- **Lines**: 80% minimum
- **Branches**: 80% minimum
- **Functions**: 80% minimum
- **Statements**: 80% minimum

Any pull request that drops coverage below these thresholds will fail the "Coverage Check" step. Coverage reports are automatically uploaded as downloadable artifacts and to Codecov for detailed analysis.

---

## 🧱 Database Migrations (Raw SQL + Alembic)

Two complementary layers manage schema changes:

1. **Alembic (Python)** — Versioned migrations under `backend/migrations/versions/`.
2. **Raw Idempotent SQL** — Timestamped `*.sql` files directly inside `backend/migrations/` (excluding `versions/`).

### Raw SQL Migration Runner

`backend/run_sql_migrations.py` runs automatically inside `./start-dev.sh` after PostgreSQL is healthy. It:

- Applies pending `.sql` files in lexical order.
- Records applied files in `migration_sql_history`.
- Is idempotent; duplicate-object errors in legacy unguarded files are tolerated and marked applied.

### Add a New Raw Migration

1. Create: `backend/migrations/20250815_005_add_customer_indexes.sql`.
2. Make idempotent (`IF NOT EXISTS`, or guarded `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`).
3. Run `python backend/run_sql_migrations.py` or restart with `./start-dev.sh`.

### Check Applied Migrations

```bash
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB \
  -c "SELECT filename, applied_at FROM migration_sql_history ORDER BY applied_at;"
```

### Alembic Commands

```bash
cd backend
make alembic-rev m="add new table"
make alembic-up
```

### CI (Recommended)

Add before backend tests:

```bash
python backend/run_sql_migrations.py
```

### Choose the Right Tool

| Scenario | Raw SQL | Alembic |
|----------|---------|---------|
| Simple additive column / index | ✅ | ✅ |
| Complex data transform / Python logic | ❌ | ✅ |
| Rapid prototype | ✅ | ❌ |
| Need downgrade path | ❌ | ✅ |

### Future Improvements

- Harden any remaining legacy files (explicit guards).
- Remove duplicate-object heuristic once all are guarded.
- Enforce runner success as CI gate.

---

## 🧪 E2E Test Harness Pattern

Certain complex UI flows (for example, the appointment message thread with template selection and optimistic send / retry logic) were historically difficult to validate inside the full admin dashboard context because of unrelated layout concerns, auth timing, or board data dependencies. To make these flows deterministic and fast to test we introduced a lightweight, DEV‑only “test harness” route.

### What Is a Harness?

An isolated page whose single responsibility is to mount one target component with minimal surrounding providers. It:

- Avoids unrelated dashboard rendering / data polling
- Lets Playwright stub just the network calls the component cares about
- Provides stable `data-testid` hooks
- Keeps auth optional (we seed a token globally, but the harness does not require it)

### Current Harnesses

| Route | File | Purpose |
|-------|------|---------|
| `/e2e/message-thread/:appointmentId` | `frontend/src/pages/e2e/MessageThreadHarness.tsx` | Isolates `MessageThread` for template send success & failure/retry specs |

The route is only registered when `import.meta.env.DEV` is true so it will never ship in production bundles.

### Implementation Snapshot

`App.tsx` (excerpt):

```tsx
{import.meta.env.DEV && (
  <Route element={<Suspense fallback={<div>Loading...</div>}><Outlet /></Suspense>}>
    <Route path="/e2e/message-thread/:appointmentId" element={<MessageThreadHarness />} />
  </Route>
)}
```

`MessageThreadHarness.tsx`:

```tsx
export default function MessageThreadHarness() {
  const apptId = window.location.pathname.split('/').pop() || 'e2e-appt-1';
  return (
    <div data-testid="message-thread-harness">
      <MessageThread appointmentId={apptId} drawerOpen={true} />
    </div>
  );
}
```

### Playwright Usage Pattern

In the relevant spec (e.g. `e2e/messageTemplates.send.spec.ts`):

1. Navigate directly to the harness route (`page.goto('/e2e/message-thread/apt-123')`).
2. Intercept only the endpoints used by `MessageThread` (template list, create message, failure simulation, etc.).
3. Assert optimistic UI updates (pending state) then final success or retry path.

### Adding a New Harness

1. Create a page in `frontend/src/pages/e2e/YourHarness.tsx` that mounts the component.
2. Add a DEV‑guarded route in `App.tsx`.
3. Expose a root container with a stable `data-testid`.
4. Write a focused Playwright spec that only stubs the component’s network surface.
5. (Optional) Document the harness here once stabilized.

### When NOT to Use a Harness

- For simple flows already stable in the integrated UI.
- When verifying true multi-component orchestration (use full-page spec instead).
- If the component’s correctness depends on global layout interactions.

This pattern keeps broad regression coverage (full dashboard specs) while letting fragile, stateful widgets have precise, inexpensive tests.

---

## Architecture

The system is designed as a serverless, event-driven architecture. The initial implementation provides a core RESTful API for quote generation.

```mermaid
graph TD
    subgraph "User Interaction"
        Client[Web/Mobile Client]
    end

    subgraph "AWS Cloud"
        API_GW[API Gateway: POST /quote]
        Lambda[Lambda: QuoteFunction]
        DDB[DynamoDB: EdgarQuotes Table]
    end

    Client -- HTTPS Request --> API_GW
    API_GW -- Invokes --> Lambda
    Lambda -- Writes to --> DDB
