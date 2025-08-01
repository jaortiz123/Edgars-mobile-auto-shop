/**
 * Phase 2 Task 1: Integration Test Setup
 * 
 * Setup configuration for integration tests that use MSW to mock HTTP calls
 * and render the full React application.
 */

import { beforeAll, afterEach, afterAll } from 'vitest';
import { server, resetMockData } from './server/mswServer';

// Integration test setup with MSW lifecycle management
beforeAll(() => {
  console.log('🚀 Starting MSW server for integration tests...');
  
  // Start the server before all tests
  server.listen({
    onUnhandledRequest: 'warn', // Warn about unhandled requests instead of erroring
  });
  
  console.log('🌐 MSW enabled for integration tests');
});

// Reset handlers after each test to ensure test isolation
afterEach(() => {
  // Reset any request handlers that may have been added during tests
  server.resetHandlers();
  
  // Reset mock data to initial state
  resetMockData();
  
  // Clear any DOM that might be left over from React Testing Library
  if (typeof document !== 'undefined') {
    document.body.innerHTML = '';
  }
});

// Clean up after all tests are done
afterAll(() => {
  console.log('🛑 Stopping MSW server...');
  server.close();
});

// Export for potential use in individual test files
export { server };
