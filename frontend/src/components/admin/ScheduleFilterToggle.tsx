// Sprint 2B T1: Enhanced Filter Toggle Component for Today vs All appointments
import React from 'react';
import { Calendar, Clock } from 'lucide-react';

export type ScheduleFilter = 'today' | 'all';

interface ScheduleFilterToggleProps {
  activeFilter: ScheduleFilter;
  onFilterChange: (filter: ScheduleFilter) => void;
  todayCount?: number;
  allCount?: number;
}

export default function ScheduleFilterToggle({ 
  activeFilter, 
  onFilterChange, 
  todayCount = 0, 
  allCount = 0 
}: ScheduleFilterToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex border border-gray-300 rounded-lg bg-white overflow-hidden" role="group" aria-label="Schedule filter options">
        <button
          onClick={() => onFilterChange('today')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200 ${
            activeFilter === 'today'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
          aria-pressed={activeFilter === 'today' ? 'true' : 'false'}
          aria-describedby="today-filter-desc"
        >
          <Clock className="h-4 w-4" />
          Today
          {todayCount > 0 && (
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
              activeFilter === 'today' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}>
              {todayCount}
            </span>
          )}
        </button>
        
        <button
          onClick={() => onFilterChange('all')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200 ${
            activeFilter === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
          aria-pressed={activeFilter === 'all' ? 'true' : 'false'}
          aria-describedby="all-filter-desc"
        >
          <Calendar className="h-4 w-4" />
          All
          {allCount > 0 && (
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
              activeFilter === 'all' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}>
              {allCount}
            </span>
          )}
        </button>
      </div>
      
      <div className="text-sm text-gray-500">
        <span id="today-filter-desc" className="sr-only">Show only today's appointments</span>
        <span id="all-filter-desc" className="sr-only">Show all appointments</span>
        {activeFilter === 'today' ? "Today's schedule" : 'All appointments'}
      </div>
    </div>
  );
}
