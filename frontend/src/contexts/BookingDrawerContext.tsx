// Booking Drawer context + provider (fast-refresh rule suppressed intentionally)
/* eslint-disable */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface BookingDrawerState {
  isOpen: boolean;
  customerId?: string;
  customerName?: string;
  open: (payload: { customerId: string; name: string }) => void;
  close: () => void;
}

export const BookingDrawerContext = createContext<BookingDrawerState | undefined>(undefined);

export function BookingDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [customerName, setCustomerName] = useState<string | undefined>();

  const open = useCallback((p: { customerId: string; name: string }) => {
    setCustomerId(p.customerId);
    setCustomerName(p.name);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  // Global CustomEvent listener
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { customerId?: string; name?: string } | undefined;
      if (detail?.customerId && detail?.name) {
        open({ customerId: detail.customerId, name: detail.name });
      }
    };
    window.addEventListener('open-booking-drawer', handler as EventListener);
    return () => window.removeEventListener('open-booking-drawer', handler as EventListener);
  }, [open]);

  return (
    <BookingDrawerContext.Provider value={{ isOpen, customerId, customerName, open, close }}>
      {children}
      <BookingDrawer />
    </BookingDrawerContext.Provider>
  );
}

function BookingDrawer() {
  const { isOpen, customerId, customerName, close } = useBookingDrawer();
  if (!isOpen) return null;
  return (
    <div data-testid="booking-drawer" className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={close} />
      <div className="w-full max-w-md bg-white shadow-xl p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Appointment</h2>
          <button onClick={close} className="text-sm text-gray-500 hover:text-gray-700" data-testid="booking-drawer-close">✕</button>
        </div>
        <div className="text-sm text-gray-700" data-testid="booking-drawer-customer">Customer: {customerName} ({customerId})</div>
        <div className="text-xs text-gray-500">(Form coming in Phase 3)</div>
        <div className="mt-auto flex justify-end">
          <button onClick={close} className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-sm" data-testid="booking-drawer-cancel">Close</button>
        </div>
      </div>
    </div>
  );
}

export function useBookingDrawer() {
  const ctx = useContext(BookingDrawerContext);
  if (!ctx) throw new Error('useBookingDrawer must be used within BookingDrawerProvider');
  return ctx;
}
