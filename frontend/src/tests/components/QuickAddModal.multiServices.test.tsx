import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
beforeEach(() => {
  // Provide two mock services for search query >=2 chars
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = vi.fn(async (url: string) => {
    if (url.includes('/admin/service-operations')) {
      return new Response(JSON.stringify({ service_operations: [
        { id: 'svc-1', name: 'Oil Change', default_price: 49.99, category: 'Maintenance' },
        { id: 'svc-2', name: 'Brake Inspection', default_price: 89.00, category: 'Safety' }
      ] }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
});

describe('QuickAddModal multi-service selection', () => {
  it('allows adding multiple services and submits payload with service_operation_ids', async () => {
    const onSubmit = vi.fn();
    render(<QuickAddModal isOpen onClose={() => {}} onSubmit={onSubmit} />);

    // Fill required customer + phone
    await userEvent.type(screen.getByPlaceholderText(/enter customer name/i), 'Jane Tester');
    await userEvent.type(screen.getByPlaceholderText(/\(555\) 123-4567/i), '555-2222');

    // Open Add Services modal
    await userEvent.click(screen.getByTestId('quickadd-add-service-btn'));

    // Type search to trigger fetch (>=2 chars)
    const searchInput = screen.getByPlaceholderText(/search services \(min 2 chars\)/i);
    await userEvent.type(searchInput, 'oi'); // should match Oil Change
    // Wait for Oil Change result
    expect(await screen.findByText('Oil Change')).toBeInTheDocument();
    // Select Oil Change
    await userEvent.click(screen.getByText('Oil Change'));

    // Add second service
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, 'br');
    expect(await screen.findByText('Brake Inspection')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Brake Inspection'));

    // Confirm selection
    await userEvent.click(screen.getByRole('button', { name: /add 2 services/i }));

    // Ensure chips render
    const chipList = await screen.findByTestId('quickadd-selected-services');
    expect(chipList).toBeInTheDocument();
    expect(screen.getByText('Oil Change')).toBeInTheDocument();
    expect(screen.getByText('Brake Inspection')).toBeInTheDocument();

    // Provide minimal required date/time (today + valid time)
    const today = new Date().toISOString().split('T')[0];
    const dateInput = screen.getByLabelText(/date \*/i) as HTMLInputElement;
    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, today);
    await userEvent.selectOptions(screen.getByLabelText(/time \*/i), '10:00 AM');
    await userEvent.type(screen.getByLabelText(/license plate/i), 'ABC123');
    // Vehicle selects use <select>, choose options instead of typing
    const yearSelect = screen.getByLabelText(/year \*/i) as HTMLSelectElement;
    const firstYearOption = Array.from(yearSelect.options).find(o => o.value);
    if (firstYearOption) {
      await userEvent.selectOptions(yearSelect, firstYearOption.value);
    }
    const makeSelect = screen.getByLabelText(/make \*/i);
    // Pick first non-empty make option
    const firstMake = Array.from((makeSelect as HTMLSelectElement).options).find(o => o.value);
    if (firstMake) {
      await userEvent.selectOptions(makeSelect, firstMake.value);
    }
    const modelSelect = screen.getByLabelText(/model \*/i);
    const firstModel = Array.from((modelSelect as HTMLSelectElement).options).find(o => o.value);
    if (firstModel) {
      await userEvent.selectOptions(modelSelect, firstModel.value);
    }

    // Submit
  await userEvent.click(screen.getByRole('button', { name: /schedule appointment/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.service_operation_ids).toEqual(['svc-1', 'svc-2']);
    // Bridge: serviceType should mirror first selection
    expect(payload.serviceType).toBe('Oil Change');
  });
});
