# Secure Multi-Tenant SaaS Database Architecture

## Current State vs. Target Architecture

### Current (Development)
- Single RDS instance, single database
- Direct connections from application
- No connection pooling
- Single tenant data model

### Target (Production SaaS)
- Private RDS with connection pooling
- Database-level or schema-level tenant isolation
- Secure network architecture
- Horizontal scaling capability

## Recommended Architecture

### 1. Network Security (Private RDS + Bastion/VPN)

```
Internet → ALB → Private Subnets (App) → Private Subnets (RDS)
                     ↑
              Bastion Host (for admin access)
```

**Components:**
- **RDS**: Keep "Publicly accessible" = **No** (current setting is correct)
- **Application**: Deploy in private subnets with NAT Gateway for outbound
- **Bastion Host**: Small EC2 instance in public subnet for admin access
- **Connection Pooling**: PgBouncer between app and RDS

### 2. Multi-Tenant Data Architecture

**Option A: Database per Tenant (Recommended for SaaS)**
```
edgar-auto-shop-cluster/
├── tenant_abc123.edgarautoshop.com → Database: tenant_abc123
├── tenant_def456.edgarautoshop.com → Database: tenant_def456
└── shared services → Database: shared_services
```

**Option B: Schema per Tenant**
```
Single Database: edgarautoshop
├── Schema: tenant_abc123 (appointments, vehicles, etc.)
├── Schema: tenant_def456 (appointments, vehicles, etc.)
└── Schema: shared (users, tenants, billing)
```

**Option C: Row-Level Security (RLS)**
- Single schema with tenant_id column
- PostgreSQL RLS policies enforce data isolation
- More complex but most cost-effective

### 3. Infrastructure Setup

#### Current .env.local (Development with Bastion)
```bash
# Development with SSH tunnel through bastion
USE_REMOTE_DB=true
MIGRATIONS_USE_REMOTE_DB=true

# Connect through SSH tunnel (localhost:15432 → RDS:5432)
DATABASE_URL="postgresql://appuser@localhost:15432/edgarautoshop?sslmode=require"
MIGRATIONS_DATABASE_URL="postgresql://appuser@localhost:15432/edgarautoshop?sslmode=require"
PGPASSWORD="your-secure-password"

# SSH tunnel command (run separately):
# ssh -L 15432:edgar-auto-shop-db.cvs4mm02yy7o.us-west-2.rds.amazonaws.com:5432 ec2-user@bastion-ip
```

#### Production Environment Variables
```bash
# Production (app runs in private subnet, direct RDS access)
DATABASE_URL="postgresql://appuser@edgar-auto-shop-db.cvs4mm02yy7o.us-west-2.rds.amazonaws.com:5432/edgarautoshop?sslmode=require"
PGPASSWORD="from-secrets-manager"

# Connection pooling through PgBouncer
PGBOUNCER_URL="postgresql://appuser@pgbouncer.internal:6432/edgarautoshop?sslmode=require"
```

## Implementation Roadmap

### Phase 1: Secure Current Setup (This Week)
1. **Create Bastion Host**
2. **Set up SSH tunnel for development**
3. **Test current single-tenant app through secure connection**

### Phase 2: Multi-Tenant Foundation (Next Sprint)
1. **Add tenant_id to core tables**
2. **Implement tenant middleware**
3. **Create tenant onboarding flow**

### Phase 3: Production Infrastructure (Month 2)
1. **Deploy application in private subnets**
2. **Set up PgBouncer connection pooling**
3. **Implement database-per-tenant provisioning**

### Phase 4: Scale & Monitor (Month 3)
1. **Read replicas for reporting**
2. **Automated backup strategy**
3. **Monitoring and alerting**

## Security Best Practices

### Network
- RDS in private subnets only
- Security groups with minimal required access
- VPC Flow Logs enabled
- WAF on Application Load Balancer

### Database
- SSL/TLS enforced (rds.force_ssl = 1)
- Encryption at rest and in transit
- AWS Secrets Manager for credentials rotation
- Database activity monitoring (DAM)

### Application
- JWT tokens with tenant isolation
- API rate limiting per tenant
- Input validation and SQL injection prevention
- Audit logging per tenant

## Cost Considerations

### Current (Single RDS)
- ~$50-100/month for db.t3.micro
- No connection pooling overhead

### Multi-Tenant Production
- **Database per Tenant**: Higher cost, better isolation
- **Schema per Tenant**: Medium cost, good balance
- **RLS Single Schema**: Lowest cost, requires careful design

### Infrastructure Costs
- Bastion host: ~$10/month (t3.nano)
- PgBouncer: Can run on application servers
- Load balancer: ~$20/month + traffic
- NAT Gateway: ~$45/month + traffic

## Next Steps (Choose Your Path)

### Quick Start (This Afternoon)
1. Create bastion host in your VPC
2. Set up SSH tunnel
3. Test current app through secure connection

### Full SaaS Prep (This Week)
1. Design tenant data model
2. Add tenant_id columns
3. Implement tenant middleware
4. Create tenant signup flow

**Which path would you like to pursue first?**
