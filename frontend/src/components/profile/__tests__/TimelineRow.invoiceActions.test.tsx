import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import TimelineRow, { type TimelineRowProps } from '../TimelineRow';

// Helper to render with minimal required props
function setup(extra: Partial<TimelineRowProps> = {}) {
  const props: TimelineRowProps = {
    id: 'inv-123',
    date: new Date().toISOString(),
    status: 'Completed',
    services: [{ name: 'Oil Change' }],
    invoice: { total: 10000, paid: 5000, unpaid: 5000 },
    active: false,
    tabIndex: 0,
    onActivate: vi.fn(),
    onArrowNav: vi.fn(),
    ...extra
  };
  render(<ul><TimelineRow {...props} /></ul>);
  return props;
}

describe('TimelineRow invoice actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows menu button when invoice present', () => {
    setup();
    expect(screen.getByTestId('invoice-actions-btn')).toBeInTheDocument();
  });

  it('toggles menu on click', async () => {
    setup();
  const btn = screen.getByTestId('invoice-actions-btn');
    await userEvent.click(btn);
    expect(screen.getByTestId('invoice-actions-menu')).toBeInTheDocument();
  });

  it('opens receipt in new window', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    setup();
    await userEvent.click(screen.getByTestId('invoice-actions-btn'));
    await userEvent.click(screen.getByTestId('action-view-receipt'));
  // Component builds relative path; window.open sees '/admin/...'
  expect(openSpy).toHaveBeenCalledWith('/admin/invoices/inv-123/receipt.html', '_blank', 'noopener');
  // Menu auto-closes
  expect(screen.queryByTestId('invoice-actions-menu')).not.toBeInTheDocument();
  });

  it('triggers pdf download link', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string): HTMLElement => {
      const el = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement;
      if (tagName === 'a') {
        Object.defineProperty(el, 'click', { value: clickSpy });
      }
      return el;
    });
    setup();
    await userEvent.click(screen.getByTestId('invoice-actions-btn'));
    await userEvent.click(screen.getByTestId('action-download-pdf'));
    expect(appendSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  // Auto close after action
  expect(screen.queryByTestId('invoice-actions-menu')).not.toBeInTheDocument();
  });

  it('opens email modal and sends email (202)', async () => {
    const success = vi.fn();
    const error = vi.fn();
    // Patch toast functions directly (global mock from setup provides object)
  const toastMod = await import('@/lib/toast');
  (toastMod.toast as { success?: (m: string)=>void; error?: (m: string)=>void }).success = success;
  (toastMod.toast as { success?: (m: string)=>void; error?: (m: string)=>void }).error = error;
  // Mock axios-like http.post to return 202
  const { http } = await import('@/lib/api');
  type AxiosLikeResponse = { status: number; data?: unknown };
  const postSpy = vi.spyOn(http, 'post').mockResolvedValue({ status: 202 } as AxiosLikeResponse);
    setup();
  await userEvent.click(screen.getByTestId('invoice-actions-btn'));
  await userEvent.click(screen.getByTestId('action-email'));
    const input = screen.getByTestId('email-input');
  await userEvent.type(input, 'user@example.com');
  await userEvent.click(screen.getByTestId('send-email-btn'));
  await waitFor(() => expect(success).toHaveBeenCalled());
  // Axios http has baseURL '/api', but the component passes path-only. The spy sees the path string.
  expect(postSpy).toHaveBeenCalledWith('/admin/invoices/inv-123/send', expect.any(Object));
    expect(screen.queryByTestId('email-modal')).not.toBeInTheDocument();
  // Announcer removed since menu closed
  expect(screen.queryByTestId('invoice-actions-menu')).not.toBeInTheDocument();
  });

  it('shows error toast on non-202', async () => {
    const success = vi.fn();
    const error = vi.fn();
  const toastMod = await import('@/lib/toast');
  (toastMod.toast as { success?: (m: string)=>void; error?: (m: string)=>void }).success = success;
  (toastMod.toast as { success?: (m: string)=>void; error?: (m: string)=>void }).error = error;
  const { http } = await import('@/lib/api');
  type AxiosLikeResponse = { status: number; data?: unknown };
  vi.spyOn(http, 'post').mockResolvedValue({ status: 500 } as AxiosLikeResponse);
    setup();
    await userEvent.click(screen.getByTestId('invoice-actions-btn'));
    await userEvent.click(screen.getByTestId('action-email'));
    const input = screen.getByTestId('email-input');
  await userEvent.type(input, 'user@example.com');
    await userEvent.click(screen.getByTestId('send-email-btn'));
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(screen.getByTestId('email-modal')).toBeInTheDocument();
  });

  it('supports keyboard navigation in menu', async () => {
    setup();
    const trigger = screen.getByTestId('invoice-actions-btn');
    // Open with click
    await userEvent.click(trigger);
    const menu = screen.getByTestId('invoice-actions-menu');
    expect(menu).toHaveAttribute('role', 'menu');
    const items = [
      screen.getByTestId('action-view-receipt'),
      screen.getByTestId('action-download-pdf'),
      screen.getByTestId('action-email')
    ];
    // Arrow navigation
    await userEvent.keyboard('{ArrowDown}'); // focus first
  // eslint-disable-next-line testing-library/no-node-access
  expect(items).toContain(document.activeElement);
  // eslint-disable-next-line testing-library/no-node-access
  const firstIndex = items.indexOf(document.activeElement as HTMLElement);
    await userEvent.keyboard('{ArrowDown}');
  // eslint-disable-next-line testing-library/no-node-access
  const secondIndex = items.indexOf(document.activeElement as HTMLElement);
    expect(secondIndex).toBe((firstIndex + 1) % items.length);
    await userEvent.keyboard('{ArrowUp}');
  // eslint-disable-next-line testing-library/no-node-access
  const backIndex = items.indexOf(document.activeElement as HTMLElement);
    expect(backIndex).toBe(firstIndex);
    // Escape closes
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('invoice-actions-menu')).not.toBeInTheDocument();
  });
});
