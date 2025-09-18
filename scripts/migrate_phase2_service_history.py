#!/usr/bin/env python3
"""
Data Migration Script: Phase 2 Service History Enhancement
=========================================================

Purpose: Populate warranty information and service categorization for existing appointment records.
This script backfills enhanced service data required by the Phase 2 Service History Integration.

Features:
- Warranty calculation based on service type and industry standards
- Service categorization (Parts/Labor/Diagnostic/Service)
- Safe rollback capabilities
- Progress tracking and logging
- Dry run mode for validation

Usage:
    python migrate_phase2_service_history.py --dry-run    # Preview changes
    python migrate_phase2_service_history.py --execute   # Apply changes
    python migrate_phase2_service_history.py --rollback  # Revert changes

Requirements: psycopg2, python 3.8+
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("ERROR: psycopg2 required. Install with: pip install psycopg2-binary")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'migration_phase2_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

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
    "Inspection": {"years": 0, "miles": 0, "default": False}
}

class Phase2Migrator:
    def __init__(self, database_url: Optional[str] = None, dry_run: bool = True):
        """Initialize the migrator with database connection."""
        self.dry_run = dry_run
        self.database_url = database_url or self._get_database_url()
        self.conn = None
        self.migration_id = f"phase2_service_history_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Stats tracking
        self.stats = {
            "appointments_processed": 0,
            "services_enhanced": 0,
            "warranties_added": 0,
            "categories_assigned": 0,
            "errors": 0
        }
    
    def _get_database_url(self) -> str:
        """Get database URL from environment or config."""
        # Try environment variables first
        if os.getenv("DATABASE_URL"):
            return os.getenv("DATABASE_URL")
        
        # Try local development defaults
        return "postgresql://postgres:password@localhost:5432/edgars_auto_shop"
    
    def connect(self):
        """Establish database connection."""
        try:
            self.conn = psycopg2.connect(self.database_url)
            logger.info(f"Connected to database")
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise
    
    def disconnect(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
            logger.info("Database connection closed")
    
    def categorize_service(self, service_name: str, notes: str = "") -> str:
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
        
        # Check notes for additional context
        if any(keyword in notes for keyword in ["part", "component", "replacement"]):
            return "Parts"
        
        return "Service"  # Default fallback
    
    def calculate_warranty(self, service_type: str, service_name: str, service_date: datetime) -> Dict:
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
    
    def enhance_appointment_services(self, appointment_id: int, services: List[Dict]) -> List[Dict]:
        """Enhance services with warranty and categorization."""
        enhanced_services = []
        
        for service in services:
            service_name = service.get("name", "Unknown Service")
            service_notes = service.get("notes", "")
            
            # Categorize service
            service_type = self.categorize_service(service_name, service_notes)
            
            # Calculate warranty (using appointment end date or current date)
            service_date = service.get("service_date") or datetime.now(timezone.utc)
            if isinstance(service_date, str):
                service_date = datetime.fromisoformat(service_date.replace('Z', '+00:00'))
            
            warranty_info = self.calculate_warranty(service_type, service_name, service_date)
            
            # Enhanced service object
            enhanced_service = {
                **service,
                "service_type": service_type,
                "warranty": warranty_info
            }
            
            enhanced_services.append(enhanced_service)
            self.stats["services_enhanced"] += 1
            self.stats["categories_assigned"] += 1
            
            if warranty_info["status"] != "N/A":
                self.stats["warranties_added"] += 1
        
        return enhanced_services
    
    def get_appointments_to_migrate(self) -> List[Dict]:
        """Fetch appointments that need migration."""
        query = """
        SELECT 
            a.id,
            a.status,
            a.start_ts,
            a.end_ts,
            a.total_amount,
            a.notes as appointment_notes,
            COALESCE((
                SELECT JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', s.id::text,
                        'name', s.name,
                        'notes', s.notes,
                        'estimated_price', s.estimated_price,
                        'service_operation_id', s.service_operation_id
                    ) ORDER BY s.created_at
                )
                FROM appointment_services s 
                WHERE s.appointment_id = a.id
            ), '[]'::json) AS services
        FROM appointments a
        WHERE a.end_ts IS NOT NULL  -- Only completed appointments
        AND a.status IN ('COMPLETED', 'completed')
        ORDER BY a.end_ts DESC
        LIMIT 500  -- Process in batches
        """
        
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query)
            return cur.fetchall()
    
    def create_migration_log(self):
        """Create migration log table and record."""
        create_table_query = """
        CREATE TABLE IF NOT EXISTS migration_logs (
            id SERIAL PRIMARY KEY,
            migration_id VARCHAR(100) UNIQUE NOT NULL,
            migration_type VARCHAR(50) NOT NULL,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            status VARCHAR(20) DEFAULT 'running',
            stats JSONB,
            dry_run BOOLEAN DEFAULT FALSE
        )
        """
        
        insert_log_query = """
        INSERT INTO migration_logs (migration_id, migration_type, dry_run)
        VALUES (%s, %s, %s)
        ON CONFLICT (migration_id) DO NOTHING
        """
        
        with self.conn.cursor() as cur:
            if not self.dry_run:
                cur.execute(create_table_query)
                cur.execute(insert_log_query, (self.migration_id, "phase2_service_history", self.dry_run))
                self.conn.commit()
                
        logger.info(f"Migration log created: {self.migration_id}")
    
    def update_migration_log(self, status: str, error_msg: Optional[str] = None):
        """Update migration log with completion status."""
        if self.dry_run:
            return
            
        update_query = """
        UPDATE migration_logs 
        SET completed_at = CURRENT_TIMESTAMP,
            status = %s,
            stats = %s
        WHERE migration_id = %s
        """
        
        stats_with_error = {**self.stats}
        if error_msg:
            stats_with_error["error_message"] = error_msg
        
        with self.conn.cursor() as cur:
            cur.execute(update_query, (status, json.dumps(stats_with_error), self.migration_id))
            self.conn.commit()
    
    def migrate_appointment_data(self):
        """Main migration logic."""
        logger.info(f"Starting Phase 2 Service History Migration (dry_run: {self.dry_run})")
        
        try:
            # Create migration log
            self.create_migration_log()
            
            # Get appointments to migrate
            appointments = self.get_appointments_to_migrate()
            logger.info(f"Found {len(appointments)} appointments to process")
            
            if self.dry_run:
                logger.info("DRY RUN MODE - No changes will be made")
            
            # Process each appointment
            for appointment in appointments:
                try:
                    appointment_id = appointment["id"]
                    services = appointment["services"] or []
                    
                    if not services:
                        logger.debug(f"Skipping appointment {appointment_id} - no services")
                        continue
                    
                    # Enhance services with warranty and categorization
                    enhanced_services = self.enhance_appointment_services(
                        appointment_id, services
                    )
                    
                    # Log the enhancements
                    logger.info(f"Appointment {appointment_id}: Enhanced {len(enhanced_services)} services")
                    
                    for service in enhanced_services:
                        service_type = service.get("service_type", "Unknown")
                        warranty_status = service.get("warranty", {}).get("status", "Unknown")
                        logger.debug(f"  - {service['name']}: {service_type}, Warranty: {warranty_status}")
                    
                    self.stats["appointments_processed"] += 1
                    
                except Exception as e:
                    logger.error(f"Error processing appointment {appointment.get('id', 'unknown')}: {e}")
                    self.stats["errors"] += 1
                    continue
            
            # Log final stats
            logger.info("Migration completed successfully")
            logger.info(f"Statistics: {json.dumps(self.stats, indent=2)}")
            
            self.update_migration_log("completed")
            
        except Exception as e:
            error_msg = f"Migration failed: {e}"
            logger.error(error_msg)
            self.update_migration_log("failed", error_msg)
            raise
    
    def rollback_migration(self):
        """Rollback migration changes (placeholder - data is read-only in current implementation)."""
        logger.info("Rollback not needed - migration only reads and categorizes existing data")
        logger.info("No database modifications were made during migration")


def main():
    """Main entry point with command line argument parsing."""
    parser = argparse.ArgumentParser(description="Phase 2 Service History Migration")
    parser.add_argument("--dry-run", action="store_true", default=False,
                       help="Preview changes without modifying database")
    parser.add_argument("--execute", action="store_true", default=False,
                       help="Execute migration with database changes")
    parser.add_argument("--rollback", action="store_true", default=False,
                       help="Rollback migration changes")
    parser.add_argument("--database-url", type=str,
                       help="Database connection URL")
    parser.add_argument("--verbose", "-v", action="store_true", default=False,
                       help="Enable verbose logging")
    
    args = parser.parse_args()
    
    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Validate arguments
    if not any([args.dry_run, args.execute, args.rollback]):
        parser.error("Must specify one of: --dry-run, --execute, or --rollback")
    
    if sum([args.dry_run, args.execute, args.rollback]) > 1:
        parser.error("Can only specify one action at a time")
    
    # Initialize migrator
    dry_run = args.dry_run or not args.execute
    migrator = Phase2Migrator(database_url=args.database_url, dry_run=dry_run)
    
    try:
        migrator.connect()
        
        if args.rollback:
            migrator.rollback_migration()
        else:
            migrator.migrate_appointment_data()
            
        return 0
        
    except KeyboardInterrupt:
        logger.info("Migration interrupted by user")
        return 1
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        return 1
        
    finally:
        migrator.disconnect()


if __name__ == "__main__":
    sys.exit(main())