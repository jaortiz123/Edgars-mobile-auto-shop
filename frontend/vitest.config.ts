import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  // ✅ A SINGLE, CORRECT ALIAS CONFIGURATION
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  test: {
    // ✅ SET THE ENVIRONMENT TO JSDOM FOR ALL TESTS.
    // This is the most critical fix.
    environment: 'jsdom',
    
    // ✅ Point to a single, reliable setup file.
    setupFiles: ['src/tests/setup.ts'],
    
    // ✅ Globals are needed for libraries like testing-library
    globals: true,
    
    // ✅ Exclude archived tests from execution
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/archived/**',
      '**/src/tests/archived/**'
    ],
    
    // Optional: Keep CSS processing if your components import CSS files
    css: true,
  },
});
