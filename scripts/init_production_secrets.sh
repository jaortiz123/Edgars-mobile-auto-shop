#!/bin/bash
# Production Secret Initialization Script
# Sets up AWS Secrets Manager secrets for Edgar's Mobile Auto Shop
# Run this ONCE before first production deployment

set -e

echo "🔐 Edgar's Mobile Auto Shop - Production Secret Initialization"
echo "============================================================="

# Configuration
AWS_REGION=${AWS_REGION:-"us-west-2"}
SECRET_PREFIX="prod/edgars"

# Function to generate secure secret
generate_secure_secret() {
    openssl rand -hex 32
}

# Function to check AWS setup
check_aws_setup() {
    echo "🔧 Checking AWS configuration..."

    if ! command -v aws &> /dev/null; then
        echo "❌ ERROR: AWS CLI not installed"
        echo "   Install with: pip install awscli"
        exit 1
    fi

    if ! aws sts get-caller-identity &> /dev/null; then
        echo "❌ ERROR: AWS credentials not configured"
        echo "   Configure with: aws configure"
        exit 1
    fi

    echo "✅ AWS CLI configured and accessible"
}

# Function to create secret
create_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local description="$3"

    echo "🔧 Creating secret: $secret_name"

    # Check if secret already exists
    if aws secretsmanager describe-secret --secret-id "$secret_name" --region "$AWS_REGION" &> /dev/null; then
        echo "⚠️  Secret $secret_name already exists"
        read -p "Do you want to update it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "   Skipping $secret_name"
            return 0
        fi

        # Update existing secret
        aws secretsmanager update-secret \
            --region "$AWS_REGION" \
            --secret-id "$secret_name" \
            --secret-string "$secret_value" > /dev/null
        echo "✅ Secret $secret_name updated"
    else
        # Create new secret
        aws secretsmanager create-secret \
            --region "$AWS_REGION" \
            --name "$secret_name" \
            --description "$description" \
            --secret-string "$secret_value" > /dev/null
        echo "✅ Secret $secret_name created"
    fi
}

# Function to create database secret (JSON format)
create_database_secret() {
    local secret_name="$1"
    local db_url="$2"
    local db_password="$3"

    local secret_value=$(cat <<EOF
{
  "url": "$db_url",
  "password": "$db_password",
  "engine": "postgres"
}
EOF
)

    create_secret "$secret_name" "$secret_value" "Database credentials for Edgar's Mobile Auto Shop production"
}

# Main execution
main() {
    echo "This script will create the following secrets in AWS Secrets Manager:"
    echo "  - $SECRET_PREFIX/jwt-secret"
    echo "  - $SECRET_PREFIX/flask-secret"
    echo "  - $SECRET_PREFIX/database (optional)"
    echo ""
    echo "Region: $AWS_REGION"
    echo ""

    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi

    check_aws_setup

    echo ""
    echo "🔐 Generating secure secrets..."

    # Generate secrets
    JWT_SECRET=$(generate_secure_secret)
    FLASK_SECRET=$(generate_secure_secret)

    echo "✅ Generated JWT_SECRET: [${#JWT_SECRET} characters]"
    echo "✅ Generated FLASK_SECRET_KEY: [${#FLASK_SECRET} characters]"

    echo ""
    echo "🏗️  Creating secrets in AWS Secrets Manager..."

    # Create application secrets
    create_secret "$SECRET_PREFIX/jwt-secret" "$JWT_SECRET" "JWT secret for Edgar's Mobile Auto Shop production"
    create_secret "$SECRET_PREFIX/flask-secret" "$FLASK_SECRET" "Flask secret key for Edgar's Mobile Auto Shop production"

    # Optional database secret
    echo ""
    read -p "Do you want to create a database secret? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Enter your production database details:"
        read -p "Database URL: " -r DB_URL
        read -s -p "Database Password: " DB_PASSWORD
        echo

        if [ -n "$DB_URL" ] && [ -n "$DB_PASSWORD" ]; then
            create_database_secret "$SECRET_PREFIX/database" "$DB_URL" "$DB_PASSWORD"
        else
            echo "⚠️  Skipping database secret (incomplete information)"
        fi
    fi

    echo ""
    echo "✅ Production secret initialization complete!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Update your production deployment to use these secrets"
    echo "2. Ensure your production IAM role has secretsmanager:GetSecretValue permission"
    echo "3. Test the production deployment script: ./backend/start_production.sh"
    echo ""
    echo "🔐 Secret ARNs (save these for reference):"
    aws secretsmanager describe-secret --secret-id "$SECRET_PREFIX/jwt-secret" --region "$AWS_REGION" --query 'ARN' --output text
    aws secretsmanager describe-secret --secret-id "$SECRET_PREFIX/flask-secret" --region "$AWS_REGION" --query 'ARN' --output text

    if aws secretsmanager describe-secret --secret-id "$SECRET_PREFIX/database" --region "$AWS_REGION" &> /dev/null; then
        aws secretsmanager describe-secret --secret-id "$SECRET_PREFIX/database" --region "$AWS_REGION" --query 'ARN' --output text
    fi
}

# Run main function
main "$@"
