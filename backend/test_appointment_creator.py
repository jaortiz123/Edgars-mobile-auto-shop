#!/usr/bin/env python3
"""
Lambda function to create a test appointment scheduled 24-26 hours from now
"""
import json
import boto3
import os
import pg8000.native
from datetime import datetime, timedelta
import logging

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """Create a test appointment with SMS consent enabled"""
    
    try:
        # Get database connection using secrets manager
        db_secret_arn = os.environ.get('DB_SECRET_ARN')
        if not db_secret_arn:
            raise ValueError("DB_SECRET_ARN environment variable not set")
        
        # Get database credentials from Secrets Manager
        secrets_client = boto3.client('secretsmanager')
        secret_response = secrets_client.get_secret_value(SecretId=db_secret_arn)
        secret = json.loads(secret_response['SecretString'])
        
        # Connect to database
        conn = pg8000.native.Connection(
            user=secret['username'],
            password=secret['password'],
            host=secret['host'],
            port=secret['port'],
            database=secret['dbname'],
            ssl_context=True
        )
        
        # Calculate test appointment time (25 hours from now)
        now = datetime.utcnow()
        test_time = now + timedelta(hours=25)
        scheduled_date = test_time.date()
        scheduled_time = test_time.time()
        
        logger.info(f"Creating test appointment for: {test_time}")
        
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
        
        # Get first available service
        service_results = conn.run("SELECT id, name FROM services LIMIT 1")
        if not service_results:
            logger.error("No services found in database")
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'No services found in database'})
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
            scheduled_date=scheduled_date,
            scheduled_time=scheduled_time
        )
        appointment_id = appointment_results[0][0]
        
        logger.info(f"✅ Test appointment created successfully!")
        logger.info(f"   Appointment ID: {appointment_id}")
        logger.info(f"   Customer: Test Customer SMS (+15551234567)")
        logger.info(f"   Service: {service_name}")
        logger.info(f"   Scheduled: {test_time}")
        logger.info(f"   SMS Consent: TRUE")
        logger.info(f"   Location: 123 Test Street, Test City, TS 12345")
        
        # Verify the appointment shows up in our reminder query
        verification_results = conn.run("""
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
            WHERE a.id = :appointment_id
        """, appointment_id=appointment_id)
        
        if verification_results:
            row = verification_results[0]
            logger.info(f"✅ Verification query successful:")
            logger.info(f"   Customer: {row[3]} ({row[4]})")
            logger.info(f"   SMS Consent: {row[5]}, Opt Out: {row[6]}")
            logger.info(f"   Service: {row[7]}")
            logger.info(f"   Scheduled: {row[1]} {row[2]}")
        
        conn.close()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Test appointment created successfully',
                'appointment_id': appointment_id,
                'customer_id': customer_id,
                'scheduled_time': test_time.isoformat(),
                'service': service_name
            })
        }
        
    except Exception as e:
        logger.error(f"Failed to create test appointment: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
