import json, time
from datetime import datetime


def _now_ts():
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")


class FakeConn:
    """In-memory fake DB for patch/edit tests.

    Stores customers, vehicles, and audit rows in simple dict/list structures.
    Only implements the tiny subset of SQL used by the tests.
    """

    def __init__(self):
        self.customers = {}
        self.vehicles = {}
        self.customer_audits = []  # list of dicts {customer_id, fields_changed, created_at}
        self.vehicle_audits = []
        self._cid = 0
        self._vid = 0

    # Context manager support
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        pass

    def commit(self):
        pass  # no-op

    def cursor(self, cursor_factory=None):  # ignore cursor_factory
        return _FakeCursor(self)


class _FakeCursor:
    def __init__(self, conn: FakeConn):
        self.conn = conn
        self._result_one = None
        self._result_many = None
        self._last_sql = ""

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        pass

    def execute(self, sql, params=None):  # extremely small SQL shim just for these tests
        self._last_sql = sql
        params = params or []
        # INSERT customers
        if sql.startswith("INSERT INTO customers"):
            self.conn._cid += 1
            cid = self.conn._cid
            name, email, phone = params
            now = _now_ts()
            self.conn.customers[cid] = {
                "id": cid,
                "name": name,
                "email": email,
                "phone": phone,
                "is_vip": False,
                "address": None,
                "created_at": now,
                "updated_at": now,
            }
            self._result_one = (cid,)
            return
        # INSERT vehicles
        if sql.startswith("INSERT INTO vehicles"):
            self.conn._vid += 1
            vid = self.conn._vid
            (customer_id,) = params
            now = _now_ts()
            self.conn.vehicles[vid] = {
                "id": vid,
                "customer_id": customer_id,
                "make": "Ford",
                "model": "F150",
                "year": 2020,
                "vin": "1FTFW1E50LFAAAAAA",
                "license_plate": "ABC123",
                "created_at": now,
                "updated_at": now,
            }
            self._result_one = (vid,)
            return
        # SELECT customer row for patch helper
        if "FROM customers WHERE id" in sql and sql.startswith("SELECT id"):
            cid = params[0]
            row = self.conn.customers.get(cid)
            if not row:
                self._result_one = None
            else:
                ts = max(row["updated_at"], row["created_at"])
                self._result_one = {
                    "id": row["id"],
                    "name": row["name"],
                    "email": row["email"],
                    "phone": row["phone"],
                    "is_vip": row["is_vip"],
                    "address": row["address"],
                    "ts": ts,
                }
            return
        # SELECT vehicle row
        if "FROM vehicles WHERE id" in sql and sql.startswith("SELECT id"):
            vid = params[0]
            row = self.conn.vehicles.get(vid)
            if not row:
                self._result_one = None
            else:
                ts = max(row["updated_at"], row["created_at"])
                self._result_one = {
                    "id": row["id"],
                    "customer_id": row["customer_id"],
                    "make": row["make"],
                    "model": row["model"],
                    "year": row["year"],
                    "vin": row["vin"],
                    "license_plate": row["license_plate"],
                    "ts": ts,
                }
            return
        # UPDATE customers
        if sql.startswith("UPDATE customers SET"):
            cid = params[-1]
            row = self.conn.customers.get(cid)
            if row:
                assignments = sql[len("UPDATE customers SET ") :].split(", updated_at=now()")[0]
                cols = [c.split("=")[0] for c in assignments.split(", ")] if assignments else []
                for col, val in zip(cols, params[:-1]):
                    row[col] = val
                row["updated_at"] = _now_ts()
            self._result_one = None
            return
        # UPDATE vehicles
        if sql.startswith("UPDATE vehicles SET"):
            vid = params[-1]
            row = self.conn.vehicles.get(vid)
            if row:
                assignments = sql[len("UPDATE vehicles SET ") :].split(", updated_at=now()")[0]
                cols = [c.split("=")[0] for c in assignments.split(", ")] if assignments else []
                for col, val in zip(cols, params[:-1]):
                    row[col] = val
                row["updated_at"] = _now_ts()
            self._result_one = None
            return
        # INSERT audit (customer)
        if sql.startswith("INSERT INTO customer_audits"):
            customer_id, actor_id, fields_json = params
            try:
                fields = json.loads(fields_json)
            except Exception:
                fields = {}
            self.conn.customer_audits.append(
                {
                    "customer_id": customer_id,
                    "fields_changed": fields,
                    "created_at": time.time(),
                }
            )
            self._result_one = None
            return
        # INSERT audit (vehicle)
        if sql.startswith("INSERT INTO vehicle_audits"):
            vehicle_id, actor_id, fields_json = params
            try:
                fields = json.loads(fields_json)
            except Exception:
                fields = {}
            self.conn.vehicle_audits.append(
                {
                    "vehicle_id": vehicle_id,
                    "fields_changed": fields,
                    "created_at": time.time(),
                }
            )
            self._result_one = None
            return
        # SELECT fields_changed from customer_audits
        if sql.startswith("SELECT fields_changed FROM customer_audits"):
            customer_id = params[0]
            rows = [r for r in self.conn.customer_audits if r["customer_id"] == customer_id]
            rows.sort(key=lambda r: r["created_at"], reverse=True)
            self._result_one = {"fields_changed": rows[0]["fields_changed"]} if rows else None
            return
        # SELECT COUNT(*) customer_audits
        if sql.startswith("SELECT COUNT(*) FROM customer_audits"):
            customer_id = params[0]
            count = sum(1 for r in self.conn.customer_audits if r["customer_id"] == customer_id)
            self._result_one = (count,)
            return
        # SELECT COUNT(*) vehicle_audits
        if sql.startswith("SELECT COUNT(*) FROM vehicle_audits"):
            vehicle_id = params[0]
            count = sum(1 for r in self.conn.vehicle_audits if r["vehicle_id"] == vehicle_id)
            self._result_one = (count,)
            return
        # SELECT fields_changed FROM vehicle_audits (latest)
        if sql.startswith("SELECT fields_changed FROM vehicle_audits"):
            vehicle_id = params[0]
            rows = [r for r in self.conn.vehicle_audits if r["vehicle_id"] == vehicle_id]
            rows.sort(key=lambda r: r["created_at"], reverse=True)
            self._result_one = {"fields_changed": rows[0]["fields_changed"]} if rows else None
            return

    def fetchone(self):
        return self._result_one

    def fetchall(self):
        return self._result_many or []
