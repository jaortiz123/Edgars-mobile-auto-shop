# FRONTEND.md— Edgar’s Mobile Auto Shop (Admin)

**Date:** 2025‑07‑25
**Owner:** Jesus
**Scope:** Admin app for Sprints 1–3. Customer‑facing screens are referenced only where relevant.

> **Mantra:** **Calendar first, Board next, Drawer always.** Fast, appointment‑centric UI. Minimal context switches. Keyboard‑friendly with optimistic updates.

---

## 1. Overview & Architecture

### 1.1 Technology Stack

* **React 18** with function components & hooks
* **TypeScript** strict mode
* **Vite** build
* **Tailwind CSS** for utility‑first styling
* **React Router** (if routing used) — admin only
* **Optional:** React DnD / dnd-kit for board drag‑and‑drop; dayjs/date‑fns for dates

### 1.2 Design Philosophy

* **Appointment‑centric:** everything starts from the appointment.
* **Drawer‑first:** all actions available without navigating away.
* **Dual‑view:** operators can operate from **Calendar** or **Status Board**; parity for status moves.
* **Mobile‑friendly:** touch targets ≥ 44px, large hit areas, sticky actions.
* **Accessibility:** keyboard path for every interaction; high contrast, reduced motion support.

### 1.3 Project Structure

```
src/
  admin/
    Dashboard.tsx                 # Calendar ↔ Board switcher, stats, filters
    AdminAppointments.tsx         # Calendar host
    Customers.tsx                 # (S2) open drawer from rows
  components/
    admin/
      AppointmentCalendar.tsx
      StatusBoard.tsx
      StatusColumn.tsx
      AppointmentCard.tsx
      AppointmentDrawer.tsx       # Tabs: Overview · Services · Messages · History
      DashboardStats.tsx
      CarsOnPremisesWidget.tsx
      JobDetailTabs/
        ServicesTab.tsx           # (S2 CRUD)
        MessagesThread.tsx        # (S2)
        InspectionsTab.tsx        # (S3)
        PaymentPanel.tsx          # (S3 in Overview)
    ui/
      Button.tsx  Badge.tsx  Tabs.tsx  Toast.tsx  Skeleton.tsx  Input.tsx  Select.tsx  Toggle.tsx  Modal.tsx
  contexts/
    AppointmentContext.tsx        # date range, filters, board/calendar preference
  lib/
    api.ts                        # S1 endpoints (board, drawer, stats, patch)
    dates.ts                      # helpers for TZ, formatting, ranges
    toast.ts                      # thin wrapper around Toast.tsx
  types/
    models.ts                     # shared TS interfaces (optional split later)
```

### 1.4 Build & Env

* **Env vars** via Vite: `VITE_API_BASE` (optional), feature flags (`VITE_FF_*`) if needed.
* **Prod optimizations:** code‑split Drawer & Board, prefetch next routes, tree‑shake icons.
* **Deployment:** static hosting (S3 + CloudFront / Vercel / Netlify). Cache immutable assets with long TTL; HTML short TTL.

---

## 2. Core Components

### 2.1 Component Hierarchy (S1)

```
Dashboard
├─ ViewSwitcher (Calendar | Board)
├─ Filters (date range, tech, search)
├─ DashboardStats (KPIs)
└─ MainView
   ├─ AppointmentCalendar → onSelect(appointmentId) → AppointmentDrawer
   └─ StatusBoard
      ├─ StatusColumn × N
      │  └─ AppointmentCard × M (DnD)
      └─ AppointmentDrawer (portal)
```

### 2.2 Shared/UI Components

* **Button** — sizes: `sm, md`; variants: `primary, secondary, ghost, danger`.
* **Badge** — status pills.
* **Tabs** — roving tabindex, `aria-selected`, `role="tablist"`.
* **Modal** — focus trap, `Esc` to close.
* **Toast** — success/error/neutral, optional CTA link.
* **Skeleton** — blocks & lines; used for drawer and board loading.
* **Input/Select/Toggle** — labeled controls with help text and error slot.

### 2.3 Feature Components

* **AppointmentCalendar** — day/week/month; drag to reschedule (future), click to open Drawer.
* **StatusBoard** — columns for `SCHEDULED, IN_PROGRESS, READY, COMPLETED, NO_SHOW`; horizontal scroll when overflow.
* **AppointmentCard** — compact summary: time, customer, vehicle, price, tags; drag handle + overflow menu.
* **AppointmentDrawer** — right panel \~420–480px. Tabs: **Overview, Services, Messages, History**. Keyboard accessible.
* **DashboardStats** — tiles fed by `/admin/dashboard/stats`.
* **CarsOnPremisesWidget** — list of checked‑in vehicles with since‑time and filter by tech.

---

## 3. State Management

### 3.1 Contexts

* **AppointmentContext**

  * `view: 'calendar' | 'board'`
  * `dateRange: { from: string; to: string }` (ISO UTC)
  * `filters: { status?: AppointmentStatus; techId?: string; q?: string }`
  * `setters` to persist to `localStorage` (`view`, last filters).

> Keep it light. No Redux. Derived state lives in components/hooks.

### 3.2 Data Fetching

* Thin `api.ts` with `http<T>()` wrapper.
* **Board:** fetch once per range/filter; optimistic updates on move; refetch on failure.
* **Drawer:** fetch on open; keep cached until appointment or filters change.
* **Stats:** refetch every 60s (poll) or on mutation success (status, payment, services).

### 3.3 Optimistic Updates

Example reducer for board card move:

```ts
type MovePayload = { id: string; from: AppointmentStatus; to: AppointmentStatus; position: number };
function optimisticMove(cards: BoardCard[], p: MovePayload): BoardCard[] {
  // remove from old
  const without = cards.filter(c => c.id !== p.id);
  // insert into new
  const moved = cards.find(c => c.id === p.id);
  if (!moved) return cards; // safety
  const updated: BoardCard = { ...moved, status: p.to, position: p.position };
  const target = without.filter(c => c.status === p.to);
  const others = without.filter(c => c.status !== p.to);
  target.splice(p.position - 1, 0, updated);
  // reassign positions in target
  const normalized = target.map((c, i) => ({ ...c, position: i + 1 }));
  return [...others, ...normalized];
}
```

On error, revert to snapshot and show toast.

### 3.4 Error Handling

* Network/API errors surface via `toast.error()` with a human message and a **Retry** action.
* Show details in console for developers.
* Semantic codes map to guidance (see **API.md** error model).

---

## 4. Routing & Navigation

* **Admin routes** only (customer portal separate app/page).
* Example (React Router):

```
/admin
  ├─ /dashboard        → Dashboard (Calendar|Board)
  ├─ /customers        → Customers (S2)
  └─ /reports          → Reports (S2)
```

* Drawer opened by state, not route, to keep flow. If deep‑linking is required later, support `/admin/appointments/:id` which opens the drawer on load.

---

## 5. Authentication & Authorization

* JWT stored in **HTTP‑only cookie** (preferred). If using header tokens, store in memory only, never localStorage.
* On app mount, call `/api/me` to get `user` and `flags` and hydrate guards.
* **Guards in UI**

  * Hide actions the role cannot perform.
  * Still expect **403/404** from server; show toast on denial.
* **Roles**: `Owner, Advisor, Tech, Accountant` (see **API.md** matrix).

---

## 6. Admin Dashboard Details

### 6.1 Calendar

* **Views:** Day, Week, Month.
* **Timezone:** display **shop local time** (America/Los\_Angeles). Store ISO UTC. Use helpers:

```ts
export function toUtcISO(d: Date) { return d.toISOString(); } // source of truth
export function formatLocal(ts: string) {
  return new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
}
```

* **Rendering:** virtualize if event counts are high. Ensure accessible focus when navigating days.
* **Interaction:** click event → open Drawer. (Drag‑to‑resize/reschedule deferred.)

### 6.2 Status Board

* Columns: `SCHEDULED, IN_PROGRESS, READY, COMPLETED, NO_SHOW` (no `CANCELED`).
* Each column shows **count** and **sum** (price) from board response.
* **DnD:** dnd‑kit recommended. Keyboard alternative via **Move to…** menu.
* **Virtualization:** use `react-virtual` per column when >100 cards.

### 6.3 Appointment Drawer

* Width **420–480px**, overlay modal on mobile.
* **Tabs**

  * **Overview:** customer + vehicle, status control, time, totals, fast actions.
  * **Services:** S1 read‑only; S2 CRUD lines with inline totals.
  * **Messages:** S2 thread with delivery chips; composer at bottom.
  * **History:** last 5 appointments + lifetime value.
* **Fast actions in header:** `Send Msg`, `Mark In Progress`, `Mark Ready`, `Complete`, `No‑Show`.
* **Focus management:** trap focus; `Esc` closes; return focus to trigger.

### 6.4 Next Appointment Widget (fix spec)

Rules to compute **Next**:

1. Filter appointments where `status IN ('SCHEDULED','IN_PROGRESS','READY')` and `start >= now()`.
2. Sort by `start` ascending. If tie, prioritize `IN_PROGRESS` > `READY` > `SCHEDULED`.
3. Exclude `CANCELED` and `NO_SHOW`.
4. Display: time range (local), customer name, vehicle, status pill. Provide **Start Now** action for `SCHEDULED` -> `IN_PROGRESS`.

Pseudo:

```ts
function nextAppointment(apts: Appointment[], nowISO: string) {
  const p = new Date(nowISO).getTime();
  const rank: Record<AppointmentStatus, number> = {
    IN_PROGRESS: 0, READY: 1, SCHEDULED: 2, COMPLETED: 9, NO_SHOW: 9, CANCELED: 9
  } as any;
  return apts
    .filter(a => (a.status === 'SCHEDULED' || a.status === 'IN_PROGRESS' || a.status === 'READY') && Date.parse(a.start) >= p)
    .sort((a,b) => Date.parse(a.start) - Date.parse(b.start) || rank[a.status] - rank[b.status])[0] || null;
}
```

---

## 7. UI / UX Patterns

### 7.1 Design Tokens

```ts
export const colors = {
  bg: {
    base: '#0F172A',        // slate‑900 (suggested dark‑first)
    surface: '#111827',
    card: '#1F2937'
  },
  text: {
    primary: '#F9FAFB',
    secondary: '#D1D5DB',
    muted: '#9CA3AF'
  },
  brand: '#4A47FF',          // primary action
  accent: '#10B981',         // success/accent
  warning: '#F59E0B',
  danger: '#EF4444'
};

export const statusColor: Record<AppointmentStatus, string> = {
  SCHEDULED: '#3B82F6',      // blue
  IN_PROGRESS: '#F59E0B',    // amber
  READY: '#10B981',          // green
  COMPLETED: '#22C55E',      // green‑strong
  NO_SHOW: '#EF4444',        // red
  CANCELED: '#6B7280'        // gray
};
```

* Tailwind tokens: use `text-slate-50`, `bg-slate-900`, etc. Ensure contrast ≥ 4.5:1.

### 7.2 Motion

* 150–220ms ease‑out for enter/exit.
* Respect `prefers-reduced-motion` and shorten to 0–80ms.

### 7.3 Keyboard Map

* **Global:** `Cmd/Ctrl+K` opens Command Palette (post‑launch feature flag).
* **Drawer Tabs:** `Ctrl+Tab` next, `Ctrl+Shift+Tab` prev.
* **Move to…:** `M` opens status menu; arrow keys navigate; `Enter` to confirm.
* **Close drawer:** `Esc`.

### 7.4 Loading & Empty States

* Use skeletons for drawer and board. No spinner‑only pages.
* Empty columns show friendly CTAs: “No jobs here yet.”

---

## 8. Performance Optimization

* **Code splitting:** lazy‑load Drawer and Messages tab (S2) to keep TTI low.
* **Virtualization:** `react-virtual` for board columns when >100 cards.
* **Memoization:** `useMemo` for derived lists; `React.memo` on `AppointmentCard`.
* **Reflow control:** translate for DnD, avoid heavy shadows.
* **Batching:** rely on React 18 automatic batching + `startTransition` for non‑urgent UI updates.

---

## 9. Testing Strategy

### 9.1 Unit (Vitest)

* **Reducers:** optimistic move, totals math.
* **Utilities:** date range conversions, next appointment selection.
* **Guards:** role logic for action buttons.

### 9.2 Component (RTL)

* **StatusBoard:** renders columns, performs optimistic DnD, reverts on API error.
* **AppointmentDrawer:** tabs switch, focus trap, fast actions fire.
* **DashboardStats:** polls and updates on mutation.

### 9.3 E2E (Playwright or Cypress)

* S1: Load Board → open Drawer → move to `IN_PROGRESS` → stats update.
* S2: Add service line → total updates → send SMS → status becomes `delivered`.
* S3: Record payment → **Unpaid** KPI decreases.

Coverage target: **≥80%** critical paths.

---

## 10. Development Workflow

### 10.1 Local setup

```sh
pnpm i
pnpm dev   # runs Vite
# .env.local -> VITE_API_BASE=http://localhost:5001 (if backend on 5001)
```

### 10.2 Lint & format

```sh
pnpm lint
pnpm format
```

### 10.3 Storybook (optional)

* Useful for `AppointmentCard`, status pills, Drawer header.
* Keep stories minimal; test a11y with `@storybook/addon-a11y`.

### 10.4 PR Checklist

*

---

## 11. API Integration Map

| Component                | Endpoint(s)                                            | Notes                                           |
| ------------------------ | ------------------------------------------------------ | ----------------------------------------------- |
| DashboardStats           | `GET /api/admin/dashboard/stats`                       | Poll 60s; invalidate on mutations               |
| StatusBoard              | `GET /api/admin/appointments/board`                    | Optimistic `PATCH /admin/appointments/:id/move` |
| AppointmentDrawer (load) | `GET /api/appointments/:id`                            | Single payload; small caps for arrays           |
| Overview fast actions    | `PATCH /api/appointments/:id`, `/status`               | Trigger stats refresh                           |
| ServicesTab (S2)         | `GET/POST/PATCH/DELETE /api/appointments/:id/services` | Server may recompute `total_amount`             |
| MessagesThread (S2)      | `GET/POST /api/appointments/:id/messages`              | Idempotency keys; delivery webhook updates      |
| PaymentPanel (S3)        | `POST /api/appointments/:id/payments`                  | Immutable payments; update `paid_amount`        |
| CarsOnPremisesWidget     | `GET /api/admin/cars-on-premises`                      | Simple list                                     |

---

## 12. Future Enhancements (aligned to sprints)

* **S2:** Command Palette (`Cmd/Ctrl+K`) with actions + search providers.
* **S2:** Customer history tab aggregation.
* **S3:** Dark mode theming + brand color from shop settings.
* **Post‑launch:** WebSocket/SSE live updates; media uploads; gateway payments.

---

## 13. Code Snippets

### 13.1 Status change with optimistic UI

```ts
async function changeStatus(card: BoardCard, to: AppointmentStatus) {
  const snapshot = cardsRef.current; // keep previous
  setCards(prev => optimisticMove(prev, { id: card.id, from: card.status as any, to, position: 1 }));
  try {
    await moveAppointment(card.id, { status: to, position: 1 });
    toast.success(`Moved to ${to.replace('_', ' ')}`);
    // also refetch stats
    refreshStats();
  } catch (e) {
    console.error(e);
    setCards(snapshot); // revert
    toast.error('Could not move card. Check connection and permissions.');
  }
}
```

### 13.2 Drawer loader hook

```ts
export function useAppointment(id?: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!id) return;
    let cancel = false; setLoading(true);
    getAppointment(id)
      .then(d => !cancel && setData(d))
      .finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [id]);
  return { data, loading };
}
```

### 13.3 Keyboard “Move to…” menu

```tsx
function MoveMenu({ id, current }: { id: string; current: AppointmentStatus }) {
  const [open, setOpen] = useState(false);
  const statuses: AppointmentStatus[] = ['SCHEDULED','IN_PROGRESS','READY','COMPLETED','NO_SHOW','CANCELED'];
  return (
    <div>
      <button onClick={() => setOpen(v => !v)} aria-haspopup="menu" aria-expanded={open}>Move…</button>
      {open && (
        <ul role="menu" className="outline-none" tabIndex={-1}>
          {statuses.filter(s => s !== current).map(s => (
            <li role="menuitem" key={s}>
              <button onClick={() => changeStatusById(id, s)}>{s.replace('_',' ')}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## 14. Accessibility Checklist (WCAG 2.2 AA)

*

---

## 15. Open Decisions

1. Calendar library vs. custom grid? (Keep existing if working.)
2. Polling vs. SSE for drawer/message updates (start with polling).
3. Where to recompute totals — server canonical, client advisory? (Recommend **server canonical**.)

---

**End.** Aligns with `ARCHITECTURE.md`, `SCHEMA.md`, and `API.md`. Ship S1 with Calendar · Board · Drawer shell; expand per sprint.
