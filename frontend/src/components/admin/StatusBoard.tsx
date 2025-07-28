import React, { useMemo } from 'react';
import { useAppointments } from '@/contexts/AppointmentContext';
import StatusColumn from './StatusColumn';

export default function StatusBoard({ onOpen }: { onOpen: (id: string) => void }) {
  const { columns, cards, optimisticMove } = useAppointments();

  const byStatus = useMemo(() => {
    const map = new Map<string, typeof cards>();
    for (const col of columns) map.set(col.key, []);
    for (const c of cards) {
      const arr = map.get(c.status as string);
      if (arr) arr.push(c);
    }
    for (const [, arr] of map) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [columns, cards]);

  return (
    <div className="overflow-x-auto pb-4" role="region" aria-label="Status Board">
      <div className="flex gap-4 min-w-max">
        {columns.map((col) => (
          <StatusColumn
            key={col.key}
            column={col}
            cards={byStatus.get(col.key) ?? []}
            onOpen={onOpen}
            onMove={(id) => {
              void optimisticMove(id, { status: col.key as any, position: 1 });
            }}
          />
        ))}
      </div>
    </div>
  );
}
