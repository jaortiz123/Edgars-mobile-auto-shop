import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface AppointmentContextType {
  refreshTrigger: number;
  triggerRefresh: () => void;
  isRefreshing: boolean;
  setRefreshing: (refreshing: boolean) => void;
}

const AppointmentContext = createContext<AppointmentContextType | undefined>(undefined);

interface AppointmentProviderProps {
  children: ReactNode;
}

export const AppointmentProvider: React.FC<AppointmentProviderProps> = ({ children }) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const triggerRefresh = useCallback(() => {
    console.log('🔄 Global appointment refresh triggered');
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const setRefreshing = useCallback((refreshing: boolean) => {
    setIsRefreshing(refreshing);
  }, []);

  return (
    <AppointmentContext.Provider 
      value={{ 
        refreshTrigger, 
        triggerRefresh, 
        isRefreshing, 
        setRefreshing 
      }}
    >
      {children}
    </AppointmentContext.Provider>
  );
};

export const useAppointmentContext = () => {
  const context = useContext(AppointmentContext);
  if (context === undefined) {
    throw new Error('useAppointmentContext must be used within an AppointmentProvider');
  }
  return context;
};
