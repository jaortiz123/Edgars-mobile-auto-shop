import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@test-utils';
import userEvent from '@testing-library/user-event';
import MessageThread from '@/components/admin/MessageThread';

import * as api from '@/lib/api';

describe('Message Templates Insertion', () => {
  it('opens template panel and inserts a template into the composer', async () => {
    // Ensure the api mock returns some templates with predictable IDs
    if (vi.isMockFunction(api.fetchMessageTemplates)) {
      vi.mocked(api.fetchMessageTemplates).mockResolvedValueOnce({
        message_templates: [
          { id: 'tpl-1', slug: 'tpl-1', label: 'Vehicle Ready', channel: 'sms', category: 'status', body: 'Hi {{customer.name}}, your vehicle is ready!', variables: [], is_active: true },
          { id: 'tpl-2', slug: 'tpl-2', label: 'Reminder', channel: 'sms', category: 'reminder', body: 'Reminder: appointment soon', variables: [], is_active: true }
        ],
        suggested: []
      });
    }
    render(<MessageThread appointmentId="appt-1" drawerOpen={true} />);

  const user = userEvent.setup();
  const button = await screen.findByTestId('template-picker-button');
  await user.click(button);
    const panel = await screen.findByTestId('template-panel');
    expect(panel).toBeInTheDocument();

  // Select a specific template deterministically
  // Open preview for template 1
  const option = await screen.findByTestId('template-option-tpl-1');
  await user.click(option);
  // Click the insert button inside preview
  const insertBtn = await screen.findByTestId('template-insert-tpl-1');
  await user.click(insertBtn);

  const textarea = await screen.findByLabelText('New message');
  await waitFor(() => {
    expect(textarea).toHaveValue('Hi Test Customer, your vehicle is ready!');
  });
  });
});
