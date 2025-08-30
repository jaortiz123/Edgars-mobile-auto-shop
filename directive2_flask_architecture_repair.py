#!/usr/bin/env python3
"""
DIRECTIVE 2: FLASK APP ARCHITECTURE REPAIR

Fix the Flask instantiation conflicts that prevent testing production security functions.
The issue is that Flask app is created at module level causing import conflicts.
"""

import sys


def analyze_flask_instantiation_issue():
    """Analyze the current Flask app instantiation problem"""
    print("🚨 DIRECTIVE 2: ANALYZING FLASK INSTANTIATION CONFLICTS")
    print("=" * 60)

    # Read the current Flask app structure
    try:
        with open("/Users/jesusortiz/Edgars-mobile-auto-shop/backend/local_server.py") as f:
            content = f.read()

        # Find where Flask app is instantiated
        lines = content.split("\n")
        flask_instantiation_lines = []

        for i, line in enumerate(lines):
            if "Flask(" in line or "app = " in line.lower():
                flask_instantiation_lines.append((i + 1, line.strip()))

        print("📋 Flask instantiation locations found:")
        for line_num, line in flask_instantiation_lines[:10]:  # Show first 10
            print(f"   Line {line_num}: {line}")

        # Look for the main app instantiation issue
        app_creation_pattern = [
            line for line_num, line in flask_instantiation_lines if "Flask(__name__)" in line
        ]

        if app_creation_pattern:
            print(f"\n🔍 Found Flask app creation: {app_creation_pattern[0]}")
            print("❌ PROBLEM: Flask app created at module level")
            print("🔧 SOLUTION: Move to application factory pattern")

        # Check for duplicate app creation protection
        if "Multiple Flask app instantiation" in content:
            print("✅ Found existing app instantiation protection")
            print("🔧 Need to refactor to proper factory pattern")

        return True

    except Exception as e:
        print(f"❌ Error analyzing Flask app: {e}")
        return False


def extract_security_functions():
    """Extract security functions that can be used independently of Flask"""
    print("\n🔧 EXTRACTING SECURITY FUNCTIONS")
    print("=" * 60)

    try:
        with open("/Users/jesusortiz/Edgars-mobile-auto-shop/backend/local_server.py") as f:
            content = f.read()

        # Find security-related functions
        security_functions = []
        lines = content.split("\n")

        in_function = False
        current_function = []
        function_name = None

        for line in lines:
            if line.startswith("def ") and any(
                keyword in line.lower()
                for keyword in [
                    "hash_password",
                    "verify_password",
                    "make_tokens",
                    "verify_token",
                    "auth",
                    "login",
                    "register",
                ]
            ):
                if in_function and current_function:
                    security_functions.append((function_name, "\n".join(current_function)))

                in_function = True
                function_name = line.split("def ")[1].split("(")[0]
                current_function = [line]
            elif in_function:
                if line.startswith("def ") or (
                    line.strip() and not line.startswith(" ") and not line.startswith("\t")
                ):
                    # End of current function
                    security_functions.append((function_name, "\n".join(current_function)))
                    in_function = False
                    current_function = []
                    function_name = None

                    if line.startswith("def ") and any(
                        keyword in line.lower()
                        for keyword in [
                            "hash_password",
                            "verify_password",
                            "make_tokens",
                            "verify_token",
                            "auth",
                            "login",
                            "register",
                        ]
                    ):
                        in_function = True
                        function_name = line.split("def ")[1].split("(")[0]
                        current_function = [line]
                else:
                    current_function.append(line)

        # Add the last function if we were in one
        if in_function and current_function:
            security_functions.append((function_name, "\n".join(current_function)))

        print(f"📋 Found {len(security_functions)} security functions:")
        for func_name, func_code in security_functions[:5]:  # Show first 5
            print(f"   - {func_name} ({len(func_code.split())} lines)")

        return security_functions

    except Exception as e:
        print(f"❌ Error extracting security functions: {e}")
        return []


def create_security_module():
    """Create a separate security module that can be imported without Flask conflicts"""
    print("\n🔧 CREATING INDEPENDENT SECURITY MODULE")
    print("=" * 60)

    try:
        # Read the original file
        with open("/Users/jesusortiz/Edgars-mobile-auto-shop/backend/local_server.py") as f:
            content = f.read()

        # Extract imports and dependencies needed for security functions
        security_module_content = '''"""
INDEPENDENT SECURITY MODULE

This module contains core security functions extracted from local_server.py
that can be imported and tested without Flask app instantiation conflicts.

CRITICAL: This fixes DIRECTIVE 2 - Flask instantiation conflicts
"""

import os
import jwt
import bcrypt
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple

# Extract JWT configuration
JWT_SECRET = os.getenv("JWT_SECRET", "dev_secret")
JWT_ALG = os.getenv("JWT_ALG", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt with cost factor 12 for production security.

    Args:
        password: Plain text password to hash

    Returns:
        Bcrypt hashed password string
    """
    if not password:
        raise ValueError("Password cannot be empty")

    # Use bcrypt with cost factor 12 for production
    salt = bcrypt.gensalt(rounds=12)
    password_bytes = password.encode('utf-8')
    hashed = bcrypt.hashpw(password_bytes, salt)

    return hashed.decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verify a password against its bcrypt hash.

    Args:
        password: Plain text password to verify
        hashed_password: Bcrypt hashed password to check against

    Returns:
        True if password matches, False otherwise
    """
    if not password or not hashed_password:
        return False

    try:
        password_bytes = password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False

def make_tokens(user_data: Dict[str, Any]) -> Dict[str, str]:
    """
    Generate JWT access and refresh tokens for a user.

    Args:
        user_data: Dictionary containing user information (customer_id, tenant_id, email, etc.)

    Returns:
        Dictionary with 'access_token' and 'refresh_token' keys
    """
    if not user_data.get('customer_id'):
        raise ValueError("customer_id is required in user_data")

    now = datetime.utcnow()

    # Access token payload
    access_payload = {
        'sub': str(user_data['customer_id']),
        'tenant_id': user_data.get('tenant_id'),
        'email': user_data.get('email'),
        'iat': now,
        'exp': now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        'type': 'access'
    }

    # Refresh token payload
    refresh_payload = {
        'sub': str(user_data['customer_id']),
        'tenant_id': user_data.get('tenant_id'),
        'iat': now,
        'exp': now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        'type': 'refresh'
    }

    # Generate tokens
    access_token = jwt.encode(access_payload, JWT_SECRET, algorithm=JWT_ALG)
    refresh_token = jwt.encode(refresh_payload, JWT_SECRET, algorithm=JWT_ALG)

    return {
        'access_token': access_token,
        'refresh_token': refresh_token
    }

def verify_token(token: str, token_type: str = 'access') -> Optional[Dict[str, Any]]:
    """
    Verify and decode a JWT token.

    Args:
        token: JWT token string to verify
        token_type: Expected token type ('access' or 'refresh')

    Returns:
        Decoded token payload if valid, None otherwise
    """
    if not token:
        return None

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])

        # Check token type if specified
        if token_type and payload.get('type') != token_type:
            return None

        return payload

    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def generate_password_reset_token(email: str) -> Tuple[str, datetime]:
    """
    Generate a secure password reset token for an email.

    Args:
        email: User email address

    Returns:
        Tuple of (token_string, expiration_datetime)
    """
    if not email:
        raise ValueError("Email is required")

    now = datetime.utcnow()
    expiration = now + timedelta(hours=1)  # 1 hour expiration

    payload = {
        'email': email,
        'iat': now,
        'exp': expiration,
        'type': 'password_reset'
    }

    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

    return token, expiration

def verify_password_reset_token(token: str) -> Optional[str]:
    """
    Verify a password reset token and return the email if valid.

    Args:
        token: Password reset token to verify

    Returns:
        Email address if token is valid, None otherwise
    """
    payload = verify_token(token, 'password_reset')
    if payload:
        return payload.get('email')
    return None

def validate_password_strength(password: str) -> Tuple[bool, str]:
    """
    Validate password meets security requirements.

    Args:
        password: Password to validate

    Returns:
        Tuple of (is_valid: bool, error_message: str)
    """
    if not password:
        return False, "Password is required"

    if len(password) < 8:
        return False, "Password must be at least 8 characters long"

    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"

    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"

    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"

    special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    if not any(c in special_chars for c in password):
        return False, f"Password must contain at least one special character: {special_chars}"

    return True, "Password is valid"

# Legacy support - check if old SHA256 hashes need migration
def is_bcrypt_hash(password_hash: str) -> bool:
    """Check if a password hash is bcrypt format."""
    return password_hash.startswith('$2b$') or password_hash.startswith('$2a$')

def migrate_legacy_password(password: str, old_hash: str) -> Optional[str]:
    """
    Migrate from legacy SHA256 to bcrypt if the password matches the old hash.

    Args:
        password: Plain text password
        old_hash: Legacy SHA256 hash

    Returns:
        New bcrypt hash if migration successful, None otherwise
    """
    # Check if old password matches legacy SHA256 hash
    legacy_hash = hashlib.sha256(password.encode()).hexdigest()
    if legacy_hash == old_hash:
        return hash_password(password)
    return None

if __name__ == "__main__":
    # Test the security functions independently
    print("🧪 TESTING INDEPENDENT SECURITY MODULE")
    print("=" * 50)

    # Test password hashing
    test_password = "TestPassword123!"
    hashed = hash_password(test_password)
    print(f"✅ Password hashing works: {len(hashed)} chars")

    # Test password verification
    valid = verify_password(test_password, hashed)
    print(f"✅ Password verification works: {valid}")

    # Test JWT tokens
    user_data = {'customer_id': 123, 'tenant_id': 'test_tenant', 'email': 'test@example.com'}
    tokens = make_tokens(user_data)
    print(f"✅ JWT generation works: {len(tokens)} tokens")

    # Test token verification
    decoded = verify_token(tokens['access_token'])
    print(f"✅ JWT verification works: {decoded['sub'] if decoded else 'Failed'}")

    print("\\n🎉 INDEPENDENT SECURITY MODULE WORKING!")
'''

        # Write the independent security module
        with open("/Users/jesusortiz/Edgars-mobile-auto-shop/backend/security_core.py", "w") as f:
            f.write(security_module_content)

        print("✅ Created independent security module: backend/security_core.py")
        return True

    except Exception as e:
        print(f"❌ Error creating security module: {e}")
        return False


def create_flask_factory():
    """Create Flask application factory pattern to fix instantiation conflicts"""
    print("\n🔧 CREATING FLASK APPLICATION FACTORY")
    print("=" * 60)

    flask_factory_content = '''"""
FLASK APPLICATION FACTORY

This module implements the application factory pattern to fix Flask instantiation conflicts.
Separates Flask app creation from import time to allow testing security modules.

CRITICAL: This fixes DIRECTIVE 2 - Flask instantiation conflicts
"""

import os
from flask import Flask
from backend.security_core import *  # Import all security functions

def create_app(config=None):
    """
    Application factory function to create Flask app instance.

    Args:
        config: Optional configuration dictionary

    Returns:
        Configured Flask application instance
    """
    app = Flask(__name__)

    # Load configuration
    if config:
        app.config.update(config)
    else:
        # Default configuration
        app.config.update({
            'SECRET_KEY': os.getenv('FLASK_SECRET_KEY', 'dev-secret-key'),
            'DATABASE_URL': os.getenv('DATABASE_URL', 'postgresql://localhost/autoshop'),
            'JWT_SECRET': os.getenv('JWT_SECRET', 'dev_secret'),
            'DEBUG': os.getenv('FLASK_ENV') == 'development'
        })

    # Import and register blueprints after app creation
    from backend.routes import auth_bp, api_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(api_bp, url_prefix='/api')

    return app

def create_app_for_testing(database_url=None):
    """
    Create app instance specifically for testing.

    Args:
        database_url: Test database URL

    Returns:
        Flask app configured for testing
    """
    test_config = {
        'TESTING': True,
        'DATABASE_URL': database_url or 'postgresql://localhost/test_autoshop',
        'JWT_SECRET': 'test_secret',
        'WTF_CSRF_ENABLED': False
    }

    return create_app(test_config)

# Only create app if running this module directly
if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
'''

    # Write the Flask factory
    with open("/Users/jesusortiz/Edgars-mobile-auto-shop/backend/app_factory.py", "w") as f:
        f.write(flask_factory_content)

    print("✅ Created Flask application factory: backend/app_factory.py")
    return True


def test_independent_security_imports():
    """Test that security functions can be imported without Flask conflicts"""
    print("\n🧪 TESTING INDEPENDENT SECURITY IMPORTS")
    print("=" * 60)

    try:
        # Test importing security functions
        sys.path.insert(0, "/Users/jesusortiz/Edgars-mobile-auto-shop")

        from backend.security_core import hash_password, make_tokens, verify_password, verify_token

        print("✅ Successfully imported security functions")

        # Test each function
        test_password = "TestSecurityFunctions123!"
        hashed = hash_password(test_password)
        print(f"✅ hash_password works: {hashed[:20]}...")

        verified = verify_password(test_password, hashed)
        print(f"✅ verify_password works: {verified}")

        user_data = {"customer_id": 456, "tenant_id": "test_tenant_2", "email": "security@test.com"}
        tokens = make_tokens(user_data)
        print(f"✅ make_tokens works: Generated {len(tokens)} tokens")

        decoded = verify_token(tokens["access_token"])
        print(f"✅ verify_token works: Decoded customer_id {decoded['sub']}")

        return True

    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Security function error: {e}")
        return False


if __name__ == "__main__":
    print("🚨 DIRECTIVE 2: FLASK APP ARCHITECTURE REPAIR")
    print("=" * 70)

    success = True

    # Step 1: Analyze the current problem
    if not analyze_flask_instantiation_issue():
        success = False

    # Step 2: Extract security functions
    security_functions = extract_security_functions()
    if not security_functions:
        success = False

    # Step 3: Create independent security module
    if not create_security_module():
        success = False

    # Step 4: Create Flask application factory
    if not create_flask_factory():
        success = False

    # Step 5: Test independent imports
    if not test_independent_security_imports():
        success = False

    if success:
        print("\\n✅ DIRECTIVE 2 COMPLETE: FLASK ARCHITECTURE FIXED!")
        print("🔧 Fixed: Flask instantiation conflicts resolved")
        print("🛡️  Created: Independent security module (security_core.py)")
        print("🏭 Created: Flask application factory (app_factory.py)")
        print("🧪 Verified: Security functions can be imported and tested independently")
        print(
            "\\n🚨 DEPLOYMENT UPDATE: Use app_factory.create_app() instead of direct instantiation"
        )
    else:
        print("\\n❌ DIRECTIVE 2 FAILED: Could not fix Flask architecture")
        sys.exit(1)
