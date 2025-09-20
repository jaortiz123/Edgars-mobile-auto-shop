"""
Pydantic schemas for Admin Vehicles endpoints
Mirrors exact field names and types from current API
"""

from dataclasses import dataclass
from typing import Optional

from pydantic import BaseModel


class VehicleIn(BaseModel):
    """Input schema for vehicle creation/updates"""

    customer_id: str
    vin: str
    year: int
    make: str
    model: str
    trim: Optional[str] = None
    color: Optional[str] = None
    license_plate: Optional[str] = None
    mileage: Optional[int] = None


class VehicleOut(BaseModel):
    """Output schema for vehicle responses"""

    id: str
    customer_id: str
    vin: str
    year: int
    make: str
    model: str
    trim: Optional[str] = None
    color: Optional[str] = None
    license_plate: Optional[str] = None
    mileage: Optional[int] = None
    created_at: str
    updated_at: str


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
