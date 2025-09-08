import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';

interface AccessibilityContextType {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  announceError: (message: string) => void;
  announceSuccess: (message: string) => void;
  announceInfo: (message: string) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

export const useAccessibility = (): AccessibilityContextType => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

/**
 * Global Accessibility Provider with centralized aria-live regions
 *
 * This provider implements WCAG 2.2 AA compliance by:
 * - Providing separate aria-live regions for different priority levels
 * - Ensuring all status updates are announced to assistive technologies
 * - Managing announcement queue to prevent overlap
 * - Following screen reader best practices
 */
export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
  const politeRegionRef = useRef<HTMLDivElement>(null);
  const assertiveRegionRef = useRef<HTMLDivElement>(null);
  const announcementQueueRef = useRef<{ message: string; priority: 'polite' | 'assertive'; timestamp: number }[]>([]);
  const isProcessingRef = useRef(false);

  /**
   * Process announcement queue to prevent overlapping announcements
   */
  const processAnnouncementQueue = useCallback(() => {
    if (isProcessingRef.current || announcementQueueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;
    const announcement = announcementQueueRef.current.shift();

    if (!announcement) {
      isProcessingRef.current = false;
      return;
    }

    const targetRegion = announcement.priority === 'assertive'
      ? assertiveRegionRef.current
      : politeRegionRef.current;

    if (targetRegion) {
      // Clear previous content
      targetRegion.textContent = '';

      // Set new content after a brief delay to ensure screen readers pick it up
      setTimeout(() => {
        if (targetRegion) {
          targetRegion.textContent = announcement.message;
        }

        // Clear the message after it's been announced
        setTimeout(() => {
          if (targetRegion) {
            targetRegion.textContent = '';
          }
          isProcessingRef.current = false;

          // Process next announcement if any
          if (announcementQueueRef.current.length > 0) {
            processAnnouncementQueue();
          }
        }, 1000);
      }, 100);
    } else {
      isProcessingRef.current = false;
    }
  }, []);

  /**
   * Add announcement to queue and process
   */
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!message.trim()) return;

    announcementQueueRef.current.push({
      message: message.trim(),
      priority,
      timestamp: Date.now()
    });

    processAnnouncementQueue();
  }, [processAnnouncementQueue]);

  /**
   * Announce error messages with high priority
   */
  const announceError = useCallback((message: string) => {
    announce(`Error: ${message}`, 'assertive');
  }, [announce]);

  /**
   * Announce success messages
   */
  const announceSuccess = useCallback((message: string) => {
    announce(`Success: ${message}`, 'polite');
  }, [announce]);

  /**
   * Announce informational messages
   */
  const announceInfo = useCallback((message: string) => {
    announce(message, 'polite');
  }, [announce]);

  /**
   * Clean up queue on unmount
   */
  useEffect(() => {
    return () => {
      announcementQueueRef.current = [];
      isProcessingRef.current = false;
    };
  }, []);

  const contextValue: AccessibilityContextType = {
    announce,
    announceError,
    announceSuccess,
    announceInfo
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}

      {/* Global aria-live regions for screen reader announcements */}
      <div className="sr-only">
        {/* Polite announcements - won't interrupt current speech */}
        <div
          ref={politeRegionRef}
          aria-live="polite"
          aria-atomic="true"
          aria-relevant="text"
          data-testid="aria-live-polite"
        />

        {/* Assertive announcements - will interrupt current speech for urgent messages */}
        <div
          ref={assertiveRegionRef}
          aria-live="assertive"
          aria-atomic="true"
          aria-relevant="text"
          data-testid="aria-live-assertive"
        />
      </div>
    </AccessibilityContext.Provider>
  );
};
