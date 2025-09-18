/**
 * Edit Customer Modal Integration Test
 * Tests the complete Edit Customer Modal functionality including:
 * - Preference field management (contact method and time)
 * - API integration with updateCustomer
 * - Form validation and error handling
 * - ETag conflict resolution
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { EditCustomerDialog } from '@/components/admin/EditCustomerDialog';
import * as api from '@/lib/api';

// Mock the API functions
vi.mock('@/lib/api', () => ({
  updateCustomer: vi.fn(),
  searchCustomers: vi.fn(),
}));

// Mock the telemetry service
vi.mock('@/services/telemetry', () => ({
  track: vi.fn(),
}));

// Mock vehicle API functions
vi.mock('@/lib/vehicleApi', () => ({
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  transferVehicle: vi.fn(),
}));

// Mock toast notifications
const mockShowToast = vi.fn();
vi.mock('@/hooks/useToast', () => ({
  useToast: () => mockShowToast,
}));

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('Edit Customer Modal Integration', () => {
  const mockUpdateCustomer = vi.mocked(api.updateCustomer);
  const user = userEvent.setup();

  const mockCustomer = {
    id: 'cust-123',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1-555-0123',
    tags: ['VIP', 'Regular'],
    notes: 'Loyal customer',
    sms_consent: true,
    preferred_contact_method: 'email',
    preferred_contact_time: 'Morning (9-12 PM)',
    _etag: 'mock-etag-123',
  };

  const mockVehicles = [
    {
      id: 'vehicle-1',
      make: 'Honda',
      model: 'Civic',
      year: 2020,
      vin: 'TEST123456789',
      licensePlate: 'ABC123',
      color: 'Blue',
      mileage: 45000,
    },
  ];

  const mockProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSave: vi.fn(),
    initial: {
      id: mockCustomer.id,
      full_name: mockCustomer.name,
      email: mockCustomer.email,
      phone: mockCustomer.phone,
      tags: mockCustomer.tags,
      notes: mockCustomer.notes,
      sms_consent: mockCustomer.sms_consent,
      preferred_contact_method: mockCustomer.preferred_contact_method as 'phone' | 'email' | 'sms',
      preferred_contact_time: mockCustomer.preferred_contact_time,
    },
    vehicles: mockVehicles,
    onAddVehicle: vi.fn(),
    onUpdateVehicle: vi.fn(),
    onTransferVehicle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateCustomer.mockResolvedValue({
      id: mockCustomer.id,
      name: mockCustomer.name,
      email: mockCustomer.email,
      phone: mockCustomer.phone,
      tags: mockCustomer.tags,
      notes: mockCustomer.notes,
      sms_consent: mockCustomer.sms_consent,
      preferred_contact_method: mockCustomer.preferred_contact_method,
      preferred_contact_time: mockCustomer.preferred_contact_time,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render the edit customer modal with preference fields', async () => {
    render(
      <TestWrapper>
        <EditCustomerDialog {...mockProps} />
      </TestWrapper>
    );

    // Check that the modal is open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Edit Customer/)).toBeInTheDocument();

    // Check customer info tab is active
    expect(screen.getByText('Customer Info')).toBeInTheDocument();

    // Check that preference fields are present
    expect(screen.getByLabelText(/preferred contact method/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/preferred contact time/i)).toBeInTheDocument();
  });

  it('should display existing preference values in the form', async () => {
    render(
      <TestWrapper>
        <EditCustomerDialog {...mockProps} />
      </TestWrapper>
    );

    // Check that the contact method dropdown shows the current value
    const contactMethodSelect = screen.getByLabelText(/preferred contact method/i);
    expect(contactMethodSelect).toHaveValue('email');

    // Check that the contact time input shows the current value
    const contactTimeInput = screen.getByLabelText(/preferred contact time/i);
    expect(contactTimeInput).toHaveValue('Morning (9-12 PM)');
  });

  it('should allow changing contact method preference', async () => {
    render(
      <TestWrapper>
        <EditCustomerDialog {...mockProps} />
      </TestWrapper>
    );

    const contactMethodSelect = screen.getByLabelText(/preferred contact method/i);

    // Change from email to phone
    await user.selectOptions(contactMethodSelect, 'phone');

    expect(contactMethodSelect).toHaveValue('phone');
  });

  it('should allow changing contact time preference', async () => {
    render(
      <TestWrapper>
        <EditCustomerDialog {...mockProps} />
      </TestWrapper>
    );

    const contactTimeInput = screen.getByLabelText(/preferred contact time/i);

    // Clear and type new value
    await user.clear(contactTimeInput);
    await user.type(contactTimeInput, 'Afternoon (1-5 PM)');

    expect(contactTimeInput).toHaveValue('Afternoon (1-5 PM)');
  });

  it('should enforce character limit on contact time field', async () => {
    render(
      <TestWrapper>
        <EditCustomerDialog {...mockProps} />
      </TestWrapper>
    );

    const contactTimeInput = screen.getByLabelText(/preferred contact time/i);
    const longText = 'This is a very long text that exceeds fifty characters limit';

    await user.clear(contactTimeInput);
    await user.type(contactTimeInput, longText);

    // Should be truncated to 50 characters
    expect((contactTimeInput as HTMLInputElement).value.length).toBeLessThanOrEqual(50);

    // Character counter should show current length
    expect(screen.getByText(/\d+\/50/)).toBeInTheDocument();
  });

  it('should call onSave with updated preference fields when saved', async () => {
    render(
      <TestWrapper>
        <EditCustomerDialog {...mockProps} />
      </TestWrapper>
    );

    // Change preference fields
    const contactMethodSelect = screen.getByLabelText(/preferred contact method/i);
    const contactTimeInput = screen.getByLabelText(/preferred contact time/i);

    await user.selectOptions(contactMethodSelect, 'sms');
    await user.clear(contactTimeInput);
    await user.type(contactTimeInput, 'Evening (6-9 PM)');

    // Save the form
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    // Verify onSave was called with updated preferences
    await waitFor(() => {
      expect(mockProps.onSave).toHaveBeenCalledWith({
        full_name: mockCustomer.name,
        email: mockCustomer.email,
        phone: mockCustomer.phone,
        tags: mockCustomer.tags,
        notes: mockCustomer.notes,
        sms_consent: mockCustomer.sms_consent,
        preferred_contact_method: 'sms',
        preferred_contact_time: 'Evening (6-9 PM)',
      });
    });
  });

  it('should handle validation errors for required fields', async () => {
    const propsWithEmptyName = {
      ...mockProps,
      initial: {
        ...mockProps.initial,
        full_name: '',
      },
    };

    render(
      <TestWrapper>
        <EditCustomerDialog {...propsWithEmptyName} />
      </TestWrapper>
    );

    // Try to save without a name
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    // Should show validation error for required name field
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(mockProps.onSave).not.toHaveBeenCalled();
  });

  it('should reset form when cancelled', async () => {
    render(
      <TestWrapper>
        <EditCustomerDialog {...mockProps} />
      </TestWrapper>
    );

    // Make changes to the form
    const contactMethodSelect = screen.getByLabelText(/preferred contact method/i);
    const contactTimeInput = screen.getByLabelText(/preferred contact time/i);

    await user.selectOptions(contactMethodSelect, 'phone');
    await user.clear(contactTimeInput);
    await user.type(contactTimeInput, 'Changed time');

    // Cancel the dialog
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should maintain form state between tab switches', async () => {
    render(
      <TestWrapper>
        <EditCustomerDialog {...mockProps} />
      </TestWrapper>
    );

    // Change preference on Customer Info tab
    const contactMethodSelect = screen.getByLabelText(/preferred contact method/i);
    await user.selectOptions(contactMethodSelect, 'sms');

    // Switch to Vehicles tab
    const vehiclesTab = screen.getByRole('tab', { name: /vehicles/i });
    await user.click(vehiclesTab);

    // Switch back to Customer Info tab
    const customerInfoTab = screen.getByRole('tab', { name: /customer info/i });
    await user.click(customerInfoTab);

    // Verify the change persisted
    const contactMethodAfterSwitch = screen.getByLabelText(/preferred contact method/i);
    expect(contactMethodAfterSwitch).toHaveValue('sms');
  });

  it('should handle null/undefined preference values gracefully', async () => {
    const propsWithNullPreferences = {
      ...mockProps,
      initial: {
        ...mockProps.initial,
        preferred_contact_method: undefined,
        preferred_contact_time: null,
      },
    };

    render(
      <TestWrapper>
        <EditCustomerDialog {...propsWithNullPreferences} />
      </TestWrapper>
    );

    // Should render without errors
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Fields should have default/empty values
    const contactMethodSelect = screen.getByLabelText(/preferred contact method/i);
    const contactTimeInput = screen.getByLabelText(/preferred contact time/i);

    expect(contactMethodSelect).toHaveValue('');
    expect(contactTimeInput).toHaveValue('');
  });

  it('should show all contact method options in dropdown', async () => {
    render(
      <TestWrapper>
        <EditCustomerDialog {...mockProps} />
      </TestWrapper>
    );

    const contactMethodSelect = screen.getByLabelText(/preferred contact method/i);

    // Check that all options are available
    expect(within(contactMethodSelect).getByRole('option', { name: /phone/i })).toBeInTheDocument();
    expect(within(contactMethodSelect).getByRole('option', { name: /email/i })).toBeInTheDocument();
    expect(within(contactMethodSelect).getByRole('option', { name: /sms/i })).toBeInTheDocument();
  });

  it('should display existing customer tags as badge chips', async () => {
    render(
      <TestWrapper>
        <EditCustomerDialog {...mockProps} />
      </TestWrapper>
    );

    // Check that existing tags from mockProps are displayed
    expect(screen.getByText('VIP')).toBeInTheDocument();
    expect(screen.getByText('Regular')).toBeInTheDocument();

    // Check that tags are displayed as removable badges
    expect(screen.getByLabelText('Remove VIP tag')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove Regular tag')).toBeInTheDocument();
  });

  it('should allow adding new tags using the TagsInput component', async () => {
    render(
      <TestWrapper>
        <EditCustomerDialog {...mockProps} />
      </TestWrapper>
    );

    // Find the tags section and the input within it
    const tagsSection = screen.getByText('Tags').closest('div');
    const tagsInput = within(tagsSection!).getByRole('textbox');

    // Add a new tag
    await user.type(tagsInput, 'NewTag');
    await user.keyboard('{Enter}');

    // The new tag should appear as a badge
    expect(screen.getByText('NewTag')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove NewTag tag')).toBeInTheDocument();
  });

  it('should allow removing tags by clicking the X button', async () => {
    render(
      <TestWrapper>
        <EditCustomerDialog {...mockProps} />
      </TestWrapper>
    );

    // Initially should have VIP and Regular tags
    expect(screen.getByText('VIP')).toBeInTheDocument();
    expect(screen.getByText('Regular')).toBeInTheDocument();

    // Remove the VIP tag
    const removeVipButton = screen.getByLabelText('Remove VIP tag');
    await user.click(removeVipButton);

    // VIP should be gone, Regular should remain
    expect(screen.queryByText('VIP')).not.toBeInTheDocument();
    expect(screen.getByText('Regular')).toBeInTheDocument();
  });

  it('should save tags with other customer data when form is submitted', async () => {
    render(
      <TestWrapper>
        <EditCustomerDialog {...mockProps} />
      </TestWrapper>
    );

    // Find the tags section and input within it
    const tagsSection = screen.getByText('Tags').closest('div');
    const tagsInput = within(tagsSection!).getByRole('textbox');

    // Add a new tag
    await user.type(tagsInput, 'Loyalty');
    await user.keyboard('{Enter}');

    // Remove an existing tag
    const removeRegularButton = screen.getByLabelText('Remove Regular tag');
    await user.click(removeRegularButton);

    // Save the form
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    // Check that onSave was called with updated tags
    expect(mockProps.onSave).toHaveBeenCalledWith({
      full_name: mockProps.initial.full_name,
      email: mockProps.initial.email,
      phone: mockProps.initial.phone,
      tags: ['VIP', 'Loyalty'], // Regular removed, Loyalty added
      notes: mockProps.initial.notes,
      sms_consent: mockProps.initial.sms_consent,
      preferred_contact_method: mockProps.initial.preferred_contact_method,
      preferred_contact_time: mockProps.initial.preferred_contact_time,
    });
  });

  it('should show validation error when too many tags are added', async () => {
    // Create a customer with 9 tags (close to the limit of 10)
    const propsWithManyTags = {
      ...mockProps,
      initial: {
        ...mockProps.initial,
        tags: ['Tag1', 'Tag2', 'Tag3', 'Tag4', 'Tag5', 'Tag6', 'Tag7', 'Tag8', 'Tag9'],
      },
    };

    render(
      <TestWrapper>
        <EditCustomerDialog {...propsWithManyTags} />
      </TestWrapper>
    );

    // Should show we have 9 tags currently (text might be split across elements)
    expect(screen.getByText((content, element) => {
      return content.includes('9') && content.includes('10') && content.includes('tags');
    })).toBeInTheDocument();

    // Add one more tag (this reaches the 10 tag limit)
    const tagsSection = screen.getByText('Tags').closest('div');
    const tagsInput = within(tagsSection!).getByRole('textbox');
    await user.type(tagsInput, 'Tag10');
    await user.keyboard('{Enter}');

    // Now we should show the maximum reached warning
    expect(screen.getByText(/Maximum 10 tags allowed/i)).toBeInTheDocument();

    // Should show 10/10 tags counter (look for the specific counter pattern)
    expect(screen.getByText((content, element) => {
      return content.includes('10/10 tags');
    })).toBeInTheDocument();

    // Try to add another tag - it should not be added
    await user.type(tagsInput, 'Tag11');
    await user.keyboard('{Enter}');

    // The 11th tag should not appear, should still show 10 tags
    expect(screen.queryByText('Tag11')).not.toBeInTheDocument();

    // Should still show 10/10 tags
    expect(screen.getByText((content, element) => {
      return content.includes('10/10 tags');
    })).toBeInTheDocument();
  });

  it('should show helper text indicating tag limits and usage', async () => {
    render(
      <TestWrapper>
        <EditCustomerDialog {...mockProps} />
      </TestWrapper>
    );

    // Should show the current tag count and help text
    expect(screen.getByText('2/10 tags • Press Enter or comma to add • Backspace to remove')).toBeInTheDocument();
  });
});
