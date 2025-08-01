import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { Dashboard } from '../admin/Dashboard';
import { AppointmentProvider } from '../contexts/AppointmentProvider';
import { startMockServer, stopMockServer, resetMockState } from './msw/mswServer';

// Set up MSW for this test
beforeAll(async () => {
  console.log('🚀 Starting MSW server for debug test...');
  await startMockServer();
});

afterAll(async () => {
  console.log('🛑 Stopping MSW server...');
  await stopMockServer();
});

beforeEach(() => {
  resetMockState();
});

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <AppointmentProvider>
        {children}
      </AppointmentProvider>
    </BrowserRouter>
  );
}

describe('Debug Add Service Form', () => {
  it('should show add service form when clicking Add Service button', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    console.log('🔍 Test started - waiting for dashboard to load...');

    // Wait for dashboard to load
    await waitFor(() => {
      expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
      expect(screen.getByText(/happy path customer/i)).toBeInTheDocument();
    }, { timeout: 10000 });

    console.log('✅ Dashboard loaded with board view');

    // Click on appointment card to open drawer
    const appointmentCard = screen.getByText(/happy path customer/i);
    await user.click(appointmentCard);
    
    console.log('📌 Clicked appointment card');

    // Wait for drawer to open
    await waitFor(() => {
      expect(screen.getByTestId('drawer-open')).toBeInTheDocument();
    }, { timeout: 5000 });

    console.log('✅ Drawer opened');

    // Click Services tab
    const drawer = screen.getByTestId('drawer-open');
    const tablist = within(drawer).getByRole('tablist');
    const servicesTab = within(tablist).getByRole('tab', { name: /services/i });
    
    await user.click(servicesTab);
    console.log('📌 Clicked Services tab');

    // Wait for services content to load
    await waitFor(() => {
      const addServiceButton = within(drawer).queryByTestId('add-service-button');
      expect(addServiceButton).toBeInTheDocument();
    }, { timeout: 5000 });

    console.log('✅ Services tab loaded');

    // Debug: Show current drawer content
    console.log('🔍 Drawer content before clicking Add Service:');
    console.log('  Content:', drawer.innerHTML.slice(0, 1000) + '...');

    // Click Add Service button
    const addServiceButton = within(drawer).getByTestId('add-service-button');
    await user.click(addServiceButton);
    
    console.log('📌 Clicked Add Service button');

    // Debug: Show drawer content after clicking
    console.log('🔍 Drawer content AFTER clicking Add Service:');
    console.log('  Content:', drawer.innerHTML.slice(0, 2000) + '...');

    // Check if form appears
    const form = within(drawer).queryByTestId('add-service-form');
    console.log('🔍 Form element found:', !!form);

    const nameInput = within(drawer).queryByLabelText(/service.*name|name/i);
    console.log('🔍 Name input found:', !!nameInput);

    const submitButton = within(drawer).queryByTestId('add-service-submit-button');
    console.log('🔍 Submit button found:', !!submitButton);

    // List all buttons in drawer
    const allButtons = within(drawer).queryAllByRole('button');
    console.log('🔍 All buttons in drawer:', allButtons.map(btn => ({
      text: btn.textContent,
      testId: btn.getAttribute('data-testid')
    })));

    // This should pass if the form is displayed
    expect(form).toBeInTheDocument();
    expect(nameInput).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();
  });
});
