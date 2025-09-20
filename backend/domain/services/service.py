"""
Services business logic layer
Handles validation and business rules for service operations
"""

from typing import Any, Dict, List, Optional

from backend.domain.services.repository import ServiceRepository


class ServiceService:
    """Service business logic using ServiceRepository"""

    def __init__(self, db):
        self.db = db
        self.repo = ServiceRepository(db)

    def list_services(
        self,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """List services with pagination and filtering"""
        # Convert None search to empty string for repository
        search_term = search or ""

        items, total = self.repo.list(
            page=page, page_size=page_size, search=search_term, is_active=is_active
        )

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size,
        }

    def create_service(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new service with validation"""
        # Business rule: code must be unique
        existing = self.repo.get_by_code(data["code"])
        if existing:
            raise ValueError(f"Service with code '{data['code']}' already exists")

        # Business rule: base_price_cents must be positive
        if data.get("base_price_cents", 0) < 0:
            raise ValueError("Service price cannot be negative")

        # Business rule: est_minutes must be positive
        if data.get("est_minutes", 0) <= 0:
            raise ValueError("Service duration must be greater than 0 minutes")

        return self.repo.create(data)

    def get_service(self, service_id: str) -> Optional[Dict[str, Any]]:
        """Get service by ID"""
        return self.repo.get(service_id)

    def update_service(self, service_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update service with validation"""
        # Check if service exists
        existing = self.repo.get(service_id)
        if not existing:
            return None

        # Business rule: if changing code, ensure uniqueness
        if "code" in data and data["code"] != existing["code"]:
            existing_code = self.repo.get_by_code(data["code"])
            if existing_code and existing_code["id"] != service_id:
                raise ValueError(f"Service with code '{data['code']}' already exists")

        # Business rule: validate pricing if provided
        if "base_price_cents" in data and data["base_price_cents"] < 0:
            raise ValueError("Service price cannot be negative")

        # Business rule: validate duration if provided
        if "est_minutes" in data and data["est_minutes"] <= 0:
            raise ValueError("Service duration must be greater than 0 minutes")

        return self.repo.patch(service_id, data)

    def get_services_by_codes(self, codes: List[str]) -> List[Dict[str, Any]]:
        """Get multiple services by codes for appointment creation"""
        if not codes:
            return []

        services = self.repo.get_by_codes(codes)

        # Verify all codes exist
        found_codes = {s["code"] for s in services}
        missing_codes = set(codes) - found_codes
        if missing_codes:
            raise ValueError(f"Services not found: {', '.join(missing_codes)}")

        return services
