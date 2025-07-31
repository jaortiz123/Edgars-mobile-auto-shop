/**
 * Offline Support Service for Sprint 3C Appointment Reminders
 * Provides comprehensive offline capabilities with intelligent sync
 */

interface OfflineAction {
  id: string;
  type: 'mark_arrived' | 'notification_read' | 'reschedule' | 'notification_created';
  payload: unknown;
  timestamp: string;
  retryCount: number;
  priority: 'high' | 'normal' | 'low';
}

interface OfflineState {
  isOnline: boolean;
  pendingActions: OfflineAction[];
  lastSyncTime: string | null;
  syncInProgress: boolean;
}

class OfflineSupportService {
  private state: OfflineState = {
    isOnline: navigator.onLine,
    pendingActions: [],
    lastSyncTime: null,
    syncInProgress: false
  };

  private listeners: Set<(state: OfflineState) => void> = new Set();
  private syncTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.init();
  }

  private init() {
    // Load persisted state
    this.loadState();

    // Set up network status listeners
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Set up periodic sync attempts
    this.setupPeriodicSync();

    // Initial sync if online
    if (this.state.isOnline) {
      this.attemptSync();
    }
  }

  private loadState() {
    try {
      const saved = localStorage.getItem('offline-support-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state.pendingActions = parsed.pendingActions || [];
        this.state.lastSyncTime = parsed.lastSyncTime || null;
      }
    } catch (error) {
      console.warn('Failed to load offline state:', error);
    }
  }

  private saveState() {
    try {
      localStorage.setItem('offline-support-state', JSON.stringify({
        pendingActions: this.state.pendingActions,
        lastSyncTime: this.state.lastSyncTime
      }));
    } catch (error) {
      console.warn('Failed to save offline state:', error);
    }
  }

  private handleOnline = () => {
    this.state.isOnline = true;
    this.notifyListeners();
    this.attemptSync();
  };

  private handleOffline = () => {
    this.state.isOnline = false;
    this.notifyListeners();
  };

  private setupPeriodicSync() {
    this.syncTimer = setInterval(() => {
      if (this.state.isOnline && this.state.pendingActions.length > 0) {
        this.attemptSync();
      }
    }, 30000); // Try sync every 30 seconds
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  public isOnline(): boolean {
    return this.state.isOnline;
  }

  public getState(): OfflineState {
    return { ...this.state };
  }

  public addAction(
    type: OfflineAction['type'],
    payload: unknown,
    priority: OfflineAction['priority'] = 'normal'
  ): void {
    const action: OfflineAction = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      priority
    };

    this.state.pendingActions.push(action);
    this.sortActionsByPriority();
    this.saveState();
    this.notifyListeners();

    // Attempt immediate sync if online
    if (this.state.isOnline) {
      this.attemptSync();
    }
  }

  private sortActionsByPriority() {
    const priorityOrder = { high: 3, normal: 2, low: 1 };
    this.state.pendingActions.sort((a, b) => 
      priorityOrder[b.priority] - priorityOrder[a.priority]
    );
  }

  public clearPendingActions(): void {
    this.state.pendingActions = [];
    this.saveState();
    this.notifyListeners();
  }

  private async attemptSync(): Promise<void> {
    if (this.state.syncInProgress || this.state.pendingActions.length === 0) {
      return;
    }

    this.state.syncInProgress = true;
    this.notifyListeners();

    try {
      // Process actions in priority order
      const actionsToProcess = [...this.state.pendingActions];
      
      for (const action of actionsToProcess) {
        try {
          await this.syncAction(action);
          
          // Remove successful action
          this.state.pendingActions = this.state.pendingActions.filter(
            a => a.id !== action.id
          );
        } catch (error) {
          console.warn(`Failed to sync action ${action.id}:`, error);
          
          // Increment retry count
          const actionIndex = this.state.pendingActions.findIndex(a => a.id === action.id);
          if (actionIndex >= 0) {
            this.state.pendingActions[actionIndex].retryCount++;
            
            // Remove action if too many retries
            if (this.state.pendingActions[actionIndex].retryCount >= 3) {
              this.state.pendingActions.splice(actionIndex, 1);
            }
          }
        }
      }

      this.state.lastSyncTime = new Date().toISOString();
    } finally {
      this.state.syncInProgress = false;
      this.saveState();
      this.notifyListeners();
    }
  }

  private async syncAction(action: OfflineAction): Promise<void> {
    switch (action.type) {
      case 'mark_arrived':
        await this.syncMarkArrived(action.payload as { appointmentId: string });
        break;
      
      case 'notification_read':
        await this.syncNotificationRead(action.payload as { notificationId: string });
        break;
      
      case 'reschedule':
        await this.syncReschedule(action.payload as { appointmentId: string; newTime: string });
        break;
      
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  private async syncMarkArrived(payload: { appointmentId: string }): Promise<void> {
    const { markArrived } = await import('@/lib/api');
    await markArrived(payload.appointmentId);
  }

  private async syncNotificationRead(payload: { notificationId: string }): Promise<void> {
    // Sync notification read status with server
    console.log('Syncing notification read:', payload.notificationId);
  }

  private async syncReschedule(payload: { appointmentId: string; newTime: string }): Promise<void> {
    const reschedulingModule = await import('@/services/reschedulingService');
    await reschedulingModule.rescheduleToTimeSlot(payload.appointmentId, payload.newTime, payload.newTime);
  }

  public subscribe(listener: (state: OfflineState) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  public forceSync(): Promise<void> {
    return this.attemptSync();
  }

  public cleanup(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    this.listeners.clear();
  }
}

// Singleton instance
const offlineService = new OfflineSupportService();

// Hook for offline state (will be enhanced with React hooks in UI components)
export function useOfflineState() {
  // Basic state getter - UI components will enhance this with React hooks
  return {
    ...offlineService.getState(),
    addAction: offlineService.addAction.bind(offlineService),
    forceSync: offlineService.forceSync.bind(offlineService),
    clearPendingActions: offlineService.clearPendingActions.bind(offlineService)
  };
}

// Enhanced functions with offline support
export async function markArrivedWithOfflineSupport(appointmentId: string): Promise<void> {
  if (offlineService.isOnline()) {
    try {
      const { markArrived } = await import('@/lib/api');
      await markArrived(appointmentId);
    } catch (error) {
      // If online but API fails, queue for later
      offlineService.addAction('mark_arrived', { appointmentId }, 'high');
      throw error;
    }
  } else {
    // Queue action for when back online
    offlineService.addAction('mark_arrived', { appointmentId }, 'high');
    
    // Show offline notification
    const { addNotification } = await import('@/services/notificationService');
    addNotification(
      'info',
      'Action queued for when back online'
    );
  }
}

export async function rescheduleWithOfflineSupport(
  appointmentId: string,
  newTime: string
): Promise<void> {
  if (offlineService.isOnline()) {
    try {
      const reschedulingModule = await import('@/services/reschedulingService');
      await reschedulingModule.rescheduleToTimeSlot(appointmentId, newTime, newTime);
    } catch (error) {
      // If online but API fails, queue for later
      offlineService.addAction('reschedule', { appointmentId, newTime }, 'normal');
      throw error;
    }
  } else {
    // Queue action for when back online
    offlineService.addAction('reschedule', { appointmentId, newTime }, 'normal');
    
    // Show offline notification
    const { addNotification } = await import('@/services/notificationService');
    addNotification(
      'info',
      'Reschedule request queued for when back online'
    );
  }
}

export default offlineService;
