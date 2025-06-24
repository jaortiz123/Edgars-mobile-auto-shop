import { execSync } from 'child_process';

export function ensureDockerRunning() {
  try {
    execSync('docker info', { stdio: 'ignore' });
    console.log('✅ Docker daemon is running');
  } catch (e) {
    console.error('❌ Docker is not running. Start Docker and retry.');
    process.exit(1);
  }
}
