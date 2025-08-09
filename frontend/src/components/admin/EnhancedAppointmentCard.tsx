import React, { useMemo, useState, useRef } from 'react';
import type { BoardCard } from '@/types/models';
import { useDrag } from 'react-dnd';
import CustomerAvatar from './CustomerAvatar';
import VehicleDisplay from './VehicleDisplay';
import ServiceComplexityIndicator from './ServiceComplexityIndicator';
import PartsIndicator from './PartsIndicator';
import { formatDate } from '@/utils/dateUtils';
import ContextualQuickActions from './ContextualQuickActions';

const formatRelativeDate = (iso?: string | null) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return formatDate(d, 'shortDate');
  } catch { return ''; }
};

const TimeDisplay = ({ card }: { card: BoardCard }) => {
  if (card.isOverdue) {
    return (
      <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border bg-danger-50 text-danger-800 border-danger-200">
        <span className="mr-1">⚠️</span>
        {card.minutesLate}m overdue
      </div>
    );
  }
  if (typeof card.timeUntilStart === 'number' && card.timeUntilStart <= 30 && card.timeUntilStart > 0) {
    return (
      <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border bg-warning-50 text-warning-800 border-warning-200">
        <span className="mr-1">🕐</span>
        Starting in {card.timeUntilStart}m
      </div>
    );
  }
  if (card.scheduledTime && card.status === 'SCHEDULED') {
    return (
      <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border bg-primary-50 text-primary-700 border-primary-200">
        <span className="mr-1">📅</span>
        {card.scheduledTime}
      </div>
    );
  }
  return null;
};

export const EnhancedAppointmentCard = ({ card, onOpen }: { card: BoardCard; onOpen?: (id: string) => void }) => {
  const [showDetails, setShowDetails] = useState(false);
  const priceText = useMemo(() => card.price != null ? `$${card.price.toFixed(2)}` : undefined, [card.price]);

  const cardRef = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'card',
    item: { id: card.id, status: card.status, position: card.position ?? 0 },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }), [card]);

  // Connect drag to ref
  drag(cardRef);

  return (
    <div ref={cardRef} className={`card-base p-4 space-y-3 transition-opacity ${isDragging ? 'opacity-80' : 'opacity-100'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <CustomerAvatar photo={card.customerPhoto} name={card.customerName} isRepeat={card.isRepeatCustomer} />
          <div>
            <TimeDisplay card={card} />
            {card.techAssigned && (
              <p className="text-xs text-steel-600 mt-1">👤 {card.techAssigned}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <ServiceComplexityIndicator complexity={card.complexity} />
          {card.partsRequired && card.partsRequired.length > 0 && (
            <PartsIndicator parts={card.partsRequired} />
          )}
          {onOpen && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpen(card.id); }}
              className="ml-1 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border"
              aria-label={`Open details for ${card.customerName}`}
            >
              Open
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-bold text-neutral-900 leading-tight">
          {card.servicesSummary || `Service #${card.id.slice(-4)}`}
        </h3>
        <VehicleDisplay year={card.vehicleYear || undefined} make={card.vehicleMake || undefined} model={card.vehicleModel || undefined} mileage={card.mileage || undefined} vehicle={card.vehicle} />
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-600">{card.customerName}</span>
          {card.estimatedDuration && (
            <span className="text-steel-600 font-medium">
              ~{Math.round(card.estimatedDuration / 60)}h {card.estimatedDuration % 60}m{priceText ? ` • ${priceText}` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {card.isRepeatCustomer && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
            🔄 Repeat Customer
          </span>
        )}
        {card.lastServiceDate && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-steel-100 text-steel-800">
            📅 Last: {formatRelativeDate(card.lastServiceDate)}
          </span>
        )}
        {card.workspacePreference && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-warning-100 text-warning-800">
            🏗️ Prefers {String(card.workspacePreference).toUpperCase()}
          </span>
        )}
      </div>

      <button onClick={() => setShowDetails(v => !v)} className="w-full text-left text-xs text-neutral-500 hover:text-neutral-700 transition-colors">
        {showDetails ? '△ Hide details' : '▽ Show details'}
      </button>

      {showDetails && (
        <div className="border-t border-neutral-200 pt-3 space-y-2 text-sm">
          {card.customerNotes && (
            <div>
              <p className="font-medium text-neutral-700">Customer Notes:</p>
              <p className="text-neutral-600">{card.customerNotes}</p>
            </div>
          )}
          {card.serviceHistory && card.serviceHistory.length > 0 && (
            <div>
              <p className="font-medium text-neutral-700">Recent Services:</p>
              <div className="space-y-1">
                {card.serviceHistory.slice(0, 2).map((service, index) => (
                  <div key={index} className="flex justify-between text-xs text-neutral-600">
                    <span>{service.service}</span>
                    <span>{formatDate(service.date, 'shortDate')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {card.recommendedNextService && (
            <div>
              <p className="font-medium text-neutral-700">Recommended Next:</p>
              <p className="text-neutral-600">{card.recommendedNextService}</p>
            </div>
          )}
        </div>
      )}

      <ContextualQuickActions card={card} />
    </div>
  );
};

export default EnhancedAppointmentCard;
