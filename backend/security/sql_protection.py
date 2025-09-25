"""
SQL Injection Protection Utilities
Provides safe database query helpers and SQL injection detection.
"""

import logging
import re
from functools import wraps
from typing import Any, Dict, List, Tuple

import psycopg2.sql as sql
from flask import jsonify, request

logger = logging.getLogger(__name__)


class SQLInjectionProtector:
    """SQL injection protection and detection utilities."""

    # Common SQL injection patterns
    INJECTION_PATTERNS = [
        r"('|(\x27)|(\x2D)|-|;|\x00|\n|\r|\|\x1a)",  # Basic injection chars
        r"((select|union|insert|update|delete|drop|create|alter|exec|execute)\s*\()",  # SQL keywords with parentheses
        r"((union(.*?)select)|(select(.*?)from))",  # Union-based injection
        r"((and|or)\s+(1|true)\s*=\s*(1|true))",  # Boolean-based injection
        r"((and|or)\s+(1|true)\s*=\s*(2|false))",  # Boolean-based injection
        r"(benchmark\s*\(|sleep\s*\(|pg_sleep\s*\()",  # Time-based injection
        r"(waitfor\s+delay\s+|dbms_pipe\.receive_message)",  # Time-based injection (other DBs)
        r"(\x31|\x32|\x33|\x34|\x35|\x36|\x37|\x38|\x39|\x30)",  # Hex encoded numbers
        r"(char\s*\(|ascii\s*\(|substring\s*\()",  # Function-based injection
        r"(@@version|version\(\)|user\(\)|database\(\))",  # Information gathering
        r"(information_schema|pg_tables|pg_user)",  # Database metadata
        r"(\bor\b.*?\b=\b|\band\b.*?\b=\b)",  # Boolean conditions
        r"(concat\s*\(|group_concat\s*\()",  # String functions
        r"(load_file\s*\(|into\s+outfile|into\s+dumpfile)",  # File operations
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
                logger.warning(
                    f"SQL injection pattern detected: {pattern} in input: {input_string[:100]}..."
                )
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
            sanitized = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", sanitized)

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
    def select_with_conditions(
        table: str, columns: List[str], conditions: Dict[str, Any]
    ) -> Tuple[str, List]:
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
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", table):
            raise ValueError(f"Invalid table name: {table}")

        for col in columns:
            if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", col):
                raise ValueError(f"Invalid column name: {col}")

        # Build query using psycopg2.sql for safe identifier quoting
        select_clause = sql.SQL("SELECT {} FROM {}").format(
            sql.SQL(", ").join(map(sql.Identifier, columns)), sql.Identifier(table)
        )

        if conditions:
            # Validate condition keys (column names)
            for key in conditions.keys():
                if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", key):
                    raise ValueError(f"Invalid column name in conditions: {key}")

            # Build WHERE clause
            where_conditions = []
            parameters = []

            for key, value in conditions.items():
                where_conditions.append(sql.SQL("{} = %s").format(sql.Identifier(key)))
                parameters.append(SQLInjectionProtector.sanitize_input(value))

            where_clause = sql.SQL(" WHERE ").join(
                [sql.SQL(""), sql.SQL(" AND ").join(where_conditions)]
            )

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
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", table):
            raise ValueError(f"Invalid table name: {table}")

        # Validate column names
        for col in data.keys():
            if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", col):
                raise ValueError(f"Invalid column name: {col}")

        # Build INSERT query
        columns = list(data.keys())
        values = [SQLInjectionProtector.sanitize_input(data[col]) for col in columns]

        query = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
            sql.Identifier(table),
            sql.SQL(", ").join(map(sql.Identifier, columns)),
            sql.SQL(", ").join(sql.Placeholder() * len(columns)),
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
            return (
                jsonify(
                    {
                        "error": "Invalid input detected",
                        "message": "Your request contains potentially harmful content",
                    }
                ),
                400,
            )

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
