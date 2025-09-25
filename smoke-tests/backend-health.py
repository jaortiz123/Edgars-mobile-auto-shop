import json
import sys
import time
from typing import Dict, List

import requests


class SmokeTestSuite:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.results: List[Dict] = []

    def test_health_endpoint(self) -> bool:
        """Test basic health endpoint"""
        try:
            start = time.time()
            response = requests.get(f"{self.base_url}/health", timeout=10)
            duration = (time.time() - start) * 1000

            success = response.status_code == 200
            self.results.append(
                {
                    "test": "health_endpoint",
                    "success": success,
                    "duration_ms": round(duration, 2),
                    "status_code": response.status_code,
                    "url": f"{self.base_url}/health",
                }
            )
            return success
        except Exception as e:
            self.results.append(
                {
                    "test": "health_endpoint",
                    "success": False,
                    "error": str(e),
                    "url": f"{self.base_url}/health",
                }
            )
            return False

    def test_status_board_endpoint(self) -> bool:
        """Test status board API with SLO validation"""
        try:
            start = time.time()
            response = requests.get(f"{self.base_url}/api/admin/appointments/board", timeout=15)
            duration = (time.time() - start) * 1000

            slo_compliant = duration < 800  # SLO: <800ms p95
            success = response.status_code == 200 and slo_compliant

            self.results.append(
                {
                    "test": "status_board_endpoint",
                    "success": success,
                    "duration_ms": round(duration, 2),
                    "status_code": response.status_code,
                    "slo_compliant": slo_compliant,
                    "slo_target_ms": 800,
                    "url": f"{self.base_url}/api/admin/appointments/board",
                }
            )
            return success
        except Exception as e:
            self.results.append(
                {
                    "test": "status_board_endpoint",
                    "success": False,
                    "error": str(e),
                    "url": f"{self.base_url}/api/admin/appointments/board",
                }
            )
            return False

    def test_dashboard_stats(self) -> bool:
        """Test dashboard stats with SLO validation"""
        try:
            start = time.time()
            response = requests.get(f"{self.base_url}/api/admin/dashboard/stats", timeout=10)
            duration = (time.time() - start) * 1000

            slo_compliant = duration < 500  # SLO: <500ms p95
            success = response.status_code == 200 and slo_compliant

            self.results.append(
                {
                    "test": "dashboard_stats",
                    "success": success,
                    "duration_ms": round(duration, 2),
                    "status_code": response.status_code,
                    "slo_compliant": slo_compliant,
                    "slo_target_ms": 500,
                    "url": f"{self.base_url}/api/admin/dashboard/stats",
                }
            )
            return success
        except Exception as e:
            self.results.append(
                {
                    "test": "dashboard_stats",
                    "success": False,
                    "error": str(e),
                    "url": f"{self.base_url}/api/admin/dashboard/stats",
                }
            )
            return False

    def test_appointments_endpoint(self) -> bool:
        """Test appointments listing endpoint"""
        try:
            start = time.time()
            response = requests.get(f"{self.base_url}/api/appointments", timeout=10)
            duration = (time.time() - start) * 1000

            success = response.status_code == 200

            # Try to parse JSON response
            data = None
            if success:
                try:
                    data = response.json()
                    # Validate response structure
                    if isinstance(data, dict) and "appointments" in data:
                        success = True
                    else:
                        success = False
                except json.JSONDecodeError:
                    success = False

            self.results.append(
                {
                    "test": "appointments_endpoint",
                    "success": success,
                    "duration_ms": round(duration, 2),
                    "status_code": response.status_code,
                    "has_valid_json": data is not None,
                    "url": f"{self.base_url}/api/appointments",
                }
            )
            return success
        except Exception as e:
            self.results.append(
                {
                    "test": "appointments_endpoint",
                    "success": False,
                    "error": str(e),
                    "url": f"{self.base_url}/api/appointments",
                }
            )
            return False

    def run_all_tests(self) -> bool:
        """Run complete smoke test suite"""
        print("🧪 Starting Smoke Test Suite...")
        print(f"🎯 Target URL: {self.base_url}")
        print()

        tests = [
            self.test_health_endpoint,
            self.test_status_board_endpoint,
            self.test_dashboard_stats,
            self.test_appointments_endpoint,
        ]

        passed = 0
        for test in tests:
            test_name = test.__name__.replace("test_", "").replace("_", " ").title()
            print(f"🔍 Running: {test_name}...")

            if test():
                passed += 1
                print(f"✅ {test_name} PASSED")
            else:
                print(f"❌ {test_name} FAILED")
            print()

        success_rate = passed / len(tests)
        print("📊 Results Summary:")
        print(f"   ✅ Passed: {passed}/{len(tests)} ({success_rate:.1%})")
        print(f"   ❌ Failed: {len(tests) - passed}/{len(tests)}")

        return success_rate == 1.0

    def generate_report(self) -> Dict:
        """Generate detailed test report"""
        passed = sum(1 for r in self.results if r["success"])
        failed = len(self.results) - passed

        # Calculate SLO compliance
        slo_tests = [r for r in self.results if "slo_compliant" in r]
        slo_compliant = sum(1 for r in slo_tests if r.get("slo_compliant", False))

        return {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "target_url": self.base_url,
            "summary": {
                "total_tests": len(self.results),
                "passed": passed,
                "failed": failed,
                "success_rate": passed / len(self.results) if self.results else 0,
                "slo_tests": len(slo_tests),
                "slo_compliant": slo_compliant,
            },
            "test_results": self.results,
            "recommendations": self._generate_recommendations(),
        }

    def _generate_recommendations(self) -> List[str]:
        """Generate recommendations based on test results"""
        recommendations = []

        failed_tests = [r for r in self.results if not r["success"]]
        if failed_tests:
            recommendations.append(
                "❌ Some tests failed - check network connectivity and service health"
            )

        slow_tests = [r for r in self.results if r.get("duration_ms", 0) > 1000]
        if slow_tests:
            recommendations.append("⚠️ Some requests >1s - investigate performance bottlenecks")

        slo_violations = [r for r in self.results if not r.get("slo_compliant", True)]
        if slo_violations:
            recommendations.append("🎯 SLO violations detected - performance optimization needed")

        if not recommendations:
            recommendations.append("🎉 All tests passed - system healthy and performant!")

        return recommendations


if __name__ == "__main__":
    # Default to production URL from Sprint 2, allow override via command line
    default_url = "https://onourabnw45tm2rrq72gegkgai0codqj.lambda-url.us-west-2.on.aws"
    base_url = sys.argv[1] if len(sys.argv) > 1 else default_url

    print("🚀 Edgar's Mobile Auto Shop - Production Smoke Tests")
    print("=" * 60)

    suite = SmokeTestSuite(base_url)
    success = suite.run_all_tests()

    # Generate and display detailed report
    report = suite.generate_report()

    print("\n📋 Detailed Test Report:")
    print("=" * 40)
    print(f"Timestamp: {report['timestamp']}")
    print(f"Target URL: {report['target_url']}")
    print(f"Success Rate: {report['summary']['success_rate']:.1%}")

    if report["summary"]["slo_tests"] > 0:
        slo_rate = report["summary"]["slo_compliant"] / report["summary"]["slo_tests"]
        print(f"SLO Compliance: {slo_rate:.1%}")

    print("\n🔍 Individual Test Results:")
    for result in report["test_results"]:
        status = "✅" if result["success"] else "❌"
        test_name = result["test"].replace("_", " ").title()

        duration_str = f"{result.get('duration_ms', 0):.1f}ms"
        if "slo_target_ms" in result:
            slo_status = "✅" if result.get("slo_compliant", False) else "⚠️"
            duration_str += f" (SLO: <{result['slo_target_ms']}ms {slo_status})"

        print(f"  {status} {test_name}: {duration_str}")
        if "error" in result:
            print(f"      Error: {result['error']}")

    print("\n💡 Recommendations:")
    for rec in report["recommendations"]:
        print(f"  {rec}")

    # Save report to file
    report_file = f"smoke_test_report_{int(time.time())}.json"
    with open(report_file, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n📄 Full report saved to: {report_file}")

    # Exit with appropriate code
    sys.exit(0 if success else 1)
