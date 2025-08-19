import { describe, it, expect, vi, beforeEach } from 'vitest';
// We'll import telemetry module lazily inside each test after environment prepared
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let telemetry: any;

// Polyfill crypto.randomUUID if missing (typed)
// Avoid redeclaration conflicts; we'll cast when assigning randomUUID polyfill
if (!globalThis.crypto) {
  // @ts-expect-error jsdom may not provide full crypto
  globalThis.crypto = {};
}
if (!globalThis.crypto.randomUUID) {
  (globalThis.crypto as Crypto & { randomUUID?: () => string }).randomUUID = () => '00000000-0000-4000-8000-000000000000';
}

// Mock sendBeacon with proper typing
const sendBeaconMock = vi.fn(() => true as boolean);
Object.defineProperty(navigator, 'sendBeacon', { value: sendBeaconMock, configurable: true });

// sessionStorage already available in jsdom via Vitest; ensure clean

describe('telemetry client', () => {
  beforeEach(async () => {
    sendBeaconMock.mockReset();
    sessionStorage.clear();
    // reset singleton by deleting module from cache
    vi.resetModules();
    // Re-define sendBeacon after reset (jsdom might recreate navigator)
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeaconMock, configurable: true });
    telemetry = await import('../../services/telemetry');
  });

  it('enqueues redacted event with versions and session correlation', async () => {
    telemetry.setLastRequestId('req-123');
    telemetry.track('user.signup', { email: 'user@example.com', profile: { phone: '+15551234567', note: 'ok' } });
  const snapshot = telemetry._test_snapshot();
  expect(snapshot.length).toBe(1);
  const item = snapshot[0];
  expect(item.ev.event_version).toBe(1);
  expect(item.ev.schema_version).toBe(1);
  expect(item.ev.request_id).toBe('req-123');
  // Narrow payload type locally
  type PayloadShape = { email?: string; profile?: { phone?: string } };
  const payload = item.ev.payload as PayloadShape;
  expect(payload.email).toBe('[REDACTED]');
  expect(payload.profile?.phone).toBe('[REDACTED]');
  expect(typeof item.ev.session_id).toBe('string');
  });

  it('flushes (beacon or fetch fallback) and trims queue', async () => {
    // Force beacon absence to exercise fetch path deterministically
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
  const mockResp = new Response('{}', { status: 200 });
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResp as unknown as Response);
    telemetry.track('evt.one', {});
    await telemetry._test_forceFlush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(telemetry._test_snapshot().length).toBe(0);
    fetchSpy.mockRestore();
  });

  it('drops oldest when maxQueue exceeded', async () => {
  telemetry._test_setMaxQueue(3);
  telemetry.track('a', {}); telemetry.track('b', {}); telemetry.track('c', {}); telemetry.track('d', {});
  const snapshot = telemetry._test_snapshot();
  expect(snapshot.length).toBe(3);
  expect(snapshot[0].ev.event).toBe('b'); // 'a' dropped
  });

  it('persists and restores queue across new instance', async () => {
  telemetry.track('persist.test', { v: 1 });
  const firstLength = telemetry._test_snapshot().length;
  expect(firstLength).toBeGreaterThanOrEqual(1);
  telemetry._test_reset();
  // After reset, calling track will instantiate and load persisted queue before adding new event
  telemetry.track('persist.extra', {});
  const snap = telemetry._test_snapshot();
  expect(snap.length).toBeGreaterThan(1);
  });
});
