"""
Test CSV export functionality (T-024)

Comprehensive test coverage for CSV export endpoints:
- GET /api/admin/reports/appointments.csv
- GET /api/admin/reports/payments.csv

Tests include authentication, RBAC, rate limiting, query parameters,
CSV format validation, and error handling.
"""

import pytest
import io
import csv
import json
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from local_server import app


class TestCSVExports:
    """Test class for CSV export functionality"""

    @pytest.fixture
    def client(self):
        """Test client fixture"""
        app.config["TESTING"] = True
        with app.test_client() as client:
            yield client

    @pytest.fixture
    def owner_headers(self):
        """Headers with Owner role JWT token"""
        # Mock JWT token for Owner role
        return {"Authorization": "Bearer mock_owner_token", "Content-Type": "application/json"}

    @pytest.fixture
    def advisor_headers(self):
        """Headers with Advisor role JWT token"""
        return {"Authorization": "Bearer mock_advisor_token", "Content-Type": "application/json"}

    @pytest.fixture
    def accountant_headers(self):
        """Headers with Accountant role JWT token"""
        return {"Authorization": "Bearer mock_accountant_token", "Content-Type": "application/json"}

    @pytest.fixture
    def technician_headers(self):
        """Headers with Technician role JWT token (should be denied)"""
        return {"Authorization": "Bearer mock_technician_token", "Content-Type": "application/json"}

    @pytest.fixture
    def sample_appointments_data(self):
        """Sample appointment data for testing"""
        return [
            {
                "id": "123",
                "status": "COMPLETED",
                "start_ts": datetime(2024, 1, 15, 10, 0, 0),
                "end_ts": datetime(2024, 1, 15, 12, 0, 0),
                "total_amount": 150.00,
                "paid_amount": 150.00,
                "customer_name": "John Doe",
                "customer_email": "john@example.com",
                "customer_phone": "(555) 123-4567",
                "year": 2020,
                "make": "Toyota",
                "model": "Camry",
                "vin": "1HGBH41JXMN109186",
                "services_summary": "Oil Change, Brake Inspection",
            },
            {
                "id": "124",
                "status": "SCHEDULED",
                "start_ts": datetime(2024, 1, 16, 14, 0, 0),
                "end_ts": datetime(2024, 1, 16, 16, 0, 0),
                "total_amount": 250.00,
                "paid_amount": 0.00,
                "customer_name": "Jane Smith",
                "customer_email": "jane@example.com",
                "customer_phone": "(555) 987-6543",
                "year": 2018,
                "make": "Honda",
                "model": "Accord",
                "vin": "1HGCV1F30JA123456",
                "services_summary": "Tire Rotation, Engine Diagnostic",
            },
        ]

    @pytest.fixture
    def sample_payments_data(self):
        """Sample payment data for testing"""
        return [
            {
                "id": "456",
                "appointment_id": "123",
                "amount": 150.00,
                "payment_method": "credit_card",
                "transaction_id": "txn_123456",
                "payment_date": datetime(2024, 1, 15, 12, 30, 0),
                "status": "completed",
            },
            {
                "id": "457",
                "appointment_id": "124",
                "amount": 100.00,
                "payment_method": "cash",
                "transaction_id": None,
                "payment_date": datetime(2024, 1, 16, 15, 0, 0),
                "status": "completed",
            },
        ]

    def mock_auth_success(self, role="Owner"):
        """Mock successful authentication with specified role"""
        return {"user_id": "test_user_123", "role": role}

    def mock_auth_failure(self):
        """Mock authentication failure"""
        raise Exception("Authentication failed")

    # Authentication and Authorization Tests

    def test_appointments_export_requires_auth(self, client):
        """Test that appointments export requires authentication"""
        response = client.get("/api/admin/reports/appointments.csv")
        assert response.status_code == 403
        data = json.loads(response.data)
        assert data["error_code"] == "AUTH_REQUIRED"

    def test_payments_export_requires_auth(self, client):
        """Test that payments export requires authentication"""
        response = client.get("/api/admin/reports/payments.csv")
        assert response.status_code == 403
        data = json.loads(response.data)
        assert data["error_code"] == "AUTH_REQUIRED"

    @patch("local_server.require_auth_role")
    def test_appointments_export_owner_access(
        self, mock_auth, client, owner_headers, sample_appointments_data
    ):
        """Test that Owner role can access appointments export"""
        mock_auth.return_value = self.mock_auth_success("Owner")

        with patch("local_server.db_conn") as mock_db_conn:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = sample_appointments_data
            mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
            mock_db_conn.return_value = mock_conn

            response = client.get("/api/admin/reports/appointments.csv", headers=owner_headers)
            assert response.status_code == 200
            assert response.headers["Content-Type"] == "text/csv; charset=utf-8"

    @patch("local_server.require_auth_role")
    def test_appointments_export_advisor_access(
        self, mock_auth, client, advisor_headers, sample_appointments_data
    ):
        """Test that Advisor role can access appointments export"""
        mock_auth.return_value = self.mock_auth_success("Advisor")

        with patch("local_server.db_conn") as mock_db_conn:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = sample_appointments_data
            mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
            mock_db_conn.return_value = mock_conn

            response = client.get("/api/admin/reports/appointments.csv", headers=advisor_headers)
            assert response.status_code == 200

    @patch("local_server.require_auth_role")
    def test_appointments_export_accountant_access(
        self, mock_auth, client, accountant_headers, sample_appointments_data
    ):
        """Test that Accountant role can access appointments export"""
        mock_auth.return_value = self.mock_auth_success("Accountant")

        with patch("local_server.db_conn") as mock_db_conn:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = sample_appointments_data
            mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
            mock_db_conn.return_value = mock_conn

            response = client.get("/api/admin/reports/appointments.csv", headers=accountant_headers)
            assert response.status_code == 200

    @patch("local_server.require_auth_role")
    def test_appointments_export_technician_denied(self, mock_auth, client, technician_headers):
        """Test that Technician role is denied access to appointments export"""
        mock_auth.return_value = self.mock_auth_success("Technician")

        response = client.get("/api/admin/reports/appointments.csv", headers=technician_headers)
        assert response.status_code == 403
        data = json.loads(response.data)
        assert data["error_code"] == "RBAC_FORBIDDEN"

    # Rate Limiting Tests

    @patch("local_server.require_auth_role")
    @patch("local_server.rate_limit")
    def test_appointments_export_rate_limit_enforced(
        self, mock_rate_limit, mock_auth, client, owner_headers
    ):
        """Test that rate limiting is enforced for appointments export"""
        mock_auth.return_value = self.mock_auth_success("Owner")
        mock_rate_limit.side_effect = Exception("Rate limit exceeded")

        response = client.get("/api/admin/reports/appointments.csv", headers=owner_headers)
        assert response.status_code == 429

        # Verify rate_limit was called with correct parameters
        mock_rate_limit.assert_called_once_with("csv_export_test_user_123", 5, 3600)

    @patch("local_server.require_auth_role")
    @patch("local_server.rate_limit")
    def test_payments_export_rate_limit_enforced(
        self, mock_rate_limit, mock_auth, client, owner_headers
    ):
        """Test that rate limiting is enforced for payments export"""
        mock_auth.return_value = self.mock_auth_success("Owner")
        mock_rate_limit.side_effect = Exception("Rate limit exceeded")

        response = client.get("/api/admin/reports/payments.csv", headers=owner_headers)
        assert response.status_code == 429

    # Query Parameter Validation Tests

    @patch("local_server.require_auth_role")
    def test_appointments_export_invalid_date_format(self, mock_auth, client, owner_headers):
        """Test that invalid date format returns 400 error"""
        mock_auth.return_value = self.mock_auth_success("Owner")

        response = client.get(
            "/api/admin/reports/appointments.csv?from=invalid-date", headers=owner_headers
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error_code"] == "INVALID_DATE_FORMAT"

    @patch("local_server.require_auth_role")
    def test_appointments_export_invalid_status(self, mock_auth, client, owner_headers):
        """Test that invalid status value returns 400 error"""
        mock_auth.return_value = self.mock_auth_success("Owner")

        response = client.get(
            "/api/admin/reports/appointments.csv?status=INVALID_STATUS", headers=owner_headers
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error_code"] == "INVALID_STATUS"

    @patch("local_server.require_auth_role")
    def test_appointments_export_valid_date_range(
        self, mock_auth, client, owner_headers, sample_appointments_data
    ):
        """Test that valid date range parameters work correctly"""
        mock_auth.return_value = self.mock_auth_success("Owner")

        with patch("local_server.db_conn") as mock_db_conn, patch("local_server.rate_limit"):
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = sample_appointments_data
            mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
            mock_db_conn.return_value = mock_conn

            response = client.get(
                "/api/admin/reports/appointments.csv?from=2024-01-01&to=2024-01-31",
                headers=owner_headers,
            )
            assert response.status_code == 200

            # Verify SQL query includes date filters
            call_args = mock_cursor.execute.call_args[0]
            assert "a.start_ts >= %s" in call_args[0]
            assert "a.end_ts <= %s" in call_args[0]

    # CSV Format Validation Tests

    @patch("local_server.require_auth_role")
    def test_appointments_csv_header_format(
        self, mock_auth, client, owner_headers, sample_appointments_data
    ):
        """Test that appointments CSV has correct header format"""
        mock_auth.return_value = self.mock_auth_success("Owner")

        with patch("local_server.db_conn") as mock_db_conn, patch("local_server.rate_limit"):
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = sample_appointments_data
            mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
            mock_db_conn.return_value = mock_conn

            response = client.get("/api/admin/reports/appointments.csv", headers=owner_headers)
            assert response.status_code == 200

            # Parse CSV and check header
            csv_content = response.data.decode("utf-8")
            csv_reader = csv.reader(io.StringIO(csv_content))
            header = next(csv_reader)

            expected_header = [
                "ID",
                "Status",
                "Start",
                "End",
                "Total Amount",
                "Paid Amount",
                "Customer Name",
                "Customer Email",
                "Customer Phone",
                "Vehicle Year",
                "Vehicle Make",
                "Vehicle Model",
                "Vehicle VIN",
                "Services",
            ]
            assert header == expected_header

    @patch("local_server.require_auth_role")
    def test_payments_csv_header_format(
        self, mock_auth, client, owner_headers, sample_payments_data
    ):
        """Test that payments CSV has correct header format"""
        mock_auth.return_value = self.mock_auth_success("Owner")

        with patch("local_server.db_conn") as mock_db_conn, patch("local_server.rate_limit"):
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = sample_payments_data
            mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
            mock_db_conn.return_value = mock_conn

            response = client.get("/api/admin/reports/payments.csv", headers=owner_headers)
            assert response.status_code == 200

            # Parse CSV and check header
            csv_content = response.data.decode("utf-8")
            csv_reader = csv.reader(io.StringIO(csv_content))
            header = next(csv_reader)

            expected_header = [
                "ID",
                "Appointment ID",
                "Amount",
                "Payment Method",
                "Transaction ID",
                "Payment Date",
                "Status",
            ]
            assert header == expected_header

    @patch("local_server.require_auth_role")
    def test_appointments_csv_data_format(
        self, mock_auth, client, owner_headers, sample_appointments_data
    ):
        """Test that appointments CSV data is correctly formatted"""
        mock_auth.return_value = self.mock_auth_success("Owner")

        with patch("local_server.db_conn") as mock_db_conn, patch("local_server.rate_limit"):
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = sample_appointments_data
            mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
            mock_db_conn.return_value = mock_conn

            response = client.get("/api/admin/reports/appointments.csv", headers=owner_headers)
            assert response.status_code == 200

            # Parse CSV and check data format
            csv_content = response.data.decode("utf-8")
            csv_reader = csv.reader(io.StringIO(csv_content))
            next(csv_reader)  # Skip header

            first_row = next(csv_reader)
            assert first_row[0] == "123"  # ID
            assert first_row[1] == "COMPLETED"  # Status
            assert first_row[4] == "150.0"  # Total Amount
            assert first_row[6] == "John Doe"  # Customer Name
            assert first_row[9] == "2020"  # Vehicle Year

    # Empty Dataset Tests

    @patch("local_server.require_auth_role")
    def test_appointments_export_empty_dataset(self, mock_auth, client, owner_headers):
        """Test that empty dataset returns 200 with empty CSV"""
        mock_auth.return_value = self.mock_auth_success("Owner")

        with patch("local_server.db_conn") as mock_db_conn, patch("local_server.rate_limit"):
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = []
            mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
            mock_db_conn.return_value = mock_conn

            response = client.get("/api/admin/reports/appointments.csv", headers=owner_headers)
            assert response.status_code == 200

            # Should still have header row
            csv_content = response.data.decode("utf-8")
            lines = csv_content.strip().split("\n")
            assert len(lines) == 1  # Only header

            csv_reader = csv.reader(io.StringIO(csv_content))
            header = next(csv_reader)
            assert len(header) == 14  # Expected number of columns

    @patch("local_server.require_auth_role")
    def test_payments_export_empty_dataset(self, mock_auth, client, owner_headers):
        """Test that empty payments dataset returns 200 with empty CSV"""
        mock_auth.return_value = self.mock_auth_success("Owner")

        with patch("local_server.db_conn") as mock_db_conn, patch("local_server.rate_limit"):
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = []
            mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
            mock_db_conn.return_value = mock_conn

            response = client.get("/api/admin/reports/payments.csv", headers=owner_headers)
            assert response.status_code == 200

            # Should still have header row
            csv_content = response.data.decode("utf-8")
            lines = csv_content.strip().split("\n")
            assert len(lines) == 1  # Only header

    # Content-Disposition Header Tests

    @patch("local_server.require_auth_role")
    def test_appointments_export_content_disposition(
        self, mock_auth, client, owner_headers, sample_appointments_data
    ):
        """Test that appointments export has correct Content-Disposition header"""
        mock_auth.return_value = self.mock_auth_success("Owner")

        with patch("local_server.db_conn") as mock_db_conn, patch("local_server.rate_limit"):
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = sample_appointments_data
            mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
            mock_db_conn.return_value = mock_conn

            response = client.get("/api/admin/reports/appointments.csv", headers=owner_headers)
            assert response.status_code == 200
            assert "Content-Disposition" in response.headers
            assert "attachment" in response.headers["Content-Disposition"]
            assert "appointments_export.csv" in response.headers["Content-Disposition"]

    @patch("local_server.require_auth_role")
    def test_payments_export_content_disposition(
        self, mock_auth, client, owner_headers, sample_payments_data
    ):
        """Test that payments export has correct Content-Disposition header"""
        mock_auth.return_value = self.mock_auth_success("Owner")

        with patch("local_server.db_conn") as mock_db_conn, patch("local_server.rate_limit"):
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = sample_payments_data
            mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
            mock_db_conn.return_value = mock_conn

            response = client.get("/api/admin/reports/payments.csv", headers=owner_headers)
            assert response.status_code == 200
            assert "Content-Disposition" in response.headers
            assert "attachment" in response.headers["Content-Disposition"]
            assert "payments_export.csv" in response.headers["Content-Disposition"]

    # Database Error Handling Tests

    @patch("local_server.require_auth_role")
    def test_appointments_export_db_unavailable(self, mock_auth, client, owner_headers):
        """Test handling when database is unavailable"""
        mock_auth.return_value = self.mock_auth_success("Owner")

        with patch("local_server.db_conn") as mock_db_conn, patch("local_server.rate_limit"):
            mock_db_conn.return_value = None

            response = client.get("/api/admin/reports/appointments.csv", headers=owner_headers)
            assert response.status_code == 503
            data = json.loads(response.data)
            assert data["error_code"] == "DB_UNAVAILABLE"

    @patch("local_server.require_auth_role")
    def test_payments_export_db_unavailable(self, mock_auth, client, owner_headers):
        """Test handling when database is unavailable for payments"""
        mock_auth.return_value = self.mock_auth_success("Owner")

        with patch("local_server.db_conn") as mock_db_conn, patch("local_server.rate_limit"):
            mock_db_conn.return_value = None

            response = client.get("/api/admin/reports/payments.csv", headers=owner_headers)
            assert response.status_code == 503
            data = json.loads(response.data)
            assert data["error_code"] == "DB_UNAVAILABLE"

    # Audit Logging Tests

    @patch("local_server.require_auth_role")
    @patch("local_server.audit_log")
    def test_appointments_export_audit_logging(
        self, mock_audit_log, mock_auth, client, owner_headers, sample_appointments_data
    ):
        """Test that appointments export is properly audit logged"""
        mock_auth.return_value = self.mock_auth_success("Owner")

        with patch("local_server.db_conn") as mock_db_conn, patch("local_server.rate_limit"):
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = sample_appointments_data
            mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
            mock_db_conn.return_value = mock_conn

            response = client.get("/api/admin/reports/appointments.csv", headers=owner_headers)
            assert response.status_code == 200

            # Verify audit log was called
            mock_audit_log.assert_called_once()
            audit_call_args = mock_audit_log.call_args[0]
            assert audit_call_args[0] == "test_user_123"  # user_id
            assert audit_call_args[1] == "CSV_EXPORT"  # action
            assert "appointments" in audit_call_args[2]  # details

    @patch("local_server.require_auth_role")
    @patch("local_server.audit_log")
    def test_payments_export_audit_logging(
        self, mock_audit_log, mock_auth, client, owner_headers, sample_payments_data
    ):
        """Test that payments export is properly audit logged"""
        mock_auth.return_value = self.mock_auth_success("Owner")

        with patch("local_server.db_conn") as mock_db_conn, patch("local_server.rate_limit"):
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = sample_payments_data
            mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
            mock_db_conn.return_value = mock_conn

            response = client.get("/api/admin/reports/payments.csv", headers=owner_headers)
            assert response.status_code == 200

            # Verify audit log was called
            mock_audit_log.assert_called_once()
            audit_call_args = mock_audit_log.call_args[0]
            assert audit_call_args[0] == "test_user_123"  # user_id
            assert audit_call_args[1] == "CSV_EXPORT"  # action
            assert "payments" in audit_call_args[2]  # details

    # RFC4180 Compliance Tests

    @patch("local_server.require_auth_role")
    def test_csv_rfc4180_compliance(self, mock_auth, client, owner_headers):
        """Test that CSV output is RFC4180 compliant"""
        mock_auth.return_value = self.mock_auth_success("Owner")

        # Create test data with special characters that need escaping
        test_data = [
            {
                "id": "123",
                "status": "COMPLETED",
                "start_ts": datetime(2024, 1, 15, 10, 0, 0),
                "end_ts": datetime(2024, 1, 15, 12, 0, 0),
                "total_amount": 150.00,
                "paid_amount": 150.00,
                "customer_name": 'Doe, John "Johnny"',  # Contains comma and quotes
                "customer_email": "john@example.com",
                "customer_phone": "(555) 123-4567",
                "year": 2020,
                "make": "Toyota",
                "model": "Camry",
                "vin": "1HGBH41JXMN109186",
                "services_summary": 'Oil Change, "Premium" Service',  # Contains comma and quotes
            }
        ]

        with patch("local_server.db_conn") as mock_db_conn, patch("local_server.rate_limit"):
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = test_data
            mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
            mock_db_conn.return_value = mock_conn

            response = client.get("/api/admin/reports/appointments.csv", headers=owner_headers)
            assert response.status_code == 200

            # Parse CSV and verify proper escaping
            csv_content = response.data.decode("utf-8")
            csv_reader = csv.reader(io.StringIO(csv_content))
            next(csv_reader)  # Skip header

            first_row = next(csv_reader)
            assert (
                first_row[6] == 'Doe, John "Johnny"'
            )  # Should be properly unescaped by csv.reader
            assert first_row[13] == 'Oil Change, "Premium" Service'  # Should be properly unescaped


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
