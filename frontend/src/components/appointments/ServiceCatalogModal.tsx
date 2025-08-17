import React, { useEffect, useMemo, useState } from 'react';

export type ServiceOperation = {
  id: string;
  internal_code?: string;
  name: string;
  category: string;
  subcategory?: string | null;
  skill_level?: number | null;
  default_hours?: number | null;
  base_labor_rate?: number | null;
  keywords?: string[] | null;
  is_active?: boolean;
  display_order?: number | null;
};

function compareByDisplayOrder(a: ServiceOperation, b: ServiceOperation) {
  const ao = a.display_order ?? Number.POSITIVE_INFINITY;
  const bo = b.display_order ?? Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;
  return a.name.localeCompare(b.name);
}

function formatHours(h: number | null | undefined) {
  if (h == null) return '—';
  return `${h.toFixed(2)} h`;
}
function formatPrice(p: number | null | undefined) {
  if (p == null) return '—';
  return `$${p.toFixed(2)}`;
}

async function fetchServiceOperations() {
  const resp = await fetch('/api/admin/service-operations', { credentials: 'include' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const list = Array.isArray(data) ? data : data?.service_operations;
  if (!Array.isArray(list)) return [];
  return list as ServiceOperation[];
}

interface ServiceCatalogModalProps {
  open: boolean;
  onClose(): void;
  onAdd(op: ServiceOperation): void; // immediate add when clicked
}

export const ServiceCatalogModal: React.FC<ServiceCatalogModalProps> = ({ open, onClose, onAdd }) => {
  const [services, setServices] = useState<ServiceOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true); setError(null);
    let cancelled = false;
    fetchServiceOperations()
      .then(list => {
        if (cancelled) return;
        // sort global once by display_order and name
        const sorted = [...list].sort(compareByDisplayOrder);
        setServices(sorted);
        const cats = Array.from(new Set(sorted.map(s => s.category))).filter(Boolean).sort();
        if (cats.includes('MAINTENANCE')) setSelectedCategory('MAINTENANCE'); else setSelectedCategory(cats[0] || null);
      })
      .catch(e => { if (!cancelled) setError(e.message || 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    services.forEach(s => {
      if (s.is_active === false) return;
      counts.set(s.category, (counts.get(s.category) || 0) + 1);
    });
    return Array.from(counts.entries()).sort(([a],[b]) => a.localeCompare(b));
  }, [services]);

  const filtered = useMemo(() => {
    return services
      .filter(s => s.is_active !== false)
      .filter(s => !selectedCategory || s.category === selectedCategory)
      .filter(s => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return s.name.toLowerCase().includes(q) || (s.internal_code || '').toLowerCase().includes(q) || (s.keywords || []).some(k => k.toLowerCase().includes(q));
      })
      .sort(compareByDisplayOrder);
  }, [services, selectedCategory, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-5xl h-[72vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">Service Catalog</h2>
          <button onClick={onClose} className="text-sm px-2 py-1 border rounded hover:bg-gray-100">Close</button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          {/* Left categories */}
          <div className="w-60 border-r flex flex-col">
            <div className="p-3">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1 overflow-auto pb-2">
              {loading && <div className="px-3 py-2 text-xs text-gray-500">Loading…</div>}
              {error && <div className="px-3 py-2 text-xs text-red-600">{error}</div>}
              {!loading && !error && (
                <ul className="space-y-1 px-2">
                  {categories.map(([cat,count]) => {
                    const active = cat === selectedCategory;
                    return (
                      <li key={cat}>
                        <button
                          onClick={() => setSelectedCategory(cat)}
                          className={`w-full text-left px-3 py-2 rounded text-sm border hover:bg-gray-50 ${active ? 'bg-gray-100 border-gray-400' : 'border-transparent'}`}
                        >
                          <span className="font-medium mr-2">{cat.replace(/_/g,' ')}</span>
                          <span className="text-xs text-gray-500">{count}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
          {/* Right list */}
          <div className="flex-1 flex flex-col">
            <div className="px-5 py-2 border-b bg-gray-50 text-sm text-gray-600 flex items-center justify-between">
              <div>
                {selectedCategory || 'All'} • {filtered.length} item{filtered.length!==1 && 's'}
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {loading && <div className="p-5 text-sm text-gray-500">Loading services…</div>}
              {error && <div className="p-5 text-sm text-red-600">{error}</div>}
              {!loading && !error && filtered.length === 0 && (
                <div className="p-6 text-sm text-gray-500">No services match.</div>
              )}
              {!loading && !error && filtered.length > 0 && (
                <ul className="divide-y">
                  {filtered.map(op => (
                    <li key={op.id}>
                      <button
                        onClick={() => onAdd(op)}
                        className="w-full flex items-start gap-4 px-5 py-3 text-left hover:bg-blue-50 focus:bg-blue-50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{op.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5 flex gap-2 flex-wrap">
                            {op.internal_code && <span>{op.internal_code}</span>}
                            {op.default_hours != null && <span>{formatHours(op.default_hours)}</span>}
                            {op.base_labor_rate != null && <span>{formatPrice(op.base_labor_rate)}</span>}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 self-center">{op.display_order ?? ''}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="px-5 py-2 border-t flex justify-end">
              <button onClick={onClose} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceCatalogModal;
