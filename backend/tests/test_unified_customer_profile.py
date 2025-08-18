import os
import jwt
from datetime import datetime, timedelta

import pytest


JWT_SECRET = os.getenv("JWT_SECRET", "dev_secret")
JWT_ALG = os.getenv("JWT_ALG", "HS256")


def make_token(role="Advisor", sub="user-1"):
    payload = {"sub": sub, "role": role, "exp": datetime.utcnow() + timedelta(hours=1)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def auth_headers(role="Advisor"):
    return {"Authorization": f"Bearer {make_token(role=role)}"}


@pytest.mark.usefixtures("db_connection")
def test_profile_not_found(client):
    r = client.get("/api/admin/customers/424242/profile", headers=auth_headers())
    assert r.status_code == 404
    j = r.get_json()
    assert j["error"]["code"] in ("not_found", "NOT_FOUND")


@pytest.mark.usefixtures("db_connection")
def test_profile_basic(client, db_connection):
    # Seed minimal customer, vehicle, appointment, invoice
    with db_connection:
        with db_connection.cursor() as cur:
            cur.execute(
                "INSERT INTO customers(id,name,email,phone,is_vip) VALUES(1001,'Ada Lovelace','ada@example.com','5551234',false)"
            )
            cur.execute(
                "INSERT INTO vehicles(id,customer_id,year,make,model,license_plate,vin) VALUES(2001,1001,2020,'Tesla','Model S','EV123','VIN1')"
            )
            cur.execute(
                """
				INSERT INTO appointments(id, customer_id, vehicle_id, status, start_ts, total_amount, paid_amount)
				VALUES (3001,1001,2001,'COMPLETED', NOW() - INTERVAL '10 days', 150.00, 100.00)
			"""
            )
            # invoices table uses cents columns
            cur.execute(
                """
				INSERT INTO invoices(id, customer_id, appointment_id, status, subtotal_cents, tax_cents, total_cents, amount_paid_cents, amount_due_cents)
				VALUES('inv1',1001,3001,'DRAFT',10000,500,10500,10000,500)
			"""
            )
    r = client.get(
        "/api/admin/customers/1001/profile?include_invoices=true", headers=auth_headers()
    )
    assert r.status_code == 200, r.data
    data = r.get_json()
    assert data["customer"]["full_name"] == "Ada Lovelace"
    assert data["stats"]["lifetime_spend"] == pytest.approx(105.00)
    assert data["stats"]["unpaid_balance"] == pytest.approx(5.00)
    assert data["stats"]["total_visits"] == 1
    assert len(data["vehicles"]) == 1
    assert len(data["appointments"]) == 1
    appt = data["appointments"][0]
    assert appt["invoice"]["total"] == pytest.approx(105.00)
    assert appt["invoice"]["unpaid"] == pytest.approx(5.00)


@pytest.mark.usefixtures("db_connection")
def test_profile_limit_and_filter(client, db_connection):
    with db_connection:
        with db_connection.cursor() as cur:
            cur.execute("INSERT INTO customers(id,name) VALUES(1101,'Grace Hopper')")
            cur.execute(
                "INSERT INTO vehicles(id,customer_id,year,make,model,license_plate) VALUES(2101,1101,2018,'Honda','Civic','ABC123')"
            )
            cur.execute(
                "INSERT INTO vehicles(id,customer_id,year,make,model,license_plate) VALUES(2102,1101,2019,'Ford','F150','TRK100')"
            )
            # create 7 appointments across two vehicles
            for i in range(1, 8):
                veh = 2101 if i % 2 else 2102
                cur.execute(
                    """
					INSERT INTO appointments(id, customer_id, vehicle_id, status, start_ts, total_amount, paid_amount)
					VALUES(%s,1101,%s,'COMPLETED', NOW() - (%s || ' days')::INTERVAL, 50.00, 50.00)
					""",
                    (4000 + i, veh, i),
                )
    # limit to 5
    r = client.get("/api/admin/customers/1101/profile?limit_appointments=5", headers=auth_headers())
    assert r.status_code == 200
    data = r.get_json()
    assert len(data["appointments"]) == 5
    # filter to vehicle v3 (should be <= limit and only that vehicle)
    r2 = client.get(
        "/api/admin/customers/1101/profile?vehicle_id=2102&limit_appointments=10",
        headers=auth_headers(),
    )
    assert r2.status_code == 200
    data2 = r2.get_json()
    assert all(a["vehicle_id"] == "2102" for a in data2["appointments"]), data2["appointments"]


@pytest.mark.usefixtures("db_connection")
def test_profile_invalid_limit(client):
    r = client.get(
        "/api/admin/customers/123456/profile?limit_appointments=bad", headers=auth_headers()
    )
    assert r.status_code == 400
    j = r.get_json()
    assert j["error"]["code"] == "bad_request"


@pytest.mark.usefixtures("db_connection")
def test_profile_limit_over_100(client):
    r = client.get(
        "/api/admin/customers/123/profile?limit_appointments=500", headers=auth_headers()
    )
    assert r.status_code == 400
    assert r.get_json()["error"]["code"] == "bad_request"


@pytest.mark.usefixtures("db_connection")
def test_rbac_forbidden(client):
    # role outside allowed set
    token = make_token(role="Technician")
    r = client.get("/api/admin/customers/1/profile", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
    assert r.get_json()["error"]["code"] == "forbidden"


@pytest.mark.usefixtures("db_connection")
def test_etag_flow(client, db_connection):
    with db_connection:
        with db_connection.cursor() as cur:
            cur.execute("INSERT INTO customers(id,name) VALUES(1301,'ETag User')")
            cur.execute(
                "INSERT INTO vehicles(id,customer_id,make,model,year) VALUES(2301,1301,'Make','Model',2022)"
            )
            cur.execute(
                "INSERT INTO appointments(id,customer_id,vehicle_id,status,total_amount,paid_amount,start_ts) VALUES(3301,1301,2301,'COMPLETED',10.00,10.00,NOW())"
            )
    r1 = client.get("/api/admin/customers/1301/profile", headers=auth_headers())
    assert r1.status_code == 200
    etag = r1.headers.get("ETag")
    assert etag
    r2 = client.get(
        "/api/admin/customers/1301/profile", headers={**auth_headers(), "If-None-Match": etag}
    )
    assert r2.status_code == 304


@pytest.mark.usefixtures("db_connection")
def test_date_filtering(client, db_connection):
    with db_connection:
        with db_connection.cursor() as cur:
            cur.execute("INSERT INTO customers(id,name) VALUES(1401,'Date User')")
            cur.execute("INSERT INTO vehicles(id,customer_id) VALUES(2401,1401)")
            # Two appointments different days
            cur.execute(
                "INSERT INTO appointments(id,customer_id,vehicle_id,status,total_amount,paid_amount,start_ts) VALUES(3401,1401,2401,'COMPLETED',20.00,20.00, NOW() - INTERVAL '10 days')"
            )
            cur.execute(
                "INSERT INTO appointments(id,customer_id,vehicle_id,status,total_amount,paid_amount,start_ts) VALUES(3402,1401,2401,'COMPLETED',30.00,30.00, NOW() - INTERVAL '2 days')"
            )
    # filter last 5 days -> only second
    r = client.get(
        "/api/admin/customers/1401/profile?from="
        + (datetime.utcnow() - timedelta(days=5)).strftime("%Y-%m-%d"),
        headers=auth_headers(),
    )
    assert r.status_code == 200
    data = r.get_json()
    assert len(data["appointments"]) == 1


@pytest.mark.usefixtures("db_connection")
def test_vehicle_ownership_validation(client, db_connection):
    with db_connection:
        with db_connection.cursor() as cur:
            cur.execute("INSERT INTO customers(id,name) VALUES(1501,'Own User')")
            cur.execute("INSERT INTO vehicles(id,customer_id) VALUES(2501,1501)")
    # vehicle that does not belong to customer
    r = client.get("/api/admin/customers/1501/profile?vehicle_id=9999", headers=auth_headers())
    assert r.status_code == 400
    assert r.get_json()["error"]["code"] == "bad_request"


@pytest.mark.usefixtures("db_connection")
def test_cursor_pagination_flow(client, db_connection):
    with db_connection:
        with db_connection.cursor() as cur:
            cur.execute("INSERT INTO customers(id,name) VALUES(1601,'Cursor User')")
            cur.execute("INSERT INTO vehicles(id,customer_id) VALUES(2601,1601)")
            # create 7 appointments with distinct start_ts
            for i in range(7):
                cur.execute(
                    "INSERT INTO appointments(id,customer_id,vehicle_id,status,start_ts,total_amount,paid_amount) VALUES(%s,1601,2601,'COMPLETED', NOW() - (%s || ' hours')::INTERVAL,10,10)",
                    (3601 + i, i),
                )
    # first page limit=3
    r1 = client.get(
        "/api/admin/customers/1601/profile?limit_appointments=3", headers=auth_headers()
    )
    assert r1.status_code == 200
    page1 = r1.get_json()
    assert page1["page"]["returned"] == 3
    next_cursor = page1["page"]["next_cursor"]
    assert next_cursor
    ids_page1 = [a["id"] for a in page1["appointments"]]
    # second page using cursor
    r2 = client.get(
        f"/api/admin/customers/1601/profile?limit_appointments=3&cursor={next_cursor}",
        headers=auth_headers(),
    )
    assert r2.status_code == 200
    page2 = r2.get_json()
    ids_page2 = [a["id"] for a in page2["appointments"]]
    assert not set(ids_page1) & set(ids_page2)
    # consume remaining
    while page2["page"]["next_cursor"]:
        r2 = client.get(
            f"/api/admin/customers/1601/profile?limit_appointments=3&cursor={page2['page']['next_cursor']}",
            headers=auth_headers(),
        )
        page2 = r2.get_json()
    assert page2["page"]["next_cursor"] is None


@pytest.mark.usefixtures("db_connection")
def test_invalid_cursor(client, db_connection):
    with db_connection:
        with db_connection.cursor() as cur:
            cur.execute("INSERT INTO customers(id,name) VALUES(1701,'Bad Cursor')")
            cur.execute("INSERT INTO vehicles(id,customer_id) VALUES(2701,1701)")
    r = client.get("/api/admin/customers/1701/profile?cursor=not_base64", headers=auth_headers())
    assert r.status_code == 400
    assert r.get_json()["error"]["code"] == "bad_request"


@pytest.mark.usefixtures("db_connection")
def test_cursor_precedence_over_dates(client, db_connection):
    with db_connection:
        with db_connection.cursor() as cur:
            cur.execute("INSERT INTO customers(id,name) VALUES(1801,'Cursor Date User')")
            cur.execute("INSERT INTO vehicles(id,customer_id) VALUES(2801,1801)")
            for i in range(5):
                cur.execute(
                    "INSERT INTO appointments(id,customer_id,vehicle_id,status,start_ts,total_amount,paid_amount) VALUES(%s,1801,2801,'COMPLETED', NOW() - (%s || ' days')::INTERVAL,10,10)",
                    (3801 + i, i),
                )
    # first page limit=2
    r1 = client.get(
        "/api/admin/customers/1801/profile?limit_appointments=2", headers=auth_headers()
    )
    page1 = r1.get_json()
    cursor = page1["page"]["next_cursor"]
    assert cursor
    # provide cursor plus restrictive from date that would otherwise exclude older rows
    from_date = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    r2 = client.get(
        f"/api/admin/customers/1801/profile?limit_appointments=2&cursor={cursor}&from={from_date}",
        headers=auth_headers(),
    )
    page2 = r2.get_json()
    assert page2["appointments"], "cursor should override from date restrictions"


@pytest.mark.usefixtures("db_connection")
def test_rbac_forbidden_other_role(client):
    # role outside allowed set (Viewer)
    token = make_token(role="Viewer")
    r = client.get("/api/admin/customers/1/profile", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
    body = r.get_json()
    code = None
    if body is not None:
        if isinstance(body, dict):
            code = (body.get("error") or {}).get("code") or (body.get("errors") or [{}])[0].get(
                "code"
            )
    assert code is not None
    assert code.lower() == "forbidden"
