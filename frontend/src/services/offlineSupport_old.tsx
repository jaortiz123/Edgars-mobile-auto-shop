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
      const stored = localStorage.getItem('sprint3c_offline_state');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.state = {
          ...this.state,
          pendingActions: parsed.pendingActions || [],
          lastSyncTime: parsed.lastSyncTime || null
        };
      }
    } catch (error) {
      console.warn('Failed to load offline state:', error);
    }
  }

  private saveState() {
    try {
      const toSave = {
        pendingActions: this.state.pendingActions,
        lastSyncTime: this.state.lastSyncTime
      };
      localStorage.setItem('sprint3c_offline_state', JSON.stringify(toSave));
    } catch (error) {
      console.warn('Failed to save offline state:', error);
    }
  }

  private handleOnline = () => {
    console.log('🌐 Sprint 3C: Back online, attempting sync...');
    this.state.isOnline = true;
    this.notifyListeners();
    this.attemptSync();
  };

  private handleOffline = () => {
    console.log('📴 Sprint 3C: Gone offline, queuing actions...');
    this.state.isOnline = false;
    this.notifyListeners();
  };

  private setupPeriodicSync() {
    this.syncTimer = setInterval(() => {
      if (this.state.isOnline && this.state.pendingActions.length > 0) {
        this.attemptSync();
      }
    }, 30000); // Sync every 30 seconds
  }

  private async attemptSync() {
    if (this.state.syncInProgress || this.state.pendingActions.length === 0) {
      return;
    }

    this.state.syncInProgress = true;
    this.notifyListeners();

    try {
      console.log(`🔄 Sprint 3C: Syncing ${this.state.pendingActions.length} offline actions...`);
      
      const actionsToSync = [...this.state.pendingActions];
      const successful: string[] = [];
      const failed: OfflineAction[] = [];

      for (const action of actionsToSync) {
        try {
          await this.syncAction(action);
          successful.push(action.id);
          console.log(`✅ Synced action: ${action.type}`);
        } catch (error) {
          console.warn(`❌ Failed to sync action: ${action.type}`, error);
          
          // Increment retry count
          action.retryCount++;
          
          // Remove action if max retries exceeded
          if (action.retryCount >= 5) {
            console.warn(`🗑️ Dropping action after 5 failed attempts: ${action.type}`);
            successful.push(action.id); // Remove from queue
          } else {
            failed.push(action);
          }
        }
      }

      // Update pending actions
      this.state.pendingActions = failed;
      this.state.lastSyncTime = new Date().toISOString();
      
      if (successful.length > 0) {
        console.log(`✅ Sprint 3C: Successfully synced ${successful.length} actions`);
        
        // Notify about successful sync
        this.notifySuccessfulSync(successful.length);
      }

      this.saveState();
    } catch (error) {
      console.error('🚨 Sprint 3C: Sync failed:', error);
    } finally {
      this.state.syncInProgress = false;
      this.notifyListeners();
    }
  }

  private async syncAction(action: OfflineAction): Promise<void> {
    switch (action.type) {
      case 'mark_arrived':
        return this.syncMarkArrived(action.payload as { appointmentId: string });
      
      case 'notification_read':
        return this.syncNotificationRead(action.payload as { notificationId: string });
      
      case 'reschedule':
        return this.syncReschedule(action.payload as { appointmentId: string; newTime: string });
      
      case 'notification_created':
        // Notifications don't need syncing to server, just local cleanup
        return Promise.resolve();
      
      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }

  private async syncMarkArrived(payload: { appointmentId: string }): Promise<void> {
    const { markArrived } = await import('@/lib/api');
    await markArrived(payload.appointmentId);
  }

  private async syncNotificationRead(payload: { notificationId: string }): Promise<void> {
    // For notifications, we just need to update local state
    // No server sync needed for read status
    return Promise.resolve();
  }

  private async syncReschedule(payload: { appointmentId: string; newTime: string }): Promise<void> {
    // Import rescheduling service dynamically
    const reschedulingModule = await import('@/services/reschedulingService');
    await reschedulingModule.rescheduleToTimeSlot(payload.appointmentId, payload.newTime, new Date(payload.newTime));
  }

  private notifySuccessfulSync(count: number) {
    // Create a sync notification
    const { addNotification } = require('@/services/notificationService');
    addNotification(
      `Successfully synced ${count} offline action${count > 1 ? 's' : ''}`,
      'success',
      { persist: false, showToast: true }
    );
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener({ ...this.state });
      } catch (error) {
        console.warn('Error notifying offline state listener:', error);
      }
    });
  }

  // Public API
  public getState(): OfflineState {
    return { ...this.state };
  }

  public isOnline(): boolean {
    return this.state.isOnline;
  }

  public addAction(
    type: OfflineAction['type'],
    payload: unknown,
    priority: OfflineAction['priority'] = 'normal'
  ): void {
    const action: OfflineAction = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      priority
    };

    this.state.pendingActions.push(action);
    
    // Sort by priority and timestamp
    this.state.pendingActions.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    this.saveState();
    this.notifyListeners();

    console.log(`📥 Sprint 3C: Queued offline action: ${type}${!this.state.isOnline ? ' (offline)' : ''}`);

    // If online, attempt immediate sync
    if (this.state.isOnline) {
      setTimeout(() => this.attemptSync(), 100);
    }
  }

  public subscribe(listener: (state: OfflineState) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  public forceSync(): Promise<void> {
    if (!this.state.isOnline) {
      return Promise.reject(new Error('Cannot sync while offline'));
    }
    
    return this.attemptSync();
  }

  public clearPendingActions(): void {
    this.state.pendingActions = [];
    this.saveState();
    this.notifyListeners();
  }

  public cleanup(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    
    this.listeners.clear();
  }
}

// Singleton instance
const offlineService = new OfflineSupportService();

// React hook for offline state
export function useOfflineState() {
  const [state, setState] = React.useState<OfflineState>(() => offlineService.getState());

  React.useEffect(() => {
    const unsubscribe = offlineService.subscribe(setState);
    return unsubscribe;
  }, []);

  return {
    ...state,
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
      'Action queued for when back online',
      'info',
      { persist: false, showToast: true }
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
      await reschedulingModule.rescheduleToTimeSlot(appointmentId, newTime, new Date(newTime));
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
      'Reschedule request queued for when back online',
      'info',
      { persist: false, showToast: true }
    );
  }
}

// Offline status indicator component
export function OfflineStatusIndicator() {
  const { isOnline, pendingActions, syncInProgress } = useOfflineState();

  if (isOnline && pendingActions.length === 0) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 px-3 py-2 rounded-lg text-sm font-medium ${
      !isOnline 
        ? 'bg-red-100 text-red-800 border border-red-200' 
        : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
    }`}>
      <div className="flex items-center space-x-2">
        {!isOnline ? (
          <>
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            <span>Offline</span>
          </>
        ) : syncInProgress ? (
          <>
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
            <span>Syncing {pendingActions.length} actions...</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
            <span>{pendingActions.length} actions pending</span>
          </>
        )}
      </div>
    </div>
  );
}

export default offlineService;
