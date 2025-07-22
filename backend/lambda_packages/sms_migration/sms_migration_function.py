import json
import boto3
import os
import pg8000.native
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """
    Lambda function to run SMS consent database migration
    """
    try:
        # Get database credentials from Secrets Manager
        secrets_manager = boto3.client('secretsmanager')
        secret_arn = os.environ['DB_SECRET_ARN']
        
        response = secrets_manager.get_secret_value(SecretId=secret_arn)
        secret = json.loads(response['SecretString'])
        
        # Connect to database with SSL
        conn = pg8000.native.Connection(
            user=secret['username'],
            password=secret['password'],
            host=secret['host'],
            port=secret['port'],
            database=secret['dbname'],
            ssl_context=True
        )
        
        logger.info("Connected to database successfully")
        
        # Execute migration SQL
        migration_sql = """
        -- SMS Consent Migration for TCPA Compliance
        -- Adds SMS consent tracking fields to customers table

        -- Add SMS consent fields to customers table
        ALTER TABLE customers 
        ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS sms_consent_date TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS sms_consent_ip VARCHAR(45) NULL,
        ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS sms_opt_out_date TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS sms_opt_out_method VARCHAR(20) NULL; -- 'STOP', 'WEB', 'CALL'

        -- Add index for SMS queries
        CREATE INDEX IF NOT EXISTS idx_customers_sms_consent ON customers(sms_consent, sms_opt_out);

        -- Update existing customers to maintain current SMS behavior (opt them in if they have a phone)
        -- This ensures existing functionality continues to work
        UPDATE customers 
        SET sms_consent = TRUE, 
            sms_consent_date = created_at 
        WHERE phone IS NOT NULL 
          AND phone != '' 
          AND sms_consent IS NULL;
        """
        
        # Execute the migration
        conn.run(migration_sql)
        logger.info("Migration SQL executed successfully")
        
        # Verify the new columns
        columns_result = conn.run("""
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'customers' 
            AND column_name LIKE 'sms_%'
            ORDER BY column_name;
        """)
        
        logger.info(f"SMS consent columns verified: {len(columns_result)} columns added")
        for col in columns_result:
            logger.info(f"  - {col[0]}: {col[1]} (nullable: {col[2]}, default: {col[3]})")
        
        # Check how many customers were updated
        count_result = conn.run("""
            SELECT COUNT(*) FROM customers WHERE sms_consent = TRUE;
        """)
        
        logger.info(f"Updated {count_result[0][0]} existing customers with SMS consent")
        
        conn.close()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'SMS consent migration completed successfully',
                'columns_added': len(columns_result),
                'customers_updated': count_result[0][0]
            })
        }
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }
