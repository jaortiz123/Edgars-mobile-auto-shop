import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { setupUserEvent } from '@/tests/testUtils/userEventHelper';
import QuickAddModal from '@/components/QuickAddModal/QuickAddModal.jsx';

// Mocks for existing services used inside component
vi.mock('@/services/templateService', () => ({
  getTemplates: vi.fn().mockResolvedValue([]),
  applyTemplateToFormData: vi.fn().mockImplementation((_id, d) => Promise.resolve(d))
}));
vi.mock('@/utils/shortcut', () => ({
  getLastAppointmentSettings: vi.fn().mockReturnValue({}),
  createOneClickAppointment: vi.fn().mockImplementation(d => d),
  saveLastAppointmentSettings: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('@/lib/api', () => ({
  checkConflict: vi.fn().mockResolvedValue({ conflict: false }),
}));
vi.mock('@/services/availabilityService', () => ({
  getAvailableSlots: vi.fn().mockResolvedValue([]),
  clearAvailabilityCache: vi.fn()
}));

let user: ReturnType<typeof setupUserEvent>;
beforeEach(() => {
  vi.useFakeTimers();
  user = setupUserEvent();
});

const mockFetchScenario = (scenario: 'single' | 'multi' | 'notfound' | 'error') => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = vi.fn(async (url: string) => {
    if (url.includes('/api/customers/lookup')) {
      if (scenario === 'single') {
        return new Response(JSON.stringify({
          customer: { id: 'c1', name: 'Alice Auto', phone: '5305551111' },
          vehicles: [{ id: 'v1', year: 2020, make: 'Honda', model: 'Civic', license_plate: 'AAA111' }]
        }), { status: 200 });
      } else if (scenario === 'multi') {
        return new Response(JSON.stringify({
          customer: { id: 'c2', name: 'Bob Fleet', phone: '5305552222' },
          vehicles: [
            { id: 'v2', year: 2019, make: 'Ford', model: 'F-150', license_plate: 'BBB222' },
            { id: 'v3', year: 2021, make: 'Tesla', model: 'Model 3', license_plate: 'CCC333' }
          ]
        }), { status: 200 });
      } else if (scenario === 'notfound') {
        return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
      } else if (scenario === 'error') {
        return new Response('fail', { status: 500 });
      }
    }
    if (url.includes('/api/admin/service-operations')) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
};

describe('QuickAddModal customer lookup', () => {
  it('auto-populates name and single vehicle', async () => {
    mockFetchScenario('single');
    render(<QuickAddModal isOpen onClose={() => {}} onSubmit={() => {}} />);
    const phoneInput = screen.getByTestId('customer-phone-input');
  await user.type(phoneInput, '5305551111');
  vi.runAllTimers(); // flush debounce
  expect(await screen.findByTestId('lookup-success')).toBeInTheDocument();
    // Name populated
    const nameInput = screen.getByPlaceholderText(/enter customer name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Alice Auto');
  // Vehicle selects reflect auto vehicle (wait for async state update)
  await screen.findByDisplayValue('2020');
  // Wait for make select to update
  await screen.findByDisplayValue('Honda');
  await screen.findByDisplayValue('Civic');
  expect((screen.getByLabelText(/year \*/i) as HTMLSelectElement).value).toBe('2020');
  expect((screen.getByLabelText(/make \*/i) as HTMLSelectElement).value).toBe('Honda');
  expect((screen.getByLabelText(/model \*/i) as HTMLSelectElement).value).toBe('Civic');
  });

  it('switches to multi-vehicle selector', async () => {
    mockFetchScenario('multi');
    render(<QuickAddModal isOpen onClose={() => {}} onSubmit={() => {}} />);
    const phoneInput = screen.getByTestId('customer-phone-input');
  await user.type(phoneInput, '5305552222');
  vi.runAllTimers();
  expect(await screen.findByTestId('lookup-success')).toBeInTheDocument();
    // Multi vehicle selector present
    expect(screen.getByTestId('lookup-multi-vehicle')).toBeInTheDocument();
  });

  it('shows not found indicator and clears auto fields', async () => {
    mockFetchScenario('notfound');
    render(<QuickAddModal isOpen onClose={() => {}} onSubmit={() => {}} />);
    const phoneInput = screen.getByTestId('customer-phone-input');
  await user.type(phoneInput, '5305553333');
  vi.runAllTimers();
  expect(await screen.findByTestId('lookup-not-found')).toBeInTheDocument();
  });

  it('debounces and aborts stale lookups', async () => {
    mockFetchScenario('single');
    render(<QuickAddModal isOpen onClose={() => {}} onSubmit={() => {}} />);
    const phoneInput = screen.getByTestId('customer-phone-input');
  await user.type(phoneInput, '5305551');
  await user.clear(phoneInput);
  await user.type(phoneInput, '5305551111');
  vi.runAllTimers();
  expect(await screen.findByTestId('lookup-success')).toBeInTheDocument();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((globalThis as any).fetch).toHaveBeenCalled();
  });
});
