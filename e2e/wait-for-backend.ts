import axios from 'axios';
const MAX_RETRIES = 10;
const URL = 'http://localhost:3001/health';

async function wait() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await axios.get(URL);
      if (res.data.status === 'ok') return;
    } catch {}
    await new Promise(res => setTimeout(res, 2000));
  }
  const { execSync } = require('child_process');
  execSync('docker-compose logs backend > e2e/backend-failure.log');
  throw new Error('Backend not healthy');
}
export default wait;
