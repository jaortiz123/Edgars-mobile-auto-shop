"""
Repository interfaces for Edgar's Mobile Auto Shop
Provides clean abstraction over data access to prevent tight coupling
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple


class CustomerRepository(ABC):
    """Repository interface for customer data access"""

    @abstractmethod
    def get_by_id(self, customer_id: str) -> Optional[Dict[str, Any]]:
        """Get customer by ID"""
        pass

    @abstractmethod
    def update(self, customer_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        """Update customer with patch data, return updated customer"""
        pass

    @abstractmethod
    def search(
        self, query: str, limit: int = 25, offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Search customers, return (results, total_count)"""
        pass

    @abstractmethod
    def create(self, customer_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new customer, return created customer with ID"""
        pass


class AppointmentRepository(ABC):
    """Repository interface for appointment data access"""

    @abstractmethod
    def get_by_id(self, appointment_id: str) -> Optional[Dict[str, Any]]:
        """Get appointment by ID"""
        pass

    @abstractmethod
    def create(self, appointment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new appointment, return created appointment with ID"""
        pass

    @abstractmethod
    def update(self, appointment_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        """Update appointment with patch data"""
        pass

    @abstractmethod
    def list_by_criteria(
        self,
        customer_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 25,
        offset: int = 0,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """List appointments by criteria, return (results, total_count)"""
        pass


class VehicleRepository(ABC):
    """Repository interface for vehicle data access"""

    @abstractmethod
    def get_by_id(self, vehicle_id: str) -> Optional[Dict[str, Any]]:
        """Get vehicle by ID"""
        pass

    @abstractmethod
    def get_by_customer(self, customer_id: str) -> List[Dict[str, Any]]:
        """Get all vehicles for a customer"""
        pass

    @abstractmethod
    def create(self, vehicle_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new vehicle, return created vehicle with ID"""
        pass

    @abstractmethod
    def update(self, vehicle_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        """Update vehicle with patch data"""
        pass


class InvoiceRepository(ABC):
    """Repository interface for invoice/billing data access"""

    @abstractmethod
    def get_by_id(self, invoice_id: str) -> Optional[Dict[str, Any]]:
        """Get invoice by ID"""
        pass

    @abstractmethod
    def create(self, invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new invoice, return created invoice with ID"""
        pass

    @abstractmethod
    def list_by_customer(
        self, customer_id: str, limit: int = 25, offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """List invoices for customer, return (results, total_count)"""
        pass

    @abstractmethod
    def update_payment_status(
        self, invoice_id: str, status: str, payment_data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Update invoice payment status"""
        pass


# Convenience type aliases for dependency injection
Repositories = Dict[str, Any]  # Maps repository name to concrete implementation
