import json
import boto3
import os
import pg8000.native
from datetime import datetime, timedelta
import logging

# Initialize AWS clients
sns = boto3.client('sns')
dynamodb = boto3.resource('dynamodb')

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
        tracking_table = dynamodb.Table(notification_tracking_table)
        
        # Query for appointments in next 24-26 hours
        upcoming_appointments = query_upcoming_appointments(conn)
        logger.info(f"Found {len(upcoming_appointments)} appointments in next 24-26 hours")
        
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
            apt_dict = {
                'id': row[0],
                'scheduled_date': row[1],
                'scheduled_time': row[2],
                'location_address': row[3],
                'notes': row[4],
                'customer_name': row[5],
                'customer_phone': row[6],
                'customer_email': row[7],
                'sms_consent': row[8],
                'sms_opt_out': row[9],
                'service_name': row[10],
                'service_description': row[11]
            }
            
            if apt_dict['scheduled_date'] and apt_dict['scheduled_time']:
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
        
        response = sns.publish(
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
