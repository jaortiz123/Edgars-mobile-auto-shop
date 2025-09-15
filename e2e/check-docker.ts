import { execSync } from 'child_process';

export function ensureDockerRunning() {
  if (process.env.SKIP_DOCKER_CHECK?.toLowerCase() === 'true') {
    console.log('⚠️  Skipping Docker check (SKIP_DOCKER_CHECK=true)');
    return;
  }
  try {
    execSync('docker info', { stdio: 'ignore' });
    console.log('✅ Docker daemon is running');
  } catch (e) {
    console.error('❌ Docker is not running. Start Docker and retry.');
    process.exit(1);
  }
}
