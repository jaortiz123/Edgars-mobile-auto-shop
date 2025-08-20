import { getTelemetry, _test_snapshot_full, _test_getCounters, _test_resetCounters } from '../../../src/services/telemetry';

// Clean counters + storage but keep singleton (avoids piling intervals from multiple instantiations)
beforeEach(() => {
  _test_resetCounters();
  try { sessionStorage.removeItem('telemetry_queue_v1'); } catch { /* ignore */ }
});
afterEach(() => {
  try { sessionStorage.removeItem('telemetry_queue_v1'); } catch { /* ignore */ }
});

describe('telemetry oversize drop preflight', () => {
  function buildPayload(fieldCount: number, valueLen: number){
    const o: Record<string,string> = {};
    const val = 'x'.repeat(valueLen);
    for (let i=0;i<fieldCount;i++) o['f'+i]=val;
    return o;
  }

  it('drops event >64KB after preflight (hard limit)', () => {
    const client = getTelemetry();
    const bigPayload = buildPayload(1200, 50); // ~72KB
    client.track('oversize_test', bigPayload);
    const snapshot = _test_snapshot_full() as Readonly<{ ev: { event: string } }[]>;
    const counters = _test_getCounters();
    expect(snapshot.some(e => e.ev.event === 'oversize_test')).toBe(false);
    expect(counters['telemetry.drop_oversize']).toBe(1);
  });

  it('keeps event between soft (16KB) and hard (64KB) limits', () => {
    const client = getTelemetry();
    const midPayload = buildPayload(400, 50); // ~24KB
    client.track('mid_oversize', midPayload);
    const snapshot = _test_snapshot_full() as Readonly<{ ev: { event: string } }[]>;
    const counters = _test_getCounters();
    expect(snapshot.some(e => e.ev.event === 'mid_oversize')).toBe(true);
    // Counter remains undefined (no drops this test due to fresh beforeEach)
    expect(counters['telemetry.drop_oversize']).toBeUndefined();
  });
});
