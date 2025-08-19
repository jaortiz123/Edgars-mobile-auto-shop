import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MessageThread from '../components/admin/MessageThread';

// Ensure module is mocked including new fetchMessageTemplates export used by component
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<any>('@/lib/api'); // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    ...actual,
    getAppointmentMessages: vi.fn(),
    createAppointmentMessage: vi.fn(),
    fetchMessageTemplates: vi.fn().mockResolvedValue({ message_templates: [], suggested: [] }),
    getDrawer: vi.fn().mockResolvedValue({ appointment: { id: 'appt-123', status: 'READY' } }),
  };
});

// Import the mocked functions from centralized setup
import { getAppointmentMessages, createAppointmentMessage, fetchMessageTemplates } from '@/lib/api';

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
  vi.mocked(getAppointmentMessages).mockResolvedValue(mockMessages);
  vi.mocked(fetchMessageTemplates).mockResolvedValue({ message_templates: [], suggested: [] });

    render(<MessageThread appointmentId="appt-123" drawerOpen={true} />);

    expect(await screen.findByText('Your car is ready for pickup')).toBeInTheDocument();
    expect(screen.getByText('Thank you!')).toBeInTheDocument();
  });

  it('renders empty state when no messages', async () => {
  vi.mocked(getAppointmentMessages).mockResolvedValue([]);
  vi.mocked(fetchMessageTemplates).mockResolvedValue({ message_templates: [], suggested: [] });

    render(<MessageThread appointmentId="appt-123" drawerOpen={true} />);

    expect(await screen.findByText('No messages yet')).toBeInTheDocument();
    expect(screen.getByText('Send your first message below')).toBeInTheDocument();
  });

  it('allows sending a new message', async () => {
    const user = userEvent.setup();
  vi.mocked(getAppointmentMessages).mockResolvedValue([]);
  vi.mocked(fetchMessageTemplates).mockResolvedValue({ message_templates: [], suggested: [] });
    vi.mocked(createAppointmentMessage).mockResolvedValue({
      id: 'new-msg',
      status: 'sending',
    });

    render(<MessageThread appointmentId="appt-123" drawerOpen={true} />);

    // Wait for component to load and show the composer
    expect(await screen.findByText('No messages yet')).toBeInTheDocument();

    // Type a message
    const textarea = screen.getByPlaceholderText('Type your message...');
    await user.type(textarea, 'Test message');

    // Click send
    const sendButton = screen.getByRole('button', { name: 'Send message' });
    await user.click(sendButton);

    expect(createAppointmentMessage).toHaveBeenCalledWith('appt-123', {
      channel: 'sms',
      body: 'Test message',
    });
  });

  it('validates empty messages', async () => {
  vi.mocked(getAppointmentMessages).mockResolvedValue([]);
  vi.mocked(fetchMessageTemplates).mockResolvedValue({ message_templates: [], suggested: [] });

    render(<MessageThread appointmentId="appt-123" drawerOpen={true} />);

    // Wait for component to load
    expect(await screen.findByText('No messages yet')).toBeInTheDocument();

    const sendButton = screen.getByRole('button', { name: 'Send message' });

    // Send button should be disabled when message is empty
    expect(sendButton).toBeDisabled();
  });

  it('handles API errors when sending messages', async () => {
    const user = userEvent.setup();

  vi.mocked(getAppointmentMessages).mockResolvedValue([]);
  vi.mocked(fetchMessageTemplates).mockResolvedValue({ message_templates: [], suggested: [] });
    vi.mocked(createAppointmentMessage).mockRejectedValue(new Error('Network error'));

    render(<MessageThread appointmentId="appt-123" drawerOpen={true} />);

    // Wait for component to load completely
    expect(await screen.findByText('No messages yet')).toBeInTheDocument();

    // Type a message
    const textarea = screen.getByPlaceholderText('Type your message...');
    await user.type(textarea, 'Test message');

    // Click send
    const sendButton = screen.getByRole('button', { name: 'Send message' });
    await user.click(sendButton);

    // Verify the API was called and failed
    await waitFor(() => {
      expect(createAppointmentMessage).toHaveBeenCalledWith('appt-123', {
        channel: 'sms',
        body: 'Test message',
      });
    });
  });
});
