import { describe, it, expect } from 'vitest';
import { applyTemplate, buildTemplateContext } from '@/lib/messageTemplates';

describe('messageTemplates variable resolution', () => {
  const template = {
    id: 'test',
    label: 't',
    channel: 'sms' as const,
    body: 'Hello {{customer.name}}, your appt is on {{appointment.start}} for your {{vehicle.year}} {{vehicle.make}} {{vehicle.model}}. Missing: {{customer.phone}}'
  };

  it('resolves nested variables', () => {
    const ctx = buildTemplateContext({
      customer: { name: 'Sam' },
      appointment: { start: '2025-08-15 10:00' },
      vehicle: { year: 2020, make: 'Toyota', model: 'Camry' }
    });
    const out = applyTemplate(template, ctx, { missingTag: p => `[${p}]` });
    expect(out).toContain('Hello Sam');
    expect(out).toContain('2025-08-15 10:00');
    expect(out).toContain('2020 Toyota Camry');
    expect(out).toContain('[customer.phone]');
  });

  it('supports escaped literals', () => {
    const tpl = { ...template, body: 'Literal: \\{{notAVar}} and real {{customer.name}}' };
    const ctx = buildTemplateContext({ customer: { name: 'Rita' } });
    const out = applyTemplate(tpl, ctx, { missingTag: p => `[${p}]` });
    expect(out).toContain('Literal: {{notAVar}}');
    expect(out).toContain('real Rita');
  });
});
