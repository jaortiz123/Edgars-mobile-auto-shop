import { useEffect, useState } from 'react';
import { formatInShopTZ } from '@/lib/timezone';

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

type Visit = {
  id: string;
  status: string;
  start?: string | null;
  end?: string | null;
  price: number;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  vehicle?: string;
  plate?: string | null;
  services?: Array<{ id: string; name: string; notes?: string | null; estimated_price?: number | null }>;
  notes?: Array<{ id: string; channel: string; direction: string; body: string; status: string; created_at: string }>;
};

async function searchCustomers(q: string): Promise<SearchItem[]> {
  if (!q.trim()) return [];
  const res = await fetch(`${API_BASE_URL}/api/admin/customers/search?q=${encodeURIComponent(q)}&limit=25`);
  const json = await res.json();
  return json.data?.items || [];
}

async function fetchCustomerVisits(customerId: string): Promise<Visit[]> {
  const res = await fetch(`${API_BASE_URL}/api/admin/customers/${customerId}/visits`);
  const json = await res.json();
  return json.data?.visits || [];
}

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [selected, setSelected] = useState<SearchItem | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) {
        setResults([]);
        setSelected(null);
        setVisits([]);
        return;
      }
      setLoading(true);
      try {
        const items = await searchCustomers(q.trim());
        setResults(items);
        if (items.length) {
          // Prefer an exact plate match when query looks like a plate
          const exact = items.find(i => (i.plate || '').toLowerCase() === q.trim().toLowerCase());
          setSelected(exact || items[0]);
        } else {
          setSelected(null);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!selected) { setVisits([]); return; }
    setVisitsLoading(true);
    fetchCustomerVisits(selected.customerId)
      .then(setVisits)
      .finally(() => setVisitsLoading(false));
  }, [selected]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Customers</h1>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by plate, name, phone, or email…"
            className="w-full border rounded-lg px-3 py-2"
          />
          <div className="mt-3 border rounded-lg divide-y max-h-[70vh] overflow-y-auto" data-testid="customer-results">
            {loading && <div className="p-3 text-sm text-gray-500">Searching…</div>}
            {!loading && results.length === 0 && <div className="p-3 text-sm text-gray-500">No customers</div>}
            {results.map((c) => (
              <button
                key={`${c.vehicleId}:${c.customerId}`}
                className={`w-full text-left p-3 hover:bg-gray-50 ${selected?.vehicleId === c.vehicleId ? 'bg-blue-50' : ''}`}
                onClick={() => setSelected(c)}
              >
                <div className="font-mono text-sm">{c.plate || '—'}</div>
                <div className="text-sm">{c.vehicle || 'Vehicle'}</div>
                <div className="text-xs text-gray-500">{c.name} {c.phone ? `• ${c.phone}` : ''} {c.email ? `• ${c.email}` : ''}</div>
                <div className="text-xs text-gray-500">{c.visitsCount} visit{c.visitsCount === 1 ? '' : 's'} {c.lastVisit ? `• Last: ${formatInShopTZ(c.lastVisit, 'date')}` : ''}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-8">
          {selected ? (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-lg">{selected.plate || '—'}</div>
                  <div className="text-gray-600">{selected.vehicle || 'Vehicle'}</div>
                  <div className="text-sm text-gray-600">{selected.name} {selected.phone ? `• ${selected.phone}` : ''} {selected.email ? `• ${selected.email}` : ''}</div>
                </div>
              </div>

              <h3 className="mt-6 mb-2 font-semibold">Past Visits</h3>
              <div className="border rounded-lg divide-y" data-testid="customer-visits">
                {visitsLoading && <div className="p-3 text-sm text-gray-500">Loading visits…</div>}
                {!visitsLoading && visits.length === 0 && (
                  <div className="p-3 text-sm text-gray-500">No visits</div>
                )}
                {visits.map((v) => (
                  <div key={v.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{formatInShopTZ(v.start || v.end, 'datetime')} • {v.status.replace('_', ' ')}</div>
                        <div className="text-sm text-gray-600">{v.vehicle || 'Vehicle N/A'} {v.plate ? `• ${v.plate}` : ''}</div>
                      </div>
                      <div className="text-sm"><span className="font-semibold">${(v.price || 0).toFixed(2)}</span></div>
                    </div>
                    {v.services && v.services.length > 0 && (
                      <div className="mt-2 text-sm text-gray-700">
                        <div className="font-medium">Services</div>
                        <ul className="list-disc ml-5">
                          {v.services.map(s => (
                            <li key={s.id}>{s.name}{s.estimated_price ? ` — $${Number(s.estimated_price).toFixed(2)}` : ''}{s.notes ? ` — ${s.notes}` : ''}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {v.notes && v.notes.length > 0 && (
                      <div className="mt-2 text-sm text-gray-700">
                        <div className="font-medium">Notes</div>
                        <ul className="list-disc ml-5">
                          {v.notes.map(n => (
                            <li key={n.id}><span className="uppercase text-xs text-gray-500">{n.channel}/{n.direction}</span> — {n.body}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-gray-500 p-6">Search and pick a customer or plate to view their history.</div>
          )}
        </div>
      </div>
    </div>
  );
}
