#!/usr/bin/env bash
set -euo pipefail
missing=0
check() { [[ -f "$1" ]] && echo "✅ $1" || { echo "❌ MISSING: $1"; missing=1; }; }
check backend/api/v1/admin/appointments/routes.py
check backend/api/v1/admin/appointments/schemas.py
check backend/domain/appointments/service.py
check backend/domain/appointments/repository.py
check backend/domain/appointments/errors.py
check tests/smoke/test_admin_appointments.py
check tests/unit/test_appointment_service.py
exit $missing
