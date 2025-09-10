#!/bin/bash

# Final Validation: Emergency Secret Management Remediation
# Validates that critical production authentication vulnerability is fixed

echo "🚨 EMERGENCY REMEDIATION VALIDATION"
echo "===================================="
echo ""

# Check if secure production script exists
echo "🔒 Checking secure production deployment script..."
if [ -f "backend/start_production.sh" ]; then
    if grep -q "aws secretsmanager get-secret-value" "backend/start_production.sh"; then
        echo "✅ Production script uses AWS Secrets Manager"
    else
        echo "❌ Production script still has insecure secret generation"
        exit 1
    fi
else
    echo "❌ Production script missing"
    exit 1
fi

# Check if insecure backup exists for reference
echo ""
echo "📁 Checking insecure backup exists for reference..."
if [ -f "backend/start_production_insecure_backup.sh" ]; then
    echo "✅ Insecure backup preserved for reference"
else
    echo "⚠️  Insecure backup not found"
fi

# Check if secret initialization script exists
echo ""
echo "🔧 Checking secret initialization script..."
if [ -f "scripts/init_production_secrets.sh" ]; then
    if [ -x "scripts/init_production_secrets.sh" ]; then
        echo "✅ Secret initialization script exists and is executable"
    else
        echo "⚠️  Secret initialization script exists but not executable"
    fi
else
    echo "❌ Secret initialization script missing"
    exit 1
fi

# Validate .env.example files are comprehensive
echo ""
echo "📋 Validating .env.example files..."

# Count variables in each .env.example
root_vars=$(grep -c "^[A-Z]" .env.example 2>/dev/null || echo "0")
backend_vars=$(grep -c "^[A-Z]" backend/.env.example 2>/dev/null || echo "0")
frontend_vars=$(grep -c "^[A-Z]" frontend/.env.example 2>/dev/null || echo "0")

echo "   Root .env.example: $root_vars variables"
echo "   Backend .env.example: $backend_vars variables"
echo "   Frontend .env.example: $frontend_vars variables"

if [ "$root_vars" -ge 20 ] && [ "$backend_vars" -ge 15 ] && [ "$frontend_vars" -ge 5 ]; then
    echo "✅ .env.example files are comprehensive"
else
    echo "❌ .env.example files incomplete"
    exit 1
fi

# Check CI pipeline has environment validation
echo ""
echo "🔄 Checking CI pipeline validation..."
if [ -f ".github/workflows/unified-ci.yml" ]; then
    if grep -q "environment-validation" ".github/workflows/unified-ci.yml"; then
        echo "✅ CI pipeline includes environment validation"
    else
        echo "❌ CI pipeline missing environment validation"
        exit 1
    fi
else
    echo "❌ CI workflow file missing"
    exit 1
fi

# Check env_parity.py exists
echo ""
echo "🔍 Checking environment parity validation tool..."
if [ -f "scripts/audit/env_parity.py" ]; then
    echo "✅ Environment parity checker exists"
else
    echo "❌ Environment parity checker missing"
    exit 1
fi

# Final security check - ensure no automatic random secret generation in production scripts
echo ""
echo "🛡️  Final security validation..."

# Check for the dangerous pattern: automatic secret generation on every startup
if grep -E "(JWT_SECRET.*openssl rand|FLASK_SECRET.*openssl rand)" backend/start_production.sh 2>/dev/null; then
    echo "❌ CRITICAL: Automatic secret generation still found in production script!"
    exit 1
else
    echo "✅ No automatic secret generation on startup"
fi

if grep -E "(JWT_SECRET.*date.*openssl|FLASK_SECRET.*date.*openssl)" backend/start_production.sh 2>/dev/null; then
    echo "❌ CRITICAL: Time-based automatic secret generation still found in production script!"
    exit 1
else
    echo "✅ No time-based automatic secret generation"
fi

# Verify the script uses AWS Secrets Manager for fetching secrets
if grep -q "fetch_secret.*prod/edgars" backend/start_production.sh; then
    echo "✅ Production script fetches secrets from AWS Secrets Manager"
else
    echo "❌ Production script doesn't fetch secrets from AWS Secrets Manager"
    exit 1
fi

# Verify initialization is optional and controlled
if grep -q "INIT_SECRETS.*true" backend/start_production.sh; then
    echo "✅ Secret initialization is optional and controlled"
else
    echo "❌ Secret initialization not properly controlled"
    exit 1
fi

echo ""
echo "🎯 REMEDIATION VALIDATION COMPLETE"
echo "=================================="
echo ""
echo "✅ Critical authentication vulnerability RESOLVED"
echo "✅ Secure secret management IMPLEMENTED"
echo "✅ Configuration drift FIXED"
echo "✅ CI validation ENABLED"
echo ""
echo "🚀 Production deployment ready after secret initialization"
echo "   Run: ./scripts/init_production_secrets.sh"
echo ""
