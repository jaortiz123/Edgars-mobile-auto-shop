import json
import os
import boto3
import psycopg2
from botocore.exceptions import ClientError

# Initialize clients outside the handler for performance.
# This allows Lambda to reuse the clients across invocations.
secrets_manager = boto3.client('secretsmanager')

db_secret = None

def get_db_credentials():
    """Fetches database credentials from AWS Secrets Manager with caching."""
    global db_secret
    if db_secret:
        return db_secret
    
    secret_arn = os.environ.get('DB_SECRET_ARN')
    if not secret_arn:
        raise ValueError("DB_SECRET_ARN environment variable not set.")
        
    print("Fetching credentials from Secrets Manager...")
    try:
        response = secrets_manager.get_secret_value(SecretId=secret_arn)
        db_secret = json.loads(response['SecretString'])
        return db_secret
    except ClientError as e:
        print(f"Error fetching secret: {e}")
        raise e

def lambda_handler(event, context):
    """
    Acts as a router for different API requests based on the routeKey.
    Handles connections to the PostgreSQL database.
    """
    route_key = event.get('routeKey')
    print(f"Request received for route: {route_key}")
    
    conn = None
    try:
        # Establish database connection
        credentials = get_db_credentials()
        print("Attempting to connect to the database...")
        conn = psycopg2.connect(
            host=credentials['host'],
            port=credentials['port'],
            dbname=credentials['dbname'],
            user=credentials['username'],
            password=credentials['password'],
            connect_timeout=5
        )
        print("Database connection successful.")

        # --- ROUTER LOGIC ---
        if route_key == "POST /appointments":
            body = json.loads(event.get("body", "{}"))
            # In a real app, you would add logic here to create the appointment
            # For this test, we just confirm we can connect and receive data.
            return {
                "statusCode": 201,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({
                    "message": "Appointment creation endpoint reached successfully",
                    "received_data": body
                })
            }
        else:
            return {"statusCode": 404, "body": json.dumps({"error": f"Route '{route_key}' not found"})}

    except psycopg2.Error as e:
        print(f"Database connection error: {e}")
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to connect to database"})}
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return {"statusCode": 500, "body": json.dumps({"error": "Internal Server Error"})}
    finally:
        # Ensure the connection is always closed.
        if conn is not None:
            conn.close()
            print("Database connection closed.")
