"""
Unit tests for Admin → Customers service layer
Tests business logic isolation with mocked repository
"""

from unittest.mock import Mock

import pytest

from backend.domain.customers.repository import ListQuery
from backend.domain.customers.service import CustomerService


class TestCustomerService:
    """Unit tests for CustomerService business logic"""

    @pytest.fixture
    def mock_repo(self):
        """Mock repository for isolated testing"""
        return Mock()

    @pytest.fixture
    def service(self, mock_repo):
        """Service instance with mocked repository"""
        return CustomerService(mock_repo)

    def test_list_delegates_to_repository(self, service, mock_repo):
        """Unit: list() delegates to repository.list() with query"""
        # Arrange
        query = ListQuery(page=2, page_size=10, search="test")
        expected_result = {"items": [], "page": 2, "page_size": 10, "total": 0}
        mock_repo.list.return_value = expected_result

        # Act
        result = service.list(query)

        # Assert
        mock_repo.list.assert_called_once_with(query)
        assert result == expected_result

    def test_create_delegates_to_repository(self, service, mock_repo):
        """Unit: create() delegates to repository.create() with data"""
        # Arrange
        customer_data = {
            "name": "Test Customer",
            "email": "test@example.com",
            "phone": "(555) 123-4567",
        }
        expected_result = {"id": "123", **customer_data}
        mock_repo.create.return_value = expected_result

        # Act
        result = service.create(customer_data)

        # Assert
        mock_repo.create.assert_called_once_with(customer_data)
        assert result == expected_result

    def test_get_delegates_to_repository(self, service, mock_repo):
        """Unit: get() delegates to repository.get() with customer_id"""
        # Arrange
        customer_id = "test-customer-123"
        expected_result = {"id": customer_id, "name": "Test Customer"}
        mock_repo.get.return_value = expected_result

        # Act
        result = service.get(customer_id)

        # Assert
        mock_repo.get.assert_called_once_with(customer_id)
        assert result == expected_result

    def test_patch_delegates_to_repository(self, service, mock_repo):
        """Unit: patch() delegates to repository.patch() with customer_id and data"""
        # Arrange
        customer_id = "test-customer-123"
        patch_data = {"name": "Updated Name"}
        expected_result = {"id": customer_id, "name": "Updated Name"}
        mock_repo.patch.return_value = expected_result

        # Act
        result = service.patch(customer_id, patch_data)

        # Assert
        mock_repo.patch.assert_called_once_with(customer_id, patch_data)
        assert result == expected_result

    def test_vehicles_delegates_to_repository(self, service, mock_repo):
        """Unit: vehicles() delegates to repository.vehicles() with customer_id"""
        # Arrange
        customer_id = "test-customer-123"
        expected_result = [
            {"id": "vehicle-1", "customer_id": customer_id, "make": "Toyota"},
            {"id": "vehicle-2", "customer_id": customer_id, "make": "Honda"},
        ]
        mock_repo.vehicles.return_value = expected_result

        # Act
        result = service.vehicles(customer_id)

        # Assert
        mock_repo.vehicles.assert_called_once_with(customer_id)
        assert result == expected_result


class TestListQuery:
    """Unit tests for ListQuery data class"""

    def test_list_query_defaults(self):
        """Unit: ListQuery provides proper defaults"""
        query = ListQuery()

        assert query.page == 1
        assert query.page_size == 20
        assert query.search is None

    def test_list_query_custom_values(self):
        """Unit: ListQuery accepts custom values"""
        query = ListQuery(page=3, page_size=50, search="test search")

        assert query.page == 3
        assert query.page_size == 50
        assert query.search == "test search"
