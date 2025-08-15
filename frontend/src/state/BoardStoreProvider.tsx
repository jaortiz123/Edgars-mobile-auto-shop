import React from 'react';
import { useBoardStoreInitializer } from './useBoardStore';

/**
 * BoardStoreProvider
 * Lightweight provider whose sole job is to invoke the board store initializer hook.
 * This replaces the deprecated AppointmentContext. All components should now
 * access board data via selectors from useBoardStore (e.g. useBoardFilteredCards()).
 */
export function BoardStoreProvider({ children }: { children: React.ReactNode }) {
  useBoardStoreInitializer(true);
  return <>{children}</>;
}

export default BoardStoreProvider;
