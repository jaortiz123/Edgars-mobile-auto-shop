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
        customers_data = [
            ("Sarah Johnson", "sarah.johnson@email.com"),
            ("Michael Chen", "michael.chen@gmail.com"),
            ("Jennifer Garcia", "j.garcia@yahoo.com"),
            ("David Williams", "david.w@outlook.com"),
            ("Lisa Rodriguez", "lisa.rodriguez@email.com"),
            ("James Thompson", "james.thompson@gmail.com"),
            ("Maria Martinez", "maria.martinez@yahoo.com"),
            ("Robert Brown", "r.brown@email.com"),
            ("Amanda Davis", "amanda.davis@gmail.com"),
            ("Christopher Wilson", "c.wilson@outlook.com"),
            ("Emily Anderson", "emily.anderson@email.com"),
            ("Daniel Taylor", "daniel.taylor@gmail.com"),
            ("Jessica White", "jessica.white@yahoo.com"),
            ("Ryan Moore", "ryan.moore@email.com"),
            ("Ashley Jackson", "ashley.jackson@gmail.com"),
            ("Kevin Lee", "kevin.lee@outlook.com"),
            ("Michelle Clark", "michelle.clark@email.com"),
            ("Brandon Hall", "brandon.hall@gmail.com"),
        ]

        customers = []
        for i, (name, email) in enumerate(customers_data, 1):
            customers.append(
                {
                    "id": f"cust-{i:03d}",
                    "name": name,
                    "email": email,
                    "phone": f"555-{random.randint(100, 999)}-{random.randint(1000, 9999)}",
                    "address": f"{random.randint(100, 9999)} {random.choice(['Main', 'Oak', 'Pine', 'Cedar', 'Elm'])} {random.choice(['St', 'Ave', 'Blvd', 'Dr'])}",
                    "city": random.choice(
                        ["Riverside", "Corona", "Moreno Valley", "Beaumont", "Hemet"]
                    ),
                    "state": "CA",
                    "zip_code": f"9{random.randint(2000, 2999)}",
                    "created_at": (
                        datetime.now() - timedelta(days=random.randint(30, 730))
                    ).isoformat(),
                }
            )

        return customers

    def _generate_vehicles(self) -> List[Dict]:
        """Generate realistic vehicle data"""
        makes_models = [
            ("Toyota", ["Camry", "Corolla", "RAV4", "Prius", "Highlander"]),
            ("Honda", ["Civic", "Accord", "CR-V", "Pilot", "HR-V"]),
            ("Ford", ["F-150", "Explorer", "Escape", "Focus", "Mustang"]),
            ("Chevrolet", ["Silverado", "Equinox", "Malibu", "Tahoe", "Cruze"]),
            ("Nissan", ["Altima", "Rogue", "Sentra", "Pathfinder", "Murano"]),
            ("BMW", ["X5", "3 Series", "X3", "5 Series", "X1"]),
            ("Mercedes", ["C-Class", "E-Class", "GLE", "CLA", "GLC"]),
            ("Audi", ["A4", "Q5", "A6", "Q7", "A3"]),
            ("Volkswagen", ["Jetta", "Passat", "Tiguan", "Golf", "Atlas"]),
            ("Subaru", ["Outback", "Forester", "Impreza", "Crosstrek", "Legacy"]),
        ]

        colors = [
            "Black",
            "White",
            "Silver",
            "Gray",
            "Blue",
            "Red",
            "Green",
            "Brown",
            "Gold",
            "Beige",
        ]

        vehicles = []
        for i, customer in enumerate(self.customers):
            # Some customers have multiple vehicles
            num_vehicles = random.choices([1, 2], weights=[0.7, 0.3])[0]

            for v in range(num_vehicles):
                make, models = random.choice(makes_models)
                model = random.choice(models)
                year = random.randint(2010, 2024)

                vehicle_id = f"veh-{len(vehicles)+1:03d}"

                vehicles.append(
                    {
                        "id": vehicle_id,
                        "customer_id": customer["id"],
                        "year": year,
                        "make": make,
                        "model": model,
                        "vin": f"1{''.join(random.choices('ABCDEFGHIJKLMNPRSTUVWXYZ0123456789', k=16))}",
                        "license_plate": f"{''.join(random.choices('ABCDEFGHIJKLMNPQRSTUVWXYZ', k=3))}{random.randint(100, 999)}",
                        "color": random.choice(colors),
                        "mileage": random.randint(5000, 200000),
                        "engine_size": random.choice(
                            ["1.6L", "2.0L", "2.4L", "3.0L", "3.5L", "5.7L"]
                        ),
                        "fuel_type": random.choice(["Gasoline", "Hybrid", "Electric", "Diesel"]),
                    }
                )

        return vehicles

    def _generate_services(self) -> List[Dict]:
        """Generate comprehensive service catalog"""
        services = [
            # Maintenance Services
            {
                "name": "Oil Change",
                "category": "Maintenance",
                "subcategory": "Fluids",
                "hours": 0.5,
                "price": 49.99,
                "parts_cost": 25.00,
            },
            {
                "name": "Tire Rotation",
                "category": "Maintenance",
                "subcategory": "Tires",
                "hours": 0.5,
                "price": 39.99,
                "parts_cost": 0.00,
            },
            {
                "name": "Air Filter Replacement",
                "category": "Maintenance",
                "subcategory": "Filters",
                "hours": 0.25,
                "price": 29.99,
                "parts_cost": 15.00,
            },
            {
                "name": "Cabin Air Filter",
                "category": "Maintenance",
                "subcategory": "Filters",
                "hours": 0.25,
                "price": 34.99,
                "parts_cost": 20.00,
            },
            {
                "name": "Transmission Service",
                "category": "Maintenance",
                "subcategory": "Fluids",
                "hours": 2.0,
                "price": 199.99,
                "parts_cost": 75.00,
            },
            {
                "name": "Coolant Flush",
                "category": "Maintenance",
                "subcategory": "Fluids",
                "hours": 1.0,
                "price": 129.99,
                "parts_cost": 45.00,
            },
            {
                "name": "Brake Fluid Change",
                "category": "Maintenance",
                "subcategory": "Fluids",
                "hours": 0.5,
                "price": 89.99,
                "parts_cost": 25.00,
            },
            # Safety & Inspection
            {
                "name": "Brake Inspection",
                "category": "Safety",
                "subcategory": "Brakes",
                "hours": 1.0,
                "price": 89.99,
                "parts_cost": 0.00,
            },
            {
                "name": "Brake Pad Replacement",
                "category": "Safety",
                "subcategory": "Brakes",
                "hours": 2.0,
                "price": 299.99,
                "parts_cost": 150.00,
            },
            {
                "name": "Brake Rotor Replacement",
                "category": "Safety",
                "subcategory": "Brakes",
                "hours": 2.5,
                "price": 449.99,
                "parts_cost": 250.00,
            },
            {
                "name": "Tire Replacement",
                "category": "Safety",
                "subcategory": "Tires",
                "hours": 1.0,
                "price": 599.99,
                "parts_cost": 400.00,
            },
            {
                "name": "Wheel Alignment",
                "category": "Safety",
                "subcategory": "Alignment",
                "hours": 1.0,
                "price": 99.99,
                "parts_cost": 0.00,
            },
            {
                "name": "Tire Balancing",
                "category": "Safety",
                "subcategory": "Tires",
                "hours": 0.5,
                "price": 79.99,
                "parts_cost": 0.00,
            },
            # Diagnostic Services
            {
                "name": "Engine Diagnostic",
                "category": "Diagnostic",
                "subcategory": "Engine",
                "hours": 1.5,
                "price": 129.99,
                "parts_cost": 0.00,
            },
            {
                "name": "Check Engine Light",
                "category": "Diagnostic",
                "subcategory": "Engine",
                "hours": 1.0,
                "price": 99.99,
                "parts_cost": 0.00,
            },
            {
                "name": "Electrical Diagnostic",
                "category": "Diagnostic",
                "subcategory": "Electrical",
                "hours": 2.0,
                "price": 159.99,
                "parts_cost": 0.00,
            },
            {
                "name": "A/C Diagnostic",
                "category": "Diagnostic",
                "subcategory": "Climate",
                "hours": 1.0,
                "price": 109.99,
                "parts_cost": 0.00,
            },
            # Repair Services
            {
                "name": "A/C Repair",
                "category": "Repair",
                "subcategory": "Climate",
                "hours": 3.0,
                "price": 399.99,
                "parts_cost": 200.00,
            },
            {
                "name": "Battery Replacement",
                "category": "Repair",
                "subcategory": "Electrical",
                "hours": 0.5,
                "price": 179.99,
                "parts_cost": 120.00,
            },
            {
                "name": "Alternator Replacement",
                "category": "Repair",
                "subcategory": "Electrical",
                "hours": 2.5,
                "price": 499.99,
                "parts_cost": 300.00,
            },
            {
                "name": "Starter Replacement",
                "category": "Repair",
                "subcategory": "Electrical",
                "hours": 2.0,
                "price": 449.99,
                "parts_cost": 250.00,
            },
            {
                "name": "Radiator Replacement",
                "category": "Repair",
                "subcategory": "Cooling",
                "hours": 3.5,
                "price": 649.99,
                "parts_cost": 350.00,
            },
            {
                "name": "Water Pump Replacement",
                "category": "Repair",
                "subcategory": "Cooling",
                "hours": 4.0,
                "price": 699.99,
                "parts_cost": 300.00,
            },
            {
                "name": "Timing Belt Replacement",
                "category": "Repair",
                "subcategory": "Engine",
                "hours": 6.0,
                "price": 899.99,
                "parts_cost": 400.00,
            },
            # Specialty Services
            {
                "name": "Pre-Purchase Inspection",
                "category": "Inspection",
                "subcategory": "Comprehensive",
                "hours": 2.0,
                "price": 199.99,
                "parts_cost": 0.00,
            },
            {
                "name": "Smog Check",
                "category": "Inspection",
                "subcategory": "Emissions",
                "hours": 0.5,
                "price": 49.99,
                "parts_cost": 0.00,
            },
            {
                "name": "Multi-Point Inspection",
                "category": "Inspection",
                "subcategory": "General",
                "hours": 1.0,
                "price": 79.99,
                "parts_cost": 0.00,
            },
        ]

        for i, service in enumerate(services, 1):
            service.update(
                {
                    "id": f"svc-{i:03d}",
                    "internal_code": f"SVC{i:04d}",
                    "skill_level": random.choice(["Basic", "Intermediate", "Advanced"]),
                    "warranty_months": random.choice([3, 6, 12, 24]),
                    "description": f"Professional {service['name'].lower()} service for optimal vehicle performance",
                }
            )

        return services

    def generate_appointments(self, count: int = 25) -> List[Dict]:
        """Generate realistic appointment data across all statuses"""
        appointments = []
        base_date = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)

        # Generate appointments across a 2-week window
        for i in range(count):
            # Select random customer and their vehicle
            customer = random.choice(self.customers)
            customer_vehicles = [v for v in self.vehicles if v["customer_id"] == customer["id"]]
            vehicle = random.choice(customer_vehicles)

            # Select 1-3 services per appointment
            selected_services = random.sample(self.services, random.randint(1, 3))

            # Distribute appointments across realistic time slots
            days_offset = random.randint(-7, 14)  # Past week + next two weeks

            # Business hours: 8 AM to 5 PM, with lunch break consideration
            hour_options = [8, 9, 10, 11, 13, 14, 15, 16]  # Skip 12 PM lunch
            appointment_hour = random.choice(hour_options)
            appointment_minute = random.choice([0, 30])  # 30-minute slots

            appointment_time = base_date + timedelta(
                days=days_offset, hours=appointment_hour - 8, minutes=appointment_minute
            )

            # Determine status based on appointment timing
            now = datetime.now()
            if appointment_time > now + timedelta(hours=1):
                # Future appointments are typically SCHEDULED
                status = "SCHEDULED"
            elif appointment_time < now - timedelta(hours=2):
                # Past appointments are usually COMPLETED or NO_SHOW
                status = random.choices(["COMPLETED", "NO_SHOW"], weights=[9, 1])[0]
            else:
                # Current timeframe appointments can be IN_PROGRESS or READY
                status = random.choices(["IN_PROGRESS", "READY", "SCHEDULED"], weights=[2, 1, 1])[0]

            # Calculate pricing
            total_amount = sum(s["price"] for s in selected_services)
            total_hours = sum(s["hours"] for s in selected_services)

            # Payment status based on appointment status
            if status == "COMPLETED":
                paid_amount = total_amount
            elif status in ["IN_PROGRESS", "READY"]:
                # Some partial payments
                paid_amount = random.choice([0, total_amount * 0.5, total_amount])
            else:
                paid_amount = 0

            # Generate realistic notes
            service_names = [s["name"] for s in selected_services]
            notes_options = [
                f"Customer requested {', '.join(service_names[:2])}",
                f"Vehicle showing symptoms related to {service_names[0].lower()}",
                f"Regular maintenance visit for {vehicle['year']} {vehicle['make']} {vehicle['model']}",
                f"Follow-up service for previous {random.choice(service_names)}",
                f"Customer reported issues with {random.choice(['braking', 'engine noise', 'air conditioning', 'electrical system'])}",
                "Routine service appointment",
                f"Multi-point inspection requested along with {service_names[0].lower()}",
            ]

            # Additional appointment attributes
            tech_assignments = ["Tech-001", "Tech-002", "Tech-003", "Tech-004", None]

            appointment = {
                "id": f"apt-{i+1:03d}",
                "customer_id": customer["id"],
                "vehicle_id": vehicle["id"],
                "status": status,
                "scheduled_date": appointment_time.date().isoformat(),
                "scheduled_time": appointment_time.time().strftime("%H:%M"),
                "start": appointment_time.isoformat(),
                "estimated_duration_hours": round(total_hours, 1),
                "total_amount": round(total_amount, 2),
                "paid_amount": round(paid_amount, 2),
                "remaining_balance": round(total_amount - paid_amount, 2),
                "services": selected_services,
                "tech_id": (
                    random.choice(tech_assignments)
                    if status in ["IN_PROGRESS", "READY", "COMPLETED"]
                    else None
                ),
                "priority": random.choice(["LOW", "NORMAL", "HIGH"]),
                "notes": random.choice(notes_options),
                "customer_phone": customer["phone"],
                "vehicle_info": f"{vehicle['year']} {vehicle['make']} {vehicle['model']} ({vehicle['color']})",
                "license_plate": vehicle["license_plate"],
                "mileage": vehicle["mileage"] + random.randint(0, 1000),  # Slight mileage increase
                "check_in_at": (
                    appointment_time.isoformat()
                    if status in ["IN_PROGRESS", "READY", "COMPLETED"]
                    else None
                ),
                "check_out_at": (
                    (appointment_time + timedelta(hours=total_hours)).isoformat()
                    if status == "COMPLETED"
                    else None
                ),
                "created_at": (
                    appointment_time - timedelta(days=random.randint(1, 30))
                ).isoformat(),
                "updated_at": datetime.now().isoformat(),
            }

            appointments.append(appointment)

        # Sort appointments by scheduled time
        appointments.sort(key=lambda x: x["start"])

        return appointments

    def generate_complete_dataset(self) -> Dict:
        """Generate complete UAT dataset with comprehensive test scenarios"""
        appointments = self.generate_appointments(25)

        # Generate summary statistics
        status_distribution = {}
        for status in ["SCHEDULED", "IN_PROGRESS", "READY", "COMPLETED", "NO_SHOW"]:
            status_distribution[status] = len([a for a in appointments if a["status"] == status])

        # Calculate financial metrics
        total_revenue = sum(a["paid_amount"] for a in appointments)
        pending_revenue = sum(a["remaining_balance"] for a in appointments)

        return {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "description": "Comprehensive UAT dataset for Edgar's Mobile Auto Shop Sprint 3 launch validation",
                "version": "1.0",
                "generator": "UATDataGenerator",
                "purpose": "Production launch readiness testing",
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
                "status_distribution": status_distribution,
                "financial_metrics": {
                    "total_revenue": round(total_revenue, 2),
                    "pending_revenue": round(pending_revenue, 2),
                    "average_appointment_value": (
                        round(sum(a["total_amount"] for a in appointments) / len(appointments), 2)
                        if appointments
                        else 0
                    ),
                },
            },
            "test_scenarios": {
                "happy_path": "Standard appointment workflow from scheduling to completion",
                "edge_cases": "No-show appointments, partial payments, multiple services",
                "performance": "Load testing with 25 appointments across 5 status columns",
                "ui_validation": "Status board drag-and-drop, drawer navigation, KPI updates",
            },
        }


if __name__ == "__main__":
    print("🏭 Generating UAT Dataset for Edgar's Mobile Auto Shop")
    print("=" * 60)

    generator = UATDataGenerator()
    dataset = generator.generate_complete_dataset()

    # Save to JSON file with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"uat_dataset_{timestamp}.json"

    with open(filename, "w") as f:
        json.dump(dataset, f, indent=2)

    # Display summary
    print("✅ UAT Dataset Generated Successfully!")
    print()
    print("📊 Dataset Summary:")
    print(f"   👥 Customers: {dataset['summary']['total_customers']}")
    print(f"   🚗 Vehicles: {dataset['summary']['total_vehicles']}")
    print(f"   🔧 Services: {dataset['summary']['total_services']}")
    print(f"   📅 Appointments: {dataset['summary']['total_appointments']}")
    print()
    print("📈 Appointment Status Distribution:")
    for status, count in dataset["summary"]["status_distribution"].items():
        percentage = (count / dataset["summary"]["total_appointments"]) * 100
        print(f"   {status}: {count} ({percentage:.1f}%)")

    print()
    print("💰 Financial Metrics:")
    metrics = dataset["summary"]["financial_metrics"]
    print(f"   Total Revenue: ${metrics['total_revenue']:,.2f}")
    print(f"   Pending Revenue: ${metrics['pending_revenue']:,.2f}")
    print(f"   Avg Appointment Value: ${metrics['average_appointment_value']:,.2f}")

    print()
    print("🎯 Test Scenarios Included:")
    for scenario, description in dataset["test_scenarios"].items():
        print(f"   {scenario.replace('_', ' ').title()}: {description}")

    print()
    print(f"📄 Dataset saved to: {filename}")
    print("🚀 Ready for UAT and production testing!")
