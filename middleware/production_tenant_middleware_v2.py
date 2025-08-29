# production_tenant_middleware_v2.py
# Flask/SQLAlchemy middleware: extracts tenant id and sets it in Postgres for the request.
# Works with psycopg2/psycopg (SQLAlchemy 1.4+/2.x)

import re

from flask import Flask, g, jsonify, request
from sqlalchemy import text

TENANT_HEADER = "X-Tenant-Id"
TENANT_PARAM = "tenant_id"
TENANT_RE = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")  # adjust if UUIDs: r"^[0-9a-f-]{36}$"


def extract_tenant(req: request) -> str | None:
    # 1) Header, 2) query param, 3) subdomain (foo.example.com -> foo)
    tid = req.headers.get(TENANT_HEADER) or req.args.get(TENANT_PARAM)
    if not tid:
        host = req.host.split(":")[0]
        parts = host.split(".")
        if len(parts) > 2:  # subdomain.company.tld
            tid = parts[0]
    if tid and TENANT_RE.match(tid):
        return tid
    return None


def init_tenant_middleware(app: Flask) -> None:
    @app.before_request
    def _inject_tenant_guc():
        tid = extract_tenant(request)
        if not tid:
            # Fail-closed for any admin/data endpoints that require tenant
            # Adjust paths as needed (e.g., allow health)
            if request.path.startswith("/api/admin/"):
                return (
                    jsonify(
                        {"error": {"code": "bad_request", "message": "missing or invalid tenant"}}
                    ),
                    400,
                )
            g.tenant_id = None
            return None
        g.tenant_id = tid
        # SET LOCAL so it applies for the current transaction/connection only
        app.logger.debug("setting app.tenant_id=%s", tid)
        app.db.session.execute(text("select set_config('app.tenant_id', :tid, true)"), {"tid": tid})

    @app.route("/health")
    def health():
        return {"ok": True}

    @app.route("/health/tenant-security")
    def health_tenant_sec():
        # Echo what Postgres sees
        row = app.db.session.execute(
            text("select current_setting('app.tenant_id', true) as tenant")
        )
        return {"tenant": row.scalar_one_or_none()}, 200
