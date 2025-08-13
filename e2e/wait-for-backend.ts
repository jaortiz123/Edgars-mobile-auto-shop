import axios from 'axios';
const MAX_RETRIES = 10;
const URL = 'http://localhost:3001/health';

async function wait() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    console.log(`Attempt ${i + 1}`);
    try {
      const res = await axios.get(URL);
      console.log('Health check successful');
      return;
    } catch (e) {
      console.log(e.message);
    }
    await new Promise(res => setTimeout(res, 2000));
  }
  const { execSync } = require('child_process');
  execSync('docker-compose logs backend > e2e/backend-failure.log');
  throw new Error('Backend not healthy');
}
export default wait;
