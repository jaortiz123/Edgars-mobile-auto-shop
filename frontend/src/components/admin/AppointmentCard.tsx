import React from 'react';
import type { BoardCard } from '@/types/models';

export default function AppointmentCard({ card, onOpen, onMove }: {
  card: BoardCard;
  onOpen: (id: string) => void;
  onMove: (id: string) => void;
}) {
  return (
    <div className="relative">
      <button
        className="w-full rounded-lg border bg-white p-3 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-left"
        data-card-id={card.id}
        data-testid={`board-card-${card.id}`}
        onClick={() => onOpen(card.id)}
        aria-label={`Open appointment for ${card.customerName}, ${card.vehicle}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">{card.customerName}</div>
          <span className="text-xs text-gray-500">⋮</span>
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
      </button>
      <button
        className="absolute top-2 right-2 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded p-1 hover:bg-gray-100"
        aria-label={`Move appointment for ${card.customerName} to different status`}
        onClick={(e) => {
          e.stopPropagation();
          onMove(card.id);
        }}
      >
        ⋮
      </button>
    </div>
  );
}
