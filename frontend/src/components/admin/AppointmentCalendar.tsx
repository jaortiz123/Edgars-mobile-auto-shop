import React, { useState } from 'react';
import { format, startOfWeek, addDays, isSameDay, addHours } from 'date-fns';

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
  const [view, setView] = useState<'day' | 'week'>('day');
  
  // Generate days for week view
  const startOfTheWeek = startOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startOfTheWeek, i));
  
  const dayAppointments = appointments.filter(apt => 
    isSameDay(apt.dateTime, currentDate)
  ).sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return 'bg-green-500';
      case 'in-progress': return 'bg-yellow-500';
      case 'canceled': return 'bg-gray-300';
      default: return 'bg-blue-500';
    }
  };

  const getStatusBg = (status: string) => {
    switch(status) {
      case 'completed': return 'bg-green-100 border-l-4 border-green-500';
      case 'in-progress': return 'bg-yellow-100 border-l-4 border-yellow-500';
      case 'canceled': return 'bg-gray-100 border-l-4 border-gray-300';
      default: return 'bg-blue-100 border-l-4 border-blue-500';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">📅 Today's Schedule</h2>
        <div className="flex space-x-2">
          <button 
            onClick={() => setView('day')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'day' 
                ? 'bg-blue-500 text-white shadow-sm' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📋 Day View
          </button>
          <button 
            onClick={() => setView('week')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'week' 
                ? 'bg-blue-500 text-white shadow-sm' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📆 Week View
          </button>
        </div>
      </div>

      {/* Date navigation */}
      <div className="flex justify-between items-center mb-6 bg-gray-50 rounded-lg p-4">
        <button 
          className="flex items-center px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
          onClick={() => setCurrentDate(prev => addDays(prev, -1))}
        >
          <span className="text-lg mr-2">←</span>
          <span className="font-medium">Previous</span>
        </button>
        
        <h3 className="text-xl font-bold text-gray-900">
          {format(currentDate, 'EEEE, MMMM d, yyyy')}
        </h3>
        
        <button 
          className="flex items-center px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
          onClick={() => setCurrentDate(prev => addDays(prev, 1))}
        >
          <span className="font-medium">Next</span>
          <span className="text-lg ml-2">→</span>
        </button>
      </div>

      {/* Day View */}
      {view === 'day' && (
        <div className="space-y-4">
          {dayAppointments.length > 0 ? (
            <div className="space-y-3">
              {dayAppointments.map(appointment => (
                <div 
                  key={appointment.id}
                  className="p-4 border border-gray-200 rounded-lg hover:shadow-md cursor-pointer transition-all duration-200 hover:border-blue-300"
                  onClick={() => onAppointmentClick(appointment)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {format(appointment.dateTime, 'h:mm')}
                        </div>
                        <div className="text-sm text-gray-500">
                          {format(appointment.dateTime, 'a')}
                        </div>
                      </div>
                      
                      <div className={`w-1 h-16 rounded-full ${getStatusColor(appointment.status)}`} />
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-lg font-bold text-gray-900">{appointment.customer}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                            appointment.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                            appointment.status === 'canceled' ? 'bg-gray-100 text-gray-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {appointment.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-gray-600 font-medium mb-1">
                          🚗 {appointment.vehicle}
                        </div>
                        <div className="text-gray-600">
                          🔧 {appointment.service}
                        </div>
                        {appointment.phone && (
                          <div className="text-gray-500 text-sm mt-1">
                            📞 {appointment.phone}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col space-y-2">
                      {appointment.status === 'scheduled' && onStartJob && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartJob(appointment.id);
                          }}
                          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
                        >
                          🔧 Start Job
                        </button>
                      )}
                      {appointment.status === 'in-progress' && onCompleteJob && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onCompleteJob(appointment.id);
                          }}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          ✅ Complete
                        </button>
                      )}
                      {appointment.phone && onCallCustomer && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onCallCustomer(appointment.phone!);
                          }}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                        >
                          📞 Call
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center bg-gray-50 rounded-xl">
              <div className="text-6xl mb-4">🛠️</div>
              <p className="text-xl font-medium text-gray-600 mb-4">No appointments scheduled for today</p>
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
            {weekDays.map(day => (
              <div key={day.toString()} className="border rounded-lg overflow-hidden">
                <div className={`py-3 font-bold text-center text-sm ${
                  isSameDay(day, new Date()) 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {format(day, 'EEE')}
                  <br />
                  <span className="text-lg">{format(day, 'd')}</span>
                </div>
                <div className="h-[350px] p-2 overflow-y-auto space-y-1">
                  {appointments
                    .filter(apt => isSameDay(apt.dateTime, day))
                    .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
                    .map(apt => (
                      <div 
                        key={apt.id}
                        onClick={() => onAppointmentClick(apt)}
                        className={`p-2 text-xs rounded cursor-pointer hover:shadow-sm transition-shadow ${getStatusBg(apt.status)}`}
                      >
                        <div className="font-bold text-sm">{format(apt.dateTime, 'h:mm a')}</div>
                        <div className="font-medium truncate">{apt.customer}</div>
                        <div className="text-gray-600 truncate">{apt.vehicle}</div>
                        <div className="text-gray-600 truncate">{apt.service}</div>
                      </div>
                    ))
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="mt-6 flex justify-center">
        <button 
          onClick={onAddAppointment}
          className="px-8 py-3 bg-orange-500 text-white rounded-lg font-medium shadow-sm hover:bg-orange-600 transition-colors text-lg"
        >
          ➕ Add New Appointment
        </button>
      </div>
    </div>
  );
};
