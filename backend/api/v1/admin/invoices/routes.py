"""
Admin Invoices Blueprint - Invoice Management Endpoints
Extracted from monolith with preserved response shapes and headers
"""

from http import HTTPStatus

from flask import Blueprint, current_app, g, jsonify, request

from backend.domain.invoices.errors import InvoiceNotFoundError, InvoiceValidationError

from .schemas import InvoiceIn, ListQuery

bp = Blueprint("admin_invoices", __name__, url_prefix="/api/admin/invoices")


@bp.route("", methods=["GET"])
def list_invoices():
    """List invoices with optional filters and pagination"""
    try:
        # Parse query parameters
        query = ListQuery(
            page=int(request.args.get("page", 1)),
            page_size=int(request.args.get("pageSize", 20)),
            customer_id=request.args.get("customerId"),
            status=request.args.get("status"),
            search=request.args.get("search"),
        )

        # Get service from DI
        invoice_service = current_app.config["deps"]["invoice_service"]

        # Delegate to service
        result = invoice_service.list(query)

        return jsonify(
            {
                "ok": True,
                "data": result,
                "error": None,
                "correlation_id": g.get("correlation_id", "unknown"),
            }
        )

    except Exception as e:
        return (
            jsonify(
                {
                    "ok": False,
                    "data": None,
                    "error": {"code": "internal_error", "message": str(e)},
                    "correlation_id": g.get("correlation_id", "unknown"),
                }
            ),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@bp.route("", methods=["POST"])
def create_invoice():
    """Create new invoice from appointment and service items"""
    try:
        # Parse request body
        data = InvoiceIn(**request.json)

        # Get service from DI
        invoice_service = current_app.config["deps"]["invoice_service"]

        # Delegate to service
        result = invoice_service.create(data.dict())

        return (
            jsonify(
                {
                    "ok": True,
                    "data": result,
                    "error": None,
                    "correlation_id": g.get("correlation_id", "unknown"),
                }
            ),
            HTTPStatus.CREATED,
        )

    except InvoiceValidationError as e:
        return (
            jsonify(
                {
                    "ok": False,
                    "data": None,
                    "error": {"code": e.code, "message": e.message},
                    "correlation_id": g.get("correlation_id", "unknown"),
                }
            ),
            HTTPStatus.BAD_REQUEST,
        )
    except Exception as e:
        return (
            jsonify(
                {
                    "ok": False,
                    "data": None,
                    "error": {"code": "internal_error", "message": str(e)},
                    "correlation_id": g.get("correlation_id", "unknown"),
                }
            ),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@bp.route("/<invoice_id>", methods=["GET"])
def get_invoice(invoice_id: str):
    """Get invoice details with line items"""
    try:
        # Get service from DI
        invoice_service = current_app.config["deps"]["invoice_service"]

        # Delegate to service
        result = invoice_service.get(invoice_id)

        return jsonify(
            {
                "ok": True,
                "data": result,
                "error": None,
                "correlation_id": g.get("correlation_id", "unknown"),
            }
        )

    except InvoiceNotFoundError as e:
        return (
            jsonify(
                {
                    "ok": False,
                    "data": None,
                    "error": {"code": e.code, "message": e.message},
                    "correlation_id": g.get("correlation_id", "unknown"),
                }
            ),
            HTTPStatus.NOT_FOUND,
        )
    except Exception as e:
        return (
            jsonify(
                {
                    "ok": False,
                    "data": None,
                    "error": {"code": "internal_error", "message": str(e)},
                    "correlation_id": g.get("correlation_id", "unknown"),
                }
            ),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@bp.route("/<invoice_id>", methods=["PATCH"])
def patch_invoice(invoice_id: str):
    """Update invoice (status, notes)"""
    try:
        # Parse request body
        data = request.json or {}

        # Get service from DI
        invoice_service = current_app.config["deps"]["invoice_service"]

        # Delegate to service
        result = invoice_service.patch(invoice_id, data)

        return jsonify(
            {
                "ok": True,
                "data": result,
                "error": None,
                "correlation_id": g.get("correlation_id", "unknown"),
            }
        )

    except InvoiceNotFoundError as e:
        return (
            jsonify(
                {
                    "ok": False,
                    "data": None,
                    "error": {"code": e.code, "message": e.message},
                    "correlation_id": g.get("correlation_id", "unknown"),
                }
            ),
            HTTPStatus.NOT_FOUND,
        )
    except InvoiceValidationError as e:
        return (
            jsonify(
                {
                    "ok": False,
                    "data": None,
                    "error": {"code": e.code, "message": e.message},
                    "correlation_id": g.get("correlation_id", "unknown"),
                }
            ),
            HTTPStatus.BAD_REQUEST,
        )
    except Exception as e:
        return (
            jsonify(
                {
                    "ok": False,
                    "data": None,
                    "error": {"code": "internal_error", "message": str(e)},
                    "correlation_id": g.get("correlation_id", "unknown"),
                }
            ),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


# TODO: Future endpoints for PDF/email (out of scope for this PR)
# @bp.route('/<invoice_id>/pdf', methods=['GET'])
# def get_invoice_pdf(invoice_id: str):
#     """TODO: Generate PDF for invoice"""
#     pass

# @bp.route('/<invoice_id>/email', methods=['POST'])
# def send_invoice_email(invoice_id: str):
#     """TODO: Send invoice via email"""
#     pass
