#!/usr/bin/env python3
"""
Refactoring Progress Tracker for Edgar's Mobile Auto Shop
Helps track what you've extracted from local_server.py during refactoring
"""

import os
import re


def track_refactoring_progress():
    """Track what's been extracted from the monolith"""

    original_file = "backend/local_server.py"

    if not os.path.exists(original_file):
        print("❌ local_server.py not found")
        return

    # Check what files have been created
    new_structure = {
        "utils": [
            "backend/utils/auth.py",
            "backend/utils/database.py",
            "backend/utils/validators.py",
            "backend/utils/formatters.py",
            "backend/utils/helpers.py",
        ],
        "services": [
            "backend/services/invoice_service.py",
            "backend/services/appointment_service.py",
            "backend/services/customer_service.py",
            "backend/services/vehicle_service.py",
            "backend/services/messaging_service.py",
            "backend/services/service_operations.py",
        ],
        "routes": [
            "backend/routes/admin_routes.py",
            "backend/routes/appointments_routes.py",
            "backend/routes/customers_routes.py",
            "backend/routes/auth_routes.py",
        ],
        "config": [
            "backend/config/settings.py",
            "backend/config/database.py",
            "backend/config/logging.py",
        ],
        "app": ["backend/app.py", "backend/main.py"],
    }

    # Get current monolith stats
    with open(original_file) as f:
        content = f.read()
        lines = content.split("\n")

    current_stats = {
        "total_lines": len(lines),
        "routes": len(re.findall(r"@app\.route", content)),
        "functions": len(re.findall(r"^def ", content, re.MULTILINE)),
        "sql_ops": len(re.findall(r"(SELECT|INSERT|UPDATE|DELETE|CREATE)", content, re.IGNORECASE)),
    }

    print("🎯 " + "=" * 60)
    print("📊 REFACTORING PROGRESS TRACKER")
    print("🎯 " + "=" * 60)
    print(f"📏 Current Monolith: {current_stats['total_lines']:,} lines")
    print(f"🛣️ Routes Remaining: {current_stats['routes']}")
    print(f"⚙️ Functions Remaining: {current_stats['functions']}")
    print(f"🗄️ SQL Operations: {current_stats['sql_ops']}")

    print("\n📁 NEW FILE STRUCTURE")
    print("=" * 50)

    total_created = 0
    total_expected = 0

    for category, files in new_structure.items():
        created_count = sum(1 for f in files if os.path.exists(f))
        total_created += created_count
        total_expected += len(files)

        progress = "✅" if created_count == len(files) else "🔄" if created_count > 0 else "⏳"
        print(f"  {progress} {category.upper()}: {created_count}/{len(files)} files")

        for file_path in files:
            status = "✅" if os.path.exists(file_path) else "⏳"
            file_name = os.path.basename(file_path)
            if os.path.exists(file_path):
                with open(file_path) as f:
                    file_lines = len(f.readlines())
                print(f"     {status} {file_name} ({file_lines} lines)")
            else:
                print(f"     {status} {file_name} (not created)")
        print()

    # Calculate progress
    progress_percent = (total_created / total_expected) * 100 if total_expected > 0 else 0

    print(f"📈 OVERALL PROGRESS: {total_created}/{total_expected} files ({progress_percent:.1f}%)")

    # Show next recommended steps
    print("\n🎯 NEXT STEPS")
    print("=" * 50)

    if not os.path.exists("backend/utils/auth.py"):
        print("1. 🔐 START HERE: Extract authentication utilities")
        print("   - Create backend/utils/auth.py")
        print("   - Move require_auth_role(), maybe_auth() functions")
        print("   - Test admin routes still work")
    elif not os.path.exists("backend/utils/database.py"):
        print("2. 🗄️ NEXT: Extract database utilities")
        print("   - Create backend/utils/database.py")
        print("   - Move connection management, cursor patterns")
        print("   - Test all routes still work")
    elif not os.path.exists("backend/services/invoice_service.py"):
        print("3. 💰 THEN: Extract invoice service (biggest domain)")
        print("   - Create backend/services/invoice_service.py")
        print("   - Move 10 invoice routes + business logic")
        print("   - Test billing functionality")
    else:
        print("🎉 Great progress! Continue with remaining services and routes.")

    print("\n💡 TIP: Run this tracker after each extraction to monitor progress!")


if __name__ == "__main__":
    track_refactoring_progress()
