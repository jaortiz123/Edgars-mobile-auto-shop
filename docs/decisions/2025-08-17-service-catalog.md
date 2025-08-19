# Decision Record: Service Catalog Build vs Defer

Date: 2025-08-17
Status: Proposed (awaiting stakeholder acknowledgment)
Owner: Engineering

## Context / Goal
Determine whether to invest engineering time now to enrich and productize the `service_operations` catalog (data seeding, categorization, search semantics, UI grouping, advanced attributes) or to document current state and defer until real business demand is evidenced.

## Collected Evidence (Raw Facts)

1. Database state
   - Table `service_operations` exists with rich schema: `id, name, category, keywords TEXT[], default_hours NUMERIC, default_price NUMERIC, flags TEXT[], is_active, replaced_by_id, labor_matrix_code, skill_level, created_at, updated_at`.
   - Dev database row count: **0** (completely empty).
   - Indices / columns already support future complexity (categories, skill levels, synonyms/keywords, deprecation via replaced_by_id) — no new columns needed for foreseeable MVP.

2. Frontend usage
   - Service fetch points & types: `frontend/src/lib/api.ts`, `frontend/src/hooks/useServiceOperations.ts` (simple cache), `ServiceCatalogModal.tsx`, `AppointmentForm.tsx` (shows `s.category` only if present).
   - Modal currently flattens list; optional category only conditionally rendered — no grouping or filtering logic implemented beyond name substring search.
   - Tests (e.g. `ServiceCatalogModal.test.tsx`, `QuickAddModal.multiServices.test.tsx`) stub minimal objects: rely only on `id`, `name`, optional `default_price`, `category`.
   - No code paths exercise `keywords`, `skill_level`, `labor_matrix_code`, `flags` today.

3. Search / discovery
   - Current client search appears to be a simple front-end substring filter of fetched rows (or backend endpoint returns filtered list) — no weighting or synonyms implemented.
   - Lack of data makes evaluating search quality impossible now.

4. Business signal (limitations)
   - No production dataset or ticket references available in this workspace; cannot cite user complaints about missing / ambiguous services.
   - With zero rows, any “improvement” work risks speculative over-design.

5. Risk & cost
   - Up‑front modeling of categories, keywords, skill levels without live usage data risks churn (renames, merges, re-seeding migrations).
   - Adding faux or guesswork seed data can pollute analytics and mislead stakeholders.

## Problem Framing
We have an *empty* yet *over-specified* schema. Real problem today is absence of authoritative seed data, not lack of structure. Engineering effort should first demonstrate **actual demand** (frequency of multi-service selection, need for categorization, search failures) before enriching.

## Options Considered

| Option | Summary | Pros | Cons |
|--------|---------|------|------|
| A. Full build now | Populate large curated catalog, implement grouping, advanced search | Future-ready, “looks complete” | High speculation, rework risk, time cost, blocks other priorities |
| B. Minimal seed (micro set) | Insert 5–10 core services only (name + optional category) to unblock demos/testing | Fast, low churn, enables observing real selections | Still speculative naming; might bias later taxonomy |
| C. Defer (document + trigger conditions) | Leave table empty; add decision doc & lightweight instrumentation plan | Zero cost now; avoids waste; clarity on readiness criteria | Some UI flows may appear sparse until data arrives |

## Recommendation
Adopt **Option C (Defer)** with a narrow readiness checklist. Move to Option B once at least two of the readiness triggers fire.

## Readiness Triggers (Any 2 ⇒ seed minimal catalog)

1. Product / ops supplies a vetted initial list of top N recurring services sourced from real invoices or customer requests.
2. Support / sales logs ≥ X (suggest: 5) instances of manual free‑text “service” entry uncertainty or mis-selection in a two‑week window.
3. Analytics or logs show users opening the Service Catalog modal and abandoning without selection ≥ Y% (suggest: >40%) across at least 50 sessions.
4. Need to price standard services automatically (requires `default_price` non-null on ≥ 5 entries).

## Minimal Seed (When Triggered)

Insert only these fields per row initially:

- id (UUID)
- name (human readable; no forced canonical slugs yet)
- category (coarse: e.g. “Maintenance”, “Diagnostics”, “Repair”); optional if uncertain
- default_price (only where confidently standardized; else null)
- is_active (true)

Defer until Phase 2:

- keywords, skill_level, labor_matrix_code, flags
- Deprecation lineage (`replaced_by_id`)
- Pricing matrices or hours defaults beyond essential cases

## Instrumentation / Data Collection Plan

Add lightweight metrics before seeding:

1. Count of modal opens vs selections (baseline adoption).
2. Distribution of raw free‑text service names entered elsewhere (if any) to cluster candidate canonical names.
3. Error / empty result rate for search queries (indicates need for synonyms / taxonomy).

## Risks of Deferral & Mitigations

| Risk | Mitigation |
|------|------------|
| Stakeholders perceive lack of progress | Share this decision record & explicit triggers; show working selection UI with stubbed data in tests |
| Engineers hand-roll ad-hoc service names elsewhere | Add lint / review note: use catalog once seeded; centralize creation path |
| Later seeding causes migration complexity | Schema already sufficient — no new migrations expected for minimal seed |

## Success Criteria (Post-Seed)

After seeding minimal set, we consider catalog “healthy enough” if within 2 sprints:

1. ≥ 70% of new appointments attach at least one seeded service.
2. ≤ 15% of service selections require free‑form “Other” fallback (if such a mechanism is added).
3. No more than 5% of selected services need renaming (stability signal).

## Immediate Actions (Low Effort, High Clarity)

1. Merge this decision record (creates shared artifact; avoids oral history loss).
2. Add TODO note near `ServiceCatalogModal` explaining current intentional minimalism & linking here.
3. (Optional) Implement metric counters (modal open / selection) behind a feature flag.

## Explicit Non-Goals (For Now)

- Building an admin UI for service management.
- Implementing fuzzy / weighted search or synonym expansion.
- Attaching labor skill matrices or dynamic pricing logic.
- Multi-level hierarchical categories.


## Review Cadence

Revisit in 4 weeks or earlier if a readiness trigger fires; update this doc with outcome & next steps.


## TL;DR

Schema is already rich but totally empty; without real service usage data any enrichment is speculative. Document & defer. Seed only after concrete demand signals appear.
