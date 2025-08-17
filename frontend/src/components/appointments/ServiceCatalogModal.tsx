import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export interface ServiceLite {
  id: string;
  name: string;
  defaultPrice?: number | null;
  category?: string | null;
}

interface ServiceCatalogModalProps {
  open: boolean;
  initialSelected: ServiceLite[];
  onConfirm(selected: ServiceLite[]): void;
  onClose(): void;
}

interface ApiRow {
  id: string; name: string; default_price?: number | null; category?: string | null;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const ServiceCatalogModal: React.FC<ServiceCatalogModalProps> = ({ open, initialSelected, onConfirm, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<ServiceLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftMap, setDraftMap] = useState<Map<string, ServiceLite>>(new Map());
  const cacheRef = useRef<Map<string, ServiceLite[]>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<number | null>(null);

  // Initialize draft selections when opened
  useEffect(() => {
    if (open) {
      const m = new Map<string, ServiceLite>();
      initialSelected.forEach(s => m.set(s.id, s));
      setDraftMap(m);
      setSearchTerm('');
      setResults([]);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open, initialSelected]);

  const draftSelected = useMemo(() => Array.from(draftMap.values()), [draftMap]);
  const draftIds = useMemo(() => new Set(draftMap.keys()), [draftMap]);

  const performSearch = useCallback(async (term: string) => {
    const q = term.trim();
    if (q.length < 2) { setResults([]); setError(null); return; }
    if (cacheRef.current.has(q)) { setResults(cacheRef.current.get(q)!); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ q, limit: '25' });
  // Include auth header if token present (admin endpoint requires bearer token)
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const resp = await fetch(`${API_BASE}/admin/service-operations?${params.toString()}`, { signal: controller.signal, headers });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const rows: ApiRow[] = data.service_operations || data.services || [];
      const mapped = rows.map(r => ({ id: r.id, name: r.name, defaultPrice: r.default_price ?? null, category: r.category ?? null }));
      cacheRef.current.set(q, mapped);
      setResults(mapped);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // ignore
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally { setLoading(false); }
  }, []);

  // Debounce search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => { void performSearch(searchTerm); }, 300);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [searchTerm, performSearch, open]);

  // Keyboard: ESC closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  function toggleSelect(s: ServiceLite) {
    setDraftMap(prev => {
      const m = new Map(prev);
      if (m.has(s.id)) m.delete(s.id); else m.set(s.id, s);
      return m;
    });
  }

  function handleConfirm() {
    onConfirm(draftSelected);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6" role="dialog" aria-modal="true" aria-labelledby="svc-cat-title">
      <div className="w-full max-w-2xl rounded bg-white text-gray-900 shadow-xl flex flex-col max-h-[80vh]">
        <div className="border-b px-4 py-3 flex items-center gap-3">
          <h2 id="svc-cat-title" className="text-lg font-semibold flex-1 text-gray-900">Add Services</h2>
          <button onClick={onClose} className="text-sm px-2 py-1 border rounded text-gray-700 hover:bg-gray-100" type="button">Close</button>
        </div>
        <div className="p-4 pt-3 space-y-3">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search services (min 2 chars)..."
              aria-label="Search services"
              data-testid="service-search-input"
              className="flex-1 border rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {searchTerm && <button type="button" className="px-3 py-2 border rounded" onClick={() => setSearchTerm('')}>Clear</button>}
          </div>
          <div className="text-xs text-gray-600 flex items-center gap-2" aria-live="polite">
            <span>{loading ? 'Loading…' : error ? `Error: ${error}` : results.length ? `${results.length} result${results.length!==1?'s':''}` : 'Enter at least 2 characters to search'}</span>
            {draftSelected.length > 0 && <span className="ml-auto font-medium">{draftSelected.length} selected</span>}
          </div>
          <div className="border rounded overflow-hidden min-h-[180px] bg-white">
            <ul ref={listRef} className="max-h-64 overflow-auto divide-y" aria-label="Service results" data-testid="service-results-list">
              {error && (
                <li className="p-3 text-red-600 flex justify-between items-center bg-red-50">
                  <span className="truncate">{error}</span>
                  <button type="button" onClick={() => performSearch(searchTerm)} className="text-xs underline">Retry</button>
                </li>
              )}
              {!error && loading && <li className="p-3 text-gray-500">Loading…</li>}
              {!error && !loading && results.length === 0 && searchTerm.length >= 2 && <li className="p-3 text-gray-500">No services found</li>}
              {results.map(s => {
                const selected = draftIds.has(s.id);
                return (
                  <li key={s.id} className="p-0">
                    <button
                      type="button"
                      onClick={() => toggleSelect(s)}
                      className={`w-full text-left px-3 py-2 flex gap-3 items-start hover:bg-blue-50 focus:bg-blue-50 ${selected ? 'bg-blue-50' : ''}`}
                      data-testid={`service-result-${s.id}`}
                    >
                      <span className="flex-1">
                        <span className="font-medium block">{s.name}</span>
                        <span className="text-xs text-gray-600 flex gap-2 flex-wrap">
                          {s.category && <span>{s.category}</span>}
                          {s.defaultPrice != null && <span>${s.defaultPrice.toFixed(2)}</span>}
                        </span>
                      </span>
                      <span className="text-xs text-gray-600">{selected ? '✓' : '+'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
    <div className="mt-auto border-t px-4 py-3 flex gap-3 justify-end">
      <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100">Cancel</button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={draftSelected.length === 0}
              className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="service-add-confirm-btn"
            >
              Add {draftSelected.length || ''} {draftSelected.length===1?'Service':'Services'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceCatalogModal;
