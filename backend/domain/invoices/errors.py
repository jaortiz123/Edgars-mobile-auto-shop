"""
Domain errors for invoices
"""


class InvoiceError(Exception):
    """Base exception for invoice errors"""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class InvoiceNotFoundError(InvoiceError):
    """Raised when invoice is not found"""

    def __init__(self, invoice_id: str):
        super().__init__("not_found", f"Invoice {invoice_id} not found")


class InvoiceValidationError(InvoiceError):
    """Raised when invoice data is invalid"""

    def __init__(self, message: str):
        super().__init__("validation_error", message)


class InvoiceStateError(InvoiceError):
    """Raised when invoice is in wrong state for operation"""

    def __init__(self, message: str):
        super().__init__("invalid_state", message)
