#!/bin/bash
# Create Bastion Host for Secure RDS Access
# Run this script to set up a bastion host in your VPC for secure database access

set -e

# Configuration
VPC_ID="vpc-0b1887f64cbba818f"  # Your edgar-vpc
SUBNET_ID="subnet-03a2019a1c946f7d6"  # One of your subnets (should be public)
KEY_NAME="your-ec2-key-pair"  # Replace with your EC2 key pair name
BASTION_SG_NAME="edgar-bastion-sg"
REGION="us-west-2"

echo "🚀 Setting up secure bastion host for RDS access..."

# 1. Create security group for bastion host
echo "📋 Creating bastion security group..."
BASTION_SG_ID=$(aws ec2 create-security-group \
    --group-name "$BASTION_SG_NAME" \
    --description "Bastion host security group for RDS access" \
    --vpc-id "$VPC_ID" \
    --region "$REGION" \
    --query 'GroupId' \
    --output text)

echo "✅ Created security group: $BASTION_SG_ID"

# 2. Allow SSH access from your IP
YOUR_IP=$(curl -s https://checkip.amazonaws.com)/32
echo "🌐 Your public IP: $YOUR_IP"

aws ec2 authorize-security-group-ingress \
    --group-id "$BASTION_SG_ID" \
    --protocol tcp \
    --port 22 \
    --cidr "$YOUR_IP" \
    --region "$REGION"

echo "✅ Allowed SSH access from your IP"

# 3. Update RDS security group to allow bastion access
RDS_SG_ID="sg-029089a0b89cd39d4"  # Your edgar-db-sg

aws ec2 authorize-security-group-ingress \
    --group-id "$RDS_SG_ID" \
    --protocol tcp \
    --port 5432 \
    --source-group "$BASTION_SG_ID" \
    --region "$REGION"

echo "✅ Allowed bastion to access RDS"

# 4. Launch bastion host (t3.nano - cheapest option)
echo "🚀 Launching bastion host..."

# Get latest Amazon Linux 2 AMI
AMI_ID=$(aws ec2 describe-images \
    --owners amazon \
    --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" \
    --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
    --region "$REGION" \
    --output text)

echo "📦 Using AMI: $AMI_ID"

# User data script to install PostgreSQL client
USER_DATA=$(cat << 'EOF'
#!/bin/bash
yum update -y
amazon-linux-extras install postgresql14 -y
echo "PostgreSQL client installed" > /var/log/bastion-setup.log
EOF
)

INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI_ID" \
    --count 1 \
    --instance-type t3.nano \
    --key-name "$KEY_NAME" \
    --security-group-ids "$BASTION_SG_ID" \
    --subnet-id "$SUBNET_ID" \
    --associate-public-ip-address \
    --user-data "$USER_DATA" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=edgar-bastion},{Key=Purpose,Value=RDS-Access}]" \
    --region "$REGION" \
    --query 'Instances[0].InstanceId' \
    --output text)

echo "✅ Launched bastion host: $INSTANCE_ID"

# 5. Wait for instance to be running
echo "⏳ Waiting for bastion host to be ready..."
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"

# 6. Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --region "$REGION" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo "🎉 Bastion host ready!"
echo ""
echo "📋 Connection Details:"
echo "   Instance ID: $INSTANCE_ID"
echo "   Public IP: $PUBLIC_IP"
echo "   Security Group: $BASTION_SG_ID"
echo ""
echo "🔧 Next Steps:"
echo "1. Test SSH connection:"
echo "   ssh -i ~/.ssh/$KEY_NAME.pem ec2-user@$PUBLIC_IP"
echo ""
echo "2. Set up SSH tunnel for RDS access:"
echo "   ssh -i ~/.ssh/$KEY_NAME.pem -L 15432:edgar-auto-shop-db.cvs4mm02yy7o.us-west-2.rds.amazonaws.com:5432 ec2-user@$PUBLIC_IP"
echo ""
echo "3. Update your .env.local to use the tunnel:"
echo '   DATABASE_URL="postgresql://appuser@localhost:15432/edgarautoshop?sslmode=require"'
echo ""
echo "4. Test the connection:"
echo "   PGPASSWORD='your-password' psql -h localhost -p 15432 -U appuser -d edgarautoshop -c 'SELECT current_database();'"
echo ""
echo "💡 Monthly cost: ~$5-10 for t3.nano"

# 7. Save connection info for easy access
cat > bastion-connection.sh << EOF
#!/bin/bash
# Quick connection script for Edgar's Auto Shop bastion host
# Generated on $(date)

BASTION_IP="$PUBLIC_IP"
KEY_PATH="~/.ssh/$KEY_NAME.pem"
RDS_ENDPOINT="edgar-auto-shop-db.cvs4mm02yy7o.us-west-2.rds.amazonaws.com"

echo "🔗 Starting SSH tunnel to RDS through bastion host..."
echo "   Bastion: \$BASTION_IP"
echo "   RDS: \$RDS_ENDPOINT:5432"
echo "   Local: localhost:15432"
echo ""
echo "Press Ctrl+C to close the tunnel"
echo ""

ssh -i \$KEY_PATH -L 15432:\$RDS_ENDPOINT:5432 ec2-user@\$BASTION_IP
EOF

chmod +x bastion-connection.sh
echo "✅ Created bastion-connection.sh for easy reconnection"
