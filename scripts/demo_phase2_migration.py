#!/usr/bin/env python3
"""
Phase 2 Service History Migration - Demo Version
===============================================

This script demonstrates the warranty calculation and service categorization logic
that would be applied to existing appointment records in the full migration.

Usage: python demo_phase2_migration.py
"""

import json
from datetime import datetime, timedelta, timezone
from typing import Dict, List

# Warranty standards by service type (years/miles)
WARRANTY_STANDARDS = {
    "Parts": {"years": 2, "miles": 24000, "default": True},
    "Labor": {"years": 1, "miles": 12000, "default": True}, 
    "Diagnostic": {"years": 0, "miles": 0, "default": False},
    "Service": {"years": 1, "miles": 12000, "default": True},
    
    # Specific service overrides
    "Transmission": {"years": 3, "miles": 50000, "default": True},
    "Engine": {"years": 2, "miles": 36000, "default": True},
    "Brake": {"years": 1, "miles": 20000, "default": True},
    "Oil Change": {"years": 0, "miles": 3000, "default": False},
}

def categorize_service(service_name: str, notes: str = "") -> str:
    """Categorize service type based on name and notes."""
    service_name = service_name.lower()
    notes = notes.lower()
    
    # Diagnostic services
    if any(keyword in service_name for keyword in ["diagnostic", "diagnosis", "scan", "inspection"]):
        return "Diagnostic"
    
    # Labor services 
    if any(keyword in service_name for keyword in ["labor", "installation", "repair", "service"]):
        return "Labor"
    
    # Parts services
    if any(keyword in service_name for keyword in [
        "replacement", "part", "solenoid", "filter", "fluid", "oil", "brake",
        "transmission", "engine", "battery", "tire", "belt"
    ]):
        return "Parts"
    
    return "Service"  # Default fallback

def calculate_warranty(service_type: str, service_name: str, service_date: datetime) -> Dict:
    """Calculate warranty information for a service."""
    # Get warranty standards
    warranty_config = WARRANTY_STANDARDS.get(service_type, WARRANTY_STANDARDS["Service"])
    
    # Check for specific service overrides
    service_name_clean = service_name.lower()
    for service_key, config in WARRANTY_STANDARDS.items():
        if service_key.lower() in service_name_clean:
            warranty_config = config
            break
    
    if not warranty_config["default"]:
        return {
            "status": "N/A",
            "info": "No warranty coverage",
            "expires_at": None
        }
    
    # Calculate expiry date
    warranty_years = warranty_config["years"]
    warranty_miles = warranty_config["miles"]
    
    expiry_date = service_date + timedelta(days=warranty_years * 365)
    now = datetime.now(timezone.utc)
    
    # Determine status and info
    if expiry_date > now:
        days_remaining = (expiry_date - now).days
        return {
            "status": "Active",
            "info": f"{days_remaining} days remaining ({warranty_years} year(s) / {warranty_miles:,} miles)",
            "expires_at": expiry_date.isoformat()
        }
    else:
        days_expired = (now - expiry_date).days
        return {
            "status": "Expired", 
            "info": f"Expired {days_expired} days ago ({warranty_years} year(s) / {warranty_miles:,} miles)",
            "expires_at": expiry_date.isoformat()
        }

def demo_migration():
    """Demonstrate migration logic with sample data."""
    print("Phase 2 Service History Migration - Demo")
    print("=" * 50)
    
    # Sample appointments with services
    sample_appointments = [
        {
            "id": 1,
            "date": datetime.now(timezone.utc) - timedelta(days=30),
            "customer": "John Smith - 2019 Honda Civic",
            "services": [
                {"name": "Transmission Solenoid Replacement", "notes": "Replaced faulty shift solenoid"},
                {"name": "Transmission Fluid Service", "notes": "Changed transmission fluid"},
                {"name": "Diagnostic Scan", "notes": "Pre-service diagnostic check"}
            ]
        },
        {
            "id": 2, 
            "date": datetime.now(timezone.utc) - timedelta(days=400),
            "customer": "Sarah Johnson - 2020 Toyota Camry",
            "services": [
                {"name": "Brake Pad Replacement", "notes": "Front brake pads replaced"},
                {"name": "Engine Oil Change", "notes": "Standard oil change service"},
                {"name": "Multi-point Inspection", "notes": "Routine safety inspection"}
            ]
        },
        {
            "id": 3,
            "date": datetime.now(timezone.utc) - timedelta(days=800),
            "customer": "Mike Davis - 2018 Ford F-150", 
            "services": [
                {"name": "Engine Timing Belt Replacement", "notes": "Replaced timing belt and tensioner"},
                {"name": "Coolant System Service", "notes": "Flushed and refilled coolant"},
                {"name": "Labor - Installation", "notes": "Labor for timing belt installation"}
            ]
        }
    ]
    
    stats = {
        "appointments_processed": 0,
        "services_enhanced": 0,
        "warranties_active": 0,
        "warranties_expired": 0,
        "categories": {"Parts": 0, "Labor": 0, "Service": 0, "Diagnostic": 0}
    }
    
    for appointment in sample_appointments:
        print(f"\n📅 Appointment {appointment['id']} - {appointment['customer']}")
        print(f"   Date: {appointment['date'].strftime('%Y-%m-%d')}")
        
        enhanced_services = []
        for service in appointment["services"]:
            # Categorize service
            service_type = categorize_service(service["name"], service["notes"])
            
            # Calculate warranty
            warranty_info = calculate_warranty(service_type, service["name"], appointment["date"])
            
            enhanced_service = {
                **service,
                "service_type": service_type,
                "warranty": warranty_info
            }
            enhanced_services.append(enhanced_service)
            
            # Update stats
            stats["services_enhanced"] += 1
            stats["categories"][service_type] += 1
            
            if warranty_info["status"] == "Active":
                stats["warranties_active"] += 1
            elif warranty_info["status"] == "Expired":
                stats["warranties_expired"] += 1
            
            # Display service enhancement
            print(f"   🔧 {service['name']}")
            print(f"      Type: {service_type}")
            print(f"      Warranty: {warranty_info['status']} - {warranty_info['info']}")
        
        stats["appointments_processed"] += 1
        appointment["enhanced_services"] = enhanced_services
    
    # Display final statistics
    print(f"\n📊 Migration Statistics:")
    print(f"   Appointments Processed: {stats['appointments_processed']}")
    print(f"   Services Enhanced: {stats['services_enhanced']}")
    print(f"   Active Warranties: {stats['warranties_active']}")
    print(f"   Expired Warranties: {stats['warranties_expired']}")
    print(f"   Service Categories:")
    for category, count in stats["categories"].items():
        print(f"     - {category}: {count}")
    
    # Show enhanced data structure for Service Advisor UI
    print(f"\n🎯 Service Advisor UI Data (Appointment 1):")
    sample_enhanced = sample_appointments[0]["enhanced_services"]
    
    service_summary = {
        "parts": sum(1 for s in sample_enhanced if s["service_type"] == "Parts"),
        "labor": sum(1 for s in sample_enhanced if s["service_type"] == "Labor"), 
        "diagnostic": sum(1 for s in sample_enhanced if s["service_type"] == "Diagnostic"),
        "total_services": len(sample_enhanced)
    }
    
    major_services = [s["name"] for s in sample_enhanced if s["service_type"] in ["Parts", "Service"]]
    has_active_warranty = any(s["warranty"]["status"] == "Active" for s in sample_enhanced)
    
    ui_data = {
        "service_summary": service_summary,
        "has_warranty_active": has_active_warranty,
        "major_services": major_services,
        "enhanced_services": sample_enhanced
    }
    
    print(json.dumps(ui_data, indent=2, default=str))
    
    print(f"\n✅ Migration Demo Complete!")
    print(f"📋 This data structure matches what the enhanced AppointmentHistoryCard expects")
    print(f"🚀 Service Advisor can now quickly identify warranty coverage and service types")

if __name__ == "__main__":
    demo_migration()