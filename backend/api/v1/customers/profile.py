# backend/api/v1/customers/profile.py
from flask import Blueprint, request
from flask import current_app as app

bp = Blueprint("customers_profile", __name__)


@bp.route("/api/customers/profile", methods=["GET", "PUT", "OPTIONS"])  # canonical
@bp.route("/customers/profile", methods=["GET", "PUT", "OPTIONS"])  # legacy alias
def profile():
    # Preserve preflight fast-path
    if request.method == "OPTIONS":
        return ("", 204)

    # Delegate to existing monolith handler to preserve behavior during carve-out
    legacy = app.view_functions.get("legacy_customer_profile")
    if legacy:
        return legacy()

    # Fallback if monolith handler not present (should not occur in dev)
    return {"error": {"code": 501, "message": "Not implemented"}}, 501
