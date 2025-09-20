# 🗺️ Edgar's Mobile Auto Shop - Server Structure Mind Map

## 📊 **Your Current Monolith: 12,816 Lines**

```
                    local_server.py (12,816 lines)
                            |
    ┌───────────────────────┼───────────────────────┐
    |                       |                       |
🔧 UTILITIES           🛣️ API ROUTES            🗄️ DATA LAYER
(173 functions)        (97 endpoints)           (595 SQL operations)
```

---

## 🛣️ **API Domain Breakdown** (97 Routes Total)

### 🏢 **ADMIN DOMAIN** (63 routes) - **BIGGEST REFACTOR TARGET**
```
/api/admin/
├── 📋 invoices/* (10 endpoints) ← Payment/billing system
├── 📅 appointments/* (8 endpoints) ← Scheduling core
├── 👥 customers/* (7 endpoints) ← Customer management
├── 🚗 vehicles/* (6 endpoints) ← Vehicle records
├── 📧 message-templates/* (5 endpoints) ← Communication
├── 🔧 service-operations/* (4 endpoints) ← Work orders
├── 📊 reports/* (2 endpoints) ← Analytics
└── 🏠 dashboard, metrics, staff, etc. (21 endpoints) ← Misc admin
```

### 📅 **APPOINTMENTS DOMAIN** (17 routes)
```
/api/appointments/
├── /<appt_id> (CRUD operations)
├── /<appt_id>/check-in
├── /<appt_id>/check-out
└── /calendar, /board views
```

### 👥 **CUSTOMERS DOMAIN** (6 routes)
```
/api/customers/
├── /login, /register
├── /lookup (search)
└── /<customer_id>/history
```

### 🔐 **AUTH & SYSTEM** (9 routes)
```
/api/auth/*, /health/*, /ready, etc.
```

---

## 🔧 **Utility Functions Analysis** (173 Total)

### 🗄️ **Database Helpers** (~40 functions)
```
- get_* functions (data retrieval)
- create_* functions (data creation)
- update_* functions (data modification)
- _get_customer_row(), _get_vehicle_row()
- Database connection management
```

### 🔐 **Authentication & Security** (~15 functions)
```
- JWT token management
- Permission decorators
- User validation functions
- Admin access controls
```

### ✅ **Validation Functions** (~20 functions)
```
- _validate_customer_patch()
- _validate_vehicle_patch()
- Input sanitization
- Data format checkers
```

### 📧 **Communication & Formatting** (~25 functions)
```
- format_duration_hours()
- Email/SMS sending
- PDF generation
- Response formatting
```

---

## 🗄️ **Database Operations** (595 SQL Operations)

### **Heavy SQL Usage**
```
SELECT: 187 operations ← Lots of data retrieval
CREATE: 151 operations ← Schema/table management
UPDATE: 151 operations ← Data modification
INSERT: 52 operations ← Data creation
DELETE: 50 operations ← Data removal
```

---

## 🎯 **Recommended Refactoring Structure**

### **Phase 1: Core Domain Separation**
```
backend/
├── routes/
│   ├── admin_routes.py ← 63 endpoints (PRIORITY #1)
│   ├── appointments_routes.py ← 17 endpoints
│   ├── customers_routes.py ← 6 endpoints
│   └── auth_routes.py ← 9 endpoints
│
├── services/ ← Business logic layer
│   ├── invoice_service.py ← Payment/billing logic
│   ├── appointment_service.py ← Scheduling logic
│   ├── customer_service.py ← Customer management
│   ├── vehicle_service.py ← Vehicle records
│   └── messaging_service.py ← Communication logic
│
├── utils/
│   ├── database.py ← DB connections, queries
│   ├── auth.py ← JWT, decorators, permissions
│   ├── validators.py ← Input validation
│   ├── formatters.py ← Response/data formatting
│   └── helpers.py ← General utilities
│
├── models/ ← Data models (optional)
│   ├── customer.py
│   ├── appointment.py
│   ├── vehicle.py
│   └── invoice.py
│
└── config/
    ├── settings.py ← Environment variables
    ├── database.py ← DB connection config
    └── logging.py ← Logging setup
```

### **Phase 2: Clean Entry Points**
```
backend/
├── app.py ← Flask app factory
├── main.py ← Entry point, route registration
└── __init__.py ← Package initialization
```

---

## 🚨 **Critical Refactoring Insights**

### **🔥 Hotspots (tackle first)**
1. **Admin routes** (63 endpoints) - massive domain
2. **Database utilities** (~40 functions) - heavily reused
3. **Authentication logic** (~15 functions) - security critical

### **🎯 Split Priorities**
1. **Extract `/admin/invoices/*`** (10 endpoints) - billing is complex
2. **Extract `/admin/appointments/*`** (8 endpoints) - scheduling core
3. **Extract authentication decorators** - used everywhere
4. **Extract database connection helpers** - fundamental dependency

### **💡 Easy Wins**
- Health checks, debug routes → separate immediately
- Customer login/register → simple to extract
- Message templates → self-contained

### **⚠️ Complexity Warnings**
- **595 SQL operations** - careful with database utilities
- **173 functions** - many interdependencies
- **Admin domain** - 63 routes likely tightly coupled

---

## 🗺️ **Visual Dependency Map**

```
         🔐 AUTH LAYER (JWT, decorators)
                     |
         🗄️ DATABASE LAYER (connection, queries)
                     |
    ┌────────────────┼────────────────┐
    |                |                |
📋 INVOICE      📅 APPOINTMENT    👥 CUSTOMER
SERVICES        SERVICES          SERVICES
    |                |                |
    └────────────────┼────────────────┘
                     |
           🛣️ ROUTE HANDLERS
           (Flask @app.route)
```

---

## ✅ **Next Steps Checklist**

- [ ] **Start with admin/invoices** - most self-contained business domain
- [ ] **Extract authentication utilities first** - needed by everything
- [ ] **Create database utility module** - fundamental dependency
- [ ] **Move one route group at a time** - avoid breaking everything
- [ ] **Keep tests passing** - validate each extraction step
- [ ] **Use app factory pattern** - better for testing/imports

**Your 12,816-line monolith has clear domain boundaries! The admin section is your biggest refactoring opportunity with 63 routes across 10+ subdomains.**
