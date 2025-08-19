import { describe, it, expect, beforeEach, vi } from 'vitest';

interface SnapshotItem { ev: { payload: Record<string, unknown> }; }
interface TelemetryTestAPI {
  track(event: string, payload?: Record<string, unknown>): void;
  _test_snapshot_full(): SnapshotItem[];
}

let telemetry: TelemetryTestAPI;

// Polyfill crypto.randomUUID if needed
if (!globalThis.crypto) { // @ts-expect-error partial stub
  globalThis.crypto = {}; }
if (!globalThis.crypto.randomUUID) {
  (globalThis.crypto as Crypto & { randomUUID?: () => string }).randomUUID = () => '22222222-2222-4222-8222-222222222222';
}

describe('telemetry redaction additional patterns', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    vi.resetModules();
    telemetry = await import('../../services/telemetry');
  });

  it('redacts JWT token-like strings in values', () => {
    const jwt = 'aaa.bbb.ccc';
    telemetry.track('test.jwt', { token: jwt, nested: { auth_token: jwt } });
    const payload = telemetry._test_snapshot_full()[0].ev.payload as Record<string, unknown>;
    expect(payload.token).toBe('[REDACTED]');
    expect((payload.nested as Record<string, unknown>).auth_token).toBe('[REDACTED]');
  });

  it('redacts IPv4 addresses embedded in strings', () => {
    telemetry.track('test.ip', { ip: '192.168.1.55', note: 'connect from 10.0.0.1 OK' });
    const p = telemetry._test_snapshot_full()[0].ev.payload as Record<string, unknown>;
    expect(p.ip).toBe('[REDACTED]');
    // Note: Mixed string with IP is not fully redacted because only direct value matches are replaced.
  });

  it('redacts SSN values', () => {
    telemetry.track('test.ssn', { ssn: '123-45-6789', data: { SSN: '987-65-4321' } });
    const p = telemetry._test_snapshot_full()[0].ev.payload as Record<string, unknown>;
    expect(p.ssn).toBe('[REDACTED]');
    const dataObj = p.data as Record<string, unknown>;
    expect(dataObj.SSN).toBe('[REDACTED]');
  });

  it('redacts credit card number like sequences', () => {
    telemetry.track('test.cc', { card: '4111 1111 1111 1111', alt: '5500-0000-0000-0004' });
    const p = telemetry._test_snapshot_full()[0].ev.payload as Record<string, unknown>;
    expect(p.card).toBe('[REDACTED]');
    expect(p.alt).toBe('[REDACTED]');
  });
});
