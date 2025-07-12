#!/usr/bin/env python3
"""
Local development server for Edgar's Auto Shop backend.
This provides a simple Flask API that mimics the Lambda functions for local testing.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import os
import json
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

def get_db_connection():
    """Get a connection to the PostgreSQL database."""
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'db'),
        database=os.getenv('POSTGRES_DB', 'autoshop'),
        user=os.getenv('POSTGRES_USER', 'user'),
        password=os.getenv('POSTGRES_PASSWORD', 'password'),
        port=5432
    )

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    try:
        conn = get_db_connection()
        conn.close()
        return jsonify({'status': 'ok', 'db': 'connected'})
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({'status': 'error', 'db': 'disconnected', 'error': str(e)}), 500

@app.route('/api/appointments', methods=['GET', 'POST'])
def appointments():
    """Handle appointment listing and creation."""
    if request.method == 'GET':
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute('SELECT * FROM appointments ORDER BY created_at DESC')
            appointments = []
            for row in cur.fetchall():
                try:
                    # Convert all values to JSON serializable formats
                    appointment = {
                        'id': row[0],
                        'customer_id': str(row[1]) if row[1] else None,
                        'service_id': int(row[2]) if row[2] else None,
                        'scheduled_date': str(row[3]) if row[3] else None,
                        'scheduled_time': str(row[4]) if row[4] else None,
                        'location_address': str(row[5]) if row[5] else None,
                        'notes': str(row[6]) if row[6] else None,
                        'created_at': str(row[7]) if row[7] else None
                    }
                    appointments.append(appointment)
                except Exception as field_error:
                    logger.error(f"Error processing row {row}: {field_error}")
                    # Skip this row and continue
            cur.close()
            conn.close()
            return jsonify({'appointments': appointments})
        except Exception as e:
            logger.error(f"Failed to fetch appointments: {e}")
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            logger.info(f"Creating appointment with data: {data}")
            
            conn = get_db_connection()
            cur = conn.cursor()
            
            # Parse the requested_time
            requested_time = datetime.fromisoformat(data['requested_time'].replace('Z', '+00:00'))
            
            cur.execute('''
                INSERT INTO appointments (customer_id, service_id, scheduled_date, scheduled_time, location_address, notes)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
            ''', (
                data.get('customer_id', 'Unknown'),
                1,  # Default service_id
                requested_time.date(),
                requested_time.time(),
                data.get('address', 'Not provided'),
                data.get('notes', '')
            ))
            
            appointment_id = cur.fetchone()[0]
            conn.commit()
            cur.close()
            conn.close()
            
            logger.info(f"Created appointment with ID: {appointment_id}")
            return jsonify({'id': appointment_id, 'message': 'Appointment created successfully'})
        except Exception as e:
            logger.error(f"Failed to create appointment: {e}")
            return jsonify({'error': str(e)}), 500

@app.route('/api/customers', methods=['GET', 'POST'])
def customers():
    """Handle customer listing and creation."""
    if request.method == 'GET':
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute('SELECT * FROM customers ORDER BY id DESC')
            customers = []
            for row in cur.fetchall():
                customers.append({
                    'id': row[0],
                    'name': str(row[1]) if row[1] else None,
                    'email': str(row[2]) if row[2] else None,
                    'phone': str(row[3]) if row[3] else None,
                    'created_at': str(row[4]) if row[4] else None
                })
            cur.close()
            conn.close()
            return jsonify({'customers': customers})
        except Exception as e:
            logger.error(f"Failed to fetch customers: {e}")
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            logger.info(f"Creating customer with data: {data}")
            
            conn = get_db_connection()
            cur = conn.cursor()
            
            cur.execute('''
                INSERT INTO customers (name, email, phone)
                VALUES (%s, %s, %s) RETURNING id
            ''', (
                data.get('name', 'Unknown'),
                data.get('email', ''),
                data.get('phone', '')
            ))
            
            customer_id = cur.fetchone()[0]
            conn.commit()
            cur.close()
            conn.close()
            
            logger.info(f"Created customer with ID: {customer_id}")
            return jsonify({'id': customer_id, 'message': 'Customer created successfully'})
        except Exception as e:
            logger.error(f"Failed to create customer: {e}")
            return jsonify({'error': str(e)}), 500

@app.route('/api/init-db', methods=['GET'])
def init_db():
    """Initialize the database with required tables."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Create customers table if it doesn't exist
        cur.execute('''
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255),
                phone VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create appointments table if it doesn't exist
        cur.execute('''
            CREATE TABLE IF NOT EXISTS appointments (
                id SERIAL PRIMARY KEY,
                customer_id INTEGER REFERENCES customers(id),
                service_id INTEGER,
                scheduled_date DATE,
                scheduled_time TIME,
                location_address TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Insert a default customer if none exists
        cur.execute('SELECT COUNT(*) FROM customers')
        if cur.fetchone()[0] == 0:
            cur.execute('''
                INSERT INTO customers (name, email, phone)
                VALUES ('Default Customer', 'customer@example.com', '555-0123')
            ''')
        
        # Create customers table if it doesn't exist
        cur.execute('''
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255),
                phone VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info("Database initialized successfully")
        return jsonify({'message': 'Database initialized successfully'})
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/', methods=['GET'])
def root():
    """Root endpoint."""
    return jsonify({
        'message': "Edgar's Auto Shop Local API Server",
        'endpoints': [
            '/health',
            '/api/appointments',
            '/api/customers',
            '/api/init-db'
        ]
    })

if __name__ == '__main__':
    logger.info("Starting Edgar's Auto Shop Local API Server...")
    app.run(host='0.0.0.0', port=3001, debug=True)
