#!/usr/bin/env python3
"""Debug script to test Flask server configuration and connectivity"""

import os
import subprocess
import sys
import time

import requests


def test_server_binding():
    """Test different server binding configurations"""

    # Test configurations
    configs = [
        {"host": "127.0.0.1", "port": 3001},
        {"host": "0.0.0.0", "port": 3001},
        {"host": "localhost", "port": 3001},
    ]

    for config in configs:
        print(f"\n--- Testing {config['host']}:{config['port']} ---")

        # Create a minimal test server
        test_server_code = f"""
import flask
app = flask.Flask(__name__)

@app.route('/health')
def health():
    return {{'status': 'ok', 'message': 'Server is running'}}, 200

@app.route('/')
def root():
    return 'Server is alive', 200

if __name__ == '__main__':
    print(f"Starting server on {config['host']}:{config['port']}")
    app.run(host='{config['host']}', port={config['port']}, debug=False)
"""

        # Write test server
        with open("test_server.py", "w") as f:
            f.write(test_server_code)

        # Start server
        server_proc = subprocess.Popen(
            [sys.executable, "test_server.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        # Give server time to start
        time.sleep(2)

        # Test connections
        test_urls = [
            f"http://127.0.0.1:{config['port']}/health",
            f"http://localhost:{config['port']}/health",
            f"http://0.0.0.0:{config['port']}/health" if config["host"] == "0.0.0.0" else None,
        ]

        for url in test_urls:
            if url is None:
                continue

            print(f"  Testing {url}...")
            try:
                # Test with requests
                response = requests.get(url, timeout=5)
                print(f"    ✓ Requests: {response.status_code} - {response.json()}")
            except Exception as e:
                print(f"    ✗ Requests failed: {e}")

            # Test with curl
            try:
                curl_result = subprocess.run(
                    ["curl", "-s", "-X", "GET", url], capture_output=True, text=True, timeout=5
                )
                if curl_result.returncode == 0:
                    print(f"    ✓ Curl: {curl_result.stdout}")
                else:
                    print(f"    ✗ Curl failed: {curl_result.stderr}")
            except subprocess.TimeoutExpired:
                print("    ✗ Curl timed out")
            except Exception as e:
                print(f"    ✗ Curl error: {e}")

        # Check if server is still running
        if server_proc.poll() is None:
            print(f"  Server still running (PID: {server_proc.pid})")
            # Kill server
            server_proc.terminate()
            server_proc.wait(timeout=5)
        else:
            print(f"  Server crashed! Exit code: {server_proc.poll()}")
            print(f"  Stdout: {server_proc.stdout.read()}")
            print(f"  Stderr: {server_proc.stderr.read()}")

        # Clean up
        os.remove("test_server.py")


def check_local_server():
    """Check if local_server.py exists and analyze it"""

    print("\n--- Analyzing local_server.py ---")

    if os.path.exists("backend/local_server.py"):
        with open("backend/local_server.py") as f:
            content = f.read()

        # Look for common issues
        issues = []

        if "app.run(" not in content:
            issues.append("No app.run() found")

        if "debug=True" in content:
            issues.append("Debug mode enabled (can cause issues with background running)")

        if "use_reloader=True" in content:
            issues.append("Reloader enabled (causes double process spawning)")

        # Check binding configuration
        if 'host="0.0.0.0"' in content:
            print("  Server configured to bind to all interfaces (0.0.0.0)")
        elif 'host="127.0.0.1"' in content:
            print("  Server configured to bind to localhost only (127.0.0.1)")
        else:
            print("  No explicit host binding found (defaults to 127.0.0.1)")

        if issues:
            print("  Potential issues found:")
            for issue in issues:
                print(f"    - {issue}")
        else:
            print("  No obvious configuration issues found")

        # Check for health endpoint
        if "/health" in content:
            print("  ✓ Health endpoint found")
        else:
            print("  ✗ No health endpoint found")

        # Show the app.run line
        lines = content.split("\n")
        for i, line in enumerate(lines):
            if "app.run(" in line:
                print(f"  app.run() configuration (line {i+1}): {line.strip()}")
    else:
        print("  backend/local_server.py not found!")


def test_with_flask_client():
    """Test using Flask's built-in test client"""

    print("\n--- Testing with Flask Test Client ---")

    try:
        # Import the app directly
        sys.path.insert(0, os.path.join(os.getcwd(), "backend"))
        from local_server import app

        os.environ["FALLBACK_TO_MEMORY"] = "true"
        os.environ["JWT_SECRET"] = "test-secret"

        app.config["TESTING"] = True
        client = app.test_client()

        # Test health endpoint
        response = client.get("/health")
        print(f"  Health endpoint: {response.status_code}")
        print(f"  Response: {response.get_json()}")

        # Test admin appointments endpoint
        response = client.get("/api/admin/appointments")
        print(f"  Admin appointments: {response.status_code}")
        data = response.get_json()
        print(f"  Response structure: {list(data.keys()) if data else 'None'}")
        if data and "errors" in data:
            print(f"  Errors field: {data['errors']}")

    except ImportError as e:
        print(f"  Failed to import app: {e}")
    except Exception as e:
        print(f"  Error: {e}")


if __name__ == "__main__":
    print("Flask Server Debug Tool")
    print("======================")

    # Run diagnostics
    check_local_server()
    test_server_binding()
    test_with_flask_client()

    print("\n--- Recommendations ---")
    print("1. Ensure your Flask app binds to '0.0.0.0' for external access")
    print("2. Disable debug mode and reloader for background running")
    print("3. Add explicit logging to see if requests are reaching the server")
    print("4. Consider using a process manager like 'flask run' or gunicorn")
