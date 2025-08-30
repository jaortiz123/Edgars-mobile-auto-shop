import { test, expect } from '@playwright/test'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

async function getCookie(page, name: string) {
  const cookies = await page.context().cookies()
  const c = cookies.find(c => c.name === name)
  return c?.value
}

test('cookie auth + CSRF blocks/permits state-changing requests', async ({ page }) => {
  // Navigate to app origin so relative requests work
  await page.goto('/')

  // Login as advisor (sets HttpOnly auth cookie + XSRF-TOKEN cookie)
  await page.evaluate(async () => {
    await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'advisor', password: 'pw' }),
    })
  })

  // Ensure XSRF-TOKEN cookie exists
  // If not, hit csrf-token endpoint to bootstrap
  let xsrf = await getCookie(page, 'XSRF-TOKEN')
  if (!xsrf) {
    await page.evaluate(async () => { await fetch('/api/csrf-token', { credentials: 'include' }) })
    xsrf = await getCookie(page, 'XSRF-TOKEN')
  }
  expect(xsrf).toBeTruthy()

  // Seed staff membership for default tenant (requires CSRF header)
  await page.evaluate(async (tenantId: string, csrf: string) => {
    await fetch('/api/admin/staff/memberships', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
      body: JSON.stringify({ staff_id: 'advisor', tenant_id: tenantId, role: 'Advisor' }),
    })
  }, DEFAULT_TENANT_ID, xsrf)

  // Attempt to POST without CSRF header → expect 403
  const statusNoCsrf = await page.evaluate(async (tenantId: string) => {
    const r = await fetch('/api/admin/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
      body: JSON.stringify({ status: 'SCHEDULED', start: '2025-01-01T10:00:00Z' }),
    })
    return r.status
  }, DEFAULT_TENANT_ID)
  expect(statusNoCsrf).toBe(403)

  // Same POST with CSRF header → expect not 403 (could be 201 or 400 depending on payload)
  const statusWithCsrf = await page.evaluate(async (tenantId: string, csrf: string) => {
    const r = await fetch('/api/admin/appointments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
        'X-CSRF-Token': csrf,
      },
      body: JSON.stringify({ status: 'SCHEDULED', start: '2025-01-01T10:00:00Z' }),
    })
    return r.status
  }, DEFAULT_TENANT_ID, xsrf)
  expect([200, 201, 400]).toContain(statusWithCsrf)
})
