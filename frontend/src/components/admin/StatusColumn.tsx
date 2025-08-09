import React, { useRef } from 'react';
import type { BoardCard, BoardColumn } from '@/types/models';
import EnhancedAppointmentCard from './EnhancedAppointmentCard';
import { useDrop } from 'react-dnd';

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
    <div ref={columnRef} className="w-80 flex-shrink-0">
      <div className="bg-neutral-50/50 backdrop-blur-sm rounded-lg border border-neutral-200/60 shadow-sm">
        <div className="column-header px-4 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-bold text-neutral-900">{column.title}</h3>
              {/* status icon could be added here */}
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-neutral-600">
                {column.count} {column.count === 1 ? 'job' : 'jobs'}
              </span>
              <span className="text-sm font-medium text-steel-600">
                ~{Math.round((column.sum || 0) / 60)}h
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 border-x border-b rounded-b-xl bg-gray-50/50">
          {cards.map((c) => (
            <EnhancedAppointmentCard key={c.id} card={c} onOpen={onOpen} />
          ))}
          {cards.length === 0 && (
            <div className="text-xs text-neutral-500">No items</div>
          )}
        </div>
      </div>
    </div>
  );
}
