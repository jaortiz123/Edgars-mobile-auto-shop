# UI Standards

This document outlines the design system for the Edgar's Mobile Auto Shop application, including typography, spacing, card design, the daily dashboard hero, the quick add appointment flow, scheduling intelligence, and the appointment reminders system.

## Typography System

### Typography Scale
Our application uses a modular typography scale based on a 1.25 ratio (Major Third) with a base size of 16px:

```css
--fs-0: 0.75rem;   /* 12px - Captions, fine print */
--fs-1: 0.875rem;  /* 14px - Small text, labels */
--fs-2: 1rem;      /* 16px - Body text (base) */
--fs-3: 1.25rem;   /* 20px - Small headings, lead text */
--fs-4: 1.5rem;    /* 24px - Medium headings */
--fs-5: 2rem;      /* 32px - Large headings */
--fs-6: 2.5rem;    /* 40px - Hero headings */
```

### Typography Usage

| Class | Size | Use Case | Example |
|-------|------|----------|---------|
| `text-fs-0` | 12px | Fine print, captions, timestamps | Appointment timestamps, legal text |
| `text-fs-1` | 14px | Small text, form labels | Input labels, secondary information |
| `text-fs-2` | 16px | Body text, buttons | Main content, button text |
| `text-fs-3` | 20px | Small headings, lead text | Subheadings, emphasized text |
| `text-fs-4` | 24px | Medium headings | Card titles, section headers |
| `text-fs-5` | 32px | Large headings | Page titles |
| `text-fs-6` | 40px | Hero headings | Landing page titles |

### Line Heights
```css
--lh-tight: 1.25;   /* Headings */
--lh-normal: 1.5;   /* Body text */
--lh-relaxed: 1.75; /* Large text blocks */
```

### Font Weights
```css
--fw-normal: 400;
--fw-medium: 500;
--fw-semibold: 600;
--fw-bold: 700;
```

## Spacing System

### 8px Base Unit System
All spacing follows an 8px base unit system for visual consistency:

```css
--sp-0: 0;
--sp-1: 0.5rem;  /* 8px */
--sp-2: 1rem;    /* 16px */
--sp-3: 1.5rem;  /* 24px */
--sp-4: 2rem;    /* 32px */
--sp-5: 2.5rem;  /* 40px */
--sp-6: 3rem;    /* 48px */
--sp-8: 4rem;    /* 64px */
```

### Spacing Usage Guidelines

#### Margins and Padding
| Class | Size | Use Case |
|-------|------|----------|
| `m-sp-1`, `p-sp-1` | 8px | Tight spacing, button padding |
| `m-sp-2`, `p-sp-2` | 16px | Standard spacing, card padding |
| `m-sp-3`, `p-sp-3` | 24px | Generous spacing, section padding |
| `m-sp-4`, `p-sp-4` | 32px | Large spacing, major sections |
| `m-sp-5`, `p-sp-5` | 40px | Extra large spacing |
| `m-sp-6`, `p-sp-6` | 48px | Section dividers |
| `m-sp-8`, `p-sp-8` | 64px | Major layout spacing |

#### Gaps and Space Between Elements
| Class | Size | Use Case |
|-------|------|----------|
| `gap-sp-1` | 8px | Tight grid/flex gaps |
| `gap-sp-2` | 16px | Standard grid/flex gaps |
| `gap-sp-3` | 24px | Generous grid/flex gaps |
| `space-y-sp-2` | 16px | Standard vertical spacing between elements |
| `space-y-sp-3` | 24px | Generous vertical spacing |

### Component-Specific Variables
```css
--card-padding: var(--sp-3);      /* 24px */
--card-gap: var(--sp-2);          /* 16px */
--button-padding-y: var(--sp-2);  /* 16px */
--button-padding-x: var(--sp-3);  /* 24px */
```

## Implementation Examples

### Typography Migration Example
**Before:**
```tsx
<h1 className="text-2xl font-bold">Dashboard Title</h1>
<p className="text-sm text-gray-600">Subtitle text</p>
```

**After:**
```tsx
<h1 className="text-fs-4 font-bold">Dashboard Title</h1>
<p className="text-fs-1 text-gray-600">Subtitle text</p>
```

### Spacing Migration Example
**Before:**
```tsx
<div className="p-6 mt-4 gap-3">
  <button className="px-4 py-2">Action</button>
</div>
```

**After:**
```tsx
<div className="p-sp-4 mt-sp-3 gap-sp-3">
  <button className="px-sp-3 py-sp-2">Action</button>
</div>
```

### AppointmentCard Implementation
```tsx
// Fully migrated component using design system
<div className="p-sp-3 rounded-lg border bg-white shadow-lg">
  <div className="text-fs-1 text-gray-600 mt-sp-1">{customer}</div>
  <div className="text-fs-0 text-gray-600 mt-sp-1">{vehicle}</div>
  <div className="text-fs-0 mt-sp-1">{services}</div>
  <div className="mt-sp-2 text-fs-1 font-medium">
    {timeSlot}
  </div>
</div>
```

## Development Guidelines

### CSS Architecture
The design system is organized into separate, maintainable files:
- `/src/styles/theme.css` - Core CSS variables and design tokens
- `/src/styles/typography.css` - Typography utilities and hierarchy
- `/src/styles/spacing.css` - Spacing utilities and component-specific classes

### Tailwind Integration
The design system extends Tailwind CSS while maintaining backward compatibility:
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontSize: {
        'fs-0': 'var(--fs-0)',
        'fs-1': 'var(--fs-1)',
        'fs-2': 'var(--fs-2)',
        'fs-3': 'var(--fs-3)',
        'fs-4': 'var(--fs-4)',
        'fs-5': 'var(--fs-5)',
        'fs-6': 'var(--fs-6)',
      },
      spacing: {
        'sp-0': 'var(--sp-0)',
        'sp-1': 'var(--sp-1)',
        'sp-2': 'var(--sp-2)',
        'sp-3': 'var(--sp-3)',
        'sp-4': 'var(--sp-4)',
        'sp-5': 'var(--sp-5)',
        'sp-6': 'var(--sp-6)',
        'sp-8': 'var(--sp-8)',
      }
    }
  }
}
```

### Migration Checklist
When migrating components to the design system:

1. **Typography Migration:**
   - [ ] Replace `text-xs` with `text-fs-0`
   - [ ] Replace `text-sm` with `text-fs-1`
   - [ ] Replace `text-base` with `text-fs-2`
   - [ ] Replace `text-lg` with `text-fs-3`
   - [ ] Replace `text-xl` with `text-fs-4`
   - [ ] Replace `text-2xl` with `text-fs-5`
   - [ ] Replace larger sizes with `text-fs-6`

2. **Spacing Migration:**
   - [ ] Replace `p-1` with `p-sp-1` (8px)
   - [ ] Replace `p-2` with `p-sp-2` (16px)
   - [ ] Replace `p-3` with `p-sp-3` (24px)
   - [ ] Replace `p-4` with `p-sp-4` (32px)
   - [ ] Replace `p-6` with `p-sp-4` (32px equivalent)
   - [ ] Replace `gap-2` with `gap-sp-2`
   - [ ] Replace `gap-4` with `gap-sp-3`

3. **Testing:**
   - [ ] Visual regression testing
   - [ ] Accessibility testing
   - [ ] Responsive behavior validation

## Benefits

### Consistency
- Unified typography hierarchy across all components
- Consistent spacing relationships
- Predictable visual rhythm

### Maintainability
- Centralized design tokens
- Easy theme updates
- Reduced CSS duplication

### Scalability
- Modular architecture
- Dark mode support structure
- Component-specific customizations

### Developer Experience
- Clear naming conventions
- Type-safe implementation
- Backward compatibility with existing Tailwind classes

## Card Design

### Card Variants
Cards use the updated spacing system:
```tsx
<Card>
  <CardHeader className="p-sp-4">
    <CardTitle className="text-fs-4">Title</CardTitle>
    <CardDescription className="text-fs-1">Description</CardDescription>
  </CardHeader>
  <CardContent className="p-sp-4">
    Content using spacing system
  </CardContent>
</Card>
```

## Card Design System (Sprint 1B)

### Overview
The card design system provides consistent, reusable card components with proper hierarchy, visual depth, and interactive states. All cards follow the established typography and spacing systems while adding sophisticated visual treatments.

### Card Architecture

#### Base Card Component
```tsx
<div className="card-base">
  <div className="card-content">
    {/* Card content here */}
  </div>
</div>
```

#### Card Variants
- **Default**: `card-base` - Standard card with subtle shadow
- **Urgent**: `card-base card-urgent` - Red border with enhanced shadow for urgent items
- **Warning**: `card-base card-warning` - Orange border for items needing attention

### Visual Hierarchy

#### Typography Hierarchy in Cards
```tsx
{/* Primary Information - Customer/Title */}
<h3 className="text-fs-3 font-semibold text-gray-900">Primary Title</h3>

{/* Secondary Information - Details */}
<div className="text-fs-1 text-gray-600 mt-sp-1 font-normal">Secondary Info</div>

{/* Service/Description Information */}
<div className="text-fs-1 text-gray-600 mt-sp-1 font-normal">Service Details</div>

{/* Price/Important Numbers */}
<div className="text-fs-2 mt-sp-2 font-medium text-gray-900">$150.00</div>
```

#### Information Priority
1. **Primary (Customer Name)**: `text-fs-3` (20px) with `font-semibold` for maximum prominence
2. **Secondary (Vehicle, Service)**: `text-fs-1` (14px) with `font-normal` for supporting details
3. **Tertiary (Price, Time)**: `text-fs-2` (16px) with `font-medium` for important numerical data

### Shadow System

#### CSS Variables
```css
--card-shadow-default: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
--card-shadow-hover: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--card-shadow-focus: 0 0 0 2px rgba(59, 130, 246, 0.5);
--card-shadow-urgent: 0 0 0 2px rgba(239, 68, 68, 0.3), 0 1px 3px 0 rgba(0, 0, 0, 0.1);
--card-shadow-warning: 0 0 0 2px rgba(245, 158, 11, 0.3), 0 1px 3px 0 rgba(0, 0, 0, 0.1);
```

#### Interactive States
- **Default**: Subtle shadow for visual separation
- **Hover**: Elevated shadow + 2px translateY for lift effect
- **Focus**: Blue outline for accessibility
- **Urgent/Warning**: Colored outline shadows for priority indication

### Spacing System

#### Card Padding
- **Standard**: `card-content` class provides `padding: var(--sp-3)` (24px)
- **Compact**: `card-content-compact` provides `padding: var(--sp-2)` (16px)
- **Spacious**: `card-content-spacious` provides `padding: var(--sp-4)` (32px)

#### Internal Spacing
```tsx
{/* Consistent spacing between elements */}
<div className="mt-sp-1">8px margin top</div>
<div className="mt-sp-2">16px margin top</div>
<div className="mt-sp-3">24px margin top</div>
```

### Urgency Indicators

#### Urgency Badge System
```tsx
{/* Visual urgency indicator */}
<span className={`urgency-badge ${urgencyLevel}`}></span>

{/* Urgency status line */}
<div className={`urgency-status ${urgencyLevel}`}>
  <span className={`urgency-icon ${urgencyLevel}`}></span>
  {urgencyText}
</div>
```

#### Urgency Levels
- **Urgent**: Red indicators with pulse animation for critical items
- **Soon**: Orange indicators for items requiring attention
- **Normal**: Green indicators for standard items

#### Visual Treatments
- **Badge**: Circular indicator positioned top-right with pulse animation for urgent items
- **Status Line**: Inline status with colored background and icon
- **Card Border**: Enhanced shadow with colored outline for urgent/warning states

### Implementation Examples

#### Standard Appointment Card
```tsx
<div className="card-base">
  <div className="card-content">
    {/* Urgency indicator */}
    <span className="urgency-badge urgent"></span>
    
    {/* Primary information */}
    <div className="flex items-center justify-between gap-sp-1">
      <h3 className="text-fs-3 font-semibold text-gray-900">John Smith</h3>
      <span className="text-fs-0 text-gray-500">⋮</span>
    </div>
    
    {/* Secondary information */}
    <div className="text-fs-1 text-gray-600 mt-sp-1 font-normal">2020 Honda Civic</div>
    <div className="text-fs-1 text-gray-600 mt-sp-1 font-normal">Oil Change, Brake Inspection</div>
    
    {/* Price */}
    <div className="text-fs-2 mt-sp-2 font-medium text-gray-900">$85.00</div>
    
    {/* Urgency status */}
    <div className="urgency-status urgent">
      <span className="urgency-icon urgent"></span>
      Urgent
    </div>
  </div>
</div>
```

#### Service Selection Card
```tsx
<Card className="card-base flex flex-col h-full cursor-pointer">
  <CardHeader>
    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-primary mb-sp-3">
      <Wrench className="h-6 w-6" />
    </div>
    <CardTitle className="text-fs-4">Oil Change Service</CardTitle>
    <CardDescription className="text-fs-1">Full synthetic oil change with filter</CardDescription>
  </CardHeader>
  <CardContent className="flex-grow">
    <div>
      <span className="text-fs-1 text-muted-foreground">From</span>
      <p className="text-fs-6 font-extrabold text-primary">$75</p>
    </div>
  </CardContent>
</Card>
```

### CSS Classes Reference

#### Base Classes
- `.card-base` - Base card with default styling and hover effects
- `.card-content` - Standard padding for card content (24px)
- `.card-content-compact` - Compact padding (16px)
- `.card-content-spacious` - Generous padding (32px)

#### Variant Classes
- `.card-urgent` - Red outline and enhanced shadow for urgent items
- `.card-warning` - Orange outline for items needing attention

#### Urgency Classes
- `.urgency-badge` - Circular urgency indicator
- `.urgency-badge.urgent` - Red urgent badge with pulse animation
- `.urgency-badge.soon` - Orange warning badge
- `.urgency-status` - Inline urgency status with background
- `.urgency-icon` - Small circular icon for urgency level

### Accessibility Features

#### Semantic Structure
- Proper heading hierarchy with `<h3>` for primary information
- Descriptive `aria-label` attributes for interactive elements
- Focus management with visible focus indicators

#### Visual Indicators
- High contrast urgency indicators
- Clear visual hierarchy through typography scale
- Consistent interactive states (hover, focus, active)

#### Responsive Design
- Cards adapt to container width
- Typography remains readable at all screen sizes
- Touch-friendly interactive areas (44px minimum)

### Testing Guidelines

#### Visual Regression Testing
1. Test all card variants (default, urgent, warning)
2. Verify hover and focus states
3. Test urgency indicators and animations
4. Validate typography hierarchy

#### Accessibility Testing
1. Keyboard navigation through cards
2. Screen reader announcement of card content
3. Focus indicator visibility
4. Color contrast compliance

#### Cross-Browser Testing
1. Shadow and hover effects in Chrome, Safari, Firefox
2. Animation performance and smoothness
3. Typography rendering consistency

### Migration from Old Cards

#### Before (Old System)
```tsx
<div className="p-4 shadow-lg hover:shadow-xl border rounded-lg">
  <h3 className="text-lg font-bold">Customer Name</h3>
  <p className="text-sm text-gray-600">Vehicle Info</p>
  <div className="mt-2 text-base font-medium">$150.00</div>
</div>
```

#### After (New Design System)
```tsx
<div className="card-base">
  <div className="card-content">
    <h3 className="text-fs-3 font-semibold text-gray-900">Customer Name</h3>
    <div className="text-fs-1 text-gray-600 mt-sp-1 font-normal">Vehicle Info</div>
    <div className="text-fs-2 mt-sp-2 font-medium text-gray-900">$150.00</div>
  </div>
</div>
```

### Performance Considerations

#### CSS Optimization
- Shadow calculations use GPU acceleration
- Transition properties optimized for performance
- Minimal DOM changes during interactions

#### Animation Performance
- Pulse animations use transform for GPU acceleration
- Smooth 60fps hover transitions
- Optimized keyframe animations

### Future Enhancements

#### Planned Features
- Dark mode shadow adjustments
- Additional urgency levels
- Card skeleton loading states
- Enhanced animation options

## Daily Dashboard Hero

The Daily Dashboard Hero section is the primary focal point of Edgar's admin dashboard, providing a personalized, informative overview that helps Edgar start each day with clarity and focus.

### Overview

The Daily Dashboard Hero replaces the simple TodaysNumbers component with a comprehensive hero section that includes:
- **Enhanced Good Morning Anchor**: Personalized greeting with revenue display
- **Next Action Card**: Priority task prompting for immediate attention
- **Today's Schedule**: Organized overview of upcoming appointments
- **Revenue Progress**: Real-time tracking of daily earnings

### Components

#### DailyFocusHero Component
- **File:** `src/components/admin/DailyFocusHero.tsx`
- **Purpose:** Main container for the hero section with enhanced layout and styling
- **Features:**
  - Gradient background with card-based layout
  - Responsive design with mobile-first approach
  - Real-time updates every minute
  - Integration with appointment and revenue data

#### Good Morning Anchor (T2)
- **Purpose:** Personalized greeting that changes based on time of day
- **Features:**
  - Time-aware greeting: "Good Morning", "Good Afternoon", "Good Evening"
  - Revenue progress display with confirmed and estimated totals
  - Today's schedule summary with appointment count
  - Elegant card design with proper spacing and typography

#### NextAction Card (T3)
- **File:** `src/components/admin/NextActionCard.tsx`
- **Purpose:** Highlights the most urgent upcoming appointment requiring attention
- **Features:**
  - Visual priority indicators with orange accent colors
  - Clear call-to-action with appointment details
  - Hover effects and smooth transitions
  - Contextual icons and status badges

#### TodaysSchedule Component (T4)
- **File:** `src/components/admin/TodaysSchedule.tsx`
- **Purpose:** Comprehensive view of today's appointment schedule
- **Features:**
  - Priority-based sorting (overdue → late → starting soon → scheduled)
  - Status indicators with color-coded badges
  - Customer and service information display
  - Click-to-call functionality for phone numbers
  - Responsive layout with proper information hierarchy

### Design Principles

#### Visual Hierarchy
- **Level 1:** Greeting and daily date (largest text)
- **Level 2:** Revenue totals and schedule count
- **Level 3:** Next action details and appointment list
- **Level 4:** Supporting information and metadata

#### Color System
- **Primary Actions:** Orange (#f97316) for next actions and CTAs
- **Status Indicators:**
  - Green: Revenue/positive metrics
  - Blue: Scheduled/normal status
  - Orange: Starting soon/attention needed
  - Red: Overdue/urgent status
- **Neutral Backgrounds:** Light grays and whites for cards and containers

#### Spacing & Layout
- **Container Padding:** `p-sp-4` (16px) for main hero container
- **Card Spacing:** `p-sp-3` (12px) for internal card content
- **Element Gaps:** `gap-sp-2` to `gap-sp-4` for consistent spacing
- **Margins:** `mb-sp-4` for section separation

### Data Integration

#### Revenue Calculation
```typescript
const getTotalRevenue = () => {
  const confirmedRevenue = stats.unpaidTotal || 0;
  const estimatedRevenue = appointments.reduce((total, apt) => {
    const estimatedAmount = 150; // Default service estimate
    return total + (apt.status === 'scheduled' ? estimatedAmount : 0);
  }, 0);
  return confirmedRevenue + estimatedRevenue;
};
```

#### Appointment Status Logic
- **Starting Soon:** Within 30 minutes of start time
- **Running Late:** 5-30 minutes past start time
- **Overdue:** More than 30 minutes past start time
- **Priority Sorting:** Urgent status first, then chronological order

### Accessibility Features

#### Screen Reader Support
- Semantic HTML structure with proper headings
- ARIA labels for interactive elements
- Descriptive button text and titles

#### Keyboard Navigation
- Proper tab order for all interactive elements
- Click handlers on keyboard-accessible elements
- Focus indicators for better navigation

#### Visual Accessibility
- High contrast colors meeting WCAG 2.2 AA standards
- Consistent iconography with text labels
- Responsive design for various screen sizes

### Real-Time Updates

#### Automatic Refresh
- Time and greeting update every minute
- Revenue and appointment data refresh on context changes
- Status indicators update based on current time calculations

#### Live Status Calculation
```typescript
const getStatusInfo = (appointment: UIAppointment) => {
  const isSoon = isWithin(appointment.dateTime, 30);
  const minutes_past = minutesPast(appointment.dateTime);
  const isLate = minutes_past > 5 && minutes_past <= 30;
  const isOverdue = minutes_past > 30;
  // Return appropriate status with priority and styling
};
```

### Integration Points

#### AppointmentContext
- Pulls revenue statistics and appointment counts
- Integrates with dashboard refresh triggers
- Responds to real-time data updates

#### Navigation
- Next action clicks can trigger appointment details
- Schedule items link to full appointment management
- "View all" functionality for expanded schedule view

### Performance Considerations

#### Efficient Updates
- Minimal re-renders with proper dependency arrays
- Calculated values memoized when appropriate
- Status checks performed client-side to avoid API calls

#### Data Optimization
- Limited appointment list to top 5 items
- Priority-based sorting reduces processing overhead
- Cached greeting calculations with minute-based updates

### Future Enhancements

#### Planned Features
- Weather integration for service planning
- Traffic data for mobile service timing
- Customer communication shortcuts
- Service completion progress indicators

#### Customization Options
- User-configurable revenue targets
- Adjustable notification thresholds
- Personalized greeting messages
- Dashboard layout preferences

## Appointment Reminders System

This section details the system for managing and notifying about appointments.

### Countdown Timers

- **Purpose:** Provides a live countdown to appointment start times on each appointment card.
- **Component:** `AppointmentCard.tsx`
- **Helper:** `src/lib/time.js` (`getMinutesUntil`)
- **Usage:** Displays "Starts in X min" or "Started X min ago" and updates every minute.

### Starting Soon Notifications

- **Purpose:** Pushes in-app alerts when an appointment is about to start.
- **Service:** `src/lib/notificationService.ts` (`scheduleReminder`, `addNotification`)
- **Component:** `NotificationCenter.tsx`
- **Usage:** When an appointment is 15 minutes away (configurable), a toast notification is triggered, and the reminder is logged in the `NotificationCenter`.

### Customer Arrived Check-In

- **Purpose:** Allows technicians to mark customer arrival with one click.
- **Component:** `AppointmentCard.tsx`, `ArrivalButton.tsx`
- **Service:** `src/lib/api.ts` (`markArrived`)
- **Usage:** An "Arrived" button appears on upcoming appointment cards. Clicking it updates the appointment status to "arrived" and disables the button.

### Running Late and Overdue Alerts

- **Purpose:** Alerts technicians and customers when appointments run late.
- **Component:** `AppointmentCard.tsx`
- **Service:** `src/lib/notificationService.ts` (`addNotification`)
- **Helper:** `src/lib/time.js` (`minutesPast`)
- **Usage:**
    - If an appointment is 10 minutes past its start time and not checked in, a "Running late" notification is sent.
    - If an appointment is 30 minutes past its start time, an "Overdue" notification is sent, and an "Escalate" button is enabled (for future SMS/email to customer).

## Smart Today View System

This section documents the Smart Today View implemented in Sprint 2B, providing intelligent filtering, visual highlighting, time-based urgency indicators, and running late/overdue alerts for appointment scheduling.

### Core Components

#### ScheduleView
- **Purpose:** Main container for the smart appointment scheduling interface
- **Component:** `ScheduleView.tsx`
- **Features:** 
  - Filter toggle integration
  - Smart sorting by urgency priority
  - Statistics dashboard
  - Responsive appointment list

#### ScheduleItem
- **Purpose:** Individual appointment display with smart visual indicators
- **Component:** `ScheduleItem.tsx`
- **Features:**
  - Today highlighting
  - Time-based urgency badges
  - Live countdown timers
  - Running late/overdue alerts

#### ScheduleFilterToggle
- **Purpose:** Filter control for Today vs All appointments
- **Component:** `ScheduleFilterToggle.tsx`
- **Features:**
  - Two-state toggle (Today/All)
  - Live appointment counts
  - Accessible ARIA controls

### Visual Design Patterns

#### Today Highlighting (T2)
```css
/* Today's appointments get special visual treatment */
.today-appointment {
  border: 1px solid theme(colors.blue.200);
  background: theme(colors.blue.50);
  ring: 1px theme(colors.blue.300);
}

.today-badge {
  background: theme(colors.blue.100);
  color: theme(colors.blue.800);
  border: 1px solid theme(colors.blue.200);
}
```

#### Time-Based Urgency Badges (T3)
```css
/* Starting Soon (<30 min) */
.urgency-soon {
  background: theme(colors.orange.100);
  color: theme(colors.orange.800);
  border: 1px solid theme(colors.orange.200);
}

/* Running Late (>5 min past) */
.urgency-late {
  background: theme(colors.amber.100);
  color: theme(colors.amber.800);
  border: 1px solid theme(colors.amber.200);
}

/* Overdue (>30 min past) */
.urgency-overdue {
  background: theme(colors.red.100);
  color: theme(colors.red.800);
  border: 1px solid theme(colors.red.200);
}
```

#### Card Background Urgency States (T4)
```css
/* Progressive urgency background highlighting */
.card-starting-soon {
  border-color: theme(colors.orange.300);
  background-color: theme(colors.orange.50);
}

.card-running-late {
  border-color: theme(colors.amber.300);
  background-color: theme(colors.amber.50);
}

.card-overdue {
  border-color: theme(colors.red.300);
  background-color: theme(colors.red.50);
}
```

### Smart Sorting Algorithm

The system employs intelligent sorting based on urgency priority:

1. **Overdue** (>30 min past start) - Priority 4
2. **Running Late** (>5 min past start) - Priority 3  
3. **Starting Soon** (≤30 min until start) - Priority 2
4. **Today** (scheduled for today) - Priority 1
5. **Normal** (future appointments) - Priority 0

Within each priority level, appointments are sorted chronologically.

### Time-Based Status Detection

#### Thresholds
- **Starting Soon:** ≤30 minutes until appointment start
- **Running Late:** >5 minutes past appointment start
- **Overdue:** >30 minutes past appointment start

#### Live Updates
- Countdown timers update every 60 seconds
- Status badges automatically refresh based on current time
- Urgency levels dynamically adjust as time progresses

### Integration Guidelines

#### Using ScheduleView
```tsx
import ScheduleView from './components/admin/ScheduleView';

<ScheduleView
  appointments={appointments}
  onAppointmentClick={(appointment) => handleEdit(appointment)}
  title="Today's Schedule"
/>
```

#### Using Individual Components
```tsx
import ScheduleFilterToggle from './components/admin/ScheduleFilterToggle';
import ScheduleItem from './components/admin/ScheduleItem';

// Filter toggle
<ScheduleFilterToggle
  activeFilter={filter}
  onFilterChange={setFilter}
  todayCount={todayAppointments.length}
  allCount={allAppointments.length}
/>

// Individual appointment item
<ScheduleItem
  appointment={appointment}
  isToday={isToday}
  onClick={() => handleClick(appointment)}
/>
```

### Accessibility Features

- **ARIA Labels:** All interactive elements include proper aria-labels
- **Keyboard Navigation:** Full keyboard support for filter toggles
- **Screen Reader Support:** Status announcements for urgent appointments
- **Color Independence:** Icons and text labels accompany color coding

### Statistics Dashboard

The Smart Today View includes real-time statistics:

- **Total Appointments:** Current filter scope count
- **Starting Soon:** Appointments within 30 minutes
- **Running Late:** Appointments 5-30 minutes past start
- **Overdue:** Appointments >30 minutes past start

### Future Enhancement Patterns

#### Planned Improvements
- Customer notification integration
- Drag-and-drop rescheduling
- Batch operations for urgent appointments
- Advanced filtering (service type, location, customer)
- Mobile-optimized urgency alerts

#### Extension Points
- Custom urgency thresholds per service type
- Integration with external calendar systems
- SMS/email automatic notifications for late appointments
- Analytics dashboard for appointment patterns

## Sprint 2B Robustness Enhancements

### Enhanced Error Handling

The Smart Today View system includes comprehensive error handling:

#### Error Boundary Integration
```tsx
import { ErrorBoundary } from './components/common/ErrorBoundary';
import ScheduleView from './components/admin/ScheduleView';

<ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
  <ScheduleView appointments={appointments} />
</ErrorBoundary>
```

#### Safe Data Processing
- **Date Parsing**: All appointment dates are safely parsed with fallbacks
- **Null Safety**: All optional properties are properly validated
- **Type Guards**: Runtime type checking for appointment objects
- **Array Validation**: Safe processing of appointment arrays

#### Performance Optimizations
- **Memoization**: Expensive calculations cached with useMemo
- **Callback Optimization**: Event handlers memoized with useCallback
- **Interval Cleanup**: Proper useEffect cleanup to prevent memory leaks
- **Debounced Updates**: Performance-critical operations are debounced

#### Accessibility Improvements
- **ARIA Compliance**: All interactive elements include proper ARIA attributes
- **Screen Reader Support**: Status announcements for urgent appointments
- **Keyboard Navigation**: Full keyboard support for all components
- **Focus Management**: Proper focus handling for modal interactions

#### Type Safety
- **Standardized Interfaces**: Consistent appointment types across components
- **Runtime Validation**: Type guards for external data
- **Error Recovery**: Graceful fallbacks for invalid data
- **Strict TypeScript**: Enhanced type checking for props and state

### Error Recovery Patterns

#### Component-Level Recovery
```tsx
// Example: Safe appointment rendering with fallbacks
const renderAppointment = (appointment: any) => {
  const validatedAppointment = validateAppointment(appointment);
  if (!validatedAppointment) {
    return <div className="text-red-500">Invalid appointment data</div>;
  }
  return <ScheduleItem appointment={validatedAppointment} />;
};
```

#### Network Error Handling
```tsx
// Example: API call with retry logic
const fetchAppointments = async () => {
  try {
    const data = await retryWithBackoff(() => 
      fetch('/api/appointments').then(res => res.json())
    );
    return validateAppointments(data);
  } catch (error) {
    console.error('Failed to fetch appointments:', formatErrorMessage(error));
    return [];
  }
};
```

### Performance Best Practices

#### Memory Management
- **Interval Cleanup**: All setInterval calls properly cleaned up
- **Event Listener Removal**: Event listeners removed in useEffect cleanup
- **Object Reference Stability**: Memoized objects to prevent unnecessary re-renders

#### Calculation Optimization
- **Expensive Operations**: Moved to useMemo with proper dependencies
- **Filtered Data**: Cached to prevent recalculation on every render
- **Statistics**: Pre-calculated and memoized for dashboard display

### Development Guidelines

#### Error Handling Standards
1. Always wrap external data access in try-catch blocks
2. Provide meaningful error messages for debugging
3. Include fallback UI for error states
4. Log errors appropriately for monitoring

#### Performance Standards
1. Use useCallback for event handlers
2. Use useMemo for expensive calculations
3. Implement proper cleanup in useEffect
4. Avoid creating objects in render methods

#### Accessibility Standards
1. Include ARIA labels for all interactive elements
2. Support keyboard navigation
3. Provide screen reader announcements
4. Ensure proper focus management

### Testing Robustness

#### Error Scenarios
- Invalid appointment data
- Network failures
- Missing required properties
- Malformed dates and times

#### Performance Testing
- Memory leak detection
- Render performance measurement
- Interval cleanup verification
- Large dataset handling

#### Accessibility Testing
- Screen reader compatibility
- Keyboard navigation
- ARIA attribute validation
- Color contrast compliance

## Sprint 1A Robustness Guidelines

### Overview
The Sprint 1A Visual Hierarchy & Typography system includes comprehensive robustness features to ensure reliability, performance, and accessibility. These guidelines detail the implementation and usage of the enhanced design system.

### Robustness Categories

#### 1. Type Safety
All design system tokens are type-safe with comprehensive TypeScript definitions:

```typescript
import type { TypographyUtility, SpacingUtility } from '@/types/designSystem';
import { createDesignSystemClasses } from '@/utils/designSystemValidator';

// Type-safe class generation
const classes = createDesignSystemClasses('text-fs-3', 'mt-sp-2', 'p-sp-4');
```

#### 2. CSS Fallback System
All CSS variables include fallback values for robust error recovery:

```css
/* Enhanced with fallbacks */
font-size: var(--fs-2, 1rem);
margin-top: var(--sp-3, 1.5rem);
padding: var(--sp-4, 2rem);
```

#### 3. Performance Monitoring
Real-time CSS performance monitoring with automatic threshold checking:

```typescript
import { measureCSSPerformance } from '@/utils/cssPerformanceMonitor';

// Monitor typography rendering performance
const { result, duration } = measureCSSPerformance('typography-render', () => {
  // Your CSS-intensive operation
});
```

#### 4. Accessibility Compliance
WCAG AA/AAA compliant design system with enhanced focus management:

```css
/* Enhanced focus indicators */
.ds-focus-ring:focus-visible {
  outline: var(--focus-outline-width, 2px) solid var(--focus-outline-color, #3b82f6);
  outline-offset: var(--focus-outline-offset, 2px);
}

/* Minimum touch targets */
.ds-touch-target {
  min-height: var(--min-touch-target, 44px);
  min-width: var(--min-touch-target, 44px);
}
```

### Implementation Requirements

#### Initialization
All applications must initialize the robustness system:

```typescript
// In your main app file (e.g., main.tsx, _app.tsx)
import initializeSprint1ARobustness from '@/utils/sprint1ARobustness';

// Initialize robustness features early in app lifecycle
initializeSprint1ARobustness();
```

#### CSS Imports
Include all robustness-enhanced stylesheets:

```css
/* In your main CSS file */
@import './styles/themeRobust.css';
@import './styles/theme.css';
@import './styles/typography.css';
@import './styles/spacing.css';
@import './styles/accessibilityEnhancements.css';
```

### Development Tools

#### Visual Indicators
In development mode, design system classes are highlighted with visual badges:
- **Green "FS" badges**: Typography classes (`text-fs-*`)
- **Blue "SP" badges**: Spacing classes (`*-sp-*`)
- **Red/Orange indicators**: Validation errors or warnings

#### Keyboard Shortcuts
- `Ctrl/Cmd + Shift + D`: Toggle debug mode
- `Ctrl/Cmd + Shift + P`: Show performance report

#### Console Monitoring
```typescript
// Check validation state
import { designSystemValidator } from '@/utils/designSystemValidator';
const state = designSystemValidator.getValidationState();
console.log('Design System Status:', state);

// Get performance report
import { cssPerformanceMonitor } from '@/utils/cssPerformanceMonitor';
const report = cssPerformanceMonitor.getPerformanceReport();
console.table(report.metrics);
```

### Validation Guidelines

#### Runtime Validation
Components should validate design system token usage:

```typescript
import { validateDesignToken } from '@/utils/designSystemValidator';

// Validate token usage
const isValidTypography = validateDesignToken('typography', 'fs-3');
const isValidSpacing = validateDesignToken('spacing', 'sp-4');
```

#### Error Recovery
Components should gracefully handle design system failures:

```tsx
// Example component with error recovery
const AppointmentCard = ({ card }: { card: BoardCard }) => {
  return (
    <div className={createDesignSystemClasses(
      'card-base',
      'p-sp-3',
      'text-fs-2'
    ) || 'typography-fallback spacing-fallback'}>
      {/* Card content */}
    </div>
  );
};
```

### Performance Thresholds

#### Monitoring Thresholds
- **Paint Time**: ≤16ms (60fps target)
- **Layout Time**: ≤8ms
- **Style Recalculation**: ≤4ms
- **CSS Variable Access**: ≤1ms per access

#### Bundle Size Limits
- **Utility Classes**: ≤1000 classes
- **CSS Variables**: ≤100 variables
- **Nesting Depth**: ≤4 levels

### Accessibility Requirements

#### WCAG Compliance
- **Normal Text**: 4.5:1 contrast ratio minimum
- **Large Text**: 3:1 contrast ratio minimum
- **Touch Targets**: 44×44px minimum
- **Focus Indicators**: 2px minimum width

#### Enhanced Features
- High contrast mode support
- Reduced motion preferences
- Screen reader optimizations
- Print accessibility
- Forced colors mode support

### Testing Requirements

#### Unit Tests
All design system components must include:
- Type definition validation
- CSS variable availability testing
- Accessibility compliance testing
- Performance threshold validation
- Error handling and fallback testing

#### Integration Tests
- Design system initialization testing
- Cross-browser compatibility
- SSR environment handling
- Fallback system activation

### Migration Checklist

When implementing Sprint 1A robustness:

1. **Installation**:
   - [ ] Import robustness types and utilities
   - [ ] Initialize robustness system in main app
   - [ ] Include enhanced CSS imports

2. **Component Updates**:
   - [ ] Replace magic strings with type-safe utilities
   - [ ] Add error handling for design system failures
   - [ ] Include accessibility enhancements
   - [ ] Implement performance monitoring

3. **Testing**:
   - [ ] Add unit tests for robustness features
   - [ ] Validate accessibility compliance
   - [ ] Test performance under load
   - [ ] Verify error recovery mechanisms

4. **Documentation**:
   - [ ] Document robustness implementations
   - [ ] Update component examples
   - [ ] Include troubleshooting guides

### Troubleshooting

#### Common Issues
1. **CSS Variables Not Loading**: Check CSS import order and robustness initialization
2. **Type Errors**: Ensure design system types are properly imported
3. **Performance Issues**: Use performance monitoring tools to identify bottlenecks
4. **Accessibility Failures**: Check focus indicators and touch target sizes

#### Debug Commands
```typescript
// Check system health
import { validateDesignSystemImplementation } from '@/utils/sprint1ARobustness';
const report = await validateDesignSystemImplementation();
console.log('System Health:', report);

// Force fallback styles
import { loadFallbackStyles } from '@/utils/sprint1ARobustness';
loadFallbackStyles();
```

### Future Enhancements

#### Planned Robustness Features
- Automated performance budgets
- Visual regression testing integration
- A/B testing for design variations
- Advanced accessibility auditing
- Design token synchronization

#### Extension Points
- Custom validation rules
- Performance optimization plugins
- Accessibility enhancement modules
- Development tool integrations

