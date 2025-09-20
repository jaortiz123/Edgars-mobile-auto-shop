import { useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';
import { SLO_TARGETS, metricsCollector } from './metricsCollector';
import { mapApiErrorToUserError, getSLOViolationMessage } from './errorMapping';
import { ApiError } from '../types/api';

// Hook to use the SLO-aware toast functionality
export function useSLOToast() {
  const toastContext = useContext(ToastContext);

  if (!toastContext) {
    throw new Error('useSLOToast must be used within a ToastProvider');
  }

  const { showToast } = toastContext;

  return {
    // Standard toast methods
    success: (title: string, message?: string, duration?: number) => {
      showToast({
        type: 'success',
        title,
        message,
        duration: duration || 3000
      });
    },

    info: (title: string, message?: string, duration?: number) => {
      showToast({
        type: 'info',
        title,
        message,
        duration: duration || 4000
      });
    },

    warning: (title: string, message?: string, duration?: number) => {
      showToast({
        type: 'warning',
        title,
        message,
        duration: duration || 6000
      });
    },

    error: (title: string, message?: string, duration?: number) => {
      showToast({
        type: 'error',
        title,
        message,
        duration: duration || 8000
      });
    },

    // API error with user-friendly mapping
    apiError: (error: ApiError, retryAction?: () => void) => {
      const userError = mapApiErrorToUserError(error);

      showToast({
        type: userError.severity as 'success' | 'error' | 'warning' | 'info',
        title: userError.title,
        message: userError.message,
        duration: userError.severity === 'error' ? 8000 : 6000
      });

      // TODO: In a more advanced system, we could add action buttons
      // For now, we rely on the retry logic in the calling components
    },

    // SLO violation warning
    sloViolation: (operationType: string, duration: number, target: number) => {
      const message = getSLOViolationMessage(operationType, duration, target);

      showToast({
        type: 'warning',
        title: 'Performance Notice',
        message,
        duration: 5000
      });
    },

    // Operation success with timing info
    operationSuccess: (operationType: string, duration?: number) => {
      let message = '';

      switch (operationType) {
        case 'board_load':
          message = duration ? `Board loaded in ${Math.round(duration)}ms` : 'Board loaded successfully';
          break;
        case 'stats_load':
          message = duration ? `Statistics loaded in ${Math.round(duration)}ms` : 'Statistics loaded successfully';
          break;
        case 'appointment_move':
          message = duration ? `Appointment updated in ${Math.round(duration)}ms` : 'Appointment updated successfully';
          break;
        default:
          message = 'Operation completed successfully';
      }

      showToast({
        type: 'success',
        title: 'Success',
        message,
        duration: 2500
      });
    },

    // Batch operation results
    batchResult: (successCount: number, errorCount: number, operationType: string) => {
      if (errorCount === 0) {
        showToast({
          type: 'success',
          title: 'All Operations Successful',
          message: `${successCount} ${operationType}s completed successfully`,
          duration: 4000
        });
      } else if (successCount === 0) {
        showToast({
          type: 'error',
          title: 'All Operations Failed',
          message: `${errorCount} ${operationType}s failed. Please try again.`,
          duration: 8000
        });
      } else {
        showToast({
          type: 'warning',
          title: 'Partial Success',
          message: `${successCount} ${operationType}s succeeded, ${errorCount} failed. Please review and retry.`,
          duration: 6000
        });
      }
    }
  };
}

// Enhanced metrics collection that automatically shows SLO violations
export function collectMetricWithToast(
  operationType: string,
  duration: number,
  success: boolean,
  sloTarget?: number
) {
  // Always collect the metric
  metricsCollector.collect({
    name: operationType,
    value: duration,
    sloTarget,
    isSuccess: success
  });

  // Show SLO violation toast if needed (only in components that use the hook)
  if (sloTarget && duration > sloTarget) {
    // This would need to be called from a component context
    // For now, we'll log it and let components handle SLO notifications
    console.warn(`SLO violation: ${operationType} took ${duration}ms (target: ${sloTarget}ms)`);
  }
}
