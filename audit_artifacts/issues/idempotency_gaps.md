# API Audit: Implement Idempotency for Critical POST Endpoints

Total: 33 (HIGH: 22, NORMAL: 11)

- [HIGH] GET|POST /admin/appointments — Consumer: Internal
- [HIGH] GET|POST /api/admin/appointments — Consumer: Frontend
- [HIGH] POST /api/admin/appointments/<appt_id>/invoice — Consumer: Frontend
- [HIGH] POST /api/admin/invoices/<invoice_id>/add-package — Consumer: Internal
- [HIGH] POST /api/admin/invoices/<invoice_id>/payments — Consumer: Internal
- [HIGH] POST /api/admin/invoices/<invoice_id>/send — Consumer: Internal
- [HIGH] POST /api/admin/invoices/<invoice_id>/void — Consumer: Internal
- [HIGH] GET|POST /api/admin/service-operations — Consumer: Frontend
- [HIGH] POST /api/admin/vehicles — Consumer: Frontend
- [HIGH] POST /api/admin/vehicles/<vid>/transfer — Consumer: Frontend
- [HIGH] POST /api/appointments/<appt_id>/check-in — Consumer: Frontend
- [HIGH] POST /api/appointments/<appt_id>/check-out — Consumer: Frontend
- [HIGH] POST /api/appointments/<appt_id>/complete — Consumer: Frontend
- [HIGH] GET|POST /api/appointments/<appt_id>/messages — Consumer: Frontend
- [HIGH] POST /api/appointments/<appt_id>/ready — Consumer: Frontend
- [HIGH] GET|POST /api/appointments/<appt_id>/services — Consumer: Frontend
- [HIGH] POST /api/appointments/<appt_id>/start — Consumer: Frontend
- [HIGH] POST /appointments/<appt_id>/check-in — Consumer: Internal
- [HIGH] POST /appointments/<appt_id>/check-out — Consumer: Internal
- [HIGH] POST /appointments/<appt_id>/complete — Consumer: Internal
- [HIGH] POST /appointments/<appt_id>/ready — Consumer: Internal
- [HIGH] POST /appointments/<appt_id>/start — Consumer: Internal
- POST /api/admin/login — Consumer: Internal
- GET|POST /api/admin/message-templates — Consumer: Internal
- POST /api/admin/staff/memberships — Consumer: Internal
- POST /api/admin/template-usage — Consumer: Internal
- POST /api/auth/logout — Consumer: Frontend
- POST /api/auth/request-password-reset — Consumer: Internal
- POST /api/auth/reset-password — Consumer: Internal
- POST /api/customers — Consumer: Frontend
- POST /api/customers/login — Consumer: Frontend
- POST /api/customers/register — Consumer: Frontend
- POST /api/logout — Consumer: Internal
