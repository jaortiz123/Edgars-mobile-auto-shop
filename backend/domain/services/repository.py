"""
Services repository - Data access layer for service operations
Uses LazyDatabaseManager for connection management
"""

from typing import Any, Dict, List, Optional


class ServiceRepository:
    """Service repository using LazyDatabaseManager"""

    def __init__(self, db):
        self.db = db

    def list(
        self, page: int = 1, page_size: int = 20, search: str = "", is_active: Optional[bool] = None
    ) -> tuple:
        """List services with pagination and search"""
        offset = (page - 1) * page_size

        # Build WHERE conditions
        where_conditions = ["($1 = '' OR name ILIKE '%'||$1||'%' OR code ILIKE '%'||$1||'%')"]
        params = [search]
        param_idx = 2

        if is_active is not None:
            where_conditions.append(f"is_active = ${param_idx}")
            params.append(is_active)
            param_idx += 1

        where_clause = " AND ".join(where_conditions)

        # Main query with search and filters
        query = f"""
        SELECT id::text, code, name, description, base_price_cents, est_minutes, is_active,
               created_at, updated_at
        FROM services
        WHERE {where_clause}
        ORDER BY created_at DESC
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """

        params.extend([page_size, offset])
        rows = self.db.query(query, params)

        # Count query
        count_query = f"""
        SELECT COUNT(*) AS n
        FROM services
        WHERE {where_clause}
        """

        total = self.db.one(count_query, params[:-2])["n"]  # Remove LIMIT/OFFSET params

        # Convert timestamps to ISO format
        items = []
        for row in rows:
            service = dict(row)
            for ts_field in ["created_at", "updated_at"]:
                if service.get(ts_field):
                    service[ts_field] = service[ts_field].isoformat()
            items.append(service)

        return items, total

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new service"""
        query = """
        INSERT INTO services(code, name, description, base_price_cents, est_minutes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id::text, code, name, description, base_price_cents, est_minutes, is_active, created_at, updated_at
        """

        row = self.db.one(
            query,
            [
                data["code"],
                data["name"],
                data.get("description"),
                data.get("base_price_cents", 0),
                data.get("est_minutes", 30),
            ],
        )

        service = dict(row)
        # Convert timestamps to ISO format
        for ts_field in ["created_at", "updated_at"]:
            if service.get(ts_field):
                service[ts_field] = service[ts_field].isoformat()

        return service

    def get(self, service_id: str) -> Optional[Dict[str, Any]]:
        """Get service by ID"""
        query = """
        SELECT id::text, code, name, description, base_price_cents, est_minutes, is_active, created_at, updated_at
        FROM services
        WHERE id = $1
        """

        try:
            row = self.db.one(query, [service_id])
            service = dict(row)
            # Convert timestamps to ISO format
            for ts_field in ["created_at", "updated_at"]:
                if service.get(ts_field):
                    service[ts_field] = service[ts_field].isoformat()
            return service
        except Exception:
            return None

    def patch(self, service_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Partial update service"""
        # Build dynamic SET clause
        set_parts = []
        params = []
        param_idx = 1

        for field in ["name", "description", "base_price_cents", "est_minutes", "is_active"]:
            if field in data and data[field] is not None:
                set_parts.append(f"{field} = ${param_idx}")
                params.append(data[field])
                param_idx += 1

        if not set_parts:
            return self.get(service_id)  # No changes

        # Always update the updated_at timestamp
        set_parts.append("updated_at = NOW()")

        # Add service_id for WHERE clause
        params.append(service_id)

        query = f"""
        UPDATE services
        SET {', '.join(set_parts)}
        WHERE id = ${param_idx}
        RETURNING id::text, code, name, description, base_price_cents, est_minutes, is_active, created_at, updated_at
        """

        try:
            row = self.db.one(query, params)
            service = dict(row)
            # Convert timestamps to ISO format
            for ts_field in ["created_at", "updated_at"]:
                if service.get(ts_field):
                    service[ts_field] = service[ts_field].isoformat()
            return service
        except Exception:
            return None

    def get_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        """Get service by code"""
        query = """
        SELECT id::text, code, name, description, base_price_cents, est_minutes, is_active, created_at, updated_at
        FROM services
        WHERE code = $1
        """

        try:
            row = self.db.one(query, [code])
            service = dict(row)
            # Convert timestamps to ISO format
            for ts_field in ["created_at", "updated_at"]:
                if service.get(ts_field):
                    service[ts_field] = service[ts_field].isoformat()
            return service
        except Exception:
            return None

    def get_by_codes(self, codes: List[str]) -> List[Dict[str, Any]]:
        """Get services by list of codes"""
        if not codes:
            return []

        # Create placeholders for IN clause
        placeholders = ",".join([f"${i+1}" for i in range(len(codes))])

        query = f"""
        SELECT id::text, code, name, base_price_cents, is_active
        FROM services
        WHERE code IN ({placeholders}) AND is_active = TRUE
        """

        rows = self.db.query(query, codes)
        return [dict(row) for row in rows]
