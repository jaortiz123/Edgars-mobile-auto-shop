---------------------------------
# Calendar / Daily Focus — Discovered Context (facts only)

## Primary files
- `frontend/src/components/admin/AppointmentCalendar.tsx`: Implements day/week/month views, day/week/month navigation, and renders appointment tiles/blocks (frontend/src/components/admin/AppointmentCalendar.tsx:31-41; frontend/src/components/admin/AppointmentCalendar.tsx:118-126).
- `frontend/src/components/admin/CalendarView.tsx`: Implements a month/day/week calendar UI, fetches today's appointments from `/api/admin/appointments/today`, and provides selection/export controls (frontend/src/components/admin/CalendarView.tsx:56-64; frontend/src/components/admin/CalendarView.tsx:60-68).
- `frontend/src/admin/Dashboard.tsx`: Mounts `AppointmentCalendar` inside the dashboard and toggles calendar/board views (frontend/src/admin/Dashboard.tsx:621-639; frontend/src/admin/Dashboard.tsx:572-604).
- `frontend/src/components/admin/UnifiedDashboard.tsx`: Contains calendar/schedule sections and week/day renderings used in unified dashboard (frontend/src/components/admin/UnifiedDashboard.tsx:340-349; frontend/src/components/admin/UnifiedDashboard.tsx:427-441).

## Types & data contracts
- `Appointment` shape used by `AppointmentCalendar` (exact local interface):

  interface Appointment {
    id: string;
    customer: string;
    vehicle: string;
    service: string;
    timeSlot: string;
    dateTime: Date;
    status: 'scheduled' | 'in-progress' | 'completed' | 'canceled';
    phone?: string;
    address?: string;
    estimatedDuration?: string;
    reminderStatus?: 'sent' | 'failed' | 'pending';
  }
  (frontend/src/components/admin/AppointmentCalendar.tsx:8-20)

- `CalendarView` uses a different `Appointment` shape for API payloads (exact local interface):

  interface Appointment {
    id: string;
    customer_name: string;
    service: string;
    scheduled_at: string;
    status: string;
    customer_phone?: string;
    location_address?: string;
    notes?: string;
  }
  (frontend/src/components/admin/CalendarView.tsx:7-16)

## Rendering & interaction
- `AppointmentCalendar` supports `view` state `'day' | 'week' | 'month'` and renders:
  - Day view: a vertical list of `dayAppointments` sorted by `dateTime` (frontend/src/components/admin/AppointmentCalendar.tsx:39-55; frontend/src/components/admin/AppointmentCalendar.tsx:174-185).
  - Week view: a 7-column grid with per-day appointment lists (frontend/src/components/admin/AppointmentCalendar.tsx:263-307).
  - Month view: grid of month days with appointment counts and interactive day cells (frontend/src/components/admin/AppointmentCalendar.tsx:309-377).
  (frontend/src/components/admin/AppointmentCalendar.tsx:40-50; frontend/src/components/admin/AppointmentCalendar.tsx:174-185; frontend/src/components/admin/AppointmentCalendar.tsx:309-377)
- `CalendarView` implements month/day/week modes with navigation and selection of appointments, and `onAppointmentClick` toggles selection (frontend/src/components/admin/CalendarView.tsx:27-35; frontend/src/components/admin/CalendarView.tsx:172-176; frontend/src/components/admin/CalendarView.tsx:372-376).
- Appointment tiles are clickable and provide action buttons for Start/Complete/Call depending on `status` (frontend/src/components/admin/AppointmentCalendar.tsx:208-217; frontend/src/components/admin/AppointmentCalendar.tsx:210-229).
- `CalendarView` fetches appointments from `${VITE_API_URL}/api/admin/appointments/today` and maps server fields into local shapes (frontend/src/components/admin/CalendarView.tsx:56-68).
- `AppointmentCalendar` computes appointment end times using `parseDurationToMinutes` and checks conflicts with overlapping intervals (frontend/src/components/admin/AppointmentCalendar.tsx:61-66; frontend/src/components/admin/AppointmentCalendar.tsx:98-115).

## Data flow
- `CalendarView` fetches appointments via a direct `fetch` to `/api/admin/appointments/today` (frontend/src/components/admin/CalendarView.tsx:60-66).
- `AppointmentCalendar` receives `appointments` via props and does local filtering/sorting to render day/week/month views (frontend/src/components/admin/AppointmentCalendar.tsx:22-29; frontend/src/components/admin/AppointmentCalendar.tsx:51-59).
- `Dashboard` passes `filteredAppointments` to `AppointmentCalendar` from its own `loadDashboardData` logic which calls `getAdminAppointments()` (frontend/src/admin/Dashboard.tsx:159-183; frontend/src/admin/Dashboard.tsx:628-636).

## Styling & tokens
- The calendar UI uses Tailwind utility classes and DS `Card`/`Button`/`Badge` components; examples include `bg-white rounded-xl shadow-md p-6` (AppointmentCalendar root) and `grid grid-cols-7` for month/week layouts (frontend/src/components/admin/AppointmentCalendar.tsx:118-121; frontend/src/components/admin/AppointmentCalendar.tsx:309-322).

## Analytics/telemetry
- `CalendarView` logs and falls back to mock appointments when the fetch fails; uses `console.warn`/`console.error` for errors (frontend/src/components/admin/CalendarView.tsx:75-83; frontend/src/components/admin/CalendarView.tsx:96-99).
- No explicit analytics/telemetry SDK calls discovered in inspected calendar files — UNKNOWN; TODO:SEARCH (repo-wide).

## Tests present
- No calendar-specific unit tests were discovered in the inspected snippets. `frontend/src/tests` contains calendar-related test files in the repo scan but specific calendar test file paths and assertions require further search — TODO:SEARCH (frontend tests for calendar view).

## Constraints referenced
- `AppointmentCalendar` limits month grid to 42 cells and renders only the first 2 appointments per day cell with a `+N more` indicator (frontend/src/components/admin/CalendarView.tsx:132-139; frontend/src/components/admin/CalendarView.tsx:351-357).
- `CalendarView` disables polling/auto-refresh by design in multiple places to avoid infinite request loops (frontend/src/components/admin/CalendarView.tsx:40-46; frontend/src/admin/Dashboard.tsx:282-291).

## Unknowns
- Precise backend contract and response shape for `/api/admin/appointments/today` beyond what `CalendarView` maps: TODO:SEARCH (backend endpoints).
- Tests asserting calendar interactions (drag/drop, event resize, keyboard accessibility): UNKNOWN; TODO:SEARCH (frontend/src/tests/**).
- Any virtualization/performance technique for large appointment sets (e.g., windowing libraries): UNKNOWN; TODO:SEARCH.


