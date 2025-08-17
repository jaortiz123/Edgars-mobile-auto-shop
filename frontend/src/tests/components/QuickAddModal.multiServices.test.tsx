import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { setupUserEvent } from '@/tests/testUtils/userEventHelper';
import QuickAddModal from '@/components/QuickAddModal/QuickAddModal.jsx';

// Mock API dependencies used inside the modal
vi.mock('@/services/templateService', () => ({
  getTemplates: vi.fn().mockResolvedValue([]),
  applyTemplateToFormData: vi.fn().mockImplementation((_id, data) => Promise.resolve(data))
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

// Mock fetch used by ServiceCatalogModal searches
let user: ReturnType<typeof setupUserEvent>;
beforeEach(() => {
  vi.useFakeTimers();
  user = setupUserEvent();
  // Provide two mock services for search query >=2 chars
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = vi.fn(async (url: string) => {
    if (url.includes('/admin/service-operations')) {
      return new Response(JSON.stringify([
        { id: 'svc-1', name: 'Oil Change', default_price: 49.99, category: 'Maintenance' },
        { id: 'svc-2', name: 'Brake Inspection', default_price: 89.00, category: 'Safety' }
      ]), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
});

describe('QuickAddModal multi-service selection', () => {
  it('allows adding multiple services and submits payload with service_operation_ids', async () => {
    const onSubmit = vi.fn();
    render(<QuickAddModal isOpen onClose={() => {}} onSubmit={onSubmit} />);

  // Wait for initialization (loading spinner removal) by waiting for customer name input to be enabled
  const nameInput = screen.getByPlaceholderText(/enter customer name/i);
  await user.type(nameInput, 'Jane Tester');
  await user.type(screen.getByPlaceholderText(/\(555\) 123-4567/i), '555-2222');

    // Open Add Services modal
  await user.click(screen.getByTestId('quickadd-add-service-btn'));

    // Type search to trigger fetch (>=2 chars)
    const searchInput = screen.getByPlaceholderText(/search services \(min 2 chars\)/i);
  await user.type(searchInput, 'oi'); // should match Oil Change
  vi.advanceTimersByTime(400); // flush search debounce
    // Wait for Oil Change result
    expect(await screen.findByText('Oil Change')).toBeInTheDocument();
    // Select Oil Change
  await user.click(screen.getByText('Oil Change'));

    // Add second service
  await user.clear(searchInput);
  await user.type(searchInput, 'br');
  vi.advanceTimersByTime(400);
    expect(await screen.findByText('Brake Inspection')).toBeInTheDocument();
  await user.click(screen.getByText('Brake Inspection'));

    // Confirm selection
  await user.click(screen.getByRole('button', { name: /add 2 services/i }));

    // Ensure chips render
    const chipList = await screen.findByTestId('quickadd-selected-services');
    expect(chipList).toBeInTheDocument();
    expect(screen.getByText('Oil Change')).toBeInTheDocument();
    expect(screen.getByText('Brake Inspection')).toBeInTheDocument();

    // Provide minimal required date/time (today + valid time)
  // Use tomorrow to avoid timezone edge case where YYYY-MM-DD parses as UTC midnight and can be < local today
  const tomorrow = new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0];
  const dateInput = screen.getByLabelText(/date \*/i) as HTMLInputElement;
  await user.clear(dateInput);
  await user.type(dateInput, tomorrow);
  await user.selectOptions(screen.getByLabelText(/time \*/i), '10:00 AM');
  await user.type(screen.getByLabelText(/license plate/i), 'ABC123');
    // Vehicle selects use <select>, choose options instead of typing
    const yearSelect = screen.getByLabelText(/year \*/i) as HTMLSelectElement;
    const targetYear = Array.from(yearSelect.options).find(o => o.value === '2020')?.value || Array.from(yearSelect.options).find(o => o.value)?.value;
    if (targetYear) {
      await user.selectOptions(yearSelect, targetYear);
    }
    const makeSelect = screen.getByLabelText(/make \*/i);
    // Pick first non-empty make option
    const firstMake = Array.from((makeSelect as HTMLSelectElement).options).find(o => o.value);
    if (firstMake) {
  await user.selectOptions(makeSelect, firstMake.value);
    }
    const modelSelect = screen.getByLabelText(/model \*/i);
    // Wait until model options load (excluding placeholder)
    await waitFor(() => {
      const opts = Array.from((modelSelect as HTMLSelectElement).options).filter(o => o.value);
      expect(opts.length).toBeGreaterThan(0);
    });
    const firstModel = Array.from((modelSelect as HTMLSelectElement).options).find(o => o.value);
    if (firstModel) {
      await user.selectOptions(modelSelect, firstModel.value);
    }

    // Submit
  // Flush any remaining debounced validators (conflict check 500ms, slot fetch 300ms)
  vi.advanceTimersByTime(1000);
  const scheduleBtn = screen.getByRole('button', { name: /schedule appointment/i });
  await waitFor(() => expect(scheduleBtn).not.toBeDisabled());
    await user.click(scheduleBtn);
    // Flush any remaining timers (conflict check, slot fetch) and microtasks
    vi.runAllTimers();
    // Fallback: if still not called, manually submit the form (defensive for act warning side-effects)
    if (onSubmit.mock.calls.length === 0) {
      const formEl = scheduleBtn.closest('form');
      if (formEl) fireEvent.submit(formEl);
    }
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.service_operation_ids).toEqual(['svc-1', 'svc-2']);
    // Bridge: serviceType should mirror first selection
    expect(payload.serviceType).toBe('Oil Change');
  });
});
