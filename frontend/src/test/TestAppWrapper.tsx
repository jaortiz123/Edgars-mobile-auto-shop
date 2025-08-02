/**
 * P2-T-006: TestAppWrapper - Isolated Provider Testing Component
 * 
 * Provides a minimal app wrapper for integration testing that includes
 * all necessary providers without the overhead of full app rendering.
 * This enables true integration testing while maintaining isolation.
 */

import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import ToastProvider from '@/components/ToastProvider';
import { testQueryClient, clearTestQueryClient } from '@/lib/test-query-client';

/**
 * Configuration for the test app wrapper
 */
interface TestAppWrapperProps {
  children: React.ReactNode;
  /** Custom QueryClient for testing (optional) */
  queryClient?: QueryClient;
  /** Initial route for the router (default: '/') */
  initialRoute?: string;
  /** Whether to include auth provider (default: true) */
  includeAuth?: boolean;
  /** Whether to include notification provider (default: true) */
  includeNotifications?: boolean;
}

/**
 * Minimal app wrapper for integration testing.
 * 
 * This component provides all the essential providers needed for integration testing
 * without the complexity of the full app structure. It's designed to:
 * 
 * - Include all necessary React contexts (Auth, Notifications, Query)
 * - Provide router functionality for navigation testing
 * - Use optimized settings for test performance
 * - Allow customization of providers for specific test scenarios
 * 
 * @example
 * ```tsx
 * // Basic usage
 * render(
 *   <TestAppWrapper>
 *     <ComponentUnderTest />
 *   </TestAppWrapper>
 * );
 * 
 * // With custom route
 * render(
 *   <TestAppWrapper initialRoute="/appointments">
 *     <AppointmentPage />
 *   </TestAppWrapper>
 * );
 * 
 * // With custom QueryClient for advanced testing
 * const queryClient = new QueryClient({ ... });
 * render(
 *   <TestAppWrapper queryClient={queryClient}>
 *     <ComponentUnderTest />
 *   </TestAppWrapper>
 * );
 * ```
 */
export function TestAppWrapper({
  children,
  queryClient,
  initialRoute = '/',
  includeAuth = true,
  includeNotifications = true,
}: TestAppWrapperProps) {
  // Always use the dedicated testQueryClient for tests unless a custom one is provided
  const client = queryClient || testQueryClient;

  // Clear the test query client cache before each render for isolation
  clearTestQueryClient();

  // Set initial route if specified
  if (initialRoute !== '/' && typeof window !== 'undefined') {
    window.history.pushState({}, '', initialRoute);
  }

  // Build the provider tree based on configuration
  let content = children;

  // Wrap with QueryClient (always included)
  content = (
    <QueryClientProvider client={client}>
      {content}
    </QueryClientProvider>
  );

  // Wrap with ToastProvider if enabled (replacing NotificationProvider)
  if (includeNotifications) {
    content = (
      <ToastProvider>
        {content}
      </ToastProvider>
    );
  }

  // Wrap with AuthProvider if enabled
  if (includeAuth) {
    content = (
      <AuthProvider>
        {content}
      </AuthProvider>
    );
  }

  // Wrap with Router (always included for navigation)
  content = (
    <BrowserRouter>
      {content}
    </BrowserRouter>
  );

  return <>{content}</>;
}

/**
 * Hook to create a test QueryClient with custom configuration
 */
export function useTestQueryClient(config?: Partial<QueryClient['defaultOptions']>): QueryClient {
  return React.useMemo(() => {
    return new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          networkMode: 'always',
          ...config?.queries,
        },
        mutations: {
          retry: false,
          networkMode: 'always',
          ...config?.mutations,
        },
      },
    });
  }, [config]);
}

/**
 * Utility function to render components with TestAppWrapper.
 * Provides a convenient shorthand for common testing patterns.
 * 
 * @param component - The component to render
 * @param wrapperProps - Props for the TestAppWrapper
 * @returns The render result from testing-library
 */
export function renderWithTestWrapper(
  component: React.ReactElement,
  wrapperProps?: Omit<TestAppWrapperProps, 'children'>
) {
  // This function would typically use testing-library's render,
  // but since we don't want to import it here (to avoid circular dependencies),
  // we return a wrapper function that can be used with render()
  
  return {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <TestAppWrapper {...wrapperProps}>
        {children}
      </TestAppWrapper>
    ),
    component,
  };
}

/**
 * Type exports for use in test files
 */
export type { TestAppWrapperProps };
