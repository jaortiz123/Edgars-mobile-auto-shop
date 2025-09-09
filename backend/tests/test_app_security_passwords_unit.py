"""
Comprehensive unit tests for app/security/passwords.py module
CRITICAL HIGH-VALUE TARGET: This module provides secure password hashing
and handles legacy password migration - core security functionality
that was likely at low coverage.
"""

import pytest
import hashlib
from unittest.mock import patch

# Import the password security module
from backend.app.security.passwords import (
    hash_password,
    verify_password,
    verify_password_with_salt,
    is_bcrypt_hash,
    get_migration_stats,
)


@pytest.mark.unit
class TestPasswordHashing:
    """Test secure password hashing functionality"""

    def test_hash_password_creates_bcrypt_hash(self):
        """Test that hash_password creates valid bcrypt hashes"""
        password = "TestPassword123!"
        hashed = hash_password(password)

        assert isinstance(hashed, str)
        assert hashed.startswith("$2b$12$")  # bcrypt with cost factor 12
        assert len(hashed) >= 60  # bcrypt hashes are at least 60 chars

    def test_hash_password_different_salts(self):
        """Test that same password produces different hashes due to random salts"""
        password = "SamePassword123!"
        hash1 = hash_password(password)
        hash2 = hash_password(password)

        # Different salts should produce different hashes
        assert hash1 != hash2

        # But both should be valid bcrypt hashes
        assert hash1.startswith("$2b$12$")
        assert hash2.startswith("$2b$12$")

    def test_hash_password_unicode_support(self):
        """Test password hashing with unicode characters"""
        unicode_passwords = ["Tëst🔐Pássw0rd!", "中文密码123!", "العربية123!", "Русский123!"]

        for password in unicode_passwords:
            hashed = hash_password(password)
            assert hashed.startswith("$2b$12$")
            assert len(hashed) >= 60

    def test_hash_password_empty_and_edge_cases(self):
        """Test password hashing with edge cases"""
        edge_cases = [
            "",  # Empty string
            " ",  # Single space
            "a",  # Single character
            "a" * 1000,  # Very long password
            "\n\t\r",  # Whitespace characters
            "special!@#$%^&*()_+-=[]{}|;:,.<>?",  # Special characters
        ]

        for password in edge_cases:
            hashed = hash_password(password)
            assert hashed.startswith("$2b$12$")


@pytest.mark.unit
class TestBcryptPasswordVerification:
    """Test bcrypt password verification"""

    def test_verify_password_bcrypt_correct(self):
        """Test verification of correct bcrypt passwords"""
        password = "CorrectPassword123!"
        hashed = hash_password(password)

        is_valid, needs_migration = verify_password(password, hashed)
        assert is_valid is True
        assert needs_migration is False  # bcrypt doesn't need migration

    def test_verify_password_bcrypt_incorrect(self):
        """Test verification of incorrect bcrypt passwords"""
        password = "CorrectPassword123!"
        wrong_password = "WrongPassword123!"
        hashed = hash_password(password)

        is_valid, needs_migration = verify_password(wrong_password, hashed)
        assert is_valid is False
        assert needs_migration is False

    def test_verify_password_bcrypt_variants(self):
        """Test verification with different bcrypt prefixes"""
        password = "TestPassword123!"

        # Test different bcrypt prefixes (simulated)
        bcrypt_variants = [
            "$2b$12$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOP",
            "$2a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOP",
            "$2y$11$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOP",
        ]

        for variant in bcrypt_variants:
            # These will fail verification but should be recognized as bcrypt
            is_valid, needs_migration = verify_password(password, variant)
            assert is_valid is False  # Wrong hash for this password
            assert needs_migration is False  # But recognized as bcrypt


@pytest.mark.unit
class TestLegacyPasswordVerification:
    """Test legacy SHA256 password verification and migration detection"""

    def test_verify_password_sha256_correct(self):
        """Test verification of correct SHA256 legacy passwords"""
        password = "legacy_password"
        # Create SHA256 hash as the legacy system would
        sha256_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()

        is_valid, needs_migration = verify_password(password, sha256_hash)
        assert is_valid is True
        assert needs_migration is True  # SHA256 needs migration

    def test_verify_password_sha256_incorrect(self):
        """Test verification of incorrect SHA256 legacy passwords"""
        password = "legacy_password"
        wrong_password = "wrong_password"
        sha256_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()

        is_valid, needs_migration = verify_password(wrong_password, sha256_hash)
        assert is_valid is False
        assert needs_migration is False  # Invalid password, no migration

    def test_verify_password_with_salt_sha256_correct(self):
        """Test verification with salt matching legacy _hash_password format"""
        password = "test_password"
        salt = "random_salt_123"

        # Create legacy hash: SHA256(salt + password)
        h = hashlib.sha256()
        h.update((salt + password).encode("utf-8"))
        legacy_hash = h.hexdigest()

        is_valid, needs_migration = verify_password_with_salt(password, legacy_hash, salt)
        assert is_valid is True
        assert needs_migration is True

    def test_verify_password_with_salt_sha256_incorrect(self):
        """Test verification with salt for incorrect passwords"""
        password = "test_password"
        wrong_password = "wrong_password"
        salt = "random_salt_123"

        # Create legacy hash with correct password
        h = hashlib.sha256()
        h.update((salt + password).encode("utf-8"))
        legacy_hash = h.hexdigest()

        # Try to verify with wrong password
        is_valid, needs_migration = verify_password_with_salt(wrong_password, legacy_hash, salt)
        assert is_valid is False
        assert needs_migration is False

    def test_verify_password_with_salt_bcrypt_hash(self):
        """Test that verify_password_with_salt handles bcrypt hashes correctly"""
        password = "test_password"
        salt = "ignored_for_bcrypt"
        bcrypt_hash = hash_password(password)

        is_valid, needs_migration = verify_password_with_salt(password, bcrypt_hash, salt)
        assert is_valid is True
        assert needs_migration is False  # bcrypt doesn't need migration

    def test_verify_password_with_salt_empty_salt(self):
        """Test verification with empty salt"""
        password = "test_password"
        salt = ""

        # Create hash with empty salt
        h = hashlib.sha256()
        h.update((salt + password).encode("utf-8"))
        legacy_hash = h.hexdigest()

        is_valid, needs_migration = verify_password_with_salt(password, legacy_hash, salt)
        assert is_valid is True
        assert needs_migration is True


@pytest.mark.unit
class TestBcryptHashDetection:
    """Test bcrypt hash format detection"""

    def test_is_bcrypt_hash_valid_formats(self):
        """Test detection of valid bcrypt hash formats"""
        valid_bcrypt_hashes = [
            "$2b$12$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOP",
            "$2a$10$somevalidbcrypthashherewithenoughcharacters1234567890",
            "$2y$11$anothervalidbcryptformatwithalltherequiredcomponents123",
        ]

        for hash_val in valid_bcrypt_hashes:
            assert is_bcrypt_hash(hash_val) is True

    def test_is_bcrypt_hash_invalid_formats(self):
        """Test detection of non-bcrypt hash formats"""
        non_bcrypt_hashes = [
            "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",  # SHA256
            "$1$salt$hash",  # MD5 crypt
            "$5$salt$hash",  # SHA-256 crypt
            "$6$salt$hash",  # SHA-512 crypt
            "plain_text",  # Plain text
            "",  # Empty string
            "$2c$12$invalid",  # Invalid bcrypt prefix
            # Note: "$2b$invalid" would be detected as bcrypt prefix (which is correct behavior)
        ]

        for hash_val in non_bcrypt_hashes:
            assert is_bcrypt_hash(hash_val) is False

    def test_is_bcrypt_hash_edge_cases(self):
        """Test bcrypt detection with edge cases"""
        # These SHOULD be detected as bcrypt since they have the right prefix
        bcrypt_prefixes = [
            "$2b$",  # Valid prefix (function checks prefix only)
            "$2a$anything",  # Valid prefix with content
            "$2b$12",  # Valid prefix with cost
            "$2y$11$hash",  # Valid prefix with full format
        ]

        for hash_val in bcrypt_prefixes:
            assert is_bcrypt_hash(hash_val) is True

        # These should NOT be detected as bcrypt
        non_bcrypt_cases = [
            "$2B$12$valid",  # Wrong case (uppercase B)
            "x$2b$12$valid",  # Prefix not at start
            "$2c$12$invalid",  # Invalid prefix ($2c)
            "$2d$12$invalid",  # Invalid prefix ($2d)
            "",  # Empty string
            "plain_text",  # No prefix
        ]

        for hash_val in non_bcrypt_cases:
            assert is_bcrypt_hash(hash_val) is False


@pytest.mark.unit
class TestMigrationStatistics:
    """Test password migration statistics functionality"""

    def test_get_migration_stats_mixed_hashes(self):
        """Test migration statistics with mixed hash types"""
        password_hashes = [
            "$2b$12$bcrypthashnumber1withalltherequiredcharacters12345",  # bcrypt
            "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",  # SHA256
            "$2a$10$anotherbcrypthashnumber2withdifferentcostfactor123",  # bcrypt
            "a9b9f04336ce0181a08e774e01113b98f4949b2fbeaa9c8ac6b717c1c5b49d6",  # SHA256
            "$2y$11$thirdbcrypthashdifferentvariantwithfullvalidformat12",  # bcrypt
        ]

        stats = get_migration_stats(password_hashes)

        assert stats["total"] == 5
        assert stats["bcrypt"] == 3
        assert stats["sha256"] == 2
        assert stats["migration_percentage"] == 60.0  # 3/5 * 100

    def test_get_migration_stats_all_bcrypt(self):
        """Test migration statistics with all bcrypt hashes"""
        password_hashes = [
            "$2b$12$bcrypthashnumber1withalltherequiredcharacters12345",
            "$2a$10$anotherbcrypthashnumber2withdifferentcostfactor123",
            "$2y$11$thirdbcrypthashdifferentvariantwithfullvalidformat12",
        ]

        stats = get_migration_stats(password_hashes)

        assert stats["total"] == 3
        assert stats["bcrypt"] == 3
        assert stats["sha256"] == 0
        assert stats["migration_percentage"] == 100.0

    def test_get_migration_stats_all_sha256(self):
        """Test migration statistics with all SHA256 hashes"""
        password_hashes = [
            "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
            "a9b9f04336ce0181a08e774e01113b98f4949b2fbeaa9c8ac6b717c1c5b49d6",
            "b9c9f04336ce0181a08e774e01113b98f4949b2fbeaa9c8ac6b717c1c5b49d7",
        ]

        stats = get_migration_stats(password_hashes)

        assert stats["total"] == 3
        assert stats["bcrypt"] == 0
        assert stats["sha256"] == 3
        assert stats["migration_percentage"] == 0.0

    def test_get_migration_stats_empty_list(self):
        """Test migration statistics with empty hash list"""
        stats = get_migration_stats([])

        assert stats["total"] == 0
        assert stats["bcrypt"] == 0
        assert stats["sha256"] == 0
        assert stats["migration_percentage"] == 0.0

    def test_get_migration_stats_single_hash(self):
        """Test migration statistics with single hash"""
        bcrypt_stats = get_migration_stats(["$2b$12$validbcrypthashherewithenoughchars123"])
        assert bcrypt_stats["migration_percentage"] == 100.0

        sha256_stats = get_migration_stats(
            ["5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"]
        )
        assert sha256_stats["migration_percentage"] == 0.0


@pytest.mark.unit
class TestErrorHandling:
    """Test error handling in password functions"""

    def test_verify_password_exception_handling(self):
        """Test that verify_password handles exceptions gracefully"""
        password = "test_password"

        # Test with invalid hash that might cause bcrypt exceptions
        invalid_hashes = [
            None,  # None value
            123,  # Non-string type
            "$2b$invalid",  # Invalid bcrypt format
            "x" * 1000,  # Extremely long string
        ]

        for invalid_hash in invalid_hashes:
            try:
                is_valid, needs_migration = verify_password(
                    password, str(invalid_hash) if invalid_hash is not None else ""
                )
                assert is_valid is False
                assert needs_migration is False
            except:
                # Function should handle exceptions internally
                pytest.fail(
                    f"verify_password should handle exception for invalid hash: {invalid_hash}"
                )

    def test_verify_password_with_salt_exception_handling(self):
        """Test that verify_password_with_salt handles exceptions gracefully"""
        password = "test_password"
        salt = "test_salt"

        invalid_hashes = [
            None,
            123,
            "$2b$invalid",
            "x" * 1000,
        ]

        for invalid_hash in invalid_hashes:
            try:
                is_valid, needs_migration = verify_password_with_salt(
                    password, str(invalid_hash) if invalid_hash is not None else "", salt
                )
                assert is_valid is False
                assert needs_migration is False
            except:
                pytest.fail(
                    f"verify_password_with_salt should handle exception for invalid hash: {invalid_hash}"
                )


@pytest.mark.unit
class TestIntegrationScenarios:
    """Test realistic password management scenarios"""

    def test_new_user_registration_flow(self):
        """Test complete new user registration with bcrypt"""
        password = "NewUser123!"

        # 1. Hash password for new user
        hashed = hash_password(password)
        assert is_bcrypt_hash(hashed) is True

        # 2. Verify password at login
        is_valid, needs_migration = verify_password(password, hashed)
        assert is_valid is True
        assert needs_migration is False

    def test_legacy_user_login_and_migration(self):
        """Test legacy user login with automatic migration detection"""
        password = "LegacyUser123!"
        salt = "legacy_salt_456"

        # 1. Simulate legacy SHA256 storage
        h = hashlib.sha256()
        h.update((salt + password).encode("utf-8"))
        legacy_hash = h.hexdigest()

        # 2. User logs in with legacy hash
        is_valid, needs_migration = verify_password_with_salt(password, legacy_hash, salt)
        assert is_valid is True
        assert needs_migration is True

        # 3. System would now migrate to bcrypt
        new_hash = hash_password(password)
        assert is_bcrypt_hash(new_hash) is True

        # 4. Future logins use bcrypt
        is_valid, needs_migration = verify_password(password, new_hash)
        assert is_valid is True
        assert needs_migration is False

    def test_password_change_flow(self):
        """Test password change from old to new"""
        old_password = "OldPassword123!"
        new_password = "NewPassword456!"

        # 1. User has existing bcrypt hash
        old_hash = hash_password(old_password)

        # 2. Verify old password before change
        is_valid, _ = verify_password(old_password, old_hash)
        assert is_valid is True

        # 3. Hash new password
        new_hash = hash_password(new_password)
        assert new_hash != old_hash

        # 4. Verify new password works
        is_valid, _ = verify_password(new_password, new_hash)
        assert is_valid is True

        # 5. Verify old password no longer works with new hash
        is_valid, _ = verify_password(old_password, new_hash)
        assert is_valid is False

    def test_bulk_migration_analysis(self):
        """Test analyzing a database of mixed password hashes for migration"""
        # Simulate database with mixed hash types
        db_hashes = []

        # Add some legacy SHA256 hashes
        for i in range(10):
            password = f"legacy_user_{i}"
            sha256_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
            db_hashes.append(sha256_hash)

        # Add some bcrypt hashes
        for i in range(15):
            password = f"new_user_{i}"
            bcrypt_hash = hash_password(password)
            db_hashes.append(bcrypt_hash)

        # Analyze migration status
        stats = get_migration_stats(db_hashes)

        assert stats["total"] == 25
        assert stats["sha256"] == 10
        assert stats["bcrypt"] == 15
        assert stats["migration_percentage"] == 60.0  # 15/25 * 100


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
