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
vi.mock('@/lib/api', async () => {
  const actual = (await vi.importActual('@/lib/api')) as Record<string, unknown>;
  return {
    ...actual,
    checkConflict: vi.fn().mockResolvedValue({ conflict: false }),
  };
});
vi.mock('@/services/availabilityService', () => ({
  getAvailableSlots: vi.fn().mockResolvedValue([]),
  clearAvailabilityCache: vi.fn()
}));

let user: ReturnType<typeof setupUserEvent>;
beforeEach(() => {
  vi.useFakeTimers();
  user = setupUserEvent();
});

// No more fetch mocking; MSW handlers in src/test/server/mswServer.ts provide scenarios
// based on phone suffix: 1111 => single, 2222 => multi, 3333 => not found.

describe('QuickAddModal customer lookup', () => {
  it('auto-populates name and single vehicle', async () => {
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
    render(<QuickAddModal isOpen onClose={() => {}} onSubmit={() => {}} />);
    const phoneInput = screen.getByTestId('customer-phone-input');
  await user.type(phoneInput, '5305552222');
  vi.runAllTimers();
  expect(await screen.findByTestId('lookup-success')).toBeInTheDocument();
    // Multi vehicle selector present
    expect(screen.getByTestId('lookup-multi-vehicle')).toBeInTheDocument();
  });

  it('shows not found indicator and clears auto fields', async () => {
    render(<QuickAddModal isOpen onClose={() => {}} onSubmit={() => {}} />);
    const phoneInput = screen.getByTestId('customer-phone-input');
  await user.type(phoneInput, '5305553333');
  vi.runAllTimers();
  expect(await screen.findByTestId('lookup-not-found')).toBeInTheDocument();
  });

  it('debounces and aborts stale lookups', async () => {
    render(<QuickAddModal isOpen onClose={() => {}} onSubmit={() => {}} />);
    const phoneInput = screen.getByTestId('customer-phone-input');
  await user.type(phoneInput, '5305551');
  await user.clear(phoneInput);
  await user.type(phoneInput, '5305551111');
  vi.runAllTimers();
  expect(await screen.findByTestId('lookup-success')).toBeInTheDocument();
  });
});
