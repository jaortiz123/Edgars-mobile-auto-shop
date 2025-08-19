import React, { useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@/services/telemetry';
import { ChevronDown, ChevronRight } from 'lucide-react';

export type ServiceOperation = {
  id: string;
  internal_code: string;
  name: string;
  category: string;
  subcategory: string | null;
  skill_level: number | null;
  default_hours: number | null;
  base_labor_rate: number | null;
  keywords: string[] | null;
  is_active: boolean;
  display_order: number | null;
  // Package specific fields (optional; present when this service represents a package)
  is_package?: boolean;
  package_items?: { child_id: string; quantity: number }[]; // minimal shape needed for UI/test
};

function formatHours(h: number | null) { return h == null ? '—' : `${h.toFixed(2)} h`; }
function formatPrice(p: number | null) { return p == null ? '—' : `$${p.toFixed(2)}`; }
function compareByDisplayOrder(a: ServiceOperation, b: ServiceOperation) { const ao = a.display_order ?? Number.POSITIVE_INFINITY; const bo = b.display_order ?? Number.POSITIVE_INFINITY; return ao !== bo ? ao - bo : a.name.localeCompare(b.name); }
function matchesQuery(s: ServiceOperation, q: string) { if (!q) return true; const hay = `${s.name} ${(s.keywords || []).join(' ')}`.toLowerCase(); return hay.includes(q.toLowerCase()); }

async function fetchServices() {
  const resp = await fetch('/api/admin/service-operations');
  // (debug log removed after resolving test hang root cause)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const list = Array.isArray(data) ? data : data?.service_operations;
  if (!Array.isArray(list)) return [];
  return list as ServiceOperation[];
}

interface Props { open: boolean; onClose(): void; onAdd(op: ServiceOperation): void; onConfirm?(selected: ServiceOperation[]): void; }

export const ServiceCatalogModal: React.FC<Props> = ({ open, onClose, onAdd, onConfirm }) => {
  const [services, setServices] = useState<ServiceOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
  // Verification telemetry event for catalog open
  try { track('app.catalog_open', { ts_client: Date.now() }); } catch { /* ignore */ }
    (async () => {
      try {
        setLoading(true); setError(null);
        const list = await fetchServices();
        if (cancelled) return;
        list.sort(compareByDisplayOrder);
  setServices(list);
        const cats = Array.from(new Set(list.map(s => s.category))).sort();
  setSelectedCategory(cats.includes('MAINTENANCE') ? 'MAINTENANCE' : (cats[0] || null));
  } catch (e) { if (!cancelled && e instanceof Error) setError(e.message || 'Failed to load'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [open]);


  useEffect(() => { if (open) { const t = setTimeout(() => searchRef.current?.focus(), 0); return () => clearTimeout(t); } }, [open]);

  // When user types a query, broaden search to all categories for convenience
  useEffect(() => {
    if (query) {
      setSelectedCategory(null);
    }
  }, [query]);


  const categories = useMemo(() => {
    const m = new Map<string, number>();
    services.forEach(s => { if (!s.is_active) return; m.set(s.category, (m.get(s.category)||0)+1); });
    return Array.from(m.entries()).sort(([a],[b]) => a.localeCompare(b));
  }, [services]);

  const filtered = useMemo(() => services
    .filter(s => s.is_active)
    .filter(s => !selectedCategory || s.category === selectedCategory)
    .filter(s => matchesQuery(s, query))
    .sort(compareByDisplayOrder), [services, selectedCategory, query]);

  const grouped = useMemo(() => {
    // Build groups keyed by subcategory (or 'Other').
    const m = new Map<string, ServiceOperation[]>();
    filtered.forEach(s => { const key = s.subcategory?.trim() || 'Other'; if (!m.has(key)) m.set(key, []); m.get(key)!.push(s); });
    // Sort items inside each group.
    for (const arr of m.values()) arr.sort(compareByDisplayOrder);
    // Compute a sort key per group: lowest display_order among its items (Infinity if none).
    const enriched = Array.from(m.entries()).map(([name, items]) => {
      const minOrder = items.reduce((min, s) => {
        const val = s.display_order ?? Number.POSITIVE_INFINITY;
        return val < min ? val : min;
      }, Number.POSITIVE_INFINITY);
      return { name, items, minOrder };
    });
    enriched.sort((a, b) => {
      // Keep 'Other' last for readability.
      if (a.name === 'Other' && b.name !== 'Other') return 1;
      if (b.name === 'Other' && a.name !== 'Other') return -1;
      if (a.minOrder !== b.minOrder) return a.minOrder - b.minOrder;
      return a.name.localeCompare(b.name);
    });
    return enriched.map(g => [g.name, g.items] as [string, ServiceOperation[]]);
  }, [filtered]);

  // If there is only one group and it's 'Other', we flatten it (no accordion UI) for clarity.
  const flattenSingleOther = grouped.length === 1 && grouped[0][0] === 'Other';

  const visibleItems = useMemo(() => {
    if (flattenSingleOther) {
      // All items are visible implicitly.
      return grouped[0][1];
    }
    const out: ServiceOperation[] = [];
    grouped.forEach(([g,items]) => { if (expandedGroups.has(g)) out.push(...items); });
    return out;
  }, [grouped, expandedGroups, flattenSingleOther]);

  // When category or query changes, reset keyboard focus index but preserve expanded groups.
  useEffect(() => { setFocusedIndex(-1); }, [selectedCategory, query]);
  useEffect(() => { if (focusedIndex < 0) return; const id = visibleItems[focusedIndex]?.id; const el = id ? rowRefs.current.get(id) : undefined; el?.focus(); }, [focusedIndex, visibleItems]);

  function toggleGroup(g:string){
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  }
  function expandAll(){ setExpandedGroups(new Set(grouped.map(([g])=>g))); }
  function collapseAll(){ setExpandedGroups(new Set()); setFocusedIndex(-1); }

  function onKeyDownList(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (visibleItems.length===0) return; setFocusedIndex(i => (i<0?0:Math.min(i+1, visibleItems.length-1))); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (visibleItems.length===0) return; setFocusedIndex(i => (i<=0?0:i-1)); return; }
    if (e.key === 'Home') { e.preventDefault(); if (visibleItems.length>0) setFocusedIndex(0); return; }
    if (e.key === 'End') { e.preventDefault(); if (visibleItems.length>0) setFocusedIndex(visibleItems.length-1); return; }
    if (e.key === 'Enter') { if (focusedIndex>=0 && focusedIndex < visibleItems.length) { e.preventDefault(); onAdd(visibleItems[focusedIndex]); } }
  }

  // Adjust focus if current focused index is now invalid due to collapsing groups
  useEffect(() => {
    if (focusedIndex === -1) return;
    if (focusedIndex >= visibleItems.length) {
      if (visibleItems.length === 0) setFocusedIndex(-1); else setFocusedIndex(visibleItems.length - 1);
      return;
    }
    // If the element at focusedIndex doesn't exist (shouldn't happen) reset.
    const id = visibleItems[focusedIndex]?.id;
    if (!id) {
      if (visibleItems.length === 0) setFocusedIndex(-1); else setFocusedIndex(0);
    }
  }, [visibleItems, focusedIndex]);

  // Expand all groups automatically while searching so results are visible (after grouped definition)
  useEffect(() => {
    if (query && grouped.length > 0) {
      setExpandedGroups(new Set(grouped.map(g => g[0])));
    }
  }, [query, grouped]);

  // Auto-expand when there's exactly one group to reduce extra click friction
  useEffect(() => {
    if (open && grouped.length === 1 && !flattenSingleOther && expandedGroups.size === 0) {
      setExpandedGroups(new Set([grouped[0][0]]));
    }
  }, [open, grouped, flattenSingleOther, expandedGroups]);

  const [selected, setSelected] = useState<ServiceOperation[]>([]);
  const toggleSelect = (op: ServiceOperation) => {
    setSelected(prev => prev.find(s => s.id === op.id) ? prev.filter(s => s.id !== op.id) : [...prev, op]);
  };
  const handleAdd = (op: ServiceOperation) => {
    // Keep existing immediate add behavior for backwards compatibility
    onAdd(op);
    // Track for batch confirm button
    toggleSelect(op);
  };
  const handleConfirm = () => {
    if (onConfirm) onConfirm(selected);
    onClose();
  };

  // Reset selection whenever modal is closed so each new open starts clean
  useEffect(() => {
    if (!open && selected.length) {
      setSelected([]);
    }
  }, [open, selected.length]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6" role="dialog" aria-modal="true">
  <div className="bg-white text-gray-900 rounded-2xl shadow-lg w-full max-w-5xl h-[72vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">Service Catalog</h2>
          <button onClick={onClose} className="text-sm px-2 py-1 border rounded hover:bg-gray-100">Close</button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-60 border-r flex flex-col">
            <div className="p-3">
              <input data-testid="service-search" ref={searchRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search within category…" className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex-1 overflow-auto pb-2">
              {loading && <div className="px-3 py-2 text-xs text-gray-500">Loading…</div>}
              {error && <div className="px-3 py-2 text-xs text-red-600">{error}</div>}
              {!loading && !error && (
                <ul className="space-y-1 px-2">
                  {categories.map(([cat,count]) => { const active = cat===selectedCategory; return (
                    <li key={cat}>
                      <button onClick={()=>setSelectedCategory(cat)} className={`w-full text-left px-3 py-2 rounded text-sm border hover:bg-gray-50 ${active?'bg-gray-100 border-gray-400':'border-transparent'} text-gray-800`}>
                        <span className="font-medium mr-2">{cat.replace(/_/g,' ')}</span>
                        <span className="text-xs text-gray-500">{count}</span>
                      </button>
                    </li>
                  );})}
                </ul>
              )}
            </div>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="px-5 py-2 border-b bg-gray-50 text-sm text-gray-600 flex items-center justify-between">
              <div>{selectedCategory || 'All'} • {filtered.length} item{filtered.length!==1 && 's'}</div>
              {!flattenSingleOther && (
                <div className="flex gap-2">
                  <button onClick={expandAll} className="text-xs px-2 py-1 border rounded hover:bg-gray-100">Expand all</button>
                  <button onClick={collapseAll} className="text-xs px-2 py-1 border rounded hover:bg-gray-100">Collapse all</button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-auto">
              {loading && <div className="p-5 text-sm text-gray-500">Loading services…</div>}
              {error && <div className="p-5 text-sm text-red-600">{error}</div>}
              {!loading && !error && filtered.length === 0 && <div className="p-6 text-sm text-gray-500">No services match.</div>}
              {!loading && !error && filtered.length > 0 && (
                <div
                  data-testid="service-list"
                  tabIndex={0}
                  className="outline-none"
                  onKeyDown={onKeyDownList}
                  // Do NOT auto-focus first row on container focus; ArrowDown should move focus to first row per test expectation.
                >
                  {!flattenSingleOther && expandedGroups.size === 0 && (
                    <div className="p-6 text-sm text-gray-500 select-none">
                      No subcategory expanded yet. Click a subcategory name on the left, a chevron on the right, or use the "Expand all" button to view services.
                    </div>
                  )}
                  {flattenSingleOther && grouped.length === 1 && (
                    <ul className="divide-y ml-0">
                      {grouped[0][1].map(s => { const idx = visibleItems.findIndex(v=>v.id===s.id); const focused = idx===focusedIndex; return (
                        <li key={s.id} className={`py-3 rounded-lg ${focused ? 'ring-2 ring-blue-300 bg-blue-50' : ''}`}>
                          <div
                            ref={el => { if (el) rowRefs.current.set(s.id, el); else rowRefs.current.delete(s.id); }}
                            data-testid={`service-row-${s.id}`}
                            tabIndex={focused ? 0 : -1}
                            className="flex items-center justify-between gap-4 focus:outline-none cursor-pointer px-2"
                            onClick={()=> { setFocusedIndex(idx); handleAdd(s); }}
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">{s.name}</div>
                              <div className="text-xs text-gray-500 mt-0.5 flex gap-2 flex-wrap">
                                <span>{s.category.replace(/_/g,' ')}</span>
                                <span>•</span>
                                <span>Hours: {formatHours(s.default_hours)}</span>
                                <span>•</span>
                                <span>Rate: {formatPrice(s.base_labor_rate)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-400">{s.display_order ?? ''}</span>
                              <button
                                onClick={(e)=>{ e.stopPropagation(); handleAdd(s); }}
                                className="text-xs px-2 py-1 border rounded hover:bg-blue-100"
                              >{selected.find(sel=>sel.id===s.id)?'Selected':(/package/i.test(s.name)?'Add Package':'Add Service')}</button>
                            </div>
                          </div>
                        </li>
                      );})}
                    </ul>
                  )}
                  {!flattenSingleOther && grouped.map(([groupName, items]) => {
                    const open = expandedGroups.has(groupName);
                    return (
                      <div key={groupName} className="mb-2">
                        <button type="button" className="w-full flex items-center justify-between py-2 px-2 rounded-xl hover:bg-gray-50 text-gray-800" onClick={()=>toggleGroup(groupName)} data-testid={`group-toggle-${groupName}`}>
                          <span className="flex items-center gap-2"><span className="text-gray-500">{open? <ChevronDown className="h-4 w-4"/>:<ChevronRight className="h-4 w-4"/>}</span><span className="font-medium truncate">{groupName}</span></span>
                          <span className="text-xs text-gray-500">{items.length}</span>
                        </button>
                        {open && (
                          <ul className="divide-y ml-6">
                            {items.map(s => { const idx = visibleItems.findIndex(v=>v.id===s.id); const focused = idx===focusedIndex; return (
                <li key={s.id} className={`py-3 rounded-lg ${focused ? 'ring-2 ring-blue-300 bg-blue-50' : ''}`}>
                                <div
                                  ref={el => { if (el) rowRefs.current.set(s.id, el); else rowRefs.current.delete(s.id); }}
                  data-testid={`service-row-${s.id}`}
                  tabIndex={focused ? 0 : -1}
                                  className="flex items-center justify-between gap-4 focus:outline-none cursor-pointer px-2"
                                  onClick={()=> { setFocusedIndex(idx); handleAdd(s); }}
                                >
                                  <div className="min-w-0">
                                    <div className="font-medium text-sm truncate">{s.name}</div>
                                    <div className="text-xs text-gray-500 mt-0.5 flex gap-2 flex-wrap">
                                      <span>{s.category.replace(/_/g,' ')}</span>
                                      <span>•</span>
                                      <span>Hours: {formatHours(s.default_hours)}</span>
                                      <span>•</span>
                                      <span>Rate: {formatPrice(s.base_labor_rate)}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-400">{s.display_order ?? ''}</span>
                                    <button
                                      onClick={(e)=>{ e.stopPropagation(); handleAdd(s); }}
                                      className="text-xs px-2 py-1 border rounded hover:bg-blue-100"
                                    >{selected.find(sel=>sel.id===s.id)?'Selected':(/package/i.test(s.name)?'Add Package':'Add Service')}</button>
                                  </div>
                                </div>
                              </li>
                            );})}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-5 py-2 border-t flex justify-between items-center">
              <div className="text-xs text-gray-500" data-testid="selected-count">{selected.length} selected</div>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Close</button>
                {onConfirm && (
                  <button onClick={handleConfirm} disabled={!selected.length} className="px-3 py-1.5 text-sm border rounded bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700">
                    Add {selected.length || ''} {selected.length === 1 ? 'service' : 'services'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceCatalogModal;
