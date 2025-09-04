import { QueryClient } from '@tanstack/react-query';

// Dedicated QueryClient for tests with retries disabled for deterministic error-path testing
export const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      // Use gcTime instead of deprecated cacheTime
      gcTime: 0,
      staleTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
});

// Utility to clear the cache before each test render
export function clearTestQueryClient() {
  testQueryClient.clear();
}
