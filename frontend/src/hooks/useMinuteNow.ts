// Provides a Date.now() value updated on a minute boundary to drive elapsed time chips
import { useEffect, useState } from 'react';

let globalTimerRef: number | null = null;
const subscribers = new Set<() => void>();

function ensureTimer() {
  if (globalTimerRef != null) return;
  // Align first tick to next minute boundary for cleaner UX
  const scheduleNext = () => {
    const now = Date.now();
    const msUntilNextMinute = 60000 - (now % 60000);
    globalTimerRef = window.setTimeout(() => {
      subscribers.forEach(fn => { try { fn(); } catch { /* ignore */ } });
      scheduleNext();
    }, msUntilNextMinute);
  };
  scheduleNext();
}

// Test-only: force trigger of a tick without waiting for real minute boundary.
// Not part of public runtime API; used in tests to flush pending state updates.
export function __flushMinuteNowTickForTests() {
  subscribers.forEach(fn => { try { fn(); } catch { /* ignore */ } });
}

export function useMinuteNow(): number {
  const [stamp, setStamp] = useState(() => Date.now());
  useEffect(() => {
    const fn = () => setStamp(Date.now());
    subscribers.add(fn);
    ensureTimer();
    return () => { subscribers.delete(fn); if (!subscribers.size && globalTimerRef != null) { clearTimeout(globalTimerRef); globalTimerRef = null; } };
  }, []);
  return stamp;
}

export function formatElapsed(startIso?: string | null, nowMs?: number): string | null {
  if (!startIso) return null;
  try {
    const start = new Date(startIso).getTime();
    const now = nowMs ?? Date.now();
    if (isNaN(start)) return null;
    const diff = Math.max(0, now - start);
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hours < 8) return rem ? `${hours}h ${rem}m` : `${hours}h`;
    if (hours < 48) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  } catch { return null; }
}
