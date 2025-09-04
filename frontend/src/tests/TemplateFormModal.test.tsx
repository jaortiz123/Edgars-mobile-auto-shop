import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import TemplateFormModal from '@/components/admin/TemplateFormModal';

// Use spies instead of full module mock to avoid impacting other tests relying on real exports
import * as api from '@/lib/api';
import type { MessageTemplateRecord } from '@/lib/api';
// Use spies on the real module exports per-file
const mockCreated: MessageTemplateRecord = { id: '1', slug: 'new', label: 'New', channel: 'sms', category: null, body: 'Hello', variables: [], is_active: true };
const mockUpdated: MessageTemplateRecord = { id: '1', slug: 'new', label: 'Updated', channel: 'sms', category: null, body: 'Hello', variables: [], is_active: true };
vi.spyOn(api, 'createMessageTemplate').mockResolvedValue(mockCreated);
vi.spyOn(api, 'updateMessageTemplate').mockResolvedValue(mockUpdated);

describe('TemplateFormModal validation', () => {
  it('shows error when required fields missing on create', async () => {
  const handleSaved = vi.fn();
    render(<TemplateFormModal mode="create" open={true} onClose={() => {}} onSaved={handleSaved} />);

    const saveBtn = screen.getByRole('button', { name: /save/i });
    await userEvent.click(saveBtn);

  // Error div rendered with test id
  expect(await screen.findByTestId('template-form-error')).toHaveTextContent('Slug is required');
    expect(handleSaved).not.toHaveBeenCalled();
  });

  it('submits successfully when fields valid', async () => {
  const handleSaved = vi.fn();
    render(<TemplateFormModal mode="create" open={true} onClose={() => {}} onSaved={handleSaved} />);

    await userEvent.type(screen.getByPlaceholderText('vehicle_ready_sms'), 'valid_slug');
    await userEvent.type(screen.getByPlaceholderText('Vehicle Ready (SMS)'), 'Label');
    await userEvent.type(screen.getByPlaceholderText('Hi {{customer.name}}, your vehicle is ready!'), 'Hello world');

  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(handleSaved).toHaveBeenCalledTimes(1));
  });
});
