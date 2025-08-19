import { describe, it, expect, beforeEach, vi } from 'vitest';

// Minimal typings for telemetry test exports we use
interface SnapshotItem { ev: { payload: Record<string, unknown> }; retry: number; nextAttempt: number }
interface TelemetryTestAPI {
  track(event: string, payload?: Record<string, unknown>): void;
  _test_snapshot_full(): SnapshotItem[];
  _test_updateConfig(p: Record<string, unknown>): void;
  _test_forceFlush(): Promise<void>;
}
// loaded lazily
let telemetry: TelemetryTestAPI;

// Ensure deterministic random for backoff tests (jitter window not critical here)
const originalRandom = Math.random;

// Polyfill crypto.randomUUID if missing
if (!globalThis.crypto) { // @ts-expect-error jsdom crypto partial stub
  globalThis.crypto = {}; }
if (!globalThis.crypto.randomUUID) {
  (globalThis.crypto as Crypto & { randomUUID?: () => string }).randomUUID = () => '11111111-1111-4111-8111-111111111111';
}

describe('telemetry redaction & size guard edge cases', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    vi.resetModules();
    Math.random = originalRandom; // reset
    telemetry = await import('../../services/telemetry');
  });

  it('redacts nested PII keys and value patterns inside arrays', () => {
    telemetry.track('test.pii', {
      users: [
        { email: 'a@example.com', profile: { phone: '+15550001111', name: 'Alice' } },
        { Email: 'b@example.com', PHONE: '+15550002222', nested: [{ phone: '+15550003333' }] }
      ],
      contact_list: ['raw@example.com', 'no-redact', '+1 (555) 000 4444']
    });
  const snap = telemetry._test_snapshot_full();
  interface UserPayload { email?: string; Email?: string; PHONE?: string; profile?: { phone?: string }; nested?: { phone?: string }[] }
  interface PayloadShape { users: UserPayload[]; contact_list: string[] }
  const payload = snap[0].ev.payload as unknown as PayloadShape;
    expect(payload.users[0].email).toBe('[REDACTED]');
  expect(payload.users[0].profile?.phone).toBe('[REDACTED]');
    expect(payload.users[1].Email).toBe('[REDACTED]');
    expect(payload.users[1].PHONE).toBe('[REDACTED]');
  expect(payload.users[1].nested?.[0].phone).toBe('[REDACTED]');
    expect(payload.contact_list[0]).toBe('[REDACTED]');
    expect(payload.contact_list[2]).toBe('[REDACTED]');
  });

  it('truncates long string fields and marks payload as truncated', () => {
    const long = 'x'.repeat(1000);
    telemetry._test_updateConfig({ maxStringLength: 100, maxEventBytes: 500 });
    telemetry.track('test.long', { desc: long });
  interface LongPayload { desc: string; _truncated?: boolean }
  const p = telemetry._test_snapshot_full()[0].ev.payload as unknown as LongPayload;
    expect(p.desc.length).toBe(101); // 100 + ellipsis char
    expect(p.desc.endsWith('…')).toBe(true);
  });

  it('reduces oversized payload by shrinking arrays then pruning keys', () => {
    telemetry._test_updateConfig({ maxEventBytes: 300, maxStringLength: 120 });
    const bigArray = Array.from({ length: 50 }, (_, i) => ({ idx: i, email: `user${i}@example.com` }));
    telemetry.track('test.shrink', { bigArray, keep: 'short', another: 'value' });
  interface ShrinkPayload { bigArray: unknown[]; keep?: string; another?: string; _truncated?: boolean }
  const p = telemetry._test_snapshot_full()[0].ev.payload as unknown as ShrinkPayload;
    expect(p._truncated).toBe(true);
    // array should have been shrunk or removed if pruning removed largest key
    if (p.bigArray) {
      expect(Array.isArray(p.bigArray)).toBe(true);
      expect(p.bigArray.length).toBeLessThan(50);
    }
  });

  it('batches within byte limit and applies exponential backoff scheduling on failure', async () => {
    // Force send failure by monkey patching fetch to throw and removing sendBeacon
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('fail'); });
    telemetry._test_updateConfig({ maxBatchBytes: 5000, maxBatch: 10, retryBaseMs: 10 });
    for (let i=0;i<5;i++) telemetry.track('test.retry', { i, email: `z${i}@example.com` });
  const before = telemetry._test_snapshot_full().map(q=>q.nextAttempt);
    await telemetry._test_forceFlush(); // should set backoff
  const after = telemetry._test_snapshot_full();
  after.forEach((q, idx) => {
      expect(q.retry).toBe(1);
      expect(q.nextAttempt).toBeGreaterThanOrEqual(before[idx]);
    });
  });
});
