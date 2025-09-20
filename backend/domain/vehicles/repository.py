# backend/domain/vehicles/repository.py
from dataclasses import dataclass
from typing import Optional

from backend.infra.repositories import DatabaseManager


@dataclass
class ListQuery:
    """Query parameters for listing vehicles"""

    page: int = 1
    page_size: int = 20
    customer_id: Optional[str] = None
    vin: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[str] = None


class SqlVehicleRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def list(self, q: ListQuery) -> dict:
        """List vehicles with pagination and filters (using verbatim SQL from monolith)"""
        limit = q.page_size
        offset = (q.page - 1) * q.page_size

        # Build base query - will extract from local_server.py
        base_query = """
        SELECT id::text, customer_id::text, vin, year, make, model, trim, color,
               license_plate, mileage, created_at, updated_at
        FROM vehicles
        WHERE 1=1
        """

        params = []

        # Add filters
        if q.customer_id:
            base_query += " AND customer_id::text = %s"
            params.append(str(q.customer_id))

        if q.vin:
            base_query += " AND vin ILIKE %s"
            params.append(f"%{q.vin}%")

        if q.make:
            base_query += " AND make ILIKE %s"
            params.append(f"%{q.make}%")

        if q.model:
            base_query += " AND model ILIKE %s"
            params.append(f"%{q.model}%")

        if q.year:
            base_query += " AND year = %s"
            params.append(int(q.year))

        # Add ordering and pagination
        base_query += " ORDER BY created_at DESC, id ASC LIMIT %s OFFSET %s"
        params.extend([limit, offset])

        rows = self.db.query(base_query, params)

        # Convert to expected format
        items = []
        for row in rows:
            vehicle = dict(row)
            # Convert timestamps to ISO format
            for ts_field in ["created_at", "updated_at"]:
                if vehicle.get(ts_field):
                    vehicle[ts_field] = vehicle[ts_field].isoformat()
            items.append(vehicle)

        return {
            "items": items,
            "page": q.page,
            "page_size": q.page_size,
            "total": len(items),  # Simple implementation
        }

    def create(self, data: dict) -> dict:
        """Create new vehicle (verbatim INSERT from monolith)"""
        # Use dynamic column approach from create_vehicle function
        columns = ["customer_id", "make", "model", "year", "license_plate"]
        values = [
            data.get("customer_id"),
            data.get("make"),
            data.get("model"),
            data.get("year"),
            data.get("license_plate"),
        ]

        # Add VIN if provided (matching monolith logic)
        if data.get("vin"):
            columns.insert(4, "vin")  # after year
            values.insert(4, data.get("vin"))

        # Add other optional fields
        optional_fields = ["trim", "color", "mileage"]
        for field in optional_fields:
            if data.get(field) is not None:
                columns.append(field)
                values.append(data.get(field))

        placeholders = ", ".join(["%s"] * len(values))
        field_names = ", ".join(columns)

        insert_query = f"INSERT INTO vehicles ({field_names}) VALUES ({placeholders}) RETURNING id"

        row = self.db.one(insert_query, tuple(values))
        new_id = str(row["id"])
        return self.get(new_id)

    def get(self, vehicle_id: str) -> dict:
        """Get vehicle by ID (verbatim SELECT from monolith _get_vehicle_row)"""
        # Use exact SQL from _get_vehicle_row function
        query = """
        SELECT id, customer_id, make, model, year, vin, license_plate,
               to_char(GREATEST(updated_at, created_at),'YYYY-MM-DD"T"HH24:MI:SS.US') AS ts
        FROM vehicles
        WHERE id=%s
        """

        row = self.db.one(query, (int(vehicle_id),))
        if not row:
            return None

        # Convert to expected format with id::text cast
        vehicle = dict(row)
        vehicle["id"] = str(vehicle["id"])
        vehicle["customer_id"] = str(vehicle["customer_id"])

        # Use ts for both created_at and updated_at to match monolith behavior
        if vehicle.get("ts"):
            vehicle["created_at"] = vehicle["ts"]
            vehicle["updated_at"] = vehicle["ts"]

        return vehicle

    def patch(self, vehicle_id: str, data: dict) -> dict:
        """Partial update vehicle (verbatim UPDATE from monolith)"""
        # Build fields dict like monolith patch_vehicle
        fields = {}
        updateable_fields = [
            "make",
            "model",
            "year",
            "vin",
            "license_plate",
            "is_primary",
            "is_active",
            "trim",
            "color",
            "mileage",
        ]

        for field in updateable_fields:
            if field in data and data[field] is not None:
                fields[field] = data[field]

        if not fields:
            # No changes, return current state
            return self.get(vehicle_id)

        # Use exact UPDATE pattern from monolith
        sets = ", ".join(f"{k}=%s" for k in fields.keys()) + ", updated_at=now()"
        update_query = f"UPDATE vehicles SET {sets} WHERE id=%s"

        params = list(fields.values()) + [int(vehicle_id)]
        self.db.query(update_query, params)

        return self.get(vehicle_id)

    def search_vin(self, vin: str) -> list:
        """Search vehicles by VIN pattern (verbatim SELECT from monolith)"""
        # Use pattern from license plate lookups which use ILIKE with %
        query = """
        SELECT id::text, customer_id::text, year, make, model, vin, license_plate,
               to_char(GREATEST(updated_at, created_at),'YYYY-MM-DD"T"HH24:MI:SS.US') AS ts
        FROM vehicles
        WHERE vin ILIKE %s
        ORDER BY vin ASC
        """

        rows = self.db.query(query, (f"%{vin}%",))

        # Convert to expected format matching get() method
        vehicles = []
        for row in rows:
            vehicle = dict(row)
            # Use ts for timestamps
            if vehicle.get("ts"):
                vehicle["created_at"] = vehicle["ts"]
                vehicle["updated_at"] = vehicle["ts"]
            vehicles.append(vehicle)

        return vehicles
