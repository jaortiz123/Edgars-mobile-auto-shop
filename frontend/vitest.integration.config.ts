import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			'@/services': path.resolve(__dirname, './src/services'),
			'@/components': path.resolve(__dirname, './src/components'),
		}
	},
	test: {
		environment: 'jsdom',
		setupFiles: ['src/tests/preActEnv.ts','src/tests/setup.ts'],
		include: ['src/tests/integration/**/*.it.tsx'],
		exclude: [
			'**/node_modules/**',
			'**/dist/**',
		],
		testTimeout: 15000,
		hookTimeout: 15000,
		globals: true,
	}
});
