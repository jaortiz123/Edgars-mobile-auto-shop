"""
Comprehensive unit tests for security_core.py module
CRITICAL HIGH-VALUE TARGET: This module was at 0% coverage and contains
core security functions that protect the entire application.
"""

import pytest
import hashlib
import time
from datetime import datetime, timedelta
from unittest.mock import patch

# Import the security_core module and its components
from security_core import (
    hash_password,
    verify_password,
    make_tokens,
    verify_token,
    generate_password_reset_token,
    verify_password_reset_token,
    validate_password_strength,
    is_bcrypt_hash,
    migrate_legacy_password,
    JWT_SECRET,
    JWT_ALG,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)


@pytest.mark.unit
class TestPasswordHashing:
    """Test password hashing and verification functions"""

    def test_hash_password_basic(self):
        """Test basic password hashing"""
        password = "TestPassword123!"
        hashed = hash_password(password)

        # Should return a bcrypt hash
        assert isinstance(hashed, str)
        assert len(hashed) > 50  # Bcrypt hashes are typically 60 chars
        assert hashed.startswith("$2b$")  # Bcrypt identifier

    def test_hash_password_empty_raises_error(self):
        """Test hash_password raises error for empty password"""
        with pytest.raises(ValueError, match="Password cannot be empty"):
            hash_password("")

        with pytest.raises(ValueError, match="Password cannot be empty"):
            hash_password(None)

    def test_hash_password_different_each_time(self):
        """Test that hashing same password produces different hashes (salt)"""
        password = "SamePassword123!"
        hash1 = hash_password(password)
        hash2 = hash_password(password)

        # Different salts should produce different hashes
        assert hash1 != hash2

        # But both should verify correctly
        assert verify_password(password, hash1)
        assert verify_password(password, hash2)

    def test_verify_password_correct(self):
        """Test password verification with correct password"""
        password = "CorrectPassword123!"
        hashed = hash_password(password)

        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Test password verification with incorrect password"""
        password = "CorrectPassword123!"
        wrong_password = "WrongPassword123!"
        hashed = hash_password(password)

        assert verify_password(wrong_password, hashed) is False

    def test_verify_password_empty_inputs(self):
        """Test password verification with empty inputs"""
        assert verify_password("", "some_hash") is False
        assert verify_password("password", "") is False
        assert verify_password("", "") is False
        assert verify_password(None, "hash") is False
        assert verify_password("password", None) is False

    def test_verify_password_invalid_hash(self):
        """Test password verification with malformed hash"""
        password = "TestPassword123!"
        invalid_hash = "not_a_valid_bcrypt_hash"

        assert verify_password(password, invalid_hash) is False

    def test_unicode_password_handling(self):
        """Test password hashing with unicode characters"""
        unicode_password = "Tëst🔐Pássw0rd!"
        hashed = hash_password(unicode_password)

        assert verify_password(unicode_password, hashed) is True
        assert verify_password("TestPassword!", hashed) is False


@pytest.mark.unit
class TestJWTTokens:
    """Test JWT token generation and verification"""

    def test_make_tokens_basic(self):
        """Test basic token generation"""
        customer_id = "123"
        access_token, refresh_token = make_tokens(customer_id)

        assert isinstance(access_token, str)
        assert isinstance(refresh_token, str)
        assert len(access_token) > 50  # JWT tokens are substantial
        assert len(refresh_token) > 50
        assert access_token != refresh_token

    def test_make_tokens_empty_customer_id_raises_error(self):
        """Test make_tokens raises error for empty customer_id"""
        with pytest.raises(ValueError, match="Customer ID is required"):
            make_tokens("")

        with pytest.raises(ValueError, match="Customer ID is required"):
            make_tokens(None)

    def test_make_tokens_with_all_parameters(self):
        """Test token generation with all optional parameters"""
        customer_id = "456"
        email = "test@example.com"
        phone = "+1234567890"
        role = "admin"

        access_token, refresh_token = make_tokens(
            customer_id=customer_id, email=email, phone=phone, role=role
        )

        # Verify access token contains all data
        access_payload = verify_token(access_token, "access")
        assert access_payload["customer_id"] == customer_id
        assert access_payload["email"] == email
        assert access_payload["phone"] == phone
        assert access_payload["role"] == role
        assert access_payload["type"] == "access"

        # Verify refresh token is minimal
        refresh_payload = verify_token(refresh_token, "refresh")
        assert refresh_payload["customer_id"] == customer_id
        assert refresh_payload["type"] == "refresh"
        assert "email" not in refresh_payload  # Not in refresh token
        assert "phone" not in refresh_payload  # Not in refresh token

    def test_verify_token_valid_access(self):
        """Test verification of valid access token"""
        customer_id = "789"
        access_token, _ = make_tokens(customer_id)

        payload = verify_token(access_token, "access")
        assert payload is not None
        assert payload["customer_id"] == customer_id
        assert payload["type"] == "access"
        assert "exp" in payload
        assert "iat" in payload

    def test_verify_token_valid_refresh(self):
        """Test verification of valid refresh token"""
        customer_id = "101"
        _, refresh_token = make_tokens(customer_id)

        payload = verify_token(refresh_token, "refresh")
        assert payload is not None
        assert payload["customer_id"] == customer_id
        assert payload["type"] == "refresh"

    def test_verify_token_wrong_type(self):
        """Test verification fails with wrong token type"""
        customer_id = "102"
        access_token, refresh_token = make_tokens(customer_id)

        # Try to verify access token as refresh
        assert verify_token(access_token, "refresh") is None

        # Try to verify refresh token as access
        assert verify_token(refresh_token, "access") is None

    def test_verify_token_empty_or_invalid(self):
        """Test verification of empty or invalid tokens"""
        assert verify_token("") is None
        assert verify_token(None) is None
        assert verify_token("invalid.jwt.token") is None
        assert verify_token("not_a_jwt") is None

    def test_token_expiration(self):
        """Test token expiration logic"""
        customer_id = "103"

        # Mock datetime to create expired token
        past_time = datetime.utcnow() - timedelta(hours=1)
        with patch("security_core.datetime") as mock_datetime:
            mock_datetime.utcnow.return_value = past_time
            access_token, _ = make_tokens(customer_id)

        # Token should be expired and invalid now
        payload = verify_token(access_token, "access")
        assert payload is None  # Should be None due to expiration

    def test_token_default_role(self):
        """Test default role is set correctly"""
        customer_id = "104"
        access_token, _ = make_tokens(customer_id)

        payload = verify_token(access_token, "access")
        assert payload["role"] == "customer"  # Default role


@pytest.mark.unit
class TestPasswordResetTokens:
    """Test password reset token functionality"""

    def test_generate_password_reset_token(self):
        """Test password reset token generation"""
        email = "reset@example.com"
        token, expiration = generate_password_reset_token(email)

        assert isinstance(token, str)
        assert len(token) > 50
        assert isinstance(expiration, datetime)

        # Expiration should be about 1 hour from now
        now = datetime.utcnow()
        expected_exp = now + timedelta(hours=1)
        time_diff = abs((expiration - expected_exp).total_seconds())
        assert time_diff < 5  # Within 5 seconds tolerance

    def test_generate_password_reset_token_empty_email(self):
        """Test password reset token generation with empty email"""
        with pytest.raises(ValueError, match="Email is required"):
            generate_password_reset_token("")

        with pytest.raises(ValueError, match="Email is required"):
            generate_password_reset_token(None)

    def test_verify_password_reset_token_valid(self):
        """Test verification of valid password reset token"""
        email = "verify@example.com"
        token, _ = generate_password_reset_token(email)

        verified_email = verify_password_reset_token(token)
        assert verified_email == email

    def test_verify_password_reset_token_invalid(self):
        """Test verification of invalid password reset token"""
        assert verify_password_reset_token("invalid_token") is None
        assert verify_password_reset_token("") is None
        assert verify_password_reset_token(None) is None

    def test_verify_password_reset_token_expired(self):
        """Test verification of expired password reset token"""
        email = "expired@example.com"

        # Create token in the past
        past_time = datetime.utcnow() - timedelta(hours=2)
        with patch("security_core.datetime") as mock_datetime:
            mock_datetime.utcnow.return_value = past_time
            token, _ = generate_password_reset_token(email)

        # Should be expired and return None
        verified_email = verify_password_reset_token(token)
        assert verified_email is None


@pytest.mark.unit
class TestPasswordValidation:
    """Test password strength validation"""

    def test_validate_strong_password(self):
        """Test validation of strong passwords"""
        strong_passwords = [
            "StrongPass123!",
            "MyP@ssw0rd2024",
            "SecureP4ss#word",
            "V3ry$trongPa$$w0rd",
            "AnotherG00d!Password",
        ]

        for password in strong_passwords:
            is_valid, message = validate_password_strength(password)
            assert is_valid is True, f"Password '{password}' should be valid but got: {message}"
            assert message == "Password is valid"

    def test_validate_empty_password(self):
        """Test validation of empty password"""
        is_valid, message = validate_password_strength("")
        assert is_valid is False
        assert "required" in message.lower()

        is_valid, message = validate_password_strength(None)
        assert is_valid is False
        assert "required" in message.lower()

    def test_validate_too_short_password(self):
        """Test validation of too short passwords"""
        short_passwords = ["", "a", "Ab1!", "Short7!"]

        for password in short_passwords:
            is_valid, message = validate_password_strength(password)
            if len(password) < 8:
                assert is_valid is False
                if password:  # Not empty
                    assert "8 characters" in message

    def test_validate_missing_uppercase(self):
        """Test validation of passwords without uppercase letters"""
        is_valid, message = validate_password_strength("lowercase123!")
        assert is_valid is False
        assert "uppercase" in message.lower()

    def test_validate_missing_lowercase(self):
        """Test validation of passwords without lowercase letters"""
        is_valid, message = validate_password_strength("UPPERCASE123!")
        assert is_valid is False
        assert "lowercase" in message.lower()

    def test_validate_missing_digit(self):
        """Test validation of passwords without digits"""
        is_valid, message = validate_password_strength("NoDigitsHere!")
        assert is_valid is False
        assert "digit" in message.lower()

    def test_validate_missing_special_char(self):
        """Test validation of passwords without special characters"""
        is_valid, message = validate_password_strength("NoSpecialChars123")
        assert is_valid is False
        assert "special character" in message.lower()

    def test_validate_edge_case_passwords(self):
        """Test validation of edge case passwords"""
        edge_cases = [
            ("12345678", False),  # Only digits
            ("abcdefgh", False),  # Only lowercase
            ("ABCDEFGH", False),  # Only uppercase
            ("!@#$%^&*", False),  # Only special chars
            ("Aa1!", False),  # Too short but has all types
        ]

        for password, should_be_valid in edge_cases:
            is_valid, _ = validate_password_strength(password)
            assert is_valid is should_be_valid, f"Password '{password}' validation incorrect"


@pytest.mark.unit
class TestLegacyPasswordMigration:
    """Test legacy password hash detection and migration"""

    def test_is_bcrypt_hash_valid(self):
        """Test detection of valid bcrypt hashes"""
        # Generate actual bcrypt hash for testing
        bcrypt_hash = hash_password("test123")
        assert is_bcrypt_hash(bcrypt_hash) is True

        # Test bcrypt prefixes
        assert is_bcrypt_hash("$2b$12$abcdefghijk") is True
        assert is_bcrypt_hash("$2a$10$somehashhhere") is True

    def test_is_bcrypt_hash_invalid(self):
        """Test detection of non-bcrypt hashes"""
        legacy_hashes = [
            "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",  # SHA256
            "plain_text_password",
            "",
            None,
            "md5hash",
            "$1$salt$hash",  # MD5 crypt
        ]

        for hash_val in legacy_hashes:
            assert is_bcrypt_hash(hash_val) is False

    def test_migrate_legacy_password_success(self):
        """Test successful migration from SHA256 to bcrypt"""
        password = "legacy_password_123"
        # Create legacy SHA256 hash
        legacy_hash = hashlib.sha256(password.encode()).hexdigest()

        # Migrate should succeed
        new_hash = migrate_legacy_password(password, legacy_hash)
        assert new_hash is not None
        assert is_bcrypt_hash(new_hash) is True
        assert verify_password(password, new_hash) is True

    def test_migrate_legacy_password_wrong_password(self):
        """Test failed migration with wrong password"""
        correct_password = "correct_password"
        wrong_password = "wrong_password"
        legacy_hash = hashlib.sha256(correct_password.encode()).hexdigest()

        # Migration should fail with wrong password
        new_hash = migrate_legacy_password(wrong_password, legacy_hash)
        assert new_hash is None

    def test_migrate_legacy_password_invalid_hash(self):
        """Test migration with invalid legacy hash"""
        password = "test_password"
        invalid_hash = "not_a_valid_sha256_hash"

        new_hash = migrate_legacy_password(password, invalid_hash)
        assert new_hash is None


@pytest.mark.unit
class TestSecurityConstants:
    """Test security configuration constants"""

    def test_jwt_constants(self):
        """Test JWT configuration constants are set"""
        assert JWT_SECRET is not None
        assert len(JWT_SECRET) > 0
        assert JWT_ALG == "HS256"
        assert ACCESS_TOKEN_EXPIRE_MINUTES == 15
        assert REFRESH_TOKEN_EXPIRE_DAYS == 7

    def test_token_expiration_logic(self):
        """Test token expiration is working as configured"""
        customer_id = "test_exp"
        access_token, refresh_token = make_tokens(customer_id)

        # Decode without verification to check timestamps
        import jwt

        access_payload = jwt.decode(access_token, options={"verify_signature": False})
        refresh_payload = jwt.decode(refresh_token, options={"verify_signature": False})

        # Check expiration differences
        access_exp = datetime.fromtimestamp(access_payload["exp"])
        access_iat = datetime.fromtimestamp(access_payload["iat"])
        refresh_exp = datetime.fromtimestamp(refresh_payload["exp"])
        refresh_iat = datetime.fromtimestamp(refresh_payload["iat"])

        # Access token should expire in 15 minutes
        access_duration = (access_exp - access_iat).total_seconds()
        expected_access_duration = ACCESS_TOKEN_EXPIRE_MINUTES * 60
        assert abs(access_duration - expected_access_duration) < 10  # 10 second tolerance

        # Refresh token should expire in 7 days
        refresh_duration = (refresh_exp - refresh_iat).total_seconds()
        expected_refresh_duration = REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
        assert abs(refresh_duration - expected_refresh_duration) < 10  # 10 second tolerance


@pytest.mark.unit
class TestIntegrationScenarios:
    """Test realistic security workflow scenarios"""

    def test_complete_user_registration_flow(self):
        """Test complete user registration security flow"""
        # 1. Validate password meets requirements
        password = "SecurePass123!"
        is_valid, _ = validate_password_strength(password)
        assert is_valid is True

        # 2. Hash password for storage
        hashed = hash_password(password)
        assert is_bcrypt_hash(hashed) is True

        # 3. Generate tokens for user
        customer_id = "new_user_456"
        email = "newuser@example.com"
        access_token, refresh_token = make_tokens(customer_id, email=email)

        # 4. Verify tokens work
        access_payload = verify_token(access_token, "access")
        assert access_payload["customer_id"] == customer_id
        assert access_payload["email"] == email

        # 5. Verify stored password
        assert verify_password(password, hashed) is True

    def test_password_reset_flow(self):
        """Test complete password reset security flow"""
        email = "reset_user@example.com"

        # 1. Generate reset token
        reset_token, expiration = generate_password_reset_token(email)

        # 2. Verify reset token
        verified_email = verify_password_reset_token(reset_token)
        assert verified_email == email

        # 3. New password validation
        new_password = "NewSecurePass456!"
        is_valid, _ = validate_password_strength(new_password)
        assert is_valid is True

        # 4. Hash new password
        new_hashed = hash_password(new_password)
        assert verify_password(new_password, new_hashed) is True

    def test_legacy_user_login_migration(self):
        """Test legacy user login with password migration"""
        password = "user_legacy_password"
        legacy_hash = hashlib.sha256(password.encode()).hexdigest()

        # 1. Detect legacy hash
        assert is_bcrypt_hash(legacy_hash) is False

        # 2. Verify legacy password and migrate
        new_hash = migrate_legacy_password(password, legacy_hash)
        assert new_hash is not None
        assert is_bcrypt_hash(new_hash) is True

        # 3. Verify new hash works
        assert verify_password(password, new_hash) is True

        # 4. Generate tokens for migrated user
        customer_id = "legacy_user_789"
        access_token, _ = make_tokens(customer_id)
        payload = verify_token(access_token, "access")
        assert payload["customer_id"] == customer_id


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
