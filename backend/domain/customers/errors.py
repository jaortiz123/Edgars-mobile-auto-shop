# backend/domain/customers/errors.py
class CustomerNotFound(Exception):
    """Raised when customer is not found"""

    pass


class CustomerValidationError(Exception):
    """Raised when customer data validation fails"""

    pass
