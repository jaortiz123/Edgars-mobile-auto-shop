"""
Input Validation Schemas for Edgar's Auto Shop API
Using Marshmallow for comprehensive request validation.
"""

from datetime import datetime, timedelta

from marshmallow import Schema, ValidationError, fields, pre_load, validate


class BaseSchema(Schema):
    """Base schema with common validation methods."""

    @pre_load
    def strip_strings(self, data, **kwargs):
        """Strip whitespace from all string fields."""
        if isinstance(data, dict):
            return {k: v.strip() if isinstance(v, str) else v for k, v in data.items()}
        return data


class CustomerSchema(BaseSchema):
    """Customer data validation schema."""

    name = fields.Str(
        required=True,
        validate=validate.Length(min=2, max=100),
        error_messages={"required": "Customer name is required"},
    )
    email = fields.Email(required=False, validate=validate.Length(max=255), allow_none=True)
    phone = fields.Str(
        required=True,
        validate=validate.Regexp(
            r"^[\+]?[1-9][\d\-\(\)\s]{7,15}$", error="Invalid phone number format"
        ),
    )
    address = fields.Str(required=False, validate=validate.Length(max=500), allow_none=True)


class VehicleSchema(BaseSchema):
    """Vehicle information validation schema."""

    make = fields.Str(required=True, validate=validate.Length(min=2, max=50))
    model = fields.Str(required=True, validate=validate.Length(min=1, max=50))
    year = fields.Integer(
        required=True, validate=validate.Range(min=1900, max=datetime.now().year + 2)
    )
    vin = fields.Str(
        required=False,
        validate=validate.Regexp(
            r"^[A-HJ-NPR-Z0-9]{17}$", error="VIN must be 17 alphanumeric characters"
        ),
        allow_none=True,
    )
    license_plate = fields.Str(required=False, validate=validate.Length(max=20), allow_none=True)


class AppointmentCreateSchema(BaseSchema):
    """Appointment creation validation schema."""

    customer = fields.Nested(CustomerSchema, required=True)
    vehicle = fields.Nested(VehicleSchema, required=True)

    scheduled_date = fields.DateTime(
        required=True, format="iso", error_messages={"required": "Appointment date is required"}
    )

    service_codes = fields.List(
        fields.Str(validate=validate.Length(min=3, max=20)),
        required=True,
        validate=validate.Length(min=1, max=10),
        error_messages={"required": "At least one service code is required"},
    )

    notes = fields.Str(required=False, validate=validate.Length(max=1000), allow_none=True)

    def validate_scheduled_date(self, value):
        """Validate appointment date is in the future."""
        if value <= datetime.now():
            raise ValidationError("Appointment must be scheduled for a future date")

        # Don't allow appointments more than 6 months out
        if value > datetime.now() + timedelta(days=180):
            raise ValidationError("Appointments cannot be scheduled more than 6 months in advance")


class AppointmentUpdateSchema(BaseSchema):
    """Appointment update validation schema."""

    status = fields.Str(
        required=False,
        validate=validate.OneOf(["scheduled", "in_progress", "ready", "completed", "no_show"]),
    )

    scheduled_date = fields.DateTime(required=False, format="iso")

    tech_id = fields.Integer(required=False, validate=validate.Range(min=1), allow_none=True)

    notes = fields.Str(required=False, validate=validate.Length(max=1000), allow_none=True)

    total_amount = fields.Decimal(
        required=False, validate=validate.Range(min=0, max=50000), allow_none=True
    )


class QuoteRequestSchema(BaseSchema):
    """Quote request validation schema."""

    customer_name = fields.Str(required=True, validate=validate.Length(min=2, max=100))

    phone = fields.Str(
        required=True,
        validate=validate.Regexp(
            r"^[\+]?[1-9][\d\-\(\)\s]{7,15}$", error="Invalid phone number format"
        ),
    )

    vehicle = fields.Nested(VehicleSchema, required=True)

    services_requested = fields.List(
        fields.Str(validate=validate.Length(min=3, max=100)),
        required=True,
        validate=validate.Length(min=1, max=10),
    )

    preferred_date = fields.DateTime(required=False, format="iso", allow_none=True)


class StatusBoardQuerySchema(BaseSchema):
    """Status board query parameters validation."""

    from_date = fields.Date(required=False, format="%Y-%m-%d", allow_none=True)

    to_date = fields.Date(required=False, format="%Y-%m-%d", allow_none=True)

    tech_id = fields.Integer(required=False, validate=validate.Range(min=1), allow_none=True)

    status = fields.Str(
        required=False,
        validate=validate.OneOf(["scheduled", "in_progress", "ready", "completed", "no_show"]),
        allow_none=True,
    )


# Validation decorator for Flask routes
def validate_json(schema_class):
    """Decorator to validate JSON input using Marshmallow schema."""

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Get JSON data
                json_data = request.get_json(force=True)
                if json_data is None:
                    return jsonify({"error": "No JSON data provided"}), 400

                # Validate with schema
                schema = schema_class()
                validated_data = schema.load(json_data)

                # Pass validated data to the route function
                kwargs["validated_data"] = validated_data
                return f(*args, **kwargs)

            except ValidationError as err:
                return jsonify({"error": "Validation failed", "messages": err.messages}), 400
            except Exception:
                return jsonify({"error": "Invalid JSON format"}), 400

        return decorated_function

    return decorator


def validate_query_params(schema_class):
    """Decorator to validate query parameters using Marshmallow schema."""

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Convert query parameters to dict
                query_data = request.args.to_dict()

                # Validate with schema
                schema = schema_class()
                validated_data = schema.load(query_data)

                # Pass validated data to the route function
                kwargs["validated_params"] = validated_data
                return f(*args, **kwargs)

            except ValidationError as err:
                return jsonify({"error": "Invalid query parameters", "messages": err.messages}), 400

        return decorated_function

    return decorator
