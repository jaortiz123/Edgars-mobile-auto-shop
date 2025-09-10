#!/bin/bash

# Performance Test Environment Setup for Query Analysis
# This script creates a production-like PostgreSQL environment with slow query logging

set -e

echo "🔧 Setting up Performance Test Environment for Query Analysis"
echo "============================================================="

# Configuration
DB_NAME="edgar_performance_test"
DB_USER="perf_test_user"
DB_PASSWORD="perf_test_password"
PORT=5433
SLOW_QUERY_LOG="/tmp/postgresql-slow-queries.log"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL not found. Please install PostgreSQL first."
    exit 1
fi

# Create performance test database
echo "📊 Creating performance test database..."
createdb $DB_NAME 2>/dev/null || echo "Database $DB_NAME already exists"

# Create user
echo "👤 Creating performance test user..."
psql -d $DB_NAME -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || echo "User already exists"
psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# Configure PostgreSQL for performance monitoring
echo "⚙️ Configuring PostgreSQL for slow query logging..."

# Create temporary PostgreSQL config for slow query logging
cat > /tmp/postgresql_perf.conf << EOF
# Performance monitoring configuration
log_min_duration_statement = 100ms  # Log queries taking > 100ms
log_statement = 'all'               # Log all statements
log_duration = on                   # Log query duration
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
logging_collector = on
log_directory = '/tmp'
log_filename = 'postgresql-slow-queries.log'
log_rotation_age = 1d
log_rotation_size = 100MB

# Enable query performance stats
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.max = 10000
pg_stat_statements.track = all

# Connection and resource settings for testing
max_connections = 100
shared_buffers = 256MB
work_mem = 16MB
maintenance_work_mem = 64MB
EOF

echo "📋 Performance monitoring configuration created"
echo "   Slow query threshold: 100ms"
echo "   Log file: $SLOW_QUERY_LOG"

# Load schema and seed data
echo "🏗️ Loading database schema..."
if [ -f "../database/init.sql" ]; then
    psql -d $DB_NAME -f ../database/init.sql
elif [ -f "database/init.sql" ]; then
    psql -d $DB_NAME -f database/init.sql
else
    echo "⚠️  Database schema not found. Please ensure init.sql exists."
fi

# Load seed data for realistic testing
echo "🌱 Loading seed data for performance testing..."
if [ -f "backend/seeds/seed_s1.sql" ]; then
    psql -d $DB_NAME -f backend/seeds/seed_s1.sql
elif [ -f "../backend/seeds/seed_s1.sql" ]; then
    psql -d $DB_NAME -f ../backend/seeds/seed_s1.sql
fi

# Install pg_stat_statements extension
echo "📈 Installing pg_stat_statements extension..."
psql -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"

# Create performance test configuration file
cat > performance_test_config.env << EOF
# Performance Test Environment Configuration
export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=$DB_NAME
export POSTGRES_USER=$DB_USER
export POSTGRES_PASSWORD=$DB_PASSWORD

# Enable performance monitoring
export ENABLE_QUERY_LOGGING=true
export SLOW_QUERY_THRESHOLD=100
export LOG_LEVEL=INFO

# Test configuration
export JWT_SECRET=performance_test_secret
export APP_ENV=performance_test
export FLASK_DEBUG=0
EOF

echo "✅ Performance test environment setup complete!"
echo ""
echo "🔧 Next steps:"
echo "1. Source the environment: source performance_test_config.env"
echo "2. Start Flask server: cd backend && python local_server.py"
echo "3. Run performance tests to generate slow query logs"
echo "4. Analyze logs: tail -f $SLOW_QUERY_LOG"
echo ""
echo "📊 Database connection:"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Host: localhost:5432"
echo ""
echo "🔍 Query monitoring:"
echo "   Slow queries: $SLOW_QUERY_LOG"
echo "   Threshold: 100ms"
echo "   Stats: SELECT * FROM pg_stat_statements ORDER BY total_time DESC;"
