/**
 * Enterprise Error Boundary for Sprint 3C Appointment Reminders
 * Provides comprehensive error handling with recovery mechanisms
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';
import * as Sentry from '@sentry/browser';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableRetry?: boolean;
  maxRetries?: number;
  component?: string;
}

/**
 * Enhanced Error Boundary with automatic recovery and detailed logging
 */
export class AppointmentReminderErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Enhanced error logging
    console.error('🚨 Sprint 3C Error Boundary caught an error:', error, errorInfo);

    // Update state with error info
    this.setState({ errorInfo });

    // Send to error tracking service (if available)
    try {
      if (typeof Sentry !== 'undefined') {
        Sentry.withScope((scope) => {
          scope.setTag('component', this.props.component || 'AppointmentReminder');
          scope.setTag('sprint', '3C');
          scope.setContext('errorInfo', { componentStack: errorInfo.componentStack });
          scope.setLevel('error');
          Sentry.captureException(error);
        });
      }
    } catch (sentryError) {
      console.warn('Failed to send error to Sentry:', sentryError);
    }

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Auto-retry mechanism
    if (this.props.enableRetry && this.state.retryCount < (this.props.maxRetries || 3)) {
      this.scheduleRetry();
    }

    // Analytics tracking
    this.trackError(error, errorInfo);
  }

  private scheduleRetry = () => {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    const retryDelay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000); // Exponential backoff, max 10s

    this.retryTimer = setTimeout(() => {
      console.log(`🔄 Attempting retry ${this.state.retryCount + 1} for Sprint 3C component`);
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));
    }, retryDelay);
  };

  private trackError = (error: Error, errorInfo: ErrorInfo) => {
    try {
      // Analytics tracking
      const errorData = {
        component: this.props.component || 'AppointmentReminder',
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        retryCount: this.state.retryCount
      };

      // Store error data for debugging
      const errors = JSON.parse(localStorage.getItem('sprint3c_errors') || '[]');
      errors.push(errorData);

      // Keep only last 50 errors
      if (errors.length > 50) {
        errors.splice(0, errors.length - 50);
      }

      localStorage.setItem('sprint3c_errors', JSON.stringify(errors));
    } catch (trackingError) {
      console.warn('Failed to track error:', trackingError);
    }
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: this.state.retryCount + 1
    });
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    });
  };

  componentWillUnmount() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI with recovery options
      return (
        <div className="sprint3c-error-boundary bg-red-50 border border-red-200 rounded-lg p-4 m-2">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-red-800">
                Appointment Reminder Error
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  Something went wrong with the appointment reminder system.
                  {this.state.retryCount > 0 && ` (Attempt ${this.state.retryCount + 1})`}
                </p>
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium">Technical Details</summary>
                    <div className="mt-2 p-2 bg-red-100 rounded text-xs">
                      <div><strong>Error:</strong> {this.state.error.message}</div>
                      <div><strong>ID:</strong> {this.state.errorId}</div>
                      {this.state.error.stack && (
                        <div className="mt-1">
                          <strong>Stack:</strong>
                          <pre className="whitespace-pre-wrap text-xs">{this.state.error.stack}</pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
              <div className="mt-4 flex space-x-3">
                {this.props.enableRetry && this.state.retryCount < (this.props.maxRetries || 3) && (
                  <button
                    type="button"
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    onClick={this.handleRetry}
                  >
                    🔄 Try Again
                  </button>
                )}
                <button
                  type="button"
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  onClick={this.handleReset}
                >
                  🔄 Reset
                </button>
                <button
                  type="button"
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={() => window.location.reload()}
                >
                  🔄 Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component for automatic error boundary wrapping
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    enableRetry?: boolean;
    componentName?: string;
  }
) {
  const WrappedComponent = (props: P) => (
    <AppointmentReminderErrorBoundary
      fallback={options?.fallback}
      onError={options?.onError}
      enableRetry={options?.enableRetry}
      component={options?.componentName || Component.displayName || Component.name}
    >
      <Component {...props} />
    </AppointmentReminderErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

/**
 * Hook for error boundary integration
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const captureError = React.useCallback((error: Error, context?: string) => {
    console.error(`🚨 Sprint 3C Error${context ? ` in ${context}` : ''}:`, error);

    // Track error for analytics
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString()
      };

      const errors = JSON.parse(localStorage.getItem('sprint3c_hook_errors') || '[]');
      errors.push(errorData);

      if (errors.length > 25) {
        errors.splice(0, errors.length - 25);
      }

      localStorage.setItem('sprint3c_hook_errors', JSON.stringify(errors));
    } catch (trackingError) {
      console.warn('Failed to track hook error:', trackingError);
    }

    setError(error);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  // Throw error to trigger error boundary
  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, clearError, error };
}

/**
 * Error boundary specifically for appointment cards
 */
export function AppointmentCardErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <AppointmentReminderErrorBoundary
      enableRetry={true}
      maxRetries={2}
      component="AppointmentCard"
      fallback={
        <div className="card-base p-4 bg-yellow-50 border-yellow-200">
          <div className="text-yellow-700 text-sm flex items-center space-x-2">
            <span>⚠️</span>
            <span>Unable to load appointment card. Please refresh the page.</span>
          </div>
        </div>
      }
    >
      {children}
    </AppointmentReminderErrorBoundary>
  );
}

/**
 * Error boundary for notification components
 */
export function NotificationErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <AppointmentReminderErrorBoundary
      enableRetry={true}
      maxRetries={3}
      component="NotificationSystem"
      fallback={
        <div className="notification-error p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          Notification system temporarily unavailable
        </div>
      }
    >
      {children}
    </AppointmentReminderErrorBoundary>
  );
}
