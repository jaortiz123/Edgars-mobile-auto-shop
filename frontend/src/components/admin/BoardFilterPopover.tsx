import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BoardFilterBar } from './BoardFilterBar';
import { useBoardFilters } from '@/contexts/BoardFilterContext';
import { Filter } from 'lucide-react';

export const BoardFilterPopover: React.FC = () => {
  const { filtersActive, activeCount } = useBoardFilters();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);


  // Dismiss logic
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && panelRef.current.contains(e.target as Node)) return;
      if (btnRef.current && btnRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick); };
  }, [open]);

  return (
    <div className="relative inline-block">
  <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className={`nb-chip px-3 py-2 flex items-center gap-2 ${filtersActive ? 'bg-amber-600 text-black font-semibold' : ''}`}
        aria-haspopup="dialog"
      >
        <Filter size={16} />
        <span>{filtersActive ? `Filters (${activeCount})` : 'Filters'}</span>
      </button>
  {open && createPortal(
        <div
          ref={panelRef}
          className="fixed top-14 right-4 w-[860px] max-w-[92vw] z-[1000] max-h-[70vh] overflow-auto bg-neutral-950/95 border border-neutral-700 rounded-xl shadow-xl p-4 backdrop-blur-sm animate-[fadeIn_120ms_ease-out]"
        >
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-neutral-400">Filter Appointments</h2>
            <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-200 text-sm">✕</button>
          </div>
          <BoardFilterBar />
        </div>, document.body)
      }
    </div>
  );
};
