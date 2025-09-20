"""
Appointments business logic layer
Handles validation and business rules for appointment operations
"""

from datetime import date, datetime
from typing import Any, Dict, Optional

from backend.domain.appointments.repository import AppointmentRepository
from backend.domain.services.service import ServiceService


class VersionConflict(Exception):
    """Raised when optimistic concurrency check fails"""

    pass


class InvalidTransition(Exception):
    """Raised when status transition is not allowed"""

    pass


class AppointmentService:
    """Appointment business logic using AppointmentRepository"""

    def __init__(self, db):
        self.db = db
        self.repo = AppointmentRepository(db)
        self.service_service = ServiceService(db)

    def list_appointments(
        self,
        page: int = 1,
        page_size: int = 50,
        customer_id: Optional[str] = None,
        vehicle_id: Optional[str] = None,
        status: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """List appointments with pagination and filtering"""
        items, total = self.repo.list(
            page=page,
            page_size=page_size,
            customer_id=customer_id,
            vehicle_id=vehicle_id,
            status=status,
            from_date=from_date,
            to_date=to_date,
        )

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size,
        }

    def create_appointment(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new appointment with validation"""
        # Business rule: appointment must be in the future
        appt_start = datetime.fromisoformat(data["appt_start"].replace("Z", "+00:00"))
        if appt_start <= datetime.now(appt_start.tzinfo):
            raise ValueError("Appointment must be scheduled in the future")

        # Business rule: end time must be after start time
        appt_end = datetime.fromisoformat(data["appt_end"].replace("Z", "+00:00"))
        if appt_end <= appt_start:
            raise ValueError("Appointment end time must be after start time")

        # Business rule: must have at least one service
        service_codes = data.get("service_codes", [])
        if not service_codes:
            raise ValueError("Appointment must include at least one service")

        # Validate services exist and get service details
        services = self.service_service.get_services_by_codes(service_codes)

        # TODO: Business rule - check for scheduling conflicts (future enhancement)
        # TODO: Business rule - validate customer/vehicle exist (future enhancement)

        return self.repo.create(data, services)

    def get_appointment(self, appointment_id: str) -> Optional[Dict[str, Any]]:
        """Get appointment by ID with services"""
        return self.repo.get(appointment_id)

    def update_appointment(
        self, appointment_id: str, data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update appointment with validation"""
        # Check if appointment exists
        existing = self.repo.get(appointment_id)
        if not existing:
            return None

        # Business rule: validate time changes
        if "appt_start" in data:
            appt_start = datetime.fromisoformat(data["appt_start"].replace("Z", "+00:00"))
            if appt_start <= datetime.now(appt_start.tzinfo):
                raise ValueError("Appointment must be scheduled in the future")

        if "appt_end" in data:
            appt_end = datetime.fromisoformat(data["appt_end"].replace("Z", "+00:00"))
            # Check against new start time or existing start time
            compare_start = data.get("appt_start", existing["appt_start"])
            if isinstance(compare_start, str):
                compare_start = datetime.fromisoformat(compare_start.replace("Z", "+00:00"))
            if appt_end <= compare_start:
                raise ValueError("Appointment end time must be after start time")

        # Business rule: validate status transitions
        if "status" in data:
            valid_statuses = [
                "SCHEDULED",
                "CONFIRMED",
                "IN_PROGRESS",
                "COMPLETED",
                "CANCELLED",
                "NO_SHOW",
            ]
            if data["status"] not in valid_statuses:
                raise ValueError(f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

        return self.repo.patch(appointment_id, data)

    def get_board(self, target_date: str) -> Dict[str, Any]:
        """Get status board for a specific date"""
        board = self.repo.list_board(target_date)

        # Add stats for dashboard
        stats = {
            "total_appointments": sum(len(appointments) for appointments in board.values()),
            "scheduled": len(board["scheduled"]),
            "in_progress": len(board["in_progress"]),
            "ready": len(board["ready"]),
            "completed": len(board["completed"]),
            "no_show": len(board["no_show"]),
        }

        return {"date": target_date, "board": board, "stats": stats}

    def move_appointment(
        self,
        appointment_id: str,
        new_status: str,
        new_position: int,
        current_version: int,
        **kwargs,
    ) -> Dict[str, Any]:
        """Move appointment with business rule validation"""

        # Validate status transition
        valid_statuses = ["scheduled", "in_progress", "ready", "completed", "no_show"]
        if new_status not in valid_statuses:
            raise ValueError(
                f"Invalid status '{new_status}'. Must be one of: {', '.join(valid_statuses)}"
            )

        # Get current appointment for transition validation
        current = self.repo.get(appointment_id)
        if not current:
            raise ValueError(f"Appointment {appointment_id} not found")

        current_status = current.get("status", "scheduled")

        # Define valid transitions
        valid_transitions = {
            "scheduled": ["in_progress", "no_show"],
            "in_progress": ["ready", "completed", "scheduled"],  # Allow moving back if needed
            "ready": ["completed", "in_progress"],
            "completed": [],  # Final state - no transitions allowed
            "no_show": ["scheduled"],  # Allow rescheduling
        }

        if new_status not in valid_transitions.get(current_status, []):
            raise InvalidTransition(f"Invalid transition from '{current_status}' to '{new_status}'")

        # Handle automatic timestamps based on status
        if new_status == "in_progress" and "check_in_at" not in kwargs:
            kwargs["check_in_at"] = datetime.now().isoformat()
        elif new_status == "completed" and "check_out_at" not in kwargs:
            kwargs["check_out_at"] = datetime.now().isoformat()

        # Attempt the move with optimistic concurrency control
        result = self.repo.move(appointment_id, new_status, new_position, current_version, **kwargs)

        if result is None:
            raise VersionConflict(
                f"stale version {current_version} (current={current.get('version', 0)})"
            )

        return result

    def get_dashboard_stats(self, target_date: str = None) -> Dict[str, Any]:
        """Get dashboard statistics for a specific date"""
        if not target_date:
            target_date = date.today().isoformat()

        board = self.repo.list_board(target_date)

        # Calculate KPIs
        jobs_today = sum(len(appointments) for appointments in board.values())
        on_prem = len(board["in_progress"]) + len(board["ready"])

        status_counts = {
            "scheduled": len(board["scheduled"]),
            "in_progress": len(board["in_progress"]),
            "ready": len(board["ready"]),
            "completed": len(board["completed"]),
            "no_show": len(board["no_show"]),
        }

        # Calculate unpaid total (total_amount - paid_amount for incomplete appointments)
        unpaid_total = 0.0
        for status, appointments in board.items():
            if status not in ["completed", "no_show"]:  # Only count active appointments
                for appt in appointments:
                    total = float(appt.get("total_amount", 0) or 0)
                    paid = float(appt.get("paid_amount", 0) or 0)
                    unpaid_total += max(0, total - paid)

        return {
            "jobsToday": jobs_today,
            "onPrem": on_prem,
            "statusCounts": status_counts,
            "unpaidTotal": round(unpaid_total, 2),
        }
