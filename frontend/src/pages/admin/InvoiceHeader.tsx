import React from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatDetailedCurrency } from '../../services/revenueService';

interface Props {
  id: string;
  status: string;
  totalCents: number;
  amountDueCents: number;
  amountPaidCents: number;
  customerName?: string;
  onRefresh?: () => void;
  onRecordPayment?: () => void;
  onVoid?: () => void;
}

const currency = (c: number) => formatDetailedCurrency(c / 100, true);

const statusVariant = (s: string): 'success' | 'warning' | 'destructive' | 'secondary' | 'default' => {
  switch (s) {
    case 'PAID': return 'success';
    case 'PARTIALLY_PAID': return 'warning';
    case 'VOID': return 'destructive';
    case 'SENT': return 'secondary';
    default: return 'default';
  }
};

export function InvoiceHeader({ id, status, totalCents, amountDueCents, amountPaidCents, customerName, onRefresh, onRecordPayment, onVoid }: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b pb-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Invoice <span className="font-mono text-sm">{id}</span></h1>
        {customerName && <div className="text-gray-600">Customer: {customerName}</div>}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant={statusVariant(status)}>{status}</Badge>
          <div className="text-sm text-gray-700">Total: <strong>{currency(totalCents)}</strong></div>
          <div className="text-sm text-gray-700">Paid: <strong>{currency(amountPaidCents)}</strong></div>
          <div className="text-sm text-gray-700">Due: <strong>{currency(amountDueCents)}</strong></div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onRefresh}>Refresh</Button>
        <Button
          variant="default"
          disabled={status === 'PAID' || status === 'VOID'}
          onClick={onRecordPayment}
          data-testid="record-payment-btn"
        >
          Record Payment
        </Button>
        <Button
          variant="destructive"
          disabled={status === 'PAID' || status === 'VOID'}
          onClick={onVoid}
          data-testid="void-invoice-btn"
        >
          Void Invoice
        </Button>
        {/* Future actions (record payment, void, send) */}
      </div>
    </div>
  );
}
