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
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# In-memory storage for local development
users_db = {}
appointments_db = [
    {
        'id': '1',
        'customer_id': 'john_smith',
        'service_id': 1,
        'scheduled_date': '2025-07-22',
        'scheduled_time': '09:00:00',
        'location_address': '123 Main St, Anytown',
        'notes': 'Oil change and inspection',
        'status': 'scheduled',
        'created_at': '2025-07-22T09:00:00'
    },
    {
        'id': '2',
        'customer_id': 'jane_doe',
        'service_id': 2,
        'scheduled_date': '2025-07-22',
        'scheduled_time': '14:00:00',
        'location_address': '456 Oak Ave, Anytown',
        'notes': 'Brake inspection',
        'status': 'scheduled',
        'created_at': '2025-07-22T14:00:00'
    },
    {
        'id': '3',
        'customer_id': 'bob_wilson',
        'service_id': 3,
        'scheduled_date': '2025-07-22',
        'scheduled_time': '16:30:00',
        'location_address': '789 Pine St, Anytown',
        'notes': 'Tire rotation and alignment',
        'status': 'in-progress',
        'created_at': '2025-07-22T16:30:00'
    }
]
customers_db = {}

# JWT secret for local development
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-for-local-dev')

def get_db_connection():
    """Get database connection for local development."""
    try:
        # Use environment variables from .env file
        db_config = {
            'host': os.getenv('POSTGRES_HOST', 'localhost'),
            'port': int(os.getenv('POSTGRES_PORT', 5432)),
            'database': os.getenv('POSTGRES_DB', 'autoshop'),
            'user': os.getenv('POSTGRES_USER', 'user'),
            'password': os.getenv('POSTGRES_PASSWORD', 'password')
        }
        
        logger.info(f"Connecting to database at {db_config['host']}:{db_config['port']}/{db_config['database']}")
        conn = psycopg2.connect(**db_config)
        logger.info("Database connection successful.")
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        # Only fall back to in-memory mode if explicitly requested
        if os.getenv('FALLBACK_TO_MEMORY', 'false').lower() == 'true':
            logger.warning("Falling back to in-memory database mode")
            return None
        else:
            # Re-raise the exception to make database issues visible
            raise e

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
            if conn is None:
                # Fallback to in-memory storage
                date_filter = request.args.get('date')
                filtered_appointments = appointments_db
                
                if date_filter:
                    # Filter appointments by date
                    filtered_appointments = [
                        apt for apt in appointments_db 
                        if apt.get('scheduled_date') == date_filter
                    ]
                
                return jsonify({'appointments': filtered_appointments})
            
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check if date filter is provided
            date_filter = request.args.get('date')
            if date_filter:
                cur.execute("""
                    SELECT a.id, a.customer_id, a.vehicle_id, a.service_id, a.scheduled_date, 
                           a.scheduled_time, a.location_address, a.status, a.notes, a.created_at, a.estimated_duration, a.reminder_status,
                           c.name as customer_name, c.email as customer_email, c.phone as customer_phone
                    FROM appointments a
                    LEFT JOIN customers c ON a.customer_id = c.id
                    WHERE a.scheduled_date = %s 
                    ORDER BY a.created_at DESC
                """, (date_filter,))
            else:
                cur.execute("""
                    SELECT a.id, a.customer_id, a.vehicle_id, a.service_id, a.scheduled_date, 
                           a.scheduled_time, a.location_address, a.status, a.notes, a.created_at, a.estimated_duration, a.reminder_status,
                           c.name as customer_name, c.email as customer_email, c.phone as customer_phone
                    FROM appointments a
                    LEFT JOIN customers c ON a.customer_id = c.id
                    ORDER BY a.created_at DESC
                """)
            
            appointments = []
            for row in cur.fetchall():
                try:
                    # Convert the dict row to proper format
                    appointment = dict(row)
                    
                    # Convert dates and times to strings for JSON serialization
                    if appointment.get('scheduled_date'):
                        appointment['scheduled_date'] = str(appointment['scheduled_date'])
                    if appointment.get('scheduled_time'):
                        appointment['scheduled_time'] = str(appointment['scheduled_time'])
                    if appointment.get('created_at'):
                        appointment['created_at'] = appointment['created_at'].isoformat()
                    
                    # Ensure proper types
                    if appointment.get('customer_id'):
                        appointment['customer_id'] = str(appointment['customer_id'])
                    if appointment.get('service_id'):
                        appointment['service_id'] = int(appointment['service_id'])
                    if appointment.get('vehicle_id'):
                        appointment['vehicle_id'] = int(appointment['vehicle_id'])
                    
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
            if conn is None:
                # Fallback to in-memory storage
                appointment_id = str(len(appointments_db) + 1)
                
                # Handle both 'requested_time' and 'scheduled_time' keys
                time_field = data.get('requested_time') or data.get('scheduled_time', '')
                if time_field:
                    try:
                        parsed_time = datetime.fromisoformat(time_field.replace('Z', '+00:00'))
                        scheduled_date = str(parsed_time.date())
                        scheduled_time = str(parsed_time.time())
                    except ValueError:
                        scheduled_date = str(datetime.now().date())
                        scheduled_time = '12:00:00'
                else:
                    scheduled_date = str(datetime.now().date())
                    scheduled_time = '12:00:00'
                
                new_appointment = {
                    'id': appointment_id,
                    'customer_id': data.get('customer_id', 'Unknown'),
                    'service_id': 1,
                    'scheduled_date': scheduled_date,
                    'scheduled_time': scheduled_time,
                    'location_address': data.get('location_address') or data.get('address', 'Not provided'),
                    'notes': data.get('notes', ''),
                    'status': 'in-progress' if data.get('appointmentType') == 'emergency' else 'scheduled',
                    'created_at': datetime.now().isoformat(),
                    'customer_phone': data.get('customer_phone', ''),
                    'customer_email': data.get('customer_email', ''),
                    'service': data.get('service', 'General Service'),
                    'estimated_duration': data.get('estimated_duration', '1 hour')
                }
                appointments_db.append(new_appointment)
                logger.info(f"Created appointment in memory with ID: {appointment_id}")
                return jsonify({'id': appointment_id, 'message': 'Appointment created successfully'})
            
            cur = conn.cursor()
            
            # Handle both 'requested_time' and 'scheduled_time' keys for compatibility
            time_field = data.get('requested_time') or data.get('scheduled_time')
            if not time_field:
                return jsonify({'error': 'scheduled_time or requested_time is required'}), 400
            
            # Parse the time
            try:
                requested_time = datetime.fromisoformat(time_field.replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)'}), 400
            
            # Handle customer creation/lookup
            customer_name = data.get('customer_id', 'Unknown Customer')  # Frontend sends name as customer_id
            customer_phone = data.get('customer_phone', '')
            customer_email = data.get('customer_email', '')
            
            # Try to find existing customer by phone or email
            customer_id = None
            if customer_phone:
                cur.execute('SELECT id FROM customers WHERE phone = %s', (customer_phone,))
                result = cur.fetchone()
                if result:
                    customer_id = result[0]
            
            if not customer_id and customer_email:
                cur.execute('SELECT id FROM customers WHERE email = %s', (customer_email,))
                result = cur.fetchone()
                if result:
                    customer_id = result[0]
            
            # Create new customer if not found
            if not customer_id:
                cur.execute('''
                    INSERT INTO customers (name, phone, email)
                    VALUES (%s, %s, %s) RETURNING id
                ''', (customer_name, customer_phone, customer_email))
                customer_id = cur.fetchone()[0]
                logger.info(f"Created new customer with ID: {customer_id}")
            
            cur.execute('''
                INSERT INTO appointments (customer_id, service_id, scheduled_date, scheduled_time, location_address, notes, status, estimated_duration)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            ''', (
                customer_id,
                1,  # Default service_id
                requested_time.date(),
                requested_time.time(),
                data.get('location_address') or data.get('address', 'Not provided'),
                data.get('notes', ''),
                'in-progress' if data.get('appointmentType') == 'emergency' else 'scheduled',
                data.get('estimated_duration', '1 hour')
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
                    'phone': str(row[2]) if row[2] else None,
                    'email': str(row[3]) if row[3] else None,
                    'address': str(row[4]) if row[4] else None,
                    'created_at': str(row[5]) if row[5] else None
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

@app.route('/api/admin/appointments/today', methods=['GET'])
def get_admin_appointments_today():
    """Get today's appointments for admin dashboard."""
    try:
        conn = get_db_connection()
        if conn is None:
            # Fallback to mock data for development
            today = datetime.now().date()
            mock_appointments = [
                {
                    'id': '1',
                    'customer_name': 'John Smith',
                    'customer_email': 'john@example.com',
                    'customer_phone': '(555) 123-4567',
                    'service_id': 1,
                    'scheduled_date': str(today),
                    'scheduled_time': '09:00:00',
                    'status': 'scheduled',
                    'location_address': '123 Main St, Anytown',
                    'notes': 'Oil change and inspection',
                    'created_at': datetime.now().isoformat()
                },
                {
                    'id': '2',
                    'customer_name': 'Jane Doe',
                    'customer_email': 'jane@example.com',
                    'customer_phone': '(555) 987-6543',
                    'service_id': 2,
                    'scheduled_date': str(today),
                    'scheduled_time': '14:00:00',
                    'status': 'scheduled',
                    'location_address': '456 Oak Ave, Anytown',
                    'notes': 'Brake inspection',
                    'created_at': datetime.now().isoformat()
                }
            ]
            return jsonify({'appointments': mock_appointments, 'count': len(mock_appointments)})
        
        cur = conn.cursor(cursor_factory=RealDictCursor)
        today = datetime.now().date()
        
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
        appointments = []
        
        for row in rows:
            appointment = dict(row)
            
            # Convert dates and times to strings for JSON serialization
            if appointment.get('scheduled_date'):
                appointment['scheduled_date'] = str(appointment['scheduled_date'])
            if appointment.get('scheduled_time'):
                appointment['scheduled_time'] = str(appointment['scheduled_time'])
            if appointment.get('created_at'):
                appointment['created_at'] = appointment['created_at'].isoformat()
            
            # Create combined datetime field if both date and time exist
            if appointment.get('scheduled_date') and appointment.get('scheduled_time'):
                # Parse back the string date and time to create combined datetime
                from datetime import datetime as dt
                scheduled_date = dt.strptime(appointment['scheduled_date'], '%Y-%m-%d').date()
                scheduled_time = dt.strptime(appointment['scheduled_time'], '%H:%M:%S').time()
                ts = dt.combine(scheduled_date, scheduled_time)
                appointment['scheduled_at'] = ts.isoformat()
            
            # Ensure proper types for other fields
            if appointment.get('customer_id'):
                appointment['customer_id'] = str(appointment['customer_id'])
            if appointment.get('service_id'):
                appointment['service_id'] = int(appointment['service_id'])
            
            appointments.append(appointment)
        
        cur.close()
        conn.close()
        
        return jsonify({'appointments': appointments, 'count': len(appointments)})
        
    except Exception as e:
        logger.error(f"Failed to fetch today's appointments: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/appointments/<appointment_id>', methods=['PUT'])
def update_appointment(appointment_id):
    """Update an appointment (admin)."""
    try:
        data = request.get_json()
        conn = get_db_connection()
        
        if conn is None:
            # Mock success for development
            logger.info(f"Mock update appointment {appointment_id} with data: {data}")
            return jsonify({'message': 'Appointment updated successfully (mock)'})
        
        cur = conn.cursor()
        
        # Build dynamic update query
        allowed_fields = {'status', 'notes', 'scheduled_date', 'scheduled_time', 'location_address'}
        update_fields = {k: v for k, v in data.items() if k in allowed_fields}
        
        if not update_fields:
            return jsonify({'error': 'No valid fields to update'}), 400
        
        set_clause = ", ".join([f"{k} = %s" for k in update_fields.keys()])
        values = list(update_fields.values())
        values.append(appointment_id)
        
        cur.execute(f"""
            UPDATE appointments SET {set_clause}
            WHERE id = %s RETURNING id
        """, values)
        
        if cur.rowcount == 0:
            cur.close()
            conn.close()
            return jsonify({'error': 'Appointment not found'}), 404
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'message': 'Appointment updated successfully'})
        
    except Exception as e:
        logger.error(f"Failed to update appointment {appointment_id}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    """Get dashboard statistics for admin."""
    try:
        conn = get_db_connection()
        if conn is None:
            # Mock stats for development
            return jsonify({
                'success': True,
                'data': {
                    'todayAppointments': 4,
                    'pendingAppointments': 2,
                    'completedToday': 1,
                    'totalCustomers': 127,
                    'partsOrdered': 12,
                    'todayRevenue': 350
                }
            })
        
        cur = conn.cursor()
        today = datetime.now().date()
        
        # Get today's appointments count
        cur.execute("SELECT COUNT(*) FROM appointments WHERE scheduled_date = %s", (today,))
        today_appointments = cur.fetchone()[0]
        
        # Get pending appointments
        cur.execute("SELECT COUNT(*) FROM appointments WHERE status = 'scheduled' AND scheduled_date = %s", (today,))
        pending_appointments = cur.fetchone()[0]
        
        # Get completed today
        cur.execute("SELECT COUNT(*) FROM appointments WHERE status = 'completed' AND scheduled_date = %s", (today,))
        completed_today = cur.fetchone()[0]
        
        # Get total customers
        cur.execute("SELECT COUNT(*) FROM customers")
        total_customers = cur.fetchone()[0]
        
        cur.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'data': {
                'todayAppointments': today_appointments,
                'pendingAppointments': pending_appointments,
                'completedToday': completed_today,
                'totalCustomers': total_customers,
                'partsOrdered': 0,  # Would need parts table
                'todayRevenue': completed_today * 150  # Estimated revenue
            }
        })
        
    except Exception as e:
        logger.error(f"Failed to get dashboard stats: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/cars-on-premises', methods=['GET'])
def get_cars_on_premises():
    """Get a list of cars currently on premises (in-progress appointments)."""
    try:
        conn = get_db_connection()
        if conn is None:
            # Fallback to in-memory storage
            cars_on_premises = []
            for apt in appointments_db:
                if apt['status'] == 'in-progress':
                    cars_on_premises.append({
                        'id': apt['id'],
                        'make': 'Mock Make', # Placeholder as vehicle info not in appointments_db
                        'model': 'Mock Model', # Placeholder
                        'owner': apt['customer_id'],
                        'arrivalTime': apt['scheduled_time'],
                        'status': apt['status'],
                        'pickupTime': 'N/A' # Placeholder
                    })
            return jsonify({'cars_on_premises': cars_on_premises})

        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT a.id, a.scheduled_time as arrival_time, a.status,
                   c.name as owner_name,
                   v.make, v.model, v.year,
                   s.name as service_name
            FROM appointments a
            JOIN customers c ON a.customer_id = c.id
            LEFT JOIN vehicles v ON a.vehicle_id = v.id -- Assuming vehicles table exists and is linked
            LEFT JOIN services s ON a.service_id = s.id -- Assuming services table exists and is linked
            WHERE a.status = 'in-progress'
            ORDER BY a.scheduled_time ASC
        """)
        
        cars_on_premises = []
        for row in cur.fetchall():
            car = dict(row)
            cars_on_premises.append({
                'id': car['id'],
                'make': car.get('make', 'N/A'),
                'model': car.get('model', 'N/A'),
                'owner': car.get('owner_name', 'N/A'),
                'arrivalTime': str(car['arrival_time']),
                'status': car['status'],
                'pickupTime': 'N/A' # This would ideally be calculated or stored
            })
        
        cur.close()
        conn.close()
        return jsonify({'cars_on_premises': cars_on_premises})
    except Exception as e:
        logger.error(f"Failed to get cars on premises: {e}")
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
                status VARCHAR(50) DEFAULT 'scheduled',
                estimated_duration TEXT,
                reminder_status VARCHAR(50) DEFAULT 'pending',
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
    port = int(os.getenv("FLASK_RUN_PORT", 3001))
    logger.info(f"Starting Edgar's Auto Shop Local API Server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)
