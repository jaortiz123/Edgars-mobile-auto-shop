#!/usr/bin/env python3

import psycopg2
from psycopg2.extras import RealDictCursor


def check_database_state():
    try:
        conn = psycopg2.connect(
            host="localhost",
            port=5432,
            dbname="edgar_db",
            user="postgres",
            password="postgres",
            cursor_factory=RealDictCursor,
        )

        print("=== Database State Check ===")

        # Check the most recent appointment
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM appointments ORDER BY id DESC LIMIT 1")
            appointment = cur.fetchone()
            print(f"Latest appointment: {dict(appointment) if appointment else None}")

            if appointment:
                appt_id = appointment["id"]

                # Check appointment_vehicles junction table
                cur.execute(
                    "SELECT * FROM appointment_vehicles WHERE appointment_id = %s", (appt_id,)
                )
                junction_records = cur.fetchall()
                print(
                    f"Junction table records for appointment {appt_id}: {[dict(r) for r in junction_records]}"
                )

                # Check customer vehicles
                cur.execute(
                    "SELECT * FROM vehicles WHERE customer_id = %s", (appointment["customer_id"],)
                )
                customer_vehicles = cur.fetchall()
                print(f"Customer vehicles: {[dict(v) for v in customer_vehicles]}")

        conn.close()

    except Exception as e:
        print(f"Database check failed: {e}")


if __name__ == "__main__":
    check_database_state()
