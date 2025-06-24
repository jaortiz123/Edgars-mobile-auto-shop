import axios from 'axios'
import { execSync } from 'child_process'
import wait from './wait-for-backend'

try {
  execSync('docker info', { stdio: 'ignore' })
} catch {
  throw new Error('Docker is not running.')
}

export default async function globalSetup() {
  await wait()
  await axios.post('http://localhost:5001/debug/reset-and-seed')
}
