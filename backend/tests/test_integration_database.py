"""
Integration test for the containerized PostgreSQL database setup.
This test verifies that the test database container works with real SQL constraints.
"""

import pytest
import psycopg2
from psycopg2.extras import RealDictCursor
import time
import subprocess
from pathlib import Path


class TestContainerizedDatabase:
    """Test the containerized database with real SQL behavior."""

    def test_database_connection(self, db_connection):
        """Test that we can connect to the containerized database."""
        with db_connection.cursor() as cur:
            cur.execute("SELECT version()")
            version = cur.fetchone()
            assert version is not None
            # RealDictCursor returns dict-like objects, access by column name
            assert "PostgreSQL" in version["version"]

    def test_seed_data_loaded(self, db_connection):
        """Test that seed data was loaded correctly."""
        with db_connection.cursor() as cur:
            # Check customers
            cur.execute("SELECT COUNT(*) as count FROM customers")
            customer_count = cur.fetchone()["count"]
            assert customer_count >= 5, f"Expected at least 5 customers, got {customer_count}"

            # Check appointments
            cur.execute("SELECT COUNT(*) as count FROM appointments")
            appointment_count = cur.fetchone()["count"]
            # Allow additional appointments created by prior tests; baseline seed is 10
            assert (
                appointment_count >= 10
            ), f"Expected at least 10 appointments, got {appointment_count}"

            # Check appointment services
            cur.execute("SELECT COUNT(*) as count FROM appointment_services")
            service_count = cur.fetchone()["count"]
            # Allow >=16 because additional services may be created by earlier tests
            assert service_count >= 16, f"Expected at least 16 services, got {service_count}"

    def test_foreign_key_constraints(self, db_connection):
        """Test that foreign key constraints are working properly."""
        with db_connection.cursor() as cur:
            # Test that we can't insert an appointment with invalid customer_id
            with pytest.raises(psycopg2.IntegrityError):
                cur.execute(
                    "INSERT INTO appointments (customer_id, vehicle_id, status) VALUES (999, 1, 'SCHEDULED')"
                )
                db_connection.commit()

            # Rollback the failed transaction
            db_connection.rollback()

            # Test that we can't insert an appointment with invalid vehicle_id
            with pytest.raises(psycopg2.IntegrityError):
                cur.execute(
                    "INSERT INTO appointments (customer_id, vehicle_id, status) VALUES (1, 999, 'SCHEDULED')"
                )
                db_connection.commit()

            # Rollback the failed transaction
            db_connection.rollback()

    def test_appointment_status_enum(self, db_connection):
        """Test that appointment status ENUM constraint works."""
        with db_connection.cursor() as cur:
            # Valid status should work - use a high ID to avoid conflicts with seed data
            cur.execute(
                "INSERT INTO appointments (customer_id, vehicle_id, status) VALUES (1, 1, 'SCHEDULED') RETURNING id"
            )
            appointment_id = cur.fetchone()["id"]
            assert appointment_id is not None

            # Invalid status should fail
            with pytest.raises(psycopg2.DataError):
                cur.execute(
                    "INSERT INTO appointments (customer_id, vehicle_id, status) VALUES (1, 1, 'INVALID_STATUS')"
                )

            # Rollback
            db_connection.rollback()

    def test_complex_joins_work(self, db_connection):
        """Test that complex SQL joins work as expected."""
        with db_connection.cursor() as cur:
            # Complex query with multiple joins
            cur.execute(
                """
                SELECT
                    a.id as appointment_id,
                    a.status,
                    c.name as customer_name,
                    c.email as customer_email,
                    v.make as vehicle_make,
                    v.model as vehicle_model,
                    COUNT(s.id) as service_count,
                    SUM(s.estimated_price) as total_estimated_price
                FROM appointments a
                JOIN customers c ON a.customer_id = c.id
                JOIN vehicles v ON a.vehicle_id = v.id
                LEFT JOIN appointment_services s ON a.id = s.appointment_id
                WHERE a.status IN ('SCHEDULED', 'IN_PROGRESS')
                GROUP BY a.id, a.status, c.name, c.email, v.make, v.model
                ORDER BY a.id
            """
            )

            results = cur.fetchall()
            assert len(results) > 0, "Should have appointments with SCHEDULED or IN_PROGRESS status"

            # Check that the join worked correctly
            for row in results:
                assert row["customer_name"] is not None
                # Allow missing email for some seed rows
                assert row["vehicle_make"] is not None
                assert row["vehicle_model"] is not None
                assert row["service_count"] >= 0
                assert row["total_estimated_price"] is not None or row["service_count"] == 0

    def test_appointment_service_relationships(self, db_connection):
        """Test that appointment-service relationships work correctly."""
        with db_connection.cursor() as cur:
            # Find an appointment with services
            cur.execute(
                """
                SELECT a.id, a.status, COUNT(s.id) as service_count
                FROM appointments a
                LEFT JOIN appointment_services s ON a.id = s.appointment_id
                GROUP BY a.id, a.status
                HAVING COUNT(s.id) > 0
                LIMIT 1
            """
            )

            appointment_with_services = cur.fetchone()
            assert (
                appointment_with_services is not None
            ), "Should have at least one appointment with services"

            appointment_id = appointment_with_services["id"]
            service_count = appointment_with_services["service_count"]

            # Verify we can get all services for this appointment
            cur.execute(
                "SELECT * FROM appointment_services WHERE appointment_id = %s", (appointment_id,)
            )
            services = cur.fetchall()
            assert len(services) == service_count

            # Verify each service has required fields
            for service in services:
                assert service["name"] is not None
                assert service["estimated_price"] is not None
                assert service["estimated_hours"] is not None

    def test_can_insert_and_query_data(self, db_connection):
        """Test that we can insert new data and query it back."""
        with db_connection.cursor() as cur:
            # Insert a new customer - use a high ID to avoid conflicts with seed data
            cur.execute(
                """
                INSERT INTO customers (name, email, phone, address)
                VALUES ('Test Customer', 'test@example.com', '+15555551234', '123 Test St')
                RETURNING id
            """
            )
            customer_id = cur.fetchone()["id"]

            # Insert a new vehicle for this customer
            cur.execute(
                """
                INSERT INTO vehicles (customer_id, make, model, year, vin, license_plate)
                VALUES (%s, 'Test', 'Vehicle', 2023, 'TEST1234567890123', 'TEST123')
                RETURNING id
            """,
                (customer_id,),
            )
            vehicle_id = cur.fetchone()["id"]

            # Insert a new appointment
            cur.execute(
                """
                INSERT INTO appointments (customer_id, vehicle_id, status, start_ts, end_ts, total_amount, paid_amount)
                VALUES (%s, %s, 'SCHEDULED', '2024-03-01 10:00:00+00', '2024-03-01 11:00:00+00', 100.00, 0.00)
                RETURNING id
            """,
                (customer_id, vehicle_id),
            )
            appointment_id = cur.fetchone()["id"]

            # Verify we can query the data back with joins
            cur.execute(
                """
                SELECT a.id, c.name, v.make, v.model, a.status, a.total_amount
                FROM appointments a
                JOIN customers c ON a.customer_id = c.id
                JOIN vehicles v ON a.vehicle_id = v.id
                WHERE a.id = %s
            """,
                (appointment_id,),
            )

            result = cur.fetchone()
            assert result is not None
            assert result["name"] == "Test Customer"
            assert result["make"] == "Test"
            assert result["model"] == "Vehicle"
            assert result["status"] == "SCHEDULED"
            assert result["total_amount"] == 100.00

            # Rollback to keep the test database clean
            db_connection.rollback()


class TestLegacyCompatibility:
    """Test that legacy fake database fixtures still work for unit tests."""

    def test_fake_db_fixture_works(self, fake_db, client):
        """Test that the legacy fake_db fixture still works for unit tests."""
        # This test uses the fake database, so it should work without the container
        response = client.get("/api/admin/dashboard/stats")
        assert response.status_code == 200

        data = response.get_json()
        assert "jobsToday" in data
        assert "carsOnPremises" in data
        assert "unpaidTotal" in data


class TestDatabaseRobustness:
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

    def test_database_constraints_enforcement(self, db_connection):
        """Test that database constraints are properly enforced."""
        with db_connection.cursor() as cur:
            # Test foreign key constraint - use invalid INTEGER for customer_id
            with pytest.raises(psycopg2.IntegrityError):
                cur.execute(
                    """
                    INSERT INTO vehicles (customer_id, make, model, year, license_plate)
                    VALUES (99999, 'Test', 'Model', 2020, 'TEST123')
                """
                )

            # Rollback the transaction
            db_connection.rollback()

            # Test ENUM constraint
            with pytest.raises(psycopg2.DataError):
                cur.execute(
                    """
                    INSERT INTO appointments (customer_id, vehicle_id, status)
                    VALUES (
                        (SELECT id FROM customers LIMIT 1),
                        (SELECT id FROM vehicles LIMIT 1),
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
            cur.execute("SELECT COUNT(*) as count FROM customers")
            result = cur.fetchone()
            query_time = time.time() - start_time

            assert query_time < 1.0, f"Simple query too slow: {query_time:.3f}s"
            assert result["count"] > 0, "Should have test data"

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
            cur.execute("SELECT COUNT(*) as count FROM customers")
            original_count = cur.fetchone()["count"]

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
                cur.execute("SELECT COUNT(*) as count FROM customers")
                new_count = cur.fetchone()["count"]
                assert new_count == original_count + 1

                # Force an error to trigger rollback
                raise Exception("Forced rollback")

        except Exception:
            # Rollback should happen automatically
            db_connection.rollback()

        # Verify rollback worked
        with db_connection.cursor() as cur:
            cur.execute("SELECT COUNT(*) as count FROM customers")
            final_count = cur.fetchone()["count"]
            assert final_count == original_count, "Rollback failed"

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
            cur.execute("SELECT COUNT(*) as count FROM customers")
            count = cur.fetchone()["count"]
            assert count > 0, "Customers table was affected by injection attempt"

    def test_container_startup_performance(self, pg_container):
        """Test container startup and connection performance."""
        db_url = pg_container["db_url"]

        # Test that connection is fast
        start_time = time.time()
        with psycopg2.connect(db_url, cursor_factory=RealDictCursor) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 as test_value")
                result = cur.fetchone()
        connection_time = time.time() - start_time

        assert connection_time < 2.0, f"Connection too slow: {connection_time:.3f}s"
        assert result["test_value"] == 1

    def test_multiple_concurrent_queries(self, pg_container):
        """Test handling of multiple concurrent operations."""
        import threading
        import time

        db_url = pg_container["db_url"]
        results = []
        errors = []

        def run_query(query_id):
            try:
                # Each thread gets its own connection for proper concurrency
                with psycopg2.connect(db_url, cursor_factory=RealDictCursor) as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT COUNT(*) as count FROM customers WHERE id IS NOT NULL")
                        count = cur.fetchone()["count"]
                        results.append((query_id, count))
                        time.sleep(0.1)  # Small delay to encourage concurrency
            except Exception as e:
                errors.append((query_id, str(e)))

        # Create multiple threads
        threads = []
        for i in range(3):
            thread = threading.Thread(target=run_query, args=(i,))
            threads.append(thread)

        # Start all threads
        for thread in threads:
            thread.start()

        # Wait for completion
        for thread in threads:
            thread.join(timeout=5)

        # Check results
        assert len(errors) == 0, f"Concurrent query errors: {errors}"
        assert len(results) == 3, f"Expected 3 results, got {len(results)}"

    def test_data_integrity_under_stress(self, db_connection):
        """Test data integrity under various operations."""
        with db_connection.cursor() as cur:
            # Test 1: Verify referential integrity
            cur.execute(
                """
                SELECT COUNT(*) as count FROM vehicles v
                WHERE NOT EXISTS (
                    SELECT 1 FROM customers c WHERE c.id = v.customer_id
                )
            """
            )
            orphaned_vehicles = cur.fetchone()["count"]
            assert orphaned_vehicles == 0, "Found vehicles without valid customers"

            # Test 2: Verify appointment integrity
            cur.execute(
                """
                SELECT COUNT(*) as count FROM appointments a
                WHERE NOT EXISTS (
                    SELECT 1 FROM vehicles v WHERE v.id = a.vehicle_id
                ) OR NOT EXISTS (
                    SELECT 1 FROM customers c WHERE c.id = a.customer_id
                )
            """
            )
            orphaned_appointments = cur.fetchone()["count"]
            assert orphaned_appointments == 0, "Found appointments without valid references"

            # Test 3: Verify service associations
            cur.execute(
                """
                SELECT COUNT(*) as count FROM appointment_services aps
                WHERE NOT EXISTS (
                    SELECT 1 FROM appointments a WHERE a.id = aps.appointment_id
                )
            """
            )
            orphaned_services = cur.fetchone()["count"]
            assert orphaned_services == 0, "Found service associations without valid references"

    def test_resource_cleanup_verification(self, pg_container):
        """Test that resources are properly cleaned up."""
        import psutil

        # Check initial process count
        initial_postgres_processes = len(
            [
                p
                for p in psutil.process_iter(["pid", "name"])
                if "postgres" in p.info["name"].lower()
            ]
        )

        # Create and close multiple connections
        db_url = pg_container["db_url"]
        for i in range(5):
            with psycopg2.connect(db_url) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")

        # Check that we don't have excessive postgres processes
        current_postgres_processes = len(
            [
                p
                for p in psutil.process_iter(["pid", "name"])
                if "postgres" in p.info["name"].lower()
            ]
        )

        # Should not have significantly more processes
        assert (
            current_postgres_processes <= initial_postgres_processes + 10
        ), f"Too many postgres processes: {current_postgres_processes}"

    def test_large_data_handling(self, db_connection):
        """Test handling of larger data operations."""
        with db_connection.cursor() as cur:
            # Test inserting and retrieving larger text data
            large_text = "x" * 1000  # 1KB of text

            cur.execute(
                """
                INSERT INTO customers (name, email, phone, address)
                VALUES (%s, %s, %s, %s)
            """,
                ("Large Data Customer", "large@test.com", "555-0199", large_text),
            )

            # Retrieve the data
            cur.execute(
                """
                SELECT address FROM customers
                WHERE name = 'Large Data Customer'
            """
            )
            result = cur.fetchone()
            assert len(result["address"]) == 1000

            # Clean up
            cur.execute("DELETE FROM customers WHERE name = 'Large Data Customer'")
            db_connection.commit()

    def test_timeout_and_recovery(self, pg_container):
        """Test timeout handling and connection recovery."""
        db_url = pg_container["db_url"]

        # Test that connections can be re-established after timeout
        for attempt in range(3):
            try:
                with psycopg2.connect(db_url, connect_timeout=5) as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT NOW()")
                        result = cur.fetchone()
                        assert result is not None
                break
            except psycopg2.OperationalError:
                # If connection fails, try again
                time.sleep(0.5)
        else:
            pytest.fail("Could not establish connection after 3 attempts")

    def test_schema_validation_completeness(self):
        """Test that the schema includes all required elements."""
        schema_file = Path(__file__).parent / "test_schema.sql"
        content = schema_file.read_text().upper()

        # Check for essential schema elements
        required_elements = [
            "CREATE TABLE CUSTOMERS",
            "CREATE TABLE VEHICLES",
            "CREATE TABLE APPOINTMENTS",
            "CREATE TABLE APPOINTMENT_SERVICES",
            "REFERENCES CUSTOMERS(ID)",
            "REFERENCES VEHICLES(ID)",
            "REFERENCES APPOINTMENTS(ID)",
            "CREATE TYPE APPOINTMENT_STATUS",
            "ENUM",
        ]

        for element in required_elements:
            assert element in content, f"Schema missing required element: {element}"

    def test_seed_data_completeness(self):
        """Test that seed data includes all necessary test scenarios."""
        seed_file = Path(__file__).parent / "seed.sql"
        content = seed_file.read_text().upper()

        # Check for essential seed data
        required_elements = [
            "INSERT INTO CUSTOMERS",
            "INSERT INTO VEHICLES",
            "INSERT INTO APPOINTMENTS",
            "INSERT INTO APPOINTMENT_SERVICES",
            "'SCHEDULED'",
            "'COMPLETED'",
        ]

        for element in required_elements:
            assert element in content, f"Seed data missing: {element}"

    def test_cross_platform_compatibility(self):
        """Test cross-platform path and configuration compatibility."""
        # Test that paths work on different platforms
        current_dir = Path(__file__).parent
        schema_path = current_dir / "test_schema.sql"
        seed_path = current_dir / "seed.sql"

        # Should work on Windows, macOS, and Linux
        assert schema_path.exists()
        assert seed_path.exists()
        assert str(schema_path).replace("\\", "/")  # Test path conversion

    def test_environment_variable_handling(self, pg_container):
        """Test that environment variables are properly set and used."""
        # Check that required environment variables are available in env_vars
        env_vars = pg_container.get("env_vars", {})
        required_vars = [
            "POSTGRES_HOST",
            "POSTGRES_PORT",
            "POSTGRES_DB",
            "POSTGRES_USER",
            "POSTGRES_PASSWORD",
        ]

        for var in required_vars:
            assert var in env_vars, f"Missing environment variable: {var}"
            assert env_vars[var] is not None, f"Empty environment variable: {var}"

        # Test database connection using environment variables
        db_url = f"postgresql://{env_vars['POSTGRES_USER']}:{env_vars['POSTGRES_PASSWORD']}@{env_vars['POSTGRES_HOST']}:{env_vars['POSTGRES_PORT']}/{env_vars['POSTGRES_DB']}"

        with psycopg2.connect(db_url) as conn:
            assert not conn.closed


class TestAdvancedRobustness:
    """Advanced robustness tests for edge cases and production scenarios."""

    def test_memory_leak_detection(self, pg_container):
        """Test for potential memory leaks during repeated operations."""
        import psutil
        import gc

        process = psutil.Process()
        initial_memory = process.memory_info().rss

        db_url = pg_container["db_url"]

        # Perform many database operations
        for i in range(50):
            with psycopg2.connect(db_url) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT COUNT(*) as count FROM customers")
                    cur.fetchone()

            # Force garbage collection every 10 iterations
            if i % 10 == 0:
                gc.collect()

        final_memory = process.memory_info().rss
        memory_growth = final_memory - initial_memory
        memory_growth_mb = memory_growth / (1024 * 1024)

        # Memory growth should be reasonable (< 50MB for this test)
        assert memory_growth_mb < 50, f"Excessive memory growth: {memory_growth_mb:.1f}MB"

    def test_error_recovery_scenarios(self, pg_container):
        """Test recovery from various error scenarios."""
        db_url = pg_container["db_url"]

        # Test 1: Recover from syntax error
        with psycopg2.connect(db_url, cursor_factory=RealDictCursor) as conn:
            with conn.cursor() as cur:
                # Cause a syntax error
                try:
                    cur.execute("INVALID SQL SYNTAX")
                except psycopg2.Error:
                    pass  # Expected

                conn.rollback()

                # Should be able to execute valid query after rollback
                cur.execute("SELECT 1 as test")
                result = cur.fetchone()
                assert result["test"] == 1

        # Test 2: Recover from constraint violation
        with psycopg2.connect(db_url, cursor_factory=RealDictCursor) as conn:
            with conn.cursor() as cur:
                try:
                    cur.execute(
                        """
                        INSERT INTO vehicles (customer_id, make, model, year)
                        VALUES (99999, 'Test', 'Model', 2020)
                    """
                    )
                except psycopg2.IntegrityError:
                    pass  # Expected

                conn.rollback()

                # Should be able to execute valid query after rollback
                cur.execute("SELECT COUNT(*) as count FROM vehicles")
                result = cur.fetchone()
                assert result["count"] >= 0

    def test_performance_under_load(self, pg_container):
        """Test performance characteristics under load."""
        db_url = pg_container["db_url"]

        # Test concurrent read operations
        import threading
        import time

        results = []
        start_time = time.time()

        def read_worker():
            with psycopg2.connect(db_url) as conn:
                with conn.cursor() as cur:
                    for _ in range(10):
                        cur.execute("SELECT COUNT(*) as count FROM customers")
                        cur.fetchone()

        # Create multiple reader threads
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=read_worker)
            threads.append(thread)
            thread.start()

        # Wait for completion
        for thread in threads:
            thread.join(timeout=10)

        total_time = time.time() - start_time

        # 5 threads * 10 operations = 50 total operations
        # Should complete in reasonable time
        assert total_time < 10, f"Load test too slow: {total_time:.2f}s"

    def test_data_consistency_verification(self, db_connection):
        """Test comprehensive data consistency checks."""
        with db_connection.cursor() as cur:
            # Test 1: All foreign key relationships are valid
            cur.execute(
                """
                SELECT
                    (SELECT COUNT(*) FROM vehicles WHERE customer_id NOT IN (SELECT id FROM customers)) as orphaned_vehicles,
                    (SELECT COUNT(*) FROM appointments WHERE customer_id NOT IN (SELECT id FROM customers)) as orphaned_appointments_customers,
                    (SELECT COUNT(*) FROM appointments WHERE vehicle_id NOT IN (SELECT id FROM vehicles)) as orphaned_appointments_vehicles,
                    (SELECT COUNT(*) FROM appointment_services WHERE appointment_id NOT IN (SELECT id FROM appointments)) as orphaned_services
            """
            )

            result = cur.fetchone()
            assert (
                result["orphaned_vehicles"] == 0
            ), "Found vehicles with invalid customer references"
            assert (
                result["orphaned_appointments_customers"] == 0
            ), "Found appointments with invalid customer references"
            assert (
                result["orphaned_appointments_vehicles"] == 0
            ), "Found appointments with invalid vehicle references"
            assert (
                result["orphaned_services"] == 0
            ), "Found services with invalid appointment references"

            # Test 2: Data type consistency
            cur.execute(
                """
                SELECT
                    COUNT(*) as invalid_years
                FROM vehicles
                WHERE year IS NOT NULL AND (year < 1900 OR year > 2030)
            """
            )
            result = cur.fetchone()
            assert result["invalid_years"] == 0, "Found vehicles with invalid year values"
