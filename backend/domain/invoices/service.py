"""
Invoice Service - Business logic layer for invoice operations
Delegates to repository for data persistence
"""

from typing import Any, Dict

from .errors import InvoiceNotFoundError, InvoiceValidationError
from .repository import SqlInvoiceRepository


class InvoiceService:
    """Service layer for invoice operations"""

    def __init__(self, repository: SqlInvoiceRepository):
        self.repository = repository

    def list(self, query_params: Dict[str, Any]) -> Dict[str, Any]:
        """List invoices with pagination and filters"""
        return self.repository.list(query_params)

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new invoice"""
        # Basic validation
        if not data.get("appointment_id"):
            raise InvoiceValidationError("appointment_id is required")
        if not data.get("customer_id"):
            raise InvoiceValidationError("customer_id is required")

        return self.repository.create(data)

    def get(self, invoice_id: str) -> Dict[str, Any]:
        """Get invoice by ID with line items"""
        result = self.repository.get(invoice_id)
        if not result:
            raise InvoiceNotFoundError(invoice_id)
        return result

    def patch(self, invoice_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update invoice fields (status, notes)"""
        result = self.repository.patch(invoice_id, data)
        if not result:
            raise InvoiceNotFoundError(invoice_id)
        return result
