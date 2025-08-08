import React, { useRef } from 'react';
import type { BoardCard, BoardColumn } from '@/types/models';
import AppointmentCard from './AppointmentCard';
import { useDrop } from 'react-dnd';

export default function StatusColumn({
  column,
  cards,
  onOpen,
  onMove,
  onQuickReschedule,
  isRescheduling,
}: {
  column: BoardColumn;
  cards: BoardCard[];
  onOpen: (id: string) => void;
  onMove: (id: string) => void;
  onQuickReschedule: (id: string) => void;
  isRescheduling?: (id: string) => boolean;
}) {
  const columnRef = useRef<HTMLDivElement>(null);
  
  const [, drop] = useDrop(() => ({
    accept: 'card',
    drop: (item: { id: string; status: string; position: number }) => {
      if (item.status !== column.key) {
        onMove(item.id);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  // Connect drop to ref
  drop(columnRef);

  return (
<<<<<<< Current (Your changes)
    <div ref={columnRef} className="min-w-[300px] w-80">
      <div className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100 z-10 rounded-t-xl border-x border-t p-4 border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{column.title}</h2>
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-600">{column.count} {column.count === 1 ? 'job' : 'jobs'}</span>
            {/* Estimate total time instead of money (assume 0.5h per job) */}
            <span className="text-sm text-blue-600 font-medium">~{(column.count * 0.5).toFixed(1)}h total</span>
=======
    <div ref={columnRef} className="min-w-[280px] w-72">
      <div className={`sticky top-0 bg-gray-50 z-10 rounded-t-lg border-x border-t p-3 ${cards.some(c => c.isOverdue) ? 'bg-gradient-to-r from-red-50 to-red-100' : cards.some(c => (c.timeUntilStart || 999) <= 30) ? 'bg-gradient-to-r from-orange-50 to-orange-100' : 'bg-gradient-to-r from-gray-50 to-gray-100'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h2 className="text-sm font-semibold">{column.title}</h2>
            {cards.filter(c => c.isOverdue).length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">{cards.filter(c => c.isOverdue).length} URGENT</span>
            )}
            {cards.filter(c => c.timeUntilStart !== undefined && c.timeUntilStart !== null && c.timeUntilStart <= 30 && !c.isOverdue).length > 0 && cards.filter(c => c.isOverdue).length === 0 && (
              <span className="ml-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">{cards.filter(c => c.timeUntilStart !== undefined && c.timeUntilStart !== null && c.timeUntilStart <= 30 && !c.isOverdue).length} SOON</span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-500">{column.count} {column.count === 1 ? 'job' : 'jobs'}</span>
            <span className="text-sm font-medium text-blue-600">~{Math.round(cards.reduce((sum, card) => sum + (card.estimatedDuration || 120), 0) / 60)}h</span>
>>>>>>> Incoming (Background Agent changes)
          </div>
        </div>
      </div>
      <div className="space-y-4 p-4 border-x border-b rounded-b-xl bg-gray-50/50">
        {cards.map((c) => (
          <AppointmentCard
            key={c.id}
            card={c}
            onOpen={onOpen}
            onMove={onMove}
            onQuickReschedule={onQuickReschedule}
            isRescheduling={isRescheduling?.(c.id) || false}
          />
        ))}
        {cards.length === 0 && (
          <div className="text-xs text-gray-500">No items</div>
        )}
      </div>
    </div>
  );
}
