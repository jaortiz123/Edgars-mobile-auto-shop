#!/usr/bin/env python3
"""
PostgreSQL Security Test Environment Startup Script
This script creates a reliable PostgreSQL test environment for cross-tenant security testing.

Execution Plan:
1. Start PostgreSQL Docker container
2. Wait for database to be ready
3. Setup multi-tenant test data
4. Start Flask server with PostgreSQL connection
5. Keep server running for testing
"""

import os
import signal
import subprocess
import sys
import time

import psycopg2


class PostgreSQLTestEnvironment:
    def __init__(self):
        self.server_process = None
        self.db_config = {
            "host": "localhost",
            "port": "5432",
            "database": "edgar_db",
            "user": "postgres",
            "password": "postgres",
        }

    def log(self, message, level="INFO"):
        """Enhanced logging"""
        timestamp = time.strftime("%H:%M:%S")
        icons = {"INFO": "ℹ️", "SUCCESS": "✅", "ERROR": "❌", "WARN": "⚠️"}
        print(f"[{timestamp}] {icons.get(level, '•')} {message}")

    def cleanup_environment(self):
        """Clean up any existing processes and containers"""
        self.log("Cleaning up existing environment")

        # Kill any existing backend processes
        try:
            subprocess.run(["pkill", "-f", "local_server.py"], check=False, capture_output=True)
            subprocess.run(["lsof", "-ti:3001"], capture_output=True, check=True)
            pids = (
                subprocess.run(["lsof", "-ti:3001"], capture_output=True, text=True)
                .stdout.strip()
                .split()
            )
            if pids:
                subprocess.run(["kill", "-9"] + pids, check=False)
        except:
            pass

        # Stop Docker containers
        try:
            subprocess.run(
                ["docker", "compose", "down"], cwd=os.getcwd(), check=False, capture_output=True
            )
        except:
            pass

        time.sleep(2)
        self.log("Environment cleanup complete")

    def start_postgresql_container(self):
        """Start PostgreSQL Docker container"""
        self.log("Starting PostgreSQL Docker container")

        try:
            # Set required environment variables
            env = os.environ.copy()
            env.update(
                {
                    "POSTGRES_PASSWORD": self.db_config["password"],
                    "POSTGRES_USER": self.db_config["user"],
                    "POSTGRES_DB": self.db_config["database"],
                }
            )

            # Start container
            subprocess.run(
                ["docker", "compose", "up", "-d", "db"],
                cwd=os.getcwd(),
                env=env,
                check=True,
                capture_output=True,
            )

            self.log("Docker container starting...")
            return True

        except subprocess.CalledProcessError as e:
            self.log(f"Failed to start Docker container: {e}", "ERROR")
            self.log(f"STDOUT: {e.stdout}", "ERROR")
            self.log(f"STDERR: {e.stderr}", "ERROR")
            return False

    def wait_for_database_ready(self, timeout=60):
        """Wait for PostgreSQL database to be ready"""
        self.log("Waiting for PostgreSQL database to be ready...")

        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                conn = psycopg2.connect(
                    host=self.db_config["host"],
                    port=self.db_config["port"],
                    database=self.db_config["database"],
                    user=self.db_config["user"],
                    password=self.db_config["password"],
                )

                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    result = cur.fetchone()

                conn.close()

                if result:
                    self.log("PostgreSQL database is ready!", "SUCCESS")
                    return True

            except psycopg2.OperationalError:
                pass
            except Exception as e:
                self.log(f"Database check error: {e}", "WARN")

            time.sleep(2)
            print(".", end="", flush=True)

        print()
        self.log(f"Database did not become ready within {timeout} seconds", "ERROR")
        return False

    def setup_multi_tenant_data(self):
        """Setup multi-tenant test data in PostgreSQL"""
        self.log("Setting up multi-tenant test data")

        try:
            conn = psycopg2.connect(
                host=self.db_config["host"],
                port=self.db_config["port"],
                database=self.db_config["database"],
                user=self.db_config["user"],
                password=self.db_config["password"],
            )

            with conn.cursor() as cur:
                # Use existing test tenants
                cur.execute(
                    "SELECT id, name, slug FROM tenants WHERE slug LIKE 'test-tenant%' LIMIT 2"
                )
                existing_tenants = cur.fetchall()

                if len(existing_tenants) < 2:
                    self.log(
                        f"Need at least 2 test tenants, found {len(existing_tenants)}", "ERROR"
                    )
                    return False

                tenant_a_id = existing_tenants[0][0]
                tenant_a_name = existing_tenants[0][1]
                tenant_b_id = existing_tenants[1][0]
                tenant_b_name = existing_tenants[1][1]

                self.log(
                    f"Using tenants: {tenant_a_name} ({tenant_a_id}) and {tenant_b_name} ({tenant_b_id})"
                )

                # Clean up any existing test customers first
                cur.execute("DELETE FROM customer_auth WHERE email LIKE '%admin@tenant-%'")
                cur.execute("DELETE FROM customers WHERE email LIKE '%admin@tenant-%'")

                # Create customers for each tenant
                cur.execute(
                    """
                    INSERT INTO customers (name, phone, email, address, tenant_id)
                    VALUES
                        (%s, %s, %s, %s, %s),
                        (%s, %s, %s, %s, %s)
                    RETURNING id, email
                """,
                    (
                        "Admin A",
                        "555-0001",
                        "admin@tenant-a.com",
                        "123 Admin St",
                        tenant_a_id,
                        "Admin B",
                        "555-0002",
                        "admin@tenant-b.com",
                        "456 Admin Ave",
                        tenant_b_id,
                    ),
                )

                customers_created = cur.fetchall()
                self.log(f"Created {len(customers_created)} customers")

                # Create auth entries for the customers
                import hashlib

                def _hash_password(password: str, salt: str) -> str:
                    """Returns a deterministic salted SHA256 hash (dev/testing only)."""
                    h = hashlib.sha256()
                    h.update((salt + password).encode("utf-8"))
                    return h.hexdigest()

                salt = "testsalt123"
                password_hash = _hash_password("AdminPass123!", salt)

                for customer_id, email in customers_created:
                    # Determine which tenant based on email
                    if "tenant-a" in email:
                        auth_tenant_id = str(tenant_a_id)
                    else:
                        auth_tenant_id = str(tenant_b_id)

                    cur.execute(
                        """
                        INSERT INTO customer_auth (customer_id, email, password_hash, salt, tenant_id)
                        VALUES (%s, %s, %s, %s, %s)
                    """,
                        (customer_id, email, password_hash, salt, auth_tenant_id),
                    )

                self.log("Auth records created")

            conn.commit()
            conn.close()

            self.log("Multi-tenant test data setup complete", "SUCCESS")
            return True

        except Exception as e:
            self.log(f"Failed to setup test data: {e}", "ERROR")
            return False

    def start_flask_server(self):
        """Start Flask server with PostgreSQL connection"""
        self.log("Starting Flask server with PostgreSQL connection")

        try:
            # Set PostgreSQL environment variables
            env = os.environ.copy()
            env.update(
                {
                    "POSTGRES_HOST": self.db_config["host"],
                    "POSTGRES_PORT": self.db_config["port"],
                    "POSTGRES_DB": self.db_config["database"],
                    "POSTGRES_USER": self.db_config["user"],
                    "POSTGRES_PASSWORD": self.db_config["password"],
                }
            )

            # Start Flask server
            backend_dir = os.path.join(os.getcwd(), "backend")
            self.server_process = subprocess.Popen(
                ["python3", "local_server.py"],
                cwd=backend_dir,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

            self.log(f"Flask server started (PID: {self.server_process.pid})")

            # Wait for server to be ready
            return self.wait_for_flask_ready()

        except Exception as e:
            self.log(f"Failed to start Flask server: {e}", "ERROR")
            return False

    def wait_for_flask_ready(self, timeout=30):
        """Wait for Flask server to be ready"""
        self.log("Waiting for Flask server to be ready...")

        import urllib.error
        import urllib.request

        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                response = urllib.request.urlopen("http://localhost:3001/health", timeout=5)
                if response.getcode() == 200:
                    self.log("Flask server is ready!", "SUCCESS")
                    return True
            except (urllib.error.URLError, ConnectionError, OSError):
                pass
            except Exception as e:
                self.log(f"Server check error: {e}", "WARN")

            time.sleep(2)
            print(".", end="", flush=True)

        print()
        self.log(f"Flask server did not become ready within {timeout} seconds", "ERROR")
        return False

    def setup_signal_handlers(self):
        """Setup signal handlers for clean shutdown"""

        def signal_handler(signum, frame):
            self.log("\n🛑 Received shutdown signal, cleaning up...")
            self.cleanup()
            sys.exit(0)

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

    def cleanup(self):
        """Clean up processes"""
        if self.server_process:
            self.log("Stopping Flask server...")
            self.server_process.terminate()
            try:
                self.server_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.server_process.kill()

    def run(self):
        """Main execution flow"""
        print("🔒 PostgreSQL Security Test Environment")
        print("=" * 50)

        self.setup_signal_handlers()

        # Step 1: Cleanup existing environment
        self.cleanup_environment()

        # Step 2: Start PostgreSQL container
        if not self.start_postgresql_container():
            self.log("Failed to start PostgreSQL container", "ERROR")
            return False

        # Step 3: Wait for database to be ready
        if not self.wait_for_database_ready():
            self.log("PostgreSQL database not ready", "ERROR")
            return False

        # Step 4: Setup test data
        if not self.setup_multi_tenant_data():
            self.log("Failed to setup test data", "ERROR")
            return False

        # Step 5: Start Flask server
        if not self.start_flask_server():
            self.log("Failed to start Flask server", "ERROR")
            return False

        self.log("🚀 Test environment is ready!", "SUCCESS")
        self.log("Flask server running at: http://localhost:3001", "INFO")
        self.log("PostgreSQL running at: localhost:5432", "INFO")
        self.log("Press Ctrl+C to stop", "INFO")

        # Keep running
        try:
            while True:
                if self.server_process and self.server_process.poll() is not None:
                    self.log("Flask server stopped unexpectedly", "ERROR")
                    break
                time.sleep(1)
        except KeyboardInterrupt:
            pass

        self.cleanup()
        return True


def main():
    """Main entry point"""
    env = PostgreSQLTestEnvironment()

    try:
        if env.run():
            print("\n✅ PostgreSQL test environment setup complete!")
        else:
            print("\n❌ Failed to setup test environment")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
