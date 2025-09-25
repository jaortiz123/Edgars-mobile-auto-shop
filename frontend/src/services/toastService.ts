import { SLO_TARGETS, metricsCollector } from './metricsCollector';
import { mapApiErrorToUserError, getSLOViolationMessage, UserFriendlyError } from './errorMapping';
import { ApiError } from '../types/api';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  canDismiss?: boolean;
}

// In a real app, this would integrate with a toast library like react-hot-toast or similar
class ToastService {
  private toasts: ToastMessage[] = [];
  private listeners: Array<(toasts: ToastMessage[]) => void> = [];

  // Add a toast message
  private addToast(toast: Omit<ToastMessage, 'id'>): string {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullToast: ToastMessage = {
      ...toast,
      id,
      canDismiss: toast.canDismiss ?? true,
      duration: toast.duration ?? (toast.type === 'error' ? 8000 : 4000)
    };

    this.toasts.push(fullToast);
    this.notifyListeners();

    // Auto-dismiss after duration
    if (fullToast.duration && fullToast.duration > 0) {
      setTimeout(() => {
        this.removeToast(id);
      }, fullToast.duration);
    }

    return id;
  }

  // Remove a toast
  removeToast(id: string): void {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.notifyListeners();
  }

  // Clear all toasts
  clearAll(): void {
    this.toasts = [];
    this.notifyListeners();
  }

  // Subscribe to toast changes
  subscribe(listener: (toasts: ToastMessage[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Get current toasts
  getToasts(): ToastMessage[] {
    return [...this.toasts];
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.getToasts()));
  }

  // ===== PUBLIC API =====

  // Show success message
  success(title: string, message?: string): string {
    return this.addToast({
      title,
      message: message || '',
      type: 'success',
      duration: 3000
    });
  }

  // Show info message
  info(title: string, message?: string): string {
    return this.addToast({
      title,
      message: message || '',
      type: 'info',
      duration: 4000
    });
  }

  // Show warning message
  warning(title: string, message?: string): string {
    return this.addToast({
      title,
      message: message || '',
      type: 'warning',
      duration: 6000
    });
  }

  // Show error message with optional retry action
  error(title: string, message?: string, retryAction?: () => void): string {
    return this.addToast({
      title,
      message: message || '',
      type: 'error',
      duration: 8000,
      action: retryAction ? {
        label: 'Retry',
        onClick: retryAction
      } : undefined
    });
  }

  // Show API error with user-friendly mapping
  apiError(error: ApiError, retryAction?: () => void): string {
    const userError = mapApiErrorToUserError(error);

    return this.addToast({
      title: userError.title,
      message: userError.message,
      type: userError.severity,
      duration: userError.severity === 'error' ? 8000 : 6000,
      action: (retryAction && userError.canRetry) ? {
        label: userError.action || 'Retry',
        onClick: retryAction
      } : undefined
    });
  }

  // Show SLO violation warning
  sloViolation(operationType: string, duration: number, target: number): string {
    const message = getSLOViolationMessage(operationType, duration, target);

    return this.addToast({
      title: 'Performance Notice',
      message,
      type: 'warning',
      duration: 5000
    });
  }

  // Show operation success with timing info
  operationSuccess(operationType: string, duration?: number): string {
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

    return this.addToast({
      title: 'Success',
      message,
      type: 'success',
      duration: 2500
    });
  }

  // Show batch operation results
  batchResult(successCount: number, errorCount: number, operationType: string): string {
    if (errorCount === 0) {
      return this.success(
        'All Operations Successful',
        `${successCount} ${operationType}s completed successfully`
      );
    } else if (successCount === 0) {
      return this.error(
        'All Operations Failed',
        `${errorCount} ${operationType}s failed. Please try again.`
      );
    } else {
      return this.warning(
        'Partial Success',
        `${successCount} ${operationType}s succeeded, ${errorCount} failed. Please review and retry.`
      );
    }
  }

  // Show loading state with optional progress
  loading(title: string, message?: string, progress?: number): string {
    const progressText = progress !== undefined ? ` (${Math.round(progress)}%)` : '';

    return this.addToast({
      title,
      message: (message || '') + progressText,
      type: 'info',
      duration: 0, // Don't auto-dismiss loading toasts
      canDismiss: false
    });
  }
}

// Singleton instance
export const toast = new ToastService();

// Hook for React components to use the toast service
export function useToasts() {
  const [toasts, setToasts] = React.useState<ToastMessage[]>(toast.getToasts());

  React.useEffect(() => {
    const unsubscribe = toast.subscribe(setToasts);
    return unsubscribe;
  }, []);

  return {
    toasts,
    toast: {
      success: toast.success.bind(toast),
      info: toast.info.bind(toast),
      warning: toast.warning.bind(toast),
      error: toast.error.bind(toast),
      apiError: toast.apiError.bind(toast),
      sloViolation: toast.sloViolation.bind(toast),
      operationSuccess: toast.operationSuccess.bind(toast),
      batchResult: toast.batchResult.bind(toast),
      loading: toast.loading.bind(toast),
      remove: toast.removeToast.bind(toast),
      clearAll: toast.clearAll.bind(toast)
    }
  };
}

// Import React for the hook
import React from 'react';
