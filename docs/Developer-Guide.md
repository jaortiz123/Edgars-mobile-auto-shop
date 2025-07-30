# Developer Guide

This guide provides technical details for developers working on the Edgar's Mobile Auto Shop application.

## Quick Add Appointment Flow

...

## Scheduling Intelligence

...

## Appointment Reminders System

This section details the implementation of the appointment reminders system.

### Countdown Timers

- **Helper:** `src/lib/time.js` (`getMinutesUntil`)
- **Integration:** Used in `src/components/admin/AppointmentCard.tsx` to display a live countdown to the appointment start time.

### Starting Soon Notifications

- **Service:** `src/lib/notificationService.ts`
- **Functions:** `scheduleReminder(appointment, minutesBefore)`, `addNotification(message)`
- **Integration:** In `src/admin/Dashboard.tsx`, `scheduleReminder` is called for today's appointments. `addNotification` is used to log notifications and can be used to trigger toasts.

### Customer Arrived Check-In

- **Component:** `src/components/admin/ArrivalButton.tsx`
- **Service:** `src/lib/api.ts` (`markArrived`)
- **Integration:** The `ArrivalButton` is rendered in `src/components/admin/AppointmentCard.tsx` for upcoming appointments. Clicking it calls `markArrived` to update the appointment status.

### Running Late and Overdue Alerts

- **Helper:** `src/lib/time.js` (`minutesPast`)
- **Service:** `src/lib/notificationService.ts` (`addNotification`)
- **Integration:** In `src/components/admin/AppointmentCard.tsx`, `minutesPast` is used to determine if an appointment is running late or overdue. `addNotification` is used to send alerts to the `NotificationCenter`.

