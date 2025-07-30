/**
 * Notification service for appointment reminders and alerts
 */

// Types
export interface Notification {
  id: string;
  message: string;
  type: string;
  timestamp: string;
  read: boolean;
  metadata: Record<string, any>;
}

export interface AppointmentData {
  id: string;
  dateTime?: string;
  scheduled_at?: string;
  customer?: string;
  customer_name?: string;
  service?: string;
  [key: string]: any;
}

// In-memory notification store (in production, this would be managed by a state management system)
let notifications: Notification[] = [];
let notificationCounter = 0;

/**
 * Configuration for reminder lead times
 */
const REMINDER_CONFIGS = {
  DEFAULT_LEAD_TIME: 15, // minutes
  AVAILABLE_LEAD_TIMES: [5, 15, 30], // minutes
  STORAGE_KEY: 'appointment_reminder_settings'
};

/**
 * Notification types
 */
export const NOTIFICATION_TYPES = {
  STARTING_SOON: 'starting_soon',
  RUNNING_LATE: 'running_late',
  OVERDUE: 'overdue',
  ARRIVED: 'arrived'
} as const;

/**
 * Add a notification to the store
 * @param message - Notification message
 * @param type - Notification type
 * @param metadata - Additional data
 * @returns The created notification
 */
function addNotification(message: string, type: string = 'info', metadata: Record<string, any> = {}): Notification {
  const notification: Notification = {
    id: `notif_${notificationCounter++}`,
    message,
    type,
    timestamp: new Date().toISOString(),
    read: false,
    metadata
  };
  
  notifications.unshift(notification); // Add to beginning
  
  // Limit to last 50 notifications
  if (notifications.length > 50) {
    notifications = notifications.slice(0, 50);
  }
  
  // Trigger custom event for real-time updates
  window.dispatchEvent(new CustomEvent('notificationAdded', { detail: notification }));
  
  return notification;
}

/**
 * Get all notifications
 * @returns Array of notifications
 */
export function getNotifications(): Notification[] {
  return [...notifications];
}

/**
 * Mark a notification as read
 * @param id - Notification ID
 */
export function markNotificationAsRead(id: string): void {
  const notification = notifications.find(n => n.id === id);
  if (notification) {
    notification.read = true;
    window.dispatchEvent(new CustomEvent('notificationUpdated', { detail: notification }));
  }
}

/**
 * Clear all notifications
 */
export function clearAllNotifications(): void {
  notifications = [];
  window.dispatchEvent(new CustomEvent('notificationsCleared'));
}

/**
 * Schedule a reminder for an appointment
 * @param appointment - Appointment data
 * @param minutesBefore - Minutes before appointment to trigger reminder
 * @returns Timeout ID for canceling
 */
export function scheduleReminder(appointment: AppointmentData, minutesBefore?: number): number | null {
  const leadTime = minutesBefore || getReminderLeadTime();
  const appointmentTime = new Date(appointment.dateTime || appointment.scheduled_at || '');
  const reminderTime = new Date(appointmentTime.getTime() - (leadTime * 60 * 1000));
  const now = new Date();
  
  // Calculate delay until reminder should fire
  const delay = reminderTime.getTime() - now.getTime();
  
  if (delay <= 0) {
    // Reminder time has already passed
    return null;
  }
  
  // Schedule the reminder
  const timeoutId = setTimeout(() => {
    const message = `Appointment with ${appointment.customer || appointment.customer_name} starts in ${leadTime} minutes`;
    addNotification(message, NOTIFICATION_TYPES.STARTING_SOON, {
      appointmentId: appointment.id,
      customerName: appointment.customer || appointment.customer_name,
      service: appointment.service,
      leadTime
    });
    
    // Show toast notification if available
    showToast(message);
  }, delay);
  
  return timeoutId;
}

/**
 * Show a toast notification (requires toast library)
 * @param message - Message to display
 * @param type - Toast type (success, warning, error, info)
 */
function showToast(message: string, type: string = 'info'): void {
  // Try to use react-hot-toast if available
  if ((window as any).toast) {
    switch (type) {
      case 'success':
        (window as any).toast.success(message);
        break;
      case 'error':
        (window as any).toast.error(message);
        break;
      case 'warning':
        (window as any).toast(message, { icon: '⚠️' });
        break;
      default:
        (window as any).toast(message);
    }
  } else {
    // Fallback to browser notification or alert
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Edgar\'s Auto Shop', { body: message });
    } else {
      console.log('Toast notification:', message);
    }
  }
}

/**
 * Notify that an appointment is running late
 * @param appointmentId - Appointment ID
 * @param status - Late status ('running late' or 'overdue')
 * @param appointmentData - Additional appointment data
 */
export function notifyLate(appointmentId: string, status: string, appointmentData: Record<string, any> = {}): void {
  const customerName = appointmentData.customer || appointmentData.customer_name || 'Customer';
  let message: string;
  let type: string;
  
  if (status === 'running late') {
    message = `Appointment with ${customerName} is running late (10+ minutes past start time)`;
    type = NOTIFICATION_TYPES.RUNNING_LATE;
  } else if (status === 'overdue') {
    message = `Appointment with ${customerName} is overdue (30+ minutes past start time)`;
    type = NOTIFICATION_TYPES.OVERDUE;
  } else {
    return;
  }
  
  addNotification(message, type, {
    appointmentId,
    customerName,
    status,
    ...appointmentData
  });
  
  showToast(message, status === 'overdue' ? 'error' : 'warning');
}

/**
 * Notify that an appointment is overdue and needs escalation
 * @param appointmentId - Appointment ID
 * @param appointmentData - Additional appointment data
 */
export function notifyOverdue(appointmentId: string, appointmentData: Record<string, any> = {}): void {
  notifyLate(appointmentId, 'overdue', appointmentData);
}

/**
 * Notify that a customer has arrived
 * @param appointmentId - Appointment ID
 * @param appointmentData - Additional appointment data
 */
export function notifyArrival(appointmentId: string, appointmentData: Record<string, any> = {}): void {
  const customerName = appointmentData.customer || appointmentData.customer_name || 'Customer';
  const message = `${customerName} has checked in for their appointment`;
  
  addNotification(message, NOTIFICATION_TYPES.ARRIVED, {
    appointmentId,
    customerName,
    ...appointmentData
  });
  
  showToast(message, 'success');
}

/**
 * Get reminder lead time from user preferences
 * @returns Lead time in minutes
 */
export function getReminderLeadTime(): number {
  try {
    const settings = localStorage.getItem(REMINDER_CONFIGS.STORAGE_KEY);
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.leadTimeMinutes || REMINDER_CONFIGS.DEFAULT_LEAD_TIME;
    }
  } catch (error) {
    console.error('Error reading reminder settings:', error);
  }
  return REMINDER_CONFIGS.DEFAULT_LEAD_TIME;
}

/**
 * Set reminder lead time preference
 * @param minutes - Lead time in minutes
 */
export function setReminderLeadTime(minutes: number): void {
  if (!REMINDER_CONFIGS.AVAILABLE_LEAD_TIMES.includes(minutes)) {
    throw new Error(`Invalid lead time. Must be one of: ${REMINDER_CONFIGS.AVAILABLE_LEAD_TIMES.join(', ')}`);
  }
  
  try {
    const settings = {
      leadTimeMinutes: minutes,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(REMINDER_CONFIGS.STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving reminder settings:', error);
  }
}

/**
 * Get available lead time options
 * @returns Array of available lead times in minutes
 */
export function getAvailableLeadTimes(): number[] {
  return [...REMINDER_CONFIGS.AVAILABLE_LEAD_TIMES];
}

/**
 * Initialize notification system
 * Should be called on app startup
 */
export function initializeNotificationSystem(): void {
  // Request notification permission if not granted
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  
  // Set up global toast function for easier access
  if (!(window as any).toast && (window as any).react_hot_toast) {
    (window as any).toast = (window as any).react_hot_toast;
  }
  
  console.log('Notification system initialized');
}

// Export the internal addNotification for use by other components
export { addNotification };
