import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContextRobust';
import { BoardStoreProvider } from './state/BoardStoreProvider';
import { ToastProvider } from './components/ui/Toast';
import { ConflictProvider } from './conflict/ConflictProvider';
import App from './App';
import { BookingDrawerProvider } from './contexts/BookingDrawerContext';
import './index.css';
import { initAdaptiveLongTaskObserver } from './utils/longTaskSampler';
import axios from 'axios';

// Initialize adaptive long task observer (Phase A). Telemetry pipeline hook TBD.
if (typeof window !== 'undefined') {
  initAdaptiveLongTaskObserver((entry, meta) => {
    if (import.meta.env.DEV) {
      console.debug('[perf] longtask sampled', {
        duration: entry.duration,
        startTime: entry.startTime,
        rate: meta.rate,
        budgetBurn: meta.budgetBurn,
      });
    }
  });
}

// Start MSW in development if enabled via env flag
declare global { interface Window { ENABLE_MSW?: boolean; Playwright?: unknown } }
// Disable MSW during Playwright E2E (navigator.webdriver true) or when explicitly disabled
if (
  import.meta.env.DEV &&
  window.ENABLE_MSW !== false &&
  typeof navigator !== 'undefined' &&
  !(navigator.webdriver || (window as any).Playwright)
) {
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
        <ConflictProvider>
          <ToastProvider>
            <BoardStoreProvider>
              <BookingDrawerProvider>
                <App />
              </BookingDrawerProvider>
            </BoardStoreProvider>
          </ToastProvider>
        </ConflictProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);

// Proactively set CSRF cookie so axios can include X-CSRF-Token on unsafe requests
void (async () => {
  try {
    await axios.get('/api/csrf-token', { withCredentials: true });
  } catch {
    // non-fatal during initial load
  }
})();
