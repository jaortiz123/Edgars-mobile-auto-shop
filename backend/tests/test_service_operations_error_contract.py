import json
from http import HTTPStatus


def assert_error_shape(resp, status: int, code: str, message_substr: str):
    assert resp.status_code == status
    data = resp.get_json()
    assert isinstance(data, dict), data
    assert "error" in data, data
    assert "meta" in data, data
    err = data["error"]
    assert err.get("code") == code, err
    assert message_substr in err.get("message", ""), err
    assert "request_id" in data["meta"]


# Parameterized style (manual loop to avoid introducing pytest dependency changes if already present)


def test_service_operations_forced_errors(client):
    # happy path sanity
    ok = client.get("/api/admin/service-operations")
    assert ok.status_code == 200
    # forced variants
    cases = [
        ("bad_request", HTTPStatus.BAD_REQUEST, "bad_request", "Bad request"),
        ("forbidden", HTTPStatus.FORBIDDEN, "forbidden", "Forbidden"),
        ("not_found", HTTPStatus.NOT_FOUND, "not_found", "Not found"),
        ("internal", HTTPStatus.INTERNAL_SERVER_ERROR, "internal", "Internal server error"),
    ]
    for key, st, code, msg in cases:
        resp = client.get(f"/api/admin/service-operations?test_error={key}")
        assert_error_shape(resp, st, code, msg)
