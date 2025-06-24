import axios from 'axios'
import wait from './wait-for-backend'

export default async function globalSetup() {
  await wait()
  await axios.post('http://localhost:5001/debug/reset-db')
  await axios.post('http://localhost:5001/debug/seed')
}
