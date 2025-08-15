# Technical Debt Log

This document tracks known technical debt in the project to be addressed in future sprints.

## Backend

### 1. Batch Endpoint for Adding Appointment Services

* **Issue**: The current implementation for adding services to an appointment (`AppointmentDrawer.tsx`) sends one `POST` request per new service sequentially.
* **Desired State**: The backend should expose a single, atomic batch endpoint, such as `POST /api/appointments/{id}/services`, that accepts an array of service objects to create.
* **Reasoning**: A batch endpoint would be more performant, reduce network overhead, and ensure that adding multiple services is an atomic transaction, simplifying error handling on the client.

### 2. Batch Endpoint for Deleting Appointment Services

* **Issue**: Current deletion flow issues one `DELETE /api/appointments/{id}/services/{serviceId}` request per removed service sequentially.
* **Desired State**: Provide a single endpoint such as `DELETE /api/appointments/{id}/services` (body: list of service IDs) or `POST /api/appointments/{id}/services:batch-delete` to remove multiple services atomically.
* **Reasoning**: Reduces network chatter, shortens total deletion latency, and allows atomic rollback semantics (all-or-nothing) simplifying client error handling.
