# 🗺️ Edgar's Mobile Auto Shop - Refactoring Blueprint

## 📊 **Current State Summary**
- **File**: `backend/local_server.py`
- **Size**: 12,816 lines
- **Routes**: 97 Flask endpoints
- **Functions**: 173 functions
- **SQL Operations**: 595 database operations
- **Major Issue**: 63 admin routes in one massive domain

---

## 🎯 **Phase-by-Phase Refactoring Plan**

### **🚀 Phase 1: Foundation Extraction (Week 1)**

#### **Step 1A: Authentication Layer**
Extract these critical cross-cutting functions:
```python
# NEW: backend/utils/auth.py
- require_auth_role()
- maybe_auth()
- require_or_maybe()
- vehicle_ownership_required()
- _inject_legacy_test_auth()
- Admin permission decorators
```

#### **Step 1B: Database Layer**
Extract database utilities:
```python
# NEW: backend/utils/database.py
- Database connection management
- Cursor handling (psycopg2 patterns)
- _get_customer_row()
- _get_vehicle_row()
- Transaction helpers
- Query execution patterns
```

#### **Step 1C: Validation Layer**
Extract validation functions:
```python
# NEW: backend/utils/validators.py
- _validate_customer_patch()
- _validate_customer_patch_pr1()
- _validate_vehicle_patch()
- Input sanitization
- Data format validation
```

**🎯 Goal**: Create foundational modules that ALL routes depend on

---

### **🔥 Phase 2: Domain Extraction (Week 2-3)**

#### **Step 2A: Invoice Domain** (HIGHEST PRIORITY)
Extract the billing/payment system (10 routes):
```python
# NEW: backend/services/invoice_service.py
Routes:
- /api/admin/invoices (GET)
- /api/admin/invoices/<invoice_id>/estimate.pdf (GET)
- /api/admin/invoices/<invoice_id>/receipt.pdf (GET)
- /api/admin/invoices/<invoice_id>/estimate.html (GET)
- /api/admin/invoices/<invoice_id>/receipt.html (GET)
- /api/admin/invoices/<invoice_id>/send (POST)

Functions:
- get_invoice()
- create_invoice_payment()
- invoice_send_stub()
- PDF generation logic
- Invoice validation
```

#### **Step 2B: Appointment Domain** (SECOND PRIORITY)
Extract scheduling system (8 admin + 17 public = 25 routes):
```python
# NEW: backend/services/appointment_service.py
Admin Routes:
- /api/admin/appointments/* (8 routes)

Public Routes:
- /api/appointments/<appt_id> (CRUD)
- /api/appointments/<appt_id>/check-in
- /api/appointments/<appt_id>/check-out
- /api/appointments/calendar views
- /api/appointments/board views

Functions:
- get_board()
- admin_appointment_handler()
- get_admin_appointments()
- Appointment CRUD operations
- Calendar/scheduling logic
```

#### **Step 2C: Customer Domain**
Extract customer management (7 admin + 6 public = 13 routes):
```python
# NEW: backend/services/customer_service.py
Admin Routes:
- /api/admin/customers/* (7 routes)

Public Routes:
- /api/customers/login
- /api/customers/register
- /api/customers/lookup
- /api/customers/<customer_id>/history

Functions:
- Customer CRUD operations
- Authentication logic
- History/profile management
```

---

### **🛠️ Phase 3: Smaller Domains (Week 4)**

#### **Step 3A: Vehicle Domain**
```python
# NEW: backend/services/vehicle_service.py
Routes: /api/admin/vehicles/* (6 routes)
- Vehicle CRUD, transfer operations
```

#### **Step 3B: Communication Domain**
```python
# NEW: backend/services/messaging_service.py
Routes: /api/admin/message-templates/* (5 routes)
Functions:
- create_message_template()
- get_message_template()
- update_message_template()
- delete_message_template()
```

#### **Step 3C: Service Operations Domain**
```python
# NEW: backend/services/service_operations.py
Routes: /api/admin/service-operations/* (4 routes)
- Work order management
- Service package handling
```

---

### **📋 Phase 4: Route Organization (Week 5)**

Create clean route files that import services:

#### **Main Route Files**
```python
# backend/routes/admin_routes.py
from services import invoice_service, appointment_service, customer_service
# Register all /api/admin/* routes with proper imports

# backend/routes/appointments_routes.py
from services import appointment_service
# Register all /api/appointments/* routes

# backend/routes/customers_routes.py
from services import customer_service
# Register all /api/customers/* routes

# backend/routes/auth_routes.py
from utils import auth
# Register all /api/auth/* routes
```

#### **App Factory Pattern**
```python
# backend/app.py
def create_app():
    app = Flask(__name__)

    from routes import admin_routes, appointments_routes, customers_routes, auth_routes

    app.register_blueprint(admin_routes.bp, url_prefix='/api/admin')
    app.register_blueprint(appointments_routes.bp, url_prefix='/api/appointments')
    app.register_blueprint(customers_routes.bp, url_prefix='/api/customers')
    app.register_blueprint(auth_routes.bp, url_prefix='/api/auth')

    return app

# backend/main.py
from app import create_app
app = create_app()

if __name__ == "__main__":
    app.run()
```

---

## 🗂️ **Final Refactored Structure**

```
backend/
├── main.py ← Entry point (20 lines)
├── app.py ← Flask app factory (50 lines)
├── config/
│   ├── settings.py ← Environment config
│   ├── database.py ← DB settings
│   └── logging.py ← Logging setup
├── utils/
│   ├── auth.py ← Authentication (150 lines)
│   ├── database.py ← DB utilities (200 lines)
│   ├── validators.py ← Input validation (100 lines)
│   ├── formatters.py ← Response formatting (80 lines)
│   └── helpers.py ← General utilities (100 lines)
├── services/ ← Business logic
│   ├── invoice_service.py ← Billing logic (500 lines)
│   ├── appointment_service.py ← Scheduling (800 lines)
│   ├── customer_service.py ← Customer mgmt (400 lines)
│   ├── vehicle_service.py ← Vehicle records (300 lines)
│   ├── messaging_service.py ← Communications (200 lines)
│   └── service_operations.py ← Work orders (250 lines)
└── routes/ ← Route handlers only
    ├── admin_routes.py ← Admin endpoints (200 lines)
    ├── appointments_routes.py ← Appointment endpoints (100 lines)
    ├── customers_routes.py ← Customer endpoints (80 lines)
    └── auth_routes.py ← Auth endpoints (50 lines)
```

**Result**: 12,816 lines → ~3,430 lines across 20 focused files

---

## 🚨 **Critical Migration Strategy**

### **🔄 Iterative Approach**
1. **Keep original file running** - don't break production
2. **Extract one module at a time** - test each extraction
3. **Import extracted modules back** - gradual replacement
4. **Delete from original only after testing** - safe migration

### **🧪 Testing Strategy**
```python
# For each extracted module, create integration test:
def test_invoice_service_extracted():
    # Test that invoice routes work the same

def test_database_utils_extracted():
    # Test that DB connections work the same

def test_auth_utils_extracted():
    # Test that authentication works the same
```

### **📊 Success Metrics**
- ✅ All 97 routes still work
- ✅ All 595 SQL operations still work
- ✅ Authentication still works
- ✅ Tests still pass
- ✅ No functionality broken

---

## 🎯 **Immediate Action Plan**

### **This Week: Start with Authentication**
```bash
# 1. Create the foundation
mkdir -p backend/utils
touch backend/utils/__init__.py

# 2. Extract auth functions to backend/utils/auth.py
# - Copy require_auth_role, maybe_auth, etc.
# - Test that imports work

# 3. Import back into local_server.py
# from utils.auth import require_auth_role, maybe_auth

# 4. Test that admin routes still work

# 5. Gradually remove auth functions from local_server.py
```

### **Week 2: Extract Database Layer**
```bash
# 1. Create backend/utils/database.py
# 2. Move connection management, cursor patterns
# 3. Test all routes still work
# 4. Remove DB code from local_server.py
```

### **Week 3-4: Extract Invoice Domain**
```bash
# 1. Create backend/services/invoice_service.py
# 2. Move all 10 invoice routes + functions
# 3. Create backend/routes/admin_routes.py
# 4. Test billing functionality
# 5. Remove invoice code from local_server.py
```

**Your monolith has clear boundaries! The admin domain with 63 routes is definitely your biggest refactoring target, but it breaks down nicely into invoices (10), appointments (8), customers (7), vehicles (6), and smaller domains.**
