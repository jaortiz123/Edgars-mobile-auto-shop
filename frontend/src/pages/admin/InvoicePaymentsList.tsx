import React from 'react';
import { formatDetailedCurrency } from '../../services/revenueService';

interface Payment { id: string; amount_cents?: number; amount?: number; method?: string; created_at?: string; note?: string; }
interface Props { payments: Payment[]; }

const currency = (cents: number | undefined) => cents == null ? '—' : formatDetailedCurrency(cents / 100, true);

export function InvoicePaymentsList({ payments }: Props) {
  if (!payments.length) {
    return <div className="p-3 text-sm text-gray-500 border rounded-md">No payments recorded</div>;
  }
  return (
    <div className="space-y-2">
      {payments.map(p => (
        <div key={p.id} className="flex items-center justify-between border rounded-md p-3 text-sm">
          <div className="space-y-1">
            <div className="font-medium">{currency(p.amount_cents || (p.amount ? Math.round(p.amount * 100) : undefined))}</div>
            <div className="text-xs text-gray-500">{p.method || '—'}{p.created_at ? ` • ${new Date(p.created_at).toLocaleString()}` : ''}</div>
            {p.note && <div className="text-xs text-gray-500">{p.note}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
