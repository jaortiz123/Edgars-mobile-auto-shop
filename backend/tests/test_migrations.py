"""
Migration verification tests (T-010)

This module contains automated tests to verify that database migrations
correctly handle data transformations and maintain data integrity.

USAGE:
------
Run all migration tests:
    pytest tests/test_migrations.py -v

Run specific test:
    pytest tests/test_migrations.py::test_canonical_timestamps_migration_handles_start_ts_nulls -v

IMPLEMENTATION NOTES:
--------------------
- Uses SQLite in-memory databases for fast, isolated testing
- Simulates the canonical timestamps migration logic from alembic/versions/abcdef123456_canonical_timestamps.py
- Tests multiple NULL/non-NULL scenarios to ensure robust migration handling
- Uses sqlalchemy.text() for SQL queries as required by T-010 specification

KEY ASSERTIONS:
--------------
1. COUNT(*) WHERE start_ts IS NULL equals expected count based on input data
2. All appointments with valid scheduled_date get proper start_ts values
3. NULL handling matches the actual migration logic
4. Edge cases (date-only, time-only, both NULL) are handled correctly
"""

import pytest
import tempfile
import os
from sqlalchemy import create_engine, text


def test_canonical_timestamps_migration_handles_start_ts_nulls():
    """
    T-010: Migration verification for canonical timestamps (start_ts field)

    Verifies that the canonical timestamps migration correctly handles the start_ts
    field by:
    1. Creating a temporary SQLite database
    2. Setting up test data with various NULL/non-NULL scenarios
    3. Simulating the migration logic (since Alembic migration is PostgreSQL-specific)
    4. Asserting no NULL start_ts rows exist after migration for valid appointments

    NOTE: This test simulates the migration logic rather than using alembic.command.upgrade()
    because the actual migration is designed for PostgreSQL syntax and would require
    a more complex setup to run Alembic migrations against SQLite.
    """
    # Create temporary SQLite database file path
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_db:
        db_path = tmp_db.name
    sqlite_url = f"sqlite:///{db_path}"

    engine = create_engine(sqlite_url)
    try:
        # Pre-migration schema & seed data
        with engine.begin() as conn:
            conn.execute(
                text(
                    """CREATE TABLE appointments (
                    id INTEGER PRIMARY KEY,
                    customer_id INTEGER,
                    vehicle_id INTEGER,
                    status TEXT DEFAULT 'SCHEDULED',
                    start TIMESTAMP,
                    "end" TIMESTAMP,
                    scheduled_date DATE,
                    scheduled_time TIME,
                    total_amount NUMERIC(10,2),
                    paid_amount NUMERIC(10,2) DEFAULT 0,
                    check_in_at TIMESTAMP,
                    check_out_at TIMESTAMP,
                    tech_id TEXT,
                    title TEXT,
                    notes TEXT,
                    position INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted_at TIMESTAMP
                )"""
                )
            )

            conn.execute(
                text(
                    "INSERT INTO appointments (id, start, \"end\", notes) VALUES (1, '2025-07-29 10:00:00', '2025-07-29 11:00:00', 'Has start/end fields')"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO appointments (id, scheduled_date, scheduled_time, notes) VALUES (2, '2025-07-29', '14:30:00', 'Has scheduled_date and scheduled_time')"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO appointments (id, scheduled_date, notes) VALUES (3, '2025-07-30', 'Has only scheduled_date')"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO appointments (id, notes) VALUES (4, 'No scheduling info - should be NULL')"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO appointments (id, start, scheduled_date, scheduled_time, notes) VALUES (5, '2025-07-31 09:00:00', '2025-07-31', '10:00:00', 'start field should take precedence')"
                )
            )

            assert conn.execute(text("SELECT COUNT(*) FROM appointments")).scalar() == 5

        # Migration simulation
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE appointments ADD COLUMN start_ts TIMESTAMP"))
            conn.execute(text("ALTER TABLE appointments ADD COLUMN end_ts TIMESTAMP"))
            conn.execute(
                text(
                    """UPDATE appointments
                SET start_ts = COALESCE(
                    start_ts,
                    start,
                    CASE
                        WHEN scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL THEN datetime(scheduled_date || ' ' || scheduled_time)
                        WHEN scheduled_date IS NOT NULL THEN datetime(scheduled_date || ' 00:00:00')
                        ELSE NULL
                    END
                )"""
                )
            )
            conn.execute(
                text(
                    """UPDATE appointments
                SET end_ts = COALESCE(
                    end_ts,
                    "end",
                    datetime(start_ts, '+1 hour')
                )
                WHERE start_ts IS NOT NULL"""
                )
            )
            conn.execute(text("CREATE INDEX ix_appointments_start_ts ON appointments (start_ts)"))

        # Verification
        with engine.connect() as conn:
            null_start_ts_count = conn.execute(
                text("SELECT COUNT(*) FROM appointments WHERE start_ts IS NULL")
            ).scalar()
            assert null_start_ts_count == 1
            rows = conn.execute(
                text("SELECT id, start_ts FROM appointments ORDER BY id")
            ).fetchall()
            # id 4 should be only NULL
            assert [r[0] for r in rows if r[1] is None] == [4]
            # index exists
            assert (
                conn.execute(
                    text(
                        "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='ix_appointments_start_ts'"
                    )
                ).scalar()
                == 1
            )
    finally:
        try:
            os.unlink(db_path)
        except OSError:
            pass


def test_migration_verification_sql_helper():
    """
    T-010: SQL helper verification for migration testing

    This test demonstrates how to use SQLAlchemy text() queries to verify
    migration results, which can be used as a helper pattern for other
    migration tests.
    """
    # Create in-memory SQLite database for testing
    engine = create_engine("sqlite:///:memory:")

    with engine.connect() as conn:
        # Create test table
        conn.execute(
            text(
                "CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT, timestamp_field TIMESTAMP)"
            )
        )

        # Insert test data with some NULL timestamps
        conn.execute(
            text(
                "INSERT INTO test_table (id, name, timestamp_field) VALUES (1, 'valid', '2025-07-29 10:00:00')"
            )
        )
        conn.execute(
            text(
                "INSERT INTO test_table (id, name, timestamp_field) VALUES (2, 'null_timestamp', NULL)"
            )
        )
        conn.execute(
            text(
                "INSERT INTO test_table (id, name, timestamp_field) VALUES (3, 'another_valid', '2025-07-29 11:00:00')"
            )
        )

        # Test the SQL helper pattern using sqlalchemy text()
        null_count = conn.execute(
            text("SELECT COUNT(*) FROM test_table WHERE timestamp_field IS NULL")
        ).scalar()
        assert null_count == 1, "Should find exactly 1 NULL timestamp"

        # Test positive case - non-NULL count
        non_null_count = conn.execute(
            text("SELECT COUNT(*) FROM test_table WHERE timestamp_field IS NOT NULL")
        ).scalar()
        assert non_null_count == 2, "Should find exactly 2 non-NULL timestamps"

        # Test that we can use parameterized queries with text()
        specific_count = conn.execute(
            text("SELECT COUNT(*) FROM test_table WHERE name = :name"), {"name": "valid"}
        ).scalar()
        assert specific_count == 1, "Should find exactly 1 row with name 'valid'"


def test_migration_ensures_no_null_start_ts_for_valid_appointments():
    """
    T-010: Core requirement test - Ensure COUNT where start_ts IS NULL = 0 for appointments with valid scheduled_date

    This test specifically verifies the manual checklist requirement that after migration,
    there should be zero NULL start_ts rows for appointments that have valid scheduling data.
    """
    # Create in-memory SQLite database
    engine = create_engine("sqlite:///:memory:")

    with engine.connect() as conn:
        # Create appointments table with test data that should all have valid start_ts after migration
        conn.execute(
            text(
                """
            CREATE TABLE appointments (
                id INTEGER PRIMARY KEY,
                scheduled_date DATE,
                scheduled_time TIME,
                notes TEXT
            )
        """
            )
        )

        # Insert only appointments with valid scheduled_date (should all get start_ts after migration)
        test_data = [
            (1, "2025-07-29", "10:00:00", "Morning appointment"),
            (2, "2025-07-29", "14:30:00", "Afternoon appointment"),
            (
                3,
                "2025-07-30",
                None,
                "Date only appointment",
            ),  # This should get start_ts as midnight
            (4, "2025-07-31", "09:15:00", "Early appointment"),
        ]

        for apt_id, sched_date, sched_time, notes in test_data:
            if sched_time:
                conn.execute(
                    text(
                        "INSERT INTO appointments (id, scheduled_date, scheduled_time, notes) VALUES (:id, :date, :time, :notes)"
                    ),
                    {"id": apt_id, "date": sched_date, "time": sched_time, "notes": notes},
                )
            else:
                conn.execute(
                    text(
                        "INSERT INTO appointments (id, scheduled_date, notes) VALUES (:id, :date, :notes)"
                    ),
                    {"id": apt_id, "date": sched_date, "notes": notes},
                )

        # Add start_ts column and run migration
        conn.execute(text("ALTER TABLE appointments ADD COLUMN start_ts TIMESTAMP"))

        # Apply the canonical timestamps migration logic
        conn.execute(
            text(
                """
            UPDATE appointments
            SET start_ts = CASE
                WHEN scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL
                    THEN datetime(scheduled_date || ' ' || scheduled_time)
                WHEN scheduled_date IS NOT NULL
                    THEN datetime(scheduled_date || ' 00:00:00')
                ELSE NULL
            END
        """
            )
        )

        # T-010 CORE VERIFICATION: Assert COUNT where start_ts IS NULL = 0 for valid appointments
        null_start_ts_count = conn.execute(
            text("SELECT COUNT(*) FROM appointments WHERE start_ts IS NULL")
        ).scalar()

        # Since all our test appointments have valid scheduled_date, we expect ZERO NULL start_ts rows
        assert null_start_ts_count == 0, (
            f"Migration verification FAILED: Found {null_start_ts_count} appointments with NULL start_ts. "
            "Expected 0 NULL start_ts rows for appointments with valid scheduled_date. "
            "This indicates the migration did not properly backfill the start_ts field."
        )

        # Additional verification: Ensure all appointments have start_ts
        total_appointments = conn.execute(text("SELECT COUNT(*) FROM appointments")).scalar()
        non_null_start_ts = conn.execute(
            text("SELECT COUNT(*) FROM appointments WHERE start_ts IS NOT NULL")
        ).scalar()

        assert (
            total_appointments == non_null_start_ts
        ), f"Expected all {total_appointments} appointments to have start_ts, but only {non_null_start_ts} do"

        # Verify specific cases are handled correctly
        results = conn.execute(
            text(
                "SELECT id, scheduled_date, scheduled_time, start_ts FROM appointments ORDER BY id"
            )
        ).fetchall()

        # Case with both date and time
        apt1 = results[0]
        assert apt1[3] == "2025-07-29 10:00:00", f"Expected '2025-07-29 10:00:00', got {apt1[3]}"

        # Case with date only (should default to midnight)
        apt3 = results[2]
        assert apt3[3] == "2025-07-30 00:00:00", f"Expected '2025-07-30 00:00:00', got {apt3[3]}"
