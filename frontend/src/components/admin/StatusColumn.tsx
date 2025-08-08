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
