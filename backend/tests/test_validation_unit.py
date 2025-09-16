"""
import pytest

Comprehensive unit tests for validation.py module
Priority target for rapid coverage improvement - contains pure functions
with clear input/output patterns that don't require database connections.
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, MagicMock

# Import the validation module and its components
from validation import (
    ValidationError,
    ValidationResult,
    VALID_STATUSES,
    ALLOWED_TRANSITIONS,
    DEFAULT_BLOCK_HOURS,
    MAX_DURATION_HOURS,
    PAST_GRACE_MINUTES,
    _parse_dt,
    validate_appointment_payload,
    find_conflicts,
)


@pytest.mark.unit
@pytest.mark.integration
class TestValidationError:
    """Test ValidationError dataclass"""

    @pytest.mark.integration
    def test_validation_error_creation(self):
        """Test basic ValidationError creation"""
        error = ValidationError(code="TEST_ERROR", detail="Test message")
        assert error.code == "TEST_ERROR"
        assert error.detail == "Test message"
        assert error.field is None
        assert error.status == 400
        assert error.extra == {}

    @pytest.mark.integration
    def test_validation_error_with_all_fields(self):
        """Test ValidationError with all fields populated"""
        extra_data = {"context": "test"}
        error = ValidationError(
            code="CUSTOM_ERROR",
            detail="Custom message",
            field="test_field",
            status=422,
            extra=extra_data,
        )
        assert error.code == "CUSTOM_ERROR"
        assert error.detail == "Custom message"
        assert error.field == "test_field"
        assert error.status == 422
        assert error.extra == extra_data


@pytest.mark.unit
@pytest.mark.integration
class TestValidationResult:
    """Test ValidationResult dataclass"""

    @pytest.mark.integration
    def test_validation_result_creation(self):
        """Test basic ValidationResult creation"""
        cleaned_data = {"field1": "value1"}
        result = ValidationResult(cleaned=cleaned_data)
        assert result.cleaned == cleaned_data
        assert result.errors == []

    @pytest.mark.integration
    def test_validation_result_with_errors(self):
        """Test ValidationResult with errors"""
        cleaned_data = {"field1": "value1"}
        errors = [ValidationError(code="ERROR1", detail="Error 1")]
        result = ValidationResult(cleaned=cleaned_data, errors=errors)
        assert result.cleaned == cleaned_data
        assert len(result.errors) == 1
        assert result.errors[0].code == "ERROR1"


@pytest.mark.unit
@pytest.mark.integration
class TestParseDt:
    """Test _parse_dt function"""

    @pytest.mark.integration
    def test_parse_dt_none_input(self):
        """Test _parse_dt with None input"""
        assert _parse_dt(None) is None
        assert _parse_dt("") is None
        assert _parse_dt(0) is None

    @pytest.mark.integration
    def test_parse_dt_datetime_input(self):
        """Test _parse_dt with datetime object"""
        dt = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        result = _parse_dt(dt)
        assert result == dt

    @pytest.mark.integration
    def test_parse_dt_iso_string_with_z(self):
        """Test _parse_dt with ISO string ending in Z"""
        iso_string = "2024-01-15T10:30:00Z"
        result = _parse_dt(iso_string)
        expected = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        assert result == expected

    @pytest.mark.integration
    def test_parse_dt_iso_string_with_offset(self):
        """Test _parse_dt with ISO string with timezone offset"""
        iso_string = "2024-01-15T10:30:00-05:00"
        result = _parse_dt(iso_string)
        assert result is not None
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 15

    @pytest.mark.integration
    def test_parse_dt_iso_string_without_timezone(self):
        """Test _parse_dt with ISO string without timezone"""
        iso_string = "2024-01-15T10:30:00"
        result = _parse_dt(iso_string)
        assert result is not None
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 15

    @pytest.mark.integration
    def test_parse_dt_invalid_iso_string(self):
        """Test _parse_dt with invalid ISO string"""
        invalid_strings = [
            "2024-01-15",  # No time component
            "not-a-date",
            "2024-13-45T25:70:70Z",  # Invalid date/time values
            "2024-01-15X10:30:00Z",  # Invalid separator
        ]
        for invalid in invalid_strings:
            assert _parse_dt(invalid) is None

    @pytest.mark.integration
    def test_parse_dt_non_iso_string(self):
        """Test _parse_dt with non-ISO formatted string"""
        assert _parse_dt("January 15, 2024") is None
        assert _parse_dt("15/01/2024") is None


@pytest.mark.unit
@pytest.mark.integration
class TestValidateAppointmentPayload:
    """Test validate_appointment_payload function"""

    @pytest.mark.integration
    def test_validate_empty_payload(self):
        """Test validation with empty payload"""
        result = validate_appointment_payload({})
        assert result.cleaned["status"] == "SCHEDULED"
        assert len(result.errors) == 0

    @pytest.mark.integration
    def test_validate_valid_status(self):
        """Test validation with valid status"""
        for status in VALID_STATUSES:
            payload = {"status": status}
            result = validate_appointment_payload(payload)
            assert result.cleaned["status"] == status
            assert len(result.errors) == 0

    @pytest.mark.integration
    def test_validate_invalid_status(self):
        """Test validation with invalid status"""
        payload = {"status": "INVALID_STATUS"}
        result = validate_appointment_payload(payload)
        assert len(result.errors) == 1
        assert result.errors[0].code == "VALIDATION_FAILED"
        assert result.errors[0].field == "status"

    @pytest.mark.integration
    def test_validate_lowercase_status(self):
        """Test validation converts lowercase status to uppercase"""
        payload = {"status": "scheduled"}
        result = validate_appointment_payload(payload)
        assert result.cleaned["status"] == "SCHEDULED"
        assert len(result.errors) == 0

    @pytest.mark.integration
    def test_validate_start_ts_future(self):
        """Test validation with future start_ts"""
        future_time = datetime.now(timezone.utc) + timedelta(hours=1)
        payload = {"start_ts": future_time.isoformat()}
        result = validate_appointment_payload(payload)
        assert "start_ts" in result.cleaned
        assert len(result.errors) == 0

    @pytest.mark.integration
    def test_validate_start_ts_past_within_grace(self):
        """Test validation with past start_ts within grace period"""
        past_time = datetime.now(timezone.utc) - timedelta(minutes=10)  # Within 15-minute grace
        payload = {"start_ts": past_time.isoformat()}
        result = validate_appointment_payload(payload)
        assert "start_ts" in result.cleaned
        assert len(result.errors) == 0

    @pytest.mark.integration
    def test_validate_start_ts_past_beyond_grace(self):
        """Test validation with past start_ts beyond grace period"""
        past_time = datetime.now(timezone.utc) - timedelta(minutes=20)  # Beyond 15-minute grace
        payload = {"start_ts": past_time.isoformat()}
        result = validate_appointment_payload(payload)
        assert len(result.errors) == 1
        assert result.errors[0].field == "start_ts"
        assert "too far in past" in result.errors[0].detail

    @pytest.mark.integration
    def test_validate_end_ts_before_start_ts(self):
        """Test validation with end_ts before start_ts"""
        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        end_time = start_time - timedelta(minutes=30)
        payload = {"start_ts": start_time.isoformat(), "end_ts": end_time.isoformat()}
        result = validate_appointment_payload(payload)
        assert len(result.errors) == 1
        assert result.errors[0].field == "end_ts"
        assert "before start_ts" in result.errors[0].detail

    @pytest.mark.integration
    def test_validate_duration_exceeds_maximum(self):
        """Test validation with duration exceeding maximum"""
        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        end_time = start_time + timedelta(hours=MAX_DURATION_HOURS + 1)
        payload = {"start_ts": start_time.isoformat(), "end_ts": end_time.isoformat()}
        result = validate_appointment_payload(payload)
        assert len(result.errors) == 1
        assert result.errors[0].field == "end_ts"
        assert "exceeds maximum" in result.errors[0].detail

    @pytest.mark.integration
    def test_validate_valid_duration(self):
        """Test validation with valid duration"""
        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        end_time = start_time + timedelta(hours=2)  # Valid 2-hour duration
        payload = {"start_ts": start_time.isoformat(), "end_ts": end_time.isoformat()}
        result = validate_appointment_payload(payload)
        assert "start_ts" in result.cleaned
        assert "end_ts" in result.cleaned
        assert len(result.errors) == 0

    @pytest.mark.integration
    def test_validate_valid_total_amount(self):
        """Test validation with valid total_amount"""
        test_cases = [0, 0.0, 100, 100.50, 999.99]
        for amount in test_cases:
            payload = {"total_amount": amount}
            result = validate_appointment_payload(payload)
            assert result.cleaned["total_amount"] == float(amount)
            assert len(result.errors) == 0

    @pytest.mark.integration
    def test_validate_invalid_total_amount(self):
        """Test validation with invalid total_amount"""
        test_cases = [-1, -100.50, "invalid", None]
        for amount in test_cases:
            payload = {"total_amount": amount}
            result = validate_appointment_payload(payload)
            if amount is None:
                # None is allowed (not included in cleaned data)
                assert "total_amount" not in result.cleaned
                assert len(result.errors) == 0
            else:
                assert len(result.errors) == 1
                assert result.errors[0].field == "total_amount"

    @pytest.mark.integration
    def test_validate_valid_paid_amount(self):
        """Test validation with valid paid_amount"""
        test_cases = [0, 0.0, 50, 50.25, 100]
        for amount in test_cases:
            payload = {"paid_amount": amount}
            result = validate_appointment_payload(payload)
            assert result.cleaned["paid_amount"] == float(amount)
            assert len(result.errors) == 0

    @pytest.mark.integration
    def test_validate_invalid_paid_amount(self):
        """Test validation with invalid paid_amount"""
        test_cases = [-1, -50.25, "invalid"]
        for amount in test_cases:
            payload = {"paid_amount": amount}
            result = validate_appointment_payload(payload)
            assert len(result.errors) == 1
            assert result.errors[0].field == "paid_amount"

    @pytest.mark.integration
    def test_validate_paid_amount_exceeds_total(self):
        """Test validation when paid_amount exceeds total_amount"""
        payload = {"total_amount": 100.0, "paid_amount": 150.0}
        result = validate_appointment_payload(payload)
        assert len(result.errors) == 1
        assert result.errors[0].field == "paid_amount"
        assert "cannot exceed total_amount" in result.errors[0].detail

    @pytest.mark.integration
    def test_validate_paid_amount_equals_total(self):
        """Test validation when paid_amount equals total_amount"""
        payload = {"total_amount": 100.0, "paid_amount": 100.0}
        result = validate_appointment_payload(payload)
        assert result.cleaned["total_amount"] == 100.0
        assert result.cleaned["paid_amount"] == 100.0
        assert len(result.errors) == 0

    @pytest.mark.integration
    def test_validate_basic_fields_passthrough(self):
        """Test validation passes through basic ID fields"""
        payload = {"customer_id": "cust_123", "vehicle_id": "vehicle_456", "tech_id": "tech_789"}
        result = validate_appointment_payload(payload)
        assert result.cleaned["customer_id"] == "cust_123"
        assert result.cleaned["vehicle_id"] == "vehicle_456"
        assert result.cleaned["tech_id"] == "tech_789"
        assert len(result.errors) == 0

    @pytest.mark.integration
    def test_validate_status_transition_valid(self):
        """Test validation with valid status transitions"""
        existing = {"status": "SCHEDULED"}

        # Test all valid transitions from SCHEDULED
        for new_status in ALLOWED_TRANSITIONS["SCHEDULED"]:
            payload = {"status": new_status}
            result = validate_appointment_payload(payload, mode="update", existing=existing)
            assert result.cleaned["status"] == new_status
            assert len(result.errors) == 0

    @pytest.mark.integration
    def test_validate_status_transition_invalid(self):
        """Test validation with invalid status transitions"""
        existing = {"status": "COMPLETED"}  # COMPLETED allows no transitions
        payload = {"status": "SCHEDULED"}

        result = validate_appointment_payload(payload, mode="update", existing=existing)
        assert len(result.errors) == 1
        assert result.errors[0].code == "INVALID_TRANSITION"
        assert result.errors[0].field == "status"
        assert result.errors[0].status == 409
        assert "COMPLETED -> SCHEDULED" in result.errors[0].detail

    @pytest.mark.integration
    def test_validate_status_no_change(self):
        """Test validation when status doesn't change"""
        existing = {"status": "IN_PROGRESS"}
        payload = {"status": "IN_PROGRESS"}

        result = validate_appointment_payload(payload, mode="update", existing=existing)
        assert result.cleaned["status"] == "IN_PROGRESS"
        assert len(result.errors) == 0

    @pytest.mark.integration
    def test_validate_update_mode_with_existing(self):
        """Test validation in update mode with existing data"""
        existing = {
            "status": "SCHEDULED",
            "total_amount": 100.0,
            "start_ts": datetime.now(timezone.utc) + timedelta(hours=1),
        }
        payload = {"paid_amount": 50.0}

        result = validate_appointment_payload(payload, mode="update", existing=existing)
        assert result.cleaned["status"] == "SCHEDULED"  # From existing
        assert result.cleaned["paid_amount"] == 50.0  # From payload
        assert len(result.errors) == 0

    @pytest.mark.integration
    def test_validate_multiple_errors(self):
        """Test validation accumulates multiple errors"""
        past_time = datetime.now(timezone.utc) - timedelta(hours=1)
        payload = {
            "status": "INVALID_STATUS",
            "start_ts": past_time.isoformat(),
            "total_amount": -100,
            "paid_amount": "invalid",
        }

        result = validate_appointment_payload(payload)
        assert len(result.errors) >= 3  # Should have multiple validation errors
        error_fields = [err.field for err in result.errors]
        assert "status" in error_fields
        assert "start_ts" in error_fields
        assert "total_amount" in error_fields
        assert "paid_amount" in error_fields


@pytest.mark.unit
@pytest.mark.integration
class TestFindConflicts:
    """Test find_conflicts function with mocked database"""

    def create_mock_connection(self, query_results=None):
        """Create a mock database connection"""
        mock_conn = Mock()
        mock_cursor = Mock()
        mock_conn.cursor.return_value = mock_cursor

        if query_results is not None:
            mock_cursor.fetchall.return_value = query_results
        else:
            mock_cursor.fetchall.return_value = []

        return mock_conn, mock_cursor

    @pytest.mark.integration
    def test_find_conflicts_no_conflicts(self):
        """Test find_conflicts when no conflicts exist"""
        mock_conn, mock_cursor = self.create_mock_connection([])

        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        result = find_conflicts(
            mock_conn, tech_id="tech_123", vehicle_id=456, start_ts=start_time, end_ts=None
        )

        assert result["tech"] == []
        assert result["vehicle"] == []
        assert mock_cursor.execute.call_count >= 1  # Should query for conflicts

    @pytest.mark.integration
    def test_find_conflicts_tech_conflict_strict_mode(self):
        """Test find_conflicts with tech conflict in strict mode (no end_ts)"""
        # Mock database returns conflicting appointment ID 999
        mock_conn, mock_cursor = self.create_mock_connection([(999,)])

        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        result = find_conflicts(
            mock_conn,
            tech_id="tech_123",
            vehicle_id=None,
            start_ts=start_time,
            end_ts=None,  # Triggers strict mode
        )

        assert result["tech"] == [999]
        assert result["vehicle"] == []

        # Verify SQL query was for exact timestamp match in strict mode
        call_args = mock_cursor.execute.call_args_list[0]
        sql_query = call_args[0][0]
        assert "a.start_ts = %s" in sql_query  # Should use exact match

    @pytest.mark.integration
    def test_find_conflicts_vehicle_conflict_strict_mode(self):
        """Test find_conflicts with vehicle conflict in strict mode"""
        mock_conn, mock_cursor = self.create_mock_connection([(888,)])

        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        result = find_conflicts(
            mock_conn, tech_id=None, vehicle_id=456, start_ts=start_time, end_ts=None
        )

        assert result["tech"] == []
        assert result["vehicle"] == [888]

    @pytest.mark.integration
    def test_find_conflicts_overlap_mode_with_end_ts(self):
        """Test find_conflicts with overlap detection when end_ts provided"""
        mock_conn, mock_cursor = self.create_mock_connection([(777,)])

        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        end_time = start_time + timedelta(hours=2)

        result = find_conflicts(
            mock_conn,
            tech_id="tech_123",
            vehicle_id=None,
            start_ts=start_time,
            end_ts=end_time,  # Triggers overlap mode
        )

        assert result["tech"] == [777]

        # Verify SQL query uses overlap logic, not exact match
        call_args = mock_cursor.execute.call_args_list[0]
        sql_query = call_args[0][0]
        assert "a.start_ts < %s" in sql_query  # Should use overlap detection
        assert "INTERVAL" in sql_query  # Should include interval calculation

    @pytest.mark.integration
    def test_find_conflicts_with_exclude_id(self):
        """Test find_conflicts excludes specific appointment ID"""
        mock_conn, mock_cursor = self.create_mock_connection([])

        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        result = find_conflicts(
            mock_conn,
            tech_id="tech_123",
            vehicle_id=456,
            start_ts=start_time,
            end_ts=None,
            exclude_id=123,  # Should exclude this ID from conflict check
        )

        # Verify exclude clause is in SQL
        call_args = mock_cursor.execute.call_args_list[0]
        sql_query = call_args[0][0]
        assert "a.id <> %s" in sql_query

        # Verify exclude_id is in parameters
        sql_params = call_args[0][1]
        assert 123 in sql_params

    @pytest.mark.integration
    def test_find_conflicts_both_tech_and_vehicle(self):
        """Test find_conflicts checks both tech and vehicle conflicts"""
        # First call returns tech conflict, second call returns vehicle conflict
        mock_conn = Mock()
        mock_cursor = Mock()
        mock_conn.cursor.return_value = mock_cursor

        # Mock two separate database calls with different results
        mock_cursor.fetchall.side_effect = [[(111,)], [(222,)]]

        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        result = find_conflicts(
            mock_conn, tech_id="tech_123", vehicle_id=456, start_ts=start_time, end_ts=None
        )

        assert result["tech"] == [111]
        assert result["vehicle"] == [222]
        assert mock_cursor.execute.call_count == 2  # Should make two queries

    @pytest.mark.integration
    def test_find_conflicts_dict_results(self):
        """Test find_conflicts handles dict-style database results"""
        mock_conn, mock_cursor = self.create_mock_connection([{"id": 555, "other": "data"}])

        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        result = find_conflicts(
            mock_conn, tech_id="tech_123", vehicle_id=None, start_ts=start_time, end_ts=None
        )

        assert result["tech"] == [555]  # Should extract 'id' from dict

    @pytest.mark.integration
    def test_find_conflicts_multiple_conflicts(self):
        """Test find_conflicts handles multiple conflicting appointments"""
        mock_conn, mock_cursor = self.create_mock_connection([(111,), (222,), (333,)])

        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        result = find_conflicts(
            mock_conn, tech_id="tech_123", vehicle_id=None, start_ts=start_time, end_ts=None
        )

        assert result["tech"] == [111, 222, 333]
        assert result["vehicle"] == []


@pytest.mark.unit
@pytest.mark.integration
class TestConstants:
    """Test module constants are properly defined"""

    @pytest.mark.integration
    def test_valid_statuses_constant(self):
        """Test VALID_STATUSES contains expected values"""
        expected_statuses = {
            "SCHEDULED",
            "IN_PROGRESS",
            "READY",
            "COMPLETED",
            "NO_SHOW",
            "CANCELED",
        }
        assert VALID_STATUSES == expected_statuses

    @pytest.mark.integration
    def test_allowed_transitions_constant(self):
        """Test ALLOWED_TRANSITIONS structure"""
        assert isinstance(ALLOWED_TRANSITIONS, dict)

        # Test specific transition rules
        assert "IN_PROGRESS" in ALLOWED_TRANSITIONS["SCHEDULED"]
        assert "COMPLETED" in ALLOWED_TRANSITIONS["READY"]
        assert ALLOWED_TRANSITIONS["COMPLETED"] == set()  # No transitions from COMPLETED
        assert ALLOWED_TRANSITIONS["NO_SHOW"] == set()  # No transitions from NO_SHOW
        assert ALLOWED_TRANSITIONS["CANCELED"] == set()  # No transitions from CANCELED

    @pytest.mark.integration
    def test_time_constants(self):
        """Test time-related constants"""
        assert DEFAULT_BLOCK_HOURS == 2
        assert MAX_DURATION_HOURS == 48
        assert PAST_GRACE_MINUTES == 15

        # Verify these are reasonable values
        assert DEFAULT_BLOCK_HOURS > 0
        assert MAX_DURATION_HOURS > DEFAULT_BLOCK_HOURS
        assert PAST_GRACE_MINUTES > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
