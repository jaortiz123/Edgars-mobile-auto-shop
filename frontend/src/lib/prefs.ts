// View mode persistence utility used by dashboard & tests
export type ViewMode = 'calendar' | 'board';

const STORAGE_KEY = 'viewMode';
let inMemory: ViewMode = 'board'; // fallback if localStorage unavailable

export function getViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as ViewMode | null;
    if (stored === 'calendar' || stored === 'board') return stored;
  } catch { /* ignore storage errors (jsdom) */ }
  return inMemory;
}

export function setViewMode(mode: ViewMode): void {
  inMemory = mode;
  try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignore */ }
}
