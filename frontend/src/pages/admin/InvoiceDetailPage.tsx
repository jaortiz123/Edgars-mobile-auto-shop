import React, { useCallback, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchInvoice, recordInvoicePayment, voidInvoice } from '../../services/apiService';
import ServiceCatalogModal from '@/components/appointments/ServiceCatalogModal';
import { InvoiceHeader } from './InvoiceHeader';
import { InvoiceLineItemsTable } from './InvoiceLineItemsTable';
import { InvoicePaymentsList } from './InvoicePaymentsList';
import { Button } from '../../components/ui/Button';
import { RecordPaymentModal } from './RecordPaymentModal';
import { VoidInvoiceConfirmModal } from './VoidInvoiceConfirmModal';

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function InvoiceSkeleton() {
  return (
    <div className="p-6 space-y-8 max-w-5xl" data-testid="invoice-skeleton">
      <div className="space-y-4">
        <SkeletonLine className="h-6 w-64" />
        <div className="flex gap-3">
          <SkeletonLine className="h-5 w-20" />
          <SkeletonLine className="h-5 w-32" />
          <SkeletonLine className="h-5 w-24" />
        </div>
      </div>
      <div className="space-y-3">
        <SkeletonLine className="h-5 w-40" />
        <div className="border rounded-md">
          <div className="p-4 space-y-2">
            <SkeletonLine className="h-4 w-full" />
            <SkeletonLine className="h-4 w-5/6" />
            <SkeletonLine className="h-4 w-2/3" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <SkeletonLine className="h-5 w-32" />
        <SkeletonLine className="h-16 w-full" />
      </div>
    </div>
  );
}

export default function InvoiceDetailPage() {
  const { id = '' } = useParams();
  const queryKey = ['invoice', id];
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchInvoice(id),
    enabled: !!id,
  staleTime: 30_000,
  // Disable automatic retries so that error / not-found states surface immediately in UI & tests
  retry: false,
  });
  // Local mutable invoice/line item view so we can append package additions without full refetch latency.
  interface LocalInvoiceSummary { id: string; status: string; subtotal_cents: number; tax_cents?: number; total_cents: number; amount_paid_cents: number; amount_due_cents: number; customer_name?: string }
  interface LocalLineItem { id: string; name: string; quantity: number; unit_price_cents: number; line_subtotal_cents: number; tax_cents: number; total_cents: number; description?: string }
  const [invoiceSummary, setInvoiceSummary] = useState<LocalInvoiceSummary | null>(null);
  const [lineItemsState, setLineItemsState] = useState<LocalLineItem[] | null>(null);
  useEffect(() => {
    if (data) {
      setInvoiceSummary(data.invoice);
      // Normalize possible naming variants handled later (keep raw copy first load)
  // Prefer snake_case, fall back to camelCase if present.
  const li = (data.line_items || (data as unknown as { lineItems?: LocalLineItem[] }).lineItems || []) as LocalLineItem[];
  setLineItemsState(li);
    }
  }, [data]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const qc = useQueryClient();
  const [showCatalog, setShowCatalog] = useState(false);

  const paymentMutation = useMutation({
    mutationFn: async (vars: { amountCents: number; method: string; receivedDate?: string; note?: string }) => {
      return recordInvoicePayment(id, vars);
    },
    onSuccess: () => {
      setShowPaymentModal(false);
      setPaymentError(null);
      void qc.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      setPaymentError((err as Error).message || 'Failed to record payment');
    }
  });

  const voidMutation = useMutation({
    mutationFn: async () => voidInvoice(id),
    onSuccess: () => {
      setShowVoidModal(false);
      setVoidError(null);
      void qc.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      setVoidError((err as Error).message || 'Failed to void invoice');
    }
  });

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  if (!id) {
    return <div className="p-6">Missing invoice id</div>;
  }
  if (isLoading) {
    return <InvoiceSkeleton />;
  }
  if (isError) {
    const msg = (error as Error).message || 'Failed to load invoice';
    const notFound = /not.?found/i.test(msg) || /NOT_FOUND/.test(msg);
    return (
      <div className="p-6 space-y-4">
        <div className={`p-3 rounded ${notFound ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-700'}`} role="alert">
          {notFound ? 'Invoice not found' : msg}
        </div>
        {!notFound && <Button variant="outline" onClick={() => refetch()}>Retry</Button>}
      </div>
    );
  }
  if (!data) {
    return <div className="p-6">No data</div>;
  }
  // Use locally updated invoice summary if present
  const inv = invoiceSummary || data.invoice;
  interface NormalizedLineItem { id: string; name?: string; quantity?: number; unit_price_cents?: number; line_subtotal_cents?: number; tax_cents?: number; total_cents?: number; description?: string }
  interface NormalizedPayment { id: string; amount_cents?: number; method?: string; created_at?: string; note?: string }
  interface NormalizedData { line_items?: NormalizedLineItem[]; lineItems?: NormalizedLineItem[]; payments?: NormalizedPayment[] }
  // Preserve payments from original fetch; only line items may be locally mutated.
  const normalized: NormalizedData = { line_items: lineItemsState || data.line_items, payments: data.payments };
  const rawLineItems: NormalizedLineItem[] = (normalized.line_items || normalized.lineItems || []);
  const lineItems = rawLineItems.map(li => ({
    id: li.id,
    name: li.name || 'Item',
    quantity: li.quantity ?? 1,
    unit_price_cents: li.unit_price_cents ?? 0,
    line_subtotal_cents: li.line_subtotal_cents ?? li.unit_price_cents ?? 0,
    tax_cents: li.tax_cents ?? 0,
    total_cents: li.total_cents ?? li.unit_price_cents ?? 0,
    description: li.description,
  }));
  const payments: NormalizedPayment[] = (normalized.payments || []);
  return (
    <div className="p-6 space-y-8 max-w-5xl">
      <InvoiceHeader
        id={inv.id}
        status={inv.status}
        totalCents={inv.total_cents}
        amountDueCents={inv.amount_due_cents}
        amountPaidCents={inv.amount_paid_cents}
        customerName={inv.customer_name}
        onRefresh={onRefresh}
        onRecordPayment={() => setShowPaymentModal(true)}
  onVoid={() => setShowVoidModal(true)}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Line Items</h2>
          {inv.status !== 'VOID' && (
            <Button variant="outline" size="sm" data-testid="open-service-catalog-btn" onClick={() => setShowCatalog(true)}>Add Services / Package</Button>
          )}
        </div>
        <InvoiceLineItemsTable items={lineItems} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payments</h2>
  <InvoicePaymentsList payments={payments} />
      </section>

      {isFetching && <div className="text-xs text-gray-500">Refreshing...</div>}
      <RecordPaymentModal
        open={showPaymentModal}
        amountDueCents={inv.amount_due_cents}
        invoiceStatus={inv.status}
        onClose={() => { setShowPaymentModal(false); setPaymentError(null); }}
        onSubmit={(vals) => paymentMutation.mutate(vals)}
        submitting={paymentMutation.isPending}
        errorMessage={paymentError}
      />
      <VoidInvoiceConfirmModal
        open={showVoidModal}
        onCancel={() => { setShowVoidModal(false); setVoidError(null); }}
        onConfirm={() => voidMutation.mutate()}
        submitting={voidMutation.isPending}
        errorMessage={voidError}
      />
      {showCatalog && (
        <ServiceCatalogModal
          open={showCatalog}
          onClose={() => setShowCatalog(false)}
          onAdd={() => { /* Placeholder: individual service add not implemented */ }}
          invoiceId={inv.id}
          onInvoiceUpdated={(resp) => {
            setInvoiceSummary(resp.invoice);
            setLineItemsState(prev => {
              const existing = prev || [];
              // Avoid duplicate ids (overwrite if needed)
              const byId: Record<string, LocalLineItem> = {};
              [...existing, ...resp.added_line_items].forEach(li => { byId[li.id] = li as LocalLineItem; });
              return Object.values(byId) as LocalLineItem[];
            });
          }}
        />
      )}
    </div>
  );
}
