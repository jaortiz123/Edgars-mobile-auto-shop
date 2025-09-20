# 🎯 CORRECTED ARCHITECTURE: Hexagonal Over Utils Sprawl

## **The Problem with Utils Sprawl**

Original plan created new junk drawers:
```
❌ backend/utils/
   ├── auth.py        ← Where does customer auth logic go?
   ├── database.py    ← Which domain's queries go here?
   ├── validation.py  ← Customer validation mixed with appointment validation
   └── helpers.py     ← Everything else = chaos
```

## **The Solution: Hexagonal Architecture**

Domain-driven structure with clear boundaries:

```
✅ backend/
├── api/v1/                    ← Presentation Layer (Route Handlers)
│   ├── admin/
│   │   ├── customers.py       ← Admin customer endpoints only
│   │   ├── appointments.py    ← Admin appointment endpoints only
│   │   ├── invoices.py        ← Admin invoice endpoints only
│   │   └── vehicles.py        ← Admin vehicle endpoints only
│   ├── customers.py           ← Public customer endpoints
│   ├── appointments.py        ← Public appointment endpoints
│   └── auth.py               ← Authentication endpoints
│
├── domain/                    ← Business Logic Layer
│   ├── customers/
│   │   ├── service.py        ← Customer business rules ONLY
│   │   ├── validation.py     ← Customer-specific validation
│   │   └── types.py          ← Customer domain models
│   ├── appointments/
│   │   ├── service.py        ← Appointment business rules ONLY
│   │   ├── validation.py     ← Appointment-specific validation
│   │   └── types.py          ← Appointment domain models
│   ├── invoices/
│   │   ├── service.py        ← Invoice/billing business rules
│   │   ├── validation.py     ← Invoice-specific validation
│   │   └── types.py          ← Invoice domain models
│   └── vehicles/
│       ├── service.py        ← Vehicle business rules
│       ├── validation.py     ← Vehicle-specific validation
│       └── types.py          ← Vehicle domain models
│
├── infra/                     ← Infrastructure Layer
│   ├── repositories.py       ← Data access implementations
│   ├── database.py           ← Database connection management
│   └── external/             ← External service clients
│       ├── email.py          ← Email service client
│       └── payment.py        ← Payment processor client
│
├── shared/                    ← Cross-Cutting Concerns ONLY
│   ├── auth/
│   │   ├── jwt_service.py    ← JWT token management
│   │   ├── decorators.py     ← Authentication decorators
│   │   └── permissions.py    ← Permission checking
│   ├── validation/
│   │   ├── common.py         ← Generic validation rules
│   │   └── sanitizers.py     ← Input sanitization
│   └── formatting/
│       ├── responses.py      ← Standard response formatting
│       └── dates.py          ← Date/time formatting
│
├── middleware/                ← Request/Response Processing
├── extensions.py              ← Flask extensions
└── app.py                    ← App factory
```

---

## **Key Principles**

### **1. Domain Ownership**
- **Customer validation** → `domain/customers/validation.py`
- **Appointment validation** → `domain/appointments/validation.py`
- **Invoice validation** → `domain/invoices/validation.py`

**No more mixed validation files!**

### **2. Cross-Cutting vs Domain Logic**
```python
# ✅ Domain-specific (goes in domain/customers/)
def validate_customer_email(email: str) -> bool:
    """Customer-specific email validation"""

# ✅ Cross-cutting (goes in shared/validation/)
def sanitize_phone_number(phone: str) -> str:
    """Generic phone number sanitization"""
```

### **3. Clean Dependencies**
```python
# Route handler (thin)
@customers_bp.route('/<customer_id>', methods=['PATCH'])
def update_customer(customer_id: str):
    patch = request.get_json()
    service = CustomerService(current_app.repositories['customer'])
    result = service.update_customer(customer_id, patch)
    return jsonify(result)

# Service layer (business rules)
class CustomerService:
    def __init__(self, repo: CustomerRepository):
        self.repo = repo

    def update_customer(self, customer_id: str, patch: Dict[str, Any]):
        # Validation, business rules, calls to repo
        pass
```

---

## **Migration Strategy**

### **Phase 1: Extract Domain by Domain**

#### **Step 1: Customer Domain** (Addresses legacy profile complexity)
```bash
# Create domain structure
mkdir -p backend/domain/customers
touch backend/domain/customers/{service.py,validation.py,types.py}

# Extract from monolith:
# - Customer profile logic → domain/customers/service.py
# - _validate_customer_patch() → domain/customers/validation.py
# - Customer route handlers → api/v1/customers.py

# Preserve behavior via DI:
# Route → Service → Repository → Database
```

#### **Step 2: Appointment Domain** (High-value extraction)
```bash
mkdir -p backend/domain/appointments
touch backend/domain/appointments/{service.py,validation.py,types.py}

# Extract appointment scheduling logic, validation, CRUD
```

#### **Step 3: Invoice Domain** (Complex but bounded)
```bash
mkdir -p backend/domain/invoices
touch backend/domain/invoices/{service.py,validation.py,types.py}

# Extract billing logic, PDF generation, payment processing
```

### **Phase 2: Cross-Cutting Concerns**

Only AFTER domains are extracted, identify truly shared logic:

```bash
mkdir -p backend/shared/{auth,validation,formatting}

# Move only genuinely cross-cutting concerns:
# - JWT token management (used by all domains)
# - Generic input sanitization (used by all domains)
# - Standard response formatting (used by all routes)
```

---

## **Example: Customer Domain Implementation**

### **Route Handler** (Thin presentation layer)
```python
# backend/api/v1/customers.py
from flask import Blueprint, request, jsonify, current_app
from backend.domain.customers.service import CustomerService

customers_bp = Blueprint('customers', __name__)

@customers_bp.route('/<customer_id>', methods=['PATCH'])
def update_customer(customer_id: str):
    """Update customer information"""

    patch = request.get_json()

    # Get repository from DI container
    customer_repo = current_app.repositories['customer']

    # Create service with injected dependency
    service = CustomerService(customer_repo)

    # Delegate business logic to service
    result = service.update_customer(customer_id, patch)

    return jsonify(result)
```

### **Service Layer** (Business rules and coordination)
```python
# backend/domain/customers/service.py
from typing import Dict, Any
from backend.domain.interfaces import CustomerRepository
from .validation import validate_customer_patch
from .types import Customer

class CustomerService:
    """Customer business logic and orchestration"""

    def __init__(self, repo: CustomerRepository):
        self.repo = repo

    def update_customer(self, customer_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update customer with business rule enforcement
        Extracted from local_server.py PATCH /api/admin/customers/<cid>
        """

        # Domain validation (not generic validation)
        validation_errors = validate_customer_patch(patch)
        if validation_errors:
            raise ValueError(f"Validation failed: {validation_errors}")

        # Business rules
        if 'email' in patch:
            self._ensure_email_unique(patch['email'], exclude_customer=customer_id)

        # Delegate to repository
        updated_customer = self.repo.update(customer_id, patch)

        if not updated_customer:
            raise ValueError(f"Customer {customer_id} not found")

        # Apply business transformations
        return self._format_customer_response(updated_customer)

    def _ensure_email_unique(self, email: str, exclude_customer: str = None):
        """Business rule: emails must be unique"""
        # Domain-specific business logic
        pass

    def _format_customer_response(self, customer: Dict[str, Any]) -> Dict[str, Any]:
        """Format customer for API response"""
        # Domain-specific formatting
        return customer
```

### **Validation Layer** (Domain-specific rules)
```python
# backend/domain/customers/validation.py
from typing import Dict, Any, List
from backend.shared.validation.common import is_valid_email, sanitize_phone

def validate_customer_patch(patch: Dict[str, Any]) -> List[str]:
    """
    Validate customer patch data
    Extracted from _validate_customer_patch() in local_server.py
    """
    errors = []

    # Customer-specific validation rules
    if 'email' in patch:
        if not is_valid_email(patch['email']):
            errors.append("Invalid email format")

    if 'phone' in patch:
        sanitized = sanitize_phone(patch['phone'])  # Uses shared utility
        if not sanitized:
            errors.append("Invalid phone number")
        patch['phone'] = sanitized  # Mutate to sanitized version

    if 'contact_preferences' in patch:
        prefs = patch['contact_preferences']
        if not isinstance(prefs, dict):
            errors.append("Contact preferences must be object")
        elif not all(k in ['email', 'sms', 'phone'] for k in prefs.keys()):
            errors.append("Invalid contact preference keys")

    return errors
```

---

## **Benefits Over Utils Sprawl**

### **✅ Clear Ownership**
- Customer validation lives in `domain/customers/validation.py`
- Invoice validation lives in `domain/invoices/validation.py`
- No more "where does this function go?" decisions

### **✅ Domain Expertise**
- Customer team owns `domain/customers/` entirely
- Invoice team owns `domain/invoices/` entirely
- Clear boundaries prevent merge conflicts

### **✅ Testability**
- Test customer logic in isolation
- Mock repositories via interfaces
- No tangled dependencies

### **✅ Maintainability**
- Change customer validation without affecting invoices
- Extract domains independently
- Refactor within domain boundaries

---

## **What Goes in Shared (Sparingly)**

Only genuinely cross-cutting concerns:

```python
# ✅ Shared: Used by ALL domains
def sanitize_phone_number(phone: str) -> str:
    """Generic phone sanitization for any domain"""

# ✅ Shared: Used by ALL domains
def format_currency(amount: float, currency: str = "USD") -> str:
    """Generic currency formatting"""

# ❌ NOT Shared: Domain-specific
def validate_appointment_time_slot(start: datetime, end: datetime) -> bool:
    """Appointment-specific → domain/appointments/validation.py"""

# ❌ NOT Shared: Domain-specific
def calculate_invoice_total(line_items: List[Dict]) -> float:
    """Invoice-specific → domain/invoices/service.py"""
```

**Bottom Line: Domain ownership prevents utils sprawl. Cross-cutting concerns go in `shared/` only when used by 3+ domains.**
