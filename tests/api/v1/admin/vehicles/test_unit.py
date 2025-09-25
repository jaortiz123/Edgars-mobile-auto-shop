"""
Unit tests for Admin → Vehicles service layer
Tests business logic isolation with mocked repository
"""

from unittest.mock import Mock

import pytest

from backend.domain.vehicles.repository import ListQuery
from backend.domain.vehicles.service import VehicleService


class TestVehicleService:
    """Unit tests for VehicleService business logic"""

    @pytest.fixture
    def mock_repo(self):
        """Mock repository for isolated testing"""
        return Mock()

    @pytest.fixture
    def service(self, mock_repo):
        """Service instance with mocked repository"""
        return VehicleService(mock_repo)

    def test_list_delegates_to_repository(self, service, mock_repo):
        """Unit: list() delegates to repository.list() with query"""
        # Arrange
        query = ListQuery(page=2, page_size=10, customer_id="customer-123")
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
        vehicle_data = {
            "customer_id": "customer-123",
            "make": "Toyota",
            "model": "Camry",
            "year": 2020,
            "vin": "1234567890ABCDEFG",
        }
        expected_result = {"id": "123", **vehicle_data}
        mock_repo.create.return_value = expected_result

        # Act
        result = service.create(vehicle_data)

        # Assert
        mock_repo.create.assert_called_once_with(vehicle_data)
        assert result == expected_result

    def test_get_delegates_to_repository(self, service, mock_repo):
        """Unit: get() delegates to repository.get() with vehicle_id"""
        # Arrange
        vehicle_id = "test-vehicle-123"
        expected_result = {"id": vehicle_id, "make": "Honda", "model": "Civic"}
        mock_repo.get.return_value = expected_result

        # Act
        result = service.get(vehicle_id)

        # Assert
        mock_repo.get.assert_called_once_with(vehicle_id)
        assert result == expected_result

    def test_patch_delegates_to_repository(self, service, mock_repo):
        """Unit: patch() delegates to repository.patch() with vehicle_id and data"""
        # Arrange
        vehicle_id = "test-vehicle-123"
        patch_data = {"make": "Updated Make"}
        expected_result = {"id": vehicle_id, "make": "Updated Make"}
        mock_repo.patch.return_value = expected_result

        # Act
        result = service.patch(vehicle_id, patch_data)

        # Assert
        mock_repo.patch.assert_called_once_with(vehicle_id, patch_data)
        assert result == expected_result

    def test_search_vin_delegates_to_repository(self, service, mock_repo):
        """Unit: search_vin() delegates to repository.search_vin() with vin"""
        # Arrange
        vin = "ABC123"
        expected_result = [
            {"id": "vehicle-1", "vin": "ABC1234567890DEFG", "make": "Toyota"},
            {"id": "vehicle-2", "vin": "XYZ1234567890ABCD", "make": "Honda"},
        ]
        mock_repo.search_vin.return_value = expected_result

        # Act
        result = service.search_vin(vin)

        # Assert
        mock_repo.search_vin.assert_called_once_with(vin)
        assert result == expected_result


class TestListQuery:
    """Unit tests for ListQuery data class"""

    def test_list_query_defaults(self):
        """Unit: ListQuery provides proper defaults"""
        query = ListQuery()

        assert query.page == 1
        assert query.page_size == 20
        assert query.customer_id is None
        assert query.vin is None
        assert query.make is None
        assert query.model is None
        assert query.year is None

    def test_list_query_custom_values(self):
        """Unit: ListQuery accepts custom values"""
        query = ListQuery(
            page=3,
            page_size=50,
            customer_id="customer-123",
            vin="ABC123",
            make="Toyota",
            model="Camry",
            year="2020",
        )

        assert query.page == 3
        assert query.page_size == 50
        assert query.customer_id == "customer-123"
        assert query.vin == "ABC123"
        assert query.make == "Toyota"
        assert query.model == "Camry"
        assert query.year == "2020"
