import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import MessageThread from '@/components/admin/MessageThread';
import * as api from '@/lib/api';

// Mock the API
vi.mock('@/lib/api', () => ({
  getAppointmentMessages: vi.fn(),
  createAppointmentMessage: vi.fn(),
  deleteAppointmentMessage: vi.fn(),
  handleApiError: vi.fn().mockReturnValue('Failed to send message'),
}));

// Mock toast
vi.mock('@/lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('MessageThread', () => {
  const mockMessages = [
    {
      id: 'msg-1',
      appointment_id: 'appt-123',
      channel: 'sms' as const,
      direction: 'out' as const,
      body: 'Your car is ready for pickup',
      status: 'delivered' as const,
      sent_at: '2025-01-28T10:00:00Z',
    },
    {
      id: 'msg-2',
      appointment_id: 'appt-123',
      channel: 'sms' as const,
      direction: 'in' as const,
      body: 'Thank you!',
      status: 'delivered' as const,
      sent_at: '2025-01-28T10:05:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders message thread with messages', async () => {
    (api.getAppointmentMessages as any).mockResolvedValue(mockMessages);

    render(<MessageThread appointmentId="appt-123" drawerOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText('Your car is ready for pickup')).toBeInTheDocument();
      expect(screen.getByText('Thank you!')).toBeInTheDocument();
    });
  });

  it('renders empty state when no messages', async () => {
    (api.getAppointmentMessages as any).mockResolvedValue([]);

    render(<MessageThread appointmentId="appt-123" drawerOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText('No messages yet')).toBeInTheDocument();
      expect(screen.getByText('Send your first message below')).toBeInTheDocument();
    });
  });

  it('allows sending a new message', async () => {
    (api.getAppointmentMessages as any).mockResolvedValue([]);
    (api.createAppointmentMessage as any).mockResolvedValue({
      id: 'new-msg',
      status: 'sending',
    });

    render(<MessageThread appointmentId="appt-123" drawerOpen={true} />);

    // Wait for component to load and show the composer
    await waitFor(() => {
      expect(screen.getByText('No messages yet')).toBeInTheDocument();
    });

    // Type a message
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'Test message' } });

    // Click send
    const sendButton = screen.getByRole('button', { name: 'Send message' });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(api.createAppointmentMessage).toHaveBeenCalledWith('appt-123', {
        channel: 'sms',
        body: 'Test message',
      });
    });
  });

  it('validates empty messages', async () => {
    (api.getAppointmentMessages as any).mockResolvedValue([]);

    render(<MessageThread appointmentId="appt-123" drawerOpen={true} />);

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('No messages yet')).toBeInTheDocument();
    });

    const sendButton = screen.getByRole('button', { name: 'Send message' });
    
    // Send button should be disabled when message is empty
    expect(sendButton).toBeDisabled();
  });

  it('handles API errors when sending messages', async () => {
    const { toast } = await import('@/lib/toast');
    
    (api.getAppointmentMessages as any).mockResolvedValue([]);
    (api.createAppointmentMessage as any).mockRejectedValue(new Error('Network error'));

    render(<MessageThread appointmentId="appt-123" drawerOpen={true} />);

    // Wait for component to load completely
    await waitFor(() => {
      expect(screen.getByText('No messages yet')).toBeInTheDocument();
    });

    // Type a message
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'Test message' } });

    // Click send
    const sendButton = screen.getByRole('button', { name: 'Send message' });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
