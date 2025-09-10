#!/bin/bash
# Production Deployment Script for Edgar's Mobile Auto Shop (SECURE VERSION)
# Implements critical performance fixes: Gunicorn + Connection Pooling + AWS Secrets Manager
#
# EMERGENCY FIX: Removed catastrophic random secret generation
# Now uses AWS Secrets Manager for persistent, secure secret management

set -e  # Exit on any error

echo "🚀 Edgar's Mobile Auto Shop - Production Deployment (SECURE)"
echo "Implementing critical performance fixes with secure secret management..."

# Configuration
WORKERS=${WORKERS:-4}
PORT=${PORT:-5000}
BIND=${BIND:-"0.0.0.0:$PORT"}
TIMEOUT=${TIMEOUT:-30}
MAX_REQUESTS=${MAX_REQUESTS:-1000}

# Database pool configuration
DB_POOL_MIN=${DB_POOL_MIN:-5}
DB_POOL_MAX=${DB_POOL_MAX:-20}

# AWS Region for Secrets Manager
AWS_REGION=${AWS_REGION:-"us-west-2"}

# Set production environment
export APP_ENV=production
export FLASK_ENV=production
export FLASK_DEBUG=0

echo "🔐 Fetching production secrets from AWS Secrets Manager..."

# Function to fetch secret from AWS Secrets Manager
fetch_secret() {
    local secret_name="$1"
    local secret_key="$2"

    echo "  Fetching $secret_key from $secret_name..."

    # Fetch the secret value
    local secret_value
    secret_value=$(aws secretsmanager get-secret-value \
        --region "$AWS_REGION" \
        --secret-id "$secret_name" \
        --query SecretString \
        --output text 2>/dev/null)

    if [ $? -ne 0 ] || [ -z "$secret_value" ]; then
        echo "❌ ERROR: Failed to fetch secret $secret_name"
        echo "   Make sure the secret exists and you have proper AWS credentials"
        echo "   Required IAM permission: secretsmanager:GetSecretValue"
        exit 1
    fi

    # If it's a JSON secret, extract the specific key
    if [ -n "$secret_key" ]; then
        echo "$secret_value" | jq -r ".$secret_key" 2>/dev/null || echo "$secret_value"
    else
        echo "$secret_value"
    fi
}

# Function to check if AWS CLI is available and configured
check_aws_setup() {
    echo "🔧 Checking AWS configuration..."

    if ! command -v aws &> /dev/null; then
        echo "❌ ERROR: AWS CLI not installed"
        echo "   Install with: pip install awscli"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        echo "❌ ERROR: jq not installed (required for JSON parsing)"
        echo "   Install with: apt-get install jq (Ubuntu) or brew install jq (macOS)"
        exit 1
    fi

    # Test AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo "❌ ERROR: AWS credentials not configured"
        echo "   Configure with: aws configure"
        echo "   Or set environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
        exit 1
    fi

    echo "✅ AWS CLI configured and accessible"
}

# Function to create secrets if they don't exist (for initial setup)
create_secret_if_missing() {
    local secret_name="$1"
    local secret_value="$2"
    local description="$3"

    # Check if secret exists
    if aws secretsmanager describe-secret --secret-id "$secret_name" --region "$AWS_REGION" &> /dev/null; then
        echo "✅ Secret $secret_name already exists"
        return 0
    fi

    echo "🔧 Creating new secret: $secret_name"
    aws secretsmanager create-secret \
        --region "$AWS_REGION" \
        --name "$secret_name" \
        --description "$description" \
        --secret-string "$secret_value" > /dev/null

    if [ $? -eq 0 ]; then
        echo "✅ Secret $secret_name created successfully"
    else
        echo "❌ ERROR: Failed to create secret $secret_name"
        exit 1
    fi
}

# Function to generate secure secret value
generate_secure_secret() {
    openssl rand -hex 32
}

# Check AWS setup before proceeding
check_aws_setup

# Initialize secrets if this is the first deployment
if [ "${INIT_SECRETS:-false}" = "true" ]; then
    echo "🔧 Initializing production secrets (first-time setup)..."

    JWT_SECRET_VALUE=$(generate_secure_secret)
    FLASK_SECRET_VALUE=$(generate_secure_secret)

    create_secret_if_missing "prod/edgars/jwt-secret" "$JWT_SECRET_VALUE" "JWT secret for Edgar's Mobile Auto Shop production"
    create_secret_if_missing "prod/edgars/flask-secret" "$FLASK_SECRET_VALUE" "Flask secret key for Edgar's Mobile Auto Shop production"

    echo "✅ Production secrets initialized"
    echo "⚠️  IMPORTANT: Store these secret ARNs in your infrastructure documentation"
fi

# Fetch production secrets from AWS Secrets Manager
echo "🔐 Fetching production secrets..."

# SECURE: Fetch persistent secrets from AWS Secrets Manager
export JWT_SECRET=$(fetch_secret "prod/edgars/jwt-secret")
export FLASK_SECRET_KEY=$(fetch_secret "prod/edgars/flask-secret")

# Validate secrets were fetched successfully
if [ -z "$JWT_SECRET" ] || [ -z "$FLASK_SECRET_KEY" ]; then
    echo "❌ ERROR: Failed to fetch required secrets from AWS Secrets Manager"
    echo "   Check that the following secrets exist:"
    echo "   - prod/edgars/jwt-secret"
    echo "   - prod/edgars/flask-secret"
    echo ""
    echo "   To initialize secrets for the first time, run:"
    echo "   INIT_SECRETS=true ./start_production.sh"
    exit 1
fi

# Validate secret lengths (security check)
if [ ${#JWT_SECRET} -lt 32 ]; then
    echo "⚠️  WARNING: JWT_SECRET is shorter than 32 characters (actual: ${#JWT_SECRET})"
    echo "   Consider regenerating with a longer secret"
fi

if [ ${#FLASK_SECRET_KEY} -lt 32 ]; then
    echo "⚠️  WARNING: FLASK_SECRET_KEY is shorter than 32 characters (actual: ${#FLASK_SECRET_KEY})"
    echo "   Consider regenerating with a longer secret"
fi

echo "✅ Production secrets loaded successfully"
echo "   JWT_SECRET: [${#JWT_SECRET} characters] ✓"
echo "   FLASK_SECRET_KEY: [${#FLASK_SECRET_KEY} characters] ✓"

# Optional: Fetch database credentials from Secrets Manager if configured
if [ "${USE_SECRETS_FOR_DB:-false}" = "true" ]; then
    echo "🔐 Fetching database credentials from Secrets Manager..."

    DB_SECRET=$(fetch_secret "prod/edgars/database")
    export DATABASE_URL=$(echo "$DB_SECRET" | jq -r '.url')
    export POSTGRES_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password')

    echo "✅ Database credentials loaded from Secrets Manager"
fi

echo "📊 Configuration:"
echo "  Workers: $WORKERS"
echo "  Bind: $BIND"
echo "  Timeout: $TIMEOUT"
echo "  Max Requests: $MAX_REQUESTS"
echo "  DB Pool: $DB_POOL_MIN-$DB_POOL_MAX connections"
echo "  Secrets: AWS Secrets Manager (Region: $AWS_REGION)"

# Stop any existing Gunicorn processes
echo "🛑 Stopping existing processes..."
pkill -f gunicorn || true

# Wait for processes to stop
sleep 2

# Create PID directory
mkdir -p /tmp/edgar_auto_shop

# Start Gunicorn with optimized configuration
echo "🔄 Starting Gunicorn production server with secure secrets..."

cd "$(dirname "$0")"  # Ensure we're in the backend directory
cd ..  # Go to project root

exec gunicorn \
    --bind "$BIND" \
    --workers "$WORKERS" \
    --worker-class sync \
    --timeout "$TIMEOUT" \
    --max-requests "$MAX_REQUESTS" \
    --max-requests-jitter 50 \
    --pid /tmp/edgar_auto_shop/gunicorn.pid \
    --access-logfile - \
    --error-logfile - \
    --log-level info \
    backend.wsgi:application
