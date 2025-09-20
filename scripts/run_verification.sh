#!/usr/bin/env bash
# Verification runner for Admin→Appointments slice
set -euo pipefail

echo "🔍 Running Admin Appointments Slice Verification..."
echo "================================================="

# 1. File existence check
echo "📁 Checking file existence..."
if bash scripts/verify_slice_files.sh; then
    echo "✅ All files present"
else
    echo "❌ Files missing - cannot proceed"
    exit 1
fi

# 2. Route registration check
echo -e "\n🛤️  Checking route registration..."
cd backend && python -c "
from app import create_app
app = create_app()
routes = [str(rule) for rule in app.url_map.iter_rules() if 'admin' in str(rule)]
print('Admin routes found:', len(routes))
for route in routes: print(' -', route)
"

# 3. Smoke test execution
echo -e "\n🔥 Running smoke tests..."
cd .. && python -m pytest tests/smoke/test_admin_appointments.py -v

# 4. Unit test execution
echo -e "\n🧪 Running unit tests..."
python -m pytest tests/unit/test_appointment_service.py -v

echo -e "\n✅ Verification complete"
