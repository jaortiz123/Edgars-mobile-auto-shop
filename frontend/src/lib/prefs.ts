/**
 * Utility for persisting the Calendar vs Board view mode in localStorage.
 */
export type ViewMode = 'calendar' | 'board';

const STORAGE_KEY = 'viewMode';

export function getViewMode(): ViewMode {
  const stored = localStorage.getItem(STORAGE_KEY) as ViewMode | null;
  return stored === 'calendar' || stored === 'board' ? stored : 'board';
}

export function setViewMode(mode: ViewMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}
