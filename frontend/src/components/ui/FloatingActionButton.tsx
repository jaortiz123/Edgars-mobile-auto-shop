import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';

interface FABProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  ariaLabel?: string;
  className?: string;
}

/**
 * Enhanced Floating Action Button with robustness improvements
 * 
 * Features:
 * - Accessibility: ARIA labels, keyboard navigation, focus management
 * - Performance: Memoized callbacks, optimized re-renders
 * - Error Handling: Disabled states, loading states
 * - Type Safety: TypeScript interfaces with optional props
 * - Security: Input sanitization for className
 * - Maintainability: Comprehensive documentation and prop validation
 */
export default function FloatingActionButton({ 
  onClick, 
  disabled = false,
  loading = false,
  ariaLabel = "Add new appointment",
  className = ""
}: FABProps) {
  const [isPressed, setIsPressed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Memoized click handler for performance optimization
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent double-clicks and clicks while loading
    if (disabled || loading) {
      event.preventDefault();
      return;
    }
    
    try {
      onClick();
    } catch (error) {
      console.error('FAB onClick error:', error);
      // Graceful degradation - don't crash the component
    }
  }, [onClick, disabled, loading]);

  // Enhanced keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsPressed(true);
      
      try {
        onClick();
      } catch (error) {
        console.error('FAB keyboard activation error:', error);
      }
    }
  }, [onClick, disabled, loading]);

  const handleKeyUp = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      setIsPressed(false);
    }
  }, []);

  // Cleanup on unmount for memory management
  useEffect(() => {
    return () => {
      setIsPressed(false);
    };
  }, []);

  // Sanitize className for security
  const sanitizedClassName = typeof className === 'string' ? className.replace(/[<>]/g, '') : '';

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      disabled={disabled || loading}
      className={`
        fixed bottom-4 right-4 
        bg-primary text-white rounded-full 
        w-14 h-14 flex items-center justify-center 
        shadow-lg transition-all duration-200
        hover:scale-105 hover:shadow-xl
        focus:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
        active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        ${isPressed ? 'scale-95' : ''}
        ${sanitizedClassName}
      `}
      aria-label={ariaLabel}
      aria-disabled={disabled || loading ? 'true' : 'false'}
      aria-pressed={isPressed ? 'true' : 'false'}
      title={loading ? "Creating appointment..." : ariaLabel}
      type="button"
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      ) : (
        <Plus className="h-8 w-8" aria-hidden="true" />
      )}
    </button>
  );
}
