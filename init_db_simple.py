#!/usr/bin/env python3
import json
import os
import boto3
import psycopg2

def main():
    # Get database credentials from AWS Secrets Manager
    secrets_client = boto3.client('secretsmanager', region_name='us-west-2')
    secret_value = secrets_client.get_secret_value(SecretId='arn:aws:secretsmanager:us-west-2:588738589514:secret:rds-db-credentials/cluster-TF5CDWLWGB2WFGPYETQWQRPJ4Q/postgres-7fZdgZ')
    secret = json.loads(secret_value['SecretString'])
    
    # Connect to database
    conn = psycopg2.connect(
        host=secret['host'],
        port=secret['port'],
        database=secret['dbname'],
        user=secret['username'],
        password=secret['password']
    )
    
    print("Connected to database successfully!")
    
    # Create tables
    with conn.cursor() as cur:
        # Create customers table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS customers (
              id SERIAL PRIMARY KEY,
              name VARCHAR(255) NOT NULL,
              phone VARCHAR(20),
              email VARCHAR(255),
              address TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Create vehicles table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS vehicles (
              id SERIAL PRIMARY KEY,
              customer_id INTEGER REFERENCES customers(id),
              make VARCHAR(100),
              model VARCHAR(100),
              year INTEGER,
              license_plate VARCHAR(20),
              notes TEXT
            );
        """)
        
        # Create services table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS services (
              id SERIAL PRIMARY KEY,
              name VARCHAR(255) NOT NULL,
              description TEXT,
              duration_minutes INTEGER,
              base_price DECIMAL(10,2)
            );
        """)
        
        # Create appointments table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS appointments (
              id SERIAL PRIMARY KEY,
              customer_id INTEGER REFERENCES customers(id),
              vehicle_id INTEGER REFERENCES vehicles(id),
              service_id INTEGER REFERENCES services(id),
              scheduled_date DATE,
              scheduled_time TIME,
              location_address TEXT,
              status VARCHAR(50) DEFAULT 'scheduled',
              notes TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Insert default services
        cur.execute("""
            INSERT INTO services (name, description, duration_minutes, base_price) 
            VALUES 
                ('Oil Change', 'Standard oil change with filter', 30, 45.00),
                ('Brake Inspection', 'Complete brake system inspection', 45, 65.00),
                ('Battery Replacement', 'Replace car battery', 20, 120.00),
                ('Tire Rotation', 'Rotate and balance tires', 45, 50.00)
            ON CONFLICT DO NOTHING;
        """)
        
        # Create indexes
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
        """)
        
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_appointments_schedule 
            ON appointments(scheduled_date, scheduled_time);
        """)
        
        conn.commit()
        print("All tables and indexes created successfully!")
        
        # Verify tables exist
        cur.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        tables = cur.fetchall()
        print(f"Tables in database: {[t[0] for t in tables]}")

    conn.close()
    print("Database initialization complete!")

if __name__ == "__main__":
    main()
