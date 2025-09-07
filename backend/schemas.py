from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, validator


class CustomerRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: Optional[str] = None


class AppointmentCreate(BaseModel):
    # Accept start_ts or start/requested_time; normalize to start_ts
    start_ts: Optional[datetime] = None
    start: Optional[datetime] = None
    requested_time: Optional[datetime] = None

    status: Optional[str] = Field(default="SCHEDULED")
    total_amount: Optional[float] = None
    paid_amount: Optional[float] = None

    # Customer
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None

    # Vehicle
    vehicle_id: Optional[str] = None
    license_plate: Optional[str] = None
    vehicle_year: Optional[int] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None

    # Ops
    tech_id: Optional[str] = None
    primary_operation_id: Optional[str] = None
    service_category: Optional[str] = None
    notes: Optional[str] = None
    location_address: Optional[str] = None

    @validator("status")
    def _upper_status(cls, v: Optional[str]) -> Optional[str]:
        return v.upper() if isinstance(v, str) else v

    @validator("paid_amount", "total_amount", pre=True)
    def _num_to_float(cls, v):
        if v is None or v == "":
            return None
        return float(v)

    @validator("start_ts", pre=True, always=False)
    def _parse_start_ts(cls, v):
        return v

    def normalized_start(self) -> datetime:
        v = self.start_ts or self.start or self.requested_time
        if not isinstance(v, datetime):
            raise ValueError("start/start_ts/requested_time required and must be ISO8601 datetime")
        return v
