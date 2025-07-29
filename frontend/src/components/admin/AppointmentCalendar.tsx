import React, { useState } from 'react';
import { format, startOfWeek, addDays, isSameDay, addWeeks, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth } from 'date-fns';
import { parseDurationToMinutes } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Bell } from 'lucide-react';

interface Appointment {
  id: string;
  customer: string;
  vehicle: string;
  service: string;
  timeSlot: string;
  dateTime: Date;
  status: 'scheduled' | 'in-progress' | 'completed' | 'canceled';
  phone?: string;
  address?: string;
  estimatedDuration?: string;
  reminderStatus?: 'sent' | 'failed' | 'pending';
}

interface AppointmentCalendarProps {
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  onAddAppointment?: () => void;
  onStartJob?: (appointmentId: string) => void;
  onCompleteJob?: (appointmentId: string) => void;
  onCallCustomer?: (phone: string) => void;
}

export const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({ 
  appointments,
  onAppointmentClick,
  onAddAppointment,
  onStartJob,
  onCompleteJob,
  onCallCustomer
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  
  // Generate days for week view
  const startOfTheWeek = startOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startOfTheWeek, i));
  
  // Generate days for month view
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Get appointments for current day
  const dayAppointments = appointments.filter(apt => 
    isSameDay(apt.dateTime, currentDate)
  ).sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

  // Get appointments count for a specific day
  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter(apt => isSameDay(apt.dateTime, day));
  };

  // Calculate appointment end time based on duration
  const getAppointmentEndTime = (appointment: Appointment): Date => {
    const startTime = appointment.dateTime;
    const durationMinutes = parseDurationToMinutes(appointment.estimatedDuration || '1 hour');
    return new Date(startTime.getTime() + durationMinutes * 60000);
  };

  // Navigation functions
  const goToPrevious = () => {
    if (view === 'day') {
      setCurrentDate(prev => addDays(prev, -1));
    } else if (view === 'week') {
      setCurrentDate(prev => addWeeks(prev, -1));
    } else if (view === 'month') {
      setCurrentDate(prev => addMonths(prev, -1));
    }
  };

  const goToNext = () => {
    if (view === 'day') {
      setCurrentDate(prev => addDays(prev, 1));
    } else if (view === 'week') {
      setCurrentDate(prev => addWeeks(prev, 1));
    } else if (view === 'month') {
      setCurrentDate(prev => addMonths(prev, 1));
    }
  };

  const getStatusBg = (status: string) => {
    switch(status) {
      case 'completed': return 'bg-green-100 border-l-4 border-green-500';
      case 'in-progress': return 'bg-blue-100 border-l-4 border-blue-500';
      case 'canceled': return 'bg-red-100 border-l-4 border-red-500';
      default: return 'bg-orange-100 border-l-4 border-orange-500';
    }
  };

  const hasConflict = (appointmentsToCheck: Appointment[]): boolean => {
    for (let i = 0; i < appointmentsToCheck.length; i++) {
      for (let j = i + 1; j < appointmentsToCheck.length; j++) {
        const apt1 = appointmentsToCheck[i];
        const apt2 = appointmentsToCheck[j];

        const start1 = apt1.dateTime.getTime();
        const end1 = getAppointmentEndTime(apt1).getTime();
        const start2 = apt2.dateTime.getTime();
        const end2 = getAppointmentEndTime(apt2).getTime();

        // Check for overlap
        if (Math.max(start1, start2) < Math.min(end1, end2)) {
          return true; // Conflict found
        }
      }
    }
    return false; // No conflicts
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">📅 Today's Schedule</h2>
        <div className="flex space-x-2">
          <Button 
            onClick={() => setView('day')}
            variant={view === 'day' ? 'info' : 'secondary'}
            size="sm"
          >
            📋 Day View
          </Button>
          <Button 
            onClick={() => setView('week')}
            variant={view === 'week' ? 'info' : 'secondary'}
            size="sm"
          >
            📆 Week View
          </Button>
          <Button 
            onClick={() => setView('month')}
            variant={view === 'month' ? 'info' : 'secondary'}
            size="sm"
          >
            🗓️ Month View
          </Button>
        </div>
      </div>

      {/* Date navigation */}
      <div className="flex justify-between items-center mb-6 bg-gray-50 rounded-lg p-4">
        <Button 
          onClick={goToPrevious}
          variant="outline"
          size="sm"
        >
          <span className="text-base mr-2">←</span>
          <span className="font-medium">Previous</span>
        </Button>
        
        <h3 className="text-lg font-bold text-gray-900">
          {view === 'day' && format(currentDate, 'EEEE, MMMM d, yyyy')}
          {view === 'week' && `Week of ${format(startOfTheWeek, 'MMMM d, yyyy')}`}
          {view === 'month' && format(currentDate, 'MMMM yyyy')}
        </h3>
        
        <Button 
          onClick={goToNext}
          variant="outline"
          size="sm"
        >
          <span className="font-medium text-base">Next</span>
          <span className="text-lg ml-2">→</span>
        </Button>
      </div>

      {/* Day View */}
      {view === 'day' && (
        <div className="space-y-4">
          {dayAppointments.length > 0 ? (
            <div className="space-y-3">
              {dayAppointments.map(appointment => (
                <div 
                  key={appointment.id}
                  data-testid={`calendar-tile-${appointment.id}`}
                  className="flex flex-col p-3 border-b border-gray-200 last:border-b-0 hover:shadow-md cursor-pointer transition-all duration-200 hover:border-blue-300"
                  onClick={() => onAppointmentClick(appointment)}
                >
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-lg font-bold text-gray-800">{appointment.timeSlot}</div>
                    <div className="flex items-center gap-2">
                      {appointment.reminderStatus && (
                        <Bell className={`h-4 w-4 ${
                          appointment.reminderStatus === 'sent' ? 'text-green-500' :
                          appointment.reminderStatus === 'failed' ? 'text-red-500' :
                          'text-gray-400'
                        }`} />
                      )}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                        appointment.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                        appointment.status === 'canceled' ? 'bg-red-100 text-red-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {appointment.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="text-base font-semibold text-gray-900">{appointment.customer}</div>
                  <div className="text-sm text-gray-600">{appointment.vehicle} | {appointment.phone}</div>
                  <Badge variant="outline">{appointment.service}</Badge>
                  <div className="flex justify-end mt-2 space-x-2">
                    {appointment.status === 'scheduled' && onStartJob && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartJob(appointment.id);
                        }}
                        className="px-3 py-1 rounded-lg text-sm bg-yellow-500 text-white hover:bg-yellow-600"
                      >
                        Start Job
                      </button>
                    )}
                    {appointment.status === 'in-progress' && onCompleteJob && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onCompleteJob(appointment.id);
                        }}
                        className="px-3 py-1 rounded-lg text-sm bg-green-500 text-white hover:bg-green-600"
                      >
                        Complete
                      </button>
                    )}
                    {appointment.phone && onCallCustomer && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onCallCustomer(appointment.phone!);
                        }}
                        className="px-3 py-1 rounded-lg text-sm border border-gray-300 hover:bg-gray-50"
                      >
                        Call
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center bg-gray-50 rounded-xl">
              <div className="text-6xl mb-4">🛠️</div>
              <p className="text-lg font-medium text-gray-600 mb-4">Today is open - Schedule a service</p>
              <p className="text-gray-500 mb-6">Looks like you have a free day!</p>
              <button 
                onClick={onAddAppointment}
                className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors shadow-sm"
              >
                ➕ Add New Appointment
              </button>
            </div>
          )}
        </div>
      )}

      {/* Week View */}
      {view === 'week' && (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-2 min-w-[800px]">
            {weekDays.map(day => {
              const dayAppointments = appointments
                .filter(apt => isSameDay(apt.dateTime, day))
                .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
              
              return (
                <div key={day.toString()} className={`border rounded-lg overflow-hidden flex flex-col ${hasConflict(dayAppointments) ? 'border-red-500 ring-2 ring-red-500' : ''}`}>
                  <div className={`py-3 font-bold text-center text-sm ${
                    isSameDay(day, new Date()) 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {format(day, 'EEE')}
                    <br />
                    <span className="text-lg">{format(day, 'd')}</span>
                  </div>
                  <div className="p-2 space-y-1 flex-1 min-h-[120px] relative">
                    {dayAppointments.length > 0 ? (
                      dayAppointments.map(apt => (
                        <div 
                          key={apt.id}
                          onClick={() => onAppointmentClick(apt)}
                          className={`w-full p-1 text-xs rounded cursor-pointer hover:shadow-sm transition-shadow mb-1 ${getStatusBg(apt.status)}`}
                        >
                          <div className="font-bold text-sm">{format(apt.dateTime, 'h:mm a')}</div>
                          <div className="font-medium truncate">{apt.customer}</div>
                          <div className="text-gray-600 truncate">{apt.service}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-400 py-4 text-xs">
                        No appointments
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Month View */}
      {view === 'month' && (
        <div className="bg-white rounded-lg border">
          {/* Calendar Header */}
          <div className="grid grid-cols-7 border-b">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-3 text-center font-semibold text-gray-600 bg-gray-50">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Body */}
          <div className="grid grid-cols-7">
            {/* Add empty cells for days before month start */}
            {Array.from({ length: monthStart.getDay() }).map((_, index) => (
              <div key={`empty-${index}`} className="h-24 border-b border-r border-gray-200"></div>
            ))}
            
            {/* Month days */}
            {monthDays.map(day => {
              const dayAppointments = getAppointmentsForDay(day);
              const appointmentCount = dayAppointments.length;
              
              return (
                <div
                  key={day.toString()}
                  className={`h-24 border-b border-r border-gray-200 p-2 cursor-pointer transition-colors hover:bg-blue-50 relative group ${
                    isToday(day) ? 'bg-blue-100' : ''
                  } ${
                    !isSameMonth(day, currentDate) ? 'bg-gray-50 text-gray-400' : ''
                  }`}
                  onClick={() => {
                    setCurrentDate(day);
                    setView('day');
                  }}
                >
                  <div className="flex flex-col h-full">
                    <div className={`text-sm font-medium ${isToday(day) ? 'text-blue-700' : ''}`}>
                      {format(day, 'd')}
                    </div>
                    
                    {appointmentCount > 0 && (
                      <div className="flex-1 flex items-center justify-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {appointmentCount}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Hover tooltip */}
                  {appointmentCount > 0 && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                        {appointmentCount === 1 
                          ? '1 appointment' 
                          : `${appointmentCount} appointments`
                        }
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <div className="mt-6 flex justify-center">
        <Button 
          onClick={onAddAppointment}
          variant="primary"
          size="lg"
        >
          ➕ Add New Appointment
        </Button>
      </div>
    </div>
  );
};
