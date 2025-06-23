# Debug Tracker

## Completed
- **SEC-002**: Added Zod validation middleware and integrated it with forms.
- **API-001**: Implemented loading and error states in the booking form.
- **debug-tracker #18**: Added global error handler and `next(err)` pattern across routes.
- **DEP-001**: Removed duplicate dependencies in the frontend package.json.
- **SEC-001**: Refactor authentication to use HttpOnly cookies.
- **TEST-002**: Add E2E tests.

## Pending
- **PROD-001**: Fix CI/CD workflow.
- **PERF-001**: Optimize re-renders.

## New Issues (Deep Analysis)

### High Priority
- **DEP-002**: Fix security vulnerabilities in npm dependencies (Critical)
- **SEC-003**: Move all auth tokens to HttpOnly cookies (Critical)
- **ARCH-001**: Refactor components to separate concerns (High)
- **API-002**: Implement consistent API error handling (High)
- **PERF-001**: Fix memory leaks in appointment components (High)

### Medium Priority
- **PERF-002**: Optimize re-renders with React.memo (Medium)
- **INFRA-001**: Standardize Docker development setup (Medium)
- **TEST-001**: Add test coverage for critical components (Medium)
- **A11Y-001**: Fix accessibility issues in forms (Medium)

### Low Priority
- **PROD-001**: Implement production monitoring (High effort)

## ARCH-001: Component structure lacks clear organization pattern
- **Category**: Architecture
- **Severity**: High
- **Description**: Frontend components mix presentational and container responsibilities. Many components handle both API calls and presentation logic, making them difficult to test and reuse.
- **Impact**: Code duplication, testing difficulties, maintenance burden
- **Location**: 
  - **Files**: `frontend/src/components/ServiceList.tsx`, `frontend/src/components/AppointmentForm.tsx`
  - **Lines**: Throughout component files
- **Fix**: 
  - **Immediate**: Split largest components into container/presentation pattern
  - **Proper**: Implement comprehensive component architecture with clear separation
  - **Code**: 
  ```javascript
  // Container component
  const ServiceListContainer = () => {
    const [services, setServices] = useState([]);
    useEffect(() => {
      api.getServices().then(setServices);
    }, []);
    return <ServiceList services={services} />;
  };

  // Presentation component
  const ServiceList = ({ services }) => (
    <div className="grid grid-cols-2 gap-4">
      {services.map(service => <ServiceCard key={service.id} {...service} />)}
    </div>
  );
  ```
  - **Test Case**: Verify presentation components render correctly with mock props
- **Related Issues**: PERF-001, TEST-001
- **Estimated Effort**: 1 day

## DEP-002: Multiple high-severity vulnerabilities in dependencies
- **Category**: Dependencies
- **Severity**: Critical
- **Title**: Multiple high-severity vulnerabilities in dependencies
- **Description**: Several dependencies have known security vulnerabilities, including potential remote code execution paths
- **Impact**: Security risks including data exposure and system compromise
- **Location**: 
  - **Files**: `frontend/package.json`, `backend/package.json`
  - **Lines**: `dependency sections`
- **Fix**: 
  - **Immediate**: Run `npm audit fix`
  - **Proper**: Regular dependency updates and security scanning
  - **Code**: `npm audit fix --force`
  - **Test Case**: `npm audit` reports no high/critical vulnerabilities
- **Related Issues**: SEC-003
- **Estimated Effort**: 2hr

## PERF-001: Memory leaks in appointment creation flow
- **Category**: Performance
- **Severity**: High
- **Title**: Memory leaks in appointment creation flow
- **Description**: Event listeners in appointment form components aren't properly cleaned up, causing memory leaks during navigation
- **Impact**: Increasing memory usage, potential app crash after extended use
- **Location**: 
  - **Files**: `frontend/src/pages/Booking.tsx`
  - **Lines**: `useEffect hooks (50-70)`
- **Fix**: 
  - **Immediate**: Add cleanup functions to useEffect hooks
  - **Proper**: Implement consistent useEffect cleanup pattern across all components
  - **Code**: 
  ```javascript
  useEffect(() => {
    const handler = () => { /* handler logic */ };
    window.addEventListener('event', handler);
    return () => window.removeEventListener('event', handler);
  }, []);
  ```
  - **Test Case**: No increase in memory usage after multiple booking attempts
- **Related Issues**: ARCH-001
- **Estimated Effort**: 3hr

## SEC-003: Authentication tokens stored insecurely
- **Category**: Security
- **Severity**: Critical
- **Title**: Authentication tokens stored insecurely
- **Description**: Despite SEC-001 addressing HttpOnly cookies, some tokens are still stored in localStorage, vulnerable to XSS attacks
- **Impact**: Account compromise through token theft via XSS
- **Location**: 
  - **Files**: `frontend/src/context/AuthContext.tsx`, `frontend/src/hooks/useAuth.ts`
  - **Lines**: `token storage implementation (20-35)`
- **Fix**: 
  - **Immediate**: Move all token storage to HttpOnly cookies
  - **Proper**: Implement proper token refresh mechanism with secure storage
  - **Code**: 
  ```javascript
  // Remove this
  localStorage.setItem('token', data.token);

  // Backend should set HttpOnly cookie instead
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000
  });
  ```
  - **Test Case**: No auth tokens visible in localStorage/sessionStorage after login
- **Related Issues**: SEC-001
- **Estimated Effort**: 4hr

## API-002: Inconsistent API error handling
- **Category**: API
- **Severity**: High
- **Title**: Inconsistent API error handling
- **Description**: API calls lack consistent error handling and retry logic, causing silent failures
- **Impact**: User sees no error message when operations fail, data loss
- **Location**: 
  - **Files**: `frontend/src/api/index.ts`, `frontend/src/hooks/useApi.ts`
  - **Lines**: `all API call functions`
- **Fix**: 
  - **Immediate**: Add try/catch blocks to API calls
  - **Proper**: Implement centralized error handling with retry mechanism
  - **Code**: 
  ```javascript
  const fetchWithRetry = async (url, options, retries = 3) => {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return await response.json();
    } catch (error) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 1000));
        return fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  };
  ```
  - **Test Case**: API failures show appropriate error messages to users
- **Related Issues**: UX-001
- **Estimated Effort**: 1 day

## TEST-001: Critical components lack test coverage
- **Category**: Testing
- **Severity**: Medium
- **Title**: Critical components lack test coverage
- **Description**: Core components like AppointmentForm have no unit tests, risking regressions
- **Impact**: Bugs introduced during refactoring, decreased reliability
- **Location**: 
  - **Files**: `frontend/src/components/*`
  - **Lines**: `N/A`
- **Fix**: 
  - **Immediate**: Add basic tests for critical components
  - **Proper**: Implement comprehensive test suite with CI integration
  - **Code**: 
  ```javascript
  test('AppointmentForm submits with valid data', () => {
    render(<AppointmentForm />);
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test User' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Test User'
    }));
  });
  ```
  - **Test Case**: Test suite passes with >80% coverage
- **Related Issues**: QA-001
- **Estimated Effort**: 3 days

## INFRA-001: Docker development environment inconsistencies
- **Category**: Developer Experience
- **Severity**: Medium
- **Title**: Docker development environment inconsistencies
- **Description**: Volume mounts and hot-reload configuration inconsistent between developers
- **Impact**: Slowed development cycles, onboarding friction
- **Location**: 
  - **Files**: `docker-compose.yml`, `frontend/Dockerfile`, `backend/Dockerfile`
  - **Lines**: `volume definitions (10-25)`
- **Fix**: 
  - **Immediate**: Update README with correct Docker setup instructions
  - **Proper**: Standardize Docker configurations with documented conventions
  - **Code**: 
  ```yaml
  services:
    frontend:
      volumes:
        - ./frontend:/app
        - /app/node_modules
      environment:
        - CHOKIDAR_USEPOLLING=true
  ```
  - **Test Case**: New developers can start developing within 15 minutes
- **Related Issues**: DOC-001
- **Estimated Effort**: 4hr

## PERF-002: Service components re-render unnecessarily
- **Category**: Performance
- **Severity**: Medium
- **Title**: Service components re-render unnecessarily
- **Description**: Service listing components re-render on every parent state change
- **Impact**: UI jank during interactions, poor performance with many services
- **Location**: 
  - **Files**: `frontend/src/components/ServiceList.tsx`, `frontend/src/components/ServiceCard.tsx`
  - **Lines**: `component definitions`
- **Fix**: 
  - **Immediate**: Wrap components with React.memo
  - **Proper**: Optimize with proper memoization strategy and virtualization
  - **Code**: 
  ```javascript
  const ServiceCard = React.memo(({ name, price, duration }) => (
    <div className="p-4 border rounded shadow">
      <h3>{name}</h3>
      <p>${price}</p>
      <p>{duration} min</p>
    </div>
  ));
  ```
  - **Test Case**: Performance profiler shows reduced render count
- **Related Issues**: PERF-001
- **Estimated Effort**: 2hr

## A11Y-001: Forms lack proper accessibility attributes
- **Category**: Accessibility
- **Severity**: Medium
- **Title**: Forms lack proper accessibility attributes
- **Description**: Form inputs missing proper labels, ARIA attributes, and keyboard navigation
- **Impact**: Poor experience for users with assistive technology, potential legal issues
- **Location**: 
  - **Files**: `frontend/src/components/AppointmentForm.tsx`, `frontend/src/components/LoginForm.tsx`
  - **Lines**: `form element definitions`
- **Fix**: 
  - **Immediate**: Add htmlFor attributes to labels matching input IDs
  - **Proper**: Complete accessibility audit and remediation
  - **Code**: `<div className="mb-4">\n  <label htmlFor="name" className="block text-sm font-medium">Name</label>\n  <input\n    id="name"\n    name="name"\n    type="text"\n    required\n    aria-describedby="name-error"\n    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"\n  />\n  {errors.name && <p id="name-error" className="text-red-500 text-xs mt-1">{errors.name}</p>}\n</div>`
  - **Test Case**: Passes axe accessibility tests
- **Related Issues**: UX-001
- **Estimated Effort**: 1day

## PROD-001: No error tracking or performance monitoring
- **Category**: Production
- **Severity**: High
- **Title**: No error tracking or performance monitoring
- **Description**: Application lacks error tracking and performance monitoring in production
- **Impact**: Silent failures, inability to detect issues affecting users
- **Location**: 
  - **Files**: `frontend/src/main.tsx`, `backend/server.js`
  - **Lines**: `application initialization`
- **Fix**: 
  - **Immediate**: Add basic error logging to console
  - **Proper**: Implement structured logging and monitoring solution
  - **Code**: 
  // Frontend
  import * as Sentry from '@sentry/react';

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [new BrowserTracing()],
    tracesSampleRate: 0.5,
  });

  // Backend
  const winston = require('winston');
  const logger = winston.createLogger({ /* config */ });
  ```
  - **Test Case**: Errors in production are captured and reported
- **Related Issues**: OPS-001
- **Estimated Effort**: 2days



