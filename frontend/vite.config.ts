import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
  build: {
    rollupOptions: {
      plugins: [visualizer({ filename: 'dist/stats.html', open: false })],
    },
  },
})
