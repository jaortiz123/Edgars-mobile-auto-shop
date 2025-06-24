import { test, expect } from '@playwright/test'

test('admin can login and access protected route', async ({ request }) => {
  const res = await request.post('http://localhost:5001/admin/login', {
    form: {
      username: 'admin',
      password: 'secret',
    },
  })
  expect(res.status()).toBe(200)
  const cookies = await request.storageState()
  expect(cookies.cookies.some(c => c.name === 'authToken')).toBe(true)

  const authRes = await request.get('http://localhost:5001/admin/me')
  expect(authRes.status()).toBe(200)
})
