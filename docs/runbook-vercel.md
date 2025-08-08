### Vercel Deployment Runbook (Frontend)

- Node version: 18.x
- Build command: `cd frontend && npm ci && npm run build`
- Output directory: `frontend/dist`
- Framework: Vite

Required environment variables
- `VITE_API_URL`: Base URL for auth service (used in `frontend/src/services/authService.ts`)
- `VITE_API_ENDPOINT_URL`: Base URL for API endpoints (used in `frontend/src/services/apiService.ts`)

Notes
- Local defaults exist (`http://localhost:3001` or `http://localhost:5001`), but production must set the `VITE_*` env vars.
- CI runs a build to validate: see `.github/workflows/frontend-build.yml`.
- TypeScript errors are checked in a separate CI job: `.github/workflows/frontend-typecheck.yml`.


