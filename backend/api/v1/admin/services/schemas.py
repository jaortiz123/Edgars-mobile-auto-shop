"""
Pydantic schemas for Admin Services endpoints
"""

from typing import Optional

from pydantic import BaseModel, Field


class ServiceCreate(BaseModel):
    """Input schema for service creation"""

    code: str = Field(min_length=2, max_length=64)
    name: str
    description: Optional[str] = None
    base_price_cents: int = 0
    est_minutes: int = 30


class ServicePatch(BaseModel):
    """Input schema for service updates"""

    name: Optional[str] = None
    description: Optional[str] = None
    base_price_cents: Optional[int] = None
    est_minutes: Optional[int] = None
    is_active: Optional[bool] = None


class ServiceOut(BaseModel):
    """Output schema for service responses"""

    id: str
    code: str
    name: str
    description: Optional[str] = None
    base_price_cents: int
    est_minutes: int
    is_active: bool
    created_at: str
    updated_at: str
