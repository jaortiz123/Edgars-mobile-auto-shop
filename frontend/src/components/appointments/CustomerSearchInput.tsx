import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface CustomerSearchResultVehicle {
  vehicleId: string;
  plate?: string;
  vehicle?: string; // formatted make/model/year
}
export interface CustomerSearchResult {
  customerId: string;
  name: string;
  phone?: string;
  email?: string;
  vehicles: CustomerSearchResultVehicle[];
}

interface Props {
  value: CustomerSearchResult | null;
  onChange: (customer: CustomerSearchResult | null) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_ENDPOINT_URL || '';

async function searchCustomersRaw(q: string): Promise<CustomerSearchResult[]> {
  if (!q.trim()) return [];
  const params = new URLSearchParams({ q: q.trim(), limit: '10' });
  const res = await fetch(`${API_BASE_URL}/api/admin/customers/search?${params.toString()}`);
  const json = await res.json();
  const items: Array<{ customerId: string; name: string; phone?: string; email?: string; vehicleId: string; plate?: string; vehicle?: string; visitsCount?: number; lastVisit?: string | null; }> = json.data?.items || [];
  const grouped: Record<string, CustomerSearchResult> = {};
  for (const it of items) {
    if (!grouped[it.customerId]) grouped[it.customerId] = { customerId: it.customerId, name: it.name, phone: it.phone, email: it.email, vehicles: [] };
    grouped[it.customerId].vehicles.push({ vehicleId: it.vehicleId, plate: it.plate, vehicle: it.vehicle });
  }
  return Object.values(grouped);
}

export const CustomerSearchInput: React.FC<Props> = ({ value, onChange, placeholder = 'Search customer by name, phone, or email…', disabled, autoFocus, label = 'Customer' }) => {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setDebounced(query), 300);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [query]);

  const runSearch = useCallback(async (term: string) => {
    if (!term.trim()) { setResults([]); setError(null); return; }
    setLoading(true); setError(null);
    try {
      const r = await searchCustomersRaw(term);
      setResults(r);
    } catch (e) {
      setError((e as Error).message || 'Search failed');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void runSearch(debounced); }, [debounced, runSearch]);

  const handleSelect = (cust: CustomerSearchResult) => {
    onChange(cust);
    setQuery(cust.name);
    setOpen(false);
  };

  return (
    <div className="space-y-1" ref={wrapRef}>
      <label className="block text-sm font-medium text-gray-700" htmlFor="appt-customer">{label}</label>
      <div className="relative">
  <input
          id="appt-customer"
          ref={inputRef}
          type="text"
          value={value ? value.name : query}
          onChange={e => { setQuery(e.target.value); if (value) onChange(null); setOpen(true); }}
          onFocus={() => { if (!disabled) setOpen(true); }}
          placeholder={placeholder}
          className="w-full border rounded px-3 py-2"
          disabled={disabled}
          autoFocus={autoFocus}
        />
        {loading && <div className="absolute inset-y-0 right-2 flex items-center text-xs text-gray-400">…</div>}
        {open && (query.trim() || error) && (
          <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-white shadow-lg text-sm" id="customer-search-list">
            {error && <li className="px-3 py-2 text-red-600">{error}</li>}
            {!error && results.length === 0 && !loading && <li className="px-3 py-2 text-gray-500">No matches</li>}
            {results.map(c => (
              <li key={c.customerId} className="px-0">
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 hover:bg-blue-50 flex flex-col ${value?.customerId === c.customerId ? 'bg-blue-50' : ''}`}
                  onClick={() => handleSelect(c)}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-gray-500 flex flex-wrap gap-2">
                    {c.phone && <span>{c.phone}</span>}
                    {c.email && <span>{c.email}</span>}
                    {c.vehicles.length > 0 && <span>{c.vehicles.length} vehicle{c.vehicles.length>1?'s':''}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {value && (
        <div className="text-xs text-gray-600">Selected: {value.name}{value.phone?` • ${value.phone}`:''}</div>
      )}
    </div>
  );
};

export default CustomerSearchInput;
