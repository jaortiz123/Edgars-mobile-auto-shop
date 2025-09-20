# backend/domain/customers/repository.py
from dataclasses import dataclass
from typing import Optional

from backend.infra.repositories import DatabaseManager


@dataclass
class ListQuery:
    """Query parameters for listing customers"""

    page: int = 1
    page_size: int = 20
    search: Optional[str] = None


class SqlCustomerRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def list(self, q: ListQuery) -> dict:
        """List customers with pagination and search (using search SQL)"""
        # Use the admin search customer SQL with modifications for list
        limit = q.page_size
        offset = (q.page - 1) * q.page_size

        if q.search:
            # Use the search query from admin_search_customers
            search_pattern = f"%{q.search}%"
            query = """
            WITH hits AS (
                -- Name/phone/email matches
                SELECT c.id::text AS customer_id,
                    COALESCE(NULLIF(TRIM(c.name), ''), 'Unknown Customer') AS customer_name,
                    c.phone, c.email, c.is_vip, c.created_at, c.updated_at,
                    c.address_line1, c.address_line2, c.city, c.state, c.zip_code
                FROM customers c
                WHERE (c.name ILIKE %s OR c.phone ILIKE %s OR c.email ILIKE %s)
            )
            SELECT customer_id AS id, customer_name AS name, phone, email, is_vip,
                   created_at, updated_at, address_line1, address_line2, city, state, zip_code
            FROM hits
            ORDER BY customer_name ASC
            LIMIT %s OFFSET %s
            """
            params = (search_pattern, search_pattern, search_pattern, limit, offset)
        else:
            # Simple list all customers
            query = """
            SELECT id::text, name, email, phone, is_vip, created_at, updated_at,
                   address_line1, address_line2, city, state, zip_code
            FROM customers
            ORDER BY created_at DESC, id ASC
            LIMIT %s OFFSET %s
            """
            params = (limit, offset)

        rows = self.db.query(query, params)

        # Convert to expected format
        items = []
        for row in rows:
            customer = dict(row)
            # Convert timestamps to ISO format
            for ts_field in ["created_at", "updated_at"]:
                if customer.get(ts_field):
                    customer[ts_field] = customer[ts_field].isoformat()
            items.append(customer)

        return {
            "items": items,
            "page": q.page,
            "page_size": q.page_size,
            "total": len(items),  # Simple implementation, could add count query
        }

    def create(self, data: dict) -> dict:
        """Create new customer (verbatim INSERT from monolith)"""
        # Extract fields from data
        name = data.get("name")
        email = data.get("email")
        phone = data.get("phone")

        # Use basic customer creation SQL from register endpoint
        insert_query = """
        INSERT INTO customers (name, email, phone, address_line1, address_line2, city, state, zip_code)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id::text
        """

        row = self.db.one(
            insert_query,
            (
                name,
                email,
                phone,
                data.get("address_line1"),
                data.get("address_line2"),
                data.get("city"),
                data.get("state"),
                data.get("zip_code"),
            ),
        )

        new_id = row["id"]
        return self.get(new_id)

    def get(self, customer_id: str) -> dict:
        """Get customer by ID (verbatim SELECT from monolith _get_customer_row)"""
        # Keep id::text cast for seed ID compatibility
        query = """
        SELECT id::text, name, email, phone, is_vip, address_line1, address_line2,
               city, state, zip_code, created_at, updated_at,
               to_char(GREATEST(updated_at, created_at),'YYYY-MM-DD"T"HH24:MI:SS.US') AS ts
        FROM customers
        WHERE id::text = %s
        """

        row = self.db.one(query, (str(customer_id),))
        if not row:
            return None

        # Convert timestamps to ISO format
        customer = dict(row)
        for ts_field in ["created_at", "updated_at"]:
            if customer.get(ts_field):
                customer[ts_field] = customer[ts_field].isoformat()

        return customer

    def patch(self, customer_id: str, data: dict) -> dict:
        """Partial update customer (verbatim UPDATE from monolith)"""
        # Build dynamic UPDATE like monolith patch_customer
        set_clauses = []
        params = []

        # Map fields that can be updated
        updateable_fields = [
            "name",
            "email",
            "phone",
            "address_line1",
            "address_line2",
            "city",
            "state",
            "zip_code",
        ]

        for field in updateable_fields:
            if field in data and data[field] is not None:
                set_clauses.append(f"{field} = %s")
                params.append(data[field])

        if not set_clauses:
            # No changes, return current state
            return self.get(customer_id)

        # Add updated_at like monolith
        set_clauses.append("updated_at = NOW()")
        params.append(customer_id)  # For WHERE clause

        update_query = f"UPDATE customers SET {', '.join(set_clauses)} WHERE id::text = %s"
        self.db.query(update_query, params)

        return self.get(customer_id)

    def vehicles(self, customer_id: str) -> list:
        """Get vehicles for customer (verbatim SELECT from monolith)"""
        # Use SQL pattern from appointment vehicle fetching
        query = """
        SELECT id::text, customer_id::text, make, model, year, vin, license_plate,
               created_at, updated_at
        FROM vehicles
        WHERE customer_id::text = %s
        ORDER BY created_at ASC
        """

        rows = self.db.query(query, (str(customer_id),))

        # Convert timestamps to ISO format
        vehicles = []
        for row in rows:
            vehicle = dict(row)
            for ts_field in ["created_at", "updated_at"]:
                if vehicle.get(ts_field):
                    vehicle[ts_field] = vehicle[ts_field].isoformat()
            vehicles.append(vehicle)

        return vehicles
