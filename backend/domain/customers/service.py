# backend/domain/customers/service.py
from .repository import ListQuery, SqlCustomerRepository


class CustomerService:
    def __init__(self, repository: SqlCustomerRepository):
        self.repository = repository

    def list(self, q: ListQuery) -> dict:
        """List customers with pagination and search"""
        return self.repository.list(q)

    def create(self, data: dict) -> dict:
        """Create new customer"""
        return self.repository.create(data)

    def get(self, customer_id: str) -> dict:
        """Get customer by ID"""
        return self.repository.get(customer_id)

    def patch(self, customer_id: str, data: dict) -> dict:
        """Partial update customer"""
        return self.repository.patch(customer_id, data)

    def vehicles(self, customer_id: str) -> list:
        """Get vehicles for customer"""
        return self.repository.vehicles(customer_id)
