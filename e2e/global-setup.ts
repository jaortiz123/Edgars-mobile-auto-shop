import axios from 'axios'
import { execSync } from 'child_process'
import wait from './wait-for-backend'
import { ensureDockerRunning } from './check-docker'

// Check Docker availability before starting tests
ensureDockerRunning()

export default async function globalSetup() {
  await wait()
  // Skip reset-and-seed for now as endpoint doesn't exist
  // await axios.post('http://localhost:3001/debug/reset-and-seed')
}
