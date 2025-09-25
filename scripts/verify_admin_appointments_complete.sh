#!/usr/bin/env bash
# End-to-End Verification Artifacts for Admin→Appointments Slice
# Generated: $(date)
set -euo pipefail

echo "🔍 ADMIN→APPOINTMENTS SLICE VERIFICATION"
echo "========================================"

# 1. File Existence Proof
echo -e "\n📁 FILE EXISTENCE VERIFICATION"
echo "------------------------------"
bash scripts/verify_slice_files.sh

# 2. Route Registration Proof
echo -e "\n🛤️  ROUTE REGISTRATION VERIFICATION"
echo "-----------------------------------"
cd /Users/jesusortiz/Edgars-mobile-auto-shop
PYTHONPATH=/Users/jesusortiz/Edgars-mobile-auto-shop python -c "
from backend.app import create_app
app = create_app()
admin_routes = []
for rule in app.url_map.iter_rules():
    if 'admin' in str(rule) and 'appointment' in str(rule):
        admin_routes.append(f'{list(rule.methods)} {rule.rule}')

print('Registered admin appointment routes:')
for route in sorted(admin_routes):
    print(f'  ✅ {route}')
print(f'Total: {len(admin_routes)} routes')
assert len(admin_routes) == 5, f'Expected 5 routes, got {len(admin_routes)}'
print('✅ All 5 expected routes registered')
"

# 3. Test Execution Proof
echo -e "\n🧪 TEST EXECUTION VERIFICATION"
echo "------------------------------"
PYTHONPATH=/Users/jesusortiz/Edgars-mobile-auto-shop python -m pytest tests/unit/test_appointment_service.py tests/smoke/test_admin_appointments.py -v --tb=no -q

# 4. OpenAPI Specification Proof
echo -e "\n📋 OPENAPI SPECIFICATION VERIFICATION"
echo "-------------------------------------"
python -c "
import json
with open('api_v1_baseline.json', 'r') as f:
    spec = json.load(f)

paths = spec.get('paths', {})
admin_appt_paths = [path for path in paths.keys() if '/api/admin/appointments' in path]

print('OpenAPI admin appointment endpoints:')
for path in sorted(admin_appt_paths):
    methods = list(paths[path].keys())
    print(f'  ✅ {path}: {methods}')

print(f'Total: {len(admin_appt_paths)} paths')
assert len(admin_appt_paths) >= 3, f'Expected at least 3 paths, got {len(admin_appt_paths)}'

# Check for idempotency support
has_idempotency = any('IdempotencyKey' in str(paths[path]) for path in admin_appt_paths)
print(f'Idempotency-Key support: {\"✅\" if has_idempotency else \"❌\"}')
assert has_idempotency, 'Missing X-Idempotency-Key support in OpenAPI spec'
print('✅ OpenAPI specification complete')
"

# 5. API Diff Verification
echo -e "\n🔄 API BASELINE DIFF VERIFICATION"
echo "---------------------------------"
if [ -f "api_v1_baseline.json.bak" ]; then
    echo "Comparing with previous baseline..."
    if command -v jq > /dev/null; then
        NEW_PATHS=$(jq '.paths | keys | length' api_v1_baseline.json)
        OLD_PATHS=$(jq '.paths | keys | length' api_v1_baseline.json.bak)
        echo "Previous paths: $OLD_PATHS"
        echo "Current paths: $NEW_PATHS"
        echo "Added paths: $((NEW_PATHS - OLD_PATHS))"
    else
        echo "jq not available for detailed diff"
    fi
else
    echo "No previous baseline for comparison"
fi

echo -e "\n✅ VERIFICATION COMPLETE"
echo "========================"
echo "Admin→Appointments slice is fully implemented and verified:"
echo "  ✅ All files present"
echo "  ✅ Routes registered correctly"
echo "  ✅ Tests passing"
echo "  ✅ OpenAPI specification updated"
echo "  ✅ Idempotency headers supported"
echo ""
echo "Ready for integration testing with real database."
echo "Set DB environment variables and run:"
echo "  export DB_HOST=localhost DB_NAME=edgar_shop DB_USER=postgres DB_PASSWORD=..."
echo "  pytest tests/integration/test_admin_appointments_repo.py -v"
