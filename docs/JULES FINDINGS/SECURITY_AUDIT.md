# Security & Authentication Audit
Generated: 2025-08-07
Audit Type: Deep Security Scan

## 🚨 CRITICAL - Immediate Action Required
### [C-01] JWT Stored in `localStorage`
- **Severity:** Critical
- **Location:** `frontend/src/services/authService.ts` (lines 142, 153, 164), `frontend/src/contexts/AuthContext.tsx` (lines 20, 26)
- **Current Implementation:** The primary authentication service (`authService.ts`), which is intended for the "robust" authentication flow, explicitly stores, retrieves, and removes the JSON Web Token from the browser's `localStorage`.
- **Attack Vector:** Cross-Site Scripting (XSS). If an attacker can inject any malicious JavaScript into the application (e.g., via a third-party library or user-generated content), they can steal the token from `localStorage` and send it to their own server. This allows them to completely impersonate the user, gaining full access to their account and data.
- **Fix Required:** The entire token management strategy must be refactored. The backend should set a secure, `HttpOnly`, `SameSite=Strict` cookie upon login. The frontend should be modified to make API calls without manually attaching an `Authorization` header, as the browser will automatically send the cookie. This will make the token inaccessible to client-side JavaScript, mitigating XSS-based token theft.
- **Code Example:**
  ```typescript
  // frontend/src/services/authService.ts
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY); // CRITICAL: Token is exposed
    } catch (error) {
      console.warn('Failed to access localStorage:', error);
      return null;
    }
  },

  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token); // CRITICAL: Token is stored insecurely
    } catch (error) {
      // ...
    }
  },
  ```

### [C-02] Application Uses Mocked/Broken Authentication Provider
- **Severity:** Critical
- **Location:** `frontend/src/main.tsx` (line 3), `frontend/src/contexts/AuthContext.tsx`
- **Current Implementation:** The application's main entry point (`main.tsx`) imports and uses `AuthProvider` from `AuthContext.tsx`. This provider is a non-functional, mocked-out placeholder that does not perform any real authentication against the backend.
- **Attack Vector:** This flaw renders the application's authentication system completely non-functional. While it doesn't directly create a remote vulnerability, it means there is no login mechanism, and any "protected" routes are likely not protected at all, or the application is in a permanently broken state. It completely negates the security model.
- **Fix Required:** The application must be re-wired to use the correct (and secured) authentication provider. The import in `main.tsx` should be pointed to the robust provider, and the legacy/mocked `AuthContext.tsx` should be deleted to prevent future confusion.
- **Code Example:**
  ```typescript
  // frontend/src/main.tsx
  import { AuthProvider } from './contexts/AuthContext'; // CRITICAL: Imports the mocked provider

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider> {/* This is the non-functional provider */}
        {/* ... */}
      </AuthProvider>
    </StrictMode>,
  );
  ```

### [C-03] No CSRF Protection on State-Changing Endpoints
- **Severity:** Critical
- **Location:** `backend/local_server.py` (all POST, PATCH, DELETE routes)
- **Current Implementation:** The backend API has no mechanism to defend against Cross-Site Request Forgery (CSRF). State-changing endpoints do not require a secret, user-specific token (anti-CSRF token) to be submitted with the request.
- **Attack Vector:** If an authenticated user (especially an admin) is tricked into visiting a malicious website, that site can forge a request to the application's backend (e.g., `<img src="http://localhost:3001/api/admin/appointments/123/move" />` for a GET, or a hidden form for a POST). If the application relies on cookies for authentication, the browser will automatically include the session cookie, and the backend will process the malicious request. This could allow an attacker to delete data, change statuses, or perform other destructive actions on behalf of the user.
- **Fix Required:** Implement the "Double Submit Cookie" or "Stateful" CSRF protection pattern.
    1. **On login**, the backend should generate a random, cryptographically secure anti-CSRF token.
    2. This token should be sent to the frontend as a regular, JavaScript-readable cookie.
    3. For every subsequent state-changing request (POST, PATCH, DELETE), the frontend must read this token from its cookie and include it in a custom HTTP header (e.g., `X-CSRF-Token`).
    4. The backend must verify that the token in the header matches the one associated with the user's session.

### [C-04] Critical Dependency Vulnerability (`form-data`)
- **Severity:** Critical
- **Location:** `frontend/package.json`
- **Current Implementation:** The project depends on a version of the `form-data` package with a known critical vulnerability.
- **Attack Vector:** The advisory GHSA-fjxv-7rqg-78g4 indicates the package uses an unsafe random function for choosing boundaries in multipart form data, which could lead to predictable boundaries and potential security bypasses.
- **Fix Required:** Run `npm audit fix` in the `frontend` directory to update the dependency to a patched version.

## ⚠️ HIGH - Fix Within 48 Hours
### [H-01] Missing Authentication on Sensitive API Endpoints
- **Severity:** High
- **Location:** `backend/local_server.py`
- **Current Implementation:** Several API endpoints that expose sensitive data or admin functionality have either optional or completely missing authentication checks.
- **Attack Vector:** An unauthenticated attacker can directly access sensitive information.
    - `/api/admin/appointments/board`: Exposes all appointment data.
    - `/api/admin/dashboard/stats`: Exposes business metrics.
    - `/api/customers/<customer_id>/history`: Exposes a customer's entire appointment history. (Auth is commented out).
- **Fix Required:** Remove the `try...except` blocks that make authentication optional. `require_auth_role()` should be called directly on all protected endpoints, ensuring an exception is thrown if a valid token is not provided. The commented-out authentication on the history and messages endpoints must be restored.
- **Code Example:**
  ```python
  # backend/local_server.py
  @app.route("/api/admin/appointments/board", methods=["GET"])
  def get_board():
      # optional auth in S1 — require a token but no strict role
      try:
          require_auth_role()  # HIGH: This should not be optional
      except Exception:
          pass
  ```

### [H-02] Missing Authorization (Role-Based Access Control)
- **Severity:** High
- **Location:** `backend/local_server.py`
- **Current Implementation:** Many endpoints that require authentication do not check for a specific user role. The `require_auth_role()` function is often called without a required role.
- **Attack Vector:** Any authenticated user, regardless of their role (e.g., a "Technician"), can potentially access endpoints intended only for "Owner" or "Advisor" roles. This could allow a low-privileged user to move appointments (`/api/admin/appointments/<id>/move`) or access other admin-level data.
- **Fix Required:** Every sensitive endpoint must perform a strict role check. For example, `require_auth_role("Owner")` or check if the user's role is in an allowed list `["Owner", "Advisor"]`.

## 🟡 MEDIUM - Fix This Sprint
### [M-01] Insecure Fallback JWT Secret
- **Severity:** Medium
- **Location:** `backend/local_server.py` (line 110)
- **Current Implementation:** The JWT secret is retrieved from an environment variable but falls back to the hardcoded, weak default `"dev-secret-do-not-use-in-prod"`.
- **Attack Vector:** If the `JWT_SECRET` environment variable is not set in a production or staging environment due to a configuration error, the application will run with a known, insecure secret. This would allow an attacker to forge valid JWTs for any user, granting them full access.
- **Fix Required:** The application should fail to start if the `JWT_SECRET` environment variable is not set or is set to the default weak value. Remove the fallback default from the `os.getenv` call and add a startup check.
- **Code Example:**
  ```python
  # backend/local_server.py
  JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-do-not-use-in-prod") // MEDIUM: Insecure fallback
  ```

### [M-02] Incomplete API Rate Limiting
- **Severity:** Medium
- **Location:** `backend/local_server.py`
- **Current Implementation:** A simple, in-memory rate limiter exists but is only applied to the `/move` and CSV export endpoints. It is not applied to computationally expensive endpoints or, most importantly, authentication endpoints like login and registration.
- **Attack Vector:** An attacker can perform brute-force or credential stuffing attacks against login endpoints without being blocked. They could also cause denial-of-service by repeatedly calling expensive, un-limited endpoints.
- **Fix Required:** Apply rate limiting to all sensitive and unauthenticated endpoints, especially `/customers/login` and `/customers/register`. The rate-limiting logic should also be moved to a more robust store like Redis instead of being in-memory, which doesn't scale and resets on restart.

### [M-03] Confusing Dual Authentication Implementations
- **Severity:** Medium
- **Location:** `frontend/src/contexts/`
- **Current Implementation:** Two conflicting `AuthContext` files exist: `AuthContext.tsx` (mocked, insecure) and `AuthContextRobust.tsx` (functional, but still insecure).
- **Attack Vector:** This leads to a high risk of developer error, where the wrong provider or hook might be used. It makes the codebase difficult to maintain and reason about. As demonstrated by the `main.tsx` finding, this risk has already been realized.
- **Fix Required:** After refactoring to a secure authentication pattern, the unused and insecure context files must be deleted. There should only be one clear, secure implementation.

## 🟢 LOW - Best Practices
### [L-01] Low-Severity Dependency Vulnerability (`@eslint/plugin-kit`)
- **Severity:** Low
- **Location:** `frontend/package.json`
- **Current Implementation:** A development dependency has a reported low-severity ReDoS (Regular Expression Denial of Service) vulnerability.
- **Attack Vector:** This vulnerability is in a development tool and is unlikely to affect the production application. However, it could potentially be triggered during the build process on a CI server by a malicious actor with commit access.
- **Fix Required:** Run `npm audit fix` in the `frontend` directory.

## 🔍 Detailed Findings

### Authentication Flow
- **Current Flow:** The application is configured to use a **mocked authentication provider** that does not perform real login/logout operations. A separate, "robust" implementation exists but is unused. This robust flow is also flawed, as it relies on storing JWTs in `localStorage` and sending them as Bearer tokens.
- **Token Storage:** `localStorage`. This is a critical vulnerability.
- **Issues Found:**
  - The entire authentication system is non-functional and insecure.
  - The `AGENTS.md` file is dangerously out of date, claiming a secure `HttpOnly` cookie implementation that does not exist.
  - The coexistence of two providers creates extreme confusion.
- **Recommendations:**
  1. **Immediate:** Switch the application to a "maintenance mode" or disable login functionality until fixed.
  2. **Highest Priority:** Refactor the entire auth flow to use secure, `HttpOnly` cookies for session management and implement anti-CSRF token protection.
  3. **Cleanup:** Delete `AuthContext.tsx`, `AuthContextRobust.tsx`, and `authService.ts`, replacing them with a single, secure context and service layer that works with the new cookie-based flow.

### API Security Status
| Endpoint | Method | CSRF | Auth | Rate Limit | Notes |
|----------|--------|------|------|------------|-------|
| /api/admin/appointments/board | GET | ❌ | ⚠️ (Optional) | ❌ | Exposes sensitive data to unauthenticated users. |
| /api/admin/appointments/move | PATCH | ❌ | ⚠️ (Optional) | ✅ | Missing role check. |
| /api/customers/:id/history | GET | ❌ | ❌ (Commented out) | ❌ | Exposes PII to unauthenticated users. |
| /api/admin/dashboard/stats | GET | ❌ | ⚠️ (Optional) | ❌ | Exposes business metrics. |
| /api/admin/reports/*.csv | GET | N/A | ✅ | ✅ | Correctly implemented auth and rate limiting. |
| /api/customers/login | POST | ❌ | N/A | ❌ | **CRITICAL:** Needs rate limiting to prevent brute-force attacks. |

### Secrets Exposure Risk
| Secret Type | Location | Exposure Risk | Fix Priority |
|-------------|----------|---------------|--------------|
| JWT_SECRET | `backend/local_server.py` | Medium | Medium |
| **Notes:** | The secret falls back to a known, weak default if the environment variable is not set. This is a high-impact risk if a deployment is misconfigured. The application should fail to start instead. |

### Dependency Vulnerabilities
| Package | Version | Vulnerability | Severity | Fix Available |
|---------|---------|--------------|----------|---------------|
| form-data | 4.0.0-4.0.3 | GHSA-fjxv-7rqg-78g4 | **Critical** | Yes (`npm audit fix`) |
| @eslint/plugin-kit | <0.3.4 | GHSA-xffm-g5w8-qvg7 | Low | Yes (`npm audit fix`) |

## 📊 Security Score
- **Overall Grade: F**
- **Critical Issues:** 4
- **High Issues:** 2
- **Medium Issues:** 3
- **Low Issues:** 1

## 🎯 Priority Fix Order
1.  **Stop the Bleeding:** Take the application offline or disable login. The current auth system is non-functional and gives a false sense of security.
2.  **Fix JWT Storage:** Immediately begin refactoring the entire authentication system.
    -   Modify the backend to set a secure, `HttpOnly` cookie on login.
    -   Remove all `localStorage` logic from the frontend (`authService.ts`).
    -   Remove the manual `Authorization: Bearer` header logic from API calls.
3.  **Implement CSRF Protection:** Add double-submit cookie or equivalent anti-CSRF protection to all backend state-changing endpoints.
4.  **Fix Broken Auth Provider:** Rewire `main.tsx` to use the new, secure auth provider and delete the unused/mocked/vulnerable context files.
5.  **Enforce Auth/Authz:** Add mandatory authentication and role-based authorization checks to all sensitive API endpoints.
6.  **Patch Dependencies:** Run `npm audit fix` in the frontend to resolve the critical vulnerability.
7.  **Add Rate Limiting:** Apply rate limiting to login and other sensitive endpoints.
8.  **Harden JWT Secret:** Make the backend fail to start if `JWT_SECRET` is not configured.
