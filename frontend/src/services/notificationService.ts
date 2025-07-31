/**
 * Sprint 3C: Enterprise-Grade Notification Service
 * Enhanced with comprehensive robustness features
 */

// Types
export interface Notification {
  id: string;
  type: 'reminder' | 'late' | 'overdue' | 'arrival' | 'error' | 'success' | 'warning' | 'info';
  appointmentId?: string;
  customerName?: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  expiresAt?: Date;
  retryCount?: number;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationConfig {
  maxNotifications: number;
  retentionPeriod: number;
  rateLimitPerType: number;
  enablePersistence: boolean;
  enableAnalytics: boolean;
  accessibilityEnabled: boolean;
}

export interface NotificationStats {
  total: number;
  byType: Record<string, number>;
  deliveryRate: number;
  errorRate: number;
  avgResponseTime: number;
}

// Global state
let notifications: Notification[] = [];
let observers: Array<(notifications: Notification[]) => void> = [];
const rateLimitMap = new Map<string, Date[]>();
let analyticsData: Array<{ type: string; notificationType: string; timestamp: Date; metadata: Record<string, unknown> }> = [];

// Configuration with enterprise defaults
const defaultConfig: NotificationConfig = {
  maxNotifications: 100,
  retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
  rateLimitPerType: 10, // 10 per minute per type
  enablePersistence: true,
  enableAnalytics: true,
  accessibilityEnabled: true
};

let config = { ...defaultConfig };

// Performance monitoring integration
const performanceService = {
  startMeasurement: (name: string) => {
    const start = performance.now();
    return () => {
      const end = performance.now();
      console.debug(`[Performance] ${name}: ${end - start}ms`);
    };
  }
};

// =============================================================================
// Core Notification Management
// =============================================================================

/**
 * Sanitize input to prevent XSS attacks
 */
function sanitizeInput(input: string): string {
  return input
    .replace(/[<>"'&]/g, (match) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entities[match] || match;
    });
}

/**
 * Check rate limiting for notification type
 */
function checkRateLimit(type: string): boolean {
  const now = new Date();
  const key = type;
  
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, []);
  }
  
  const timestamps = rateLimitMap.get(key)!;
  
  // Remove timestamps older than 1 minute
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const recentTimestamps = timestamps.filter(ts => ts > oneMinuteAgo);
  
  if (recentTimestamps.length >= config.rateLimitPerType) {
    console.warn(`Rate limit exceeded for notification type: ${type}`);
    return false;
  }
  
  recentTimestamps.push(now);
  rateLimitMap.set(key, recentTimestamps);
  return true;
}

/**
 * Clean up expired notifications
 */
function cleanupExpiredNotifications(): void {
  const now = new Date();
  const initialCount = notifications.length;
  
  notifications = notifications.filter(notification => {
    if (notification.expiresAt && now > notification.expiresAt) {
      return false;
    }
    return true;
  });
  
  // Clean up old notifications if we exceed max
  if (notifications.length > config.maxNotifications) {
    notifications = notifications
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, config.maxNotifications);
  }
  
  const cleanedCount = initialCount - notifications.length;
  if (cleanedCount > 0) {
    console.debug(`Cleaned up ${cleanedCount} expired notifications`);
  }
}

/**
 * Generate unique notification ID
 */
function generateId(): string {
  return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add notification with enterprise features
 */
export function addNotification(
  type: Notification['type'],
  message: string,
  options: Partial<Notification> = {}
): string {
  const endMeasure = performanceService.startMeasurement('addNotification');
  
  try {
    // Rate limiting check
    if (!checkRateLimit(type)) {
      console.warn('Notification dropped due to rate limiting');
      return '';
    }
    
    // Sanitize message
    const sanitizedMessage = sanitizeInput(message);
    
    // Create notification
    const notification: Notification = {
      id: generateId(),
      type,
      message: sanitizedMessage,
      timestamp: new Date(),
      read: false,
      priority: options.priority || (type === 'error' ? 'critical' : 'medium'),
      expiresAt: options.expiresAt || new Date(Date.now() + config.retentionPeriod),
      retryCount: 0,
      source: 'notificationService',
      ...options
    };
    
    // Add to notifications
    notifications.push(notification);
    
    // Clean up if needed
    cleanupExpiredNotifications();
    
    // Analytics
    if (config.enableAnalytics) {
      analyticsData.push({
        type: 'notification_created',
        notificationType: type,
        timestamp: new Date(),
        metadata: { priority: notification.priority }
      });
    }
    
    // Accessibility announcement
    if (config.accessibilityEnabled && typeof window !== 'undefined') {
      announceToScreenReader(sanitizedMessage);
    }
    
    // Notify observers
    notifyObservers();
    
    // Persistence
    if (config.enablePersistence) {
      saveToLocalStorage();
    }
    
    console.debug(`Added notification: ${type} - ${sanitizedMessage}`);
    endMeasure();
    
    return notification.id;
    
  } catch (error) {
    console.error('Error adding notification:', error);
    endMeasure();
    return '';
  }
}

/**
 * Announce notification to screen readers
 */
function announceToScreenReader(message: string): void {
  try {
    if (typeof window === 'undefined') return;
    
    // Create live region if it doesn't exist
    let liveRegion = document.getElementById('notification-live-region');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'notification-live-region';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-9999px';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      document.body.appendChild(liveRegion);
    }
    
    // Announce the message
    liveRegion.textContent = message;
    
    // Clear after announcement
    setTimeout(() => {
      if (liveRegion) {
        liveRegion.textContent = '';
      }
    }, 1000);
  } catch (error) {
    console.error('Error announcing to screen reader:', error);
  }
}

/**
 * Notify all observers of state change
 */
function notifyObservers(): void {
  try {
    observers.forEach(observer => {
      try {
        observer([...notifications]);
      } catch (error) {
        console.error('Error notifying observer:', error);
      }
    });
  } catch (error) {
    console.error('Error in notifyObservers:', error);
  }
}

/**
 * Save notifications to localStorage
 */
function saveToLocalStorage(): void {
  try {
    if (typeof window === 'undefined') return;
    
    const serializedNotifications = notifications.map(n => ({
      ...n,
      timestamp: n.timestamp.toISOString(),
      expiresAt: n.expiresAt?.toISOString()
    }));
    
    localStorage.setItem('notifications', JSON.stringify(serializedNotifications));
  } catch (error) {
    console.error('Error saving notifications to localStorage:', error);
  }
}

/**
 * Load notifications from localStorage
 */
function loadFromLocalStorage(): void {
  try {
    if (typeof window === 'undefined') return;
    
    const stored = localStorage.getItem('notifications');
    if (!stored) return;
    
    const parsed = JSON.parse(stored);
    notifications = parsed.map((n: Record<string, unknown>) => ({
      ...n,
      timestamp: new Date(n.timestamp as string),
      expiresAt: n.expiresAt ? new Date(n.expiresAt as string) : undefined
    }));
    
    // Clean up expired ones
    cleanupExpiredNotifications();
    
  } catch (error) {
    console.error('Error loading notifications from localStorage:', error);
    notifications = [];
  }
}

// =============================================================================
// Specialized Notification Functions
// =============================================================================

/**
 * Notify customer is running late
 */
export function notifyLate(customerName: string, appointmentId: string, minutesLate: number): string {
  return addNotification(
    'late',
    `${customerName} is running ${minutesLate} minutes late`,
    {
      appointmentId,
      customerName,
      priority: 'high',
      metadata: { minutesLate }
    }
  );
}

/**
 * Notify appointment is overdue
 */
export function notifyOverdue(customerName: string, appointmentId: string, minutesOverdue: number): string {
  return addNotification(
    'overdue',
    `${customerName}'s appointment is ${minutesOverdue} minutes overdue`,
    {
      appointmentId,
      customerName,
      priority: 'critical',
      metadata: { minutesOverdue }
    }
  );
}

/**
 * Notify customer has arrived
 */
export function notifyArrival(customerName: string, appointmentId: string): string {
  return addNotification(
    'arrival',
    `${customerName} has arrived for their appointment`,
    {
      appointmentId,
      customerName,
      priority: 'medium',
      metadata: { arrived: true }
    }
  );
}

/**
 * Notify appointment reminder
 */
export function notifyReminder(customerName: string, appointmentId: string, minutesUntil: number): string {
  return addNotification(
    'reminder',
    `Reminder: ${customerName}'s appointment is in ${minutesUntil} minutes`,
    {
      appointmentId,
      customerName,
      priority: 'medium',
      metadata: { minutesUntil }
    }
  );
}

/**
 * Schedule a reminder notification
 */
export function scheduleReminder(appointmentId: string, customerName: string, minutesUntil: number): string {
  return notifyReminder(customerName, appointmentId, minutesUntil);
}

// =============================================================================
// State Management Functions
// =============================================================================

/**
 * Get all notifications
 */
export function getNotifications(): Notification[] {
  cleanupExpiredNotifications();
  return [...notifications];
}

/**
 * Get notifications by type
 */
export function getNotificationsByType(type: Notification['type']): Notification[] {
  cleanupExpiredNotifications();
  return notifications.filter(n => n.type === type);
}

/**
 * Get unread notifications
 */
export function getUnreadNotifications(): Notification[] {
  cleanupExpiredNotifications();
  return notifications.filter(n => !n.read);
}

/**
 * Mark notification as read (alias for markAsRead)
 */
export function markNotificationAsRead(id: string): boolean {
  return markAsRead(id);
}

/**
 * Mark notification as read
 */
export function markAsRead(id: string): boolean {
  const notification = notifications.find(n => n.id === id);
  if (notification) {
    notification.read = true;
    notifyObservers();
    if (config.enablePersistence) {
      saveToLocalStorage();
    }
    return true;
  }
  return false;
}

/**
 * Mark all notifications as read
 */
export function markAllAsRead(): void {
  notifications.forEach(n => n.read = true);
  notifyObservers();
  if (config.enablePersistence) {
    saveToLocalStorage();
  }
}

/**
 * Remove notification by ID
 */
export function removeNotification(id: string): boolean {
  const index = notifications.findIndex(n => n.id === id);
  if (index !== -1) {
    notifications.splice(index, 1);
    notifyObservers();
    if (config.enablePersistence) {
      saveToLocalStorage();
    }
    return true;
  }
  return false;
}

/**
 * Clear all notifications
 */
export function clearAllNotifications(): void {
  notifications = [];
  notifyObservers();
  if (config.enablePersistence && typeof window !== 'undefined') {
    localStorage.removeItem('notifications');
  }
}

/**
 * Subscribe to notification changes
 */
export function subscribe(observer: (notifications: Notification[]) => void): () => void {
  observers.push(observer);
  
  // Return unsubscribe function
  return () => {
    const index = observers.indexOf(observer);
    if (index !== -1) {
      observers.splice(index, 1);
    }
  };
}

// =============================================================================
// Configuration and Analytics
// =============================================================================

/**
 * Update notification service configuration
 */
export function updateConfig(newConfig: Partial<NotificationConfig>): void {
  config = { ...config, ...newConfig };
  console.debug('Notification service config updated:', config);
}

/**
 * Get current configuration
 */
export function getConfig(): NotificationConfig {
  return { ...config };
}

/**
 * Get notification statistics
 */
export function getStats(): NotificationStats {
  const total = notifications.length;
  const byType: Record<string, number> = {};
  
  notifications.forEach(n => {
    byType[n.type] = (byType[n.type] || 0) + 1;
  });
  
  // Calculate delivery rate (simplified)
  const delivered = notifications.filter(n => !n.retryCount || n.retryCount === 0).length;
  const deliveryRate = total > 0 ? (delivered / total) * 100 : 100;
  
  // Calculate error rate
  const errors = notifications.filter(n => n.type === 'error').length;
  const errorRate = total > 0 ? (errors / total) * 100 : 0;
  
  return {
    total,
    byType,
    deliveryRate,
    errorRate,
    avgResponseTime: 0 // Would need more sophisticated tracking
  };
}

/**
 * Get analytics data
 */
export function getAnalytics(): Array<{ type: string; notificationType: string; timestamp: Date; metadata: Record<string, unknown> }> {
  return [...analyticsData];
}

/**
 * Clear analytics data
 */
export function clearAnalytics(): void {
  analyticsData = [];
}

// =============================================================================
// Initialization and Cleanup
// =============================================================================

/**
 * Initialize notification service
 */
export function initializeService(): void {
  try {
    // Load persisted notifications
    if (config.enablePersistence) {
      loadFromLocalStorage();
    }
    
    // Set up cleanup interval
    setInterval(() => {
      cleanupExpiredNotifications();
    }, 5 * 60 * 1000); // Every 5 minutes
    
    console.debug('Notification service initialized');
  } catch (error) {
    console.error('Error initializing notification service:', error);
  }
}

/**
 * Cleanup service resources
 */
export function cleanup(): void {
  try {
    clearAllNotifications();
    observers = [];
    rateLimitMap.clear();
    analyticsData = [];
    console.debug('Notification service cleaned up');
  } catch (error) {
    console.error('Error cleaning up notification service:', error);
  }
}

// Initialize on import if in browser environment
if (typeof window !== 'undefined') {
  initializeService();
}

// Default export for convenience
export default {
  addNotification,
  notifyLate,
  notifyOverdue,
  notifyArrival,
  notifyReminder,
  scheduleReminder,
  getNotifications,
  getNotificationsByType,
  getUnreadNotifications,
  markAsRead,
  markNotificationAsRead,
  markAllAsRead,
  removeNotification,
  clearAllNotifications,
  subscribe,
  updateConfig,
  getConfig,
  getStats,
  getAnalytics,
  clearAnalytics,
  initializeService,
  cleanup
};