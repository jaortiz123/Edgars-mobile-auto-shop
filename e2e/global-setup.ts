import axios from 'axios'
import fs from 'fs'
import path from 'path'
import wait from './wait-for-backend'
import { ensureDockerRunning } from './check-docker'

// Check Docker availability before starting tests
ensureDockerRunning()

export default async function globalSetup() {
  await wait()

  // Targeted readiness: poll the profile alias endpoint until it stops returning 404.
  // We accept 200/401/403 as "ready" because the route exists; 404 indicates Flask
  // app hasn't fully registered blueprints yet or a stale process is being replaced.
  const profileUrl = process.env.PROFILE_READINESS_URL || 'http://localhost:3001/api/customers/profile'
  const maxAttempts = parseInt(process.env.PROFILE_READINESS_ATTEMPTS || '20', 10)
  const delayMs = parseInt(process.env.PROFILE_READINESS_DELAY_MS || '500', 10)
  const tenantId = process.env.E2E_TENANT_ID || '00000000-0000-0000-0000-000000000001'

  let successStreak = 0
  let ready = false
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await axios.get(profileUrl, {
        timeout: 1500,
        headers: { Origin: 'http://localhost:5173', Authorization: 'Bearer dummy-token', 'X-Tenant-Id': tenantId }
      })
      if (res.status !== 404 && res.status < 500) {
        successStreak += 1
        console.log(`[global-setup] Profile readiness success (#${successStreak}) status ${res.status} on attempt ${attempt}`) // eslint-disable-line no-console
        if (successStreak >= 2) { ready = true; break }
      } else {
        successStreak = 0
        console.log(`[global-setup] Profile readiness attempt ${attempt}: status ${res.status} (reset streak)`) // eslint-disable-line no-console
      }
    } catch (err: any) {
      const status = err?.response?.status
      if (status && status !== 404 && status < 500) {
        successStreak += 1
        console.log(`[global-setup] Profile readiness success via error path (#${successStreak}) status ${status} on attempt ${attempt}`) // eslint-disable-line no-console
        if (successStreak >= 2) { ready = true; break }
      } else {
        successStreak = 0
        console.log(`[global-setup] Profile readiness attempt ${attempt} failed: ${status || err.message}`) // eslint-disable-line no-console
      }
    }
    if (attempt === maxAttempts) {
      console.warn('[global-setup] Profile readiness timed out; proceeding (tests may see early 404)') // eslint-disable-line no-console
      break
    }
    await new Promise(r => setTimeout(r, delayMs))
  }
  if (ready) {
    await new Promise(r => setTimeout(r, 2000)) // stabilization delay increased for backend initialization
    console.log('[global-setup] Stabilization delay complete (2000ms)') // eslint-disable-line no-console
  }

  // Single-source auth: perform advisor (admin) login only and persist token.
  // This avoids mixed customer/admin tokens racing in localStorage, which caused intermittent 403s.
  try {
    const adminLogin = await axios.post(
      'http://localhost:3001/api/admin/login',
      { username: 'advisor', password: 'dev' },
      { headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId } }
    )
    const adminToken: string | undefined = adminLogin.data?.data?.token
    if (!adminToken) {
      console.warn('[global-setup] Admin login succeeded but no token found in response') // eslint-disable-line no-console
      return
    }

    // Ensure staff membership for advisor in target tenant so membership checks pass
    try {
      await axios.post(
        'http://localhost:3001/api/admin/staff/memberships',
        { staff_id: 'advisor', tenant_id: tenantId, role: 'Advisor' },
        { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'X-Tenant-Id': tenantId } }
      )
      console.log('[global-setup] Ensured staff membership for advisor in tenant', tenantId) // eslint-disable-line no-console
    } catch (mErr: any) {
      console.warn('[global-setup] Could not ensure staff membership (proceeding):', mErr?.message || mErr) // eslint-disable-line no-console
    }
    const storageState = {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:5173',
          localStorage: [
            { name: 'auth_token', value: adminToken },
            { name: 'tenant_id', value: tenantId },
            { name: 'viewMode', value: 'board' }
          ]
        }
      ]
    }
    const outPath = path.join(process.cwd(), 'e2e', 'storageState.json')
    fs.writeFileSync(outPath, JSON.stringify(storageState, null, 2))
    console.log('[global-setup] Wrote storage state with advisor auth token to', outPath) // eslint-disable-line no-console
  } catch (e: any) {
    console.warn('[global-setup] Advisor auth setup failed:', e?.message || e) // eslint-disable-line no-console
  }
}
