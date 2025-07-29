"""
Simple migration test to verify setup
"""
import pytest
from sqlalchemy import create_engine, text


def test_simple_migration_verification():
    """Simple test to verify the migration testing setup works"""
    # Create in-memory SQLite database
    engine = create_engine("sqlite:///:memory:")
    
    with engine.connect() as conn:
        # Create test table
        conn.execute(text("""
            CREATE TABLE appointments (
                id INTEGER PRIMARY KEY,
                scheduled_date DATE,
                scheduled_time TIME,
                start_ts TIMESTAMP
            )
        """))
        
        # Insert test data  
        conn.execute(text("INSERT INTO appointments (id, scheduled_date, scheduled_time) VALUES (1, '2025-07-29', '10:00:00')"))
        
        # Simulate migration - backfill start_ts
        conn.execute(text("""
            UPDATE appointments
            SET start_ts = datetime(scheduled_date || ' ' || scheduled_time)
            WHERE scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL
        """))
        
        # Verify the migration worked
        null_count = conn.execute(text("SELECT COUNT(*) FROM appointments WHERE start_ts IS NULL")).scalar()
        assert null_count == 0, "Should have no NULL start_ts after migration"
        
        # Verify we have the expected record
        total_count = conn.execute(text("SELECT COUNT(*) FROM appointments")).scalar()
        assert total_count == 1, "Should have 1 appointment record"
