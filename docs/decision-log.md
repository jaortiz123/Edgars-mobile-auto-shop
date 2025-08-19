# Decision Log - Edgar's Auto Shop

## Architecture Decisions

### ADR-001: React + TypeScript Frontend (2025-07-20)
**Status**: Adopted
**Context**: Need modern, type-safe frontend for admin dashboard
**Decision**: Use React with TypeScript, Vite build tool, Tailwind CSS
**Consequences**: Fast development, good type safety, modern dev experience

### ADR-002: Flask Backend with PostgreSQL (2025-07-21)
**Status**: Adopted
**Context**: Need reliable backend for appointment management
**Decision**: Python Flask with PostgreSQL database
**Consequences**: Familiar stack, good SQL support, easy AWS Lambda deployment

### ADR-003: AWS Lambda for SMS Reminders (2025-07-22)
**Status**: Adopted
**Context**: Need automated, scalable reminder system
**Decision**: Use AWS Lambda with CloudWatch Events for scheduling
**Consequences**: Serverless scaling, cost-effective, reliable scheduling

### ADR-004: JWT Authentication (2025-07-23)
**Status**: Adopted
**Context**: Need secure customer authentication
**Decision**: JWT tokens with bcrypt password hashing
**Consequences**: Stateless auth, good security, scalable

## Technical Decisions

### TDE-001: Time Format Handling (2025-07-24)
**Status**: In Progress
**Context**: Frontend uses 12-hour format, backend needs ISO strings
**Decision**: Create conversion utility to handle 12-hour to 24-hour format
**Alternatives Considered**: Change UI to 24-hour format, handle conversion in backend
**Rationale**: UI should remain user-friendly, conversion closest to source is clearest

### TDE-002: Error Handling Strategy (2025-07-24)
**Status**: Adopted
**Context**: Need consistent error handling across frontend/backend
**Decision**: Structured error responses with user-friendly messages
**Implementation**: Backend returns standardized error objects, frontend displays appropriate UI

### TDE-003: Emergency Appointment Flow (2025-07-24)
**Status**: Adopted
**Context**: Walk-in customers need immediate scheduling
**Decision**: Special appointment type with auto-generated datetime
**Implementation**: Frontend sets current time, backend handles as "in-progress" status

## Business Decisions

### BDE-001: SMS Opt-out Compliance (2025-07-22)
**Status**: Adopted
**Context**: Legal requirement for SMS marketing compliance
**Decision**: Implement STOP keyword handling and opt-out tracking
**Implementation**: Lambda function processes opt-out requests, updates customer preferences

### BDE-002: Mobile-First Design (2025-07-21)
**Status**: Adopted
**Context**: Edgar often uses mobile device for business
**Decision**: Design admin interface to work well on mobile
**Implementation**: Responsive design, touch-friendly buttons, simplified navigation
