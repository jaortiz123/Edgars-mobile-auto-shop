# RDS Access Configuration

## Current Issue
Your RDS instance is **NOT publicly accessible**, so it can only be reached from within the VPC (edgar-vpc). This is why DNS resolution fails from your Mac.

## Option 1: Enable Public Access (Quick Development Fix)

### Steps in AWS Console:
1. Go to RDS > Databases > edgar-auto-shop-db
2. Click "Modify"
3. Under "Connectivity" > "Additional configuration"
4. Change "Publicly accessible" from **No** to **Yes**
5. Click "Continue" > "Apply immediately" > "Modify DB instance"

### Security Group Update:
Your security group `edgar-db-sg` needs an inbound rule:
- Type: PostgreSQL
- Protocol: TCP
- Port: 5432
- Source: Your current public IP (find at whatismyipaddress.com) or 0.0.0.0/0 (less secure)

### After modification:
- Wait 5-10 minutes for the change to apply
- Run `./start-dev.sh` (it will use RDS since USE_REMOTE_DB=true)

## Option 2: VPN/Bastion Access (Production Secure)

### AWS Systems Manager Session Manager:
```bash
# Install session manager plugin first
# Then start port forwarding:
aws ssm start-session \
    --target i-your-ec2-instance \
    --document-name AWS-StartPortForwardingSession \
    --parameters '{"portNumber":["5432"],"localPortNumber":["15432"]}'

# Update .env.local to use localhost:15432
DATABASE_URL="postgresql://appuser@localhost:15432/edgarautoshop?sslmode=require"
```

### EC2 Bastion (if you have one):
```bash
# SSH tunnel through bastion
ssh -L 15432:edgar-auto-shop-db.cvs4mm02yy7o.us-west-2.rds.amazonaws.com:5432 \
    ec2-user@your-bastion-ip

# Update .env.local to use localhost:15432
```

## Recommendation
For development: Use **Option 1** (enable public access) - it's fastest to get you running.
For production: Keep public access disabled and use Option 2.

## Current DNS Issue Explained
The hostname `edgar-auto-shop-db.cvs4mm02yy7o.us-west-2.rds.amazonaws.com` only resolves to a private IP when the RDS is not publicly accessible. Your Mac can't reach private AWS IPs directly.
