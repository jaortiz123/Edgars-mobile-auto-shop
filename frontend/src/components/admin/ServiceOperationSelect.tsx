import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useServiceOperations } from '@/hooks/useServiceOperations';

export interface ServiceOperationSelectValue {
  id: string;
  name: string;
  category: string;
  defaultHours?: number | null;
  defaultPrice?: number | null;
}

interface Props {
  label?: string;
  required?: boolean;
  value: ServiceOperationSelectValue | null;
  onChange: (val: ServiceOperationSelectValue | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  allowCustom?: boolean; // if false, user must pick from list
}

export const ServiceOperationSelect: React.FC<Props> = ({
  label = 'Service',
  required,
  value,
  onChange,
  placeholder = 'Search services…',
  autoFocus,
  disabled,
  allowCustom = false
}) => {
  const { data: operations = [], isLoading } = useServiceOperations();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = (query.trim() ? operations.filter(o => {
    const q = query.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      o.category?.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q) ||
      (o.keywords || []).some((k: string) => k.toLowerCase().includes(q))
    );
  }) : operations).slice(0, 15);

  interface RawOp { id: string; name: string; category: string | null; default_hours?: number | null; default_price?: number | null; keywords?: string[] | null }
  const selectOp = useCallback((op: RawOp) => {
    onChange({
      id: op.id,
      name: op.name,
  category: op.category || '',
      defaultHours: op.default_hours ?? null,
      defaultPrice: op.default_price ?? null,
    });
    setQuery(op.name);
    setOpen(false);
  }, [onChange]);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  useEffect(() => {
    if (value && value.name !== query) setQuery(value.name);
    if (!value && !allowCustom && query) setQuery('');
  }, [value, allowCustom, query]);

  function onKey(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(filtered.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(0, h - 1)); }
    else if (e.key === 'Enter') {
  if (open && filtered[highlight]) { e.preventDefault(); selectOp(filtered[highlight] as unknown as RawOp); }
      else if (!allowCustom) e.preventDefault();
    } else if (e.key === 'Escape') setOpen(false);
  }

  function clear() {
    onChange(null);
    if (!allowCustom) setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-sm font-medium mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          className="flex-1 rounded border px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-400"
          value={query}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            if (!allowCustom && value && v !== value.name) onChange(null);
            setOpen(true); setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
        {(value || query) && (
          <button type="button" onClick={clear} className="text-xs px-2 rounded border bg-gray-50 hover:bg-gray-100">Clear</button>
        )}
      </div>
      {open && !isLoading && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded border bg-white shadow">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">
              {allowCustom ? 'No matches. Continue typing.' : 'No matches.'}
            </div>
          )}
      {filtered.map((op, i) => {
            const active = i === highlight;
            return (
              <button
                key={op.id}
                type="button"
        data-testid={`service-op-option-${op.id}`}
                onMouseDown={(e) => { e.preventDefault(); selectOp(op as unknown as RawOp); }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-3 py-2 text-xs ${active ? 'bg-blue-50' : ''} hover:bg-blue-50`}
              >
                <div className="font-medium">{op.name}</div>
                <div className="flex gap-2 text-[10px] text-gray-500">
                  <span>{op.category}</span>
                  {op.default_hours != null && <span>{op.default_hours}h</span>}
                  {op.default_price != null && <span>${Number(op.default_price).toFixed(2)}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {isLoading && <div className="mt-1 text-xs text-gray-500">Loading catalog…</div>}
      {value && (
        <div className="mt-2 text-xs text-gray-600">Selected: <strong>{value.name}</strong> ({value.category})</div>
      )}
    </div>
  );
};

export default ServiceOperationSelect;
