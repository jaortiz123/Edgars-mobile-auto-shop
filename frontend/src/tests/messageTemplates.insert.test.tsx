import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageThread from '@/components/admin/MessageThread';

describe('Message Templates Insertion', () => {
  it('opens template panel and inserts a template into the composer', async () => {
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
