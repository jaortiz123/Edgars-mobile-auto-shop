import React, { useEffect, useState, useCallback } from 'react';
import { fetchInvoices, InvoiceListResponse } from '../../services/apiService';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

interface TableState {
  page: number;
  pageSize: number;
}

const currency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// Limit returned values to Badge variant union
const statusVariant = (status: string): 'success' | 'warning' | 'destructive' | 'secondary' | 'default' => {
  switch (status) {
    case 'PAID': return 'success';
    case 'PARTIALLY_PAID': return 'warning';
    case 'VOID': return 'destructive';
    case 'SENT': return 'secondary';
    default: return 'default';
  }
};

export default function InvoicesPage() {
  const [table, setTable] = useState<TableState>({ page: 1, pageSize: 20 });
  const [data, setData] = useState<InvoiceListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true); setError(null);
    try {
      const resp = await fetchInvoices({ page: table.page, pageSize: table.pageSize });
      setData(resp);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load invoices';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [table.page, table.pageSize]);
  // Re-fetch whenever pagination changes
  useEffect(() => { load(); }, [load]);

  const nextPage = () => {
    if (data && table.page < data.total_pages) setTable(t => ({ ...t, page: t.page + 1 }));
  };
  const prevPage = () => {
    if (table.page > 1) setTable(t => ({ ...t, page: t.page - 1 }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</Button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded" role="alert">{error}</div>}
      {loading && !data && <div>Loading invoices...</div>}

      {data && (
        <div className="overflow-x-auto border rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Invoice ID</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Amount Due</th>
                <th className="px-3 py-2 text-left">Issued</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-gray-500">No invoices found</td>
                </tr>
              )}
              {data.items.map(inv => (
                <tr key={inv.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs max-w-[140px] truncate" title={inv.id}>{inv.id}</td>
                  <td className="px-3 py-2">{inv.customer_name || '—'}</td>
                  <td className="px-3 py-2"><Badge variant={statusVariant(inv.status)}>{inv.status}</Badge></td>
                  <td className="px-3 py-2 text-right">{currency(inv.total_cents)}</td>
                  <td className="px-3 py-2 text-right">{currency(inv.amount_due_cents)}</td>
                  <td className="px-3 py-2">{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString() : '—'}</td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="outline" onClick={() => {/* TODO: navigate to detail */}}>View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between p-3 bg-gray-50 text-sm">
            <div>Page {data.page} of {data.total_pages} • {data.total_items} total</div>
            <div className="space-x-2">
              <Button size="sm" variant="outline" disabled={table.page === 1} onClick={prevPage}>Prev</Button>
              <Button size="sm" variant="outline" disabled={data.page >= data.total_pages} onClick={nextPage}>Next</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
