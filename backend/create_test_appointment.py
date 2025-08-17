#!/usr/bin/env python3
"""
Create a test appointment scheduled 24-26 hours from now to test the reminder system
"""

import logging
import os
from datetime import datetime, timedelta

import psycopg2

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_test_appointment():
    """Create a test appointment with SMS consent enabled"""

    # Database connection
    db_host = os.environ.get(
        "DB_HOST", "edgarsmobileautoshop.czjifvdokxz3.us-east-1.rds.amazonaws.com"
    )
    db_name = os.environ.get("DB_NAME", "postgres")
    db_user = os.environ.get("DB_USER", "edgarsadmin")
    db_password = os.environ.get("DB_PASSWORD")

    if not db_password:
        logger.error("DB_PASSWORD environment variable not set")
        return False

    try:
        # Connect to database
        conn = psycopg2.connect(
            host=db_host, database=db_name, user=db_user, password=db_password, port=5432
        )

        with conn.cursor() as cur:
            # Calculate test appointment time (25 hours from now)
            now = datetime.utcnow()
            test_time = now + timedelta(hours=25)
            scheduled_date = test_time.date()
            scheduled_time = test_time.time()

            logger.info(f"Creating test appointment for: {test_time}")

            # Create test customer with SMS consent
            cur.execute(
                """
                SELECT id FROM customers WHERE phone = %s
            """,
                ("+15551234567",),
            )

            existing_customer = cur.fetchone()

            if existing_customer:
                customer_id = existing_customer[0]
                logger.info(f"Found existing customer with ID: {customer_id}")

                # Update SMS consent for existing customer
                cur.execute(
                    """
                    UPDATE customers
                    SET sms_consent = %s,
                        sms_consent_date = %s,
                        sms_opt_out = %s
                    WHERE id = %s
                """,
                    (True, now, False, customer_id),
                )
                logger.info("Updated SMS consent for existing customer")
            else:
                # Create new test customer
                cur.execute(
                    """
                    INSERT INTO customers (name, phone, email, sms_consent, sms_consent_date, sms_consent_ip, sms_opt_out)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """,
                    (
                        "Test Customer SMS",
                        "+15551234567",  # Test phone number
                        "test@example.com",
                        True,  # SMS consent enabled
                        now,
                        "192.168.1.1",  # Test IP
                        False,  # Not opted out
                    ),
                )
                customer_id = cur.fetchone()[0]
                logger.info(f"Created new test customer with ID: {customer_id}")

            # Get first available service
            cur.execute("SELECT id, name FROM services LIMIT 1")
            service_result = cur.fetchone()
            if not service_result:
                logger.error("No services found in database")
                return False

            service_id, service_name = service_result
            logger.info(f"Using service: {service_name} (ID: {service_id})")

            # Create test appointment
            cur.execute(
                """
                INSERT INTO appointments (customer_id, service_id, scheduled_date, scheduled_time,
                                        location_address, status, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """,
                (
                    customer_id,
                    service_id,
                    scheduled_date,
                    scheduled_time,
                    "123 Test Street, Test City, TS 12345",
                    "scheduled",
                    "Test appointment for SMS reminder testing",
                ),
            )
            appointment_id = cur.fetchone()[0]

            conn.commit()

            logger.info("✅ Test appointment created successfully!")
            logger.info(f"   Appointment ID: {appointment_id}")
            logger.info("   Customer: Test Customer SMS (+15551234567)")
            logger.info(f"   Service: {service_name}")
            logger.info(f"   Scheduled: {test_time}")
            logger.info("   SMS Consent: TRUE")
            logger.info("   Location: 123 Test Street, Test City, TS 12345")

            # Verify the appointment shows up in our reminder query
            cur.execute(
                """
                SELECT
                    a.id,
                    a.scheduled_date,
                    a.scheduled_time,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.sms_consent,
                    c.sms_opt_out,
                    s.name as service_name
                FROM appointments a
                LEFT JOIN customers c ON a.customer_id = c.id
                LEFT JOIN services s ON a.service_id = s.id
                WHERE a.id = %s
            """,
                (appointment_id,),
            )

            row = cur.fetchone()
            if row:
                logger.info("✅ Verification query successful:")
                logger.info(f"   Customer: {row[3]} ({row[4]})")
                logger.info(f"   SMS Consent: {row[5]}, Opt Out: {row[6]}")
                logger.info(f"   Service: {row[7]}")
                logger.info(f"   Scheduled: {row[1]} {row[2]}")

            return True

    except Exception as e:
        logger.error(f"Failed to create test appointment: {str(e)}")
        return False
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    success = create_test_appointment()
    if success:
        print("\n🎉 Test appointment created! Run the reminder function to test SMS notifications.")
    else:
        print("\n❌ Failed to create test appointment. Check the logs above.")
