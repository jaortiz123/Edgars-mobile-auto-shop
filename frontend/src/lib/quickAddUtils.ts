// Quick add persistence helpers (minimal for tests)
export interface QuickAddPayload { [key: string]: unknown }

export function saveLastQuickAdd(settings: QuickAddPayload) {
  try { localStorage.setItem('lastQuickAdd', JSON.stringify(settings)); } catch { /* ignore */ }
}

export function getLastQuickAdd(): QuickAddPayload | null {
  try {
    const settings = localStorage.getItem('lastQuickAdd');
    return settings ? JSON.parse(settings) : null;
  } catch { return null; }
}
