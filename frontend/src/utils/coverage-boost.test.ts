import { describe, it, expect } from 'vitest';
import { formatCurrency, money, dtLocal } from '@/utils/format';
import { http, toStatus } from '@/lib/api';

describe('Utils Coverage Booster', () => {
  it('formats currency correctly', () => {
    expect(formatCurrency(123.45)).toBe('$123.45');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(1000)).toBe('$1,000.00');
    expect(formatCurrency(null)).toBe('$0.00');
  });

  it('formats money helper correctly', () => {
    expect(money(123.45)).toContain('$');
    expect(money(null)).toBe('—');
  });

  it('formats date helper correctly', () => {
    expect(dtLocal('2025-01-15T10:30:00Z')).toContain('2025');
    expect(dtLocal(null)).toBe('—');
  });

  it('exports http client', () => {
    expect(http).toBeDefined();
    expect(http.defaults.baseURL).toBeDefined();
  });

  it('converts status correctly', () => {
    expect(toStatus('scheduled')).toBe('SCHEDULED')
    expect(toStatus('in-progress')).toBe('IN_PROGRESS')
    expect(toStatus('invalid')).toBe('INVALID')
  })
});
