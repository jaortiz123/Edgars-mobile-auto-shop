# 📋 Monolith Refactoring Master Plan

**Instructions:** Check off each task as completed. Do not proceed to Phase 1 until Phase 0 is 100% complete. This discovery phase is critical for informed architectural decisions.

# 📋 **Phase 0: Discovery & Baseline Capture Plan**

You're absolutely right - we need comprehensive discovery before any design work. Here's a detailed Phase 0 plan that addresses all the critical gaps identified.

## 🎯 **Phase 0: Discovery & Baselines (Week 0)**
*Critical: Must complete before any refactoring design work*

### **Task 0.1: Repository Inventory & Code Analysis**
*Est: 6 hours*

**Subtasks:**
- [x] **Route Enumeration Script**
  - Create Python script to parse `local_server.py` for all Flask route definitions
  - Extract: HTTP method, path pattern, handler function, file location, line number
  - Generate CSV export: `method,path,function,file,line,auth_required,role_required`
  - Output: `docs/design/discovery/route_inventory.csv`

- [ ] **Lines of Code Analysis**
  - Use `cloc` or similar to categorize code by responsibility
  - Separate: routing logic, business logic, DB queries, utilities, middleware
  - Identify largest functions and files (complexity hotspots)
  - Output: `docs/design/discovery/code_metrics.md`

- [ ] **Cyclomatic Complexity Analysis**
  - Run `radon cc backend/` to identify top 20 most complex functions
  - Flag functions with complexity > 10 for refactor priority
  - Cross-reference with mobile-critical endpoints
  - Output: `docs/design/discovery/complexity_hotspots.md`

- [ ] **Dependency Mapping**
  - Catalog all Python dependencies (`requirements.txt` analysis)
  - Map frontend build dependencies (package.json, build scripts)
  - Infrastructure dependencies (Postgres, S3, CloudFront, SigV4 proxy)
  - Output: `docs/design/discovery/dependency_map.md`

**Deliverables:**
- Complete route inventory with 100% coverage
- Code complexity assessment with refactor priorities
- Full dependency graph for impact analysis

### **Task 0.2: Runtime & Performance Baselines**
*Est: 4 hours*

**Subtasks:**
- [ ] **Critical Endpoint Performance Capture**
  - Script to hit key endpoints 100x and capture latencies:
    - `GET /api/admin/appointments/board` (p50/p95/p99)
    - `GET /api/admin/dashboard/stats`
    - `GET /api/admin/appointments/{id}` (drawer)
    - `GET /invoices/{id}/receipt.pdf` (export)
    - `GET /invoices/{id}/estimate.html` (export)
  - Output: `docs/design/discovery/performance_baseline.json`

- [ ] **Database Query Analysis**
  - Enable PostgreSQL slow query logging (> 100ms)
  - Capture 1 hour of production-like traffic
  - Run `EXPLAIN ANALYZE` on slowest 10 queries
  - Identify missing indexes and N+1 query patterns
  - Output: `docs/design/discovery/db_performance_audit.md`

- [ ] **Concurrent Load Testing**
  - Test with 10, 50, 100 concurrent users hitting board endpoint
  - Measure response times, error rates, resource utilization
  - Identify breaking points and bottlenecks
  - Output: `docs/design/discovery/load_test_results.md`

**Deliverables:**
- Quantified performance baselines for all critical paths
- Database optimization roadmap
- Concurrency limits and scaling requirements

### **Task 0.3: API Contract & Error Pattern Analysis**
*Est: 5 hours*

**Subtasks:**
- [ ] **Complete API Contract Sweep**
  - Script to curl every discovered endpoint with valid auth
  - Capture canonical JSON response samples (redact sensitive data)
  - Store samples in `docs/design/discovery/samples/{endpoint}.json`
  - Identify envelope inconsistencies (some use `{data: {...}}`, others don't)
  - Output: `docs/design/discovery/api_current_contracts.md`

- [ ] **Error Taxonomy Extraction**
  - Grep all `_error(` function calls in codebase
  - Catalog error codes, messages, HTTP status codes
  - Identify duplicates, inconsistencies, missing patterns
  - Map errors to endpoints that can produce them
  - Output: `docs/design/discovery/error_taxonomy.md`

- [ ] **Response Shape Analysis**
  - Compare JSON structures across similar endpoints
  - Identify camelCase vs snake_case inconsistencies
  - Flag mobile-unfriendly patterns (nested objects, missing types)
  - Output: `docs/design/discovery/response_shape_analysis.md`

- [ ] **Header Analysis**
  - Capture all HTTP headers from exports (PDF, HTML)
  - Document CORS headers, security headers, caching policies
  - Create baseline snapshots for regression testing
  - Output: `docs/design/discovery/header_baselines.md`

**Deliverables:**
- Complete API contract documentation with samples
- Normalized error handling patterns
- Mobile-readiness assessment for each endpoint

### **Task 0.4: Security & Authorization Mapping**
*Est: 3 hours*

**Subtasks:**
- [ ] **Authorization Matrix Creation**
  - Parse all `@require_auth_role()` and `@maybe_auth()` decorators
  - Build matrix: endpoint × required roles × authentication optional
  - Identify unprotected endpoints and verify they should be public
  - Map admin vs customer vs technician access patterns
  - Output: `docs/design/discovery/authz_matrix.csv` + `authz_matrix.md`

- [ ] **Authentication Flow Documentation**
  - Trace current SigV4 authentication implementation
  - Document token lifecycle, refresh patterns, session management
  - Identify mobile-incompatible patterns (cookies, complex signatures)
  - Output: `docs/design/discovery/current_auth_flow.md`

- [ ] **Security Vulnerability Assessment**
  - Check for SQL injection risks in dynamic queries
  - Verify CSRF protection on state-changing endpoints
  - Audit file upload endpoints for security risks
  - Review tenant isolation for cross-tenant data leaks
  - Output: `docs/design/discovery/security_audit.md`

**Deliverables:**
- Complete authorization matrix for mobile app planning
- Security risk assessment with mitigation priorities

### **Task 0.5: Data Model & Multi-Tenant Analysis**
*Est: 4 hours*

**Subtasks:**
- [ ] **Database Schema Extraction**
  - Run `pg_dump --schema-only` to get complete DDL
  - Generate ERD using tools like `pg_dump | dbml-cli` or SchemaSpy
  - Document all tables, relationships, indexes, constraints
  - Identify orphaned tables and unused columns
  - Output: `docs/design/discovery/schema_current.sql` + `erd.png`

- [ ] **Multi-Tenant Isolation Audit**
  - Trace where `tenant_id` is set in request context
  - Verify all queries include tenant filtering (search for raw SQL)
  - Test cross-tenant data access (negative testing)
  - Document `SET LOCAL` usage and connection pooling implications
  - Output: `docs/design/discovery/tenant_isolation_audit.md`

- [ ] **Data Lifecycle Documentation**
  - Map data retention policies (appointments, invoices, logs)
  - Identify PII fields requiring special handling
  - Document backup and recovery procedures
  - Plan for GDPR/data deletion requirements
  - Output: `docs/design/discovery/data_lifecycle.md`

**Deliverables:**
- Complete database schema documentation
- Multi-tenant security verification
- Data compliance requirements mapping

### **Task 0.6: Service Prioritization & Risk Assessment**
*Est: 3 hours*

**Subtasks:**
- [ ] **Service Domain Scoring Matrix**
  - Score each domain (appointments, invoices, customers, services, messaging) on:
    - **Mobile Criticality** (1-5): How essential for iOS app?
    - **Code Entanglement** (1-5): How coupled with other systems?
    - **Refactor Risk** (1-5): Likelihood of breaking changes?
    - **Development Effort** (1-5): Complexity of extraction?
  - Weight scores for mobile-first development priorities
  - Output: `docs/design/discovery/service_priority_matrix.md`

- [ ] **Risk Register Creation**
  - Identify top 15 refactoring risks:
    - Race conditions in appointment scheduling
    - Global mutable state in invoice processing
    - Hidden side effects in payment workflows
    - Database transaction boundaries
    - Multi-tenant data leakage during extraction
  - Assess likelihood and impact for each risk
  - Plan mitigation strategies
  - Output: `docs/design/discovery/refactor_risks.md`

- [ ] **Test Coverage Gap Analysis**
  - Map existing tests to endpoints and business logic
  - Identify critical paths with zero test coverage
  - Plan test-first approach for high-risk refactoring
  - Output: `docs/design/discovery/test_coverage_gaps.md`

**Deliverables:**
- Data-driven service extraction roadmap
- Risk mitigation strategies for each extraction phase

### **Task 0.7: Migration & Compatibility Strategy**
*Est: 2 hours*

**Subtasks:**
- [ ] **Backward Compatibility Framework**
  - Define dual-route vs feature-flag approach for migrations
  - Plan API versioning strategy (`/api/v1/`, `/api/v2/`)
  - Create deprecation header pattern (`X-API-Deprecated: 2025-12-01`)
  - Document breaking change process and notification timeline
  - Output: `docs/design/discovery/compatibility_strategy.md`

- [ ] **Migration Playbook Template**
  - Create reusable template for each service extraction:
    - Pre-flight checks and rollback criteria
    - Shadow/dark launch testing approach
    - Validation and monitoring requirements
    - Cutover and rollback procedures
  - Output: `docs/design/discovery/migration_playbook_template.md`

**Deliverables:**
- Standardized migration approach
- Risk mitigation for production deployments

### **Task 0.8: Observability & Documentation Governance**
*Est: 2 hours*

**Subtasks:**
- [ ] **Current Observability Assessment**
  - Catalog existing logging patterns and correlation IDs
  - Identify metrics gaps (latency, error rates, business metrics)
  - Plan distributed tracing for service extraction
  - Output: `docs/design/discovery/observability_gaps.md`

- [ ] **Domain Glossary Creation**
  - Standardize terminology across codebase:
    - "Appointment" vs "Visit" vs "Job" vs "Service Call"
    - "Card" vs "Row" vs "Item" vs "Entry"
    - "Slot" vs "Availability" vs "Time Window"
  - Ensure consistency for mobile app development
  - Output: `docs/design/discovery/glossary.md`

- [ ] **Documentation Governance Framework**
  - Define ADR lifecycle (Proposed → Under Review → Accepted → Superseded)
  - Assign review responsibilities and approval process
  - Create templates with required sections
  - Plan automated doc quality checks (broken links, stale references)
  - Output: `docs/design/governance/doc_governance.md`

**Deliverables:**
- Observability strategy for distributed services
- Sustainable documentation practices

## 📊 **Phase 0 Success Criteria**

**Must achieve 100% completion before Phase 1:**
- [ ] **Route Coverage**: Every endpoint in `local_server.py` cataloged and analyzed
- [ ] **Performance Baseline**: P95 latency captured for all mobile-critical endpoints
- [ ] **Error Taxonomy**: All error codes documented, no unknowns remain
- [ ] **Authorization Matrix**: Complete role-to-endpoint mapping
- [ ] **Service Priority Matrix**: Data-driven refactoring roadmap approved
- [ ] **Risk Register**: All major refactoring risks identified with mitigations
- [ ] **Test Coverage**: Gaps identified, critical paths flagged for test-first approach

## 📁 **Phase 0 File Structure**

```
docs/design/
├── README.md                              # Navigation index
├── discovery/                             # Phase 0 outputs
│   ├── route_inventory.csv               # Complete endpoint catalog
│   ├── code_metrics.md                   # LOC and complexity analysis
│   ├── complexity_hotspots.md            # Top 20 refactor priorities
│   ├── dependency_map.md                 # Full tech stack inventory
│   ├── performance_baseline.json         # Quantified latency baselines
│   ├── db_performance_audit.md           # Query optimization roadmap
│   ├── load_test_results.md              # Concurrency limits
│   ├── api_current_contracts.md          # Complete API documentation
│   ├── samples/                          # JSON response samples
│   ├── error_taxonomy.md                 # Normalized error patterns
│   ├── response_shape_analysis.md        # Mobile readiness assessment
│   ├── header_baselines.md               # Export regression prevention
│   ├── authz_matrix.csv                  # Authorization requirements
│   ├── current_auth_flow.md              # Authentication documentation
│   ├── security_audit.md                 # Vulnerability assessment
│   ├── schema_current.sql                # Complete DB schema
│   ├── erd.png                           # Visual data relationships
│   ├── tenant_isolation_audit.md         # Multi-tenant security
│   ├── data_lifecycle.md                 # Data retention and compliance
│   ├── service_priority_matrix.md        # Refactoring roadmap
│   ├── refactor_risks.md                 # Risk register
│   ├── test_coverage_gaps.md             # Testing strategy
│   ├── compatibility_strategy.md         # Migration approach
│   ├── migration_playbook_template.md    # Reusable extraction process
│   ├── observability_gaps.md             # Monitoring and logging
│   └── glossary.md                       # Domain terminology
└── governance/
    └── doc_governance.md                  # ADR lifecycle and standards
```

## ⏱️ **Phase 0 Timeline**

**Total Effort:** 29 hours
**Recommended Schedule:** 4-5 days intensive focus

**Day 1 (8 hours):** Repository analysis, route inventory, complexity assessment
**Day 2 (6 hours):** Performance baselines, database analysis
**Day 3 (8 hours):** API contracts, error taxonomy, security audit
**Day 4 (4 hours):** Data modeling, tenant isolation
**Day 5 (3 hours):** Prioritization, governance framework

**Critical Dependencies:**
- Database access for schema extraction and query analysis
- Production-like data for realistic performance testing
- Authentication credentials for complete API contract testing

This comprehensive Phase 0 will provide the solid foundation needed for informed architectural decisions and risk-aware refactoring execution.

---

# 📋 **Design Documentation Master Plan**

Based on your project status (Sprint 1 Foundation complete, 12K-line monolith ready for refactor, iOS app development pending), here's a comprehensive plan to capture all critical design knowledge.

## 🎯 **Phase 1: Foundation Architecture Documentation (Week 1)**

### **Task 1.1: Create Documentation Structure**
*Est: 2 hours*

**Subtasks:**
- [ ] Create `docs/design/` folder with subfolder structure
- [ ] Write `docs/design/README.md` navigation index
- [ ] Set up template files for each document type
- [ ] Create cross-reference linking system between docs

**Deliverables:**
- Complete folder structure with navigation
- Template files ready for content

### **Task 1.2: Architecture Decision Records (ADRs)**
*Est: 4 hours*

**Subtasks:**
- [ ] **ADR-001:** Monolith to Microservices Refactor Strategy
  - Context: 12K-line monolith blocking velocity
  - Decision: Service-oriented modules with clear boundaries
  - iOS development requirements and API discoverability needs
- [ ] **ADR-002:** Mobile-First API Design Principles
  - Swift-friendly JSON conventions (camelCase, consistent types)
  - Error handling standardization
  - Offline-first considerations
- [ ] **ADR-003:** Service Boundary Definitions
  - Appointments domain (booking, scheduling, lifecycle)
  - Customers domain (profiles, authentication, history)
  - Services domain (available services, pricing, availability)
  - Invoices domain (billing, payments, receipts)
- [ ] **ADR-004:** Authentication Strategy for Mobile
  - Current SigV4 vs mobile-friendly token approach
  - Refresh token strategy
  - Biometric integration considerations

**Deliverables:**
- 4 comprehensive ADRs with context, decisions, and consequences
- Clear rationale for refactoring approach and mobile priorities

### **Task 1.3: Current State Architecture Map**
*Est: 3 hours*

**Subtasks:**
- [ ] Document existing monolith structure (`local_server.py` analysis)
- [ ] Map current endpoint inventory (90+ endpoints identified)
- [ ] Identify shared utilities and middleware already extracted
- [ ] Document current database schema and relationships
- [ ] Map authentication and authorization patterns

**Deliverables:**
- Complete current state documentation
- Inventory of all existing functionality

## 🎯 **Phase 2: API Contract Specifications (Week 2)**

### **Task 2.1: Mobile-Critical API Contracts**
*Est: 6 hours*

**Subtasks:**
- [ ] **Appointments API Contract** (`/api/appointments/`)
  - GET `/api/appointments` - List with mobile-friendly pagination
  - GET `/api/appointments/{id}` - Detail view for iOS
  - POST `/api/appointments` - Mobile booking flow
  - PATCH `/api/appointments/{id}/status` - Quick status updates
  - Include Swift Codable examples for each endpoint
- [ ] **Customers API Contract** (`/api/customers/`)
  - GET `/api/customers/profile` - User profile for iOS
  - PATCH `/api/customers/profile` - Settings updates
  - GET `/api/customers/{id}/history` - Appointment history
  - Authentication flow integration
- [ ] **Services API Contract** (`/api/services/`)
  - GET `/api/services/available` - Service picker data
  - GET `/api/services/{id}/pricing` - Cost estimation
  - Service availability and scheduling constraints
- [ ] **Availability API Contract** (`/api/availability/`)
  - GET `/api/availability/slots` - Time slot booking
  - POST `/api/availability/reserve` - Hold time slots
  - Real-time availability updates

**Deliverables:**
- 4 complete API specifications with Swift integration examples
- Request/response schemas and error handling patterns

### **Task 2.2: Error Handling & Status Code Standardization**
*Est: 2 hours*

**Subtasks:**
- [ ] Document current `_error` JSON envelope pattern
- [ ] Define mobile-friendly error codes and messages
- [ ] Create error scenario mapping for each API
- [ ] Plan offline error handling and retry strategies

**Deliverables:**
- Standardized error handling documentation
- Mobile-specific error scenarios and UX patterns

### **Task 2.3: Real-Time Updates Strategy**
*Est: 2 hours*

**Subtasks:**
- [ ] Document current polling approach (30s intervals)
- [ ] Evaluate WebSocket vs Server-Sent Events for real-time updates
- [ ] Plan push notification integration points
- [ ] Define data synchronization patterns for mobile offline mode

**Deliverables:**
- Real-time strategy documentation with mobile considerations

## 🎯 **Phase 3: Data Modeling & Business Logic (Week 3)**

### **Task 3.1: Domain Model Documentation**
*Est: 4 hours*

**Subtasks:**
- [ ] **Appointment Lifecycle State Machine**
  - States: SCHEDULED → IN_PROGRESS → READY → COMPLETED/NO_SHOW
  - Valid transitions and business rules
  - Mobile UI state mapping
- [ ] **Customer Journey Mapping**
  - Registration and profile creation
  - Appointment booking flow
  - Payment and invoice workflow
  - Service history and loyalty tracking
- [ ] **Multi-Tenant Data Isolation**
  - Current tenant resolution middleware
  - Data security boundaries
  - Scaling considerations for multiple shop locations

**Deliverables:**
- Complete domain models with state diagrams
- Business rule documentation

### **Task 3.2: Database Schema Evolution Plan**
*Est: 3 hours*

**Subtasks:**
- [ ] Document current schema (init.sql analysis)
- [ ] Plan schema changes for service extraction
- [ ] Migration strategy for zero-downtime deployments
- [ ] Index optimization for mobile query patterns

**Deliverables:**
- Database evolution roadmap
- Migration scripts and rollback procedures

## 🎯 **Phase 4: Mobile Integration Strategy (Week 4)**

### **Task 4.1: iOS App Architecture Plan**
*Est: 4 hours*

**Subtasks:**
- [ ] **SwiftUI + Combine Architecture**
  - MVVM pattern with service layer
  - Reactive data binding for real-time updates
  - Navigation and state management
- [ ] **Networking Layer Design**
  - URLSession configuration with authentication
  - Response caching and offline support
  - Error handling and retry logic
- [ ] **Data Persistence Strategy**
  - Core Data model matching API contracts
  - Sync strategy between local and remote data
  - Conflict resolution patterns

**Deliverables:**
- Complete iOS architecture specification
- Code structure recommendations and patterns

### **Task 4.2: Offline-First Strategy**
*Est: 3 hours*

**Subtasks:**
- [ ] Define which data needs offline availability
- [ ] Plan synchronization triggers and conflict resolution
- [ ] Design offline-capable user flows
- [ ] Plan background sync and push notification integration

**Deliverables:**
- Offline strategy documentation
- Sync protocol specifications

### **Task 4.3: Authentication Integration**
*Est: 2 hours*

**Subtasks:**
- [ ] Plan mobile-friendly authentication flow
- [ ] Token storage and refresh strategy
- [ ] Biometric authentication integration
- [ ] Session management and security considerations

**Deliverables:**
- Mobile authentication strategy
- Security implementation guidelines

## 🎯 **Phase 5: Service Refactoring Roadmap (Week 5)**

### **Task 5.1: Service Extraction Priority Matrix**
*Est: 3 hours*

**Subtasks:**
- [ ] Prioritize services by mobile app dependency
- [ ] Map current monolith code to future service modules
- [ ] Define extraction order to minimize breaking changes
- [ ] Plan testing strategy for each extraction phase

**Deliverables:**
- Service extraction roadmap
- Risk assessment and mitigation strategies

### **Task 5.2: Implementation Guidelines**
*Est: 3 hours*

**Subtasks:**
- [ ] Define service layer patterns and conventions
- [ ] Plan repository pattern for data access
- [ ] Design dependency injection and configuration management
- [ ] Create testing framework for services

**Deliverables:**
- Implementation standards and patterns
- Service template and examples

### **Task 5.3: Migration Strategy**
*Est: 2 hours*

**Subtasks:**
- [ ] Plan backward compatibility during transition
- [ ] Define feature flag strategy for gradual rollout
- [ ] Create rollback procedures for each service
- [ ] Plan monitoring and alerting for new services

**Deliverables:**
- Migration playbook
- Monitoring and alerting specifications

## 🎯 **Phase 6: Development Workflows & Standards (Week 6)**

### **Task 6.1: Development Environment Setup**
*Est: 2 hours*

**Subtasks:**
- [ ] Document local development setup for mobile + backend
- [ ] Create development database seeding scripts
- [ ] Plan environment-specific configuration management
- [ ] Design development workflow for parallel mobile/backend work

**Deliverables:**
- Developer onboarding documentation
- Environment setup automation scripts

### **Task 6.2: Testing Strategy**
*Est: 3 hours*

**Subtasks:**
- [ ] Plan unit testing approach for extracted services
- [ ] Design integration testing for API contracts
- [ ] Create mobile app testing strategy (unit + UI)
- [ ] Plan end-to-end testing scenarios

**Deliverables:**
- Comprehensive testing strategy
- Testing framework recommendations

### **Task 6.3: Code Quality & Standards**
*Est: 2 hours*

**Subtasks:**
- [ ] Define coding standards for Python services
- [ ] Create Swift style guide for iOS development
- [ ] Plan code review processes and guidelines
- [ ] Design CI/CD pipeline for multi-platform development

**Deliverables:**
- Development standards documentation
- CI/CD pipeline specifications

## 📊 **Success Metrics & Validation**

### **Immediate Success Indicators:**
- [ ] New developers can understand the system architecture in 30 minutes
- [ ] Mobile development has clear API contracts to code against
- [ ] Service extraction decisions are documented with clear rationale
- [ ] All architectural decisions have recorded context and consequences

### **Long-term Success Indicators:**
- [ ] iOS app development velocity increases after service extraction
- [ ] API discoverability enables rapid feature development
- [ ] System complexity is manageable despite growth
- [ ] Documentation stays current with system evolution

## 🚀 **Implementation Timeline**

**Total Effort:** ~40 hours across 6 weeks
**Recommended Schedule:** 6-8 hours per week, 2-week sprints

**Sprint 1 (Weeks 1-2):** Foundation + API Contracts
**Sprint 2 (Weeks 3-4):** Data Models + Mobile Strategy
**Sprint 3 (Weeks 5-6):** Service Roadmap + Standards

**Key Milestones:**
- Week 2: Mobile-critical APIs fully documented
- Week 4: iOS architecture plan complete
- Week 6: Service extraction roadmap ready for execution

This comprehensive documentation foundation will provide the context and guidance needed to successfully refactor the monolith and build the iOS application with confidence and velocity.
