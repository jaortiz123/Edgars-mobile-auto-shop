// Toast utility types and constants
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface ToastContextType {
  showToast: (toast: Omit<Toast, 'id'>) => void;
}
