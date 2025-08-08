import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { BoardCard } from '@/types/models';
import { getMinutesUntil, minutesPast, isRunningLate, isOverdue } from '@/utils/time';
import { notifyLate, notifyOverdue, notifyArrival } from '@/services/notificationService';
import { markArrived } from '@/lib/api';
import { 
  validateCardData, 
  parseAppointmentTime, 
  determineUrgencyLevel,
  IntervalManager,
  withCardErrorBoundary,
  CardAccessibility,
  type ValidatedCard
} from '@/utils/cardRobustness';

interface CardState {
  minutesUntil: number;
  hasArrived: boolean;
  notifiedLate: boolean;
  notifiedOverdue: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UseRobustCardStateOptions {
  updateInterval?: number; // Default: 60000ms (1 minute)
  enableNotifications?: boolean; // Default: true
  enableAccessibilityAnnouncements?: boolean; // Default: true
}

interface UseRobustCardStateReturn {
  validatedCard: ValidatedCard | null;
  cardState: CardState;
  urgencyLevel: 'urgent' | 'soon' | 'normal';
  appointmentTime: Date;
  hasUrgentNotification: boolean;
  actions: {
    markAsArrived: () => Promise<void>;
    resetNotifications: () => void;
    clearError: () => void;
  };
}

const DEFAULT_CARD_STATE: CardState = {
  minutesUntil: 0,
  hasArrived: false,
  notifiedLate: false,
  notifiedOverdue: false,
  isLoading: false,
  error: null,
};

export function useRobustCardState(
  card: BoardCard,
  options: UseRobustCardStateOptions = {}
): UseRobustCardStateReturn {
  const {
    updateInterval = 60000,
    enableNotifications = true,
    enableAccessibilityAnnouncements = true,
  } = options;

  // Validate card data with memoization
  const validatedCard = useMemo(() => {
    return withCardErrorBoundary(
      () => validateCardData(card),
      null,
      'Card validation failed'
    );
  }, [card]);

  // Parse appointment time safely
  const appointmentTime = useMemo(() => {
    if (!validatedCard) return new Date();
    return parseAppointmentTime(validatedCard.start);
  }, [validatedCard]);

  // State management
  const [cardState, setCardState] = useState<CardState>(DEFAULT_CARD_STATE);
  
  // Refs for cleanup and performance
  const intervalManagerRef = useRef<IntervalManager>(new IntervalManager());
  const previousUrgencyRef = useRef<string>('normal');
  const notificationTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Initialize interval manager
  // (moved to useRef initialization above)

  // Calculate urgency level with memoization
  const urgencyLevel = useMemo(() => {
    if (!validatedCard) return 'normal';
    return withCardErrorBoundary(
      () => determineUrgencyLevel(validatedCard, appointmentTime, isOverdue, isRunningLate),
      'normal',
      'Error calculating urgency level'
    );
  }, [validatedCard, appointmentTime]);

  // Calculate urgent notification flag
  const hasUrgentNotification = useMemo(() => {
    if (!validatedCard?.start || cardState.hasArrived) return false;
    return withCardErrorBoundary(
      () => isOverdue(appointmentTime) || isRunningLate(appointmentTime),
      false,
      'Error determining urgent notification status'
    );
  }, [validatedCard?.start, appointmentTime, cardState.hasArrived]);

  // Mark as arrived action with error handling
  const markAsArrived = useCallback(async () => {
    if (!validatedCard || cardState.isLoading) return;

    setCardState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await markArrived(validatedCard.id);
      
      setCardState(prev => ({ 
        ...prev, 
        hasArrived: true, 
        isLoading: false 
      }));

      // Send notification if enabled
      if (enableNotifications) {
        withCardErrorBoundary(
          () => notifyArrival(validatedCard.customerName, validatedCard.id),
          undefined,
          'Error sending arrival notification'
        );
      }

      // Announce to screen reader if enabled
      if (enableAccessibilityAnnouncements) {
        CardAccessibility.announceToScreenReader(
          `${validatedCard.customerName} has been marked as arrived`,
          'polite'
        );
      }
    } catch (error) {
      console.error('Error marking arrived:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark as arrived';
      
      setCardState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        isLoading: false 
      }));

      // Announce error to screen reader if enabled
      if (enableAccessibilityAnnouncements) {
        CardAccessibility.announceToScreenReader(
          'Failed to mark customer as arrived',
          'assertive'
        );
      }
    }
  }, [validatedCard, cardState.isLoading, enableNotifications, enableAccessibilityAnnouncements]);

  // Reset notifications action
  const resetNotifications = useCallback(() => {
    setCardState(prev => ({
      ...prev,
      notifiedLate: false,
      notifiedOverdue: false,
    }));
  }, []);

  // Clear error action
  const clearError = useCallback(() => {
    setCardState(prev => ({ ...prev, error: null }));
  }, []);

  // Safe notification sender with timeout management
  const sendNotificationSafely = useCallback((
    notificationFn: () => void,
    delay: number = 0
  ) => {
    const timeoutId = setTimeout(() => {
      withCardErrorBoundary(
        notificationFn,
        undefined,
        'Error sending notification'
      );
      notificationTimeoutsRef.current.delete(timeoutId);
    }, delay);

    notificationTimeoutsRef.current.add(timeoutId);
  }, []);

  // Update card state with notifications
  const updateCardState = useCallback(() => {
    if (!validatedCard) return;

    withCardErrorBoundary(
      () => {
        const newMinutesUntil = getMinutesUntil(appointmentTime);
        
        setCardState(prevState => {
          const newState = { ...prevState, minutesUntil: newMinutesUntil };

          // Only process notifications if enabled and not arrived
          if (enableNotifications && !prevState.hasArrived && validatedCard.start) {
            const minutes_past = minutesPast(appointmentTime);
            
            // Running late notification (10+ minutes past start)
            if (minutes_past > 10 && !prevState.notifiedLate) {
              sendNotificationSafely(() => {
                notifyLate(validatedCard.customerName, validatedCard.id, minutes_past);
              });
              newState.notifiedLate = true;
            }
            
            // Overdue notification (30+ minutes past start)
            if (minutes_past > 30 && !prevState.notifiedOverdue) {
              sendNotificationSafely(() => {
                notifyOverdue(validatedCard.customerName, validatedCard.id, minutes_past);
              });
              newState.notifiedOverdue = true;
            }
          }

          return newState;
        });
      },
      undefined,
      'Error updating card state'
    );
  }, [validatedCard, appointmentTime, enableNotifications, sendNotificationSafely]);

  // Set up interval for updates
  useEffect(() => {
    if (!validatedCard) return;

    // Initial update
    updateCardState();

    // Set up interval with stable reference
    const intervalManager = intervalManagerRef.current;
    const intervalId = intervalManager.create(updateCardState, updateInterval);

    // Cleanup function
    return () => {
      intervalManager.clear(intervalId);
    };
  }, [validatedCard, updateCardState, updateInterval]);

  // Handle urgency level changes for accessibility
  useEffect(() => {
    if (!enableAccessibilityAnnouncements || !validatedCard) return;

    const prevUrgency = previousUrgencyRef.current;
    const currentUrgency = urgencyLevel;

    if (prevUrgency !== currentUrgency) {
      let announcement = '';
      
      if (currentUrgency === 'urgent' && prevUrgency !== 'urgent') {
        announcement = `${validatedCard.customerName}'s appointment is now urgent`;
      } else if (currentUrgency === 'soon' && prevUrgency === 'normal') {
        announcement = `${validatedCard.customerName}'s appointment is starting soon`;
      } else if (currentUrgency === 'normal' && prevUrgency !== 'normal') {
        announcement = `${validatedCard.customerName}'s appointment status returned to normal`;
      }

      if (announcement) {
        CardAccessibility.announceToScreenReader(announcement, 'polite');
      }
    }

    previousUrgencyRef.current = currentUrgency;
  }, [urgencyLevel, validatedCard, enableAccessibilityAnnouncements]);

  // Cleanup on unmount
  useEffect(() => {
    const intervalManager = intervalManagerRef.current;
    const notificationTimeouts = notificationTimeoutsRef.current;
    
    return () => {
      // Clear all intervals
      intervalManager.clearAll();
      
      // Clear all notification timeouts
      notificationTimeouts.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      notificationTimeouts.clear();
    };
  }, []);

  // Handle card changes (e.g., when card prop changes)
  useEffect(() => {
    if (!validatedCard) {
      setCardState(DEFAULT_CARD_STATE);
      return;
    }

    // Reset certain state when card changes
    setCardState(prev => ({
      ...prev,
      error: null, // Clear errors when card changes
    }));
  }, [validatedCard]);

  return {
    validatedCard,
    cardState,
    urgencyLevel,
    appointmentTime,
    hasUrgentNotification,
    actions: {
      markAsArrived,
      resetNotifications,
      clearError,
    },
  };
}

// Error boundary helper for card hooks
export function createCardStateErrorHandler(componentName: string = 'CardState') {
  return function handleCardStateError(error: unknown, fallbackValue: unknown = null) {
    console.error(`${componentName} error:`, error);
    return fallbackValue;
  };
}
