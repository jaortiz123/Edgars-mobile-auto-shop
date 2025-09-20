#!/usr/bin/env python3
"""Verification script: Admin appointments route registration"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))


def verify_routes():
    try:
        from app import create_app

        app = create_app()
        registered_routes = []
        for rule in app.url_map.iter_rules():
            if rule.endpoint.startswith("admin_appt_bp"):
                registered_routes.append(f"{rule.methods} {rule.rule}")

        expected_routes = [
            "GET /api/v1/admin/appointments",
            "POST /api/v1/admin/appointments",
            "GET /api/v1/admin/appointments/<id>",
            "PUT /api/v1/admin/appointments/<id>",
            "PATCH /api/v1/admin/appointments/<id>",
        ]

        print("🔍 Checking Admin Appointments Route Registration:")
        all_found = True
        for route in expected_routes:
            found = any(route in r for r in registered_routes)
            status = "✅" if found else "❌ MISSING"
            print(f"{status} {route}")
            all_found = all_found and found

        return all_found
    except Exception as e:
        print(f"❌ Route verification failed: {e}")
        return False


if __name__ == "__main__":
    sys.exit(0 if verify_routes() else 1)
