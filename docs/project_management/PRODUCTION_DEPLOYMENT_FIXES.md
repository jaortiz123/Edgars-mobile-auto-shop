# PRODUCTION SERVER DEPLOYMENT FIX

## CRITICAL FIXES REQUIRED

### 1. RLS Database User Fix
```bash
# Connect as superuser and create application user
psql postgresql://postgres:password@localhost:5432/autoshop << EOF
CREATE USER edgars_app WITH PASSWORD 'secure_production_password';
GRANT CONNECT ON DATABASE autoshop TO edgars_app;
GRANT USAGE ON SCHEMA public TO edgars_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO edgars_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO edgars_app;
EOF
```

### 2. Environment Configuration Fix
```bash
# Change DATABASE_URL to use non-superuser
export DATABASE_URL="postgresql://edgars_app:secure_production_password@localhost:5432/autoshop"

# Additional required environment variables
export JWT_SECRET="your-production-jwt-secret"
export FLASK_ENV="production"
export PORT="5001"
```

### 3. Flask App Factory Integration
Replace direct Flask instantiation with factory pattern:

```python
# OLD (causes conflicts):
app = Flask(__name__)

# NEW (factory pattern):
from backend.app_factory import create_app
app = create_app()
```

### 4. Import Security Functions
Use independent security module:

```python
# OLD (causes Flask conflicts):
from backend.local_server import hash_password, make_tokens

# NEW (independent):
from backend.security_core import hash_password, make_tokens
```

## DEPLOYMENT CHECKLIST

- [ ] Create edgars_app database user (non-superuser)
- [ ] Update DATABASE_URL to use edgars_app
- [ ] Run RLS migration with FORCE ROW LEVEL SECURITY
- [ ] Test minimal_test_server.py first
- [ ] Update main server to use app_factory pattern
- [ ] Verify security_core module imports work
- [ ] Test all authentication endpoints

## TESTING COMMANDS

```bash
# Test database connection
python backend/database_helper.py

# Test minimal server
python minimal_test_server.py

# Test security functions independently
python backend/security_core.py

# Run production validation after fixes
python task7c_production_validation_direct.py
```
