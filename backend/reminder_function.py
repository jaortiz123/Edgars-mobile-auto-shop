import json
import boto3
import os
import pg8000.native
from datetime import datetime, timedelta
import logging

# Defer boto3 client/resource initialization to runtime (avoid requiring region at import)
_SNS_CLIENT = None
_DDB_RESOURCE = None
_CLOUDWATCH_CLIENT = None

# Module-level stub attributes expected by tests for monkeypatching
dynamodb = None  # type: ignore
sns = None  # type: ignore
cloudwatch = None  # optional consistency

def get_sns_client():
    global _SNS_CLIENT
    if _SNS_CLIENT is None:
        _SNS_CLIENT = boto3.client('sns')
    return _SNS_CLIENT

def get_dynamodb_resource():
    global _DDB_RESOURCE
    if _DDB_RESOURCE is None:
        _DDB_RESOURCE = boto3.resource('dynamodb')
    return _DDB_RESOURCE

def get_cloudwatch_client():
    global _CLOUDWATCH_CLIENT
    if _CLOUDWATCH_CLIENT is None:
        _CLOUDWATCH_CLIENT = boto3.client('cloudwatch')
    return _CLOUDWATCH_CLIENT

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """
    Lambda to send 24h appointment reminders via SNS
    Triggered by EventBridge scheduled rule
    Queries RDS for appointments in next 24-26 hours and sends reminders
    """
    try:
        # Check if this is a test mode run to create test data
        if event.get('test_mode') == 'create_appointment':
            return create_test_appointment(event, context)
        
        # Get environment variables
        topic_arn = os.environ.get('SNS_TOPIC_ARN')
        db_secret_arn = os.environ.get('DB_SECRET_ARN')
        notification_tracking_table = os.environ.get('NOTIFICATION_TRACKING_TABLE')
        
        if not topic_arn:
            raise ValueError("SNS_TOPIC_ARN environment variable not set")
        if not db_secret_arn:
            raise ValueError("DB_SECRET_ARN environment variable not set")
        if not notification_tracking_table:
            raise ValueError("NOTIFICATION_TRACKING_TABLE environment variable not set")
            
        logger.info("Starting 24-hour appointment reminder process")
        
        # Get database connection
        conn = get_db_connection(db_secret_arn)
        tracking_table = get_dynamodb_resource().Table(notification_tracking_table)
        
        # Query for appointments in next 24-26 hours
        upcoming_appointments = query_upcoming_appointments(conn)
        logger.info(f"📋 Found {len(upcoming_appointments)} appointments in next 24-26 hours")
        
        # Log details of found appointments for debugging
        for i, apt in enumerate(upcoming_appointments):
            logger.info(f"   Appointment {i+1}: ID={apt['id']}, Customer={apt['customer_name']}, "
                       f"Phone={apt['customer_phone']}, Service={apt['service_name']}, "
                       f"Time={apt['appointment_datetime']}")
        
        reminders_sent = 0
        
        for appointment in upcoming_appointments:
            try:
                # Check if reminder already sent
                if not is_reminder_already_sent(tracking_table, appointment['id']):
                    # Send reminder
                    send_appointment_reminder(topic_arn, appointment)
                    
                    # Track notification
                    track_notification(tracking_table, appointment['id'], 'reminder_24h', 'sent')
                    reminders_sent += 1
                    logger.info(f"Sent reminder for appointment {appointment['id']}")
                else:
                    logger.info(f"Reminder already sent for appointment {appointment['id']}")
                    
            except Exception as e:
                logger.error(f"Failed to send reminder for appointment {appointment['id']}: {str(e)}")
                # Track failed notification
                track_notification(tracking_table, appointment['id'], 'reminder_24h', 'failed', str(e))
        
        conn.close()
        
        # Publish CloudWatch metrics
        publish_reminder_metrics(len(upcoming_appointments), reminders_sent)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Processed {len(upcoming_appointments)} appointments, sent {reminders_sent} reminders',
                'appointments_found': len(upcoming_appointments),
                'reminders_sent': reminders_sent
            })
        }
        
    except Exception as e:
        logger.error(f"Error in reminder function: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def get_db_connection(db_secret_arn):
    """Get database connection using secrets manager"""
    try:
        secrets_client = boto3.client('secretsmanager')
        secret_value = secrets_client.get_secret_value(SecretId=db_secret_arn)
        secret = json.loads(secret_value['SecretString'])
        
        conn = pg8000.native.Connection(
            user=secret['username'],
            password=secret['password'],
            host=secret['host'],
            port=secret['port'],
            database=secret['dbname'],
            ssl_context=True  # Enable SSL for RDS
        )
        logger.info("Database connection established")
        return conn
        
    except Exception as e:
        logger.error(f"Failed to connect to database: {str(e)}")
        raise

def query_upcoming_appointments(conn):
    """Query for appointments scheduled in next 24-26 hours"""
    try:
        # Calculate time window: 24-26 hours from now
        now = datetime.utcnow()
        start_time = now + timedelta(hours=24)
        end_time = now + timedelta(hours=26)
        
        logger.info(f"🔍 Querying appointments between {start_time} and {end_time}")
        logger.info(f"   Looking for date: {start_time.date()}")
        logger.info(f"   Time window: {start_time.time()} to {end_time.time()}")
        
        # First, let's see how many total appointments exist
        total_appointments = conn.run("SELECT COUNT(*) FROM appointments")
        logger.info(f"📊 Total appointments in database: {total_appointments[0][0]}")
        
        # Check how many appointments are scheduled for the target date
        date_appointments = conn.run(
            "SELECT COUNT(*) FROM appointments WHERE scheduled_date = :date",
            date=start_time.date()
        )
        logger.info(f"📅 Appointments on {start_time.date()}: {date_appointments[0][0]}")
        
        # Check how many have customers with SMS consent
        sms_appointments = conn.run("""
            SELECT COUNT(*) FROM appointments a
            LEFT JOIN customers c ON a.customer_id = c.id
            WHERE a.scheduled_date = :date 
                AND c.sms_consent = TRUE
                AND (c.sms_opt_out IS NULL OR c.sms_opt_out = FALSE)
        """, date=start_time.date())
        logger.info(f"📱 Appointments with SMS consent on {start_time.date()}: {sms_appointments[0][0]}")
        
        # Query appointments with customer details and SMS consent
        results = conn.run("""
            SELECT 
                a.id,
                a.scheduled_date,
                a.scheduled_time,
                a.location_address,
                a.notes,
                c.name as customer_name,
                c.phone as customer_phone,
                c.email as customer_email,
                c.sms_consent,
                c.sms_opt_out,
                s.name as service_name,
                s.description as service_description
            FROM appointments a
            LEFT JOIN customers c ON a.customer_id = c.id
            LEFT JOIN services s ON a.service_id = s.id
            WHERE a.scheduled_date = :start_date
                AND a.scheduled_time BETWEEN :start_time AND :end_time
                AND a.status = 'scheduled'
                AND c.phone IS NOT NULL
                AND c.sms_consent = TRUE
                AND (c.sms_opt_out IS NULL OR c.sms_opt_out = FALSE)
            ORDER BY a.scheduled_time ASC
        """, start_date=start_time.date(), start_time=start_time.time(), end_time=end_time.time())
        
        # Convert to list of dicts and add combined datetime
        appointments = []
        for row in results:
            # Support both tuple and dict rows
            if isinstance(row, dict):
                apt_dict = {
                    'id': row.get('id'),
                    'scheduled_date': row.get('scheduled_date'),
                    'scheduled_time': row.get('scheduled_time'),
                    'location_address': row.get('location_address'),
                    'notes': row.get('notes'),
                    'customer_name': row.get('customer_name'),
                    'customer_phone': row.get('customer_phone'),
                    'customer_email': row.get('customer_email'),
                    'service_name': row.get('service_name'),
                    'service_description': row.get('service_description')
                }
            else:
                apt_dict = {
                    'id': row[0],
                    'scheduled_date': row[1],
                    'scheduled_time': row[2],
                    'location_address': row[3],
                    'notes': row[4],
                    'customer_name': row[5],
                    'customer_phone': row[6],
                    'customer_email': row[7],
                    'service_name': row[10],
                    'service_description': row[11]
                }
         
            if apt_dict.get('scheduled_date') and apt_dict.get('scheduled_time'):
                apt_datetime = datetime.combine(apt_dict['scheduled_date'], apt_dict['scheduled_time'])
                apt_dict['appointment_datetime'] = apt_datetime.isoformat()
            appointments.append(apt_dict)
        
        return appointments
        
    except Exception as e:
        logger.error(f"Failed to query appointments: {str(e)}")
        raise

def is_reminder_already_sent(tracking_table, appointment_id):
    """Check if 24h reminder was already sent for this appointment"""
    try:
        response = tracking_table.get_item(
            Key={
                'appointment_id': str(appointment_id),
                'notification_type': 'reminder_24h'
            }
        )
        
        if 'Item' in response:
            return response['Item']['status'] == 'sent'
        return False
        
    except Exception as e:
        logger.error(f"Failed to check notification tracking: {str(e)}")
        return False  # If we can't check, send the reminder anyway

def send_appointment_reminder(topic_arn, appointment):
    """Send appointment reminder via SNS"""
    try:
        reminder_data = {
            'type': 'reminder_24h',
            'appointment_id': appointment['id'],
            'customer_name': appointment['customer_name'] or 'Customer',
            'customer_phone': appointment['customer_phone'],
            'appointment_time': appointment['appointment_datetime'],
            'service': appointment['service_name'] or 'Auto Service',
            'service_description': appointment['service_description'],
            'location_address': appointment['location_address'],
            'notes': appointment['notes']
        }
        # Prefer patched/mocked sns module attribute when provided by tests
        sns_client = sns if (sns is not None and hasattr(sns, 'publish')) else get_sns_client()
        response = sns_client.publish(
            TopicArn=topic_arn,
            Message=json.dumps(reminder_data),
            Subject='Edgar Auto Shop - 24h Reminder'
        )
        logger.info(f"SNS message sent for appointment {appointment['id']}: {response['MessageId']}")
        return response
    except Exception as e:
        logger.error(f"Failed to send SNS message: {str(e)}")
        raise

def track_notification(tracking_table, appointment_id, notification_type, status, error_message=None):
    """Track notification status in DynamoDB"""
    try:
        item = {
            'appointment_id': str(appointment_id),
            'notification_type': notification_type,
            'status': status,
            'timestamp': datetime.utcnow().isoformat(),
            'ttl': int((datetime.utcnow() + timedelta(days=30)).timestamp())  # Auto-delete after 30 days
        }
        
        if error_message:
            item['error_message'] = error_message
            
        tracking_table.put_item(Item=item)
        logger.info(f"Tracked notification: {appointment_id} - {notification_type} - {status}")
        
    except Exception as e:
        logger.error(f"Failed to track notification: {str(e)}")
        # Don't raise here - tracking failure shouldn't stop the reminder

def create_test_appointment(event, context):
    """Create a test appointment scheduled 25 hours from now for testing"""
    try:
        # Get database connection
        db_secret_arn = os.environ.get('DB_SECRET_ARN')
        if not db_secret_arn:
            raise ValueError("DB_SECRET_ARN environment variable not set")
        
        conn = get_db_connection(db_secret_arn)
        
        # Query for appointments in next 24-26 hours
        upcoming_appointments = query_upcoming_appointments(conn)
        
        logger.info(f"Creating test appointment for: {upcoming_appointments[0]['appointment_datetime']}")
        
        # Check if test customer exists
        results = conn.run("SELECT id FROM customers WHERE phone = '+15551234567'")
        
        if results:
            customer_id = results[0][0]
            logger.info(f"Found existing test customer with ID: {customer_id}")
            
            # Update SMS consent for existing customer
            conn.run("""
                UPDATE customers 
                SET sms_consent = TRUE, 
                    sms_consent_date = CURRENT_TIMESTAMP,
                    sms_opt_out = FALSE
                WHERE id = :customer_id
            """, customer_id=customer_id)
            logger.info(f"Updated SMS consent for existing customer")
        else:
            # Create new test customer
            results = conn.run("""
                INSERT INTO customers (name, phone, email, sms_consent, sms_consent_date, sms_consent_ip, sms_opt_out)
                VALUES ('Test Customer SMS', '+15551234567', 'test@example.com', TRUE, CURRENT_TIMESTAMP, '192.168.1.1', FALSE)
                RETURNING id
            """)
            customer_id = results[0][0]
            logger.info(f"Created new test customer with ID: {customer_id}")
        
        # Get first available service, create one if none exist
        service_results = conn.run("SELECT id, name FROM services LIMIT 1")
        if not service_results:
            logger.info("No services found, creating default service")
            # Create a default service
            conn.run("""
                INSERT INTO services (name, description, duration_minutes, base_price)
                VALUES ('Oil Change', 'Standard oil change with filter', 30, 45.00)
                ON CONFLICT DO NOTHING
            """)
            # Get the service we just created
            service_results = conn.run("SELECT id, name FROM services WHERE name = 'Oil Change'")
            if not service_results:
                logger.error("Failed to create default service")
                return {
                    'statusCode': 500,
                    'body': json.dumps({'error': 'Failed to create default service'})
                }
        
        service_id, service_name = service_results[0]
        logger.info(f"Using service: {service_name} (ID: {service_id})")
        
        # Create test appointment
        appointment_results = conn.run("""
            INSERT INTO appointments (customer_id, service_id, scheduled_date, scheduled_time, 
                                    location_address, status, notes)
            VALUES (:customer_id, :service_id, :scheduled_date, :scheduled_time, 
                   '123 Test Street, Test City, TS 12345', 'scheduled', 'Test appointment for SMS reminder testing')
            RETURNING id
        """, 
            customer_id=customer_id,
            service_id=service_id,
            scheduled_date=upcoming_appointments[0]['scheduled_date'],
            scheduled_time=upcoming_appointments[0]['scheduled_time']
        )
        appointment_id = appointment_results[0][0]
        
        logger.info(f"✅ Test appointment created successfully!")
        logger.info(f"   Appointment ID: {appointment_id}")
        logger.info(f"   Customer: Test Customer SMS (+15551234567)")
        logger.info(f"   Service: {service_name}")
        logger.info(f"   Scheduled: {upcoming_appointments[0]['appointment_datetime']}")
        logger.info(f"   SMS Consent: TRUE")
        
        conn.close()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Test appointment created successfully',
                'appointment_id': appointment_id,
                'customer_id': customer_id,
                'scheduled_time': upcoming_appointments[0]['appointment_datetime'],
                'service': service_name
            })
        }
        
    except Exception as e:
        logger.error(f"Failed to create test appointment: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def publish_reminder_metrics(appointments_found: int, reminders_sent: int):
    """Publish custom CloudWatch metrics for monitoring"""
    try:
        cloudwatch_client = get_cloudwatch_client()
        cloudwatch_client.put_metric_data(
            Namespace='Edgar/SMS',
            MetricData=[
                {
                    'MetricName': 'AppointmentsProcessed',
                    'Value': appointments_found,
                    'Unit': 'Count',
                    'Timestamp': datetime.utcnow()
                },
                {
                    'MetricName': 'RemindersSent',
                    'Value': reminders_sent,
                    'Unit': 'Count',
                    'Timestamp': datetime.utcnow()
                },
                {
                    'MetricName': 'SuccessRate',
                    'Value': (reminders_sent / appointments_found * 100) if appointments_found > 0 else 100,
                    'Unit': 'Percent',
                    'Timestamp': datetime.utcnow()
                }
            ]
        )
        logger.info(f"📊 Published CloudWatch metrics: {appointments_found} processed, {reminders_sent} sent")
    except Exception as e:
        logger.error(f"Failed to publish CloudWatch metrics: {str(e)}")
        # Don't raise - metrics failure shouldn't stop the function
