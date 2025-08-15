import { useState, useEffect } from 'react';

// Reactive store for server-driven board filters (currently only techId).
// Implements a tiny pub/sub so hooks can re-render when server filters change.

type Listener = () => void;
let listeners: Listener[] = [];
let techId: string | undefined;
let initialized = false;

const STORAGE_KEY = 'adm.board.filters.v1';

function loadInitial() {
  if (initialized) return;
  initialized = true;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.techs && Array.isArray(parsed.techs) && parsed.techs[0]) {
        techId = parsed.techs[0];
      }
    }
  } catch { /* ignore */ }
}

function emit() { listeners.forEach(l => { try { l(); } catch { /* ignore */ } }); }

export function setBoardTechFilter(id?: string | null) {
  loadInitial();
  techId = id || undefined;
  emit();
}

export function useBoardServerFilters() {
  loadInitial();
  const [snapshot, setSnapshot] = useState<{ techId: string | undefined }>({ techId });
  useEffect(() => {
    const listener = () => setSnapshot({ techId });
    listeners.push(listener);
    return () => { listeners = listeners.filter(l => l !== listener); };
  }, []);
  return snapshot;
}

// Helper for non-hook access (avoid for reactive usage)
export function peekBoardServerFilters() { loadInitial(); return { techId }; }
