import json
import os
import logging
import boto3
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    logger.info("=== INCOMING EVENT ===")
    logger.info(json.dumps(event, indent=2))
    logger.info("=== END EVENT ===")
    
    route_key = event.get('routeKey', '').strip()
    logger.info(f"Request received for route: {route_key}")
    
    def get_db_connection():
        logger.info("Attempting to connect to the database...")
        secrets_client = boto3.client('secretsmanager', region_name='us-west-2')
        secret_value = secrets_client.get_secret_value(SecretId=os.environ['DB_SECRET_ARN'])
        secret = json.loads(secret_value['SecretString'])
        
        conn = psycopg2.connect(
            host=secret['host'],
            port=secret['port'],
            database=secret['dbname'],
            user=secret['username'],
            password=secret['password']
        )
        logger.info("Database connection successful.")
        return conn    # GET /appointments - List appointments
    if route_key == "GET /appointments":
        logger.info(">>> ENTERED GET /appointments BRANCH")
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT
                      a.id,
                      a.customer_id,
                      a.service_id,
                      a.scheduled_date,
                      a.scheduled_time,
                      a.status,
                      a.location_address,
                      a.notes,
                      a.created_at
                    FROM appointments a
                    ORDER BY a.scheduled_date DESC, a.scheduled_time DESC
                    LIMIT 100
                """)
                rows = cur.fetchall()
                
                # Combine scheduled_date + scheduled_time into single ISO timestamp
                from datetime import datetime
                for row in rows:
                    if row.get('scheduled_date') and row.get('scheduled_time'):
                        ts = datetime.combine(row['scheduled_date'], row['scheduled_time'])
                        row['scheduled_at'] = ts.isoformat()
                        del row['scheduled_date'], row['scheduled_time']
                    if row.get('created_at'):
                        row['created_at'] = row['created_at'].isoformat()
            
            # RETURN IMMEDIATELY - NO FALL-THROUGH
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({
                    "appointments": rows,
                    "count": len(rows)
                })
            }
        finally:
            conn.close()
            logger.info("Database connection closed.")
    
    # GET /init-db - Initialize database (temporary route)
    elif route_key.strip() == "GET /init-db":
        logger.info(">>> ENTERED INIT-DB BRANCH")
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(open("/var/task/init.sql").read())
                conn.commit()
            return {"statusCode": 200, "body": "Database initialized successfully!"}
        finally:
            conn.close()

    # POST /appointments - Create appointment
    elif route_key == "POST /appointments":
        logger.info(">>> ENTERED POST /appointments BRANCH")
        body = json.loads(event.get('body', '{}'))
        
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                # Handle customer data with SMS consent
                customer_id = handle_customer_with_sms_consent(cur, body)
                
                # Get service_id from service name if provided
                service_id = body.get('service_id')
                if not service_id and body.get('service'):
                    cur.execute("SELECT id FROM services WHERE name = %s", (body['service'],))
                    result = cur.fetchone()
                    service_id = result[0] if result else None
                elif not service_id and body.get('service_name'):
                    cur.execute("SELECT id FROM services WHERE name = %s", (body['service_name'],))
                    result = cur.fetchone()
                    service_id = result[0] if result else None
                
                # Parse the requested_time to separate date and time
                requested_time = body.get('requested_time')
                if requested_time:
                    from datetime import datetime
                    dt = datetime.fromisoformat(requested_time.replace('Z', '+00:00'))
                    scheduled_date = dt.date()
                    scheduled_time = dt.time()
                else:
                    # Fallback for older format
                    scheduled_date = body.get('scheduled_date')
                    scheduled_time = body.get('scheduled_time')
                
                cur.execute("""
                    INSERT INTO appointments (customer_id, service_id, scheduled_date, scheduled_time, 
                                            location_address, status, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    customer_id,
                    service_id,
                    scheduled_date,
                    scheduled_time,
                    body.get('location_address'),
                    'scheduled',
                    body.get('notes')
                ))
                appointment_id = cur.fetchone()[0]
                conn.commit()
                
                # Send confirmation notification if SMS consent given
                if body.get('sms_consent') and body.get('customer_phone'):
                    send_confirmation_notification(appointment_id, body, customer_id)
            
            return {
                "statusCode": 201,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({
                    "id": appointment_id,
                    "message": "Appointment created successfully"
                })
            }
        finally:
            conn.close()
    
    # GET /admin/appointments/today - List today's appointments (admin)
    elif route_key == "GET /admin/appointments/today":
        logger.info(">>> ENTERED GET /admin/appointments/today BRANCH")
        try:
            today = datetime.utcnow().date()
            conn = get_db_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT a.id, a.customer_id, a.service_id, a.scheduled_date, a.scheduled_time, a.status,
                           a.location_address, a.notes, a.created_at,
                           c.name as customer_name, c.email as customer_email, c.phone as customer_phone
                    FROM appointments a
                    LEFT JOIN customers c ON a.customer_id = c.id
                    WHERE a.scheduled_date = %s
                    ORDER BY a.scheduled_time ASC
                """, (today,))
                rows = cur.fetchall()
                for row in rows:
                    if row.get('scheduled_date') and row.get('scheduled_time'):
                        ts = datetime.combine(row['scheduled_date'], row['scheduled_time'])
                        row['scheduled_at'] = ts.isoformat()
                        del row['scheduled_date'], row['scheduled_time']
                    if row.get('created_at'):
                        row['created_at'] = row['created_at'].isoformat()
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({"appointments": rows, "count": len(rows)})
            }
        except Exception as e:
            logger.error(f"Error in GET /admin/appointments/today: {e}")
            return {
                "statusCode": 500,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": str(e)})
            }
        finally:
            if 'conn' in locals():
                conn.close()
                logger.info("Database connection closed.")

    # PUT /admin/appointments/{id} - Update appointment (admin)
    elif route_key.startswith("PUT /admin/appointments/"):
        logger.info(">>> ENTERED PUT /admin/appointments/{{id}} BRANCH")
        try:
            # Extract ID from route
            parts = route_key.split("/")
            appointment_id = parts[-1]
            body = json.loads(event.get('body', '{}'))
            allowed_fields = {'status', 'notes', 'scheduled_date', 'scheduled_time', 'location_address'}
            update_fields = {k: v for k, v in body.items() if k in allowed_fields}
            if not update_fields:
                return {"statusCode": 400, "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}, "body": json.dumps({"error": "No valid fields to update."})}
            set_clause = ", ".join([f"{k} = %s" for k in update_fields.keys()])
            values = list(update_fields.values())
            values.append(appointment_id)
            conn = get_db_connection()
            with conn.cursor() as cur:
                cur.execute(f"""
                    UPDATE appointments SET {set_clause}
                    WHERE id = %s RETURNING id
                """, values)
                if cur.rowcount == 0:
                    return {"statusCode": 404, "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}, "body": json.dumps({"error": "Appointment not found."})}
                conn.commit()
            return {"statusCode": 200, "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}, "body": json.dumps({"message": "Appointment updated successfully."})}
        except Exception as e:
            logger.error(f"Error in PUT /admin/appointments/{{id}}: {e}")
            return {"statusCode": 500, "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}, "body": json.dumps({"error": str(e)})}
        finally:
            if 'conn' in locals():
                conn.close()
                logger.info("Database connection closed.")
    
    # No route matched
    else:
        return {
            "statusCode": 404,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "error": "Route not found",
                "route_received": route_key
            })
        }

def handle_customer_with_sms_consent(cur, body):
    """
    Handle customer creation/update with SMS consent tracking
    """
    from datetime import datetime
    
    customer_name = body.get('customer_id', 'Unknown')  # Using customer_id as name for now
    customer_phone = body.get('customer_phone', '')
    customer_email = body.get('customer_email', '')
    sms_consent = body.get('sms_consent', False)
    sms_consent_ip = body.get('sms_consent_ip')
    
    # Check if customer exists by phone or email
    customer_id = None
    if customer_phone:
        cur.execute("SELECT id FROM customers WHERE phone = %s", (customer_phone,))
        result = cur.fetchone()
        if result:
            customer_id = result[0]
    
    if not customer_id and customer_email:
        cur.execute("SELECT id FROM customers WHERE email = %s", (customer_email,))
        result = cur.fetchone()
        if result:
            customer_id = result[0]
    
    if customer_id:
        # Update existing customer's SMS consent if provided
        if sms_consent and customer_phone:
            cur.execute("""
                UPDATE customers 
                SET sms_consent = %s, 
                    sms_consent_date = CURRENT_TIMESTAMP,
                    sms_consent_ip = %s,
                    sms_opt_out = FALSE,
                    sms_opt_out_date = NULL,
                    sms_opt_out_method = NULL
                WHERE id = %s
            """, (sms_consent, sms_consent_ip, customer_id))
            logger.info(f"Updated SMS consent for customer {customer_id}")
    else:
        # Create new customer with SMS consent
        cur.execute("""
            INSERT INTO customers (name, phone, email, sms_consent, sms_consent_date, sms_consent_ip)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            customer_name,
            customer_phone if customer_phone else None,
            customer_email if customer_email else None,
            sms_consent if customer_phone else False,
            datetime.utcnow() if sms_consent and customer_phone else None,
            sms_consent_ip if sms_consent and customer_phone else None
        ))
        customer_id = cur.fetchone()[0]
        logger.info(f"Created new customer {customer_id} with SMS consent: {sms_consent}")
    
    return customer_id

def send_confirmation_notification(appointment_id, body, customer_id):
    """
    Send appointment confirmation notification via SNS
    """
    try:
        topic_arn = os.environ.get("NOTIFY_TOPIC_ARN")
        if not topic_arn:
            logger.warning("No NOTIFY_TOPIC_ARN configured, skipping notification")
            return
        
        sns = boto3.client("sns")
        
        notification_data = {
            "type": "appointment_confirmation",
            "appointment_id": appointment_id,
            "customer_id": customer_id,
            "customer_name": body.get('customer_id', 'Customer'),
            "customer_phone": body.get('customer_phone'),
            "customer_email": body.get('customer_email'),
            "service": body.get('service'),
            "appointment_time": body.get('requested_time'),
            "location_address": body.get('location_address'),
            "notes": body.get('notes')
        }
        
        response = sns.publish(
            TopicArn=topic_arn,
            Message=json.dumps(notification_data),
            Subject='Edgar Auto Shop - Appointment Confirmation'
        )
        
        logger.info(f"Confirmation notification sent for appointment {appointment_id}: {response['MessageId']}")
        
    except Exception as e:
        logger.error(f"Failed to send confirmation notification: {str(e)}")
        # Don't fail the appointment creation if notification fails
