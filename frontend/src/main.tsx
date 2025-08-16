import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContextRobust';
import { BoardStoreProvider } from './state/BoardStoreProvider';
import { ToastProvider } from './components/ui/Toast';
import App from './App';
import { BookingDrawerProvider } from './contexts/BookingDrawerContext';
import './index.css';

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