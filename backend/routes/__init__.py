"""Route blueprints for Edgar's Mobile Auto Shop backend."""

from .health import health_bp
from .mobile import mobile_appointments_bp

__all__ = ["health_bp", "mobile_appointments_bp"]
