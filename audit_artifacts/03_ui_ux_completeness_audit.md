# 🎨 UI/UX Completeness Audit

**Deliverable**: Save/export this document as `03-ui-ux-completeness-audit.md`

**Repo**: `<project_root>`
**Commit SHA**: `<fill>`
**Auditor**: `<your_name>`
**Date**: 2025‑09‑06

---

## 0) Objectives & Success Criteria
**Goal:** Ship a UI that never leaves the user stuck. Every critical flow has clear **loading**, **empty**, **success**, **error**, **permission‑denied**, and **offline** states. Accessibility meets **WCAG 2.2 AA**. Performance meets Core Web Vitals.

**Done means:**
- All critical screens implement a **State Matrix** (below) with tests.
- Forms validate on client and server; errors are accessible and actionable.
- App is responsive from **320px → 1920px+** with no layout traps.
- Accessibility scanners show **0 serious/critical** issues; manual checks pass.
- Core Web Vitals (mobile, 4G): **LCP ≤ 2.5s**, **INP ≤ 200ms**, **CLS ≤ 0.1**.

---

## 1) System Inventory & Discovery
Map what exists before judging quality.

### 1.1 Quick Code Searches (collect evidence)
```bash
# Incomplete states markers
rg -n --hidden --no-ignore -S "TODO|FIXME|disabled\\s*=\\s*{?true}?|//\s*@ts-ignore" frontend | tee audit_artifacts/ui_todos.txt

# Components that likely represent UX states
rg -n "Skeleton|Spinner|Toast|Snackbar|ErrorBoundary|EmptyState" frontend | tee audit_artifacts/ui_state_components.txt

# Accessibility hotspots
rg -n "dangerouslySetInnerHTML|innerHTML\\s*=|role=|aria-|tabIndex=|autofocus|title=\\{" frontend | tee audit_artifacts/a11y_hotspots.txt

# Headings and landmarks
rg -n "<h1|<main|<nav|<header|<footer|<section|<aside" frontend | tee audit_artifacts/landmarks.txt

# Routing and guards
rg -n "<Route|createBrowserRouter|NextRoute|useRoutes|ProtectedRoute" frontend | tee audit_artifacts/routes.txt
```

### 1.2 Route & Screen Inventory (fill)
Export a list of user‑facing routes/screens and bind them to state coverage.

| Route / Screen | Critical Flow? | Has Loading | Has Empty | Has Error | Permission‑Denied | Offline | Mobile OK | Notes |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `/login` | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |  |
| `/dashboard` | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |  |

Save as `audit_artifacts/route_state_matrix.csv`.

---

## 2) Automated Scans & Budgets
Attach all reports under `audit_artifacts/`.

### 2.1 Accessibility
```bash
# ESLint + jsx-a11y (CI gate)
npm i -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-jsx-a11y
npx eslint "frontend/**/*.{ts,tsx}" -f json -o audit_artifacts/eslint_a11y.json || true

# jest-axe for component/state tests
npm i -D jest-axe @testing-library/react @testing-library/jest-dom
# (wire into existing Jest tests)

# Pa11y CI (URL sweeps)
npm i -D pa11y pa11y-ci
pa11y-ci --sitemap http://localhost:3000/sitemap.xml --reporter json > audit_artifacts/pa11y.json || true

# Storybook a11y (if used)
npm i -D @storybook/addon-a11y @storybook/test-runner axe-playwright
```

**Pass/Fail bar:** 0 serious/critical axe violations across templates and core screens.

### 2.2 Performance (Core Web Vitals)
```bash
# Lighthouse CI
npm i -D @lhci/cli
lhci autorun --collect.settings.preset=desktop --collect.numberOfRuns=3 \
  --upload.target=filesystem --upload.outputDir=audit_artifacts/lhci_desktop || true
lhci autorun --collect.settings.preset=mobile --collect.numberOfRuns=3 \
  --upload.target=filesystem --upload.outputDir=audit_artifacts/lhci_mobile || true

# Bundle analysis (Vite/Webpack)
npm i -D source-map-explorer
npx source-map-explorer "frontend/dist/assets/*.js" --json > audit_artifacts/bundle_explorer.json || true
```

**Budgets (critical path):** JS ≤ **200 KB** gz, CSS ≤ **50 KB** gz, images optimized, font subsets.

### 2.3 Cross-Browser / Device
```bash
# Playwright grid (mobile + desktop)
npx playwright install --with-deps
npx playwright test --project=chromium --project=webkit --project=firefox
```

---

## 3) Manual Review Checklists (mark ✅/❌ + notes)

### 3.1 State Coverage
- ☐ **Loading**: skeletons where helpful; spinners < 300ms only if needed.
- ☐ **Empty**: clear explanation + primary CTA; no “blank abyss.”
- ☐ **Success**: visible confirmation (toast/badge/redirect) with undo when safe.
- ☐ **Error**: friendly message, retry, error code, correlation ID logged.
- ☐ **Permission‑Denied (403)**: explain who to contact; no silent redirect.
- ☐ **Offline**: cached shell + reconnect banner; queue mutations or disable safely.

### 3.2 Forms
- ☐ Labels tied via `htmlFor`; `aria-describedby` points to error text.
- ☐ Client + server validation with identical rules/messages.
- ☐ Submit disabled while pending; no double‑submission.
- ☐ Preserve entered data on error; focus moves to first invalid field.
- ☐ Error copy tells the user what to do next.

### 3.3 Navigation & Routing
- ☐ Deep links work; refresh safe.
- ☐ `404` and `403` pages exist.
- ☐ Protected routes gate and preserve intended destination (`returnTo`).

### 3.4 Responsiveness & Layout
- ☐ Breakpoints cover xs/sm/md/lg/xl; no horizontal scroll on mobile.
- ☐ Tap targets ≥ 44×44px; hit areas padded; sticky footers don’t hide content.
- ☐ `meta viewport` correct; respects iOS safe area; keyboard does not block inputs.

### 3.5 Accessibility (WCAG 2.2 AA)
- ☐ Color contrast ≥ 4.5:1 text; ≥ 3:1 for large text/icons.
- ☐ Focus **visible** everywhere; logical tab order; no traps.
- ☐ Semantic landmarks: `main`, `nav`, `header`, `footer`.
- ☐ Headings hierarchical (one `<h1>` per screen).
- ☐ Images have descriptive `alt`; decorative use empty alt.
- ☐ Live updates use `aria-live` (`polite` for toast/info, `assertive` for critical).
- ☐ Motion respects `prefers-reduced-motion`.

### 3.6 Content & i18n
- ☐ No hard‑coded user‑visible strings (use i18n).
- ☐ Dates/numbers localized; pluralization correct.
- ☐ RTL layouts render correctly (smoke test at least primary pages).

### 3.7 Telemetry & Debuggability
- ☐ UX events named consistently (`ui.<area>.<action>`).
- ☐ Error boundaries log to Sentry with user/tenant context and trace ID.
- ☐ Feature flags drive experimental UI; flags are server‑authoritative.

---

## 4) State Matrix Templates
Use this as the **authoritative spec** per screen.

### 4.1 Screen State Matrix (example)
| Screen: `AppointmentsList` | Idle | Loading | Empty | Success | Error | 403 | Offline |
|---|---|---|---|---|---|---|---|
| Visual | list | skeleton | illustration + CTA | toast | inline alert | lock icon + help text | offline banner |
| Actions | filter | disabled | “Create appointment” | undo | retry | request access | retry sync |
| Telemetry | view | n/a | view_empty | success_event | error_event | forbidden_view | offline_view |

Export one per critical screen to `audit_artifacts/state_matrices/*.csv`.

---

## 5) Tests to Add (minimum set)

### 5.1 Component/Unit (React + Testing Library)
```tsx
it('announces validation errors accessibly', async () => {
  render(<BookingForm />)
  await user.click(screen.getByRole('button', { name: /submit/i }))
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(/required/i)
  expect(alert).toHaveAttribute('aria-live', 'assertive')
})

it('shows EmptyState with CTA when no data', async () => {
  server.use(rest.get('/api/appointments', (_, res, ctx) => res(ctx.json([]))))
  render(<AppointmentsList />)
  expect(await screen.findByText(/no appointments yet/i)).toBeInTheDocument()
})
```

### 5.2 E2E (Playwright)
- Mobile viewport 390×844 and desktop 1366×768 for each critical flow.
- Assertions for: loading skeleton within 100ms; error retry works; offline banner on network drop (`context.setOffline(true)`).

### 5.3 Accessibility Tests
- `jest-axe` on shared page templates and complex widgets.
- Axe/Pa11y sweeps must report 0 serious/critical.

### 5.4 Visual Regression
- Storybook + Chromatic **or** Playwright screenshot diffs for critical components.

---

## 6) Helper Scripts (drop‑in)

### 6.1 Missing State Heuristic (React)
```bash
# Components that fetch but don't obviously render loading/error
rg -n "use(Query|SWR|Effect).*fetch|axios\.|fetch\(" frontend | tee audit_artifacts/fetchers.txt
rg -n "(Skeleton|Spinner|Error|Empty|Toast)" frontend | tee audit_artifacts/state_widgets.txt
# Manually diff lists to spot components missing state widgets
```

### 6.2 Axe Smoke via Playwright
```ts
// tests/a11y.smoke.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const routes = ['/', '/login', '/dashboard', '/appointments']

for (const route of routes) {
  test(`a11y: ${route}`, async ({ page }) => {
    await page.goto(route)
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(v => ['serious','critical'].includes(v.impact))
    expect(serious, JSON.stringify(serious, null, 2)).toHaveLength(0)
  })
}
```

### 6.3 Lighthouse Budget (lighthouserc.json)
```json
{
  "ci": {
    "collect": { "numberOfRuns": 3, "settings": { "preset": "mobile" } },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "byte-efficiency/total-byte-weight": ["error", { "maxNumericValue": 300000 }],
        "uses-responsive-images": "warn",
        "uses-text-compression": "error",
        "unused-javascript": ["warn", { "maxNumericValue": 150000 }]
      }
    }
  }
}
```

---

## 7) Design System & Tokens
- Centralize spacing, color, typography tokens; enforce via ESLint style rules.
- Dark mode respects contrast; no pure black on OLED; respect reduced motion.
- Interactive components (modals, menus, comboboxes) follow WAI‑ARIA patterns.

---

## 8) Risk Scoring & Prioritization
- **Critical:** Missing error boundaries on async pages; no state coverage for critical flows; inaccessible forms preventing submission.
- **High:** Poor mobile layout; unreadable contrast; broken keyboard nav; uncontrolled toasts (not announced).
- **Medium:** Inconsistent empty states; confusing copy.
- **Low:** Cosmetic inconsistencies, minor spacing/typography drift.

Prioritize by **Risk (Likelihood×Impact)** then **Effort (S/M/L)**.

---

## 9) Remediation Plan (example)
- **Day 1–2:** Implement ErrorBoundary provider + screen‑level fallbacks; wire Sentry.
- **Day 3:** Add state coverage (loading/empty/error) to top 5 flows.
- **Day 4:** Axe/Pa11y fixes; form a11y (labels, errors, focus).
- **Day 5:** Lighthouse + bundle diet; defer non‑critical JS; image optimization.

---

## 10) CI Enforcement
- CI fails on **axe serious/critical > 0** across smoke routes.
- CI enforces Lighthouse budgets; bundle explorer threshold.
- PR template requires updated State Matrix + tests for any new screen.

---

## 11) Reviewer Checklist (PR Gate)
- ☐ State Matrix complete for the screen.
- ☐ Form errors are announced and focus is managed.
- ☐ Mobile layout verified; no horizontal scroll.
- ☐ Axe scan clean; color contrast checked.
- ☐ Telemetry/events added; error boundary wired.

---

## 12) Findings Summary (fill at the end)
- **Critical:** `<count>`
- **High:** `<count>`
- **Medium:** `<count>`
- **Low:** `<count>`

Top issues & owners:
1) `<UI‑XXX – title>` — Owner: `<name>` — ETA: `<date>`
2) `<UI‑XXX – title>` — Owner: `<name>` — ETA: `<date>`

---

## 13) Sign‑off
- Design: `<name>`
- Frontend Lead: `<name>`
- Product: `<name>`

> Attach all `audit_artifacts/*.json|.txt|.csv` and this markdown in the PR or release package.
