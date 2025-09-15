import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@test-utils';
import userEvent from '@testing-library/user-event';
import MessageThread from '@/components/admin/MessageThread';
import * as api from '@/lib/api';

// Minimal message shape
vi.mock('@/lib/api');

type MockFn = ReturnType<typeof vi.fn>;

describe('MessageThread suggestions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  (api.getAppointmentMessages as unknown as MockFn).mockResolvedValue([]);
  (api.getDrawer as unknown as MockFn).mockResolvedValue({ appointment: { id: '1', status: 'READY' } });
  (api.fetchMessageTemplates as unknown as MockFn).mockResolvedValue({
      message_templates: [
        { id: 'a', slug: 'a', label: 'General Update', channel: 'sms', category: 'general', body: 'Update', variables: [], is_active: true },
        { id: 'b', slug: 'pickup_ready', label: 'Pickup Ready', channel: 'sms', category: 'status', body: 'Your car is ready', variables: [], is_active: true }
      ],
      suggested: [
        { id: 'b', slug: 'pickup_ready', label: 'Pickup Ready', channel: 'sms', category: 'status', body: 'Your car is ready', variables: [], is_active: true, relevance: 1, reason: 'Status READY' }
      ]
    });
  (api.createAppointmentMessage as unknown as MockFn).mockResolvedValue({ id: 'm1', status: 'delivered' });
  });

  it('renders suggested section and badges', async () => {
    render(<MessageThread appointmentId="1" drawerOpen={true} />);

    // Open template panel
    const btn = await screen.findByTestId('template-picker-button');
  await userEvent.click(btn);

    // Wait for suggested template button
    await waitFor(() => {
      expect(screen.getByTestId('suggested-template-b')).toBeInTheDocument();
    });
  // Badge appears in main list too (template-badge-b) with tooltip reason
  const badge = await screen.findByTestId('template-badge-b');
  expect(badge).toBeInTheDocument();
  // Title attribute should contain reason text
  expect(badge).toHaveAttribute('title', expect.stringContaining('Status READY'));
  });
});
