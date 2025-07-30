// Sprint 2B T2, T3, T4: Schedule Item with Today highlighting, Urgency badges, and Late/Overdue alerts
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Clock, User, Phone, AlertTriangle, Zap } from 'lucide-react';
import { getMinutesUntil, isStartingSoon, isRunningLate, isOverdue, getCountdownText } from '../../utils/time';

interface ScheduleItemProps {
  appointment: {
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
  };
  isToday: boolean;
  onClick?: () => void;
}

// Helper function to safely parse appointment time
const parseAppointmentTime = (scheduledAt?: string, requestedTime?: string): Date => {
  try {
    const timeString = scheduledAt || requestedTime;
    if (!timeString) {
      console.warn('No appointment time provided, using current time');
      return new Date();
    }
    const parsed = new Date(timeString);
    if (isNaN(parsed.getTime())) {
      console.warn('Invalid appointment time:', timeString, 'using current time');
      return new Date();
    }
    return parsed;
  } catch (error) {
    console.error('Error parsing appointment time:', error);
    return new Date();
  }
};

export default function ScheduleItem({ appointment, isToday, onClick }: ScheduleItemProps) {
  // Memoize appointment time to prevent recreation on every render
  const appointmentTime = useMemo(() => 
    parseAppointmentTime(appointment.scheduled_at, appointment.requested_time),
    [appointment.scheduled_at, appointment.requested_time]
  );
  
  const [minutesUntil, setMinutesUntil] = useState(() => getMinutesUntil(appointmentTime));

  // Memoized update function to prevent recreation
  const updateMinutesUntil = useCallback(() => {
    setMinutesUntil(getMinutesUntil(appointmentTime));
  }, [appointmentTime]);

  // Live countdown updates with proper cleanup
  useEffect(() => {
    // Initial update
    updateMinutesUntil();
    
    const interval = setInterval(updateMinutesUntil, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [updateMinutesUntil]);

  // T3: Time-based urgency detection (<30 min) with error handling
  const isSoon = useMemo(() => {
    try {
      return isStartingSoon(appointmentTime, 30);
    } catch (error) {
      console.error('Error checking if appointment is starting soon:', error);
      return false;
    }
  }, [appointmentTime]);
  
  const isLate = useMemo(() => {
    try {
      return isRunningLate(appointmentTime, 5); // >5 min past
    } catch (error) {
      console.error('Error checking if appointment is running late:', error);
      return false;
    }
  }, [appointmentTime]);
  
  const isOverdueStatus = useMemo(() => {
    try {
      return isOverdue(appointmentTime, 30); // >30 min past
    } catch (error) {
      console.error('Error checking if appointment is overdue:', error);
      return false;
    }
  }, [appointmentTime]);

  // Get urgency status and styling with error handling
  const getUrgencyInfo = useCallback(() => {
    try {
      if (isOverdueStatus) {
        return {
          label: 'Overdue',
          icon: AlertTriangle,
          badgeClass: 'bg-red-100 text-red-800 border-red-200',
          cardClass: 'border-red-300 bg-red-50',
          priority: 4
        };
      }
      if (isLate) {
        return {
          label: 'Running Late',
          icon: AlertTriangle,
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
          cardClass: 'border-amber-300 bg-amber-50',
          priority: 3
        };
      }
      if (isSoon) {
        return {
          label: 'Starting Soon',
          icon: Zap,
          badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
          cardClass: 'border-orange-300 bg-orange-50',
          priority: 2
        };
      }
      return {
        label: 'Scheduled',
        icon: Clock,
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
        cardClass: isToday ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white',
        priority: isToday ? 1 : 0
      };
    } catch (error) {
      console.error('Error determining urgency info:', error);
      // Fallback to normal status
      return {
        label: 'Scheduled',
        icon: Clock,
        badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
        cardClass: 'border-gray-200 bg-white',
        priority: 0
      };
    }
  }, [isOverdueStatus, isLate, isSoon, isToday]);

  const urgencyInfo = useMemo(() => getUrgencyInfo(), [getUrgencyInfo]);
  const IconComponent = urgencyInfo.icon;

  // Format time display with error handling
  const formatTime = useCallback((timeString: string) => {
    try {
      const date = new Date(timeString);
      if (isNaN(date.getTime())) {
        return 'Invalid Time';
      }
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'Invalid Time';
    }
  }, []);

  const formatDate = useCallback((timeString: string) => {
    try {
      const date = new Date(timeString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      
      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      } else if (date.toDateString() === tomorrow.toDateString()) {
        return 'Tomorrow';
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  }, []);

  // Safe click handler
  const handleClick = useCallback(() => {
    try {
      onClick?.();
    } catch (error) {
      console.error('Error handling appointment click:', error);
    }
  }, [onClick]);

  // Safe phone call handler
  const handlePhoneClick = useCallback((e: React.MouseEvent, phone: string) => {
    try {
      e.stopPropagation();
      window.location.href = `tel:${phone}`;
    } catch (error) {
      console.error('Error initiating phone call:', error);
    }
  }, []);

  return (
    <div
      className={`p-4 rounded-lg border transition-all duration-200 hover:shadow-md cursor-pointer ${urgencyInfo.cardClass} ${
        isToday ? 'ring-1 ring-blue-300' : ''
      }`}
      onClick={handleClick}
      aria-label={`Appointment with ${appointment.customer_name || 'Unknown'} for ${appointment.service || 'Unknown service'}`}
    >
      {/* Header with time and urgency badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold text-gray-900">
            {formatTime(appointment.scheduled_at || appointment.requested_time)}
          </div>
          {!isToday && (
            <div className="text-sm text-gray-600">
              {formatDate(appointment.scheduled_at || appointment.requested_time)}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* T3: Time-based urgency badge */}
          {(isSoon || isLate || isOverdueStatus) && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${urgencyInfo.badgeClass}`}>
              <IconComponent className="h-3 w-3" />
              {urgencyInfo.label}
            </span>
          )}
          
          {/* T2: Today highlight indicator */}
          {isToday && !isSoon && !isLate && !isOverdueStatus && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
              <Calendar className="h-3 w-3" />
              Today
            </span>
          )}
        </div>
      </div>

      {/* Customer and service information */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-500" />
          <span className="font-medium text-gray-900">{appointment.customer_name || 'Unknown Customer'}</span>
          {appointment.customer_phone && (
            <span
              className="p-1 text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
              onClick={(e) => handlePhoneClick(e, appointment.customer_phone!)}
              title={`Call ${appointment.customer_name || 'customer'}`}
              role="button"
              aria-label={`Call ${appointment.customer_name || 'customer'} at ${appointment.customer_phone}`}
            >
              <Phone className="h-3 w-3" />
            </span>
          )}
        </div>
        
        <div className="text-sm text-gray-600">
          {appointment.service || 'Unknown Service'}
        </div>
        
        {appointment.location_address && (
          <div className="text-sm text-gray-500">
            📍 {appointment.location_address}
          </div>
        )}
        
        {appointment.price && (
          <div className="text-sm font-medium text-gray-900">
            ${typeof appointment.price === 'number' ? appointment.price.toFixed(2) : appointment.price}
          </div>
        )}
      </div>

      {/* Live countdown for upcoming/ongoing appointments */}
      {(minutesUntil > -60 && minutesUntil < 180) && (
        <div className={`mt-3 text-xs font-medium ${
          isOverdueStatus ? 'text-red-600' :
          isLate ? 'text-amber-600' :
          isSoon ? 'text-orange-600' :
          'text-blue-600'
        }`}>
          <Clock className="inline h-3 w-3 mr-1" />
          {getCountdownText(minutesUntil)}
        </div>
      )}

      {/* Status indicator */}
      <div className="mt-3 flex items-center justify-between">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
          appointment.status === 'cancelled' ? 'bg-red-100 text-red-800' :
          appointment.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {appointment.status ? appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1) : 'Unknown'}
        </span>

        {/* T4: Running Late and Overdue alerts */}
        {(isLate || isOverdueStatus) && (
          <div className={`text-xs font-semibold ${
            isOverdueStatus ? 'text-red-600' : 'text-amber-600'
          }`} role="alert" aria-live="polite">
            ⚠️ Attention Required
          </div>
        )}
      </div>
    </div>
  );
}
