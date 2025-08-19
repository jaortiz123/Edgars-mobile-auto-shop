### Vercel Env Inventory (Frontend)

- VITE_API_URL
  - Where: `frontend/src/services/authService.ts`
  - Purpose: Base URL for auth endpoints
  - Type: Build-time (injected via Vite `import.meta.env`)
  - Runtime default: `http://localhost:5001` (dev)

- VITE_API_ENDPOINT_URL
  - Where: `frontend/src/services/apiService.ts`
  - Purpose: Base URL for app API endpoints
  - Type: Build-time (injected via Vite `import.meta.env`)
  - Runtime default: none (should be set)

- NODE_ENV
  - Where: multiple files (dev/prod guards)
  - Purpose: Feature gates for debug/dev-only logic
  - Type: Runtime (set by platform; Vercel sets to `production`)

Test-only variables (not required in Vercel)
- CI, VITEST_STRICT_CONSOLE, VITEST, SECRET, VITE_API_BASE_URL, VITE_APP_ENV
  - Where: test setup and specs under `frontend/src/tests/**`
  - Purpose: test harness configuration
  - Type: Test runtime only
