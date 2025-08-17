import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContextRobust';
import { BoardStoreProvider } from './state/BoardStoreProvider';
import { ToastProvider } from './components/ui/Toast';
import App from './App';
import { BookingDrawerProvider } from './contexts/BookingDrawerContext';
import './index.css';

// Start MSW in development if enabled via env flag
declare global { interface Window { ENABLE_MSW?: boolean } }
if (import.meta.env.DEV && window.ENABLE_MSW !== false) {
  // Dynamic import to avoid bundling for production
  import('./mocks/browser').then(({ worker }) => {
    worker.start({ onUnhandledRequest: 'bypass' });
    console.log('[MSW] Service Worker started (dev)');
  }).catch(err => console.warn('MSW startup failed', err));
}

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BoardStoreProvider>
            <BookingDrawerProvider>
              <App />
            </BookingDrawerProvider>
          </BoardStoreProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);