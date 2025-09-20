"""
Pydantic schemas for Admin Appointments endpoints
"""

from typing import List, Optional

from pydantic import BaseModel, Field


class AppointmentCreate(BaseModel):
    """Input schema for appointment creation"""

    customer_id: str
    vehicle_id: str
    appt_start: str  # ISO8601 timestamp
    appt_end: str  # ISO8601 timestamp
    notes: Optional[str] = None
    service_codes: List[str] = []  # List of service codes to attach


class AppointmentPatch(BaseModel):
    """Input schema for appointment updates"""

    appt_start: Optional[str] = None
    appt_end: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class AppointmentOut(BaseModel):
    """Output schema for appointment responses"""

    id: str
    customer_id: str
    vehicle_id: str
    appt_start: str
    appt_end: str
    status: str
    notes: Optional[str] = None
    created_at: str
    updated_at: str
    services: List[dict] = []  # List of {code, name, qty, price_cents}


class ListQuery(BaseModel):
    """Query parameters for listing appointments"""

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, ge=1, le=200)
    customer_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    status: Optional[str] = None
