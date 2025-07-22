#!/usr/bin/env python3
"""
Local development server for Edgar's Auto Shop backend.
This provides a simple Flask API that mimics the Lambda functions for local testing.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
from datetime import datetime, timedelta
import logging
import jwt
import bcrypt
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# In-memory storage for local development
users_db = {}
appointments_db = []
customers_db = {}

# JWT secret for local development
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-for-local-dev')

def validate_email(email):
    """Validate email format."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    """Validate password strength."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    return True, "Password is valid"

def hash_password(password):
    """Hash password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed):
    """Verify password against hash."""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def generate_jwt_token(email):
    """Generate JWT token for user."""
    payload = {
        'email': email,
        'exp': datetime.utcnow() + timedelta(hours=24),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_jwt_token(token):
    """Verify JWT token and return email."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload['email']
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok', 'db': 'in-memory'})

# Authentication endpoints
@app.route('/customers/register', methods=['POST'])
def register():
    """Register a new customer."""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({'message': 'Email and password are required'}), 400
            
        if not validate_email(email):
            return jsonify({'message': 'Invalid email format'}), 400
            
        is_valid, message = validate_password(password)
        if not is_valid:
            return jsonify({'message': message}), 400
            
        if email in users_db:
            return jsonify({'message': 'User already exists'}), 409
            
        # Store user with hashed password
        users_db[email] = {
            'email': email,
            'password_hash': hash_password(password),
            'created_at': datetime.utcnow().isoformat(),
            'profile': {
                'vehicles': []
            }
        }
        
        logger.info(f"User registered: {email}")
        return jsonify({'message': 'User registered successfully'}), 201
        
    except Exception as e:
        logger.error(f"Registration error: {e}")
        return jsonify({'message': 'Internal server error'}), 500

@app.route('/customers/login', methods=['POST'])
def login():
    """Login customer."""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({'message': 'Email and password are required'}), 400
            
        user = users_db.get(email)
        if not user:
            return jsonify({'message': 'Invalid credentials'}), 401
            
        if not verify_password(password, user['password_hash']):
            return jsonify({'message': 'Invalid credentials'}), 401
            
        token = generate_jwt_token(email)
        logger.info(f"User logged in: {email}")
        return jsonify({'token': token}), 200
        
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'message': 'Internal server error'}), 500

@app.route('/customers/profile', methods=['GET', 'PUT'])
def profile():
    """Get or update customer profile."""
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'message': 'Authorization token required'}), 401
            
        token = auth_header.split(' ')[1]
        email = verify_jwt_token(token)
        if not email:
            return jsonify({'message': 'Invalid or expired token'}), 401
            
        user = users_db.get(email)
        if not user:
            return jsonify({'message': 'User not found'}), 404
            
        if request.method == 'GET':
            return jsonify({
                'email': user['email'],
                'vehicles': user['profile'].get('vehicles', [])
            }), 200
            
        elif request.method == 'PUT':
            data = request.get_json()
            
            # Update vehicles if provided
            if 'vehicles' in data:
                user['profile']['vehicles'] = data['vehicles']
                
            logger.info(f"Profile updated for: {email}")
            return jsonify({'message': 'Profile updated successfully'}), 200
            
    except Exception as e:
        logger.error(f"Profile error: {e}")
        return jsonify({'message': 'Internal server error'}), 500

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

# Admin notification tracking endpoints
@app.route('/api/admin/notifications', methods=['GET'])
def get_notifications():
    """Get SMS notification tracking records for admin dashboard."""
    try:
        # Mock data for local development
        # In production, this would query DynamoDB
        mock_notifications = [
            {
                'appointment_id': '123',
                'notification_type': '24h_reminder',
                'status': 'sent',
                'timestamp': (datetime.utcnow() - timedelta(hours=2)).isoformat(),
                'customer_name': 'John Doe',
                'customer_phone': '+15551234567'
            },
            {
                'appointment_id': '124',
                'notification_type': '24h_reminder',
                'status': 'failed',
                'timestamp': (datetime.utcnow() - timedelta(hours=1)).isoformat(),
                'customer_name': 'Jane Smith',
                'customer_phone': '+15559876543',
                'error_message': 'Phone number not reachable'
            },
            {
                'appointment_id': '125',
                'notification_type': '1h_reminder',
                'status': 'sent',
                'timestamp': (datetime.utcnow() - timedelta(minutes=30)).isoformat(),
                'customer_name': 'Bob Johnson',
                'customer_phone': '+15555551111'
            }
        ]
        
        # Apply filters from query parameters
        appointment_id = request.args.get('appointment_id')
        status_filter = request.args.get('status')
        
        filtered_notifications = mock_notifications
        
        if appointment_id:
            filtered_notifications = [n for n in filtered_notifications if n['appointment_id'] == appointment_id]
        
        if status_filter and status_filter != 'all':
            filtered_notifications = [n for n in filtered_notifications if n['status'] == status_filter]
        
        return jsonify({
            'notifications': filtered_notifications,
            'count': len(filtered_notifications)
        })
        
    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/notifications/<appointment_id>/retry', methods=['POST'])
def retry_notification(appointment_id):
    """Retry a failed notification."""
    try:
        # Mock retry for local development
        logger.info(f"Retry notification triggered for appointment: {appointment_id}")
        
        # In production, this would trigger the Lambda function
        return jsonify({
            'message': f'Retry triggered for appointment {appointment_id}',
            'appointment_id': appointment_id,
            'status': 'triggered'
        })
        
    except Exception as e:
        logger.error(f"Error retrying notification: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/notifications/stats', methods=['GET'])
def get_notification_stats():
    """Get aggregated notification statistics."""
    try:
        # Mock stats for local development
        hours = int(request.args.get('hours', 24))
        
        mock_stats = {
            'total': 15,
            'sent': 12,
            'failed': 2,
            'pending': 1,
            'success_rate': 85.7,
            'by_type': {
                '24h_reminder': {'total': 10, 'sent': 8, 'failed': 2},
                '1h_reminder': {'total': 5, 'sent': 4, 'failed': 0}
            },
            'recent_failures': [
                {
                    'appointment_id': '124',
                    'notification_type': '24h_reminder',
                    'timestamp': (datetime.utcnow() - timedelta(hours=1)).isoformat(),
                    'error_message': 'Phone number not reachable'
                }
            ]
        }
        
        return jsonify({
            'stats': mock_stats,
            'period_hours': hours,
            'generated_at': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error getting notification stats: {e}")
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
            '/api/init-db',
            '/api/admin/notifications',
            '/api/admin/notifications/stats',
            '/api/admin/notifications/{id}/retry'
        ]
    })

if __name__ == '__main__':
    port = int(os.getenv("FLASK_RUN_PORT", 5000))
    logger.info(f"Starting Edgar's Auto Shop Local API Server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)
