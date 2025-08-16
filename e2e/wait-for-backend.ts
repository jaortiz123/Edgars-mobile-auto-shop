import axios from 'axios';
import { execSync } from 'child_process';

// Allow overriding retries via env; default high enough to cover cold start (pip install)
const MAX_RETRIES = parseInt(process.env.BACKEND_MAX_RETRIES || '40', 10);
const URL = process.env.BACKEND_HEALTH_URL || 'http://localhost:3001/health';

async function wait() {
  // Proactively ensure the backend container is up (idempotent if already running)
  try {
    console.log('[wait-for-backend] Ensuring backend container is running...');
    execSync('docker-compose up -d backend', { stdio: 'inherit' });
  } catch (e) {
    console.warn('[wait-for-backend] docker-compose up failed (continuing):', (e as Error).message);
  }

  for (let i = 0; i < MAX_RETRIES; i++) {
    console.log(`[wait-for-backend] Attempt ${i + 1}/${MAX_RETRIES}`);
    try {
      await axios.get(URL, { timeout: 2000 });
      console.log('[wait-for-backend] Health check successful');
      return;
    } catch (e) {
      const msg = (e as Error).message;
      console.log(`[wait-for-backend] Not ready yet: ${msg}`);
    }
    await new Promise(res => setTimeout(res, 2000));
  }
  try {
    execSync('docker-compose logs backend > e2e/backend-failure.log || docker compose logs backend > e2e/backend-failure.log');
  } catch (e) {
    console.warn('[wait-for-backend] Failed to capture backend logs:', (e as Error).message);
  }
  throw new Error('Backend not healthy');
}
export default wait;
