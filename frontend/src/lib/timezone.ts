// Lightweight helpers to format dates/times in the shop's timezone.
// Set VITE_SHOP_TZ in your environment (e.g., America/Los_Angeles). Falls back to America/Los_Angeles.

// Use Vite's ImportMetaEnv if available, otherwise fall back safely
const viteEnv = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env) || {};
const SHOP_TZ: string = (viteEnv as Record<string, string>).VITE_SHOP_TZ || 'America/Los_Angeles';

function ensureDate(value: string | number | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export type DateStyle = 'date' | 'time' | 'datetime';

export function formatInShopTZ(value: string | number | Date | null | undefined, style: DateStyle = 'datetime', opts: Intl.DateTimeFormatOptions = {}): string {
  const d = ensureDate(value);
  if (!d) return '—';

  const base: Intl.DateTimeFormatOptions = { timeZone: SHOP_TZ, ...opts };

  if (style === 'date') {
    Object.assign(base, { year: 'numeric', month: 'short', day: '2-digit' });
  } else if (style === 'time') {
    Object.assign(base, { hour: 'numeric', minute: '2-digit' });
  } else {
    Object.assign(base, { year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' });
  }

  return new Intl.DateTimeFormat('en-US', base).format(d);
}

export function getShopTimeZone(): string { return SHOP_TZ; }
