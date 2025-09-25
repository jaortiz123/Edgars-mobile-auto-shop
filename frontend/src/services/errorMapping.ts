import { ApiError, ConflictError } from '../types/api';

// User-friendly error messages mapped from API error codes
export const ERROR_MESSAGES: Record<string, string> = {
  // Network errors
  'network_error': 'Unable to connect to the server. Please check your internet connection and try again.',
  'timeout_error': 'The operation is taking longer than expected. Please try again.',

  // Authentication errors
  'auth_required': 'You need to log in to perform this action.',
  'auth_expired': 'Your session has expired. Please refresh the page and try again.',
  'permission_denied': 'You don\'t have permission to perform this action.',

  // Validation errors
  'validation_failed': 'The information provided is not valid. Please check your inputs.',
  'invalid_request': 'The request could not be processed. Please try again.',
  'invalid_date_range': 'The selected date range is not valid.',

  // Conflict errors
  'version_conflict': 'This appointment was updated by someone else. The page will refresh with the latest version.',
  'appointment_conflict': 'Another change was made to this appointment. Please try again.',

  // Server errors
  'internal_error': 'A server error occurred. Our team has been notified.',
  'service_unavailable': 'The service is temporarily unavailable. Please try again in a few minutes.',
  'rate_limited': 'Too many requests. Please wait a moment and try again.',

  // Resource errors
  'appointment_not_found': 'The appointment could not be found. It may have been deleted.',
  'customer_not_found': 'The customer information could not be found.',
  'invalid_status': 'The appointment status is not valid.',

  // Default fallback
  'unknown_error': 'An unexpected error occurred. Please try again or contact support if the problem persists.'
} as const;

export interface UserFriendlyError {
  title: string;
  message: string;
  action?: string;
  severity: 'info' | 'warning' | 'error';
  canRetry?: boolean;
  shouldRefresh?: boolean;
}

export function mapApiErrorToUserError(error: ApiError): UserFriendlyError {
  const errorCode = error.error || 'unknown_error';
  const message = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.unknown_error;

  // Handle conflict errors specially
  if (error.error === 'version_conflict' || error.error === 'appointment_conflict') {
    return {
      title: 'Conflict Detected',
      message,
      severity: 'warning',
      canRetry: true,
      shouldRefresh: true
    };
  }

  // Handle network errors
  if (error.error === 'network_error' || error.error === 'timeout_error') {
    return {
      title: 'Connection Issue',
      message,
      action: 'Retry',
      severity: 'warning',
      canRetry: true
    };
  }

  // Handle authentication errors
  if (error.error === 'auth_required' || error.error === 'auth_expired' || error.error === 'permission_denied') {
    return {
      title: 'Authentication Required',
      message,
      action: error.error === 'auth_expired' ? 'Refresh Page' : 'Log In',
      severity: 'warning',
      shouldRefresh: error.error === 'auth_expired'
    };
  }

  // Handle validation errors
  if (error.error === 'validation_failed' || error.error === 'invalid_request') {
    return {
      title: 'Invalid Input',
      message,
      severity: 'error',
      canRetry: false
    };
  }

  // Handle server errors
  if (error.error === 'internal_error' || error.error === 'service_unavailable') {
    return {
      title: 'Server Issue',
      message,
      action: 'Retry Later',
      severity: 'error',
      canRetry: error.error === 'service_unavailable'
    };
  }

  // Handle rate limiting
  if (error.error === 'rate_limited') {
    return {
      title: 'Too Many Requests',
      message,
      severity: 'warning',
      canRetry: true
    };
  }

  // Handle resource not found
  if (error.error === 'appointment_not_found' || error.error === 'customer_not_found') {
    return {
      title: 'Not Found',
      message,
      severity: 'error',
      canRetry: false,
      shouldRefresh: true
    };
  }

  // Default case
  return {
    title: 'Error',
    message,
    action: 'Retry',
    severity: 'error',
    canRetry: true
  };
}

// Extract SLO violation information for user feedback
export function getSLOViolationMessage(operationType: string, duration: number, target: number): string {
  const violationPercent = Math.round(((duration - target) / target) * 100);

  switch (operationType) {
    case 'board_load_time':
      return `Board loading is slower than usual (${Math.round(duration)}ms vs ${target}ms target). This might be due to high server load.`;

    case 'stats_load_time':
      return `Statistics loading is slower than usual (${Math.round(duration)}ms vs ${target}ms target). This might be due to network issues.`;

    case 'move_operation_time':
      return `Appointment updates are taking longer than usual (${Math.round(duration)}ms vs ${target}ms target). Please be patient.`;

    default:
      return `Performance is slower than usual (+${violationPercent}% above target). Our team is working to improve this.`;
  }
}

// Check if error indicates a temporary issue that should show a retry option
export function isTemporaryError(error: ApiError): boolean {
  const temporaryErrors = [
    'network_error',
    'timeout_error',
    'service_unavailable',
    'rate_limited',
    'internal_error'
  ];

  return temporaryErrors.includes(error.error || '');
}

// Check if error indicates the UI should refresh to get latest state
export function shouldRefreshAfterError(error: ApiError): boolean {
  const refreshErrors = [
    'version_conflict',
    'appointment_conflict',
    'appointment_not_found',
    'auth_expired'
  ];

  return refreshErrors.includes(error.error || '');
}
