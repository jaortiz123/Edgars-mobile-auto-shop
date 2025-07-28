import React from 'react';
import { appRender as render } from '@/tests/render';
import { expect, describe, it, vi } from 'vitest';
import { axe } from 'jest-axe';
import { Dashboard } from '@/admin/Dashboard';
import StatusBoard from '@/components/admin/StatusBoard';
import AppointmentDrawer from '@/components/admin/AppointmentDrawer';

// Use centralized API mocks
vi.mock('@/lib/api', async () => await import('./__mocks__/api'));

describe('Accessibility', () => {
  it('should have no accessibility violations in the Dashboard component', async () => {
    const { container } = render(<Dashboard />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations in the StatusBoard component', async () => {
    const { container } = render(<StatusBoard onOpen={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations in the AppointmentDrawer component', async () => {
    const { container } = render(<AppointmentDrawer id="1" open={true} onClose={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
