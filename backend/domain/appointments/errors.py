# backend/domain/appointments/errors.py
class AppointmentError(Exception):
    """Base exception for appointment domain"""

    pass


class AppointmentNotFound(AppointmentError):
    """Appointment not found"""

    pass


class InvalidAppointmentStatus(AppointmentError):
    """Invalid status transition"""

    pass


class AppointmentConflict(AppointmentError):
    """Scheduling conflict"""

    pass
