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
import '@/styles/appointment-reminders.css';
import '@/styles/cardRobustness.css';

interface AppointmentCardProps {
  card: BoardCard;
  onOpen: (id: string) => void;
  onMove: (id: string) => void;
  onQuickReschedule: (id: string) => void;
}

export default function AppointmentCard({ card, onOpen, onMove, onQuickReschedule }: AppointmentCardProps) {
  // Always call all hooks first to maintain hooks order
  const [minutesUntil, setMinutesUntil] = useState(0);
  const [hasArrived, setHasArrived] = useState(false);
  const [notifiedLate, setNotifiedLate] = useState(false);
  const [notifiedOverdue, setNotifiedOverdue] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalManagerRef = useRef<IntervalManager>(new IntervalManager());

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
      setHasArrived(true);
      
      withCardErrorBoundary(
        () => notifyArrival(validatedCard.id, {
          customer: validatedCard.customerName,
          service: validatedCard.servicesSummary || 'Service'
        }),
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

  // Urgent notification flag
  const hasUrgentNotification = useMemo(() => {
    if (!validatedCard?.start) return false;
    return withCardErrorBoundary(
      () => isOverdue(appointmentTime) || (isRunningLate(appointmentTime) && !hasArrived),
      false,
      'Error determining urgent notification status'
    );
  }, [validatedCard?.start, appointmentTime, hasArrived]);

  // Initialize minutes until
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

          // Check for running late notifications (only if not arrived)
          if (!hasArrived && validatedCard.start) {
            const minutes_past = minutesPast(appointmentTime);
            
            // Running late notification (10+ minutes past start)
            if (minutes_past > 10 && !notifiedLate) {
              notifyLate(validatedCard.id, 'running late', {
                customer: validatedCard.customerName,
                service: validatedCard.servicesSummary || 'Service'
              });
              setNotifiedLate(true);
            }
            
            // Overdue notification (30+ minutes past start)
            if (minutes_past > 30 && !notifiedOverdue) {
              notifyOverdue(validatedCard.id, {
                customer: validatedCard.customerName,
                service: validatedCard.servicesSummary || 'Service'
              });
              setNotifiedOverdue(true);
            }
          }
        },
        undefined,
        'Error updating card state'
      );
    };

    // Initial update
    updateCardState();

    // Set up interval with memory-safe manager
    const intervalId = intervalManager.create(updateCardState, 60000);

    return () => {
      intervalManager.clear(intervalId);
    };
  }, [appointmentTime, validatedCard, hasArrived, notifiedLate, notifiedOverdue]);

  // Cleanup on unmount
  useEffect(() => {
    const intervalManager = intervalManagerRef.current;
    return () => {
      intervalManager.clearAll();
    };
  }, []);

  // Early return for invalid cards AFTER all hooks
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

  // Safe price formatting
  const formattedPrice = formatCardPrice(validatedCard.price);

  return (
    <div
      ref={drag}
      className={`appointment-card relative group ${isDragging ? 'opacity-50' : 'opacity-100'} ${
        hasUrgentNotification ? 'has-urgent-notification' : ''
      }`}
    >
      <button
        className={`card-base w-full text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          hasUrgentNotification ? 'card-urgent' : ''
        } ${urgencyLevel === 'urgent' ? 'card-urgent' : urgencyLevel === 'soon' ? 'card-warning' : ''}`}
        data-card-id={validatedCard.id}
        data-testid={`board-card-${validatedCard.id}`}
        onClick={handleCardClick}
        aria-label={ariaLabel}
        aria-describedby={error ? `error-${validatedCard.id}` : undefined}
      >
        <div className="card-content">
          {/* Urgency Badge with enhanced accessibility */}
          {validatedCard.urgency && (
            <span 
              className={`urgency-badge ${urgencyLevel}`}
              aria-label={`${urgencyLevel} priority`}
              role="status"
            />
          )}
          
          <div className="flex items-center justify-between gap-sp-1">
            <h3 className="text-fs-3 font-semibold text-gray-900">{validatedCard.customerName}</h3>
          </div>
          <div className="text-fs-1 text-gray-600 mt-sp-1 font-normal">{validatedCard.vehicle}</div>
          {validatedCard.servicesSummary && (
            <div className="text-fs-1 text-gray-600 mt-sp-1 font-normal">{validatedCard.servicesSummary}</div>
          )}
          {formattedPrice && (
            <div className="text-fs-2 mt-sp-2 font-medium text-gray-900">
              {formattedPrice}
            </div>
          )}
          
          {/* Urgency Status Line with ARIA support */}
          {urgencyLevel !== 'normal' && (
            <div 
              className={`urgency-status ${urgencyLevel}`}
              role="status"
              aria-live="polite"
            >
              <span className={`urgency-icon ${urgencyLevel}`} aria-hidden="true" />
              {urgencyLevel === 'urgent' ? 'Urgent' : urgencyLevel === 'soon' ? 'Starting Soon' : ''}
            </div>
          )}
          
          {/* Live Countdown Timer with accessibility */}
          <div 
            className={`countdown mt-sp-2 ${
              !validatedCard.start ? 'normal' :
              isOverdue(appointmentTime) ? 'overdue' :
              isRunningLate(appointmentTime) ? 'running-late' :
              isStartingSoon(appointmentTime) ? 'starting-soon' :
              'normal'
            }`}
            role="timer"
            aria-live="polite"
            aria-label={`Appointment timing: ${getCountdownText(minutesUntil)}`}
          >
            <span className="live-indicator" aria-hidden="true" />
            {getCountdownText(minutesUntil)}
          </div>
          
          {/* Customer Arrived Check-in */}
          {!hasArrived && minutesUntil < 60 && minutesUntil > -30 && (
            <div className="mt-sp-2">
              <ArrivalButton 
                onClick={handleMarkArrived} 
                disabled={isLoading}
                aria-label={`Mark ${validatedCard.customerName} as arrived`}
              />
              {isLoading && (
                <span className="sr-only" aria-live="polite">
                  Marking customer as arrived...
                </span>
              )}
            </div>
          )}
          
          {/* Error display */}
          {error && (
            <div 
              id={`error-${validatedCard.id}`}
              className="mt-sp-2 text-red-600 text-fs-0"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>
      </button>
      
      {/* Move button with enhanced accessibility */}
      <button
        className="absolute top-sp-2 right-sp-2 text-fs-0 text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-sp-1 hover:bg-gray-100 transition-colors"
        aria-label={`Move appointment for ${validatedCard.customerName} to different status`}
        onClick={handleMoveClick}
        tabIndex={0}
      >
        <span aria-hidden="true">⋮</span>
      </button>
      
      {/* Quick reschedule button with enhanced accessibility */}
      <button
        className="absolute bottom-sp-2 right-sp-2 p-sp-1 bg-blue-500 text-white rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-300"
        onClick={handleQuickReschedule}
        aria-label={`Quick reschedule appointment for ${validatedCard.customerName}`}
        tabIndex={0}
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}