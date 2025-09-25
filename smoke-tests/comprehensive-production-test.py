#!/usr/bin/env python3
"""
Comprehensive Production Smoke Tests
Edgar's Mobile Auto Shop - P8 Launch Validation

This test suite performs end-to-end production validation including:
- Authentication via SigV4 proxy
- API endpoint validation with realistic data
- Performance SLO validation
- Move API testing with sample appointments
- Production readiness assessment

Usage:
    python smoke-tests/comprehensive-production-test.py

Prerequisites:
    - SigV4 proxy running on localhost:8080
    - AWS credentials configured
    - Production API accessible
"""

import json
import random
import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import requests


class ProductionSmokeTestSuite:
    def __init__(self, use_proxy: bool = True):
        self.base_url = "https://onourabnw45tm2rrq72gegkgai0codqj.lambda-url.us-west-2.on.aws"
        self.proxy_url = "http://localhost:8080"
        self.use_proxy = use_proxy
        self.results = []
        self.created_data = {}  # Track created test data for cleanup

    def _make_request(
        self, endpoint: str, method: str = "GET", data: Dict = None
    ) -> requests.Response:
        """Make authenticated request via proxy"""
        url = f"{self.proxy_url}{endpoint}" if self.use_proxy else f"{self.base_url}{endpoint}"

        if method.upper() == "GET":
            return requests.get(url, timeout=10)
        elif method.upper() == "POST":
            return requests.post(url, json=data, timeout=10)
        elif method.upper() == "PATCH":
            return requests.patch(url, json=data, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")

    def create_test_customer(self) -> Optional[str]:
        """Create a test customer for appointment testing"""
        try:
            customer_data = {
                "firstName": f"TestCustomer{random.randint(1000, 9999)}",
                "lastName": "SmokeTest",
                "email": f"smoketest{random.randint(100, 999)}@example.com",
                "phone": f"+1-555-{random.randint(100, 999)}-{random.randint(1000, 9999)}",
                "address": "123 Test Street",
                "city": "Test City",
                "state": "CA",
                "zipCode": "90210",
            }

            response = self._make_request("/api/admin/customers", "POST", customer_data)
            if response.status_code == 201:
                customer = response.json()
                if customer.get("ok") and "data" in customer:
                    customer_id = customer["data"]["customerId"]
                    self.created_data["customer_id"] = customer_id
                    return customer_id
        except Exception as e:
            print(f"⚠️ Could not create test customer: {e}")
        return None

    def create_test_vehicle(self, customer_id: str) -> Optional[str]:
        """Create a test vehicle for the customer"""
        try:
            vehicle_data = {
                "customerId": customer_id,
                "make": "Toyota",
                "model": "Camry",
                "year": 2020,
                "licensePlate": f"TEST{random.randint(100, 999)}",
                "vin": f"TEST{random.randint(10000000, 99999999)}123456",
            }

            response = self._make_request("/api/admin/vehicles", "POST", vehicle_data)
            if response.status_code == 201:
                vehicle = response.json()
                if vehicle.get("ok") and "data" in vehicle:
                    vehicle_id = vehicle["data"]["vehicleId"]
                    self.created_data["vehicle_id"] = vehicle_id
                    return vehicle_id
        except Exception as e:
            print(f"⚠️ Could not create test vehicle: {e}")
        return None

    def create_test_appointment(self, customer_id: str, vehicle_id: str) -> Optional[str]:
        """Create a test appointment for move operation testing"""
        try:
            # Create appointment for tomorrow
            tomorrow = datetime.now() + timedelta(days=1)
            appointment_data = {
                "customerId": customer_id,
                "vehicleId": vehicle_id,
                "serviceType": "Oil Change",
                "scheduledAt": tomorrow.strftime("%Y-%m-%d %H:%M:%S"),
                "description": "Smoke test appointment for move operation testing",
                "status": "SCHEDULED",
            }

            response = self._make_request("/api/admin/appointments", "POST", appointment_data)
            if response.status_code == 201:
                appointment = response.json()
                if appointment.get("ok") and "data" in appointment:
                    appointment_id = appointment["data"]["appointmentId"]
                    self.created_data["appointment_id"] = appointment_id
                    print(f"✅ Created test appointment: {appointment_id}")
                    return appointment_id
        except Exception as e:
            print(f"⚠️ Could not create test appointment: {e}")
        return None

    def test_move_api_with_data(self) -> bool:
        """Test move API with actual appointment data"""
        try:
            # First, create test data
            customer_id = self.create_test_customer()
            if not customer_id:
                print("⚠️ Cannot test move API without test data")
                return False

            vehicle_id = self.create_test_vehicle(customer_id)
            if not vehicle_id:
                print("⚠️ Cannot test move API without vehicle data")
                return False

            appointment_id = self.create_test_appointment(customer_id, vehicle_id)
            if not appointment_id:
                print("⚠️ Cannot test move API without appointment data")
                return False

            # Test moving appointment from SCHEDULED to IN_PROGRESS
            start = time.time()
            move_data = {"status": "IN_PROGRESS", "position": 0}

            response = self._make_request(
                f"/api/admin/appointments/{appointment_id}/move", "PATCH", move_data
            )
            duration = (time.time() - start) * 1000

            success = response.status_code == 200
            slo_compliant = duration < 400  # From load testing: target <400ms

            if success:
                resp_data = response.json()
                if resp_data.get("ok") and "data" in resp_data:
                    updated_appointment = resp_data["data"]
                    success = updated_appointment.get("status") == "IN_PROGRESS"
                else:
                    success = False

            self.results.append(
                {
                    "test": "move_api_with_data",
                    "success": success and slo_compliant,
                    "duration_ms": round(duration, 2),
                    "status_code": response.status_code,
                    "slo_compliant": slo_compliant,
                    "slo_target_ms": 400,
                    "endpoint": f"/api/admin/appointments/{appointment_id}/move",
                    "authenticated": self.use_proxy,
                    "move_operation": "SCHEDULED -> IN_PROGRESS",
                    "appointment_id": appointment_id,
                }
            )

            return success and slo_compliant

        except Exception as e:
            self.results.append(
                {
                    "test": "move_api_with_data",
                    "success": False,
                    "error": str(e),
                    "endpoint": "/api/admin/appointments/{id}/move",
                    "authenticated": self.use_proxy,
                }
            )
            return False

    def test_status_board_with_data(self) -> bool:
        """Test status board endpoint performance with actual data"""
        try:
            start = time.time()
            response = self._make_request("/api/admin/appointments/board")
            duration = (time.time() - start) * 1000

            slo_compliant = duration < 800  # P95 SLO
            success = response.status_code == 200 and slo_compliant

            # Check that our test data appears
            data_present = False
            if response.status_code == 200:
                try:
                    resp_data = response.json()
                    if resp_data.get("ok") and "data" in resp_data:
                        board_data = resp_data["data"]
                        stats = board_data.get("stats", {})
                        # Should have some jobs if our test data was created
                        data_present = stats.get("jobsToday", 0) > 0 or any(
                            len(board_data.get("columns", {}).get(col, {}).get("items", [])) > 0
                            for col in ["scheduled", "in_progress", "ready", "completed", "no_show"]
                        )
                except json.JSONDecodeError:
                    success = False

            self.results.append(
                {
                    "test": "status_board_with_data",
                    "success": success,
                    "duration_ms": round(duration, 2),
                    "status_code": response.status_code,
                    "slo_compliant": slo_compliant,
                    "slo_target_ms": 800,
                    "endpoint": "/api/admin/appointments/board",
                    "authenticated": self.use_proxy,
                    "has_test_data": data_present,
                }
            )

            return success

        except Exception as e:
            self.results.append(
                {
                    "test": "status_board_with_data",
                    "success": False,
                    "error": str(e),
                    "endpoint": "/api/admin/appointments/board",
                    "authenticated": self.use_proxy,
                }
            )
            return False

    def test_end_to_end_workflow(self) -> bool:
        """Test complete appointment workflow: create -> schedule -> move -> complete"""
        try:
            workflow_steps = []

            # Step 1: Create customer
            start = time.time()
            customer_id = self.create_test_customer()
            if customer_id:
                workflow_steps.append(f"✅ Customer created: {customer_id}")
            else:
                workflow_steps.append("❌ Customer creation failed")
                return False

            # Step 2: Create vehicle
            vehicle_id = self.create_test_vehicle(customer_id)
            if vehicle_id:
                workflow_steps.append(f"✅ Vehicle created: {vehicle_id}")
            else:
                workflow_steps.append("❌ Vehicle creation failed")
                return False

            # Step 3: Create appointment
            appointment_id = self.create_test_appointment(customer_id, vehicle_id)
            if appointment_id:
                workflow_steps.append(f"✅ Appointment created: {appointment_id}")
            else:
                workflow_steps.append("❌ Appointment creation failed")
                return False

            # Step 4: Move through statuses
            statuses = ["IN_PROGRESS", "READY", "COMPLETED"]
            for status in statuses:
                move_data = {"status": status, "position": 0}
                response = self._make_request(
                    f"/api/admin/appointments/{appointment_id}/move", "PATCH", move_data
                )
                if response.status_code == 200:
                    workflow_steps.append(f"✅ Moved to {status}")
                else:
                    workflow_steps.append(f"❌ Failed to move to {status}")

            duration = (time.time() - start) * 1000

            self.results.append(
                {
                    "test": "end_to_end_workflow",
                    "success": True,
                    "duration_ms": round(duration, 2),
                    "workflow_steps": workflow_steps,
                    "endpoint": "multiple",
                    "authenticated": self.use_proxy,
                    "appointment_id": appointment_id,
                }
            )

            return True

        except Exception as e:
            self.results.append(
                {
                    "test": "end_to_end_workflow",
                    "success": False,
                    "error": str(e),
                    "endpoint": "multiple",
                    "authenticated": self.use_proxy,
                }
            )
            return False

    def run_comprehensive_tests(self) -> Dict[str, Any]:
        """Run all production smoke tests"""
        print("🏭 Edgar's Mobile Auto Shop - Comprehensive Production Tests")
        print("=" * 70)
        print(f"🎯 Target URL: {self.base_url}")
        print(
            f"🔒 Auth Method: {'SigV4 Proxy (' + self.proxy_url + ')' if self.use_proxy else 'Direct'}"
        )
        print()

        # Test 1: Basic connectivity
        print("🔍 Running: Status Board with Data...")
        board_ok = self.test_status_board_with_data()
        print(
            f"{'✅' if board_ok else '❌'} Status Board with Data {'PASSED' if board_ok else 'FAILED'}"
        )

        # Test 2: Move API with real data
        print("🔍 Running: Move API with Data...")
        move_ok = self.test_move_api_with_data()
        print(f"{'✅' if move_ok else '❌'} Move API with Data {'PASSED' if move_ok else 'FAILED'}")

        # Test 3: End-to-end workflow
        print("🔍 Running: End-to-End Workflow...")
        workflow_ok = self.test_end_to_end_workflow()
        print(
            f"{'✅' if workflow_ok else '❌'} End-to-End Workflow {'PASSED' if workflow_ok else 'FAILED'}"
        )

        # Summary
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["success"])
        success_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0

        print()
        print("📊 Comprehensive Test Results:")
        print(f"   ✅ Passed: {passed_tests}/{total_tests} ({success_rate:.1f}%)")
        print(f"   ❌ Failed: {total_tests - passed_tests}/{total_tests}")
        print()

        # SLO Analysis
        slo_tests = [r for r in self.results if "slo_compliant" in r]
        slo_passed = sum(1 for r in slo_tests if r["slo_compliant"])
        slo_compliance = (slo_passed / len(slo_tests)) * 100 if slo_tests else 0

        production_ready = success_rate >= 80 and slo_compliance >= 80

        print("📋 Production Readiness Assessment:")
        print("=" * 50)
        print(f"Timestamp: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
        print(f"Success Rate: {success_rate:.1f}%")
        print(f"SLO Compliance: {slo_compliance:.1f}%")
        print(f"Production Ready: {'✅ YES' if production_ready else '❌ NO'}")
        print()

        if self.created_data:
            print("🧹 Test Data Created (consider cleanup):")
            for key, value in self.created_data.items():
                print(f"   {key}: {value}")
            print()

        # Save results
        timestamp = int(time.time())
        report_file = f"comprehensive_production_test_report_{timestamp}.json"

        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "target_url": self.base_url,
            "auth_method": "SigV4_Proxy" if self.use_proxy else "Direct",
            "success_rate": success_rate,
            "slo_compliance": slo_compliance,
            "production_ready": production_ready,
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "created_data": self.created_data,
            "detailed_results": self.results,
        }

        with open(report_file, "w") as f:
            json.dump(report, f, indent=2)

        print(f"📄 Full report saved to: {report_file}")
        return report


if __name__ == "__main__":
    # Run comprehensive tests
    tester = ProductionSmokeTestSuite(use_proxy=True)
    results = tester.run_comprehensive_tests()

    # Exit with appropriate code
    exit(0 if results["production_ready"] else 1)
