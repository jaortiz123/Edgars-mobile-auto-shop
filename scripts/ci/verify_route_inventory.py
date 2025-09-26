#!/usr/bin/env python3
"""CI check: route inventory + board envelope + preflight tests."""

import json
import subprocess
import sys
from pathlib import Path


def update_route_inventory() -> list[dict]:
    """Regenerate route inventory JSON."""
    cmd = [sys.executable, "docs/design/discovery/route_analyzer.py"]
    subprocess.run(cmd, check=True, cwd=Path(__file__).parent.parent.parent)

    inventory_path = Path("docs/design/discovery/route_inventory.json")
    if not inventory_path.exists():
        raise SystemExit("Route inventory file not found after running analyzer")

    with inventory_path.open() as f:
        data = json.load(f)

    if not isinstance(data.get("detailed_routes"), list):
        raise SystemExit("Route inventory JSON missing detailed_routes list")

    return data["detailed_routes"]


def assert_board_not_enveloped(routes: list[dict]) -> None:
    """Board endpoint must NOT use _ok/_error envelopes."""
    board_route = next(
        (r for r in routes if r.get("path") == "/api/admin/appointments/board"),
        None,
    )
    if not board_route:
        raise SystemExit("Board route not found in inventory")

    notes = board_route.get("notes", "")
    if "_ok" in notes or "envelope" in notes.lower():
        raise SystemExit("Board route must NOT use _ok envelope")


def assert_preflight_unchanged() -> None:
    """CORS preflight must remain as OPTIONS handler."""
    test_cmd = [
        sys.executable,
        "-m",
        "pytest",
        "backend/tests/test_mobile_appointments_api.py::test_cors_preflight_and_board_contract_intact",
        "-v",
        "--tb=short",
    ]

    result = subprocess.run(test_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("❌ CORS/Board regression test failed:")
        print(result.stdout)
        print(result.stderr)
        raise SystemExit("Preflight test failure")


def main() -> None:
    """Run all route inventory checks."""
    routes = update_route_inventory()
    if not routes:
        raise SystemExit("Route inventory JSON missing detailed_routes list")

    assert_board_not_enveloped(routes)
    assert_preflight_unchanged()

    print("✅ Route inventory regenerated and stop rules verified.")
    print("   - Artifacts: route_inventory.json / route_inventory.csv")


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        print(f"❌ {exc}")
        raise
