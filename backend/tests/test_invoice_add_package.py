import pytest
from backend.db import get_connection

ADD_ENDPOINT = "/api/admin/invoices/{}/add-package"


def _exec(sql: str, params=None):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or [])
        conn.commit()


def _fetchone(sql: str, params=None):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or [])
            return cur.fetchone()


@pytest.mark.integration
def test_add_package_success_sum_only(client):
    _exec(
        """
        INSERT INTO invoices (id,status,subtotal_cents,tax_cents,total_cents,amount_paid_cents,amount_due_cents,currency,created_at,updated_at)
        VALUES ('inv-sum','DRAFT',0,0,0,0,0,'USD',now(),now())
    """
    )
    _exec(
        "INSERT INTO service_operations (id,name,category,is_package,default_price) VALUES ('pkg-basic','Basic Package','TEST',TRUE, NULL) ON CONFLICT (id) DO NOTHING"
    )
    _exec(
        "INSERT INTO service_operations (id,name,category,is_package,default_price) VALUES ('svc-a','Svc A','TEST',FALSE, 30.00) ON CONFLICT (id) DO NOTHING"
    )
    _exec(
        "INSERT INTO service_operations (id,name,category,is_package,default_price) VALUES ('svc-b','Svc B','TEST',FALSE, 70.00) ON CONFLICT (id) DO NOTHING"
    )
    _exec(
        "INSERT INTO package_items (service_id,child_id,qty,sort_order) VALUES ('pkg-basic','svc-a',1,0) ON CONFLICT (service_id,child_id) DO NOTHING"
    )
    _exec(
        "INSERT INTO package_items (service_id,child_id,qty,sort_order) VALUES ('pkg-basic','svc-b',1,1) ON CONFLICT (service_id,child_id) DO NOTHING"
    )

    resp = client.post(ADD_ENDPOINT.format("inv-sum"), json={"packageId": "pkg-basic"})
    assert resp.status_code == 200, resp.get_data(as_text=True)
    data = resp.get_json()["data"]
    assert data["package_id"] == "pkg-basic"
    added = data["added_line_items"]
    assert len(added) == 2
    assert data["added_subtotal_cents"] == 10000
    inv = data["invoice"]
    assert inv["subtotal_cents"] == 10000
    assert inv["total_cents"] == 10000
    assert inv["amount_due_cents"] == 10000


@pytest.mark.integration
def test_add_package_with_override_scaling(client):
    _exec(
        "INSERT INTO invoices (id,status,subtotal_cents,tax_cents,total_cents,amount_paid_cents,amount_due_cents,currency,created_at,updated_at) VALUES ('inv-ovr','DRAFT',0,0,0,0,0,'USD',now(),now())"
    )
    _exec(
        "INSERT INTO service_operations (id,name,category,is_package,default_price) VALUES ('pkg-ovr','Override Package','TEST',TRUE, 50.00) ON CONFLICT (id) DO NOTHING"
    )
    _exec(
        "INSERT INTO service_operations (id,name,category,is_package,default_price) VALUES ('svc-c','Svc C','TEST',FALSE, 30.00) ON CONFLICT (id) DO NOTHING"
    )
    _exec(
        "INSERT INTO service_operations (id,name,category,is_package,default_price) VALUES ('svc-d','Svc D','TEST',FALSE, 70.00) ON CONFLICT (id) DO NOTHING"
    )
    _exec(
        "INSERT INTO package_items (service_id,child_id,qty,sort_order) VALUES ('pkg-ovr','svc-c',1,0) ON CONFLICT (service_id,child_id) DO NOTHING"
    )
    _exec(
        "INSERT INTO package_items (service_id,child_id,qty,sort_order) VALUES ('pkg-ovr','svc-d',1,1) ON CONFLICT (service_id,child_id) DO NOTHING"
    )

    resp = client.post(ADD_ENDPOINT.format("inv-ovr"), json={"packageId": "pkg-ovr"})
    assert resp.status_code == 200, resp.get_data(as_text=True)
    data = resp.get_json()["data"]
    assert data["added_subtotal_cents"] == 5000
    added = data["added_line_items"]
    assert sum(li["total_cents"] for li in added) == 5000
    assert all(li["total_cents"] > 0 for li in added)


@pytest.mark.integration
def test_add_package_invalid_state(client):
    _exec(
        "INSERT INTO invoices (id,status,subtotal_cents,tax_cents,total_cents,amount_paid_cents,amount_due_cents,currency,created_at,updated_at,paid_at) VALUES ('inv-paid','PAID',1000,0,1000,1000,0,'USD',now(),now(),now())"
    )
    resp = client.post(ADD_ENDPOINT.format("inv-paid"), json={"packageId": "anything"})
    assert resp.status_code == 400
    err = resp.get_json()["error"]
    assert err["code"].upper() in ("INVALID_STATE",)


@pytest.mark.integration
def test_add_package_not_a_package(client):
    _exec(
        "INSERT INTO invoices (id,status,subtotal_cents,tax_cents,total_cents,amount_paid_cents,amount_due_cents,currency,created_at,updated_at) VALUES ('inv-np','DRAFT',0,0,0,0,0,'USD',now(),now())"
    )
    _exec(
        "INSERT INTO service_operations (id,name,category,is_package,default_price) VALUES ('regular-service','Regular','TEST',FALSE, 25.00) ON CONFLICT (id) DO NOTHING"
    )
    resp = client.post(ADD_ENDPOINT.format("inv-np"), json={"packageId": "regular-service"})
    assert resp.status_code == 404
    err = resp.get_json()["error"]
    assert err["code"].upper() in ("NOT_A_PACKAGE",)


@pytest.mark.integration
def test_add_package_missing_package(client):
    _exec(
        "INSERT INTO invoices (id,status,subtotal_cents,tax_cents,total_cents,amount_paid_cents,amount_due_cents,currency,created_at,updated_at) VALUES ('inv-missing','DRAFT',0,0,0,0,0,'USD',now(),now())"
    )
    resp = client.post(ADD_ENDPOINT.format("inv-missing"), json={"packageId": "does-not-exist"})
    assert resp.status_code == 404
    err = resp.get_json()["error"]
    assert err["code"].upper() in ("NOT_A_PACKAGE",)


@pytest.mark.integration
def test_add_package_empty_package(client):
    _exec(
        "INSERT INTO invoices (id,status,subtotal_cents,tax_cents,total_cents,amount_paid_cents,amount_due_cents,currency,created_at,updated_at) VALUES ('inv-empty','DRAFT',0,0,0,0,0,'USD',now(),now())"
    )
    _exec(
        "INSERT INTO service_operations (id,name,category,is_package,default_price) VALUES ('pkg-empty','Empty','TEST',TRUE, NULL) ON CONFLICT (id) DO NOTHING"
    )
    resp = client.post(ADD_ENDPOINT.format("inv-empty"), json={"packageId": "pkg-empty"})
    assert resp.status_code == 409
    err = resp.get_json()["error"]
    assert err["code"].upper() in ("EMPTY_PACKAGE",)
