#!/usr/bin/env python3
"""
Single-purpose script: Start local_server.py with SQLite database
Keeps server running reliably for security testing
"""

import os
import signal
import subprocess
import sys
import time

import requests


class TestServerManager:
    def __init__(self):
        self.server_process = None
        self.server_url = "http://localhost:3001"
        self.db_path = os.path.abspath("database/local_shop.db")

    def cleanup_existing_servers(self):
        """Kill any existing servers on port 3001"""
        try:
            # Kill by port
            subprocess.run(["lsof", "-ti:3001"], capture_output=True, check=True)
            subprocess.run(
                ["kill", "-9"]
                + subprocess.run(["lsof", "-ti:3001"], capture_output=True, text=True)
                .stdout.strip()
                .split(),
                check=False,
            )
            time.sleep(2)
        except:
            pass

        # Kill by process name
        try:
            subprocess.run(["pkill", "-f", "local_server.py"], check=False)
            time.sleep(2)
        except:
            pass

    def start_server(self):
        """Start the server with SQLite database configuration"""
        print("🚀 Starting test server...")

        # Clean up any existing servers
        self.cleanup_existing_servers()

        # Verify database exists
        if not os.path.exists(self.db_path):
            print(f"❌ Database not found: {self.db_path}")
            print("Please run: python3 setup_multi_tenant_test_environment.py")
            return False

        # Set environment for SQLite
        env = os.environ.copy()
        env["DATABASE_URL"] = f"sqlite:///{self.db_path}"

        # Start server
        try:
            backend_dir = os.path.join(os.getcwd(), "backend")
            self.server_process = subprocess.Popen(
                ["python3", "local_server.py"],
                cwd=backend_dir,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

            print(f"✅ Server started (PID: {self.server_process.pid})")

            # Wait for server to be ready
            return self.wait_for_server_ready()

        except Exception as e:
            print(f"❌ Failed to start server: {e}")
            return False

    def wait_for_server_ready(self, timeout=30):
        """Wait for server to respond to health checks"""
        print("⏳ Waiting for server to be ready...")

        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                # Try health endpoint
                response = requests.get(f"{self.server_url}/health", timeout=3)
                if response.status_code in [
                    200,
                    503,
                ]:  # 503 is OK if DB connection works but other issues
                    print("✅ Server is responding to health checks")

                    # Try a simple API endpoint
                    try:
                        test_response = requests.get(f"{self.server_url}/api", timeout=3)
                        print(f"✅ API endpoint responding (status: {test_response.status_code})")
                        return True
                    except:
                        print("⚠️  Health OK but API not ready, continuing...")
                        return True  # Health is enough for our test

            except requests.exceptions.ConnectionError:
                pass  # Server not ready yet
            except Exception as e:
                print(f"⚠️  Health check error: {e}")

            time.sleep(1)
            print(".", end="", flush=True)

        print(f"\n❌ Server did not become ready within {timeout} seconds")
        return False

    def stop_server(self):
        """Stop the server process"""
        if self.server_process:
            print(f"\n🛑 Stopping server (PID: {self.server_process.pid})")
            self.server_process.terminate()
            try:
                self.server_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.server_process.kill()
                self.server_process.wait()
            print("✅ Server stopped")

    def run_and_wait(self):
        """Start server and keep it running until interrupted"""

        def signal_handler(sig, frame):
            print(f"\n🔄 Received signal {sig}, shutting down...")
            self.stop_server()
            sys.exit(0)

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        if self.start_server():
            print(f"🎯 Test server ready at {self.server_url}")
            print("📋 Ready for security testing!")
            print("🔄 Press Ctrl+C to stop the server")

            try:
                # Keep server running
                while True:
                    if self.server_process and self.server_process.poll() is not None:
                        print("❌ Server process died unexpectedly")
                        break
                    time.sleep(1)
            except KeyboardInterrupt:
                pass
            finally:
                self.stop_server()
        else:
            print("❌ Failed to start server")
            sys.exit(1)


def main():
    """Start the test server"""
    print("🔒 Multi-Tenant Security Test Server")
    print("=" * 50)

    server = TestServerManager()
    server.run_and_wait()


if __name__ == "__main__":
    main()
