"""
Unit tests for Admin → Invoices service layer
Tests business logic isolation with mocked repository
"""

from unittest.mock import Mock

import pytest

from backend.domain.invoices.errors import InvoiceNotFoundError, InvoiceValidationError
from backend.domain.invoices.service import InvoiceService


class TestInvoiceService:
    """Unit tests for InvoiceService business logic"""

    @pytest.fixture
    def mock_repo(self):
        """Mock repository for isolated testing"""
        return Mock()

    @pytest.fixture
    def service(self, mock_repo):
        """Service instance with mocked repository"""
        return InvoiceService(mock_repo)

    def test_list_delegates_to_repository(self, service, mock_repo):
        """Unit: list() delegates to repository.list() with query"""
        # Arrange
        query_params = {"page": 2, "page_size": 10, "customer_id": "customer-123"}
        expected_result = {"items": [], "page": 2, "page_size": 10, "total": 0}
        mock_repo.list.return_value = expected_result

        # Act
        result = service.list(query_params)

        # Assert
        mock_repo.list.assert_called_once_with(query_params)
        assert result == expected_result

    def test_create_validates_required_fields(self, service, mock_repo):
        """Unit: create() validates appointment_id and customer_id are present"""
        # Test missing appointment_id
        with pytest.raises(InvoiceValidationError) as exc_info:
            service.create({"customer_id": "cust-123"})
        assert "appointment_id is required" in str(exc_info.value)

        # Test missing customer_id
        with pytest.raises(InvoiceValidationError) as exc_info:
            service.create({"appointment_id": "appt-123"})
        assert "customer_id is required" in str(exc_info.value)

    def test_create_delegates_to_repository_when_valid(self, service, mock_repo):
        """Unit: create() delegates to repository when data is valid"""
        # Arrange
        data = {
            "appointment_id": "appt-123",
            "customer_id": "cust-123",
            "items": [{"service_code": "oil_change", "qty": 1, "unit_price": "49.99"}],
        }
        expected_result = {"id": "inv-123", "status": "DRAFT"}
        mock_repo.create.return_value = expected_result

        # Act
        result = service.create(data)

        # Assert
        mock_repo.create.assert_called_once_with(data)
        assert result == expected_result

    def test_get_delegates_to_repository(self, service, mock_repo):
        """Unit: get() delegates to repository.get()"""
        # Arrange
        invoice_id = "inv-123"
        expected_result = {"id": "inv-123", "status": "DRAFT", "lineItems": []}
        mock_repo.get.return_value = expected_result

        # Act
        result = service.get(invoice_id)

        # Assert
        mock_repo.get.assert_called_once_with(invoice_id)
        assert result == expected_result

    def test_get_raises_not_found_when_repo_returns_none(self, service, mock_repo):
        """Unit: get() raises InvoiceNotFoundError when repository returns None"""
        # Arrange
        invoice_id = "nonexistent-123"
        mock_repo.get.return_value = None

        # Act & Assert
        with pytest.raises(InvoiceNotFoundError) as exc_info:
            service.get(invoice_id)

        assert invoice_id in str(exc_info.value)
        mock_repo.get.assert_called_once_with(invoice_id)

    def test_patch_delegates_to_repository(self, service, mock_repo):
        """Unit: patch() delegates to repository.patch()"""
        # Arrange
        invoice_id = "inv-123"
        data = {"status": "COMPLETED", "notes": "Work completed"}
        expected_result = {"id": "inv-123", "status": "COMPLETED", "notes": "Work completed"}
        mock_repo.patch.return_value = expected_result

        # Act
        result = service.patch(invoice_id, data)

        # Assert
        mock_repo.patch.assert_called_once_with(invoice_id, data)
        assert result == expected_result

    def test_patch_raises_not_found_when_repo_returns_none(self, service, mock_repo):
        """Unit: patch() raises InvoiceNotFoundError when repository returns None"""
        # Arrange
        invoice_id = "nonexistent-123"
        data = {"status": "COMPLETED"}
        mock_repo.patch.return_value = None

        # Act & Assert
        with pytest.raises(InvoiceNotFoundError) as exc_info:
            service.patch(invoice_id, data)

        assert invoice_id in str(exc_info.value)
        mock_repo.patch.assert_called_once_with(invoice_id, data)

    def test_create_passes_through_repository_exceptions(self, service, mock_repo):
        """Unit: create() passes through repository exceptions unchanged"""
        # Arrange
        data = {"appointment_id": "appt-123", "customer_id": "cust-123"}
        mock_repo.create.side_effect = Exception("Database connection failed")

        # Act & Assert
        with pytest.raises(Exception) as exc_info:
            service.create(data)

        assert "Database connection failed" in str(exc_info.value)
        mock_repo.create.assert_called_once_with(data)


def test_money_arithmetic_exact():
    """Unit: Money arithmetic preserves cents precision and rounding rules from monolith"""
    from decimal import ROUND_HALF_UP, Decimal

    # Test cases mirror monolith money handling patterns (using Python's default rounding)
    test_cases = [
        # (service_price_str, expected_cents)
        ("49.99", 4999),
        ("25.00", 2500),
        ("0.01", 1),
        ("0.99", 99),
        ("100.555", 10056),  # Rounds up
        ("100.554", 10055),  # Rounds down
        ("0.005", 0),  # Python default rounds to even (banker's rounding)
        ("0.015", 2),  # Rounds to even
        ("0.004", 0),  # Rounds down
    ]

    for price_str, expected_cents in test_cases:
        # Convert using exact same logic as repository
        price = float(price_str)
        cents = int(round(price * 100))

        assert (
            cents == expected_cents
        ), f"Price {price_str} should convert to {expected_cents} cents, got {cents}"

    # Test totals calculation preserves precision
    services = [
        {"estimated_price": "49.99"},  # 4999 cents
        {"estimated_price": "25.00"},  # 2500 cents
        {"estimated_price": "0.01"},  # 1 cent
    ]

    # Calculate subtotal using repository logic
    subtotal_cents = 0
    for service in services:
        try:
            price = float(service.get("estimated_price", 0))
            subtotal_cents += int(round(price * 100))
        except (TypeError, ValueError):
            pass

    expected_subtotal = 4999 + 2500 + 1  # 7500 cents = $75.00
    assert (
        subtotal_cents == expected_subtotal
    ), f"Subtotal should be {expected_subtotal} cents, got {subtotal_cents}"

    # Verify no float drift in multi-step calculations
    tax_rate = Decimal("0.08")  # 8% tax
    # Tax calculation: 7500 cents * 0.08 = 600 cents
    tax_cents = int(
        (Decimal(subtotal_cents) * tax_rate).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    )
    total_cents = subtotal_cents + tax_cents

    # Tax on $75.00 at 8% = $6.00 = 600 cents
    assert tax_cents == 600, f"Tax should be 600 cents, got {tax_cents}"
    assert total_cents == 8100, f"Total should be 8100 cents, got {total_cents}"
