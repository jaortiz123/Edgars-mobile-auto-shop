"""
Vehicle domain errors
"""


class VehicleError(Exception):
    """Base vehicle domain error"""

    pass


class VehicleNotFoundError(VehicleError):
    """Vehicle not found error"""

    pass


class VehicleValidationError(VehicleError):
    """Vehicle validation error"""

    pass
