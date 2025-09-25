#!/usr/bin/env python3
"""
T6A - API Security Hardening Script
Edgar's Mobile Auto Shop - Sprint 2

Implements API rate limiting, input validation, and SQL injection protection
for the Flask application endpoints.
"""

import json
import re
from pathlib import Path
from typing import Any, Dict


class APISecurityHardening:
    def __init__(self, backend_path: str = "backend"):
        self.backend_path = Path(backend_path)
        self.security_checks = []

    def audit_input_validation(self) -> Dict[str, Any]:
        """Audit Flask routes for proper input validation."""
        print("🔍 Auditing API input validation...")

        validation_audit = {
            "files_checked": 0,
            "routes_found": 0,
            "validation_issues": [],
            "recommendations": [],
        }

        # Find all Python files in the backend
        python_files = list(self.backend_path.rglob("*.py"))
        validation_audit["files_checked"] = len(python_files)

        # Check each file for Flask routes and validation patterns
        for py_file in python_files:
            try:
                with open(py_file, encoding="utf-8") as f:
                    content = f.read()

                # Find Flask route definitions
                routes = re.findall(r'@app\.route\([\'"]([^\'"]+)[\'"].*?\)\s*def\s+(\w+)', content)
                validation_audit["routes_found"] += len(routes)

                # Check for potential SQL injection vulnerabilities
                sql_patterns = [
                    r'execute\([\'"].*?%.*?[\'"]',  # String formatting in SQL
                    r"\.format\([^)]*\).*?execute",  # .format() near execute
                    r'f[\'"].*?{.*?}.*?[\'"].*?execute',  # f-strings in SQL
                ]

                for pattern in sql_patterns:
                    if re.search(pattern, content):
                        validation_audit["validation_issues"].append(
                            {
                                "file": str(py_file),
                                "type": "potential_sql_injection",
                                "severity": "HIGH",
                                "description": "Potential SQL injection vulnerability detected",
                            }
                        )

                # Check for request data validation
                if "@app.route" in content:
                    # Look for proper request validation patterns
                    has_request_validation = any(
                        [
                            "request.get_json()" in content,
                            "request.json.get(" in content,
                            "request.args.get(" in content,
                            "request.form.get(" in content,
                        ]
                    )

                    has_marshmallow = "marshmallow" in content or "Schema" in content
                    has_wtforms = "wtforms" in content or "FlaskForm" in content
                    has_cerberus = "cerberus" in content or "Validator" in content

                    if not (has_marshmallow or has_wtforms or has_cerberus) and routes:
                        validation_audit["validation_issues"].append(
                            {
                                "file": str(py_file),
                                "type": "missing_input_validation",
                                "severity": "MEDIUM",
                                "description": "Routes found but no validation library detected",
                            }
                        )

            except Exception as e:
                print(f"   Warning: Could not read {py_file}: {e}")

        # Generate recommendations based on findings
        if validation_audit["validation_issues"]:
            validation_audit["recommendations"].extend(
                [
                    {
                        "priority": "HIGH",
                        "title": "Implement parameterized queries",
                        "description": "Use parameterized queries or ORM to prevent SQL injection",
                    },
                    {
                        "priority": "MEDIUM",
                        "title": "Add input validation middleware",
                        "description": "Use marshmallow or similar library for request validation",
                    },
                ]
            )

        return validation_audit

    def create_rate_limiting_middleware(self) -> str:
        """Create Flask rate limiting middleware."""
        print("⏱️  Creating rate limiting middleware...")

        middleware_code = '''"""
Rate Limiting Middleware for Edgar's Auto Shop API
Implements token bucket algorithm for API rate limiting.
"""

import time
import redis
from functools import wraps
from flask import request, jsonify, g
import logging
from typing import Dict, Optional
import hashlib

logger = logging.getLogger(__name__)

class RateLimiter:
    """Token bucket rate limiter using Redis for distributed rate limiting."""

    def __init__(self, redis_client=None):
        self.redis_client = redis_client or redis.Redis(
            host='localhost', port=6379, db=0,
            socket_connect_timeout=1, socket_timeout=1
        )

    def get_client_id(self, request) -> str:
        """Generate unique client identifier."""
        # Use IP + User-Agent for basic fingerprinting
        client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
        user_agent = request.headers.get('User-Agent', '')

        # Hash for privacy
        client_data = f"{client_ip}:{user_agent}"
        return hashlib.md5(client_data.encode()).hexdigest()

    def is_allowed(self, key: str, limit: int, window: int) -> tuple[bool, Dict]:
        """
        Check if request is allowed using sliding window counter.

        Args:
            key: Unique identifier for the rate limit
            limit: Number of requests allowed
            window: Time window in seconds

        Returns:
            (allowed, info) where info contains current count and reset time
        """
        try:
            current_time = int(time.time())
            window_start = current_time - window

            # Use Redis pipeline for atomic operations
            pipe = self.redis_client.pipeline()

            # Remove expired entries
            pipe.zremrangebyscore(key, 0, window_start)

            # Count current requests
            pipe.zcard(key)

            # Add current request
            pipe.zadd(key, {str(current_time): current_time})

            # Set expiration
            pipe.expire(key, window)

            results = pipe.execute()
            current_count = results[1] + 1  # +1 for the request we just added

            return current_count <= limit, {
                'current': current_count,
                'limit': limit,
                'reset': current_time + window,
                'window': window
            }

        except Exception as e:
            logger.error(f"Rate limiter error: {e}")
            # Fail open - allow request if Redis is down
            return True, {'error': 'rate_limiter_unavailable'}

    def rate_limit(self, requests_per_minute: int = 60, per_ip: bool = True):
        """
        Flask decorator for rate limiting.

        Args:
            requests_per_minute: Number of requests allowed per minute
            per_ip: If True, limit per IP. If False, global limit.
        """
        def decorator(f):
            @wraps(f)
            def decorated_function(*args, **kwargs):
                if per_ip:
                    client_id = self.get_client_id(request)
                    rate_key = f"rate_limit:ip:{client_id}"
                else:
                    rate_key = f"rate_limit:global:{f.__name__}"

                allowed, info = self.is_allowed(rate_key, requests_per_minute, 60)

                if not allowed:
                    logger.warning(f"Rate limit exceeded for {rate_key}: {info}")
                    return jsonify({
                        'error': 'Rate limit exceeded',
                        'message': f'Too many requests. Limit: {info["limit"]}/minute',
                        'retry_after': info.get('reset', time.time() + 60) - time.time()
                    }), 429

                # Add rate limit headers
                g.rate_limit_info = info
                return f(*args, **kwargs)

            return decorated_function
        return decorator

# Global rate limiter instance
rate_limiter = RateLimiter()

# Common rate limit decorators
def api_rate_limit(requests_per_minute: int = 60):
    """Standard API rate limit decorator."""
    return rate_limiter.rate_limit(requests_per_minute, per_ip=True)

def admin_rate_limit(requests_per_minute: int = 30):
    """Stricter rate limit for admin endpoints."""
    return rate_limiter.rate_limit(requests_per_minute, per_ip=True)

def public_rate_limit(requests_per_minute: int = 20):
    """Rate limit for public endpoints (quotes, etc.)."""
    return rate_limiter.rate_limit(requests_per_minute, per_ip=True)

# Flask after_request handler to add rate limit headers
def add_rate_limit_headers(response):
    """Add rate limiting headers to response."""
    if hasattr(g, 'rate_limit_info'):
        info = g.rate_limit_info
        if 'error' not in info:
            response.headers['X-RateLimit-Limit'] = str(info['limit'])
            response.headers['X-RateLimit-Remaining'] = str(max(0, info['limit'] - info['current']))
            response.headers['X-RateLimit-Reset'] = str(info['reset'])

    return response
'''

        return middleware_code

    def create_input_validation_schemas(self) -> str:
        """Create Marshmallow schemas for input validation."""
        print("✅ Creating input validation schemas...")

        schemas_code = '''"""
Input Validation Schemas for Edgar's Auto Shop API
Using Marshmallow for comprehensive request validation.
"""

from marshmallow import Schema, fields, validate, ValidationError, pre_load
from datetime import datetime, timedelta
import re
from typing import Any, Dict

class BaseSchema(Schema):
    """Base schema with common validation methods."""

    @pre_load
    def strip_strings(self, data, **kwargs):
        """Strip whitespace from all string fields."""
        if isinstance(data, dict):
            return {k: v.strip() if isinstance(v, str) else v for k, v in data.items()}
        return data

class CustomerSchema(BaseSchema):
    """Customer data validation schema."""

    name = fields.Str(
        required=True,
        validate=validate.Length(min=2, max=100),
        error_messages={'required': 'Customer name is required'}
    )
    email = fields.Email(
        required=False,
        validate=validate.Length(max=255),
        allow_none=True
    )
    phone = fields.Str(
        required=True,
        validate=validate.Regexp(
            r'^[\+]?[1-9][\d\-\(\)\s]{7,15}$',
            error='Invalid phone number format'
        )
    )
    address = fields.Str(
        required=False,
        validate=validate.Length(max=500),
        allow_none=True
    )

class VehicleSchema(BaseSchema):
    """Vehicle information validation schema."""

    make = fields.Str(
        required=True,
        validate=validate.Length(min=2, max=50)
    )
    model = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=50)
    )
    year = fields.Integer(
        required=True,
        validate=validate.Range(min=1900, max=datetime.now().year + 2)
    )
    vin = fields.Str(
        required=False,
        validate=validate.Regexp(
            r'^[A-HJ-NPR-Z0-9]{17}$',
            error='VIN must be 17 alphanumeric characters'
        ),
        allow_none=True
    )
    license_plate = fields.Str(
        required=False,
        validate=validate.Length(max=20),
        allow_none=True
    )

class AppointmentCreateSchema(BaseSchema):
    """Appointment creation validation schema."""

    customer = fields.Nested(CustomerSchema, required=True)
    vehicle = fields.Nested(VehicleSchema, required=True)

    scheduled_date = fields.DateTime(
        required=True,
        format='iso',
        error_messages={'required': 'Appointment date is required'}
    )

    service_codes = fields.List(
        fields.Str(validate=validate.Length(min=3, max=20)),
        required=True,
        validate=validate.Length(min=1, max=10),
        error_messages={'required': 'At least one service code is required'}
    )

    notes = fields.Str(
        required=False,
        validate=validate.Length(max=1000),
        allow_none=True
    )

    def validate_scheduled_date(self, value):
        """Validate appointment date is in the future."""
        if value <= datetime.now():
            raise ValidationError('Appointment must be scheduled for a future date')

        # Don't allow appointments more than 6 months out
        if value > datetime.now() + timedelta(days=180):
            raise ValidationError('Appointments cannot be scheduled more than 6 months in advance')

class AppointmentUpdateSchema(BaseSchema):
    """Appointment update validation schema."""

    status = fields.Str(
        required=False,
        validate=validate.OneOf([
            'scheduled', 'in_progress', 'ready', 'completed', 'no_show'
        ])
    )

    scheduled_date = fields.DateTime(
        required=False,
        format='iso'
    )

    tech_id = fields.Integer(
        required=False,
        validate=validate.Range(min=1),
        allow_none=True
    )

    notes = fields.Str(
        required=False,
        validate=validate.Length(max=1000),
        allow_none=True
    )

    total_amount = fields.Decimal(
        required=False,
        validate=validate.Range(min=0, max=50000),
        allow_none=True
    )

class QuoteRequestSchema(BaseSchema):
    """Quote request validation schema."""

    customer_name = fields.Str(
        required=True,
        validate=validate.Length(min=2, max=100)
    )

    phone = fields.Str(
        required=True,
        validate=validate.Regexp(
            r'^[\+]?[1-9][\d\-\(\)\s]{7,15}$',
            error='Invalid phone number format'
        )
    )

    vehicle = fields.Nested(VehicleSchema, required=True)

    services_requested = fields.List(
        fields.Str(validate=validate.Length(min=3, max=100)),
        required=True,
        validate=validate.Length(min=1, max=10)
    )

    preferred_date = fields.DateTime(
        required=False,
        format='iso',
        allow_none=True
    )

class StatusBoardQuerySchema(BaseSchema):
    """Status board query parameters validation."""

    from_date = fields.Date(
        required=False,
        format='%Y-%m-%d',
        allow_none=True
    )

    to_date = fields.Date(
        required=False,
        format='%Y-%m-%d',
        allow_none=True
    )

    tech_id = fields.Integer(
        required=False,
        validate=validate.Range(min=1),
        allow_none=True
    )

    status = fields.Str(
        required=False,
        validate=validate.OneOf([
            'scheduled', 'in_progress', 'ready', 'completed', 'no_show'
        ]),
        allow_none=True
    )

# Validation decorator for Flask routes
def validate_json(schema_class):
    """Decorator to validate JSON input using Marshmallow schema."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Get JSON data
                json_data = request.get_json(force=True)
                if json_data is None:
                    return jsonify({'error': 'No JSON data provided'}), 400

                # Validate with schema
                schema = schema_class()
                validated_data = schema.load(json_data)

                # Pass validated data to the route function
                kwargs['validated_data'] = validated_data
                return f(*args, **kwargs)

            except ValidationError as err:
                return jsonify({
                    'error': 'Validation failed',
                    'messages': err.messages
                }), 400
            except Exception as e:
                return jsonify({'error': 'Invalid JSON format'}), 400

        return decorated_function
    return decorator

def validate_query_params(schema_class):
    """Decorator to validate query parameters using Marshmallow schema."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Convert query parameters to dict
                query_data = request.args.to_dict()

                # Validate with schema
                schema = schema_class()
                validated_data = schema.load(query_data)

                # Pass validated data to the route function
                kwargs['validated_params'] = validated_data
                return f(*args, **kwargs)

            except ValidationError as err:
                return jsonify({
                    'error': 'Invalid query parameters',
                    'messages': err.messages
                }), 400

        return decorated_function
    return decorator
'''

        return schemas_code

    def create_sql_injection_protection(self) -> str:
        """Create SQL injection protection utilities."""
        print("🛡️  Creating SQL injection protection...")

        protection_code = '''"""
SQL Injection Protection Utilities
Provides safe database query helpers and SQL injection detection.
"""

import re
import logging
from typing import Any, Dict, List, Optional, Tuple
from functools import wraps
from flask import request, jsonify
import psycopg2.sql as sql

logger = logging.getLogger(__name__)

class SQLInjectionProtector:
    """SQL injection protection and detection utilities."""

    # Common SQL injection patterns
    INJECTION_PATTERNS = [
        r"('|(\\x27)|(\\x2D)|-|;|\\x00|\\n|\\r|\\|\\x1a)",  # Basic injection chars
        r"((select|union|insert|update|delete|drop|create|alter|exec|execute)\\s*\\()",  # SQL keywords with parentheses
        r"((union(.*?)select)|(select(.*?)from))",  # Union-based injection
        r"((and|or)\\s+(1|true)\\s*=\\s*(1|true))",  # Boolean-based injection
        r"((and|or)\\s+(1|true)\\s*=\\s*(2|false))",  # Boolean-based injection
        r"(benchmark\\s*\\(|sleep\\s*\\(|pg_sleep\\s*\\()",  # Time-based injection
        r"(waitfor\\s+delay\\s+|dbms_pipe\\.receive_message)",  # Time-based injection (other DBs)
        r"(\\x31|\\x32|\\x33|\\x34|\\x35|\\x36|\\x37|\\x38|\\x39|\\x30)",  # Hex encoded numbers
        r"(char\\s*\\(|ascii\\s*\\(|substring\\s*\\()",  # Function-based injection
        r"(@@version|version\\(\\)|user\\(\\)|database\\(\\))",  # Information gathering
        r"(information_schema|pg_tables|pg_user)",  # Database metadata
        r"(\\bor\\b.*?\\b=\\b|\\band\\b.*?\\b=\\b)",  # Boolean conditions
        r"(concat\\s*\\(|group_concat\\s*\\()",  # String functions
        r"(load_file\\s*\\(|into\\s+outfile|into\\s+dumpfile)",  # File operations
    ]

    @classmethod
    def detect_sql_injection(cls, input_string: str) -> bool:
        """
        Detect potential SQL injection attempts in input string.

        Args:
            input_string: String to check for SQL injection patterns

        Returns:
            True if potential SQL injection detected, False otherwise
        """
        if not isinstance(input_string, str):
            return False

        # Convert to lowercase for pattern matching
        lower_input = input_string.lower()

        # Check each pattern
        for pattern in cls.INJECTION_PATTERNS:
            if re.search(pattern, lower_input, re.IGNORECASE):
                logger.warning(f"SQL injection pattern detected: {pattern} in input: {input_string[:100]}...")
                return True

        return False

    @classmethod
    def sanitize_input(cls, input_value: Any) -> Any:
        """
        Sanitize input value to prevent SQL injection.

        Args:
            input_value: Value to sanitize

        Returns:
            Sanitized value or raises ValueError if malicious content detected
        """
        if input_value is None:
            return None

        if isinstance(input_value, str):
            # Check for SQL injection
            if cls.detect_sql_injection(input_value):
                raise ValueError("Potentially malicious input detected")

            # Basic sanitization
            sanitized = input_value.strip()

            # Remove null bytes and control characters
            sanitized = re.sub(r'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', sanitized)

            return sanitized

        elif isinstance(input_value, (int, float, bool)):
            return input_value

        elif isinstance(input_value, (list, tuple)):
            return [cls.sanitize_input(item) for item in input_value]

        elif isinstance(input_value, dict):
            return {key: cls.sanitize_input(value) for key, value in input_value.items()}

        else:
            # For other types, convert to string and sanitize
            return cls.sanitize_input(str(input_value))

class SafeQueryBuilder:
    """Build parameterized queries safely to prevent SQL injection."""

    @staticmethod
    def select_with_conditions(table: str, columns: List[str], conditions: Dict[str, Any]) -> Tuple[str, List]:
        """
        Build a safe SELECT query with WHERE conditions.

        Args:
            table: Table name
            columns: List of column names
            conditions: Dictionary of column -> value conditions

        Returns:
            (query_string, parameters_list)
        """
        # Validate table and column names (must be identifiers)
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', table):
            raise ValueError(f"Invalid table name: {table}")

        for col in columns:
            if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', col):
                raise ValueError(f"Invalid column name: {col}")

        # Build query using psycopg2.sql for safe identifier quoting
        select_clause = sql.SQL("SELECT {} FROM {}").format(
            sql.SQL(', ').join(map(sql.Identifier, columns)),
            sql.Identifier(table)
        )

        if conditions:
            # Validate condition keys (column names)
            for key in conditions.keys():
                if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', key):
                    raise ValueError(f"Invalid column name in conditions: {key}")

            # Build WHERE clause
            where_conditions = []
            parameters = []

            for key, value in conditions.items():
                where_conditions.append(sql.SQL("{} = %s").format(sql.Identifier(key)))
                parameters.append(SQLInjectionProtector.sanitize_input(value))

            where_clause = sql.SQL(" WHERE ").join([
                sql.SQL(""),
                sql.SQL(" AND ").join(where_conditions)
            ])

            query = select_clause + where_clause
            return query.as_string(), parameters

        return select_clause.as_string(), []

    @staticmethod
    def insert_record(table: str, data: Dict[str, Any]) -> Tuple[str, List]:
        """
        Build a safe INSERT query.

        Args:
            table: Table name
            data: Dictionary of column -> value data

        Returns:
            (query_string, parameters_list)
        """
        # Validate table name
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', table):
            raise ValueError(f"Invalid table name: {table}")

        # Validate column names
        for col in data.keys():
            if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', col):
                raise ValueError(f"Invalid column name: {col}")

        # Build INSERT query
        columns = list(data.keys())
        values = [SQLInjectionProtector.sanitize_input(data[col]) for col in columns]

        query = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
            sql.Identifier(table),
            sql.SQL(', ').join(map(sql.Identifier, columns)),
            sql.SQL(', ').join(sql.Placeholder() * len(columns))
        )

        return query.as_string(), values

# Decorators for route protection
def sql_injection_guard(f):
    """Decorator to check all request data for SQL injection attempts."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Check JSON data if present
            if request.is_json:
                json_data = request.get_json()
                if json_data:
                    SQLInjectionProtector.sanitize_input(json_data)

            # Check query parameters
            for key, value in request.args.items():
                SQLInjectionProtector.sanitize_input(value)

            # Check form data
            for key, value in request.form.items():
                SQLInjectionProtector.sanitize_input(value)

            return f(*args, **kwargs)

        except ValueError as e:
            logger.error(f"SQL injection attempt blocked: {e}")
            return jsonify({
                'error': 'Invalid input detected',
                'message': 'Your request contains potentially harmful content'
            }), 400

    return decorated_function

# Safe database connection context manager
class SafeDatabaseConnection:
    """Context manager for safe database operations."""

    def __init__(self, connection):
        self.connection = connection
        self.cursor = None

    def __enter__(self):
        self.cursor = self.connection.cursor()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.connection.rollback()
        else:
            self.connection.commit()

        if self.cursor:
            self.cursor.close()

    def execute_safe(self, query: str, params: List = None):
        """Execute a parameterized query safely."""
        if params:
            # Additional validation of parameters
            safe_params = [SQLInjectionProtector.sanitize_input(p) for p in params]
            self.cursor.execute(query, safe_params)
        else:
            self.cursor.execute(query)

        return self.cursor
'''

        return protection_code

    def generate_security_recommendations(self) -> Dict[str, Any]:
        """Generate comprehensive API security recommendations."""
        print("📋 Generating API security recommendations...")

        validation_audit = self.audit_input_validation()

        recommendations = {
            "timestamp": "2025-09-20T12:00:00Z",
            "audit_results": validation_audit,
            "security_improvements": [
                {
                    "category": "Rate Limiting",
                    "priority": "HIGH",
                    "title": "Implement API rate limiting",
                    "description": "Add rate limiting middleware to prevent API abuse",
                    "implementation": "Use Redis-based token bucket algorithm with per-IP limits",
                    "files_to_create": ["backend/middleware/rate_limiter.py"],
                },
                {
                    "category": "Input Validation",
                    "priority": "HIGH",
                    "title": "Add comprehensive input validation",
                    "description": "Validate all incoming request data using schemas",
                    "implementation": "Marshmallow schemas with type checking and sanitization",
                    "files_to_create": ["backend/schemas/validation_schemas.py"],
                },
                {
                    "category": "SQL Injection Protection",
                    "priority": "CRITICAL",
                    "title": "Implement SQL injection protection",
                    "description": "Add parameterized queries and input sanitization",
                    "implementation": "Safe query builders and injection detection",
                    "files_to_create": ["backend/security/sql_protection.py"],
                },
                {
                    "category": "Authentication",
                    "priority": "MEDIUM",
                    "title": "Add API key authentication for admin endpoints",
                    "description": "Protect admin routes with API key validation",
                    "implementation": "JWT or API key middleware for admin functions",
                },
                {
                    "category": "Headers",
                    "priority": "MEDIUM",
                    "title": "Add security headers",
                    "description": "Implement CORS, CSP, and other security headers",
                    "implementation": "Flask-Security or custom middleware",
                },
            ],
            "next_steps": [
                "Deploy rate limiting middleware to production",
                "Add input validation to all API endpoints",
                "Implement SQL injection protection",
                "Add security monitoring and alerting",
                "Perform penetration testing on API endpoints",
            ],
        }

        return recommendations


def main():
    print("🔒 Edgar's Auto Shop - API Security Hardening (T6A)")
    print("=" * 50)

    # Initialize hardening tool
    hardening = APISecurityHardening()

    # Generate security audit and recommendations
    recommendations = hardening.generate_security_recommendations()

    # Create security middleware files
    middleware_dir = Path("backend/middleware")
    schemas_dir = Path("backend/schemas")
    security_dir = Path("backend/security")

    # Create directories
    middleware_dir.mkdir(exist_ok=True)
    schemas_dir.mkdir(exist_ok=True)
    security_dir.mkdir(exist_ok=True)

    # Write rate limiting middleware
    rate_limiter_code = hardening.create_rate_limiting_middleware()
    with open(middleware_dir / "rate_limiter.py", "w") as f:
        f.write(rate_limiter_code)
    print(f"✅ Created: {middleware_dir / 'rate_limiter.py'}")

    # Write validation schemas
    validation_code = hardening.create_input_validation_schemas()
    with open(schemas_dir / "validation_schemas.py", "w") as f:
        f.write(validation_code)
    print(f"✅ Created: {schemas_dir / 'validation_schemas.py'}")

    # Write SQL protection utilities
    sql_protection_code = hardening.create_sql_injection_protection()
    with open(security_dir / "sql_protection.py", "w") as f:
        f.write(sql_protection_code)
    print(f"✅ Created: {security_dir / 'sql_protection.py'}")

    # Save recommendations report
    with open("api_security_audit.json", "w") as f:
        json.dump(recommendations, f, indent=2)
    print("📄 Security audit saved to: api_security_audit.json")

    # Display summary
    print("\n📊 API Security Audit Summary:")
    print(f"   Files checked: {recommendations['audit_results']['files_checked']}")
    print(f"   Routes found: {recommendations['audit_results']['routes_found']}")
    print(f"   Security issues: {len(recommendations['audit_results']['validation_issues'])}")
    print(f"   Recommendations: {len(recommendations['security_improvements'])}")

    # Display high-priority recommendations
    print("\n🚨 High Priority Security Improvements:")
    for rec in recommendations["security_improvements"]:
        if rec["priority"] in ["CRITICAL", "HIGH"]:
            print(f"   • [{rec['priority']}] {rec['title']}")
            print(f"     {rec['description']}")

    print("\n✅ API security hardening files created successfully!")
    print("\n🎯 Next Steps:")
    print("   1. Review and integrate the security middleware into your Flask app")
    print("   2. Add rate limiting decorators to API endpoints")
    print("   3. Implement input validation schemas on all routes")
    print("   4. Run penetration testing to validate security improvements")


if __name__ == "__main__":
    main()
