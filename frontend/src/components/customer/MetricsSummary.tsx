import React from 'react';
import { CustomerMetrics } from '@/lib/customerProfileApi';
import { formatCurrency } from '@/utils/format';

interface Props {
  metrics: CustomerMetrics;
}

type MetricFormatter = (v: unknown) => string;
const items: Array<{ key: keyof CustomerMetrics; label: string; format?: MetricFormatter }> = [
  { key: 'totalSpent', label: 'Lifetime Spend', format: v => formatCurrency(typeof v === 'number' ? v : Number(v)) },
  { key: 'visitsCount', label: 'Total Visits', format: v => `${typeof v === 'number' ? v : Number(v) || 0}` },
  { key: 'unpaidBalance', label: 'Unpaid Balance', format: v => formatCurrency(typeof v === 'number' ? v : Number(v)) },
  { key: 'lastVisitAt', label: 'Last Visit', format: v => (typeof v === 'string' && v ? new Date(v).toLocaleDateString() : '—') },
];

export function MetricsSummary({ metrics }: Props) {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4" data-testid="metrics-summary">
      {items.map(i => {
        const raw = metrics[i.key];
        const display = i.format ? i.format(raw) : (raw ?? '—');
        return (
          <div key={String(i.key)} className="p-4 rounded border bg-white shadow-sm flex flex-col" data-testid={`metric-${String(i.key)}`}>
            <span className="text-xs uppercase tracking-wide text-gray-500 font-medium">{i.label}</span>
            <span className="text-lg font-semibold mt-1 break-words">{display}</span>
          </div>
        );
      })}
    </div>
  );
}

export default MetricsSummary;
