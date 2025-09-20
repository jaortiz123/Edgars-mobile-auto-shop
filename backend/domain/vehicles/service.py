"""
Vehicle service - Business logic layer for vehicle operations
Delegates to repository without embedded SQL
"""

from .repository import ListQuery, SqlVehicleRepository


class VehicleService:
    """Vehicle service layer - delegates to repository"""

    def __init__(self, repository: SqlVehicleRepository):
        self.repository = repository

    def list(self, query: ListQuery) -> dict:
        """List vehicles with pagination and filters"""
        return self.repository.list(query)

    def create(self, data: dict) -> dict:
        """Create new vehicle"""
        return self.repository.create(data)

    def get(self, vehicle_id: str) -> dict:
        """Get vehicle by ID"""
        return self.repository.get(vehicle_id)

    def patch(self, vehicle_id: str, data: dict) -> dict:
        """Partial update vehicle"""
        return self.repository.patch(vehicle_id, data)

    def search_vin(self, vin: str) -> list:
        """Search vehicles by VIN pattern"""
        return self.repository.search_vin(vin)
