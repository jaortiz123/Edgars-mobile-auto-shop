import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppointmentProvider } from '@/contexts/AppointmentContext';

export function appRender(ui: React.ReactElement) {
  return render(
    <ToastProvider>
      <AuthProvider>
        <AppointmentProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </AppointmentProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
// Provide default export to avoid import mistakes
export default appRender
