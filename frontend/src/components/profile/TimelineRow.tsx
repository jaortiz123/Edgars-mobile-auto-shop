import React, { useState, useEffect, useRef } from 'react';
import { http } from '@/lib/api';
import { toast } from '@/lib/toast';

// Narrow toast typing locally without using any
interface ToastAPI { success?: (msg: string) => void; error?: (msg: string) => void }
const toastApi: ToastAPI = toast as unknown as ToastAPI;
import { dtLocal, money } from '@/utils/format';

export interface TimelineService { name: string }
export interface TimelineInvoice { total: number; paid: number; unpaid: number }

export interface TimelineRowProps {
  id: string;
  date: string | null; // raw ISO timestamp
  status?: string | null;
  services: TimelineService[];
  invoice?: TimelineInvoice | null;
  active: boolean;
  tabIndex: number;
  onActivate: () => void;
  onArrowNav: (e: React.KeyboardEvent) => void; // parent roving handler
  testId?: string; // optional override for testing (legacy tests expect 'appointment-row')
}

// Unified timeline row used by customer + vehicle profile pages.
export const TimelineRow: React.FC<TimelineRowProps> = ({ id, date, status, services, invoice, active, tabIndex, onActivate, onArrowNav, testId }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const hasInvoice = !!invoice; // guard actions
  // Use path relative to axios baseURL ('/api') to avoid '/api/api' duplication
  const baseUrl = `/admin/invoices/${id}`; // assumes row id == invoice id for invoice rows

  const onViewReceipt = () => {
    window.open(`${baseUrl}/receipt.html`, '_blank', 'noopener');
    setMenuOpen(false);
  };
  const onDownloadPdf = () => {
    // trigger browser download by creating temporary link
    const a = document.createElement('a');
    a.href = `${baseUrl}/receipt.pdf`;
    a.download = `invoice-${id}-receipt.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setMenuOpen(false);
  };
  const onEmail = () => { setEmailOpen(true); setMenuOpen(false); };
  // Close menu on outside click / escape
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
      if (e.key === 'Tab') {
        setTimeout(() => {
          if (!menuRef.current) return;
          if (!menuRef.current.contains(document.activeElement)) {
            setMenuOpen(false);
          }
        }, 0);
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const items = Array.from(menuRef.current?.querySelectorAll('[data-menu-item]') || []) as HTMLElement[];
        if (!items.length) return;
        const current = document.activeElement as HTMLElement | null;
        let idx = items.indexOf(current || items[0]);
        if (e.key === 'ArrowDown') idx = (idx + 1) % items.length; else idx = (idx - 1 + items.length) % items.length;
        items[idx]?.focus();
        e.preventDefault();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);
  const submitEmail = async () => {
    if (!email || sending) return;
    setSending(true);
    try {
      const resp = await http.post(`${baseUrl}/send`, { type: 'receipt', destinationEmail: email });
      if (resp.status === 202) {
        // unified toast APIs (tests mock .success/.error)
        if (toastApi.success) {
          toastApi.success('Email queued');
        }
        setEmailOpen(false);
        setEmail('');
      } else {
        if (toastApi.error) {
          toastApi.error('Failed to send');
        }
      }
    } catch {
      if (toastApi.error) {
        toastApi.error('Failed to send');
      }
    } finally {
      setSending(false);
    }
  };
  return (
  <li key={id} className="p-0 m-0" data-testid={testId || 'timeline-row'}>
      <div className={`w-full rounded-xl ${active ? 'bg-accent/30' : ''}`}>
        <div className="flex items-start justify-between p-3">
          <button
            type="button"
            tabIndex={tabIndex}
            aria-current={active || undefined}
            data-active={active ? 'true' : undefined}
            className="text-left flex-1 focus:outline-none focus:ring-2 focus:ring-ring"
            onClick={onActivate}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                onArrowNav(e);
                e.stopPropagation();
              }
            }}
          >
            <div className="font-medium">{dtLocal(date)}</div>
            <div className="text-xs opacity-70">{status}</div>
            <div className="text-xs mt-1">{services.map(s => s.name).join(', ')}</div>
          </button>
          {invoice && (
            <div className="text-right text-sm pl-3">
              <div>Total: {money(invoice.total)}</div>
              <div className="opacity-70">Paid: {money(invoice.paid)} • Unpaid: {money(invoice.unpaid)}</div>
            </div>
          )}
          {hasInvoice && (
            <div className="relative ml-2" ref={menuRef}>
              <span
                role="button"
                tabIndex={0}
                aria-haspopup="menu"
                aria-controls={menuOpen ? `invoice-actions-menu-${id}` : undefined}
                data-testid="invoice-actions-btn"
                className="px-2 py-1 text-sm rounded border cursor-pointer select-none inline-flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') ) {
                    e.preventDefault();
                    setMenuOpen(o => !o);
                  } else if (e.key === 'ArrowDown') {
                    if (!menuOpen) setMenuOpen(true);
                    e.preventDefault();
                    setTimeout(() => {
                      const first = menuRef.current?.querySelector('[data-menu-item]') as HTMLElement | null;
                      first?.focus();
                    }, 0);
                  }
                }}
              >⋮</span>
              {menuOpen && (
                <div
                  id={`invoice-actions-menu-${id}`}
                  role="menu"
                  aria-label="Invoice actions menu"
                  className="absolute right-0 mt-1 w-44 bg-white border rounded shadow z-10 text-sm py-1"
                  data-testid="invoice-actions-menu"
                >
                  <div role="menuitem">
                    <button data-menu-item type="button" className="w-full text-left px-3 py-2 hover:bg-gray-50 focus:bg-gray-100 outline-none" onClick={onViewReceipt} data-testid="action-view-receipt">View Receipt</button>
                  </div>
                  <div role="menuitem">
                    <button data-menu-item type="button" className="w-full text-left px-3 py-2 hover:bg-gray-50 focus:bg-gray-100 outline-none" onClick={onDownloadPdf} data-testid="action-download-pdf">Download PDF</button>
                  </div>
                  <div role="menuitem">
                    <button data-menu-item type="button" className="w-full text-left px-3 py-2 hover:bg-gray-50 focus:bg-gray-100 outline-none" onClick={onEmail} data-testid="action-email">Email...</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
  </div>
      {menuOpen && (
        <span className="sr-only" data-testid="menu-open-announcer">Invoice actions menu open</span>
      )}
      {emailOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-20" role="dialog" aria-modal="true" data-testid="email-modal" onClick={() => { if(!sending) setEmailOpen(false); }}>
          <div className="bg-white rounded-md p-4 w-full max-w-sm shadow" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-3">Email Receipt</h2>
            <label className="block text-sm mb-2">
              <span className="block mb-1">Recipient Email</span>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" data-testid="email-input" placeholder="customer@example.com" />
            </label>
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" className="text-sm px-3 py-1 rounded border" onClick={() => !sending && setEmailOpen(false)}>Cancel</button>
              <button type="button" className="text-sm px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50" disabled={!email || sending} onClick={submitEmail} data-testid="send-email-btn">{sending ? 'Sending...' : 'Send'}</button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
};

// Side-effects outside component body for listeners
// (effects integrated into component)

export default TimelineRow;
