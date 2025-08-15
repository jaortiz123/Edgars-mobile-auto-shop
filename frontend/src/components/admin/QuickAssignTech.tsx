import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTechnicians } from '@/hooks/useTechnicians';
// api + react-query based optimistic logic replaced by centralized store action
import { useBoardStore } from '@/state/useBoardStore';
import { useToast } from '@/components/ui/Toast';

interface Props {
  appointmentId: string;
  currentTechId: string | null | undefined;
  onAssigned?: (techId: string | null) => void;
}

// Small popover for assigning / reassigning a technician inline on a board card
export const QuickAssignTech: React.FC<Props> = ({ appointmentId, currentTechId, onAssigned }) => {
  const { data: techs = [], isLoading } = useTechnicians();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  // One-time style injection for positioning via CSS variables (avoid inline style attr)
  useEffect(() => {
    const id = 'qa-tech-popover-style';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `.quick-assign-pop { top: var(--qa-pop-top, 0px); left: var(--qa-pop-left, 0px); width: var(--qa-pop-width, 240px); }`;
      document.head.appendChild(style);
    }
  }, []);
  const toast = useToast();
  const assignTechnician = useBoardStore(s => s.assignTechnician);

  // Position + dismissal
  useEffect(() => {
    if (!open) return;
    const compute = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      const width = 240; // fixed width
      const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
      const top = Math.min(r.bottom + 6, window.innerHeight - 200); // keep in viewport
  setCoords({ top, left, width });
    };
  compute();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (popRef.current && popRef.current.contains(e.target as Node)) return;
      if (btnRef.current && btnRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  // Sync CSS variables when coords change (only when open)
  useEffect(() => {
    if (!open || !coords) return;
    const root = document.documentElement;
    root.style.setProperty('--qa-pop-top', coords.top + 'px');
    root.style.setProperty('--qa-pop-left', coords.left + 'px');
    root.style.setProperty('--qa-pop-width', coords.width + 'px');
  }, [coords, open]);

  const assign = async (techId: string | null) => {
    setSaving(true);
    // Initial UI close for responsiveness
    setOpen(false); // close immediately for snappy feel
    try {
      await assignTechnician(appointmentId, techId);
      if (onAssigned) onAssigned(techId);
      toast.success(techId ? 'Technician assigned' : 'Technician cleared');
    } catch (e) {
      console.error('Failed to assign technician via store:', e);
      toast.error('Failed to assign technician'); // store rollback already handled
    } finally {
      setSaving(false);
    }
  };

  return (
  <div className="relative inline-block text-left" data-qatech>
      <button
        ref={btnRef}
        type="button"
        aria-label={currentTechId ? 'Reassign technician' : 'Assign technician'}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
  className="h-5 w-5 flex items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800 shadow-sm text-[10px] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
        title={currentTechId ? 'Reassign technician' : 'Assign technician'}
  >{saving ? '…' : (currentTechId ? '↺' : '+')}</button>
      {open && coords && createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label="Assign technician"
          className="quick-assign-pop fixed z-[1000] max-h-80 overflow-auto rounded-lg border border-neutral-300 bg-white shadow-2xl p-1 ring-1 ring-black/5 animate-[fadeIn_120ms_ease-out]"
        >
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-neutral-500">Technicians</div>
          <button
            disabled={saving}
            onClick={() => assign(null)}
            className={`w-full text-left px-2 py-1 rounded text-[12px] hover:bg-neutral-100 ${!currentTechId ? 'bg-neutral-100 font-semibold' : ''}`}
          >Unassigned</button>
          {isLoading && <div className="px-2 py-1 text-[12px] opacity-60">Loading…</div>}
          {!isLoading && techs.map(t => (
            <button
              key={t.id}
              disabled={saving}
              onClick={() => assign(t.id)}
              className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[12px] text-neutral-800 hover:bg-indigo-50 focus:outline-none focus:bg-indigo-100 ${currentTechId === t.id ? 'bg-indigo-100 font-semibold text-indigo-700' : ''}`}
            >
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold shadow">{t.initials || t.name.slice(0,2).toUpperCase()}</span>
              <span className="flex-1 truncate">{t.name}</span>
            </button>
          ))}
        </div>, document.body)
      }
    </div>
  );
};

export default QuickAssignTech;
