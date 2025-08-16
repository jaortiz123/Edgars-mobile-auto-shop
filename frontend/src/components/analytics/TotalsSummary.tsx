import React from 'react';
import type { TemplateAnalyticsTotals } from '../../types/analytics';

interface TotalsSummaryProps {
  totals: TemplateAnalyticsTotals;
}

const StatCard: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode }> = ({ label, value, sub }) => (
  <div className="rounded border p-3 bg-white shadow-sm flex flex-col gap-1 min-w-[140px]" data-testid={`stat-${label.replace(/\s+/g,'-').toLowerCase()}`}>
    <div className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">{label}</div>
    <div className="text-lg font-semibold leading-tight">{value}</div>
    {sub && <div className="text-[11px] text-gray-400 leading-tight">{sub}</div>}
  </div>
);

export const TotalsSummary: React.FC<TotalsSummaryProps> = ({ totals }) => {
  const sms = totals.byChannel['sms'];
  const email = totals.byChannel['email'];
  return (
    <div className="flex flex-wrap gap-3" data-testid="totals-summary">
      <StatCard label="Total Messages" value={totals.events} />
      <StatCard label="Unique Templates" value={totals.uniqueTemplates} />
      <StatCard label="Unique Users" value={totals.uniqueUsers} />
      <StatCard label="Unique Customers" value={totals.uniqueCustomers} />
      <StatCard label="SMS" value={sms ? sms.events : 0} sub={sms ? `${Math.round(sms.pct * 100)}%` : '—'} />
      <StatCard label="Email" value={email ? email.events : 0} sub={email ? `${Math.round(email.pct * 100)}%` : '—'} />
    </div>
  );
};

export default TotalsSummary;
