#!/usr/bin/env python3
import json
import boto3
import psycopg2

def main():
    # Get database credentials from Secrets Manager
    secrets_client = boto3.client('secretsmanager', region_name='us-west-2')
    secret_value = secrets_client.get_secret_value(SecretId='arn:aws:secretsmanager:us-west-2:588738589514:secret:edgar/rds/master-credentials-0K6opS')
    secret = json.loads(secret_value['SecretString'])
    
    # Read the init.sql file
    with open('database/init.sql', 'r') as f:
        sql_script = f.read()
    
    # Connect to database
    conn = psycopg2.connect(
        host=secret['host'],
        port=secret['port'],
        database=secret['dbname'],
        user=secret['username'],
        password=secret['password']
    )
    
    try:
        with conn.cursor() as cur:
            # Execute the entire SQL script
            cur.execute(sql_script)
            conn.commit()
            print("Database initialized successfully!")
            
            # Verify tables were created
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
            tables = cur.fetchall()
            print("Created tables:", [t[0] for t in tables])
            
    except Exception as e:
        print(f"Error initializing database: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    main()
