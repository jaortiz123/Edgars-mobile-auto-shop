# Board View — Discovered Context (facts only)

## Primary files

- `frontend/src/components/admin/StatusBoard.tsx`: Renders the board container and provides a DnD provider for columns and cards (frontend/src/components/admin/StatusBoard.tsx:75-99).

- `frontend/src/components/admin/StatusColumn.tsx`: Renders a single column; registers a drop target using `react-dnd` (frontend/src/components/admin/StatusColumn.tsx:23-33; frontend/src/components/admin/StatusColumn.tsx:39-47).

- `frontend/src/components/admin/AppointmentCard.tsx`: Renders individual appointment cards, implements drag source and keyboard/ARIA handlers (frontend/src/components/admin/AppointmentCard.tsx:93-104; frontend/src/components/admin/AppointmentCard.tsx:290-305).

- `frontend/src/contexts/AppointmentContext.tsx`: Loads board data via `api.getBoard` and provides `columns`, `cards`, and `optimisticMove` to the UI (frontend/src/contexts/AppointmentContext.tsx:55-69; frontend/src/contexts/AppointmentContext.tsx:105-117).

- `frontend/src/types/models.ts`: Defines `AppointmentStatus`, `BoardColumn`, and `BoardCard` types used by board components (frontend/src/types/models.ts:1-7; frontend/src/types/models.ts:46-65).

- `backend/local_server.py`: Exposes the backend endpoint `/api/admin/appointments/board` used for board data (backend/local_server.py:687-703).

- `backend/tests/test_board_fallbacks.py`: Tests the board API response fallbacks for missing customer/vehicle values (backend/tests/test_board_fallbacks.py:37-62).

## Types & data contracts

- `AppointmentStatus` enum/type (exact):

  export type AppointmentStatus =
    | 'SCHEDULED'
    | 'IN_PROGRESS'
    | 'READY'
    | 'COMPLETED'
    | 'NO_SHOW'
    | 'CANCELED';

  (frontend/src/types/models.ts:1-7)

- `BoardColumn` (exact):

  export interface BoardColumn {
    key: AppointmentStatus;
    title: string;
    count: number;
    sum: number;
  }

  (frontend/src/types/models.ts:46-51)

- `BoardCard` (exact):

  export interface BoardCard {
    id: string;
    customerName: string;
    vehicle: string;
    servicesSummary?: string;
    price?: number;
    urgency?: 'urgent' | 'soon';
    status: AppointmentStatus;
    position: number;
    start?: string | null; // ISO timestamp
    end?: string | null;   // ISO timestamp
  }

  (frontend/src/types/models.ts:53-65)

## Rendering & interaction

- The board wraps columns in a `DndProvider` using the HTML5 backend (frontend/src/components/admin/StatusBoard.tsx:76-78).

- Columns implement `useDrop` accepting items of type `'card'` and call `onMove` when a dropped item's status differs (frontend/src/components/admin/StatusColumn.tsx:23-29).

- Cards implement `useDrag` with type `'card'` and expose `id`, `status`, and `position` in the drag item (frontend/src/components/admin/AppointmentCard.tsx:93-104).

- Appointment cards are keyboard-accessible: each card element uses `role="button"`, `tabIndex={0}`, `onKeyDown` handling Enter/Space to open (frontend/src/components/admin/AppointmentCard.tsx:296-305).

- Board container uses `role="region"` with `aria-label="Status Board"` (frontend/src/components/admin/StatusBoard.tsx:75-78).

- Live announcements and focus helpers are provided via `CardAccessibility` (ARIA live region creation and focus restore) (frontend/src/utils/cardRobustness.ts:298-319; frontend/src/utils/cardRobustness.ts:321-346).

## Data flow

- The front-end Appointment context calls `api.getBoard({})` to load board data and then sets `columns` and `cards` in context (frontend/src/contexts/AppointmentContext.tsx:63-69; frontend/src/contexts/AppointmentContext.tsx:80-87).

- The backend exposes `/api/admin/appointments/board` as a GET endpoint (backend/local_server.py:687-703).

- The Appointment context supports `optimisticMove` which calls `api.moveAppointment(id, { status, position })` and rolls back on error (frontend/src/contexts/AppointmentContext.tsx:105-117; frontend/src/contexts/AppointmentContext.tsx:120-132).

- Backend board endpoint accepts optional query params `from`, `to`, and `techId` and returns empty memory board when DB is missing (backend/local_server.py:695-703; backend/local_server.py:704-713).

- Tests assert backend normalizes NULL/empty customer/vehicle to fallback strings in the board API response (backend/tests/test_board_fallbacks.py:37-62).

## Styling & tokens

- Components use Tailwind/utility classes across the board; examples: board container `overflow-x-auto pb-4` (frontend/src/components/admin/StatusBoard.tsx:77-78) and column min-width `min-w-[280px] w-72` (frontend/src/components/admin/StatusColumn.tsx:40-41).

- Cards use shared CSS classes such as `card-base` and urgency modifiers `card-urgent` / `card-warning` (frontend/src/components/admin/AppointmentCard.tsx:290-293; frontend/src/styles/cardRobustness.css:12-18).

## Analytics/telemetry

- Code contains extensive `console.log` debugging statements in board components and context (e.g. StatusBoard logs on render and AppointmentContext logs around `api.getBoard` calls) (frontend/src/components/admin/StatusBoard.tsx:12-18; frontend/src/contexts/AppointmentContext.tsx:55-69).

- `optimisticMove` triggers a success toast `Appointment moved successfully` on successful move (frontend/src/contexts/AppointmentContext.tsx:115-119).

- No formal analytics/telemetry library calls (e.g., `track`, `analytics.track`) were found in the inspected board files — UNKNOWN; TODO:SEARCH (repo-wide).

## Tests present

- `backend/tests/test_board_fallbacks.py` contains tests asserting API fallback behavior for missing/empty customer and vehicle fields (backend/tests/test_board_fallbacks.py:37-62).

- Frontend has tests and mocks referencing board types and optimistic moves (examples: `frontend/src/tests/triage-removed/appointments.optimisticMove.test.tsx` and mocks) but the exact assertions for board rendering require further search — TODO:SEARCH (frontend tests covering board rendering).

## Constraints referenced

- Columns have a CSS-enforced minimum width `min-w-[280px]` which constrains horizontal layout (frontend/src/components/admin/StatusColumn.tsx:40-41).

- The UI prevents double quick-reschedule by tracking `reschedulingIds` and early-returning when present (frontend/src/components/admin/StatusBoard.tsx:10-13; frontend/src/components/admin/StatusBoard.tsx:40-46).

- Auto-refresh polling was explicitly disabled in related dashboard/context code to avoid infinite request loops (appointment refresh disabling comments) — see AppointmentContext and Dashboard for disabled polling notes (frontend/src/contexts/AppointmentContext.tsx:135-142; frontend/src/admin/Dashboard.tsx:282-291).

## Unknowns

- Source of `api.getBoard` implementation and exact backend contract beyond the `/api/admin/appointments/board` route: TODO:SEARCH (frontend/src/lib/api or frontend/src/services) (TODO:SEARCH).

- Formal analytics/telemetry usage across the app: UNKNOWN; TODO:SEARCH (repo-wide `track` / `analytics` keywords).

- Full list of frontend tests that assert board interactions (drag/drop, keyboard, accessibility): UNKNOWN; TODO:SEARCH (frontend/src/tests/**).

