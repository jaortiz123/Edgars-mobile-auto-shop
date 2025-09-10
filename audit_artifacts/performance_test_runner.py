#!/usr/bin/env python3
"""
Performance Test Script for N+1 Query Detection and Load Analysis
Generates realistic API load against Edgar's Mobile Auto Shop endpoints
to capture slow queries and identify performance bottlenecks.
"""

import json
import random
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Dict, List, Optional

import requests


class PerformanceTestRunner:
    def __init__(self, base_url: str = "http://localhost:3001"):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.results: List[Dict] = []

        # Realistic test data patterns
        self.customer_ids = ["1", "2", "3", "4", "5"]  # From seed data
        self.admin_token = None

    def authenticate_admin(self) -> bool:
        """Authenticate as admin user for protected endpoints"""
        try:
            # Use test admin credentials from seed data
            auth_data = {"email": "admin@example.com", "password": "admin123"}

            response = self.session.post(f"{self.base_url}/api/auth/login", json=auth_data)
            if response.status_code == 200:
                token_data = response.json()
                self.admin_token = token_data.get("token") or token_data.get("data", {}).get(
                    "token"
                )
                if self.admin_token:
                    self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
                    return True

            print(f"❌ Admin authentication failed: {response.status_code}")
            return False

        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return False

    def health_check(self) -> bool:
        """Verify server is running and responsive"""
        try:
            response = self.session.get(f"{self.base_url}/health", timeout=5)
            return response.status_code == 200
        except Exception:
            return False

    def measure_endpoint(
        self, method: str, endpoint: str, data: Optional[Dict] = None, params: Optional[Dict] = None
    ) -> Dict:
        """Measure single endpoint performance"""
        start_time = time.perf_counter()

        try:
            if method.upper() == "GET":
                response = self.session.get(f"{self.base_url}{endpoint}", params=params, timeout=30)
            elif method.upper() == "POST":
                response = self.session.post(f"{self.base_url}{endpoint}", json=data, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            end_time = time.perf_counter()
            duration_ms = (end_time - start_time) * 1000

            return {
                "method": method.upper(),
                "endpoint": endpoint,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
                "response_size": len(response.content),
                "timestamp": datetime.now().isoformat(),
                "success": 200 <= response.status_code < 300,
                "params": params,
                "data": data,
            }

        except Exception as e:
            end_time = time.perf_counter()
            duration_ms = (end_time - start_time) * 1000

            return {
                "method": method.upper(),
                "endpoint": endpoint,
                "status_code": 0,
                "duration_ms": round(duration_ms, 2),
                "response_size": 0,
                "timestamp": datetime.now().isoformat(),
                "success": False,
                "error": str(e),
                "params": params,
                "data": data,
            }

    def test_n1_suspects(self) -> List[Dict]:
        """Test endpoints most likely to have N+1 query patterns"""
        print("🔍 Testing N+1 suspect endpoints...")

        tests = []

        # 1. Customer profile with appointment details (likely N+1)
        for customer_id in self.customer_ids[:3]:  # Test first 3 customers
            tests.append(
                (
                    "GET",
                    f"/api/admin/customers/{customer_id}",
                    None,
                    {"include": "appointmentDetails"},
                )
            )

        # 2. Appointments list (potential N+1 for services/payments)
        tests.append(("GET", "/api/admin/appointments", None, {"limit": "20"}))

        # 3. Customer history (likely N+1 for payments)
        for customer_id in self.customer_ids[:2]:
            tests.append(("GET", f"/api/customers/{customer_id}/history", None, None))

        # 4. Vehicle listings with aggregated data
        tests.append(("GET", "/api/admin/vehicles", None, {"limit": "50"}))

        # 5. Analytics dashboard (complex aggregations)
        tests.append(("GET", "/api/admin/analytics/dashboard", None, None))
        tests.append(("GET", "/api/admin/analytics/revenue", None, {"period": "last_30_days"}))

        # Execute tests
        results = []
        for method, endpoint, data, params in tests:
            print(f"  Testing {method} {endpoint}")
            result = self.measure_endpoint(method, endpoint, data, params)
            results.append(result)
            self.results.append(result)

            # Brief pause to avoid overwhelming server
            time.sleep(0.1)

        return results

    def concurrent_load_test(
        self, num_threads: int = 5, requests_per_thread: int = 10
    ) -> List[Dict]:
        """Run concurrent load test to stress database connections"""
        print(
            f"🚀 Running concurrent load test ({num_threads} threads, {requests_per_thread} requests each)..."
        )

        # Define mixed endpoint workload
        endpoints = [
            ("GET", "/api/health", None, None),
            ("GET", "/api/auth/verify-token", None, None),
            ("GET", "/api/admin/customers", None, {"limit": "10"}),
            ("GET", "/api/admin/appointments", None, {"limit": "10"}),
            ("GET", "/api/admin/vehicles", None, {"limit": "10"}),
        ]

        def worker_thread(thread_id: int) -> List[Dict]:
            """Worker thread function"""
            worker_results = []
            worker_session = requests.Session()
            if self.admin_token:
                worker_session.headers.update({"Authorization": f"Bearer {self.admin_token}"})

            for i in range(requests_per_thread):
                method, endpoint, data, params = random.choice(endpoints)

                start_time = time.perf_counter()
                try:
                    if method == "GET":
                        response = worker_session.get(
                            f"{self.base_url}{endpoint}", params=params, timeout=15
                        )
                    else:
                        response = worker_session.post(
                            f"{self.base_url}{endpoint}", json=data, timeout=15
                        )

                    end_time = time.perf_counter()
                    duration_ms = (end_time - start_time) * 1000

                    result = {
                        "thread_id": thread_id,
                        "request_id": i,
                        "method": method,
                        "endpoint": endpoint,
                        "status_code": response.status_code,
                        "duration_ms": round(duration_ms, 2),
                        "timestamp": datetime.now().isoformat(),
                        "success": 200 <= response.status_code < 300,
                    }

                except Exception as e:
                    end_time = time.perf_counter()
                    duration_ms = (end_time - start_time) * 1000

                    result = {
                        "thread_id": thread_id,
                        "request_id": i,
                        "method": method,
                        "endpoint": endpoint,
                        "status_code": 0,
                        "duration_ms": round(duration_ms, 2),
                        "timestamp": datetime.now().isoformat(),
                        "success": False,
                        "error": str(e),
                    }

                worker_results.append(result)

                # Random delay between requests
                time.sleep(random.uniform(0.05, 0.2))

            return worker_results

        # Execute concurrent load
        all_results = []
        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(worker_thread, i) for i in range(num_threads)]

            for future in as_completed(futures):
                try:
                    thread_results = future.result()
                    all_results.extend(thread_results)
                    self.results.extend(thread_results)
                except Exception as e:
                    print(f"❌ Thread error: {e}")

        return all_results

    def analyze_results(self) -> Dict:
        """Analyze performance test results"""
        if not self.results:
            return {}

        # Group by endpoint
        endpoint_stats = {}
        for result in self.results:
            endpoint = result["endpoint"]
            if endpoint not in endpoint_stats:
                endpoint_stats[endpoint] = {
                    "requests": 0,
                    "successes": 0,
                    "failures": 0,
                    "durations": [],
                    "errors": [],
                }

            stats = endpoint_stats[endpoint]
            stats["requests"] += 1
            stats["durations"].append(result["duration_ms"])

            if result["success"]:
                stats["successes"] += 1
            else:
                stats["failures"] += 1
                if "error" in result:
                    stats["errors"].append(result["error"])

        # Calculate statistics
        analysis = {}
        for endpoint, stats in endpoint_stats.items():
            durations = stats["durations"]
            durations.sort()

            n = len(durations)
            p50 = durations[n // 2] if n > 0 else 0
            p95 = durations[int(n * 0.95)] if n > 0 else 0
            p99 = durations[int(n * 0.99)] if n > 0 else 0

            analysis[endpoint] = {
                "requests": stats["requests"],
                "success_rate": (
                    stats["successes"] / stats["requests"] * 100 if stats["requests"] > 0 else 0
                ),
                "avg_duration_ms": sum(durations) / len(durations) if durations else 0,
                "p50_ms": p50,
                "p95_ms": p95,
                "p99_ms": p99,
                "min_ms": min(durations) if durations else 0,
                "max_ms": max(durations) if durations else 0,
                "failures": stats["failures"],
                "error_rate": (
                    stats["failures"] / stats["requests"] * 100 if stats["requests"] > 0 else 0
                ),
            }

        return analysis

    def save_results(self, filename: str = "performance_test_results.json"):
        """Save results to JSON file"""
        timestamp = datetime.now().isoformat()
        output = {
            "timestamp": timestamp,
            "summary": self.analyze_results(),
            "raw_results": self.results,
        }

        with open(filename, "w") as f:
            json.dump(output, f, indent=2)

        print(f"💾 Results saved to {filename}")
        return filename

    def run_full_test_suite(self):
        """Run complete performance test suite"""
        print("🧪 Starting Edgar's Mobile Auto Shop Performance Test Suite")
        print("=" * 70)

        # 1. Health check
        print("1️⃣ Health check...")
        if not self.health_check():
            print("❌ Server not responding. Please start the Flask server first.")
            return False
        print("✅ Server is responsive")

        # 2. Authentication
        print("\n2️⃣ Admin authentication...")
        if not self.authenticate_admin():
            print("⚠️ Admin authentication failed. Some tests may fail.")
        else:
            print("✅ Admin authenticated")

        # 3. N+1 suspect endpoint tests
        print("\n3️⃣ N+1 suspect endpoint tests...")
        self.test_n1_suspects()

        # 4. Concurrent load test
        print("\n4️⃣ Concurrent load test...")
        self.concurrent_load_test(num_threads=3, requests_per_thread=5)

        # 5. Analysis and results
        print("\n5️⃣ Analyzing results...")
        analysis = self.analyze_results()

        # Print summary
        print("\n📊 PERFORMANCE TEST RESULTS")
        print("=" * 50)

        for endpoint, stats in analysis.items():
            print(f"\n🔗 {endpoint}")
            print(f"   Requests: {stats['requests']}")
            print(f"   Success Rate: {stats['success_rate']:.1f}%")
            print(f"   Avg Response: {stats['avg_duration_ms']:.1f}ms")
            print(f"   P95: {stats['p95_ms']:.1f}ms")
            print(f"   P99: {stats['p99_ms']:.1f}ms")

            # Flag slow endpoints
            if stats["p95_ms"] > 300:
                print("   ⚠️ P95 exceeds 300ms target!")
            if stats["p99_ms"] > 800:
                print("   🚨 P99 exceeds 800ms target!")
            if stats["error_rate"] > 1:
                print(f"   🚨 Error rate {stats['error_rate']:.1f}% exceeds 1% target!")

        # Save results
        results_file = self.save_results()

        print("\n✅ Performance test suite complete!")
        print(f"📄 Detailed results: {results_file}")
        print("🔍 Check PostgreSQL slow query log for database analysis")

        return True


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Edgar's Auto Shop Performance Test")
    parser.add_argument("--url", default="http://localhost:3001", help="Base URL for the API")
    parser.add_argument("--threads", type=int, default=3, help="Number of concurrent threads")
    parser.add_argument("--requests", type=int, default=5, help="Requests per thread")
    parser.add_argument("--quick", action="store_true", help="Run quick test (skip load test)")

    args = parser.parse_args()

    runner = PerformanceTestRunner(args.url)

    if args.quick:
        # Quick test - just N+1 suspects
        if runner.health_check():
            runner.authenticate_admin()
            runner.test_n1_suspects()
            analysis = runner.analyze_results()
            runner.save_results("quick_test_results.json")

            print("\n📊 Quick Test Results:")
            for endpoint, stats in analysis.items():
                print(
                    f"{endpoint}: {stats['avg_duration_ms']:.1f}ms avg, {stats['p95_ms']:.1f}ms P95"
                )
        else:
            print("❌ Server not responding")
    else:
        # Full test suite
        runner.run_full_test_suite()


if __name__ == "__main__":
    main()
