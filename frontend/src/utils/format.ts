// Simple currency formatting util (USD default)
export function formatCurrency(amount: number | undefined | null, currency: string = 'USD') {
  if (typeof amount !== 'number' || isNaN(amount)) return '$0.00';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

// B6 helpers (lightweight wrappers aligned with profile types)
export const money = (n?: number | null) => (n == null ? '—' : n.toLocaleString(undefined, { style: 'currency', currency: 'USD' }));
export const dtLocal = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : '—');
