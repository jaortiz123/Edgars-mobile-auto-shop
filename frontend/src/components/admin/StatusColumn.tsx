import React, { useRef } from 'react';
import type { BoardCard, BoardColumn } from '@/types/models';
import EnhancedAppointmentCard from './EnhancedAppointmentCard';
import { useDrop } from 'react-dnd';

export default function StatusColumn({
  column,
  cards,
  onOpen,
  onMove,
  totalCount,
  filteredCount,
}: {
  column: BoardColumn;
  cards: BoardCard[];
  onOpen: (id: string) => void;
  onMove: (id: string) => void;
  totalCount?: number;
  filteredCount?: number;
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
  <div ref={columnRef} className="nb-column" data-column={column.key} data-status-key={column.key}>
    <div className="nb-column-header">
  <h3 className="font-bold flex items-center justify-center gap-2 w-full text-center">
          {column.title}
          <span className="nb-chip" data-variant="primary">
            {typeof filteredCount === 'number' && typeof totalCount === 'number' && filteredCount !== totalCount
              ? `${filteredCount}/${totalCount}`
              : (typeof filteredCount === 'number' ? filteredCount : column.count)}
          </span>
        </h3>
      </div>
  <div className="nb-column-scroll" data-testid="status-column-scroll">
    {cards.map((c) => {
          // @ts-expect-error internal marker injected upstream
          const isFirstGlobal = Boolean(c.__isFirstGlobal);
          return (
      <div key={c.id} data-appointment-id={c.id}>
              <EnhancedAppointmentCard
                key={c.id}
                card={c}
                onOpen={onOpen}
                isFirst={isFirstGlobal}
              />
            </div>
          );
        })}
        {cards.length === 0 && (
          <div className="text-xs opacity-60 nb-card nb-card-empty" data-status="empty">No items</div>
        )}
      </div>
    </div>
  );
}
