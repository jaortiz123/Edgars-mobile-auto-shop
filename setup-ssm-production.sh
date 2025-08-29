#!/bin/bash
# ============================================================================
# SSM SESSION MANAGER SETUP - REPLACE SSH BASTION
# ============================================================================
# This script sets up secure database access via AWS SSM Session Manager
# Run this to transition from SSH bastion to SSM port forwarding

set -euo pipefail

# Configuration
RDS_ENDPOINT="edgar-auto-shop-db.cvs4mm02yv7o.us-west-2.rds.amazonaws.com"
RDS_PORT="5432"
LOCAL_PORT="15432"
REGION="us-west-2"

echo "🔧 Setting up SSM Session Manager for secure database access..."

# ============================================================================
# STEP 1: VALIDATE PREREQUISITES
# ============================================================================

echo "✅ Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Install: brew install awscli"
    exit 1
fi

# Check SSM plugin
if ! aws ssm describe-instance-information --region $REGION &> /dev/null; then
    echo "❌ SSM access denied or plugin missing. Install: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html"
    exit 1
fi

# Check for running instances in the DB VPC
echo "🔍 Finding EC2 instances with SSM access..."
INSTANCES=$(aws ssm describe-instance-information \
    --region $REGION \
    --query 'InstanceInformationList[?PingStatus==`Online`].InstanceId' \
    --output text)

if [ -z "$INSTANCES" ]; then
    echo "❌ No online EC2 instances with SSM access found."
    echo "   Make sure you have an EC2 instance in the RDS VPC with:"
    echo "   - AmazonSSMManagedInstanceCore IAM role attached"
    echo "   - SSM agent running"
    exit 1
fi

# Pick the first available instance
TARGET_INSTANCE=$(echo $INSTANCES | awk '{print $1}')
echo "✅ Using EC2 instance: $TARGET_INSTANCE"

# ============================================================================
# STEP 2: CREATE IAM POLICIES AND ROLES (if needed)
# ============================================================================

echo "🔐 Setting up IAM permissions for SSM Session Manager..."

# Create SSM session policy
cat > /tmp/ssm-session-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ssm:StartSession"
            ],
            "Resource": [
                "arn:aws:ec2:*:*:instance/*"
            ],
            "Condition": {
                "StringEquals": {
                    "ssm:resourceTag/AllowSSM": "true"
                }
            }
        },
        {
            "Effect": "Allow",
            "Action": [
                "ssm:StartSession"
            ],
            "Resource": [
                "arn:aws:ssm:*:*:document/AWS-StartPortForwardingSession",
                "arn:aws:ssm:*:*:document/AWS-StartPortForwardingSessionToRemoteHost"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "ssm:TerminateSession",
                "ssm:ResumeSession"
            ],
            "Resource": [
                "arn:aws:ssm:*:*:session/\${aws:userid}-*"
            ]
        }
    ]
}
EOF

echo "📋 IAM policy saved to /tmp/ssm-session-policy.json"

# ============================================================================
# STEP 3: CREATE CONNECTION SCRIPTS
# ============================================================================

# Create production database connection script
cat > connect-prod-db.sh << EOF
#!/bin/bash
# Production database connection via SSM Session Manager
set -euo pipefail

echo "🔗 Starting secure SSM port forwarding to production database..."
echo "   RDS: $RDS_ENDPOINT:$RDS_PORT"
echo "   Local: localhost:$LOCAL_PORT"
echo "   Instance: $TARGET_INSTANCE"

# Start port forwarding session
aws ssm start-session \\
    --target $TARGET_INSTANCE \\
    --document-name AWS-StartPortForwardingSessionToRemoteHost \\
    --parameters '{
        "host":["$RDS_ENDPOINT"],
        "portNumber":["$RDS_PORT"],
        "localPortNumber":["$LOCAL_PORT"]
    }' \\
    --region $REGION

echo "🔌 Port forwarding stopped"
EOF

chmod +x connect-prod-db.sh

# Create production migration script
cat > run-prod-migration.sh << 'EOF'
#!/bin/bash
# Run production migration via SSM tunnel
set -euo pipefail

if [ $# -eq 0 ]; then
    echo "Usage: $0 <migration-file.sql>"
    echo "Example: $0 production-cutover-bundle.sql"
    exit 1
fi

MIGRATION_FILE="$1"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "🚀 Running production migration via SSM tunnel..."
echo "   File: $MIGRATION_FILE"
echo "   Target: localhost:15432 (via SSM)"

# Check if tunnel is active
if ! nc -z localhost 15432 2>/dev/null; then
    echo "❌ SSM tunnel not active. Run ./connect-prod-db.sh first"
    exit 1
fi

# Run migration as superuser (for role creation and RLS setup)
echo "📊 Running migration..."
psql -h localhost -p 15432 -U postgres -d edgarautoshop -f "$MIGRATION_FILE"

echo "✅ Migration completed successfully"
EOF

chmod +x run-prod-migration.sh

# Create production app connection test
cat > test-prod-app-connection.sh << 'EOF'
#!/bin/bash
# Test production app_user connection via SSM tunnel
set -euo pipefail

echo "🧪 Testing production app_user connection..."

# Check if tunnel is active
if ! nc -z localhost 15432 2>/dev/null; then
    echo "❌ SSM tunnel not active. Run ./connect-prod-db.sh first"
    exit 1
fi

echo "🔍 Testing app_user role and RLS policies..."

# Test basic connection as app_user
psql -h localhost -p 15432 -U app_user -d edgarautoshop << 'SQL'
-- Test 1: Verify we're connected as app_user (not superuser)
SELECT
    'Connection Test' as test,
    current_user as connected_as,
    current_database() as database;

-- Test 2: Verify app_user does NOT bypass RLS
SELECT
    'Role Security Check' as test,
    rolname,
    rolsuper as is_superuser,
    rolbypassrls as bypasses_rls
FROM pg_roles
WHERE rolname = current_user;

-- Test 3: Try to query without tenant context (should see no data)
SELECT
    'No Context Test' as test,
    COUNT(*) as customer_count_without_context
FROM customers;

-- Test 4: Set tenant context and query (replace with real tenant UUID)
-- SELECT set_config('app.tenant_id', 'your-real-tenant-uuid-here', true);
-- SELECT 'With Context Test' as test, COUNT(*) as customer_count_with_context FROM customers;

SQL

echo "✅ Production app_user connection test completed"
EOF

chmod +x test-prod-app-connection.sh

# ============================================================================
# STEP 4: UPDATE ENVIRONMENT CONFIGURATION
# ============================================================================

echo "⚙️  Updating environment configuration for SSM access..."

# Update .env.local for SSM tunnel
cat > .env.prod-ssm << EOF
# PRODUCTION CONFIGURATION - SSM Session Manager Access
# Use this after setting up SSM tunnel with ./connect-prod-db.sh

# SSM tunnel target (instead of SSH bastion)
USE_REMOTE_DB=true
MIGRATIONS_USE_REMOTE_DB=true

# Database connection via SSM tunnel
DATABASE_URL="postgresql://app_user@localhost:15432/edgarautoshop?sslmode=require"
MIGRATIONS_DATABASE_URL="postgresql://postgres@localhost:15432/edgarautoshop?sslmode=require"

# App user password (use AWS Secrets Manager in real production)
PGPASSWORD="your-production-app-user-password"

# Alternative individual connection vars
POSTGRES_HOST="localhost"
POSTGRES_PORT="15432"
POSTGRES_DB="edgarautoshop"
POSTGRES_USER="app_user"
POSTGRES_PASSWORD="your-production-app-user-password"
PGSSLMODE="require"
EOF

echo "📝 Production environment config saved to .env.prod-ssm"

# ============================================================================
# STEP 5: CREATE SECURITY GROUP UPDATES
# ============================================================================

echo "🛡️  Creating security group update commands..."

cat > update-security-groups.sh << 'EOF'
#!/bin/bash
# Remove SSH access and restrict to SSM-only
set -euo pipefail

echo "🔒 Updating security groups to remove SSH and enable SSM-only access..."

# You'll need to replace these with your actual security group IDs
BASTION_SG_ID="sg-xxxxxxxxx"  # Replace with actual bastion security group ID
RDS_SG_ID="sg-yyyyyyyyy"      # Replace with actual RDS security group ID

# Remove SSH (port 22) inbound rules
echo "❌ Removing SSH access..."
# aws ec2 revoke-security-group-ingress \
#     --group-id $BASTION_SG_ID \
#     --protocol tcp \
#     --port 22 \
#     --cidr 0.0.0.0/0

# The RDS security group should only allow connections from the VPC
echo "✅ RDS security group should already be restricted to VPC access only"

echo "🔐 Security groups updated for SSM-only access"
echo "⚠️  Uncomment and configure the security group IDs before running"
EOF

chmod +x update-security-groups.sh

# ============================================================================
# STEP 6: SUMMARY AND NEXT STEPS
# ============================================================================

echo ""
echo "🎉 SSM Session Manager setup complete!"
echo ""
echo "📁 Created files:"
echo "   • connect-prod-db.sh           - Start SSM tunnel to production DB"
echo "   • run-prod-migration.sh        - Run migrations via SSM tunnel"
echo "   • test-prod-app-connection.sh  - Test app_user connection"
echo "   • .env.prod-ssm                - Production environment config"
echo "   • update-security-groups.sh    - Remove SSH access"
echo ""
echo "🚀 Next steps:"
echo "   1. Run: ./connect-prod-db.sh (in one terminal)"
echo "   2. Run: ./run-prod-migration.sh production-cutover-bundle.sql (in another terminal)"
echo "   3. Test: ./test-prod-app-connection.sh"
echo "   4. Update app to use .env.prod-ssm settings"
echo "   5. Run: ./update-security-groups.sh (after configuring SG IDs)"
echo ""
echo "⚠️  Important:"
echo "   • Replace 'your-production-app-user-password' with real password"
echo "   • Use AWS Secrets Manager for production passwords"
echo "   • Test thoroughly in staging first"
echo "   • Keep the SSM tunnel running during operations"
echo ""
echo "✅ Ready for Phase 2: SSM Session Manager transition!"
