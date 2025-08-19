// Sprint 2B T1-T4: Smart Today View with filtering, highlighting, urgency, and alerts
import React, { useState, useMemo, useCallback } from 'react';
import { Calendar, List, Users, Clock } from 'lucide-react';
import ScheduleFilterToggle, { ScheduleFilter } from './ScheduleFilterToggle';
import ScheduleItem from './ScheduleItem';

interface Appointment {
  id: string;
  customer_name: string;
  customer_phone?: string;
  service: string;
  requested_time: string;
  scheduled_at?: string;
  status: string;
  location_address?: string;
  notes?: string;
  price?: number;
}

interface ScheduleViewProps {
  appointments: Appointment[];
  onAppointmentClick?: (appointment: Appointment) => void;
  title?: string;
}

// Helper function to safely parse date
const parseDate = (dateString: string): Date => {
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? new Date() : date;
  } catch {
    return new Date();
  }
};

// Helper function to calculate urgency priority
const getUrgencyPriority = (time: Date, todayStr: string): number => {
  try {
    const now = new Date();
    const diffMinutes = (time.getTime() - now.getTime()) / (1000 * 60);

    if (diffMinutes < -30) return 4; // Overdue
    if (diffMinutes < -5) return 3;  // Running late
    if (diffMinutes <= 30 && diffMinutes > 0) return 2; // Starting soon
    if (time.toDateString() === todayStr) return 1; // Today
    return 0; // Normal
  } catch {
    return 0;
  }
};

export default function ScheduleView({
  appointments,
  onAppointmentClick,
  title = "Schedule View"
}: ScheduleViewProps) {
  const [activeFilter, setActiveFilter] = useState<ScheduleFilter>('today');

  // Memoize today's date string to prevent recalculation
  const todayStr = useMemo(() => new Date().toDateString(), []);

  // Memoized appointment processing with error handling
  const { filteredAppointments, todayCount, allCount } = useMemo(() => {
    try {
      // Validate appointments array
      if (!Array.isArray(appointments)) {
        console.warn('Invalid appointments data:', appointments);
        return { filteredAppointments: [], todayCount: 0, allCount: 0 };
      }

      const todayAppointments = appointments.filter(apt => {
        try {
          const aptDate = parseDate(apt.scheduled_at || apt.requested_time);
          return aptDate.toDateString() === todayStr;
        } catch {
          return false;
        }
      });

      const filtered = activeFilter === 'today' ? todayAppointments : appointments;

      // Sort by urgency priority, then by time
      const sorted = [...filtered].sort((a, b) => {
        try {
          const timeA = parseDate(a.scheduled_at || a.requested_time);
          const timeB = parseDate(b.scheduled_at || b.requested_time);

          const priorityA = getUrgencyPriority(timeA, todayStr);
          const priorityB = getUrgencyPriority(timeB, todayStr);

          // Sort by priority first (higher priority first)
          if (priorityA !== priorityB) {
            return priorityB - priorityA;
          }

          // Then by time (chronological)
          return timeA.getTime() - timeB.getTime();
        } catch {
          return 0;
        }
      });

      return {
        filteredAppointments: sorted,
        todayCount: todayAppointments.length,
        allCount: appointments.length
      };
    } catch (error) {
      console.error('Error processing appointments:', error);
      return { filteredAppointments: [], todayCount: 0, allCount: 0 };
    }
  }, [appointments, activeFilter, todayStr]);

  // Memoized urgent appointments count
  const urgentCount = useMemo(() => {
    try {
      const now = new Date();
      return filteredAppointments.filter(apt => {
        try {
          const time = parseDate(apt.scheduled_at || apt.requested_time);
          const diffMinutes = (time.getTime() - now.getTime()) / (1000 * 60);
          return diffMinutes < -5 || (diffMinutes <= 30 && diffMinutes > 0);
        } catch {
          return false;
        }
      }).length;
    } catch {
      return 0;
    }
  }, [filteredAppointments]);

  // Memoized statistics calculations
  const statistics = useMemo(() => {
    try {
      const now = new Date();

      const startingSoon = filteredAppointments.filter(apt => {
        try {
          const time = parseDate(apt.scheduled_at || apt.requested_time);
          const diffMinutes = (time.getTime() - now.getTime()) / (1000 * 60);
          return diffMinutes <= 30 && diffMinutes > 0;
        } catch {
          return false;
        }
      }).length;

      const runningLate = filteredAppointments.filter(apt => {
        try {
          const time = parseDate(apt.scheduled_at || apt.requested_time);
          const diffMinutes = (time.getTime() - now.getTime()) / (1000 * 60);
          return diffMinutes < -5 && diffMinutes >= -30;
        } catch {
          return false;
        }
      }).length;

      const overdue = filteredAppointments.filter(apt => {
        try {
          const time = parseDate(apt.scheduled_at || apt.requested_time);
          const diffMinutes = (time.getTime() - now.getTime()) / (1000 * 60);
          return diffMinutes < -30;
        } catch {
          return false;
        }
      }).length;

      return { startingSoon, runningLate, overdue };
    } catch {
      return { startingSoon: 0, runningLate: 0, overdue: 0 };
    }
  }, [filteredAppointments]);

  // Memoized filter change handler
  const handleFilterChange = useCallback((filter: ScheduleFilter) => {
    setActiveFilter(filter);
  }, []);

  // Memoized appointment click handler
  const handleAppointmentClick = useCallback((appointment: Appointment) => {
    try {
      onAppointmentClick?.(appointment);
    } catch (error) {
      console.error('Error handling appointment click:', error);
    }
  }, [onAppointmentClick]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            <p className="text-gray-600">
              {filteredAppointments.length} appointments
              {urgentCount > 0 && (
                <span className="ml-2 text-amber-600 font-medium">
                  • {urgentCount} need attention
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Filter Toggle */}
        <ScheduleFilterToggle
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          todayCount={todayCount}
          allCount={allCount}
        />
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold">{filteredAppointments.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Starting Soon</p>
              <p className="text-2xl font-bold">{statistics.startingSoon}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Running Late</p>
              <p className="text-2xl font-bold">{statistics.runningLate}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Users className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Overdue</p>
              <p className="text-2xl font-bold">{statistics.overdue}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <List className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {activeFilter === 'today' ? "Today's Appointments" : 'All Appointments'}
            </h3>
          </div>
        </div>

        <div className="p-4">
          {filteredAppointments.length > 0 ? (
            <div className="space-y-3">
              {filteredAppointments.map((appointment) => {
                const isToday = parseDate(appointment.scheduled_at || appointment.requested_time)
                  .toDateString() === todayStr;

                return (
                  <ScheduleItem
                    key={appointment.id}
                    appointment={appointment}
                    isToday={isToday}
                    onClick={() => handleAppointmentClick(appointment)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                No appointments found
              </h4>
              <p className="text-gray-600">
                {activeFilter === 'today'
                  ? "There are no appointments scheduled for today."
                  : "No appointments to display."
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
