import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CustomerCard, { CustomerVehicleInfo } from '@/components/admin/CustomerCard';
import FilterChips, { CustomerFilter } from '@/components/admin/FilterChips';
import SortDropdown, { CustomerSort } from '@/components/admin/SortDropdown';
import { fetchRecentCustomers, RecentCustomerRecord } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

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
  totalSpent?: number;
  lastServiceAt?: string | null;
  isVip?: boolean;
  isOverdueForService?: boolean;
};


async function searchCustomers(q: string, filter: CustomerFilter, sortBy: CustomerSort): Promise<SearchItem[]> {
  if (!q.trim()) return [];
  const controller = new AbortController();
  const params = new URLSearchParams({ q: q.trim(), limit: '25' });
  if (filter && filter !== 'all') params.append('filter', filter);
  if (sortBy && sortBy !== 'relevance') params.append('sortBy', sortBy);
  const res = await fetch(`${API_BASE_URL}/api/admin/customers/search?${params.toString()}`, { signal: controller.signal });
  const json = await res.json();
  return json.data?.items || [];
}


export default function CustomersPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeFilter, setActiveFilter] = useState<CustomerFilter>('all');
  const [sortBy, setSortBy] = useState<CustomerSort>('relevance');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentCustomerRecord[] | null>(null); // null = not yet loaded
  const debounceRef = useRef<number | undefined>(undefined);

  // Debounce input -> debounced value
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setDebounced(query), 300);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [query]);

  const runSearch = useCallback(async (term: string, filter: CustomerFilter, sort: CustomerSort) => {
    if (!term.trim()) { setResults([]); setError(null); return; }
    setLoading(true); setError(null);
    try {
      const items = await searchCustomers(term.trim(), filter, sort);
      setResults(items);
    } catch (e) {
      setError((e as Error).message || 'Search failed');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { runSearch(debounced, activeFilter, sortBy); }, [debounced, activeFilter, sortBy, runSearch]);

  // Load recent customers once on mount (Phase 2 Step 1)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchRecentCustomers(8);
        if (!cancelled) setRecent(list);
      } catch {
        if (!cancelled) setRecent([]); // fail silent; UX just shows initial text
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
      <div className="mb-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by plate, name, phone, or email…"
          className="w-full border rounded-lg px-3 py-2"
          data-testid="customers-search"
        />
      </div>
      {!!debounced.trim() && (
        <div className="mb-4 flex flex-wrap items-center gap-4" data-testid="customers-filters-wrapper">
          <FilterChips active={activeFilter} onChange={f => setActiveFilter(f)} />
          <SortDropdown value={sortBy} onChange={v => setSortBy(v)} />
        </div>
      )}
      {error && <div className="text-sm text-red-600 mb-3" data-testid="customers-error">{error}</div>}
      {loading && <div className="text-sm text-gray-500 mb-3" data-testid="customers-loading">Searching…</div>}
      <div className="flex-1" data-testid="customers-content">
        {state === 'initial' && (
          <div className="p-4 space-y-4" data-testid="customers-initial">
            <div className="text-gray-500 text-sm">Type above to search for customers by name, contact, or plate.</div>
            {recent && recent.length > 0 && (
              <div data-testid="recent-customers-section">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-gray-700">Recent Customers</h2>
                  <span className="text-xs text-gray-400">Last {recent.length}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="recent-customers-grid">
                  {recent.map(rc => {
                    const extraBadges: string[] = ['Recent'];
                    if ((rc as RecentCustomerRecord & { isVip?: boolean }).isVip) extraBadges.unshift('VIP');
                    if ((rc as RecentCustomerRecord & { isOverdueForService?: boolean }).isOverdueForService) extraBadges.push('Overdue');
                    return (
                      <CustomerCard
                        key={rc.customerId}
                        customerId={rc.customerId}
                        name={rc.name}
                        phone={rc.phone}
                        email={rc.email}
                        vehicles={rc.vehicles.map(v => ({ vehicleId: v.vehicleId, plate: v.plate, vehicle: v.vehicle })) as CustomerVehicleInfo[]}
                        totalSpent={rc.totalSpent}
                        isVip={(rc as RecentCustomerRecord & { isVip?: boolean }).isVip}
                        isOverdueForService={(rc as RecentCustomerRecord & { isOverdueForService?: boolean }).isOverdueForService}
                        badges={extraBadges}
                        onViewHistory={() => navigate(`/admin/customers/${rc.customerId}`)}
                        onBookAppointment={() => {
                          // Placeholder: emit global event for booking drawer
                          window.dispatchEvent(new CustomEvent('open-booking-drawer', { detail: { customerId: rc.customerId, name: rc.name } }));
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
            {recent && recent.length === 0 && (
              <div className="text-xs text-gray-400" data-testid="recent-customers-empty">No recent customers found.</div>
            )}
          </div>
        )}
        {state === 'empty' && (
          <div className="text-gray-500 text-sm p-6" data-testid="customers-empty">No customers matched your search.</div>
        )}
        {state === 'results' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="customers-results-grid">
            {customerCards.map(c => {
              // For now search results don't surface totalSpent per vehicle; rely on top-level fields if present later
              const isVip = (c as unknown as { isVip?: boolean }).isVip;
              const isOverdue = (c as unknown as { isOverdueForService?: boolean }).isOverdueForService;
              return (
                <CustomerCard
                  key={c.customerId}
                  customerId={c.customerId}
                  name={c.name}
                  phone={c.phone}
                  email={c.email}
                  vehicles={c.vehicles}
                  totalSpent={undefined}
                  isVip={isVip}
                  isOverdueForService={isOverdue}
                  onViewHistory={() => navigate(`/admin/customers/${c.customerId}`)}
                  onBookAppointment={() => {
                    window.dispatchEvent(new CustomEvent('open-booking-drawer', { detail: { customerId: c.customerId, name: c.name } }));
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
