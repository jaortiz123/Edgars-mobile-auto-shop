import { describe, it, expect } from 'vitest';
import { filterTemplates } from '@/lib/messageTemplates';

describe('messageTemplates filtering', () => {
  it('returns all when no filters', () => {
    const all = filterTemplates({});
    expect(all.length).toBeGreaterThan(0);
  });

  it('filters by channel', () => {
    const sms = filterTemplates({ channel: 'sms' });
    expect(sms.every(t => t.channel === 'sms' || t.channel === 'any')).toBe(true);
  });

  it('filters by category', () => {
    const cat = filterTemplates({ category: 'Reminders' });
    expect(cat.every(t => t.category === 'Reminders')).toBe(true);
  });

  it('search matches label or body', () => {
    const results = filterTemplates({ query: 'ready' });
    expect(results.some(t => /ready/i.test(t.label) || /ready/i.test(t.body))).toBe(true);
  });
});
