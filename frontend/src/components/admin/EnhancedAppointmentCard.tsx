import React, { useMemo, useRef } from 'react';
import type { BoardCard } from '@/types/models';
import { useDrag } from 'react-dnd';
import VehicleDisplay from './VehicleDisplay';
import { formatDate } from '@/utils/dateUtils';
import { formatInShopTZ } from '@/lib/timezone';
// Removed ContextualQuickActions for cleaner minimal card
import { useCardPreferences } from '@/contexts/CardPreferencesContext';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { useServiceOperations } from '@/hooks/useServiceOperations';
import { Skeleton } from '@/components/ui/Skeleton';
import { resolveHeadline } from '@/types/serviceCatalog';

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

const OnPremiseChip = ({ card }: { card: BoardCard }) => {
  if (!card.checkInAt || card.checkOutAt) return null;
  const checkIn = new Date(card.checkInAt);
  const now = new Date();
  const daysOnLot = Math.max(0, Math.floor((now.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000)));
  const label = daysOnLot >= 1 ? `${daysOnLot}d on lot` : 'On premises';
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-steel-100 text-steel-800 border border-steel-200">
      🚗 {label}
    </span>
  );
};

const PromiseChip = ({ when }: { when?: string | null }) => {
  if (!when) return null;
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
      ⏰ Promise: {formatInShopTZ(when, 'time')}
    </span>
  );
};

export const EnhancedAppointmentCard = ({ card, onOpen }: { card: BoardCard; onOpen?: (id: string) => void }) => {
  const priceText = useMemo(() => card.price != null ? `$${card.price.toFixed(2)}` : undefined, [card.price]);
  const { enabled } = useCardPreferences();
  const { byId } = useServiceCatalog();
  const { isLoading: opsLoading } = useServiceOperations();

  const headline = useMemo(() => {
    if (card.headline) return card.headline; // precomputed
    if (card.primaryOperation) {
      const def = byId[card.primaryOperation.serviceId];
      return resolveHeadline(card.primaryOperation, def, card.servicesSummary, (card.additionalOperations || []).length);
    }
    return card.servicesSummary || `Service #${card.id.slice(-4)}`;
  }, [card.headline, card.primaryOperation, card.servicesSummary, card.id, byId, card.additionalOperations]);

  const cardRef = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'card',
    item: { id: card.id, status: card.status, position: card.position ?? 0 },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }), [card]);

  // Connect drag to ref
  drag(cardRef);

  return (
    <div
      ref={cardRef}
      className={`relative nb-card card-base transition-opacity ${isDragging ? 'opacity-80' : 'opacity-100'}`}
      data-status={(card.status || '').toLowerCase()}
    >
      {/* Progress accent bar: green when started, purple when completed */}
      {card.startedAt && !card.completedAt && (
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-green-400 to-green-600 rounded-t" />
      )}
      {card.completedAt && (
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-t" />
      )}
      {/* Top: Centered Service Title + centered badges */}
      <div className="w-full flex flex-col items-center text-center">
        <div className="nb-service-title" title={headline}>
          {headline || (card.primaryOperationId && opsLoading ? <Skeleton className="h-4 w-36" /> : `Service #${card.id.slice(-4)}`)}
        </div>
        {enabled.statusBadges && (
          <div className="nb-status-badges">
            <span className="nb-status-badge" data-s={(card.status || '').toLowerCase()}>{(card.status || 'OPEN').replace('_',' ')}</span>
            {card.isOverdue && <span className="nb-status-badge" data-s="overdue">Overdue</span>}
            {enabled.workspacePref && card.workspacePreference && <span className="nb-status-badge" data-s="pref">{String(card.workspacePreference).toUpperCase()}</span>}
          </div>
        )}
      </div>
      {/* Vehicle & Customer Lines */}
      <div className="space-y-1">
        {enabled.vehicle && (
          <div className="nb-vehicle-line">
            <VehicleDisplay year={card.vehicleYear || undefined} make={card.vehicleMake || undefined} model={card.vehicleModel || undefined} mileage={card.mileage || undefined} vehicle={card.vehicle} />
          </div>
        )}
        {enabled.customer && <div className="nb-customer-line">{card.customerName}</div>}
        {enabled.tech && (card.techInitials || card.techAssigned || card.startedAt) && (
          <div className="text-[11px] font-semibold tracking-wide flex flex-wrap items-center justify-center gap-1 opacity-80">
            {(card.techInitials || card.techAssigned) && (
              <span className="inline-flex items-center justify-center h-5 px-2 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm">
                {card.techInitials || (card.techAssigned ? card.techAssigned.split(/\s+/).map(p=>p[0]).join('').toUpperCase() : '')}
              </span>
            )}
            {card.startedAt && !card.completedAt && (
              <span className="inline-flex items-center h-5 px-2 rounded-full bg-green-100 text-green-700 border border-green-200 text-[10px] font-medium animate-pulse" title={card.startedAt}>In Progress</span>
            )}
            {card.completedAt && (
              <span className="inline-flex items-center h-5 px-2 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-medium" title={card.completedAt}>Done</span>
            )}
          </div>
        )}
        {enabled.timeChip && <div className="text-[11px] font-medium opacity-70"><TimeDisplay card={card} /></div>}
      </div>
      {/* Secondary chips */}
      <div className="flex flex-wrap gap-2 mt-1">
        {enabled.onPremise && <OnPremiseChip card={card} />}
        {enabled.promise && <PromiseChip when={card.promiseBy} />}
        {enabled.repeat && card.isRepeatCustomer && (
          <span className="nb-chip" data-variant="primary">Repeat</span>
        )}
        {enabled.lastService && card.lastServiceDate && (
          <span className="nb-chip" data-variant="primary">Last {formatRelativeDate(card.lastServiceDate)}</span>
        )}
      </div>
      {/* Price row with separator line (always above OPEN action) */}
      {enabled.price && priceText && (
        <div className="nb-card-footer mt-2">
          <span className="nb-card-price">{priceText}</span>
        </div>
      )}
      {/* Open action zone at true bottom */}
      {onOpen && (
        <div className="nb-card-open-zone">
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(card.id); }}
            className="nb-chip nb-open-badge"
            data-variant="primary"
            aria-label={`Open details for ${card.customerName}`}
          >OPEN</button>
        </div>
      )}
    </div>
  );
};

export default EnhancedAppointmentCard;
