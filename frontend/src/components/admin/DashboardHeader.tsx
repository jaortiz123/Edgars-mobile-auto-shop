import React from 'react';
import NotificationCenter from '@/components/admin/NotificationCenter';
import Clock from '@/components/admin/Clock';
import type { ViewMode } from '@lib/prefs';

interface Props {
  greeting: string;
  dateText: string;
  timeText: string; // kept for compatibility but unused now
  view: ViewMode;
  onSelectView: (view: ViewMode) => void;
}

export default function DashboardHeader({ greeting, dateText, /* timeText */ view, onSelectView }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-sp-3">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Edgar's Shop Dashboard</h1>
        <p className="text-lg font-medium text-gray-600 mt-1">{greeting}, Edgar • {dateText}</p>
      </div>
      <div className="flex items-center gap-sp-3">
        <NotificationCenter />
        <Clock />
        <div className="flex items-center gap-sp-2">
          <button
            data-testid="toggle-calendar"
            onClick={() => onSelectView('calendar')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectView('calendar'); }
            }}
            aria-label="Switch to calendar view"
            className={`px-4 py-2 rounded-lg shadow font-semibold transition-colors ${view === 'calendar' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50'}`}
            data-pressed={view === 'calendar' ? 'true' : 'false'}
          >
            Calendar
          </button>
          <button
            data-testid="toggle-board"
            onClick={() => onSelectView('board')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectView('board'); }
            }}
            aria-label="Switch to board view"
            className={`px-4 py-2 rounded-lg shadow font-semibold transition-colors ${view === 'board' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50'}`}
            data-pressed={view === 'board' ? 'true' : 'false'}
          >
            Board
          </button>
        </div>
      </div>
    </div>
  );
}
