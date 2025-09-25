#!/usr/bin/env python3
"""
Development SigV4 Proxy for Edgar's Auto Shop API
Provides unsigned local proxy to IAM-protected Lambda Function URL
"""

import logging
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

import boto3
import requests
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ProxyHandler(BaseHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Get Lambda URL from environment
        self.lambda_url = os.environ.get(
            "LAMBDA_URL", "https://onourabnw45tm2rrq72gegkgai0codqj.lambda-url.us-west-2.on.aws"
        )

        # Initialize AWS session and credentials
        self.session = boto3.Session()
        self.credentials = self.session.get_credentials()

        super().__init__(*args, **kwargs)

    def do_GET(self):
        self.proxy_request("GET")

    def do_POST(self):
        self.proxy_request("POST")

    def do_PUT(self):
        self.proxy_request("PUT")

    def do_PATCH(self):
        self.proxy_request("PATCH")

    def do_DELETE(self):
        self.proxy_request("DELETE")

    def do_OPTIONS(self):
        # Handle CORS preflight
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def proxy_request(self, method):
        try:
            # Build target URL
            target_url = f"{self.lambda_url.rstrip('/')}{self.path}"

            # Get request body for POST/PUT/PATCH
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b""

            # Create AWS request
            request = AWSRequest(
                method=method,
                url=target_url,
                data=body,
                headers={"Content-Type": self.headers.get("Content-Type", "application/json")},
            )

            # Sign request with SigV4
            SigV4Auth(self.credentials, "lambda", "us-west-2").add_auth(request)

            # Make signed request
            logger.info(f"Proxying {method} {self.path} -> {target_url}")

            response = requests.request(
                method=request.method,
                url=request.url,
                headers=dict(request.headers),
                data=request.body,
            )

            # Send response back to client
            self.send_response(response.status_code)

            # Add CORS headers
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header(
                "Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            )
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

            # Forward response headers (except CORS which we handle)
            for name, value in response.headers.items():
                if not name.lower().startswith("access-control-"):
                    self.send_header(name, value)

            self.end_headers()

            # Forward response body
            self.wfile.write(response.content)

            logger.info(f"Response: {response.status_code} ({len(response.content)} bytes)")

        except Exception as e:
            logger.error(f"Proxy error: {e}")
            self.send_error(500, f"Proxy error: {e}")

    def log_message(self, format, *args):
        # Use our logger instead of default stderr
        logger.info(f"{self.address_string()} - {format % args}")


def main():
    port = int(os.environ.get("PROXY_PORT", 8080))
    lambda_url = os.environ.get(
        "LAMBDA_URL", "https://onourabnw45tm2rrq72gegkgai0codqj.lambda-url.us-west-2.on.aws"
    )

    print("🚀 Starting SigV4 Proxy Server")
    print(f"   Local:  http://localhost:{port}")
    print(f"   Target: {lambda_url}")
    print(f"   Usage:  curl http://localhost:{port}/api/admin/dashboard/stats")
    print()

    server = HTTPServer(("localhost", port), ProxyHandler)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Shutting down proxy server")
        server.shutdown()


if __name__ == "__main__":
    main()
