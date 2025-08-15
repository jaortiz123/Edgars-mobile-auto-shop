import axios from 'axios'
import fs from 'fs'
import path from 'path'
import wait from './wait-for-backend'
import { ensureDockerRunning } from './check-docker'

// Check Docker availability before starting tests
ensureDockerRunning()

export default async function globalSetup() {
  await wait()

  // Perform real login to obtain token
  try {
    const res = await axios.post('http://localhost:3001/api/admin/login', { username: 'advisor', password: 'dev' }, { headers: { 'Content-Type': 'application/json' } })
    if (res.status === 200 && res.data?.data?.token) {
      const token: string = res.data.data.token
      // Build minimal storageState with localStorage seeded
      const storageState = {
        cookies: [],
        origins: [
          {
            origin: 'http://localhost:5173',
            localStorage: [
              { name: 'auth_token', value: token }
            ]
          }
        ]
      }
      const outPath = path.join(process.cwd(), 'e2e', 'storageState.json')
      fs.writeFileSync(outPath, JSON.stringify(storageState, null, 2))
      // eslint-disable-next-line no-console
      console.log('[global-setup] Wrote storage state with auth token to', outPath)
    } else {
      // eslint-disable-next-line no-console
      console.warn('[global-setup] Login did not return token; tests requiring auth may fail')
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[global-setup] Login request failed:', (e as Error).message)
  }
}
