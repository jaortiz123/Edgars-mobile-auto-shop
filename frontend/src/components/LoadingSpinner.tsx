import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  ariaLabel?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className = '',
  ariaLabel = 'Loading'
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8'
  };

  return (
    <div 
      className={`${sizeClasses[size]} ${className}`}
      role="status"
      aria-label={ariaLabel}
    >
      <div className="animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
};

interface LoadingButtonProps {
  loading: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  loadingText?: string;
  ariaLabel?: string;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading,
  disabled = false,
  children,
  className = '',
  type = 'button',
  onClick,
  loadingText,
  ariaLabel
}) => {
  const isDisabled = loading || disabled;
  
  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={`
        relative flex items-center justify-center transition-opacity duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        ${className}
      `}
      aria-label={ariaLabel}
      aria-busy={loading ? "true" : "false"}
    >
      {loading && (
        <LoadingSpinner 
          size="sm" 
          className="mr-2" 
          ariaLabel={loadingText || 'Processing'} 
        />
      )}
      <span className={loading ? 'opacity-75' : ''}>
        {loading && loadingText ? loadingText : children}
      </span>
    </button>
  );
};

// Enhanced loading overlay component
interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  className?: string;
  children?: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message = 'Loading...',
  className = '',
  children
}) => {
  if (!isLoading && !children) return null;

  return (
    <div className={`relative ${className}`}>
      {children}
      {isLoading && (
        <div 
          className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10"
          role="status"
          aria-live="polite"
          aria-label={message}
        >
          <div className="flex flex-col items-center space-y-2">
            <LoadingSpinner size="lg" ariaLabel={message} />
            <span className="text-sm text-gray-600">{message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;