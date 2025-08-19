# UI Standards Guide
## Edgar's Mobile Auto Shop Design System

> **Version**: 2.0 - Enhanced with Sprint1A-T-005 improvements
> **Last Updated**: August 4, 2025
> **Status**: Active - Full Typography & Spacing System Implemented

This document serves as the **single source of truth** for typography and spacing standards across Edgar's Mobile Auto Shop application. All developers and designers must reference this guide when implementing UI components.

**🎯 Quick Reference**:
- [Typography Scale](#typography-system) | [Spacing System](#spacing-system) | [Real Examples](#real-world-examples) | [Cheat Sheet](#utility-class-cheat-sheet)

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

### 8px Base Unit System (Enhanced)
All spacing follows an 8px base unit system with micro-spacing support for visual consistency:

```css
/* Core 8px Spacing Scale */
--sp-0: 0;          /* 0px - No spacing */
--sp-0-5: 0.25rem;  /* 4px - Micro spacing */
--sp-1: 0.5rem;     /* 8px - Base unit */
--sp-1-5: 0.75rem;  /* 12px - 1.5x base unit */
--sp-2: 1rem;       /* 16px - 2x base unit */
--sp-3: 1.5rem;     /* 24px - 3x base unit */
--sp-4: 2rem;       /* 32px - 4x base unit */
--sp-5: 2.5rem;     /* 40px - 5x base unit */
--sp-6: 3rem;       /* 48px - 6x base unit */
--sp-7: 3.5rem;     /* 56px - 7x base unit */
--sp-8: 4rem;       /* 64px - 8x base unit */
```

### Spacing Usage Guidelines

#### Margins and Padding
| Class | Size | Use Case | Example |
|-------|------|----------|---------|
| `m-0`, `p-0` | 0px | Remove spacing | Reset default margins |
| `m-0-5`, `p-0-5` | 4px | Micro spacing | Icon gaps, tight layouts |
| `m-1`, `p-1` | 8px | Tight spacing | Button padding, small gaps |
| `m-1-5`, `p-1-5` | 12px | Intermediate spacing | Form field spacing |
| `m-2`, `p-2` | 16px | Standard spacing | Card padding, content spacing |
| `m-3`, `p-3` | 24px | Generous spacing | Section padding, large cards |
| `m-4`, `p-4` | 32px | Large spacing | Major sections, layout spacing |
| `m-5`, `p-5` | 40px | Extra large spacing | Hero sections |
| `m-6`, `p-6` | 48px | Section dividers | Page sections, major dividers |
| `m-7`, `p-7` | 56px | Very large spacing | Landing page sections |
| `m-8`, `p-8` | 64px | Maximum spacing | Major layout spacing |

#### Direction-Specific Classes
All margin and padding classes support directional variants:
- **Top**: `mt-*`, `pt-*`
- **Right**: `mr-*`, `pr-*`
- **Bottom**: `mb-*`, `pb-*`
- **Left**: `ml-*`, `pl-*`
- **Horizontal**: `mx-*`, `px-*`
- **Vertical**: `my-*`, `py-*`

#### Gaps and Space Between Elements
| Class | Size | Use Case |
|-------|------|----------|
| `gap-0-5` | 4px | Micro gaps, icon spacing |
| `gap-1` | 8px | Tight grid/flex gaps |
| `gap-1-5` | 12px | Form element gaps |
| `gap-2` | 16px | Standard grid/flex gaps |
| `gap-3` | 24px | Generous grid/flex gaps |
| `gap-4` | 32px | Large layout gaps |

### Component-Specific Variables
```css
--card-padding: var(--sp-3);      /* 24px */
--card-gap: var(--sp-2);          /* 16px */
--button-padding-y: var(--sp-2);  /* 16px */
--button-padding-x: var(--sp-3);  /* 24px */
```

### Design System Prefixed Classes
For explicit design system usage, prefixed classes are available:
```css
.m-sp-0, .m-sp-0-5, .m-sp-1, .m-sp-1-5, .m-sp-2, .m-sp-3, /* ... */
.p-sp-0, .p-sp-0-5, .p-sp-1, .p-sp-1-5, .p-sp-2, .p-sp-3, /* ... */
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

---

## 🎨 Real-World Examples

This section provides practical, copy-paste examples from our actual components to help developers implement the design system correctly.

### Example 1: Dashboard Revenue Card (RunningRevenue Component)

**Implementation:**
```tsx
// RunningRevenue.tsx
import './RunningRevenue.css';

const RunningRevenue = ({ amount, isLoading, error }) => {
  return (
    <div className="running-revenue p-sp-3 space-y-sp-2">
      <div className="revenue-label text-fs-0 font-semibold text-gray-600">
        TODAY'S REVENUE
      </div>
      {isLoading ? (
        <div className="revenue-skeleton gap-sp-1">
          <div className="skeleton-line"></div>
        </div>
      ) : error ? (
        <div className="text-fs-1 text-red-600 font-medium">
          Error loading revenue
        </div>
      ) : (
        <div className="revenue-amount text-fs-5 font-bold text-green-600">
          ${amount.toLocaleString()}
        </div>
      )}
      <div className="text-fs-1 text-gray-500">
        +12% from yesterday
      </div>
    </div>
  );
};
```

**CSS Implementation:**
```css
/* RunningRevenue.css */
.running-revenue {
  padding: var(--sp-3); /* 24px */
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.revenue-amount {
  font-size: var(--fs-5, 2rem); /* 32px */
  font-weight: 700;
  color: #059669;
  font-feature-settings: 'tnum'; /* Tabular numbers for consistent spacing */
  line-height: 1.2;
}

.revenue-label {
  font-size: var(--fs-0, 0.75rem); /* 12px */
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6b7280;
}

.revenue-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1); /* 8px */
}
```

### Example 2: Dashboard Sidebar Component

**Implementation:**
```tsx
// DashboardSidebar.tsx
const DashboardSidebar = ({ isCollapsed, stats }) => {
  return (
    <div className={`dashboard-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <button
        onClick={toggleSidebar}
        className="p-sp-3 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Menu className="h-6 w-6" />
      </button>

      {!isCollapsed && (
        <div className="space-y-sp-3 p-sp-4">
          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-sp-2 text-fs-2">
                <TrendingUp className="h-6 w-6 text-green-600" />
                📊 Today's Numbers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-sp-5">
              <div className="grid grid-cols-2 gap-sp-4">
                <div className="text-center">
                  <div className="text-fs-3 font-bold text-green-800">
                    {stats.completedToday}
                  </div>
                  <div className="text-fs-1 text-gray-600 font-medium">
                    ✅ Jobs Completed
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-fs-3 font-bold text-orange-800">
                    {stats.pendingAppointments}
                  </div>
                  <div className="text-fs-1 text-gray-600 font-medium">
                    ⏳ Jobs Pending
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Tools */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-sp-2 text-fs-2">
                <Wrench className="h-6 w-6 text-orange-600" />
                🛠️ Shop Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="p-sp-5">
              <div className="grid grid-cols-2 gap-sp-2">
                <QuickToolButton
                  icon="📋"
                  label="Work Orders"
                  onClick={handleWorkOrders}
                />
                <QuickToolButton
                  icon="🔧"
                  label="Parts Lookup"
                  onClick={handlePartsLookup}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

const QuickToolButton = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="p-sp-4 rounded-xl hover:bg-blue-100 transition-colors flex flex-col items-center space-y-sp-2 touch-manipulation"
  >
    <span className="text-fs-3">{icon}</span>
    <span className="font-medium text-fs-0">{label}</span>
  </button>
);
```

### Example 3: Login Form Component

**Implementation:**
```tsx
// Login.tsx
const Login = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-sp-12 px-sp-4 sm:px-sp-6 lg:px-sp-8">
      <div className="max-w-md w-full space-y-sp-8">
        <div>
          <h2 className="mt-sp-6 text-center text-fs-4 font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-sp-2 text-center text-fs-1 text-gray-600">
            Or{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
              create a new account
            </Link>
          </p>
        </div>

        <form className="mt-sp-8 space-y-sp-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-sp-4" role="alert">
              <div className="text-fs-1 text-red-800">{error}</div>
            </div>
          )}

          <div className="space-y-sp-4">
            <div>
              <label htmlFor="email" className="block text-fs-1 font-medium text-gray-700">
                Email address *
              </label>
              <input
                id="email"
                type="email"
                required
                className="mt-sp-1 appearance-none relative block w-full px-sp-3 py-sp-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-fs-1"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-fs-1 font-medium text-gray-700">
                Password *
              </label>
              <div className="mt-sp-1 relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="appearance-none relative block w-full px-sp-3 py-sp-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-fs-1"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-sp-3 flex items-center hover:text-gray-600 focus:outline-none focus:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {/* Eye icon */}
                </button>
              </div>
            </div>
          </div>

          <div>
            <LoadingButton
              type="submit"
              loading={isLoading}
              disabled={!isFormValid}
              className="group relative w-full flex justify-center py-sp-2 px-sp-4 border border-transparent text-fs-1 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </LoadingButton>
          </div>

          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-fs-1 text-blue-600 hover:text-blue-500"
            >
              Forgot your password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};
```

### Example 4: Admin Layout Structure

**Implementation:**
```tsx
// AdminLayout.tsx
const AdminLayout = () => {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-sm border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-sp-6 py-sp-4 border-b border-gray-200">
            <h1 className="text-fs-2 font-bold text-gray-900">Edgar's Admin</h1>
            <p className="text-fs-0 text-gray-500">Mobile Auto Shop</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-sp-4 py-sp-6 space-y-sp-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  group flex items-center px-sp-3 py-sp-2 text-fs-1 font-medium rounded-md transition-colors
                  ${item.current
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <item.icon className="mr-sp-3 h-5 w-5 flex-shrink-0" />
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-sp-4 py-sp-4 border-t border-gray-200">
            <button
              onClick={logout}
              className="group flex items-center w-full px-sp-3 py-sp-2 text-fs-1 font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <LogOut className="mr-sp-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="px-sp-8 py-sp-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
```

---

## 📋 Utility Class Cheat Sheet

### Typography Classes Quick Reference

| Class | Size | Pixels | Usage |
|-------|------|--------|--------|
| `text-fs-0` | 0.75rem | 12px | Captions, timestamps, fine print |
| `text-fs-1` | 0.875rem | 14px | Labels, secondary text, navigation |
| `text-fs-2` | 1rem | 16px | Body text, buttons, primary content |
| `text-fs-3` | 1.25rem | 20px | Subheadings, card titles, emphasis |
| `text-fs-4` | 1.5rem | 24px | Section headings, large buttons |
| `text-fs-5` | 2rem | 32px | Page titles, hero text, stats |
| `text-fs-6` | 2.5rem | 40px | Display headings, marketing copy |

### Spacing Classes Quick Reference

#### Padding Classes
| Class | Size | Pixels | Example Usage |
|-------|------|--------|---------------|
| `p-sp-0` | 0 | 0px | Reset padding |
| `p-sp-0-5` | 0.25rem | 4px | Micro padding, tight layouts |
| `p-sp-1` | 0.5rem | 8px | Button padding, compact spacing |
| `p-sp-1-5` | 0.75rem | 12px | Form fields, intermediate spacing |
| `p-sp-2` | 1rem | 16px | Standard card padding |
| `p-sp-3` | 1.5rem | 24px | Generous card padding |
| `p-sp-4` | 2rem | 32px | Large component padding |
| `p-sp-5` | 2.5rem | 40px | Section padding |
| `p-sp-6` | 3rem | 48px | Major section padding |
| `p-sp-8` | 4rem | 64px | Hero section padding |

#### Margin Classes
| Class | Size | Pixels | Example Usage |
|-------|------|--------|---------------|
| `m-sp-0` | 0 | 0px | Reset margin |
| `m-sp-1` | 0.5rem | 8px | Small element separation |
| `m-sp-2` | 1rem | 16px | Standard element separation |
| `m-sp-3` | 1.5rem | 24px | Section separation |
| `m-sp-4` | 2rem | 32px | Large component separation |
| `m-sp-6` | 3rem | 48px | Major section separation |

#### Directional Classes
**Padding:** `pt-sp-*`, `pr-sp-*`, `pb-sp-*`, `pl-sp-*`, `px-sp-*`, `py-sp-*`
**Margin:** `mt-sp-*`, `mr-sp-*`, `mb-sp-*`, `ml-sp-*`, `mx-sp-*`, `my-sp-*`

#### Gap Classes
| Class | Size | Pixels | Usage |
|-------|------|--------|-------|
| `gap-sp-0-5` | 0.25rem | 4px | Micro gaps, icon spacing |
| `gap-sp-1` | 0.5rem | 8px | Tight grid/flex gaps |
| `gap-sp-2` | 1rem | 16px | Standard grid/flex gaps |
| `gap-sp-3` | 1.5rem | 24px | Generous grid/flex gaps |
| `gap-sp-4` | 2rem | 32px | Large layout gaps |

#### Space Between Classes
| Class | Size | Pixels | Usage |
|-------|------|--------|-------|
| `space-y-sp-1` | 0.5rem | 8px | Tight vertical spacing |
| `space-y-sp-2` | 1rem | 16px | Standard vertical spacing |
| `space-y-sp-3` | 1.5rem | 24px | Generous vertical spacing |
| `space-y-sp-4` | 2rem | 32px | Large vertical spacing |
| `space-x-sp-*` | | | Horizontal equivalents |

### Common Component Patterns

#### Card Component
```tsx
<div className="p-sp-3 space-y-sp-2 bg-white rounded-lg shadow">
  <h3 className="text-fs-3 font-semibold">Title</h3>
  <p className="text-fs-2 text-gray-600">Description</p>
  <div className="flex gap-sp-2 mt-sp-3">
    <button className="px-sp-3 py-sp-2 text-fs-1 bg-blue-600 text-white rounded">
      Action
    </button>
  </div>
</div>
```

#### Form Field
```tsx
<div className="space-y-sp-1">
  <label className="text-fs-1 font-medium text-gray-700">Label</label>
  <input className="p-sp-2 text-fs-2 border rounded w-full" />
  <p className="text-fs-0 text-gray-500">Helper text</p>
</div>
```

#### Navigation Item
```tsx
<Link className="flex items-center px-sp-3 py-sp-2 text-fs-1 font-medium rounded hover:bg-gray-100">
  <Icon className="mr-sp-3 h-5 w-5" />
  Menu Item
</Link>
```

#### Stats Display
```tsx
<div className="text-center space-y-sp-1">
  <div className="text-fs-5 font-bold text-green-600">$2,847</div>
  <div className="text-fs-1 text-gray-500">Today's Revenue</div>
  <div className="text-fs-0 text-gray-400">+12% from yesterday</div>
</div>
```

---

## 🚦 Implementation Best Practices

### ✅ DO
- **Use the design system consistently**: Always prefer `text-fs-2` over `text-base`
- **Include fallbacks**: `font-size: var(--fs-2, 1rem)`
- **Follow the 8px grid**: Use spacing values that align to the grid
- **Apply semantic hierarchy**: Use proper heading levels (h1 → h2 → h3)
- **Test responsively**: Verify scaling at different screen sizes
- **Use tabular numbers**: `font-feature-settings: 'tnum'` for numeric data

### ❌ DON'T
- **Use hardcoded values**: Avoid `font-size: 18px` or `padding: 12px`
- **Skip scale levels**: Don't jump from `fs-1` to `fs-4`
- **Mix systems**: Don't combine old Tailwind classes with design system
- **Ignore accessibility**: Ensure proper contrast and focus states
- **Override without reason**: Stick to the system unless absolutely necessary

### Migration Workflow
1. **Identify** components using old spacing/typography
2. **Map** old values to new design system tokens
3. **Update** classes systematically
4. **Test** visual consistency and functionality
5. **Validate** with automated tests and code review

---

## 🔧 Development Tools & Validation

### Automated Testing
```typescript
// Our spacing validation tests ensure consistency
describe('Design System Validation', () => {
  it('should use typography scale variables', () => {
    // Validates components use --fs-* variables
  });

  it('should use spacing system variables', () => {
    // Validates components use --sp-* variables
  });

  it('should not have old Tailwind classes', () => {
    // Ensures migration completeness
  });
});
```

### Linting Rules
```json
// ESLint configuration for design system enforcement
{
  "rules": {
    "no-hardcoded-spacing": "error",
    "prefer-design-system-typography": "error",
    "spacing-grid-compliance": "warn"
  }
}
```

### Browser DevTools
Use these CSS selectors to audit components:
```css
/* Find elements not using design system */
*:not([class*="text-fs-"]):not([style*="var(--fs-"]) {
  outline: 2px solid red !important;
}

*:not([class*="-sp-"]):not([style*="var(--sp-"]) {
  outline: 2px solid orange !important;
}
```

---

## 📚 Additional Resources

### Design System Files
- `/src/styles/theme.css` - Core variables and tokens
- `/src/styles/typography.css` - Typography utilities
- `/src/styles/spacing.css` - Spacing utilities
- `/frontend/tests/spacing-validation.test.ts` - Automated validation

### External References
- [CSS Custom Properties (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
- [Modular Scale Calculator](https://www.modularscale.com/)
- [8-Point Grid System](https://spec.fm/specifics/8-pt-grid)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### Team Support
- **Slack**: #design-system channel for questions
- **Code Reviews**: Design system compliance checks
- **Office Hours**: Weekly design system Q&A sessions
- **Documentation**: Living style guide with interactive examples

---

**📖 This guide is actively maintained and updated with each sprint. For questions or suggestions, reach out via the #design-system Slack channel.**
