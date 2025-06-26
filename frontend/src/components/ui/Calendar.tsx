import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface CalendarProps {
  selected?: Date;
  onSelect?: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

export function Calendar({ 
  selected, 
  onSelect, 
  minDate = new Date(),
  maxDate,
  className = '' 
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selected || new Date());
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  
  const daysInMonth = lastDayOfMonth.getDate();
  const daysFromPrevMonth = firstDayOfWeek;
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(currentMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(currentMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };
  
  const handleDateClick = (day: number) => {
    const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    selectedDate.setHours(0, 0, 0, 0);
    
    // Check if date is in valid range
    if (minDate && selectedDate < minDate) return;
    if (maxDate && selectedDate > maxDate) return;
    
    onSelect?.(selectedDate);
  };
  
  const isDateDisabled = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    
    return false;
  };
  
  const isDateSelected = (day: number) => {
    if (!selected) return false;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    selected.setHours(0, 0, 0, 0);
    return date.getTime() === selected.getTime();
  };
  
  const isToday = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    return date.getTime() === today.getTime();
  };
  
  const renderCalendarDays = () => {
    const days = [];
    
    // Previous month's trailing days
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 0);
    for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
      const day = prevMonth.getDate() - i;
      days.push(
        <button
          key={`prev-${day}`}
          className="w-10 h-10 text-text-disabled hover:text-text-secondary transition-colors"
          disabled
        >
          {day}
        </button>
      );
    }
    
    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const disabled = isDateDisabled(day);
      const selected = isDateSelected(day);
      const isCurrentDay = isToday(day);
      
      days.push(
        <button
          key={day}
          onClick={() => handleDateClick(day)}
          disabled={disabled}
          className={`w-10 h-10 rounded-md text-sm font-medium transition-all duration-200 ${
            selected
              ? 'bg-brand-primary text-white ring-2 ring-brand-primary ring-offset-2'
              : disabled
              ? 'text-text-disabled cursor-not-allowed'
              : isCurrentDay
              ? 'bg-brand-secondary/10 text-brand-secondary font-bold ring-2 ring-brand-secondary/20'
              : 'text-text-primary hover:bg-ui-hover hover:text-brand-primary'
          }`}
        >
          {day}
        </button>
      );
    }
    
    return days;
  };
  
  return (
    <div className={`bg-ui-surface border border-ui-border rounded-xl p-6 shadow-sm ${className}`}>
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateMonth('prev')}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <h3 className="text-lg font-semibold text-text-primary">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateMonth('next')}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Day Names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map(day => (
          <div key={day} className="text-center text-xs font-medium text-text-secondary py-2">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {renderCalendarDays()}
      </div>
    </div>
  );
}
