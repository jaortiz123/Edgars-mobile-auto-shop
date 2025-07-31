import React from 'react';
import offlineService from '@/services/offlineSupport';

/**
 * Offline Status Indicator Component
 * Visual indicator for offline state and pending actions
 */
export function OfflineStatusIndicator() {
  const [state, setState] = React.useState(() => offlineService.getState());

  React.useEffect(() => {
    const unsubscribe = offlineService.subscribe(setState);
    return unsubscribe;
  }, []);

  const { isOnline, pendingActions, syncInProgress } = state;

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

export default OfflineStatusIndicator;
