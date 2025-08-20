import React, { useEffect, useState } from 'react';

interface EfficiencyRow {
  total: number;
  hits_304: number;
  efficiency_pct: number | null;
}
interface ApiResponse { routes: Record<string, EfficiencyRow>; }

export default function CacheEfficiencyPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/metrics/304-efficiency');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
  } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 30000); // refresh every 30s
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="space-y-4 p-4" data-testid="cache-efficiency-page">
      <h1 className="text-xl font-semibold">304 Efficiency</h1>
      <p className="text-sm text-gray-600">Target ≥ 60% conditional GETs returning 304 (rolling window).</p>
      {loading && <div data-testid="loading">Loading...</div>}
      {error && <div className="text-red-600 text-sm" data-testid="error">{error}</div>}
      {data && (
        <table className="min-w-[400px] text-sm border" data-testid="eff-table">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2 border-b">Route</th>
              <th className="text-right p-2 border-b">Total</th>
              <th className="text-right p-2 border-b">304</th>
              <th className="text-right p-2 border-b">Efficiency %</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.routes).map(([route, row]) => {
              const pct = row.efficiency_pct == null ? '—' : row.efficiency_pct.toFixed(2);
              const good = row.efficiency_pct != null && row.efficiency_pct >= 60;
              return (
                <tr key={route} className={good ? 'bg-green-50' : ''} data-testid={`row-${route}`}>
                  <td className="p-2 border-b font-mono text-xs">{route}</td>
                  <td className="p-2 border-b text-right">{row.total}</td>
                  <td className="p-2 border-b text-right">{row.hits_304}</td>
                  <td className={`p-2 border-b text-right font-medium ${good ? 'text-green-700' : 'text-gray-800'}`}>{pct}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
