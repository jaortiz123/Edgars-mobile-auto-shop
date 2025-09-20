"""
Pydantic schemas for Admin Invoices endpoints
Mirrors exact field names and types from current API
"""

from dataclasses import dataclass
from typing import List, Optional

from pydantic import BaseModel


class InvoiceItemIn(BaseModel):
    """Input schema for invoice line items"""

    service_code: str
    qty: int = 1
    unit_price: str  # Keep as string to match money handling in monolith


class InvoiceIn(BaseModel):
    """Input schema for invoice creation"""

    appointment_id: str
    customer_id: str
    items: List[InvoiceItemIn]
    tax_rate: Optional[str] = "0.00"  # Keep as string for precision
    notes: Optional[str] = None


class InvoiceItemOut(BaseModel):
    """Output schema for invoice line items"""

    id: str
    service_code: str
    qty: int
    unit_price: str
    line_total: str


class InvoiceOut(BaseModel):
    """Output schema for invoice responses"""

    id: str
    appointment_id: str
    customer_id: str
    status: str
    subtotal_cents: int
    tax_cents: int
    total_cents: int
    amount_paid_cents: int
    amount_due_cents: int
    currency: Optional[str] = "USD"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class ListQuery:
    """Query parameters for invoice listing"""

    page: int = 1
    page_size: int = 20
    customer_id: Optional[str] = None
    status: Optional[str] = None
    search: Optional[str] = None
