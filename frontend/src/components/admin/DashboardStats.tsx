import React from 'react';
import { useAppointments } from '@/contexts/AppointmentContext';
import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardStats() {
  const { stats, refreshStats } = useAppointments();
  if (!stats) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({length:8}).map((_,i)=>(<Skeleton key={i} className="h-16"/>))}
    </div>
  );
  const items = [
    { label: 'Jobs Today', value: stats.jobsToday, testid: 'kpi-today' },
    { label: 'On Premises', value: stats.carsOnPremises, testid: 'kpi-onprem' },
    { label: 'Scheduled', value: stats.scheduled, testid: 'kpi-scheduled' },
    { label: 'In Progress', value: stats.inProgress, testid: 'kpi-inprogress' },
    { label: 'Ready', value: stats.ready, testid: 'kpi-ready' },
    { label: 'Completed', value: stats.completed, testid: 'kpi-completed' },
    { label: 'No-Show', value: stats.noShow, testid: 'kpi-noshow' },
    { label: 'Unpaid $', value: `$${stats.unpaidTotal.toFixed(2)}`, testid: 'kpi-unpaid' },
  ];
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <button className="text-sm underline" onClick={()=>void refreshStats()}>Refresh</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((it) => (
          <div key={it.label} className="rounded-xl border p-4" data-testid={it.testid}>
            <div className="text-sm text-gray-500">{it.label}</div>
            <div className="mt-1 text-2xl font-semibold">{it.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
