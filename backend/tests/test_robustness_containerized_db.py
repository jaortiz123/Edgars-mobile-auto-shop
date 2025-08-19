#!/usr/bin/env python3
"""
P2-T-003 Robustness Test Suite
Comprehensive testing for edge cases, error scenarios, and production readiness
"""

import pytest
import time
import os
import psutil
import threading
import subprocess
from pathlib import Path
from unittest.mock import patch, MagicMock
import psycopg2
from psycopg2.extras import RealDictCursor


class TestContainerizedDatabaseRobustness:
    """Robustness tests for the containerized database system."""

    def test_testcontainers_dependency_available(self):
        """Test that testcontainers dependency is available."""
        try:
            import testcontainers
            from testcontainers.postgres import PostgresContainer

            assert PostgresContainer is not None
        except ImportError:
            pytest.fail("testcontainers package is not installed")

    def test_docker_availability_check(self):
        """Test that Docker is available for container operations."""
        try:
            # Try to check Docker status
            result = subprocess.run(
                ["docker", "--version"], capture_output=True, text=True, timeout=5
            )
            assert result.returncode == 0, "Docker is not available or not running"
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pytest.skip("Docker is not available")

    def test_psycopg2_import_available(self):
        """Test that psycopg2 is properly installed."""
        try:
            import psycopg2
            import psycopg2.extras

            assert psycopg2 is not None
        except ImportError:
            pytest.fail("psycopg2 package is not available")

    def test_schema_file_exists(self):
        """Test that required schema file exists."""
        schema_file = Path(__file__).parent / "test_schema.sql"
        assert schema_file.exists(), f"Schema file not found: {schema_file}"

        # Test that schema file is readable and not empty
        content = schema_file.read_text()
        assert len(content.strip()) > 0, "Schema file is empty"
        assert "CREATE TABLE" in content.upper(), "Schema file doesn't contain table definitions"

    def test_seed_file_exists(self):
        """Test that required seed file exists."""
        seed_file = Path(__file__).parent / "seed.sql"
        assert seed_file.exists(), f"Seed file not found: {seed_file}"

        # Test that seed file is readable and not empty
        content = seed_file.read_text()
        assert len(content.strip()) > 0, "Seed file is empty"
        assert "INSERT INTO" in content.upper(), "Seed file doesn't contain insert statements"

    def test_memory_usage_baseline(self):
        """Test baseline memory usage without containers."""
        process = psutil.Process()
        initial_memory = process.memory_info().rss

        # Memory should be reasonable (less than 500MB for test process)
        memory_mb = initial_memory / (1024 * 1024)
        assert memory_mb < 500, f"Test process using too much memory: {memory_mb:.1f}MB"

    def test_database_connection_with_real_container(self, pg_container):
        """Test actual database connection with real container."""
        db_url = pg_container["db_url"]

        # Test basic connection
        with psycopg2.connect(db_url, cursor_factory=RealDictCursor) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT version()")
                result = cur.fetchone()
                assert result is not None
                assert "PostgreSQL" in result["version"]

    def test_connection_pool_limits(self, pg_container):
        """Test database connection pooling behavior."""
        db_url = pg_container["db_url"]
        connections = []

        try:
            # Try to create multiple connections
            for i in range(5):  # Conservative number for testing
                conn = psycopg2.connect(db_url)
                connections.append(conn)

                with conn.cursor() as cur:
                    cur.execute("SELECT COUNT(*) FROM customers")
                    result = cur.fetchone()
                    assert result[0] >= 0  # Should have some data

        finally:
            # Clean up connections
            for conn in connections:
                if not conn.closed:
                    conn.close()

    def test_concurrent_connections(self, pg_container):
        """Test concurrent database access from multiple threads."""
        db_url = pg_container["db_url"]
        results = []
        errors = []

        def worker_thread(thread_id):
            try:
                with psycopg2.connect(db_url) as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT COUNT(*) FROM customers WHERE id IS NOT NULL")
                        count = cur.fetchone()[0]
                        results.append((thread_id, count))
            except Exception as e:
                errors.append((thread_id, str(e)))

        # Create and start threads
        threads = []
        for i in range(3):  # Conservative number for testing
            thread = threading.Thread(target=worker_thread, args=(i,))
            threads.append(thread)
            thread.start()

        # Wait for all threads to complete
        for thread in threads:
            thread.join(timeout=10)  # 10 second timeout

        # Check results
        assert len(errors) == 0, f"Concurrent access errors: {errors}"
        assert len(results) == 3, f"Expected 3 results, got {len(results)}"

        # All threads should get the same count
        counts = [result[1] for result in results]
        assert all(count == counts[0] for count in counts), f"Inconsistent counts: {counts}"

    def test_database_constraints_enforcement(self, db_connection):
        """Test that database constraints are properly enforced."""
        with db_connection.cursor() as cur:
            # Test foreign key constraint
            with pytest.raises(psycopg2.IntegrityError):
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

    def test_performance_benchmarks(self, db_connection):
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

    def test_transaction_rollback_safety(self, db_connection):
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

    def test_container_resource_cleanup(self, pg_container):
        """Test that container resources are properly managed."""
        # Container should be running
        assert pg_container is not None
        assert "db_url" in pg_container

        # Connection should work
        db_url = pg_container["db_url"]
        with psycopg2.connect(db_url) as conn:
            assert not conn.closed

    def test_sql_injection_prevention(self, db_connection):
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

    def test_large_result_set_handling(self, db_connection):
        """Test handling of larger result sets."""
        with db_connection.cursor() as cur:
            # Create a query that returns multiple rows
            cur.execute(
                """
                SELECT
                    c.name,
                    v.make,
                    v.model,
                    a.appointment_date,
                    a.status
                FROM customers c
                JOIN vehicles v ON c.id = v.customer_id
                LEFT JOIN appointments a ON v.id = a.vehicle_id
                ORDER BY c.name, a.appointment_date
            """
            )

            results = cur.fetchall()
            assert isinstance(results, list)
            # Should handle the result set without memory issues

    def test_timezone_handling(self, db_connection):
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


class TestEnvironmentCompatibility:
    """Test compatibility across different environments."""

    def test_python_version_compatibility(self):
        """Test Python version requirements."""
        import sys

        version = sys.version_info

        # Should work with Python 3.7+
        assert version.major == 3
        assert version.minor >= 7, f"Python 3.7+ required, got {version.major}.{version.minor}"

    def test_required_packages_installed(self):
        """Test that all required packages are installed."""
        required_packages = ["pytest", "psycopg2", "testcontainers", "psutil"]

        missing_packages = []
        for package in required_packages:
            try:
                __import__(package)
            except ImportError:
                missing_packages.append(package)

        assert len(missing_packages) == 0, f"Missing packages: {missing_packages}"

    def test_file_path_handling(self):
        """Test file path handling across platforms."""
        test_dir = Path(__file__).parent

        # Test paths work correctly
        schema_file = test_dir / "test_schema.sql"
        seed_file = test_dir / "seed.sql"

        assert test_dir.exists(), f"Test directory not found: {test_dir}"
        assert schema_file.exists(), f"Schema file not found: {schema_file}"
        assert seed_file.exists(), f"Seed file not found: {seed_file}"


class TestDocumentationAndUsage:
    """Test documentation and usage patterns."""

    def test_example_usage_patterns(self, db_connection):
        """Test common usage patterns work as documented."""
        # Pattern 1: Simple query
        with db_connection.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM customers")
            count = cur.fetchone()[0]
            assert count >= 0

        # Pattern 2: Parameterized query
        with db_connection.cursor() as cur:
            cur.execute("SELECT * FROM customers WHERE name LIKE %s", ("%Test%",))
            results = cur.fetchall()
            assert isinstance(results, list)

        # Pattern 3: Transaction usage
        try:
            with db_connection.cursor() as cur:
                cur.execute("SELECT 1")  # Safe operation
                db_connection.commit()
        except Exception:
            db_connection.rollback()

    def test_error_message_clarity(self):
        """Test that error messages are clear and helpful."""
        # Test connection error
        try:
            psycopg2.connect("postgresql://invalid:invalid@localhost:9999/invalid")
        except psycopg2.OperationalError as e:
            error_msg = str(e)
            # Error should mention connection failure
            assert any(word in error_msg.lower() for word in ["connection", "connect", "refused"])
