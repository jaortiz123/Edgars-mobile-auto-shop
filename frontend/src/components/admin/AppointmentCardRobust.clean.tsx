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
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS

  // Validate and sanitize card data early
  const validatedCard = useMemo(() => {
    return measureCardPerformance(
      () => validateCardData(card),
      'card-validation'
    );
  }, [card]);

  // Safe appointment time parsing with memoization
  const appointmentTime = useMemo(() =>
    validatedCard ? parseAppointmentTime(validatedCard.start) : new Date(),
    [validatedCard]
  );

  // Interval manager for memory-safe cleanup
  const intervalManagerRef = useRef<IntervalManager>(new IntervalManager());
  const previousUrgencyRef = useRef<string>('normal');

  // State with proper typing
  const [cardState, setCardState] = useState(DEFAULT_CARD_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoized urgency level calculation - handles null validatedCard
  const urgencyLevel = useMemo(() => {
    if (!validatedCard) return 'normal';
    return withCardErrorBoundary(
      () => determineUrgencyLevel(validatedCard, appointmentTime, isOverdue, isRunningLate),
      'normal',
      'Error calculating urgency level'
    );
  }, [validatedCard, appointmentTime]);

  // Memoized ARIA label generation - handles null validatedCard
  const ariaLabel = useMemo(() => {
    if (!validatedCard) return 'Invalid appointment card';
    return withCardErrorBoundary(
      () => createCardAriaLabel(validatedCard, cardState),
      'Appointment card',
      'Error creating ARIA label'
    );
  }, [validatedCard, cardState]);

  // Check for urgent notifications - handles null validatedCard
  const hasUrgentNotification = useMemo(() => {
    if (!validatedCard) return false;
    return withCardErrorBoundary(
      () => {
        const minutesUntil = getMinutesUntil(validatedCard.start);
        return isStartingSoon(minutesUntil) || isRunningLate(validatedCard.start, appointmentTime);
      },
      false,
      'Error checking urgent notifications'
    );
  }, [validatedCard, appointmentTime, cardState.hasArrived]);

  // Drag and drop configuration - handles null validatedCard
  const dragConfig = useMemo(() => {
    if (!validatedCard) {
      return {
        type: 'appointment',
        item: { id: '', type: 'SCHEDULED' },
        collect: (monitor: any) => ({
          isDragging: monitor.isDragging(),
        }),
      };
    }
    return {
      type: 'appointment',
      item: { id: validatedCard.id, type: validatedCard.status },
      collect: (monitor: any) => ({
        isDragging: monitor.isDragging(),
      }),
    };
  }, [validatedCard]);

  const [{ isDragging }, drag] = useDrag(dragConfig);

  // Memoized handlers - handles null validatedCard
  const handleCardClick = useCallback(() => {
    if (!validatedCard) return;
    onOpen(validatedCard.id);
  }, [onOpen, validatedCard]);

  const handleQuickReschedule = useCallback(() => {
    if (!validatedCard) return;
    withCardErrorBoundary(
      () => onQuickReschedule(validatedCard.id),
      undefined,
      'Error during quick reschedule'
    );
  }, [onQuickReschedule, validatedCard]);

  const handleMarkArrived = useCallback(async () => {
    if (!validatedCard) return;
    setIsLoading(true);
    setError(null);

    try {
      await withCardErrorBoundary(
        () => notifyArrival(validatedCard.id),
        undefined,
        'Error notifying arrival'
      );

      setCardState(prev => ({ ...prev, hasArrived: true }));
    } catch (err) {
      setError('Failed to mark as arrived');
    } finally {
      setIsLoading(false);
    }
  }, [validatedCard]);

  // Main state update function
  useEffect(() => {
    if (!validatedCard) return;

    const updateCardState = () => {
      withCardErrorBoundary(() => {
        setCardState(prevState => {
          const newMinutesUntil = getMinutesUntil(validatedCard.start);
          const newState = { ...prevState, minutesUntil: newMinutesUntil };

          // Handle notifications
          if (isStartingSoon(newMinutesUntil) && !prevState.notifiedLate) {
            withCardErrorBoundary(
              () => notifyLate(validatedCard.id),
              undefined,
              'Error sending upcoming notification'
            );
            newState.notifiedLate = true;
          }

          if (isOverdue && !prevState.notifiedOverdue) {
            withCardErrorBoundary(
              () => notifyOverdue(validatedCard.id),
              undefined,
              'Error sending overdue notification'
            );
            newState.notifiedOverdue = true;
          }

          return newState;
        });
      }, undefined, 'Error updating card state');
    };

    updateCardState();
    const intervalId = intervalManagerRef.current?.setInterval(updateCardState, 60000);

    return () => {
      if (intervalId) {
        intervalManagerRef.current?.clear(intervalId);
      }
    };
  }, [validatedCard, urgencyLevel]);

  // Accessibility announcements
  useEffect(() => {
    if (!validatedCard) return;

    const currentUrgency = urgencyLevel;
    if (currentUrgency !== previousUrgencyRef.current) {
      const announcement = `Appointment urgency changed to ${currentUrgency}`;
      CardAccessibility.announceToScreenReader(announcement, 'polite');
      previousUrgencyRef.current = currentUrgency;
    }
  }, [urgencyLevel, validatedCard]);

  // Cleanup on unmount
  useEffect(() => {
    const intervalManager = intervalManagerRef.current;
    return () => {
      intervalManager?.clearAll();
    };
  }, []);

  // Memoized countdown text - handles null validatedCard
  const countdownText = useMemo(() => {
    if (!validatedCard) return 'Invalid';
    return withCardErrorBoundary(
      () => getCountdownText(cardState.minutesUntil),
      'Unknown',
      'Error calculating countdown'
    );
  }, [cardState.minutesUntil, validatedCard]);

  const showArrivalButton = useMemo(() =>
    !cardState.hasArrived && cardState.minutesUntil <= 15,
    [cardState.hasArrived, cardState.minutesUntil]
  );

  // EARLY RETURN ONLY AFTER ALL HOOKS ARE CALLED
  if (!validatedCard) {
    return (
      <div className="appointment-card-error border-red-200 bg-red-50 p-4 rounded-lg">
        <p className="text-red-600 text-sm">Invalid appointment card data</p>
      </div>
    );
  }

  // Safe render with all hooks properly handled
  return (
    <div
      ref={drag}
      className={`appointment-card relative group ${isDragging ? 'opacity-50' : 'opacity-100'} ${
        hasUrgentNotification ? 'has-urgent-notification' : ''
      } transition-all duration-200 ease-in-out cursor-pointer hover:shadow-lg border rounded-lg p-3 bg-white
        ${urgencyLevel === 'urgent' ? 'border-red-500 bg-red-50' : urgencyLevel === 'soon' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200'
      }`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      {/* Urgency Badge */}
      {urgencyLevel !== 'normal' && (
        <div className={`absolute -top-2 -right-2 px-2 py-1 text-xs font-bold rounded-full ${
          urgencyLevel === 'urgent' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'
        }`}>
          {urgencyLevel.toUpperCase()}
        </div>
      )}

      {/* Header with customer name */}
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-900 truncate">
          {validatedCard.customerName}
        </h3>
        <span className="text-sm text-gray-500 ml-2">
          {countdownText}
        </span>
      </div>

      {/* Vehicle info */}
      <div className="text-sm text-gray-600 mb-2">
        {validatedCard.vehicleInfo}
      </div>

      {/* Services */}
      <div className="text-sm text-gray-700 mb-2">
        {validatedCard.services?.join(', ') || 'No services'}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center mt-3">
        {showArrivalButton && (
          <ArrivalButton
            onMarkArrived={handleMarkArrived}
            isLoading={isLoading}
            disabled={cardState.hasArrived}
          />
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleQuickReschedule();
          }}
          className="text-blue-600 hover:text-blue-800 text-sm"
          disabled={isLoading}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-2 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
          <div className="text-sm text-gray-600">Processing...</div>
        </div>
      )}
    </div>
  );
}
