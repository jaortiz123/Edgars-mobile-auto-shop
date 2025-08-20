import { getTelemetry, _test_snapshot_full, track, _test_reset } from '../../../src/services/telemetry';

// New tests for hardened privacy redaction guard

describe('privacy redaction guard (hardened rules)', () => {
  beforeEach(() => {
    _test_reset();
    getTelemetry();
  try { sessionStorage.removeItem('telemetry_queue_v1'); } catch { /* ignore */ }
  });

  it('redacts case-insensitive exact identity keys (Email)', () => {
    track('pii.email', { Email: 'USER@Example.COM' });
  const q = _test_snapshot_full();
  const payload = q[q.length-1].ev.payload as Record<string, unknown>;
    expect(payload.Email).toBe('[REDACTED]');
  });

  it('does NOT redact username key (partial match not allowed)', () => {
    track('pii.username', { username: 'alice01' });
  const q = _test_snapshot_full();
  const payload = q[q.length-1].ev.payload as Record<string, unknown>;
    expect(payload.username).toBe('alice01');
  });

  it('redacts email substring in free-form notes', () => {
    track('pii.notes', { notes: 'Contact at user@example.com for details' });
  const q = _test_snapshot_full();
  const payload = q[q.length-1].ev.payload as Record<string, unknown>;
    expect(payload.notes).toBe('[REDACTED]');
  });

  it('redacts nested PII (phone deep inside array)', () => {
    track('pii.nested', { meta: { contacts: [{ type: 'main', phone: '+15551234567' }] } });
  const q = _test_snapshot_full();
  const payload = q[q.length-1].ev.payload as Record<string, unknown>;
  const meta = payload.meta as { contacts: { type: string; phone: string }[] };
  const contacts = meta.contacts;
    expect(contacts[0].phone).toBe('[REDACTED]');
  });
});
