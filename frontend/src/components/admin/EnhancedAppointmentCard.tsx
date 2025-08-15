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
import { useMinuteNow, formatElapsed } from '@/hooks/useMinuteNow';
import QuickAssignTech from './QuickAssignTech';

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

export const EnhancedAppointmentCard = ({ card, onOpen, isFirst }: { card: BoardCard; onOpen?: (id: string) => void; isFirst?: boolean }) => {
  const priceText = useMemo(() => card.price != null ? `$${card.price.toFixed(2)}` : undefined, [card.price]);
  const { enabled, order } = useCardPreferences();
  const { byId } = useServiceCatalog();
  const { isLoading: opsLoading } = useServiceOperations();
  const now = useMinuteNow();
  const elapsed = card.startedAt && !card.completedAt ? formatElapsed(card.startedAt, now) : null;
  const minutesRunning = card.startedAt && !card.completedAt ? Math.floor((now - new Date(card.startedAt).getTime()) / 60000) : null;
  let elapsedClasses = 'bg-neutral-100 text-neutral-700 border border-neutral-300';
  if (typeof minutesRunning === 'number') {
    if (minutesRunning >= 240) {
      elapsedClasses = 'bg-red-100 text-red-700 border border-red-300';
    } else if (minutesRunning >= 120) {
      elapsedClasses = 'bg-amber-100 text-amber-800 border border-amber-300';
    }
  }

  const headline = useMemo(() => {
    if (card.headline) return card.headline;
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
    collect: monitor => ({ isDragging: monitor.isDragging() })
  }), [card]);
  drag(cardRef);

  return (
    <div
      ref={cardRef}
      className={`group relative nb-card card-base transition-opacity ${isDragging ? 'opacity-80' : 'opacity-100'}`}
      data-status={(card.status || '').toLowerCase()}
      data-testid={`apt-card-${card.id}`}
      data-first-card={isFirst ? '1' : undefined}
    >
      {card.startedAt && !card.completedAt && <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-green-400 to-green-600 rounded-t" />}
      {card.completedAt && <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-t" />}

      <div className="w-full flex flex-col items-center text-center">
        <div className="nb-service-title" title={headline}>
          {headline || (card.primaryOperationId && opsLoading ? <Skeleton className="h-4 w-36" /> : `Service #${card.id.slice(-4)}`)}
        </div>
        {enabled.statusBadges && (
          <div className="nb-status-badges">
            <span className="nb-status-badge" data-s={(card.status || 'OPEN').toLowerCase()}>{(card.status || 'OPEN').replace('_',' ')}</span>
            {card.isOverdue && <span className="nb-status-badge" data-s="overdue">Overdue</span>}
            {enabled.workspacePref && card.workspacePreference && <span className="nb-status-badge" data-s="pref">{String(card.workspacePreference).toUpperCase()}</span>}
          </div>
        )}
      </div>

      <div className="space-y-1">
        {order.map(k => {
          if (!enabled[k]) return null;
          switch (k) {
            case 'vehicle':
              return (
                <div key={k} className="nb-vehicle-line">
                  <VehicleDisplay year={card.vehicleYear || undefined} make={card.vehicleMake || undefined} model={card.vehicleModel || undefined} mileage={card.mileage || undefined} vehicle={card.vehicle} />
                </div>
              );
            case 'customer':
              return <div key={k} className="nb-customer-line">{card.customerName}</div>;
            case 'tech':
              if (!(card.techInitials || card.techAssigned || card.startedAt)) return null;
              return (
                <div key={k} className="relative text-[11px] font-semibold tracking-wide flex flex-wrap items-center justify-center gap-1 opacity-80">
                  {(card.techInitials || card.techAssigned) && (
                    <span className="inline-flex items-center justify-center h-5 px-2 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm">
                      {card.techInitials || (card.techAssigned ? card.techAssigned.split(/\s+/).map(p=>p[0]).join('').toUpperCase() : '')}
                    </span>
                  )}
                  {card.startedAt && !card.completedAt && (
                    <>
                      <span className="inline-flex items-center h-5 px-2 rounded-full bg-green-100 text-green-700 border border-green-200 text-[10px] font-medium animate-pulse" title={card.startedAt}>In Progress</span>
                      {elapsed && (
                        <span
                          className={`inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium ${elapsedClasses}`}
                          title={`Started ${new Date(card.startedAt).toLocaleString()} • Running ${minutesRunning} min`}
                          data-elapsed-min={minutesRunning ?? undefined}
                          data-elapsed-tier={minutesRunning != null ? (minutesRunning >= 240 ? 'high' : minutesRunning >= 120 ? 'medium' : 'normal') : undefined}
                        >{elapsed}</span>
                      )}
                    </>
                  )}
                  {card.completedAt && (
                    <span className="inline-flex items-center h-5 px-2 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-medium" title={card.completedAt}>Done</span>
                  )}
                  <div className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <QuickAssignTech appointmentId={card.id} currentTechId={card.techAssigned || null} />
                  </div>
                </div>
              );
            case 'timeChip':
              return <div key={k} className="text-[11px] font-medium opacity-70"><TimeDisplay card={card} /></div>;
            case 'onPremise':
              return null; // handled in chip area below
            case 'promise':
              return null; // handled below
            case 'repeat':
              return null;
            case 'lastService':
              return null;
            case 'workspacePref':
              return null;
            case 'history':
              return null;
            case 'customerNotes':
              return null;
            case 'price':
              return null; // footer area
            case 'statusBadges':
              return null; // already rendered at top
            default:
              return null;
          }
        })}
      </div>

      <div className="flex flex-wrap gap-2 mt-1">
        {order.filter(k => enabled[k]).map(k => {
          switch (k) {
            case 'onPremise':
              return <React.Fragment key={k}>{enabled.onPremise && <OnPremiseChip card={card} />}</React.Fragment>;
            case 'promise':
              return <React.Fragment key={k}>{enabled.promise && <PromiseChip when={card.promiseBy} />}</React.Fragment>;
            case 'repeat':
              return <React.Fragment key={k}>{enabled.repeat && card.isRepeatCustomer && <span className="nb-chip" data-variant="primary">Repeat</span>}</React.Fragment>;
            case 'lastService':
              return <React.Fragment key={k}>{enabled.lastService && card.lastServiceDate && <span className="nb-chip" data-variant="primary">Last {formatRelativeDate(card.lastServiceDate)}</span>}</React.Fragment>;
            default:
              return null;
          }
        })}
      </div>

  {enabled.price && priceText && (
        <div className="nb-card-footer mt-2">
          <span className="nb-card-price">{priceText}</span>
        </div>
      )}

      {onOpen && (
        <div className="nb-card-open-zone">
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(card.id); }}
            className="nb-chip nb-open-badge"
            data-variant="primary"
            aria-label={`Open details for ${card.customerName}`}
            data-testid={`apt-card-open-${card.id}`}
          >OPEN</button>
        </div>
      )}
    </div>
  );
};

export default EnhancedAppointmentCard;
