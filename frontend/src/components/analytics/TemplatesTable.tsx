import React, { useState, useMemo } from 'react';
import type { TemplateAnalyticsTemplate, TemplateSlicePoint } from '../../types/analytics';
import { LineChart, Line } from 'recharts';

interface TemplatesTableProps {
  templates: TemplateAnalyticsTemplate[];
}

type SortKey = 'totalCount' | 'uniqueUsers';
interface SortState { key: SortKey; dir: 'asc' | 'desc' }

const Sparkline: React.FC<{ points: TemplateSlicePoint[] }> = ({ points }) => {
  if (!points || points.length === 0) return <div className="text-[10px] text-gray-400">—</div>;
  return (
    <LineChart width={100} height={32} data={points} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
      <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={1.5} dot={false} isAnimationActive={false} />
    </LineChart>
  );
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

const TemplatesTable: React.FC<TemplatesTableProps> = ({ templates }) => {
  const [sort, setSort] = useState<SortState>({ key: 'totalCount', dir: 'desc' });

  const onSort = (key: SortKey) => {
    setSort(curr => curr.key === key ? { key, dir: curr.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  };

  const sorted = useMemo(() => {
    const arr = [...templates];
    arr.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === bv) return 0;
      return sort.dir === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [templates, sort]);

  const sortIndicator = (key: SortKey) => {
    if (sort.key !== key) return <span className="opacity-30">↕</span>;
    return <span>{sort.dir === 'asc' ? '↑' : '↓'}</span>;
  };

  const ariaSort = (key: SortKey): 'ascending' | 'descending' | 'none' => {
    if (sort.key !== key) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <div className="border rounded bg-white shadow-sm" data-testid="templates-table">
      <div className="px-4 py-2 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Templates</h3>
        <div className="text-[11px] text-gray-400">{templates.length} total</div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="text-left font-medium px-3 py-2">Name</th>
              <th className="text-left font-medium px-3 py-2">Channel</th>
              <th className="text-right font-medium px-3 py-2 cursor-pointer select-none" onClick={() => onSort('totalCount')} aria-sort={ariaSort('totalCount')}>
                <span className="inline-flex items-center gap-1">Total Sent {sortIndicator('totalCount')}</span>
              </th>
              <th className="text-right font-medium px-3 py-2 cursor-pointer select-none" onClick={() => onSort('uniqueUsers')} aria-sort={ariaSort('uniqueUsers')}>
                <span className="inline-flex items-center gap-1">Unique Users {sortIndicator('uniqueUsers')}</span>
              </th>
              <th className="text-left font-medium px-3 py-2">Last Used</th>
              <th className="text-left font-medium px-3 py-2">Recent Trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(t => (
              <tr key={t.templateId} className="border-t hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{t.name}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap uppercase text-[11px]">{t.channel}</td>
                <td className="px-3 py-2 text-right tabular-nums">{t.totalCount}</td>
                <td className="px-3 py-2 text-right tabular-nums">{t.uniqueUsers}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatDate(t.lastUsedAt)}</td>
                <td className="px-3 py-1">
                  <Sparkline points={t.trendSlice} />
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500 text-sm">No template usage in range.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TemplatesTable;
