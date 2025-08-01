/**
 * Phase 2 Task 1: Integration Test Utilities
 * 
 * Helper functions for integration testing that render the full React app
 * with all necessary providers.
 */

import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import ToastProvider from '../components/ToastProvider';
import App from '../App';

// Create a custom render function that includes all providers
interface IntegrationRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
  queryClient?: QueryClient;
}

/**
 * Renders the full App component with all necessary providers for integration testing.
 * This simulates the real application environment.
 * 
 * @param options - Rendering options including initial route
 * @returns Render result from React Testing Library
 */
export function renderWithProviders(options: IntegrationRenderOptions = {}) {
  const {
    initialRoute = '/',
    ...renderOptions
  } = options;

  // Set initial route if specified and if we're in a browser environment
  if (initialRoute !== '/' && typeof window !== 'undefined' && window.history) {
    window.history.pushState({}, 'Test page', initialRoute);
  }

  // Create the App wrapper to ensure proper provider setup
  function TestAppWrapper() {
    return <App />;
  }

  // Render the App component which already includes all necessary providers
  return render(<TestAppWrapper />, renderOptions);
}

/**
 * Renders a specific component with all necessary providers.
 * Useful for testing individual components in isolation but with full context.
 * 
 * @param component - The component to render
 * @param options - Rendering options
 * @returns Render result from React Testing Library
 */
export function renderComponentWithProviders(
  component: React.ReactElement,
  options: IntegrationRenderOptions = {}
) {
  const {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0, // Updated from cacheTime for React Query v5
          staleTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    }),
    ...renderOptions
  } = options;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AuthProvider>
        <ToastProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              {children}
            </BrowserRouter>
          </QueryClientProvider>
        </ToastProvider>
      </AuthProvider>
    );
  }

  return render(component, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Creates a fresh QueryClient for each test to avoid state pollution.
 * 
 * @returns A new QueryClient configured for testing
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0, // Updated from cacheTime for React Query v5
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Utility to simulate user authentication for integration tests.
 * Sets up mock JWT token and user context.
 * 
 * @param role - User role (Owner, Advisor, Tech)
 * @param userId - User ID
 */
export function mockAuthentication(role: string = 'Owner', userId: string = 'test-user') {
  // Mock JWT token
  const mockToken = btoa(JSON.stringify({
    sub: userId,
    role: role,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  }));

  // Set in localStorage (simulating login)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('auth_token', mockToken);
  }

  return { token: mockToken, userId, role };
}

/**
 * Clears authentication state for tests.
 */
export function clearAuthentication() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('auth_token');
  }
}

// Export commonly used testing utilities
export {
  waitFor,
  screen,
  act,
  fireEvent,
} from '@testing-library/react';

import userEventLib from '@testing-library/user-event';
export const userEvent = userEventLib;
