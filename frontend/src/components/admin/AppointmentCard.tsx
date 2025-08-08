import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { BoardCard } from '@/types/models';
import { useDrag } from 'react-dnd';
import { RefreshCw } from 'lucide-react';
import { getMinutesUntil, minutesPast, getCountdownText, isStartingSoon, isRunningLate, isOverdue } from '@/utils/time';
import ArrivalButton from './ArrivalButton';
import { markArrived } from '@/lib/api';
import { notifyLate, notifyOverdue, notifyArrival } from '@/services/notificationService';
import { 
  validateCardData, 
  parseAppointmentTime, 
  formatCardPrice, 
  createCardAriaLabel,
  withCardErrorBoundary,
  CardAccessibility,
  IntervalManager
} from '@/utils/cardRobustness';
import { safeAnimateCompletion } from '@/animations/completionAnimations';
import '@/styles/appointment-reminders.css';
import '@/styles/cardRobustness.css';
import '@/styles/completionAnimations.css';
import '@/styles/animations.css';
import StatusIcons, { ServiceTypeIcons } from '../common/StatusIcons';

interface AppointmentCardProps {
  card: BoardCard;
  onOpen: (id: string) => void;
  onMove: (id: string) => void;
  onQuickReschedule: (id: string) => void;
  isRescheduling?: boolean;
  onCompleteJob?: (id: string) => void;
  isCompleting?: boolean;
  onCardRemoved?: (id: string) => void;
}

export default function AppointmentCard({ 
  card, 
  onOpen, 
  onMove, 
  onQuickReschedule, 
  isRescheduling = false,
  onCompleteJob,
  isCompleting = false,
  onCardRemoved
}: AppointmentCardProps) {
  // Always call all hooks first to maintain hooks order
  const [minutesUntil, setMinutesUntil] = useState(0);
  const [hasArrived, setHasArrived] = useState(false);
  const [notifiedLate, setNotifiedLate] = useState(false);
  const [notifiedOverdue, setNotifiedOverdue] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalManagerRef = useRef<IntervalManager>(new IntervalManager());
  const cardRef = useRef<HTMLDivElement>(null);

  // Validate card data with error boundary
  const validatedCard = useMemo(() => {
    return withCardErrorBoundary(
      () => validateCardData(card),
      null,
      'Card validation failed'
    );
  }, [card]);

  // Safe appointment time parsing
  const appointmentTime = useMemo(() => {
    if (!validatedCard) return new Date();
    return parseAppointmentTime(validatedCard.start);
  }, [validatedCard]);
  
  // Enhanced urgency level calculation
  const getUrgencyLevel = useCallback(() => {
    if (!validatedCard) return 'normal';
    return withCardErrorBoundary(
      () => {
        if (!validatedCard.start) return 'normal';
        if (validatedCard.urgency === 'urgent' || isOverdue(appointmentTime)) return 'urgent';
        if (validatedCard.urgency === 'soon' || isRunningLate(appointmentTime)) return 'soon';
        return 'normal';
      },
      'normal',
      'Error determining urgency level'
    );
  }, [validatedCard, appointmentTime]);
  
  const urgencyLevel = useMemo(() => getUrgencyLevel(), [getUrgencyLevel]);

  // Enhanced ARIA label
  const ariaLabel = useMemo(() => {
    if (!validatedCard) return 'Invalid appointment';
    return createCardAriaLabel(validatedCard, urgencyLevel, minutesUntil);
  }, [validatedCard, urgencyLevel, minutesUntil]);

  // Drag functionality
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'card',
    item: { 
      id: validatedCard?.id || '', 
      status: validatedCard?.status || 'SCHEDULED', 
      position: validatedCard?.position || 0 
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [validatedCard]);

  // Connect drag to ref
  drag(cardRef);

  // Event handlers with useCallback
  const handleCardClick = useCallback(() => {
    if (!validatedCard) return;
    withCardErrorBoundary(() => onOpen(validatedCard.id), undefined, 'Error opening card');
  }, [onOpen, validatedCard]);

  const handleMoveClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!validatedCard) return;
    withCardErrorBoundary(() => onMove(validatedCard.id), undefined, 'Error moving card');
  }, [onMove, validatedCard]);

  const handleQuickReschedule = useCallback(() => {
    if (!validatedCard) return;
    withCardErrorBoundary(() => onQuickReschedule(validatedCard.id), undefined, 'Error rescheduling card');
  }, [onQuickReschedule, validatedCard]);

  const handleMarkArrived = useCallback(async () => {
    if (!validatedCard || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      await markArrived(validatedCard.id);
      setHasArrived(true);        withCardErrorBoundary(
        () => notifyArrival(validatedCard.customerName, validatedCard.id),
        undefined,
        'Error sending arrival notification'
      );

      CardAccessibility.announceToScreenReader(
        `${validatedCard.customerName} has been marked as arrived`,
        'polite'
      );
    } catch (error) {
      console.error('Error marking arrived:', error);
      setError('Failed to mark as arrived. Please try again.');
      
      CardAccessibility.announceToScreenReader(
        'Failed to mark customer as arrived',
        'assertive'
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, validatedCard]);

  // Completion handler
  const handleCompleteJob = useCallback(async () => {
    if (!validatedCard || !onCompleteJob || isCompleting) return;

    try {
      onCompleteJob(validatedCard.id);
      CardAccessibility.announceToScreenReader(
        `Completing appointment for ${validatedCard.customerName}`,
        'polite'
      );
    } catch (error) {
      console.error('Error completing job:', error);
      setError('Failed to complete job. Please try again.');
      CardAccessibility.announceToScreenReader(
        'Failed to complete appointment',
        'assertive'
      );
    }
  }, [validatedCard, onCompleteJob, isCompleting]);

  useEffect(() => {
    if (!validatedCard || !cardRef.current) return;
    
    if (validatedCard.status === 'COMPLETED') {
      safeAnimateCompletion(cardRef.current, () => {
        if (onCardRemoved) {
          onCardRemoved(validatedCard.id);
        }
      });
    }
  }, [validatedCard, onCardRemoved]);

  const hasUrgentNotification = useMemo(() => {
    if (!validatedCard?.start) return false;
    return withCardErrorBoundary(
      () => isOverdue(appointmentTime) || (isRunningLate(appointmentTime) && !hasArrived),
      false,
      'Error determining urgent notification status'
    );
  }, [validatedCard?.start, appointmentTime, hasArrived]);

  useEffect(() => {
    if (validatedCard) {
      setMinutesUntil(getMinutesUntil(appointmentTime));
    }
  }, [validatedCard, appointmentTime]);

  useEffect(() => {
    if (!validatedCard) return;

    const intervalManager = intervalManagerRef.current;
    
    const updateCardState = () => {
      withCardErrorBoundary(
        () => {
          const newMinutesUntil = getMinutesUntil(appointmentTime);
          setMinutesUntil(newMinutesUntil);

          if (!hasArrived && validatedCard.start) {
            const minutes_past = minutesPast(appointmentTime);
            
            if (minutes_past > 10 && !notifiedLate) {
              notifyLate(validatedCard.customerName, validatedCard.id, minutes_past);
              setNotifiedLate(true);
            }
            
            if (minutes_past > 30 && !notifiedOverdue) {
              notifyOverdue(validatedCard.customerName, validatedCard.id, minutes_past);
              setNotifiedOverdue(true);
            }
          }
        },
        undefined,
        'Error updating card state'
      );
    };

    updateCardState();
    const intervalId = intervalManager.create(updateCardState, 60000);

    return () => {
      intervalManager.clear(intervalId);
    };
  }, [appointmentTime, validatedCard, hasArrived, notifiedLate, notifiedOverdue]);

  useEffect(() => {
    const intervalManager = intervalManagerRef.current;
    return () => {
      intervalManager.clearAll();
    };
  }, []);

  if (!validatedCard) {
    console.error('Invalid card data provided to AppointmentCard:', card);
    return (
      <div className="card-base p-4 bg-red-50 border-red-200">
        <div className="text-red-600 text-sm">
          Error: Invalid appointment data
        </div>
      </div>
    );
  }

  const formattedPrice = formatCardPrice(validatedCard.price);

  const getServiceIcon = (service: string) => {
    const svc = (service || '').toLowerCase();
    if (svc.includes('brake')) return ServiceTypeIcons.brake();
    if (svc.includes('oil')) return ServiceTypeIcons.oil();
    if (svc.includes('diagnostic')) return ServiceTypeIcons.diagnostic();
    return ServiceTypeIcons.general();
  };

  return (
    <div
      ref={cardRef}
      className={`card-base p-4 transition-all duration-300 ease-out card-enter ${hasUrgentNotification ? 'urgent-pulse' : ''} ${isDragging ? 'card-drag-preview' : ''}`}
      onClick={handleCardClick}
      aria-label={ariaLabel}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {getServiceIcon(validatedCard.servicesSummary || '')}
          <div>
            <h3 className="text-lg font-bold text-neutral-900 leading-tight mb-1 truncate">{validatedCard.servicesSummary || 'Service'}</h3>
            <div className="text-sm text-neutral-600">{validatedCard.customerName || 'Walk-in Customer'}</div>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <TimeDisplay card={validatedCard} minutesUntil={minutesUntil} />
          {validatedCard.price ? (
            <div className="text-xs text-neutral-400 mt-2">${validatedCard.price.toFixed(2)}</div>
          ) : null}
        </div>
      </div>

      <div className={`transition-all duration-200 ${isDragging ? 'opacity-80' : 'opacity-100'}`}>
        <div className="text-sm text-neutral-500 mb-2">
          <svg className="w-4 h-4 inline mr-2 text-neutral-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
          {validatedCard.vehicle || 'Vehicle TBD'}
        </div>

        <QuickActions card={validatedCard} />
      </div>

      <div className="absolute top-3 right-3">
        <button
          className="text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300 rounded p-1 hover:bg-neutral-100 transition-colors"
          aria-label={`Move appointment for ${validatedCard.customerName}`}
          onClick={(e) => { e.stopPropagation(); handleMoveClick(e as any); }}
        >
          ⋮
        </button>
      </div>

      <div className="absolute bottom-3 right-3">
        <button
          className={`p-2 rounded-full transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-300 ${isRescheduling ? 'bg-neutral-500' : 'bg-primary-600 hover:bg-primary-700'} text-white`}
          onClick={(e) => { e.stopPropagation(); handleQuickReschedule(); }}
          aria-label={`Quick reschedule appointment for ${validatedCard.customerName}`}
          disabled={isRescheduling}
        >
          <RefreshCw className={`${isRescheduling ? 'animate-spin' : ''} h-4 w-4`} aria-hidden />
        </button>
      </div>
    </div>
  );
}

const TimeDisplay = ({ card, minutesUntil }: { card: BoardCard; minutesUntil: number }) => {
  if (!card) return null;

  if (card.isOverdue && card.status === 'IN_PROGRESS') {
    return (
      <div className={"inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border bg-danger-50 text-danger-800 border-danger-200"}>
        <span className="mr-1">⚠️</span>
        {card.minutesLate}m overdue
      </div>
    );
  }

  if (typeof card.timeUntilStart === 'number' && card.timeUntilStart <= 30 && card.timeUntilStart > 0) {
    return (
      <div className={"inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border bg-warning-50 text-warning-800 border-warning-200"}>
        <span className="mr-1">🕐</span>
        Starting in {card.timeUntilStart}m
      </div>
    );
  }

  if (card.scheduledTime && card.status === 'SCHEDULED') {
    return (
      <div className={"inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border bg-primary-50 text-primary-700 border-primary-200"}>
        <span className="mr-1">📅</span>
        {card.scheduledTime}
      </div>
    );
  }

  if (card.status === 'IN_PROGRESS' && card.start) {
    const elapsed = Math.floor((Date.now() - new Date(card.start).getTime()) / 60000);
    return (
      <div className={"inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border bg-success-50 text-success-700 border-success-200"}>
        <span className="mr-1">⚙️</span>
        {elapsed}m in progress
      </div>
    );
  }

  return null;
};

const QuickActions = ({ card }: { card: BoardCard }) => {
  const getActions = () => {
    if (card.isOverdue) {
      return [
        { label: 'Mark Started', action: 'start', urgent: true },
        { label: 'Contact Customer', action: 'contact', urgent: false },
        { label: 'Reschedule', action: 'reschedule', urgent: false },
      ];
    }

    if (typeof card.timeUntilStart === 'number' && card.timeUntilStart <= 15 && card.timeUntilStart > 0) {
      return [
        { label: 'Start Now', action: 'start', urgent: true },
        { label: 'Prep Workspace', action: 'prep', urgent: false },
      ];
    }

    if (card.status === 'IN_PROGRESS') {
      return [
        { label: 'Mark Complete', action: 'complete', urgent: true },
        { label: 'Add Note', action: 'note', urgent: false },
      ];
    }

    return [];
  };

  const actions = getActions();
  if (actions.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-neutral-200">
      <div className="flex flex-wrap gap-2">
        {actions.map(action => (
          <button
            key={action.action}
            className={
              `text-xs px-3 py-1 rounded-full font-medium transition-colors ${action.urgent ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`
            }
            onClick={(e) => { e.stopPropagation(); /* action handlers live in parent */ }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};