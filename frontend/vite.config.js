import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                secure: false,
                rewrite: function (path) { return path.replace(/^\/api/, ''); },
            },
        },
    },
    test: {
        environment: 'jsdom',
    },
    build: {
        rollupOptions: {
            plugins: [visualizer({ filename: 'dist/stats.html', open: false })],
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom', 'react-router-dom'],
                    forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
                    ui: ['lucide-react', 'class-variance-authority'],
                },
            },
        },
    },
});
