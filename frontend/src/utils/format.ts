// Simple currency formatting util (USD default)
export function formatCurrency(amount: number | undefined | null, currency: string = 'USD') {
  if (typeof amount !== 'number' || isNaN(amount)) return '$0.00';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}
