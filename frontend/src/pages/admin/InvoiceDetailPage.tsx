import React, { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchInvoice, recordInvoicePayment, voidInvoice } from '../../services/apiService';
import { InvoiceHeader } from './InvoiceHeader';
import { InvoiceLineItemsTable } from './InvoiceLineItemsTable';
import { InvoicePaymentsList } from './InvoicePaymentsList';
import ServiceCatalogModal, { ServiceOperation } from '@/components/appointments/ServiceCatalogModal';
import { http } from '@/lib/api';
import { toast } from '@/lib/toast';
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const qc = useQueryClient();
  const [showCatalog, setShowCatalog] = useState(false);
  // Local optimistic line items state (undefined means not overridden)
  const [optimisticLineItems, setOptimisticLineItems] = useState<NormalizedLineItem[] | null>(null);

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
  // Normalize backend field naming that may be camelCase (lineItems) or snake_case (line_items)
  const inv = data.invoice;
  interface NormalizedLineItem { id: string; name: string; quantity: number; unit_price_cents: number; line_subtotal_cents: number; tax_cents: number; total_cents: number; description?: string }
  interface NormalizedPayment { id: string; amount_cents?: number; method?: string; created_at?: string; note?: string }
  interface NormalizedData { line_items?: NormalizedLineItem[]; lineItems?: NormalizedLineItem[]; payments?: NormalizedPayment[] }
  const normalized: NormalizedData = data as unknown as NormalizedData;
  type RawLineItem = Partial<NormalizedLineItem> & { id: string };
  const rawLineItems: RawLineItem[] = (normalized.line_items || normalized.lineItems || []) as RawLineItem[];
  const baseLineItems: NormalizedLineItem[] = rawLineItems.map(li => ({
    id: li.id,
    name: li.name || 'Item',
    quantity: li.quantity ?? 1,
    unit_price_cents: li.unit_price_cents ?? 0,
    line_subtotal_cents: li.line_subtotal_cents ?? li.unit_price_cents ?? 0,
    tax_cents: li.tax_cents ?? 0,
    total_cents: li.total_cents ?? li.unit_price_cents ?? 0,
    description: li.description,
  }));
  const lineItems = optimisticLineItems || baseLineItems;
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              data-testid="open-service-catalog-btn"
              onClick={() => setShowCatalog(true)}
            >Add Service / Package</Button>
          </div>
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
      <ServiceCatalogModal
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        onAdd={(op: ServiceOperation) => {
          // If it's a package call add-package endpoint, else (future) single service add placeholder
          if (op.is_package) {
            (async () => {
              try {
                const resp = await http.post(`/admin/invoices/${id}/add-package`, { package_id: op.id });
                const json = resp.data;
                // Shape expected: { added_line_items: [...], package_name, added_subtotal_cents }
                const added = (json.added_line_items || json.data?.added_line_items || []) as NormalizedLineItem[];
                if (added.length) {
                  // Merge optimistically (append). Keep prior baseLineItems to avoid duplication on refetch.
                  setOptimisticLineItems(prev => {
                    const current = prev || baseLineItems;
                    // Filter out any duplicates by id
                    const existingIds = new Set(current.map(i => i.id));
                    const mapped: NormalizedLineItem[] = added.filter(li => !existingIds.has(li.id)).map(li => {
                      const name = (li as RawLineItem).name || (li as RawLineItem).description || 'Item';
                      return {
                        id: (li as RawLineItem).id,
                        name,
                        quantity: (li as RawLineItem).quantity ?? 1,
                        unit_price_cents: (li as RawLineItem).unit_price_cents ?? 0,
                        line_subtotal_cents: (li as RawLineItem).line_subtotal_cents ?? (li as RawLineItem).unit_price_cents ?? 0,
                        tax_cents: (li as RawLineItem).tax_cents ?? 0,
                        total_cents: (li as RawLineItem).total_cents ?? (li as RawLineItem).unit_price_cents ?? 0,
                        description: (li as RawLineItem).description,
                      };
                    });
                    return [...current, ...mapped];
                  });
                  // Toast message contains count for test regex /Added 2 item/
                  const count = added.length;
                  toast.success(`Added ${count} item${count === 1 ? '' : 's'}`);
                }
                setShowCatalog(false);
              } catch {
                toast.error('Failed to add package');
              }
            })();
          } else {
            // Non-package: future enhancement; close modal for now.
            setShowCatalog(false);
          }
        }}
      />
    </div>
  );
}
