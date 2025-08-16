import { useContext } from 'react';
import { BookingDrawerContext } from './BookingDrawerContext';

export function useBookingDrawer() {
  const ctx = useContext(BookingDrawerContext);
  if (!ctx) throw new Error('useBookingDrawer must be used within BookingDrawerProvider');
  return ctx;
}
