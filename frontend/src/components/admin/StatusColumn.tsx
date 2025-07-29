import React from 'react';
import type { BoardCard, BoardColumn } from '@/types/models';
import AppointmentCard from './AppointmentCard';

export default function StatusColumn({
  column,
  cards,
  onOpen,
  onMove,
}: {
  column: BoardColumn;
  cards: BoardCard[];
  onOpen: (id: string) => void;
  onMove: (id: string) => void;
}) {
  return (
    <div className="min-w-[280px] w-72">
      <div className="sticky top-0 bg-gray-50 z-10 rounded-t-lg border-x border-t p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{column.title}</h2>
          <span className="text-xs text-gray-500">{column.count}</span>
        </div>
        <div className="text-xs text-gray-500">${column.sum.toFixed(2)}</div>
      </div>
      <div className="space-y-3 p-3 border-x border-b rounded-b-lg bg-gray-50/50">
        {cards.map((c) => (
          <AppointmentCard
            key={c.id}
            card={c}
            onOpen={onOpen}
            onMove={onMove}
          />
        ))}
        {cards.length === 0 && (
          <div className="text-xs text-gray-500">No items</div>
        )}
      </div>
    </div>
  );
}
