import React from 'react';
import type { BoardCard } from '@/types/models';

export default function AppointmentCard({ card, onOpen, onMove }: {
  card: BoardCard;
  onOpen: (id: string) => void;
  onMove: (id: string) => void;
}) {
  return (
    <div
      className="rounded-lg border bg-white p-3 shadow-sm cursor-pointer"
      data-card-id={card.id}
      onClick={() => onOpen(card.id)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">{card.customerName}</div>
        <button
          className="text-xs text-gray-500"
          aria-label="Move"
          onClick={(e) => {
            e.stopPropagation();
            onMove(card.id);
          }}
        >
          ⋮
        </button>
      </div>
      <div className="text-xs text-gray-600 mt-1">{card.vehicle}</div>
      {card.servicesSummary && (
        <div className="text-xs mt-1">{card.servicesSummary}</div>
      )}
      {typeof card.price === 'number' && (
        <div className="text-sm mt-2 font-medium">
          ${card.price.toFixed(2)}
        </div>
      )}
    </div>
  );
}
