/**
 * Sprint 1B Card Design System - Robust AppointmentCard Component
 * 
 * Enhanced with comprehensive robustness improvements:
 * - Memory leak prevention with proper cleanup
 * - Performance optimization with memoization
 * - Error handling with graceful fallbacks
 * - Type safety with runtime validation
 * - Accessibility enhancements with ARIA support
 * - Animation performance optimization
 */

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
  determineUrgencyLevel,
  createCardAriaLabel,
  createStatusAnnouncement,
  IntervalManager,
  withCardErrorBoundary,
  measureCardPerformance,
  CardAccessibility,
  type ValidatedCard
} from '@/utils/cardRobustness';
import '@/styles/appointment-reminders.css';

interface AppointmentCardProps {
  card: BoardCard;
  onOpen: (id: string) => void;
  onMove: (id: string) => void;
  onQuickReschedule: (id: string) => void;
}

// Error boundaries for different operations
const DEFAULT_CARD_STATE = {
  minutesUntil: 0,
  hasArrived: false,
  notifiedLate: false,
  notifiedOverdue: false,
  urgencyLevel: 'normal' as const
};

export default function AppointmentCardRobust({ card, onOpen, onMove, onQuickReschedule }: AppointmentCardProps) {
  // Validate and sanitize card data early
  const validatedCard = useMemo(() => {
    return measureCardPerformance(
      () => validateCardData(card),
      'card-validation'
    );
  }, [card]);

  // Early return if card validation fails
  if (!validatedCard) {
    return (
      <div className="appointment-card-error border-red-200 bg-red-50 p-4 rounded-lg">
        <p className="text-red-600 text-sm">Invalid appointment card data</p>
      </div>
    );
  }

  // Safe appointment time parsing with memoization
  const appointmentTime = useMemo(() => 
    validatedCard ? parseAppointmentTime(validatedCard.start) : new Date(), 
    [validatedCard]
  );

  // Interval manager for memory-safe cleanup
  const intervalManagerRef = useRef<IntervalManager>(new IntervalManager());
  const previousUrgencyRef = useRef<string>('normal');

  // Initialize interval manager (now done in useRef above)

  // State with proper typing
  const [cardState, setCardState] = useState(DEFAULT_CARD_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoized urgency level calculation
  const urgencyLevel = useMemo(() => 
    withCardErrorBoundary(
      () => determineUrgencyLevel(validatedCard, appointmentTime, isOverdue, isRunningLate),
      'normal',
      'Error calculating urgency level'
    ),
    [validatedCard, appointmentTime]
  );

  // Memoized ARIA label
  const ariaLabel = useMemo(() => 
    withCardErrorBoundary(
      () => createCardAriaLabel(validatedCard, urgencyLevel, cardState.minutesUntil),
      `Appointment for ${validatedCard.customerName}`,
      'Error creating ARIA label'
    ),
    [validatedCard, urgencyLevel, cardState.minutesUntil]
  );

  // Memoized urgent notification flag
  const hasUrgentNotification = useMemo(() => {
    return withCardErrorBoundary(
      () => {
        if (!validatedCard.start) return false;
        return isOverdue(appointmentTime) || (isRunningLate(appointmentTime) && !cardState.hasArrived);
      },
      false,
      'Error determining urgent notification status'
    );
  }, [validatedCard.start, appointmentTime, cardState.hasArrived]);

  // Memoized drag configuration
  const dragConfig = useMemo(() => ({
    type: 'card',
    item: { id: validatedCard.id, status: validatedCard.status, position: validatedCard.position },
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [validatedCard.id, validatedCard.status, validatedCard.position]);

  const [{ isDragging }, drag] = useDrag(dragConfig);

  // Optimized event handlers with useCallback
  const handleCardClick = useCallback(() => {
    withCardErrorBoundary(
      () => onOpen(validatedCard.id),
      undefined,
      'Error opening card'
    );
  }, [onOpen, validatedCard.id]);

  const handleMoveClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    withCardErrorBoundary(
      () => onMove(validatedCard.id),
      undefined,
      'Error moving card'
    );
  }, [onMove, validatedCard.id]);

  const handleQuickReschedule = useCallback(() => {
    withCardErrorBoundary(
      () => onQuickReschedule(validatedCard.id),
      undefined,
      'Error rescheduling card'
    );
  }, [onQuickReschedule, validatedCard.id]);

  const handleMarkArrived = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      await markArrived(validatedCard.id);
      setCardState(prev => ({ ...prev, hasArrived: true }));
      
      // Notify arrival with error boundary
      withCardErrorBoundary(
        () => notifyArrival(validatedCard.customerName, validatedCard.id),
        undefined,
        'Error sending arrival notification'
      );

      // Announce to screen reader
      CardAccessibility.announceToScreenReader(
        `${validatedCard.customerName} has been marked as arrived`,
        'polite'
      );
    } catch (error) {
      console.error('Error marking arrived:', error);
      setError('Failed to mark as arrived. Please try again.');
      
      // Announce error to screen reader
      CardAccessibility.announceToScreenReader(
        'Failed to mark customer as arrived',
        'assertive'
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, validatedCard]);

  // Optimized interval setup with proper cleanup
  useEffect(() => {
    const updateCardState = () => {
      withCardErrorBoundary(
        () => {
          const newMinutesUntil = getMinutesUntil(appointmentTime);
          
          setCardState(prevState => {
            const newState = { ...prevState, minutesUntil: newMinutesUntil };

            // Check for running late notifications (only if not arrived)
            if (!prevState.hasArrived && validatedCard.start) {
              const minutes_past = minutesPast(appointmentTime);
              
              // Running late notification (10+ minutes past start)
              if (minutes_past > 10 && !prevState.notifiedLate) {
                withCardErrorBoundary(
                  () => notifyLate(validatedCard.customerName, validatedCard.id, minutes_past),
                  undefined,
                  'Error sending late notification'
                );
                newState.notifiedLate = true;
              }
              
              // Overdue notification (30+ minutes past start)
              if (minutes_past > 30 && !prevState.notifiedOverdue) {
                withCardErrorBoundary(
                  () => notifyOverdue(validatedCard.customerName, validatedCard.id, minutes_past),
                  undefined,
                  'Error sending overdue notification'
                );
                newState.notifiedOverdue = true;
              }
            }

            return newState;
          });
        },
        undefined,
        'Error updating card state'
      );
    };

    // Initial update
    updateCardState();

    // Set up interval with memory-safe manager
    const intervalId = intervalManagerRef.current!.create(updateCardState, 60000);

    // Cleanup function
    return () => {
      intervalManagerRef.current?.clear(intervalId);
    };
  }, [appointmentTime, validatedCard.id, validatedCard.customerName, validatedCard.servicesSummary, validatedCard.start]);

  // Announce urgency level changes to screen readers
  useEffect(() => {
    const announcement = createStatusAnnouncement(
      previousUrgencyRef.current,
      urgencyLevel,
      validatedCard.customerName
    );
    
    if (announcement) {
      CardAccessibility.announceToScreenReader(announcement, 'polite');
    }
    
    previousUrgencyRef.current = urgencyLevel;
  }, [urgencyLevel, validatedCard.customerName]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intervalManagerRef.current?.clearAll();
    };
  }, []);

  // Memoized price formatting
  const formattedPrice = useMemo(() => 
    formatCardPrice(validatedCard.price),
    [validatedCard.price]
  );

  // Memoized countdown text
  const countdownText = useMemo(() => 
    withCardErrorBoundary(
      () => getCountdownText(cardState.minutesUntil),
      'Time unavailable',
      'Error formatting countdown text'
    ),
    [cardState.minutesUntil]
  );

  // Memoized countdown status class
  const countdownStatusClass = useMemo(() => {
    if (!validatedCard.start) return 'normal';
    if (isOverdue(appointmentTime)) return 'overdue';
    if (isRunningLate(appointmentTime)) return 'running-late';
    if (isStartingSoon(appointmentTime)) return 'starting-soon';
    return 'normal';
  }, [validatedCard.start, appointmentTime]);

  // Show arrival button logic
  const showArrivalButton = useMemo(() => 
    !cardState.hasArrived && 
    cardState.minutesUntil < 60 && 
    cardState.minutesUntil > -30,
    [cardState.hasArrived, cardState.minutesUntil]
  );

  return (
    <div
      ref={drag}
      className={`appointment-card relative group ${isDragging ? 'opacity-50' : 'opacity-100'} ${
        hasUrgentNotification ? 'has-urgent-notification' : ''
      }`}
      data-testid={`appointment-card-${validatedCard.id}`}
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
          
          {/* Header with customer name */}
          <div className="flex items-center justify-between gap-sp-1">
            <h3 className="text-fs-3 font-semibold text-gray-900" id={`customer-${validatedCard.id}`}>
              {validatedCard.customerName}
            </h3>
          </div>
          
          {/* Vehicle information */}
          <div className="text-fs-1 text-gray-600 mt-sp-1 font-normal">
            {validatedCard.vehicle}
          </div>
          
          {/* Services summary */}
          {validatedCard.servicesSummary && (
            <div className="text-fs-1 text-gray-600 mt-sp-1 font-normal">
              {validatedCard.servicesSummary}
            </div>
          )}
          
          {/* Price with safe formatting */}
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
            className={`countdown mt-sp-2 ${countdownStatusClass}`}
            role="timer"
            aria-live="polite"
            aria-label={`Appointment timing: ${countdownText}`}
          >
            <span className="live-indicator" aria-hidden="true" />
            {countdownText}
          </div>
          
          {/* Customer Arrived Check-in */}
          {showArrivalButton && (
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
      
      {/* Live region for screen reader announcements */}
      <div className="sr-only" aria-live="polite" id={`announcements-${validatedCard.id}`} />
    </div>
  );
}
