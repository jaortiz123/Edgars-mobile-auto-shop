#!/usr/bin/env python3
"""
import pytest

P2-T-003 Robustness Test Suite - Simplified Version
Comprehensive testing for edge cases, error scenarios, and production readiness
"""

import pytest
import time
import os
import subprocess
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor


@pytest.mark.integration
def test_testcontainers_dependency_available():
    """Test that testcontainers dependency is available."""
    try:
        import testcontainers
        from testcontainers.postgres import PostgresContainer

        assert PostgresContainer is not None
    except ImportError:
        pytest.fail("testcontainers package is not installed")


@pytest.mark.integration
def test_docker_availability_check():
    """Test that Docker is available for container operations."""
    try:
        # Try to check Docker status
        result = subprocess.run(["docker", "--version"], capture_output=True, text=True, timeout=5)
        assert result.returncode == 0, "Docker is not available or not running"
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pytest.skip("Docker is not available")


@pytest.mark.integration
def test_schema_file_exists():
    """Test that required schema file exists."""
    schema_file = Path(__file__).parent / "test_schema.sql"
    assert schema_file.exists(), f"Schema file not found: {schema_file}"

    # Test that schema file is readable and not empty
    content = schema_file.read_text()
    assert len(content.strip()) > 0, "Schema file is empty"
    assert "CREATE TABLE" in content.upper(), "Schema file doesn't contain table definitions"


@pytest.mark.integration
def test_seed_file_exists():
    """Test that required seed file exists."""
    seed_file = Path(__file__).parent / "seed.sql"
    assert seed_file.exists(), f"Seed file not found: {seed_file}"

    # Test that seed file is readable and not empty
    content = seed_file.read_text()
    assert len(content.strip()) > 0, "Seed file is empty"
    assert "INSERT INTO" in content.upper(), "Seed file doesn't contain insert statements"


@pytest.mark.integration
def test_database_connection_with_real_container(pg_container):
    """Test actual database connection with real container."""
    db_url = pg_container["db_url"]

    # Test basic connection
    with psycopg2.connect(db_url, cursor_factory=RealDictCursor) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT version()")
            result = cur.fetchone()
            assert result is not None
            assert "PostgreSQL" in result["version"]


@pytest.mark.integration
def test_database_constraints_enforcement(db_connection):
    """Test that database constraints are properly enforced."""
    with db_connection.cursor() as cur:
        # Test foreign key constraint
        with pytest.raises(psycopg2.IntegrityError):
            # Use an obviously non-existent integer ID to trigger FK violation reliably.
            # Aligns with containerized robustness test approach.
            cur.execute(
                """
                INSERT INTO vehicles (customer_id, make, model, year, license_plate)
                VALUES (999999, 'Test', 'Model', 2020, 'TEST123')
            """
            )

        # Rollback the transaction
        db_connection.rollback()

        # Test ENUM constraint
        with pytest.raises(psycopg2.DataError):
            cur.execute(
                """
                INSERT INTO appointments (customer_id, vehicle_id, appointment_date, status)
                VALUES (
                    (SELECT id FROM customers LIMIT 1),
                    (SELECT id FROM vehicles LIMIT 1),
                    NOW(),
                    'INVALID_STATUS'
                )
            """
            )

        # Rollback the transaction
        db_connection.rollback()


@pytest.mark.integration
def test_performance_benchmarks(db_connection):
    """Test basic performance benchmarks."""
    with db_connection.cursor() as cur:
        # Test simple query performance
        start_time = time.time()
        cur.execute("SELECT COUNT(*) FROM customers")
        result = cur.fetchone()
        query_time = time.time() - start_time

        assert query_time < 1.0, f"Simple query too slow: {query_time:.3f}s"
        assert result[0] > 0, "Should have test data"

        # Test join query performance
        start_time = time.time()
        cur.execute(
            """
            SELECT c.name, v.make, v.model, COUNT(a.id) as appointment_count
            FROM customers c
            JOIN vehicles v ON c.id = v.customer_id
            LEFT JOIN appointments a ON v.id = a.vehicle_id
            GROUP BY c.id, c.name, v.make, v.model
            ORDER BY appointment_count DESC
        """
        )
        results = cur.fetchall()
        join_time = time.time() - start_time

        assert join_time < 2.0, f"Join query too slow: {join_time:.3f}s"
        assert len(results) > 0, "Should have joined results"


@pytest.mark.integration
def test_transaction_rollback_safety(db_connection):
    """Test transaction rollback behavior."""
    original_count = None

    with db_connection.cursor() as cur:
        # Get initial count
        cur.execute("SELECT COUNT(*) FROM customers")
        original_count = cur.fetchone()[0]

    try:
        with db_connection.cursor() as cur:
            # Start a transaction and insert data
            cur.execute(
                """
                INSERT INTO customers (name, email, phone)
                VALUES ('Test Customer', 'test@test.com', '555-0123')
            """
            )

            # Verify data exists in transaction
            cur.execute("SELECT COUNT(*) FROM customers")
            new_count = cur.fetchone()[0]
            assert new_count == original_count + 1

            # Force an error to trigger rollback
            raise Exception("Forced rollback")

    except Exception:
        # Rollback should happen automatically
        db_connection.rollback()

    # Verify rollback worked
    with db_connection.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM customers")
        final_count = cur.fetchone()[0]
        assert final_count == original_count, "Rollback failed"


@pytest.mark.integration
def test_sql_injection_prevention(db_connection):
    """Test SQL injection prevention with parameterized queries."""
    malicious_input = "'; DROP TABLE customers; --"

    with db_connection.cursor() as cur:
        # This should be safe with parameterized queries
        cur.execute("SELECT * FROM customers WHERE name = %s", (malicious_input,))
        results = cur.fetchall()

        # Should return no results, but not crash
        assert isinstance(results, list)

        # Verify customers table still exists
        cur.execute("SELECT COUNT(*) FROM customers")
        count = cur.fetchone()[0]
        assert count > 0, "Customers table was affected by injection attempt"


@pytest.mark.integration
def test_timezone_handling(db_connection):
    """Test timezone handling in database operations."""
    with db_connection.cursor() as cur:
        # Test current timestamp
        cur.execute("SELECT NOW() as current_time")
        result = cur.fetchone()
        assert result["current_time"] is not None

        # Test timezone functions work
        cur.execute("SELECT EXTRACT(timezone FROM NOW()) as tz")
        tz_result = cur.fetchone()
        # Should not error, regardless of timezone setting
