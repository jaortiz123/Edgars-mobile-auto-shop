import React, { useRef } from 'react';
import { useCardPreferences, type CardFieldKey } from '@/contexts/CardPreferencesContext';
import EnhancedAppointmentCard from './EnhancedAppointmentCard';
import type { BoardCard } from '@/types/models';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { MultiSelectProvider } from '@/contexts/multiSelectProvider';

interface Props { open: boolean; onClose: () => void; }

const FIELD_LABELS: Record<CardFieldKey, string> = {
  statusBadges: 'Status Badges',
  vehicle: 'Vehicle (Year/Make/Model)',
  customer: 'Customer Name',
  tech: 'Technician',
  timeChip: 'Time / Countdown',
  onPremise: 'On Premise Chip',
  promise: 'Promise Time',
  repeat: 'Repeat Customer Chip',
  lastService: 'Last Service Date Chip',
  workspacePref: 'Workspace Preference',
  history: 'Recent Service History',
  customerNotes: 'Customer Notes Snippet',
  price: 'Price Footer',
};

const demoCard: BoardCard = {
  id: 'demo-1',
  customerName: 'Sample Customer',
  vehicle: 'Demo',
  servicesSummary: 'Brake Service & Inspection',
  price: 628.44,
  status: 'IN_PROGRESS',
  position: 1,
  timeUntilStart: 25,
  isRepeatCustomer: true,
  mileage: 123456,
  vehicleYear: 2010,
  vehicleMake: 'Honda',
  vehicleModel: 'Accord',
  scheduledTime: '2:00 PM',
  isOverdue: false,
  workspacePreference: 'bay1',
  lastServiceDate: new Date().toISOString(),
  serviceHistory: [{ date: new Date().toISOString(), service: 'Oil Change', outcome: 'completed' }],
  promiseBy: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};

interface ReorderRowProps { index: number; id: CardFieldKey; label: string; checked: boolean; onToggle: () => void; move: (from:number,to:number)=>void; total?: number; }
const Row: React.FC<ReorderRowProps> = ({ index, id, label, checked, onToggle, move, total }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [, drag] = useDrag(() => ({ type: 'CARD_FIELD', item: { index } }), [index]);
  const [, drop] = useDrop(() => ({
    accept: 'CARD_FIELD',
    hover: (item: { index: number }) => {
      if (!ref.current) return;
      if (item.index === index) return;
      move(item.index, index);
      item.index = index;
    }
  }), [index, move]);
  drag(drop(ref));
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); move(index, Math.max(0, index - 1)); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (typeof total === 'number') move(index, Math.min(total - 1, index + 1)); else move(index, index + 1); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle(); }
    else if (e.key === 'Home') { e.preventDefault(); move(index, 0); }
    else if (e.key === 'End' && typeof total === 'number') { e.preventDefault(); move(index, total - 1); }
  };
  return (
    <li
      ref={ref as unknown as React.RefObject<HTMLLIElement>}
      className="list-none flex items-center justify-between gap-4 text-xs font-medium px-2 py-1 rounded border border-transparent hover:border-neutral-400 bg-neutral-100 cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-blue-500"
      data-field={id}
      aria-label={`${label} ${checked ? 'visible' : 'hidden'} position ${index + 1}`}
      tabIndex={0}
      onKeyDown={onKey}
    >
      <span className="flex-1 select-none" aria-hidden>⋮ {label}</span>
      <input
        type="checkbox"
        className="w-4 h-4"
        aria-label={`Toggle ${label}`}
        checked={checked}
        onChange={onToggle}
        tabIndex={-1}
      />
    </li>
  );
};

export default function CardCustomizationModal({ open, onClose }: Props) {
  const { enabled, setEnabled, reset, density, setDensity, order, moveField } = useCardPreferences();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative nb-surface w-full max-w-5xl max-h-[90vh] overflow-hidden p-0 flex flex-col" role="dialog" aria-modal="true">
        <header className="px-6 py-4 nb-border border-b flex items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold flex items-center gap-2"><span>⚙️</span>Customize Cards</h2>
          <button onClick={onClose} className="nb-chip" data-variant="primary">Close</button>
        </header>
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Live Preview */}
          <div className="flex-1 overflow-auto p-8 bg-[repeating-linear-gradient(0deg,#e5e7eb,#e5e7eb_1px,transparent_1px,transparent_24px),repeating-linear-gradient(90deg,#e5e7eb,#e5e7eb_1px,transparent_1px,transparent_24px)]">
            <p className="text-xs font-semibold mb-3 opacity-70">Preview</p>
            <MultiSelectProvider>
              <div className="max-w-[300px]">
                <EnhancedAppointmentCard card={demoCard} />
              </div>
            </MultiSelectProvider>
          </div>
          {/* Right: Controls */}
          <div className="w-96 nb-border border-l flex flex-col overflow-auto">
            <div className="p-4 border-b nb-border">
              <div className="inline-flex rounded-md overflow-hidden border-2 border-black">
                <button onClick={() => setDensity('standard')} className={`px-4 py-1 text-sm font-semibold ${density==='standard'?'bg-blue-600 text-white':'bg-white'}`}>Standard</button>
                <button onClick={() => setDensity('condensed')} className={`px-4 py-1 text-sm font-semibold ${density==='condensed'?'bg-blue-600 text-white':'bg-white'}`}>Condensed</button>
              </div>
            </div>
            <div className="p-4 space-y-6">
              <section>
                <h3 className="text-sm font-extrabold mb-2">Visible Elements</h3>
                <DndProvider backend={HTML5Backend}>
                  <ul className="space-y-1" aria-label="Card element order" aria-describedby="card-order-help" data-testid="card-pref-order-list">
                    {order.map((k, idx) => (
                      <Row key={k} index={idx} id={k} label={FIELD_LABELS[k]} checked={enabled[k]} onToggle={() => setEnabled(k, !enabled[k])} move={moveField} total={order.length} />
                    ))}
                  </ul>
                </DndProvider>
                <p id="card-order-help" className="mt-2 text-[10px] text-neutral-500">Drag or use Arrow keys / Home / End to reorder. Press Space or Enter to toggle visibility.</p>
              </section>
              <div className="flex justify-between">
                <button onClick={() => reset()} className="nb-chip" data-variant="warn">Reset to Default</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
