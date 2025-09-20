#!/usr/bin/env python3
"""
Test Status Board schema updates
Validates that the new columns and functionality work correctly
"""

import os
import sys
import traceback

# Add the backend path to system path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from datetime import datetime

from backend.domain.appointments.service import AppointmentService
from backend.infra.lazy_db import get_db_manager


def test_schema_update():
    """Test that the schema update worked"""
    try:
        print("🔍 Testing Status Board schema updates...")

        # Get database manager
        db = get_db_manager()

        # Test 1: Check if new columns exist
        print("📋 Testing new appointments table columns...")

        schema_query = """
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'appointments'
        AND table_schema = 'public'
        ORDER BY column_name
        """

        columns = db.query(schema_query)
        column_names = [row["column_name"] if isinstance(row, dict) else row[0] for row in columns]

        required_columns = [
            "status",
            "position",
            "check_in_at",
            "check_out_at",
            "tech_id",
            "total_amount",
            "paid_amount",
            "version",
        ]

        print(f"Found columns: {sorted(column_names)}")

        for col in required_columns:
            if col in column_names:
                print(f"  ✅ {col} - exists")
            else:
                print(f"  ❌ {col} - missing")
                return False

        # Test 2: Check indices exist
        print("🔍 Testing Status Board indices...")

        index_query = """
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'appointments'
        AND schemaname = 'public'
        """

        indices = db.query(index_query)
        index_names = [row["indexname"] if isinstance(row, dict) else row[0] for row in indices]

        required_indices = ["idx_appointments_status_position", "idx_appointments_date_status"]

        for idx in required_indices:
            if idx in index_names:
                print(f"  ✅ {idx} - exists")
            else:
                print(f"  ❌ {idx} - missing")

        # Test 3: Test Status Board service methods
        print("🧪 Testing Status Board service methods...")

        service = AppointmentService(db)

        # Test get_board method
        today = datetime.now().strftime("%Y-%m-%d")
        board_result = service.get_board(today)

        if "board" in board_result and "stats" in board_result:
            print("  ✅ get_board() method works")
            print(f"     Board has {len(board_result['board'])} status columns")
            print(f"     Stats: {board_result['stats']}")
        else:
            print("  ❌ get_board() method failed")
            return False

        print("✅ Status Board schema update validation successful!")
        return True

    except Exception as e:
        print(f"❌ Schema validation failed: {e}")
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_schema_update()
    sys.exit(0 if success else 1)
