import React from 'react';
import { render } from '@testing-library/react';
import { expect, describe, it } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Dashboard } from '@/admin/Dashboard';
import StatusBoard from '@/components/admin/StatusBoard';
import AppointmentDrawer from '@/components/admin/AppointmentDrawer';
import { AppointmentProvider } from '@/contexts/AppointmentContext';

expect.extend(toHaveNoViolations);

describe('Accessibility', () => {
  it('should have no accessibility violations in the Dashboard component', async () => {
    const { container } = render(
      <AppointmentProvider>
        <Dashboard />
      </AppointmentProvider>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations in the StatusBoard component', async () => {
    const { container } = render(
      <AppointmentProvider>
        <StatusBoard onOpen={() => {}} />
      </AppointmentProvider>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations in the AppointmentDrawer component', async () => {
    const { container } = render(
      <AppointmentProvider>
        <AppointmentDrawer
          appointmentId="1"
          isOpen={true}
          onClose={() => {}}
        />
      </AppointmentProvider>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
