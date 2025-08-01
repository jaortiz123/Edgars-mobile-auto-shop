#!/usr/bin/env python3
"""
Test script to verify the PostgreSQL container integration works correctly.
This script can be run independently to test the containerized database setup.
"""

import os
import sys
import subprocess
import time
import logging
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from testcontainers.postgres import PostgresContainer
except ImportError as e:
    logger.error(f"Missing required dependency: {e}")
    logger.info("Run: pip install testcontainers psycopg2-binary")
    sys.exit(1)


def test_container_setup():
    """Test the PostgreSQL container setup end-to-end."""
    logger.info("🧪 Testing PostgreSQL container setup...")
    
    try:
        with PostgresContainer("postgres:15-alpine") as postgres:
            logger.info(f"✅ Container started on port {postgres.get_exposed_port(5432)}")
            
            # Get connection details
            db_url = postgres.get_connection_url()
            logger.info(f"📍 Database URL: {db_url}")
            
            # Parse connection details for environment variables
            postgres_url_parts = postgres.get_connection_url().replace("postgresql://", "").split("@")
            user_pass = postgres_url_parts[0].split(":")
            host_port_db = postgres_url_parts[1].split("/")
            host_port = host_port_db[0].split(":")
            
            env_vars = {
                "DATABASE_URL": db_url,
                "POSTGRES_HOST": host_port[0],
                "POSTGRES_PORT": host_port[1],
                "POSTGRES_DB": host_port_db[1],
                "POSTGRES_USER": user_pass[0],
                "POSTGRES_PASSWORD": user_pass[1],
            }
            
            logger.info("🔧 Setting environment variables...")
            for key, value in env_vars.items():
                os.environ[key] = value
            
            # Test basic connection
            logger.info("🔗 Testing database connection...")
            conn = psycopg2.connect(db_url)
            with conn.cursor() as cur:
                cur.execute("SELECT version()")
                version = cur.fetchone()[0]
                logger.info(f"✅ Connected to: {version}")
            conn.close()
            
            # Run migrations
            logger.info("🔄 Running Alembic migrations...")
            try:
                result = subprocess.run(
                    ["alembic", "upgrade", "head"],
                    cwd=backend_dir,
                    env={**os.environ, **env_vars},
                    capture_output=True,
                    text=True,
                    timeout=60
                )
                
                if result.returncode == 0:
                    logger.info("✅ Migrations completed successfully")
                else:
                    logger.error(f"❌ Migration failed: {result.stderr}")
                    return False
                    
            except subprocess.TimeoutExpired:
                logger.error("❌ Migration timed out")
                return False
            except FileNotFoundError:
                logger.error("❌ Alembic not found. Make sure it's installed.")
                return False
            
            # Load seed data
            logger.info("🌱 Loading seed data...")
            seed_file = Path(__file__).parent / "seed.sql"
            
            if not seed_file.exists():
                logger.error(f"❌ Seed file not found: {seed_file}")
                return False
            
            try:
                with open(seed_file, 'r') as f:
                    seed_sql = f.read()
                
                conn = psycopg2.connect(db_url)
                with conn:
                    with conn.cursor() as cur:
                        cur.execute(seed_sql)
                conn.close()
                
                logger.info("✅ Seed data loaded successfully")
                
            except Exception as e:
                logger.error(f"❌ Failed to load seed data: {e}")
                return False
            
            # Verify data
            logger.info("🔍 Verifying test data...")
            conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
            with conn:
                with conn.cursor() as cur:
                    # Check customers
                    cur.execute("SELECT COUNT(*) as count FROM customers")
                    customer_count = cur.fetchone()['count']
                    
                    # Check appointments with different statuses
                    cur.execute("SELECT status, COUNT(*) as count FROM appointments GROUP BY status ORDER BY status")
                    status_counts = cur.fetchall()
                    
                    # Check foreign key relationships
                    cur.execute("""
                        SELECT a.id, c.name as customer_name, v.make, v.model 
                        FROM appointments a 
                        JOIN customers c ON a.customer_id = c.id 
                        JOIN vehicles v ON a.vehicle_id = v.id 
                        LIMIT 3
                    """)
                    sample_appointments = cur.fetchall()
                    
            conn.close()
            
            logger.info(f"📊 Found {customer_count} customers")
            logger.info("📊 Appointment status distribution:")
            for status_row in status_counts:
                logger.info(f"   {status_row['status']}: {status_row['count']}")
            
            logger.info("📋 Sample appointments with joins:")
            for apt in sample_appointments:
                logger.info(f"   ID {apt['id']}: {apt['customer_name']} - {apt['make']} {apt['model']}")
            
            logger.info("🎉 All tests passed! Container setup is working correctly.")
            return True
            
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_container_setup()
    sys.exit(0 if success else 1)
