import { useContext } from 'react';
import { MultiSelectContext } from '@/contexts/multiSelectContext';

export const useMultiSelect = () => {
  const context = useContext(MultiSelectContext);
  if (!context) {
    throw new Error('useMultiSelect must be used within a MultiSelectProvider');
  }
  return context;
};
