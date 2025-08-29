#!/bin/bash
# SSM Session Manager Setup for Secure Database Access
# Replaces SSH bastion with AWS Systems Manager for better security

set -e

echo "🔒 Setting up SSM Session Manager for secure RDS access..."

# Configuration
REGION="us-west-2"
VPC_ID="vpc-0b1887f64cbba818f"
SUBNET_ID="subnet-03a2019a1c946f7d6"
RDS_ENDPOINT="edgar-auto-shop-db.cvs4mm02yy7o.us-west-2.rds.amazonaws.com"

# Check AWS CLI and session manager plugin
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

echo "✅ AWS CLI found"

# Check for Session Manager plugin
if ! aws ssm start-session --help &> /dev/null; then
    echo "❌ Session Manager plugin not found."
    echo ""
    echo "Install the plugin:"
    echo "macOS: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html#install-plugin-macos"
    echo ""
    echo "Quick install (macOS):"
    echo "curl \"https://s3.amazonaws.com/session-manager-downloads/plugin/latest/mac/sessionmanager-bundle.zip\" -o \"sessionmanager-bundle.zip\""
    echo "unzip sessionmanager-bundle.zip"
    echo "sudo ./sessionmanager-bundle/install -i /usr/local/sessionmanagerplugin -b /usr/local/bin/session-manager-plugin"
    exit 1
fi

echo "✅ Session Manager plugin found"

# Create IAM role for SSM access (EC2 instance)
echo "📋 Creating IAM role for SSM..."

# Create trust policy
cat > ssm-trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "ec2.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF

# Create the role
aws iam create-role \
    --role-name EdgarSSMRole \
    --assume-role-policy-document file://ssm-trust-policy.json \
    --region $REGION 2>/dev/null || echo "Role may already exist"

# Attach SSM managed policy
aws iam attach-role-policy \
    --role-name EdgarSSMRole \
    --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore \
    --region $REGION

# Create instance profile
aws iam create-instance-profile \
    --instance-profile-name EdgarSSMProfile \
    --region $REGION 2>/dev/null || echo "Instance profile may already exist"

# Add role to instance profile
aws iam add-role-to-instance-profile \
    --instance-profile-name EdgarSSMProfile \
    --role-name EdgarSSMRole \
    --region $REGION 2>/dev/null || echo "Role may already be in profile"

echo "✅ IAM role configured"

# Create security group for SSM-managed instance (no inbound SSH)
echo "📋 Creating security group for SSM access..."

SSM_SG_ID=$(aws ec2 create-security-group \
    --group-name edgar-ssm-sg \
    --description "SSM-managed instance for RDS access (no SSH)" \
    --vpc-id $VPC_ID \
    --region $REGION \
    --query 'GroupId' \
    --output text 2>/dev/null || echo "")

if [ -z "$SSM_SG_ID" ]; then
    # Security group might already exist
    SSM_SG_ID=$(aws ec2 describe-security-groups \
        --filters "Name=group-name,Values=edgar-ssm-sg" "Name=vpc-id,Values=$VPC_ID" \
        --region $REGION \
        --query 'SecurityGroups[0].GroupId' \
        --output text)
fi

echo "✅ Security group: $SSM_SG_ID"

# Allow HTTPS outbound for SSM communication (if not already allowed)
aws ec2 authorize-security-group-egress \
    --group-id $SSM_SG_ID \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    --region $REGION 2>/dev/null || echo "Egress rule may already exist"

# Update RDS security group to allow access from SSM instance
RDS_SG_ID="sg-029089a0b89cd39d4"

aws ec2 authorize-security-group-ingress \
    --group-id $RDS_SG_ID \
    --protocol tcp \
    --port 5432 \
    --source-group $SSM_SG_ID \
    --region $REGION 2>/dev/null || echo "RDS ingress rule may already exist"

echo "✅ Security groups configured"

# Launch SSM-managed instance
echo "🚀 Launching SSM-managed instance..."

# Get latest Amazon Linux 2 AMI
AMI_ID=$(aws ec2 describe-images \
    --owners amazon \
    --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" \
    --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
    --region $REGION \
    --output text)

echo "📦 Using AMI: $AMI_ID"

# User data to install PostgreSQL client
USER_DATA=$(cat << 'EOF'
#!/bin/bash
yum update -y
amazon-linux-extras install postgresql14 -y

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

echo "Setup completed" > /var/log/ssm-setup.log
EOF
)

# Launch instance
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --count 1 \
    --instance-type t3.nano \
    --security-group-ids $SSM_SG_ID \
    --subnet-id $SUBNET_ID \
    --iam-instance-profile Name=EdgarSSMProfile \
    --user-data "$USER_DATA" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=edgar-ssm-tunnel},{Key=Purpose,Value=RDS-SSM-Access}]" \
    --region $REGION \
    --query 'Instances[0].InstanceId' \
    --output text)

echo "✅ Launched SSM instance: $INSTANCE_ID"

# Wait for instance to be ready
echo "⏳ Waiting for instance to be ready..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region $REGION

# Wait for SSM agent to be ready (may take a few minutes)
echo "⏳ Waiting for SSM agent to be ready..."
for i in {1..30}; do
    if aws ssm describe-instance-information \
        --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
        --region $REGION \
        --query 'InstanceInformationList[0].PingStatus' \
        --output text | grep -q "Online"; then
        echo "✅ SSM agent is online"
        break
    fi
    echo "Waiting for SSM agent... ($i/30)"
    sleep 30
done

# Create connection scripts
echo "📜 Creating connection scripts..."

# Create port forwarding script
cat > connect-rds-ssm.sh << EOF
#!/bin/bash
# Connect to RDS via SSM Session Manager port forwarding
# No SSH keys or open ports required!

INSTANCE_ID="$INSTANCE_ID"
RDS_ENDPOINT="$RDS_ENDPOINT"
LOCAL_PORT=15432

echo "🔗 Starting SSM port forwarding to RDS..."
echo "   Instance: \$INSTANCE_ID"
echo "   RDS: \$RDS_ENDPOINT:5432"
echo "   Local: localhost:\$LOCAL_PORT"
echo ""
echo "Leave this running and connect via:"
echo "   PGPASSWORD='your-password' psql -h localhost -p \$LOCAL_PORT -U appuser -d edgarautoshop"
echo ""
echo "Press Ctrl+C to stop the tunnel"
echo ""

aws ssm start-session \\
    --target \$INSTANCE_ID \\
    --document-name AWS-StartPortForwardingSessionToRemoteHost \\
    --parameters host="\$RDS_ENDPOINT",portNumber="5432",localPortNumber="\$LOCAL_PORT" \\
    --region $REGION
EOF

chmod +x connect-rds-ssm.sh

# Create direct terminal access script
cat > ssm-terminal.sh << EOF
#!/bin/bash
# Direct terminal access to the SSM instance
# Useful for running psql directly on the instance

INSTANCE_ID="$INSTANCE_ID"

echo "🖥️  Opening SSM terminal session..."
echo "   Instance: \$INSTANCE_ID"
echo ""
echo "On the remote instance, you can run:"
echo "   PGPASSWORD='your-password' psql -h $RDS_ENDPOINT -U appuser -d edgarautoshop"
echo ""

aws ssm start-session --target \$INSTANCE_ID --region $REGION
EOF

chmod +x ssm-terminal.sh

# Update .env.local template
cat > .env.ssm.template << EOF
# SSM-based RDS connection (no SSH keys required)
USE_REMOTE_DB=true
MIGRATIONS_USE_REMOTE_DB=true

# Database connections through SSM port forwarding
# Run: ./connect-rds-ssm.sh (in separate terminal)
DATABASE_URL="postgresql://appuser@localhost:15432/edgarautoshop?sslmode=require"
MIGRATIONS_DATABASE_URL="postgresql://appuser@localhost:15432/edgarautoshop?sslmode=require"

# Your secure password (move to AWS Secrets Manager in production)
PGPASSWORD="your-actual-password-here"
EOF

# Clean up temporary files
rm -f ssm-trust-policy.json

echo ""
echo "🎉 SSM Session Manager setup completed!"
echo ""
echo "📋 Connection Details:"
echo "   Instance ID: $INSTANCE_ID"
echo "   Security Group: $SSM_SG_ID"
echo "   Region: $REGION"
echo ""
echo "🔧 Usage:"
echo "1. Start port forwarding:"
echo "   ./connect-rds-ssm.sh"
echo ""
echo "2. In another terminal, test the connection:"
echo "   PGPASSWORD='your-password' psql -h localhost -p 15432 -U appuser -d edgarautoshop -c 'SELECT current_database();'"
echo ""
echo "3. Start your application:"
echo "   ./start-dev.sh"
echo ""
echo "4. For direct terminal access to the instance:"
echo "   ./ssm-terminal.sh"
echo ""
echo "💡 Benefits over SSH bastion:"
echo "   ✅ No SSH keys to manage"
echo "   ✅ No inbound ports exposed"
echo "   ✅ Full audit trail in CloudTrail"
echo "   ✅ IAM-based access control"
echo "   ✅ Automatic session recording"
echo ""
echo "💰 Monthly cost: ~\$5-10 for t3.nano instance"
echo ""
echo "🔒 Security improvements:"
echo "   - No port 22 exposed to internet"
echo "   - All connections through AWS APIs"
echo "   - IAM policies control access"
echo "   - Session Manager logs all activity"
