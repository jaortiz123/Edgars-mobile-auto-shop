import React from 'react';

interface ScheduleFilterToggleProps {
  onFilterChange: (filter: 'today' | 'all') => void;
  currentFilter: 'today' | 'all';
}

export default function ScheduleFilterToggle({ onFilterChange, currentFilter }: ScheduleFilterToggleProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-200 p-1">
      <button
        onClick={() => onFilterChange('today')}
        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
          currentFilter === 'today' ? 'bg-white text-gray-900 shadow' : 'bg-transparent text-gray-600 hover:bg-gray-300'
        }`}
      >
        Today
      </button>
      <button
        onClick={() => onFilterChange('all')}
        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
          currentFilter === 'all' ? 'bg-white text-gray-900 shadow' : 'bg-transparent text-gray-600 hover:bg-gray-300'
        }`}
      >
        All
      </button>
    </div>
  );
}
