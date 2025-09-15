import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@test-utils';
import React from 'react';

let lastRequestId: string | undefined;
let fetchCallCount = 0;

const mockOps = [
  { id: 'op1', name: 'Oil Change', category: 'MAINTENANCE', subcategory: 'BASIC', is_active: true, internal_code: 'OC', skill_level: null, default_hours: 1, base_labor_rate: 80, keywords: ['oil'], display_order: 1 },
];

beforeEach(() => {
  fetchCallCount = 0;
  lastRequestId = undefined;
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn(async () => {
    fetchCallCount += 1;
    const rid = '00000000-0000-4000-8000-00000000000' + (fetchCallCount % 10);
    lastRequestId = rid;
    const body = JSON.stringify(mockOps);
    const headers = new Headers({ 'Content-Type': 'application/json', 'X-Request-Id': rid });
    return new Response(body, { status: 200, headers });
  }));
});

describe('telemetry integration: catalog open event correlation', () => {
  it('fires app.catalog_open track and enqueues telemetry event', async () => {
    const { ServiceCatalogModal } = await import('../../components/appointments/ServiceCatalogModal');
    const telemetry = await import('../../services/telemetry');
    const trackSpy = vi.spyOn(telemetry, 'track');

    render(<ServiceCatalogModal open={true} onClose={() => {}} onAdd={() => {}} />);

    await waitFor(() => expect(fetchCallCount).toBeGreaterThan(0));
    const tracked = trackSpy.mock.calls.find(c => c[0] === 'app.catalog_open');
    expect(tracked).toBeTruthy();
    expect(lastRequestId).toBeTruthy();
    const snapshot = telemetry._test_snapshot();
    const found = snapshot.find(i => i.ev.event === 'app.catalog_open');
    expect(found).toBeTruthy();
  });
});
