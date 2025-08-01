import React, { useMemo, useState } from 'react';
import { useAppointments } from '@/contexts/AppointmentContext';
import StatusColumn from './StatusColumn';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import type { AppointmentStatus } from '@/types/models';

export default function StatusBoard({ onOpen }: { onOpen: (id: string) => void }) {
  const { columns, cards, optimisticMove, triggerRefresh } = useAppointments();
  const [reschedulingIds, setReschedulingIds] = useState<Set<string>>(new Set());

  // Debug logging to see what data StatusBoard is receiving
  console.log('🎪 StatusBoard render:', {
    columnsLength: columns?.length,
    cardsLength: cards?.length,
    columns: columns,
    cards: cards
  });

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

  const handleQuickReschedule = async (id: string) => {
    if (reschedulingIds.has(id)) return; // Prevent double-clicking

    setReschedulingIds(prev => new Set(prev).add(id));

    try {
      // Get appointment details for service type
      const appointment = cards.find(card => card.id === id);
      const serviceType = appointment?.servicesSummary || 'default';
      
      // Use rescheduling service with direct path
      const reschedulingModule = await import('../../services/reschedulingService.js');
      const result = await reschedulingModule.quickRescheduleToNext(id, serviceType, {
        daysAhead: 7,
        reason: 'Quick reschedule from status board'
      });
      
      if (result?.success) {
        triggerRefresh();
      } else {
        console.error('Rescheduling failed:', result?.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error in quick reschedule:', error);
      // Show user feedback for failed rescheduling
      // Note: In a real app, you'd show a toast notification
    } finally {
      setReschedulingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="overflow-x-auto pb-4" role="region" aria-label="Status Board">
        <div className="flex gap-4 min-w-max">
          {columns.map((col) => (
            <StatusColumn
              key={col.key}
              column={col}
              cards={byStatus.get(col.key) ?? []}
              onOpen={onOpen}
              onMove={(id: string) => {
                void optimisticMove(id, { status: col.key as AppointmentStatus, position: 1 });
              }}
              onQuickReschedule={(id: string) => {
                if (!reschedulingIds.has(id)) {
                  void handleQuickReschedule(id);
                }
              }}
              isRescheduling={(id: string) => reschedulingIds.has(id)}
            />
          ))}
        </div>
      </div>
    </DndProvider>
  );
}
