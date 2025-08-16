import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CustomerCard, { CustomerVehicleInfo } from '@/components/admin/CustomerCard';

const API_BASE_URL = import.meta.env.VITE_API_ENDPOINT_URL || '';

type SearchItem = {
  vehicleId: string;
  customerId: string;
  name: string;
  phone?: string;
  email?: string;
  plate?: string;
  vehicle?: string;
  visitsCount: number;
  lastVisit?: string | null;
};


async function searchCustomers(q: string): Promise<SearchItem[]> {
  if (!q.trim()) return [];
  const controller = new AbortController();
  const res = await fetch(`${API_BASE_URL}/api/admin/customers/search?q=${encodeURIComponent(q)}&limit=25`, { signal: controller.signal });
  const json = await res.json();
  return json.data?.items || [];
}


export default function CustomersPage() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  // Debounce input -> debounced value
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setDebounced(query), 300);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [query]);

  const runSearch = useCallback(async (term: string) => {
    if (!term.trim()) { setResults([]); setError(null); return; }
    setLoading(true); setError(null);
    try {
      const items = await searchCustomers(term.trim());
      setResults(items);
    } catch (e) {
      setError((e as Error).message || 'Search failed');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { runSearch(debounced); }, [debounced, runSearch]);

  // Transform results -> aggregated customers (group by customerId w/ vehicles list)
  const customerCards = useMemo(() => {
    const byCustomer: Record<string, { name: string; phone?: string; email?: string; vehicles: CustomerVehicleInfo[] }> = {};
    results.forEach(r => {
      if (!byCustomer[r.customerId]) byCustomer[r.customerId] = { name: r.name, phone: r.phone, email: r.email, vehicles: [] };
      byCustomer[r.customerId].vehicles.push({ vehicleId: r.vehicleId, plate: r.plate, vehicle: r.vehicle, visitsCount: r.visitsCount, lastVisit: r.lastVisit });
    });
    return Object.entries(byCustomer).map(([customerId, data]) => ({ customerId, ...data }));
  }, [results]);

  // 3 UI states for main content
  const state: 'initial' | 'empty' | 'results' = !debounced.trim() ? 'initial' : (customerCards.length === 0 && !loading ? 'empty' : 'results');

  return (
    <div className="flex flex-col h-full" data-testid="customers-page">
      <h1 className="text-2xl font-semibold mb-4">Customers</h1>
      <div className="mb-4">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by plate, name, phone, or email…"
          className="w-full border rounded-lg px-3 py-2"
          data-testid="customers-search"
        />
      </div>
      {error && <div className="text-sm text-red-600 mb-3" data-testid="customers-error">{error}</div>}
      {loading && <div className="text-sm text-gray-500 mb-3" data-testid="customers-loading">Searching…</div>}
      <div className="flex-1" data-testid="customers-content">
        {state === 'initial' && (
          <div className="text-gray-500 text-sm p-6" data-testid="customers-initial">Type above to search for customers by name, contact, or plate.</div>
        )}
        {state === 'empty' && (
          <div className="text-gray-500 text-sm p-6" data-testid="customers-empty">No customers matched your search.</div>
        )}
        {state === 'results' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="customers-results-grid">
            {customerCards.map(c => (
              <CustomerCard
                key={c.customerId}
                customerId={c.customerId}
                name={c.name}
                phone={c.phone}
                email={c.email}
                vehicles={c.vehicles}
                onViewHistory={() => {/* Placeholder CTA for Phase 1 */}}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
