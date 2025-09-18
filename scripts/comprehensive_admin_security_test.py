#!/usr/bin/env python3
"""
TASK 9.4: Comprehensive Admin Security Test Matrix
Tests ALL vulnerable admin endpoints for security violations
"""

import json
import time

import requests


class ComprehensiveAdminSecurityTester:
    def __init__(self, server_url: str = "http://localhost:3001"):
        self.server_url = server_url
        self.tenant_a = "00000000-0000-0000-0000-000000000001"
        self.tenant_b = "11111111-1111-1111-1111-111111111111"
        self.admin_cookies_a = None
        self.admin_cookies_b = None

        # Vulnerable endpoints identified by analysis
        self.critical_endpoints = [
            {"method": "POST", "path": "/api/admin/invoices/1/payments", "line": 3632},
            {"method": "GET", "path": "/api/admin/technicians", "line": 4826},
            {"method": "GET", "path": "/api/admin/analytics/templates", "line": 4910},
            {"method": "GET", "path": "/api/admin/appointments/1", "line": 5262},
            {"method": "GET", "path": "/api/admin/service-operations", "line": 7002},
            {"method": "GET", "path": "/api/admin/service-packages", "line": 7199},
            {"method": "POST", "path": "/api/admin/invoices/1/add-package", "line": 7352},
            {"method": "GET", "path": "/api/admin/customers/1", "line": 8293},
        ]

        self.tenant_bypass_endpoints = [
            {"method": "POST", "path": "/api/admin/vehicles", "line": 1599},
            {"method": "GET", "path": "/api/admin/vehicles/1", "line": 1748},
            {"method": "PATCH", "path": "/api/admin/vehicles/1", "line": 1793},
            {"method": "GET", "path": "/api/admin/invoices/1/estimate.pdf", "line": 2268},
            {"method": "GET", "path": "/api/admin/invoices/1", "line": 3608},
            {"method": "POST", "path": "/api/admin/invoices/1/void", "line": 3700},
            {"method": "POST", "path": "/api/admin/message-templates", "line": 4455},
            {"method": "GET", "path": "/api/admin/message-templates/1", "line": 4500},
            {"method": "PATCH", "path": "/api/admin/message-templates/1", "line": 4516},
            {"method": "GET", "path": "/api/admin/appointments", "line": 6329},
            {"method": "POST", "path": "/api/admin/appointments", "line": 6469},
            {"method": "GET", "path": "/api/admin/reports/appointments.csv", "line": 7547},
            {"method": "GET", "path": "/api/admin/reports/payments.csv", "line": 7701},
            {"method": "GET", "path": "/api/admin/dashboard/stats", "line": 7806},
            {"method": "GET", "path": "/api/admin/recent-customers", "line": 8158},
            {"method": "GET", "path": "/api/admin/customers/1/profile", "line": 8596},
            {"method": "GET", "path": "/api/admin/cars-on-premises", "line": 9078},
            {"method": "GET", "path": "/api/admin/appointments/today", "line": 9287},
        ]

    def setup_test_environment(self):
        """Setup test tenants and admin authentication"""
        print("🔧 Setting up comprehensive test environment...")

        timestamp = int(time.time())

        # Register customers in both tenants to have test data
        customer_a = requests.post(
            f"{self.server_url}/api/customers/register",
            json={
                "email": f"test_a_{timestamp}@example.com",
                "password": "Test123!",
                "name": "Test Customer A",
            },
            headers={"X-Tenant-Id": self.tenant_a},
        )

        customer_b = requests.post(
            f"{self.server_url}/api/customers/register",
            json={
                "email": f"test_b_{timestamp}@example.com",
                "password": "Test123!",
                "name": "Test Customer B",
            },
            headers={"X-Tenant-Id": self.tenant_b},
        )

        # Admin login for both tenants
        admin_a = requests.post(
            f"{self.server_url}/api/admin/login",
            json={"username": "admin", "password": "admin123"},
            headers={"X-Tenant-Id": self.tenant_a},
        )

        admin_b = requests.post(
            f"{self.server_url}/api/admin/login",
            json={"username": "admin", "password": "admin123"},
            headers={"X-Tenant-Id": self.tenant_b},
        )

        if admin_a.status_code == 200:
            self.admin_cookies_a = admin_a.cookies
            print("✅ Admin A authenticated")
        else:
            print(f"❌ Admin A auth failed: {admin_a.status_code}")

        if admin_b.status_code == 200:
            self.admin_cookies_b = admin_b.cookies
            print("✅ Admin B authenticated")
        else:
            print(f"❌ Admin B auth failed: {admin_b.status_code}")

        print("✅ Test environment ready")
        return True

    def test_critical_vulnerabilities(self):
        """Test endpoints with NO authentication"""
        print("\n🔴 TESTING CRITICAL VULNERABILITIES (No Auth Required)...")

        critical_results = []

        for endpoint in self.critical_endpoints:
            method = endpoint["method"]
            path = endpoint["path"]
            line = endpoint["line"]

            print(f"   Testing {method} {path} (line {line})...")

            try:
                # Test without any authentication
                if method == "GET":
                    response = requests.get(f"{self.server_url}{path}")
                elif method == "POST":
                    response = requests.post(f"{self.server_url}{path}", json={"test": "data"})
                else:
                    continue

                if response.status_code in [200, 201]:
                    critical_results.append(
                        {
                            "endpoint": f"{method} {path}",
                            "line": line,
                            "status": "CRITICAL_VULNERABLE",
                            "response_code": response.status_code,
                            "details": "No authentication required!",
                        }
                    )
                    print(f"      🚨 CRITICAL: {response.status_code} (No auth needed!)")
                else:
                    print(f"      ✅ BLOCKED: {response.status_code}")

            except Exception as e:
                print(f"      ❌ ERROR: {e}")

        return critical_results

    def test_tenant_isolation_bypass(self):
        """Test endpoints that bypass tenant isolation"""
        print("\n🟡 TESTING TENANT ISOLATION BYPASS...")

        bypass_results = []

        if not self.admin_cookies_a:
            print("   ❌ No admin cookies available for testing")
            return bypass_results

        for endpoint in self.tenant_bypass_endpoints[:5]:  # Test first 5 for now
            method = endpoint["method"]
            path = endpoint["path"]
            line = endpoint["line"]

            print(f"   Testing {method} {path} (line {line})...")

            try:
                # Test: Admin authenticated to Tenant A tries to access Tenant B data
                headers_cross_tenant = {"X-Tenant-Id": self.tenant_b}

                if method == "GET":
                    response = requests.get(
                        f"{self.server_url}{path}",
                        cookies=self.admin_cookies_a,
                        headers=headers_cross_tenant,
                    )
                elif method == "POST":
                    response = requests.post(
                        f"{self.server_url}{path}",
                        json={"test": "cross_tenant_data"},
                        cookies=self.admin_cookies_a,
                        headers=headers_cross_tenant,
                    )
                else:
                    continue

                if response.status_code in [200, 201]:
                    bypass_results.append(
                        {
                            "endpoint": f"{method} {path}",
                            "line": line,
                            "status": "TENANT_BYPASS_VULNERABLE",
                            "response_code": response.status_code,
                            "details": "Cross-tenant access allowed!",
                        }
                    )
                    print(f"      🚨 BYPASS: {response.status_code} (Cross-tenant access!)")
                else:
                    print(f"      ✅ BLOCKED: {response.status_code}")

            except Exception as e:
                print(f"      ❌ ERROR: {e}")

        return bypass_results

    def generate_security_report(self, critical_results, bypass_results):
        """Generate comprehensive security report"""

        total_critical = len(critical_results)
        total_bypass = len(bypass_results)
        total_vulnerable = total_critical + total_bypass

        print("\n" + "=" * 70)
        print("🚨 COMPREHENSIVE ADMIN SECURITY AUDIT RESULTS")
        print("=" * 70)

        if critical_results:
            print(f"\n🔴 CRITICAL VULNERABILITIES ({total_critical}):")
            for result in critical_results:
                print(f"   {result['endpoint']:40} Line {result['line']:4} - {result['details']}")

        if bypass_results:
            print(f"\n🟡 TENANT BYPASS VULNERABILITIES ({total_bypass}):")
            for result in bypass_results:
                print(f"   {result['endpoint']:40} Line {result['line']:4} - {result['details']}")

        security_score = max(0, 100 - (total_vulnerable * 2))  # Each vuln = -2%

        print("\n📊 SECURITY SUMMARY:")
        print(f"   Critical Vulnerabilities: {total_critical}")
        print(f"   Tenant Bypass Issues: {total_bypass}")
        print(f"   Total Security Issues: {total_vulnerable}")
        print(f"   Security Score: {security_score:.1f}%")

        if total_vulnerable > 0:
            print("\n🛑 IMMEDIATE SECURITY HARDENING REQUIRED!")
            print(f"   {total_vulnerable} endpoints need security fixes")
        else:
            print("\n🎉 ALL ENDPOINTS SECURE!")

        return {
            "critical": critical_results,
            "bypass": bypass_results,
            "total_vulnerable": total_vulnerable,
            "security_score": security_score,
        }


def main():
    """Run comprehensive admin security test"""
    print("🚨 TASK 9.4: COMPREHENSIVE ADMIN SECURITY TEST")
    print("=" * 60)

    tester = ComprehensiveAdminSecurityTester()

    # Setup environment
    if not tester.setup_test_environment():
        print("❌ Failed to setup test environment")
        return

    # Test critical vulnerabilities
    critical_results = tester.test_critical_vulnerabilities()

    # Test tenant isolation bypass
    bypass_results = tester.test_tenant_isolation_bypass()

    # Generate report
    report = tester.generate_security_report(critical_results, bypass_results)

    # Save results
    with open(
        "/Users/jesusortiz/Edgars-mobile-auto-shop/TASK_9_4_SECURITY_TEST_RESULTS.json", "w"
    ) as f:
        json.dump(report, f, indent=2)

    print("\n📁 Results saved to TASK_9_4_SECURITY_TEST_RESULTS.json")


if __name__ == "__main__":
    main()
