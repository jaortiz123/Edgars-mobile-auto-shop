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

#### Design System Evolution
- Integration with design tokens
- Advanced theming capabilities
- Component composition patterns
- Design tool integration

## Daily Dashboard Hero

...

## Quick Add Appointment Flow

...

## Scheduling Intelligence

...

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
