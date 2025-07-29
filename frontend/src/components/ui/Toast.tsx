import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { setToastPush } from '@/lib/toast';

interface ToastMsg {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
  /**
   * Optional stable key used to de-duplicate programmatic toasts.
   * If provided, a toast with the same key will be updated instead of duplicated.
   */
  key?: string;
}

interface ToastContextValue {
  /** Push a toast. Provide `key` to de-duplicate repeated toasts. */
  push: (m: Omit<ToastMsg, 'id'>) => void;
  /** Success toast shorthand */
  success: (text: string, opts?: { key?: string }) => void;
  /** Error toast shorthand */
  error: (text: string, opts?: { key?: string }) => void;
}

const ToastCtx = createContext<ToastContextValue | null>(null);

const DISMISS_MS = 4000;

type TimerHandle = ReturnType<typeof setTimeout>;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([]);
  // Map logical toast key -> toast id (for fast lookup)
  const keyToIdRef = useRef<Map<string, number>>(new Map());
  // Map toast id -> timer handle so we can reset on repeat push
  const timersRef = useRef<Map<number, TimerHandle>>(new Map());

  const scheduleDismiss = (id: number) => {
    // Clear existing timer if any
    const existing = timersRef.current.get(id);
    if (existing) clearTimeout(existing as unknown as number);
    const h = setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
      timersRef.current.delete(id);
      // Also remove any key mapping that pointed to this id
      for (const [k, v] of keyToIdRef.current.entries()) {
        if (v === id) keyToIdRef.current.delete(k);
      }
    }, DISMISS_MS);
    timersRef.current.set(id, h);
  };

  const push = (m: Omit<ToastMsg, 'id'>) => {
    if (m.key) {
      const existingId = keyToIdRef.current.get(m.key);
      if (existingId) {
        // Update existing toast in place (text/kind may change), and reset timer
        setItems((prev) => prev.map((t) => (t.id === existingId ? { ...t, kind: m.kind, text: m.text } : t)));
        scheduleDismiss(existingId);
        return;
      }
    }

    const id = Date.now() + Math.floor(Math.random() * 1000);
    const msg: ToastMsg = { id, ...m } as ToastMsg;
    setItems((prev) => [...prev, msg]);
    if (m.key) keyToIdRef.current.set(m.key, id);
    scheduleDismiss(id);
  };

  // Register push for programmatic toast API once
  useEffect(() => {
    setToastPush(push);
    return () => {
      // Cleanup timers on unmount
      for (const h of timersRef.current.values()) {
        clearTimeout(h as unknown as number);
      }
      timersRef.current.clear();
      keyToIdRef.current.clear();
    };
  }, [push]);

  return (
    <ToastCtx.Provider value={{ 
      push,
      success: (text: string, opts?: { key?: string }) => push({ kind: 'success', text, key: opts?.key }),
      error: (text: string, opts?: { key?: string }) => push({ kind: 'error', text, key: opts?.key })
    }}>
      {children}
      {/* ARIA live region for screen reader announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true" 
        className="absolute -top-full left-0 w-1 h-1 overflow-hidden opacity-0"
      >
        {items.length > 0 && items[items.length - 1].text}
      </div>
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {items.map((i) => (
          <div
            key={i.id}
            role="alert"
            aria-live="assertive"
            className={`rounded-md px-4 py-2 shadow-md text-white ${
              i.kind === 'error' ? 'bg-red-600' : i.kind === 'success' ? 'bg-green-600' : 'bg-gray-800'
            }`}
          >
            {i.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const v = useContext(ToastCtx);
  if (!v) throw new Error('useToast must be used within ToastProvider');
  return v;
}

// Programmatic toast API is provided in src/lib/toast, not here
