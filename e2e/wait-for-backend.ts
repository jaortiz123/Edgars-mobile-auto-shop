import axios from 'axios';
const MAX_RETRIES = 10;
const URL = 'http://localhost:5001/health';

async function wait() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await axios.get(URL);
      if (res.data.db === 'connected') return;
    } catch {}
    await new Promise(res => setTimeout(res, 2000));
  }
  const { execSync } = require('child_process');
  execSync('docker-compose -f mobile-auto-shop/docker-compose.yml logs backend > e2e/backend-failure.log');
  throw new Error('Backend not healthy');
}
export default wait;
