import React from 'react';
import { Calendar, Clock, User, Phone } from 'lucide-react';
import { isWithin, minutesPast } from '../../lib/time';

// Use the UIAppointment interface from Dashboard
interface UIAppointment {
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
  reminderStatus: 'pending' | 'sent' | 'failed';
}

interface TodaysScheduleProps {
  appointments: UIAppointment[];
}

export default function TodaysSchedule({ appointments }: TodaysScheduleProps) {

  // Get status indicators
  const getStatusInfo = (appointment: UIAppointment) => {
    const isSoon = isWithin(appointment.dateTime, 30);
    const minutes_past = minutesPast(appointment.dateTime);
    const isLate = minutes_past > 5 && minutes_past <= 30;
    const isOverdue = minutes_past > 30;

    if (isOverdue) return { label: 'Overdue', color: 'text-red-600 bg-red-50', priority: 3 };
    if (isLate) return { label: 'Running Late', color: 'text-amber-600 bg-amber-50', priority: 2 };
    if (isSoon) return { label: 'Starting Soon', color: 'text-orange-600 bg-orange-50', priority: 1 };
    return { label: 'Scheduled', color: 'text-blue-600 bg-blue-50', priority: 0 };
  };

  // Sort appointments by priority, then by time
  const sortedAppointments = [...appointments]
    .slice(0, 5)
    .sort((a, b) => {
      const statusA = getStatusInfo(a);
      const statusB = getStatusInfo(b);
      
      // First sort by priority (urgent first)
      if (statusA.priority !== statusB.priority) {
        return statusB.priority - statusA.priority;
      }
      
      // Then sort by time
      return a.dateTime.getTime() - b.dateTime.getTime();
    });

  return (
    <div className="space-y-sp-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-sp-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          <h3 className="text-fs-4 font-semibold text-gray-900">Today's Schedule</h3>
        </div>
        <div className="text-fs-1 text-gray-500">
          {appointments.length} appointments
        </div>
      </div>

      {/* Appointments List */}
      {sortedAppointments.length > 0 ? (
        <div className="space-y-sp-2">
          {sortedAppointments.map((appointment) => {
            const statusInfo = getStatusInfo(appointment);
            
            return (
              <div
                key={appointment.id}
                className={`p-sp-3 rounded-lg border transition-all duration-200 hover:shadow-sm ${
                  statusInfo.priority > 1 ? 'border-red-200 bg-red-50' :
                  statusInfo.priority === 1 ? 'border-orange-200 bg-orange-50' :
                  'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* Left side - Time and customer */}
                  <div className="flex items-center gap-sp-3">
                    <div className="text-fs-3 font-semibold text-gray-900">
                      {appointment.timeSlot}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-sp-2">
                        <User className="h-3 w-3 text-gray-500" />
                        <span className="text-fs-2 font-medium text-gray-900">
                          {appointment.customer}
                        </span>
                      </div>
                      <div className="text-fs-1 text-gray-600">
                        {appointment.service}
                      </div>
                    </div>
                  </div>
                  
                  {/* Right side - Status and actions */}
                  <div className="flex items-center gap-sp-2">
                    {appointment.phone && (
                      <button 
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title={`Call ${appointment.customer}`}
                      >
                        <Phone className="h-3 w-3" />
                      </button>
                    )}
                    
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                </div>
                
                {/* Additional info row */}
                {(appointment.vehicle || appointment.estimatedDuration) && (
                  <div className="mt-sp-2 flex items-center gap-sp-4 text-fs-1 text-gray-500">
                    {appointment.vehicle && (
                      <span>{appointment.vehicle}</span>
                    )}
                    {appointment.estimatedDuration && (
                      <div className="flex items-center gap-sp-1">
                        <Clock className="h-3 w-3" />
                        <span>{appointment.estimatedDuration}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-sp-6 text-gray-500">
          <Calendar className="h-8 w-8 mx-auto mb-sp-2 text-gray-300" />
          <p className="text-fs-2">No appointments scheduled for today</p>
        </div>
      )}

      {/* View all link */}
      {appointments.length > 5 && (
        <div className="text-center pt-sp-2 border-t border-gray-200">
          <button className="text-fs-2 text-blue-600 hover:text-blue-700 font-medium transition-colors">
            View all {appointments.length} appointments →
          </button>
        </div>
      )}
    </div>
  );
}
