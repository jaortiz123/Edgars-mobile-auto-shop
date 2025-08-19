# Frontend Playbook

This document summarizes the guidelines for building the customer and admin interfaces.

## 1. Core Philosophy
- **Calm, Clear & Capable** user experience.
- Customers should feel guided and in control.
- Admins should have fast, utilitarian tools.

## 2. Design System (tailwind.config.js)

### Colors
```
theme: {
  colors: {
    primary: { DEFAULT: '#2563EB', light: '#3B82F6', dark: '#1D4ED8' },
    secondary: '#4B5563',
    gray: { '50': '#F9FAFB', '100': '#F3F4F6', '300': '#D1D5DB', '500': '#6B7280', '700': '#374151', '900': '#111827' },
    success: '#16A34A',
    warning: '#F59E0B',
    error: '#DC2626',
    white: '#FFFFFF',
    black: '#000000',
    transparent: 'transparent',
  }
}
```

### Typography
- **Inter** font via Google Fonts
- Sizes: `text-sm` 14px, `text-base` 16px, `text-lg` 18px, `text-xl` 20px, `text-2xl` 24px, `text-4xl` 36px, `text-5xl` 48px
- Font weights: 400, 500, 600, 700

### Spacing & Sizing
- 4px base unit: `space-1` = 4px up to `space-16` = 64px
- Minimum touch target height: 48px

### Borders & Shadows
- Radii: `rounded-lg` (8px), `rounded-2xl` (16px), `rounded-full`
- Shadows: `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`

### Iconography
- Use **lucide-react** for consistent icons.

## 3. Component Library
- **Button**: variants `primary`, `secondary`, `destructive`; states for hover, focus, disabled.
- **Card**: padded container with optional hover state.
- **BookingStepper**: multi-step booking form with managed state.
- **DashboardTable**: responsive table that collapses to cards on mobile.

## 4. Views
- **Landing Page**: hero, how-it-works, service cards, testimonials, CTA.
- **Booking Flow**: `BookingStepper` guiding service selection and user info.
- **Confirmation Page**: appointment summary and actions.
- **Admin Login/Dashboard**: sidebar navigation, statistics cards, appointments table.

## 5. Performance Checklist
- Aim for Lighthouse >95, LCP <2.5s, initial JS <150KB.
- Optimize images, code split heavy components, lazy load off-screen assets.
- Use Brotli/Gzip and `font-display: swap`.

## 6. Motion
- Use **Framer Motion** with short, purposeful animations (~0.2s ease-out).

## 7. Testing
- **Vitest** for unit/integration tests.
- **Playwright** for E2E flows and visual regression.
