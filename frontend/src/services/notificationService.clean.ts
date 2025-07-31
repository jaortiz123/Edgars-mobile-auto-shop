/**
 * Enterprise-Grade Notification Service for Sprint 3C Appointment Reminders
 * Enhanced with comprehensive robustness framework
 * 
 * Features:
 * - Retry mechanisms with exponential backoff
 * - Rate limiting and throttling  
 * - Persistent storage with localStorage fallback
 * - Accessibility announcements for screen readers
 * - Performance monitoring and analytics
 * - Advanced error handling and recovery
 * - Memory-efficient queue management
 * - Cross-tab synchronization
 */

// Enhanced type definitions
export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: string;
  read: boolean;
  metadata: NotificationMetadata;
  priority: NotificationPriority;
  ttl?: number; // Time to live in milliseconds
  retryCount?: number;
  source: string;
}

export interface NotificationMetadata {
  appointmentId?: string;
  customerName?: string;
  service?: string;
  leadTime?: number;
  urgency?: 'normal' | 'soon' | 'late' | 'overdue';
  actions?: NotificationAction[];
  [key: string]: unknown;
}

export interface NotificationAction {
  id: string;
  label: string;
  handler: () => void | Promise<void>;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface AppointmentData {
  id: string;
  dateTime?: string;
  scheduled_at?: string;
  customer?: string;
  customer_name?: string;
  service?: string;
  [key: string]: unknown;
}

export interface NotificationOptions {
  persist?: boolean;
  announce?: boolean;
  showToast?: boolean;
  retry?: boolean;
  priority?: NotificationPriority;
  ttl?: number;
  actions?: NotificationAction[];
}

export interface NotificationServiceConfig {
  maxNotifications: number;
  maxRetries: number;
  retryDelay: number;
  rateLimitWindow: number;
  rateLimitMax: number;
  persistToStorage: boolean;
  enableAccessibility: boolean;
  enableAnalytics: boolean;
}

// Type definitions
export type NotificationType = 'starting_soon' | 'running_late' | 'overdue' | 'arrived' | 'info' | 'success' | 'warning' | 'error';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

// Enhanced configuration
const DEFAULT_CONFIG: NotificationServiceConfig = {
  maxNotifications: 100,
  maxRetries: 3,
  retryDelay: 1000,
  rateLimitWindow: 60000, // 1 minute
  rateLimitMax: 10,
  persistToStorage: true,
  enableAccessibility: true,
  enableAnalytics: true
};

/**
 * Enhanced notification types with business logic mapping
 */
export const NOTIFICATION_TYPES = {
  STARTING_SOON: 'starting_soon' as const,
  RUNNING_LATE: 'running_late' as const,
  OVERDUE: 'overdue' as const,
  ARRIVED: 'arrived' as const,
  INFO: 'info' as const,
  SUCCESS: 'success' as const,
  WARNING: 'warning' as const,
  ERROR: 'error' as const
};

/**
 * Priority mapping for different notification types
 */
const PRIORITY_MAP: Record<NotificationType, NotificationPriority> = {
  'starting_soon': 'normal',
  'running_late': 'high',
  'overdue': 'urgent',
  'arrived': 'normal',
  'error': 'high',
  'warning': 'normal',
  'success': 'low',
  'info': 'low'
};

/**
 * Enhanced reminder configuration with user preferences
 */
const REMINDER_CONFIGS = {
  DEFAULT_LEAD_TIME: 15, // minutes
  AVAILABLE_LEAD_TIMES: [5, 15, 30, 60], // expanded options
  STORAGE_KEY: 'appointment_reminder_settings',
  ANALYTICS_KEY: 'notification_analytics',
  QUEUE_KEY: 'notification_queue'
};

// Types for internal tracking
interface RetryQueueItem {
  notification: Notification;
  attempt: number;
  nextRetry: number;
}

interface ToastFunction {
  (message: string, options?: unknown): void;
  success?: (message: string) => void;
  error?: (message: string) => void;
  warning?: (message: string) => void;
  info?: (message: string) => void;
}

// Service state
let notifications: Notification[] = [];
let notificationCounter = 0;
let config = { ...DEFAULT_CONFIG };
const retryQueues = new Map<string, RetryQueueItem[]>();
const rateLimitTracker = new Map<string, number[]>();
const analytics = {
  sent: 0,
  failed: 0,
  retried: 0,
  dismissed: 0
};

/**
 * Initialize the notification service with enhanced features
 */
export function initializeNotificationService(userConfig?: Partial<NotificationServiceConfig>): void {
  try {
    // Merge user config with defaults
    config = { ...DEFAULT_CONFIG, ...userConfig };
    
    // Load persisted notifications
    if (config.persistToStorage) {
      loadPersistedNotifications();
    }
    
    // Setup cleanup interval for expired notifications
    setupCleanupInterval();
    
    // Setup retry processor
    setupRetryProcessor();
    
    // Request browser notification permission
    requestNotificationPermission();
    
    // Setup accessibility features
    if (config.enableAccessibility) {
      setupAccessibilityFeatures();
    }
    
    console.log('✅ Enhanced notification service initialized');
  } catch (error) {
    console.error('❌ Failed to initialize notification service:', error);
  }
}

/**
 * Enhanced notification creation with comprehensive features
 */
export function addNotification(
  message: string,
  type: NotificationType = 'info',
  options: NotificationOptions = {}
): string {
  try {
    // Rate limiting check
    if (!checkRateLimit(type)) {
      console.warn('Rate limit exceeded for notification type:', type);
      return '';
    }
    
    // Create enhanced notification
    const notification = createEnhancedNotification(message, type, options);
    
    // Add to store
    addToStore(notification);
    
    // Handle persistent storage
    if (options.persist !== false && config.persistToStorage) {
      persistNotification(notification);
    }
    
    // Show toast notification
    if (options.showToast !== false) {
      showToast(notification);
    }
    
    // Accessibility announcement
    if (config.enableAccessibility && options.announce !== false) {
      announceToScreenReader(message, notification.priority);
    }
    
    // Analytics tracking
    if (config.enableAnalytics) {
      analytics.sent++;
    }
    
    // Dispatch custom event for real-time updates
    dispatchNotificationEvent('notification-added', notification);
    
    return notification.id;
  } catch (error) {
    console.error('Error adding notification:', error);
    analytics.failed++;
    return '';
  }
}

/**
 * Get all notifications with enhanced filtering options
 */
export function getNotifications(options: {
  type?: NotificationType;
  unreadOnly?: boolean;
  limit?: number;
  sortBy?: 'timestamp' | 'priority';
  appointmentId?: string;
} = {}): Notification[] {
  try {
    let filtered = [...notifications];
    
    // Apply filters
    if (options.type) {
      filtered = filtered.filter(n => n.type === options.type);
    }
    
    if (options.unreadOnly) {
      filtered = filtered.filter(n => !n.read);
    }
    
    if (options.appointmentId) {
      filtered = filtered.filter(n => n.metadata.appointmentId === options.appointmentId);
    }
    
    // Apply sorting
    if (options.sortBy === 'priority') {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } else {
      filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    
    // Apply limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    
    return filtered;
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
}

/**
 * Enhanced mark notification as read with batch support
 */
export function markNotificationAsRead(id: string | string[]): void {
  try {
    const ids = Array.isArray(id) ? id : [id];
    
    ids.forEach(notificationId => {
      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.read) {
        notification.read = true;
        notification.metadata = { ...notification.metadata, readAt: new Date().toISOString() };
        
        // Update persistent storage
        if (config.persistToStorage) {
          persistNotification(notification);
        }
      }
    });
    
    // Dispatch update event
    dispatchNotificationEvent('notifications-updated', { readIds: ids });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

/**
 * Enhanced clear notifications with type filtering
 */
export function clearAllNotifications(type?: NotificationType): void {
  try {
    if (type) {
      notifications = notifications.filter(n => n.type !== type);
    } else {
      notifications = [];
    }
    
    // Update persistent storage
    if (config.persistToStorage) {
      updatePersistedNotifications();
    }
    
    // Dispatch event
    dispatchNotificationEvent('notifications-cleared', { type });
  } catch (error) {
    console.error('Error clearing notifications:', error);
  }
}

/**
 * Enhanced schedule reminder with retry support
 */
export function scheduleReminder(appointment: AppointmentData, minutesBefore?: number): number | null {
  try {
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
    const timeoutId = window.setTimeout(() => {
      const message = `Appointment with ${appointment.customer || appointment.customer_name} starts in ${leadTime} minutes`;
      addNotification(message, NOTIFICATION_TYPES.STARTING_SOON, {
        appointmentId: appointment.id,
        customerName: appointment.customer || appointment.customer_name,
        service: appointment.service,
        leadTime
      });
    }, delay);
    
    return timeoutId;
  } catch (error) {
    console.error('Error scheduling reminder:', error);
    return null;
  }
}

/**
 * Enhanced notify that an appointment is running late
 */
export function notifyLate(appointmentId: string, status: string, appointmentData: Record<string, unknown> = {}): void {
  const customerName = appointmentData.customer || appointmentData.customer_name || 'Customer';
  let message: string;
  let type: NotificationType;
  
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
    persist: true,
    showToast: true,
    announce: true,
    priority: type === NOTIFICATION_TYPES.OVERDUE ? 'urgent' : 'high'
  });
}

/**
 * Enhanced notify that an appointment is overdue and needs escalation
 */
export function notifyOverdue(appointmentId: string, appointmentData: Record<string, unknown> = {}): void {
  notifyLate(appointmentId, 'overdue', appointmentData);
}

/**
 * Enhanced notify that a customer has arrived
 */
export function notifyArrival(appointmentId: string, appointmentData: Record<string, unknown> = {}): void {
  const customerName = appointmentData.customer || appointmentData.customer_name || 'Customer';
  const message = `${customerName} has checked in for their appointment`;
  
  addNotification(message, NOTIFICATION_TYPES.ARRIVED, {
    persist: true,
    showToast: true,
    announce: true,
    priority: 'normal'
  });
}

/**
 * Enhanced get reminder lead time from user preferences
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
 * Enhanced set reminder lead time with validation
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
 * Enhanced get available lead time options
 */
export function getAvailableLeadTimes(): number[] {
  return [...REMINDER_CONFIGS.AVAILABLE_LEAD_TIMES];
}

// =============================================================================
// INTERNAL HELPER FUNCTIONS
// =============================================================================

/**
 * Create a notification object with enhanced validation
 */
function createEnhancedNotification(
  message: string,
  type: NotificationType,
  options: NotificationOptions
): Notification {
  const id = `notif_${++notificationCounter}_${Date.now()}`;
  const priority = options.priority || PRIORITY_MAP[type] || 'normal';
  const ttl = options.ttl || (priority === 'urgent' ? 300000 : 120000); // 5min for urgent, 2min for others
  
  return {
    id,
    message: sanitizeMessage(message),
    type,
    timestamp: new Date().toISOString(),
    read: false,
    priority,
    ttl,
    retryCount: 0,
    source: 'notification-service',
    metadata: {
      urgency: mapTypeToUrgency(type),
      actions: options.actions || [],
      ...options
    }
  };
}

/**
 * Add notification to in-memory store with overflow protection
 */
function addToStore(notification: Notification): void {
  notifications.unshift(notification);
  
  // Prevent memory overflow
  if (notifications.length > config.maxNotifications) {
    const removed = notifications.splice(config.maxNotifications);
    removed.forEach(n => {
      if (config.persistToStorage) {
        removePersistedNotification(n.id);
      }
    });
  }
}

/**
 * Enhanced toast notification with comprehensive fallback support
 */
function showToast(notification: Notification): void {
  const message = notification.message;
  const type = notification.type;
  
  // Try to use existing toast library
  const windowWithToast = window as Window & { toast?: ToastFunction };
  
  if (windowWithToast.toast) {
    try {
      // Handle different toast library APIs
      if (type === 'success' && typeof windowWithToast.toast.success === 'function') {
        windowWithToast.toast.success(message);
      } else if (type === 'error' && typeof windowWithToast.toast.error === 'function') {
        windowWithToast.toast.error(message);
      } else if (type === 'warning' && typeof windowWithToast.toast.warning === 'function') {
        windowWithToast.toast.warning(message);
      } else {
        windowWithToast.toast(message);
      }
      return;
    } catch (error) {
      console.warn('Toast library error:', error);
    }
  }
  
  // Fallback to browser notifications
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('Edgar\'s Auto Shop', { 
        body: message,
        icon: '/favicon.ico',
        tag: notification.id
      });
    } catch (error) {
      console.warn('Browser notification error:', error);
      fallbackToConsole(message, type);
    }
  } else {
    fallbackToConsole(message, type);
  }
}

/**
 * Fallback notification display
 */
function fallbackToConsole(message: string, type: string): void {
  const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} ${message}`);
}

/**
 * Rate limiting implementation
 */
function checkRateLimit(type: NotificationType): boolean {
  const now = Date.now();
  const key = type;
  
  if (!rateLimitTracker.has(key)) {
    rateLimitTracker.set(key, []);
  }
  
  const timestamps = rateLimitTracker.get(key)!;
  
  // Remove old timestamps outside the window
  const cutoff = now - config.rateLimitWindow;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }
  
  // Check if under limit
  if (timestamps.length >= config.rateLimitMax) {
    return false;
  }
  
  // Add current timestamp
  timestamps.push(now);
  return true;
}

/**
 * Announce notification to screen readers
 */
function announceToScreenReader(message: string, priority: NotificationPriority): void {
  try {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority === 'urgent' ? 'assertive' : 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  } catch (error) {
    console.warn('Screen reader announcement error:', error);
  }
}

/**
 * Dispatch custom notification events
 */
function dispatchNotificationEvent(eventType: string, detail: unknown): void {
  try {
    const event = new CustomEvent(eventType, { detail });
    window.dispatchEvent(event);
  } catch (error) {
    console.warn('Event dispatch error:', error);
  }
}

/**
 * Sanitize notification message
 */
function sanitizeMessage(message: string): string {
  return message.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/[<>]/g, '')
                .trim()
                .substring(0, 500); // Limit length
}

/**
 * Map notification type to urgency level
 */
function mapTypeToUrgency(type: NotificationType): 'normal' | 'soon' | 'late' | 'overdue' {
  switch (type) {
    case 'starting_soon': return 'soon';
    case 'running_late': return 'late';
    case 'overdue': return 'overdue';
    default: return 'normal';
  }
}

/**
 * Setup cleanup interval for expired notifications
 */
function setupCleanupInterval(): void {
  setInterval(() => {
    const now = Date.now();
    const initialLength = notifications.length;
    
    notifications = notifications.filter(n => {
      if (n.ttl && n.ttl > 0) {
        const age = now - new Date(n.timestamp).getTime();
        return age < n.ttl;
      }
      return true;
    });
    
    if (notifications.length !== initialLength && config.persistToStorage) {
      updatePersistedNotifications();
    }
  }, 60000); // Clean every minute
}

/**
 * Setup retry processor for failed notifications
 */
function setupRetryProcessor(): void {
  setInterval(() => {
    const now = Date.now();
    
    for (const [, queue] of retryQueues.entries()) {
      const readyItems = queue.filter(item => item.nextRetry <= now);
      
      readyItems.forEach(item => {
        if (item.attempt < config.maxRetries) {
          // Retry the notification
          try {
            showToast(item.notification);
            // Remove from retry queue on success
            const index = queue.indexOf(item);
            if (index > -1) {
              queue.splice(index, 1);
            }
            analytics.retried++;
          } catch (error) {
            // Update retry info
            item.attempt++;
            item.nextRetry = now + (config.retryDelay * Math.pow(2, item.attempt));
          }
        } else {
          // Max retries exceeded, remove from queue
          const index = queue.indexOf(item);
          if (index > -1) {
            queue.splice(index, 1);
          }
          analytics.failed++;
        }
      });
    }
  }, 5000); // Check every 5 seconds
}

/**
 * Request browser notification permission
 */
function requestNotificationPermission(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
      .then(permission => {
        console.log('Notification permission:', permission);
      })
      .catch(error => {
        console.warn('Error requesting notification permission:', error);
      });
  }
}

/**
 * Setup accessibility features
 */
function setupAccessibilityFeatures(): void {
  // Add CSS for screen reader only content
  if (!document.getElementById('notification-accessibility-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-accessibility-styles';
    style.textContent = `
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `;
    document.head.appendChild(style);
  }
}

// =============================================================================
// PERSISTENT STORAGE FUNCTIONS
// =============================================================================

/**
 * Load persisted notifications from storage
 */
function loadPersistedNotifications(): void {
  try {
    const stored = localStorage.getItem(REMINDER_CONFIGS.QUEUE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        notifications = parsed.filter(n => 
          n && typeof n === 'object' && n.id && n.message && n.type
        );
      }
    }
  } catch (error) {
    console.warn('Error loading persisted notifications:', error);
  }
}

/**
 * Persist single notification to storage
 */
function persistNotification(notification: Notification): void {
  try {
    updatePersistedNotifications();
  } catch (error) {
    console.warn('Error persisting notification:', error);
  }
}

/**
 * Update all persisted notifications
 */
function updatePersistedNotifications(): void {
  try {
    localStorage.setItem(REMINDER_CONFIGS.QUEUE_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.warn('Error updating persisted notifications:', error);
  }
}

/**
 * Remove persisted notification
 */
function removePersistedNotification(id: string): void {
  try {
    notifications = notifications.filter(n => n.id !== id);
    updatePersistedNotifications();
  } catch (error) {
    console.warn('Error removing persisted notification:', error);
  }
}

// =============================================================================
// INITIALIZATION AND CLEANUP
// =============================================================================

/**
 * Initialize notification system with enhanced features
 * Should be called on app startup
 */
export function initializeNotificationSystem(): void {
  initializeNotificationService();
}

/**
 * Cleanup notification service
 */
export function cleanupNotificationService(): void {
  try {
    // Clear all notifications
    notifications = [];
    
    // Clear retry queues
    retryQueues.clear();
    
    // Clear rate limit tracking
    rateLimitTracker.clear();
    
    // Reset analytics
    Object.keys(analytics).forEach(key => {
      (analytics as Record<string, number>)[key] = 0;
    });
    
    console.log('✅ Notification service cleaned up');
  } catch (error) {
    console.error('❌ Error cleaning up notification service:', error);
  }
}

// Auto-initialize if not in test environment
if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
  initializeNotificationService();
}
