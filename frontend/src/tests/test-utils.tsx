import { ReactElement, ReactNode } from 'react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { AuthProvider } from '@/contexts/AuthContextRobust';

interface RouterOptions {
  initialEntries?: string[];
}

function Providers({ children, router }: { children: ReactNode; router?: RouterOptions }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const RouterComponent = router ? MemoryRouter : BrowserRouter;
  const routerProps = router?.initialEntries ? { initialEntries: router.initialEntries } : undefined;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterComponent {...routerProps}>{children}</RouterComponent>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export * from '@testing-library/react';

export function render(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { router?: RouterOptions },
) {
  const { router, ...renderOptions } = options ?? {};
  return rtlRender(ui, {
    wrapper: ({ children }) => <Providers router={router}>{children}</Providers>,
    ...renderOptions,
  });
}
