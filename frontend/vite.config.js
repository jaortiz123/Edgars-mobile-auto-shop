import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            // Add explicit aliases for problem paths
            "@/contexts": path.resolve(__dirname, "./src/contexts"),
            "@/hooks": path.resolve(__dirname, "./src/hooks"),
            "@/lib": path.resolve(__dirname, "./src/lib"),
            "@/components": path.resolve(__dirname, "./src/components"),
        },
    },
    server: {
        port: 5173,
        host: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
    test: {
        environment: 'jsdom',
        setupFiles: 'src/tests/setup.ts',
        globals: true,
        css: true,
        restoreMocks: true,
        coverage: {
            provider: 'v8',
            reportsDirectory: 'coverage',
            reporter: ['text', 'lcov'],
            include: ['src/tests/**/*.{ts,tsx}'],
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100,
        },
    },
});
