import json
from http import HTTPStatus

def test_get_single_appointment_details(client, db_connection):
    # Precondition: insert customer, vehicle, service_operation, appointment, appointment_service
    cur = db_connection.cursor()
    cur.execute("INSERT INTO customers (name, email, phone) VALUES ('Alice Tester','alice@example.com','555-0101') RETURNING id")
    cust_id = cur.fetchone()[0]
    cur.execute("INSERT INTO vehicles (customer_id, year, make, model, license_plate) VALUES (%s, 2020, 'Honda','Civic','ABC123') RETURNING id", (cust_id,))
    veh_id = cur.fetchone()[0]
    op_id = 'svc-op-align'
    cur.execute("INSERT INTO service_operations (id, name, default_price, category) VALUES (%s,'Alignment',59.99,'Chassis')", (op_id,))
    cur.execute("INSERT INTO appointments (customer_id, vehicle_id, status, start_ts) VALUES (%s,%s,'SCHEDULED', now()) RETURNING id", (cust_id, veh_id))
    appt_id = cur.fetchone()[0]
    cur.execute("""
        INSERT INTO appointment_services (appointment_id, name, estimated_price, service_operation_id)
        VALUES (%s,'Alignment',59.99,%s)
    """, (appt_id, op_id))
    db_connection.commit()

    resp = client.get(f"/api/admin/appointments/{appt_id}")
    assert resp.status_code == HTTPStatus.OK, resp.data
    payload = json.loads(resp.data)
    # Depending on utility _ok wrapper, payload may already be full or nested under 'data'
    root = payload.get('appointment') and payload or payload.get('data') or {}
    assert 'appointment' in root, f"Unexpected payload shape: {payload}"
    appt = root['appointment']
    assert appt['id'] == str(appt_id)
    assert appt['status'] == 'SCHEDULED'
    assert 'service_operation_ids' in appt and op_id in appt['service_operation_ids']
    assert root['customer']['id'] == str(cust_id)
    assert any(v['id'] == str(veh_id) for v in root['customer']['vehicles'])
    assert root['vehicle']['id'] == str(veh_id)
    assert len(root['services']) == 1
    svc = root['services'][0]
    assert svc['service_operation_id'] == op_id
    assert svc['operation']['category'] == 'Chassis'
    assert root['meta']['version'] == 1
