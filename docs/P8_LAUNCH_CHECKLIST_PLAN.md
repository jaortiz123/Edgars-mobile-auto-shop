# P8 Launch Checklist - Production Readiness Validation

## 🚀 Launch Checklist Execution Plan

**Phase:** Sprint 3 P8 - Final Launch Readiness
**Objective:** Comprehensive production validation with smoke tests, UAT dataset, and release procedures

## 📋 Core Deliverables

### 1. Smoke Test Suite
- **API Health Checks:** All critical endpoints responding
- **Authentication Flow:** IAM + SigV4 validation
- **Database Connectivity:** PostgreSQL + Lambda integration
- **Status Board Operations:** Move API + optimistic UI validation
- **SLO Compliance:** Response time validation (<400ms Board, <500ms Stats)

### 2. UAT (User Acceptance Testing) Dataset
- **Sample Appointments:** Representative data across all status columns
- **Customer Profiles:** Realistic customer + vehicle combinations
- **Service Operations:** Complete service catalog with pricing
- **Test Scenarios:** Happy path + error condition coverage

### 3. Production Release Procedures
- **Deployment Runbook:** Step-by-step production deployment
- **Rollback Procedures:** Emergency rollback with RTO targets
- **Monitoring Validation:** SLO dashboard + alerting verification
- **Security Checklist:** Final security posture validation

### 4. Final Documentation Package
- **API Documentation:** Complete endpoint specification
- **Admin User Guide:** Status Board operations manual
- **Troubleshooting Guide:** Common issues + resolution steps
- **Performance Baselines:** SLO targets + monitoring setup

---

## 🔧 Smoke Test Implementation

### Backend Health Check (`smoke-tests/backend-health.py`)
```python
import requests
import time
import sys
from typing import Dict, List

class SmokeTestSuite:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.results: List[Dict] = []

    def test_health_endpoint(self) -> bool:
        """Test basic health endpoint"""
        try:
            start = time.time()
            response = requests.get(f"{self.base_url}/health", timeout=10)
            duration = (time.time() - start) * 1000

            success = response.status_code == 200
            self.results.append({
                'test': 'health_endpoint',
                'success': success,
                'duration_ms': duration,
                'status_code': response.status_code
            })
            return success
        except Exception as e:
            self.results.append({
                'test': 'health_endpoint',
                'success': False,
                'error': str(e)
            })
            return False

    def test_status_board_endpoint(self) -> bool:
        """Test status board API with SLO validation"""
        try:
            start = time.time()
            response = requests.get(f"{self.base_url}/api/admin/appointments/board", timeout=15)
            duration = (time.time() - start) * 1000

            success = (
                response.status_code == 200 and
                duration < 800  # SLO: <800ms p95
            )

            self.results.append({
                'test': 'status_board_endpoint',
                'success': success,
                'duration_ms': duration,
                'status_code': response.status_code,
                'slo_compliant': duration < 800
            })
            return success
        except Exception as e:
            self.results.append({
                'test': 'status_board_endpoint',
                'success': False,
                'error': str(e)
            })
            return False

    def test_dashboard_stats(self) -> bool:
        """Test dashboard stats with SLO validation"""
        try:
            start = time.time()
            response = requests.get(f"{self.base_url}/api/admin/dashboard/stats", timeout=10)
            duration = (time.time() - start) * 1000

            success = (
                response.status_code == 200 and
                duration < 500  # SLO: <500ms p95
            )

            self.results.append({
                'test': 'dashboard_stats',
                'success': success,
                'duration_ms': duration,
                'status_code': response.status_code,
                'slo_compliant': duration < 500
            })
            return success
        except Exception as e:
            self.results.append({
                'test': 'dashboard_stats',
                'success': False,
                'error': str(e)
            })
            return False

    def run_all_tests(self) -> bool:
        """Run complete smoke test suite"""
        print("🧪 Starting Smoke Test Suite...")

        tests = [
            self.test_health_endpoint,
            self.test_status_board_endpoint,
            self.test_dashboard_stats
        ]

        passed = 0
        for test in tests:
            if test():
                passed += 1
                print(f"✅ {test.__name__} PASSED")
            else:
                print(f"❌ {test.__name__} FAILED")

        success_rate = passed / len(tests)
        print(f"\n📊 Results: {passed}/{len(tests)} tests passed ({success_rate:.1%})")

        return success_rate == 1.0

if __name__ == "__main__":
    # Production URL from Sprint 2
    prod_url = "https://onourabnw45tm2rrq72gegkgai0codqj.lambda-url.us-west-2.on.aws"

    suite = SmokeTestSuite(prod_url)
    success = suite.run_all_tests()

    print("\n📋 Detailed Results:")
    for result in suite.results:
        print(f"  {result}")

    sys.exit(0 if success else 1)
```

### Frontend UI Smoke Test (`smoke-tests/frontend-ui.js`)
```javascript
// Playwright-based UI smoke tests
import { test, expect } from '@playwright/test';

test.describe('Frontend UI Smoke Tests', () => {

  test('Dashboard loads and displays key components', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Wait for initial load
    await page.waitForSelector('[data-testid="dashboard-container"]', { timeout: 10000 });

    // Verify Status Board is present
    await expect(page.locator('[data-testid="status-board"]')).toBeVisible();

    // Verify Dashboard Stats
    await expect(page.locator('[data-testid="dashboard-stats"]')).toBeVisible();

    // Check for KPI widgets
    await expect(page.locator('[data-testid="jobs-today"]')).toBeVisible();
    await expect(page.locator('[data-testid="cars-on-premises"]')).toBeVisible();
  });

  test('Status Board columns are functional', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('[data-testid="status-board"]');

    // Verify all expected columns exist
    const expectedColumns = ['SCHEDULED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'NO_SHOW'];

    for (const status of expectedColumns) {
      await expect(page.locator(`[data-testid="column-${status}"]`)).toBeVisible();
    }
  });

  test('Calendar view toggle works', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Switch to Calendar view
    await page.click('[data-testid="view-toggle-calendar"]');
    await expect(page.locator('[data-testid="appointment-calendar"]')).toBeVisible();

    // Switch back to Board view
    await page.click('[data-testid="view-toggle-board"]');
    await expect(page.locator('[data-testid="status-board"]')).toBeVisible();
  });

});
```

---

## 🗂️ UAT Dataset Generation

### Sample Data Script (`uat-dataset/generate_uat_data.py`)
```python
import json
import random
from datetime import datetime, timedelta
from typing import Dict, List

class UATDataGenerator:
    def __init__(self):
        self.customers = self._generate_customers()
        self.vehicles = self._generate_vehicles()
        self.services = self._generate_services()
        self.appointments = []

    def _generate_customers(self) -> List[Dict]:
        """Generate realistic customer data"""
        names = [
            "Sarah Johnson", "Michael Chen", "Jennifer Garcia", "David Williams",
            "Lisa Rodriguez", "James Thompson", "Maria Martinez", "Robert Brown",
            "Amanda Davis", "Christopher Wilson", "Emily Anderson", "Daniel Taylor"
        ]

        customers = []
        for i, name in enumerate(names, 1):
            first, last = name.split()
            customers.append({
                "id": f"cust-{i:03d}",
                "name": name,
                "email": f"{first.lower()}.{last.lower()}@email.com",
                "phone": f"555-{random.randint(100, 999)}-{random.randint(1000, 9999)}",
                "created_at": (datetime.now() - timedelta(days=random.randint(30, 365))).isoformat()
            })

        return customers

    def _generate_vehicles(self) -> List[Dict]:
        """Generate realistic vehicle data"""
        makes_models = [
            ("Toyota", "Camry"), ("Honda", "Civic"), ("Ford", "F-150"),
            ("Chevrolet", "Silverado"), ("Nissan", "Altima"), ("BMW", "X5"),
            ("Mercedes", "C-Class"), ("Audi", "A4"), ("Volkswagen", "Jetta"),
            ("Subaru", "Outback"), ("Mazda", "CX-5"), ("Hyundai", "Elantra")
        ]

        vehicles = []
        for i, (make, model) in enumerate(makes_models, 1):
            year = random.randint(2015, 2024)
            vehicles.append({
                "id": f"veh-{i:03d}",
                "customer_id": f"cust-{i:03d}",
                "year": year,
                "make": make,
                "model": model,
                "vin": f"1{''.join(random.choices('ABCDEFGHIJKLMNPRSTUVWXYZ0123456789', k=16))}",
                "license_plate": f"{''.join(random.choices('ABCDEFGHIJKLMNPQRSTUVWXYZ', k=3))}-{random.randint(100, 999)}",
                "color": random.choice(["Black", "White", "Silver", "Blue", "Red", "Gray"])
            })

        return vehicles

    def _generate_services(self) -> List[Dict]:
        """Generate service catalog"""
        services = [
            {"name": "Oil Change", "category": "Maintenance", "hours": 0.5, "price": 49.99},
            {"name": "Brake Inspection", "category": "Safety", "hours": 1.0, "price": 89.99},
            {"name": "Tire Rotation", "category": "Maintenance", "hours": 0.5, "price": 39.99},
            {"name": "Engine Diagnostic", "category": "Diagnostic", "hours": 1.5, "price": 129.99},
            {"name": "Transmission Service", "category": "Maintenance", "hours": 2.0, "price": 199.99},
            {"name": "A/C Repair", "category": "Repair", "hours": 3.0, "price": 299.99},
            {"name": "Battery Replacement", "category": "Electrical", "hours": 0.5, "price": 149.99},
            {"name": "Wheel Alignment", "category": "Maintenance", "hours": 1.0, "price": 99.99}
        ]

        for i, service in enumerate(services, 1):
            service["id"] = f"svc-{i:03d}"

        return services

    def generate_appointments(self, count: int = 20) -> List[Dict]:
        """Generate realistic appointment data across all statuses"""
        statuses = ["SCHEDULED", "IN_PROGRESS", "READY", "COMPLETED", "NO_SHOW"]
        status_weights = [5, 3, 2, 8, 1]  # Realistic distribution

        appointments = []
        base_date = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)

        for i in range(count):
            customer = random.choice(self.customers)
            vehicle = next(v for v in self.vehicles if v["customer_id"] == customer["id"])
            selected_services = random.sample(self.services, random.randint(1, 3))

            # Distribute appointments across time slots
            days_offset = random.randint(-3, 7)  # Past and future appointments
            hour_offset = random.randint(0, 8)   # 8am to 4pm slots
            appointment_time = base_date + timedelta(days=days_offset, hours=hour_offset)

            status = random.choices(statuses, weights=status_weights)[0]

            total_amount = sum(s["price"] for s in selected_services)
            paid_amount = total_amount if status == "COMPLETED" else 0

            appointment = {
                "id": f"apt-{i+1:03d}",
                "customer_id": customer["id"],
                "vehicle_id": vehicle["id"],
                "status": status,
                "scheduled_date": appointment_time.date().isoformat(),
                "scheduled_time": appointment_time.time().strftime("%H:%M"),
                "start": appointment_time.isoformat(),
                "total_amount": total_amount,
                "paid_amount": paid_amount,
                "services": selected_services,
                "notes": f"UAT test appointment for {customer['name']}",
                "created_at": (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat()
            }

            appointments.append(appointment)

        return appointments

    def generate_complete_dataset(self) -> Dict:
        """Generate complete UAT dataset"""
        appointments = self.generate_appointments(20)

        return {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "description": "UAT dataset for Sprint 3 launch validation",
                "version": "1.0"
            },
            "customers": self.customers,
            "vehicles": self.vehicles,
            "services": self.services,
            "appointments": appointments,
            "summary": {
                "total_customers": len(self.customers),
                "total_vehicles": len(self.vehicles),
                "total_services": len(self.services),
                "total_appointments": len(appointments),
                "status_distribution": {
                    status: len([a for a in appointments if a["status"] == status])
                    for status in ["SCHEDULED", "IN_PROGRESS", "READY", "COMPLETED", "NO_SHOW"]
                }
            }
        }

if __name__ == "__main__":
    generator = UATDataGenerator()
    dataset = generator.generate_complete_dataset()

    with open("uat_dataset.json", "w") as f:
        json.dump(dataset, f, indent=2)

    print("✅ UAT Dataset Generated:")
    print(f"   📊 {dataset['summary']['total_customers']} customers")
    print(f"   🚗 {dataset['summary']['total_vehicles']} vehicles")
    print(f"   🔧 {dataset['summary']['total_services']} services")
    print(f"   📅 {dataset['summary']['total_appointments']} appointments")
    print(f"   📈 Status Distribution: {dataset['summary']['status_distribution']}")
```

---

## 📚 Production Release Runbook

### Pre-Deployment Checklist
- [ ] **Environment Validation:** Staging tests passed with UAT dataset
- [ ] **Security Scan:** ECR vulnerability scan clean (<HIGH findings)
- [ ] **Performance Baseline:** SLO targets validated (Board <800ms, Stats <500ms)
- [ ] **Monitoring Setup:** CloudWatch dashboard active with alerting
- [ ] **Backup Verification:** Database backup completed <24h
- [ ] **Team Notification:** Stakeholders informed of deployment window

### Deployment Procedure
```bash
# 1. Final staging validation
cd /Users/jesusortiz/Edgars-mobile-auto-shop
python smoke-tests/backend-health.py https://staging-url

# 2. Trigger production deployment (via GitHub)
git checkout main
git merge staging
git push origin main

# 3. Monitor deployment progress
aws logs tail /aws/lambda/edgars-mobile-auto-shop --follow

# 4. Post-deployment validation
python smoke-tests/backend-health.py https://prod-url
```

### Rollback Procedure (Emergency)
```bash
# 1. Identify last known good ECR image
aws ecr describe-images --repository-name edgars-mobile-auto-shop --query 'imageDetails[?imageTag!=`latest`][0]'

# 2. Update Lambda to previous image
aws lambda update-function-code \
  --function-name edgars-mobile-auto-shop \
  --image-uri 533267385200.dkr.ecr.us-west-2.amazonaws.com/edgars-mobile-auto-shop:<previous-tag>

# 3. Validate rollback success
python smoke-tests/backend-health.py https://prod-url

# 4. Update team and incident tracking
echo "Production rollback completed at $(date)"
```

---

## 📊 Success Criteria

### ✅ Smoke Test Requirements
- [ ] **API Health Check:** 200 OK response <2s
- [ ] **Status Board API:** 200 OK response <800ms (SLO compliant)
- [ ] **Dashboard Stats:** 200 OK response <500ms (SLO compliant)
- [ ] **Authentication:** IAM + SigV4 validation successful
- [ ] **Frontend Load:** Dashboard visible <5s

### ✅ UAT Dataset Validation
- [ ] **Data Quality:** All appointments have valid customer + vehicle links
- [ ] **Status Distribution:** Realistic spread across all status columns
- [ ] **Service Catalog:** Complete with pricing and time estimates
- [ ] **Test Coverage:** Happy path + edge cases represented

### ✅ Production Readiness
- [ ] **Deployment Automation:** GitHub Actions pipeline functional
- [ ] **Monitoring Active:** CloudWatch dashboard + alerting configured
- [ ] **Security Posture:** ECR scanning + IAM authentication enabled
- [ ] **Rollback Tested:** Emergency rollback procedure validated
- [ ] **Documentation Complete:** All operational runbooks ready

### ✅ Performance Validation
- [ ] **SLO Compliance:** Board <800ms, Stats <500ms sustained under load
- [ ] **Error Rate:** <1% error rate during normal operations
- [ ] **Availability:** >99.9% uptime during business hours
- [ ] **Scalability:** Graceful degradation under 2x normal load

---

## 🚀 Execution Timeline

**Day 1:** Smoke Test Implementation + UAT Dataset Generation
**Day 2:** Production Release Runbook + Security Validation
**Day 3:** End-to-End Testing + Final Documentation
**Day 4:** Production Deployment + Post-Launch Monitoring

**Estimated Total Time:** 4-6 hours across 2-3 days

---

Ready to execute P8 Launch Checklist! 🎯
