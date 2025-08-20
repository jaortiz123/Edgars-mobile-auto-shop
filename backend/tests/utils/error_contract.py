from http import HTTPStatus
from typing import Iterable, Literal, Callable

EXPECTED_SHAPE_KEYS = {"error", "meta"}


def run_error_contract_tests(
    client, base_path: str, forced_keys: Iterable[str], method: str = "GET"
):
    """Reusable contract tester.

    Parameters:
        client: Flask test client fixture.
        base_path: Endpoint path (e.g. '/api/admin/service-operations').
        forced_keys: iterable of forced error trigger keys understood via ?test_error=.

    For each forced key we expect endpoint to return unified error envelope:
        { "error": { "code": <STR>, "message": <STR>, ...? }, "meta": {"request_id": <RID>} }
    """
    for key in forced_keys:
        url = f"{base_path}?test_error={key}"
        if method == "GET":
            resp = client.get(url)
        elif method == "PATCH":
            resp = client.patch(
                url, json={}
            )  # empty body acceptable; forced error will short-circuit
        else:
            raise ValueError(f"Unsupported method for contract test: {method}")
        data = resp.get_json()
        assert isinstance(data, dict), data
        assert EXPECTED_SHAPE_KEYS.issubset(data.keys()), data
        # Basic structural assertions
        err = data["error"]
        assert isinstance(err, dict), err
        assert "code" in err and "message" in err, err
        assert "request_id" in data.get("meta", {}), data
        # Map forced key to expected status/code semantics
        # Expected status + lowercase code (new unified contract uses lowercase primary error.code)
        expected_map = {
            "bad_request": (HTTPStatus.BAD_REQUEST, "bad_request"),
            "forbidden": (HTTPStatus.FORBIDDEN, "forbidden"),
            "not_found": (HTTPStatus.NOT_FOUND, "not_found"),
            "internal": (HTTPStatus.INTERNAL_SERVER_ERROR, "internal"),
        }
        if key in expected_map:
            st, code = expected_map[key]
            assert resp.status_code == st, (key, resp.status_code, data)
            assert err.get("code") == code, (key, err)
