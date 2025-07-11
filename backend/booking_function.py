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
                # First, get the service_id from service name if provided
                service_id = body.get('service_id')
                if not service_id and body.get('service_name'):
                    cur.execute("SELECT id FROM services WHERE name = %s", (body['service_name'],))
                    result = cur.fetchone()
                    service_id = result[0] if result else None
                
                cur.execute("""
                    INSERT INTO appointments (customer_id, service_id, scheduled_date, scheduled_time, 
                                            location_address, status, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    body.get('customer_id'),
                    service_id,
                    body.get('scheduled_date'),
                    body.get('scheduled_time'),
                    body.get('location_address'),
                    'scheduled',
                    body.get('notes')
                ))
                appointment_id = cur.fetchone()[0]
                conn.commit()
                
                # Publish notification to SNS
                if os.environ.get("NOTIFY_TOPIC_ARN"):
                    sns = boto3.client("sns")
                    sns.publish(
                        TopicArn=os.environ["NOTIFY_TOPIC_ARN"],
                        Message=json.dumps({
                            "appointment_id": appointment_id,
                            "customer_phone": body["customer_phone"],
                            "service": body["service"],
                            "scheduled_at": body["scheduled_at"]
                        })
                    )
            
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
