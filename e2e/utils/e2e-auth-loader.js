/**
 * PHASE 2: Auth Context Loader for E2E Tests
 * Loads the auth context from global-setup.ts and exposes it globally
 * for the axios interceptor to use during initial page loads
 */

// Load auth context from file and expose globally
try {
  const fs = require('fs');
  const path = require('path');
  const authContextPath = path.join(process.cwd(), 'e2e', 'authContext.json');

  if (fs.existsSync(authContextPath)) {
    const authContext = JSON.parse(fs.readFileSync(authContextPath, 'utf8'));

    // Expose globally for axios interceptor
    window.__E2E_AUTH_CONTEXT__ = authContext;

    console.log('[e2e-auth] Loaded E2E auth context:', {
      hasToken: !!authContext.token,
      tenantId: authContext.tenantId,
      timestamp: authContext.timestamp
    });
  } else {
    console.warn('[e2e-auth] No auth context file found at:', authContextPath);
  }
} catch (error) {
  console.warn('[e2e-auth] Failed to load auth context:', error);
}
