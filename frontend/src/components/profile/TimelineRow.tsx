import React from 'react';
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
  return (
  <li key={id} className="p-0 m-0" data-testid={testId || 'timeline-row'}>
      <button
        type="button"
        tabIndex={tabIndex}
        aria-current={active || undefined}
        data-active={active ? 'true' : undefined}
        className={`w-full text-left p-3 focus:outline-none focus:ring-2 focus:ring-ring rounded-xl ${active ? 'bg-accent/30' : ''}`}
        onClick={onActivate}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.currentTarget.click(); return; }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            // Delegate to parent roving handler but avoid duplicate bubbling handling.
            onArrowNav(e);
            e.stopPropagation();
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{dtLocal(date)}</div>
            <div className="text-xs opacity-70">{status}</div>
            <div className="text-xs mt-1">{services.map(s => s.name).join(', ')}</div>
          </div>
          {invoice && (
            <div className="text-right text-sm">
              <div>Total: {money(invoice.total)}</div>
              <div className="opacity-70">Paid: {money(invoice.paid)} • Unpaid: {money(invoice.unpaid)}</div>
            </div>
          )}
        </div>
      </button>
    </li>
  );
};

export default TimelineRow;
