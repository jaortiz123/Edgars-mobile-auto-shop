import React from 'react';
import type { UIAppointment } from '../../admin/Dashboard';
import { isWithin, minutesPast } from '../../lib/time';

interface TodaysScheduleProps {
  appointments: UIAppointment[];
}

export default function TodaysSchedule({ appointments }: TodaysScheduleProps) {
  const today = new Date().toDateString();

  return (
    <div className="mt-4">
      <h3 className="text-fs-3 font-semibold">Today's Schedule</h3>
      <ul className="mt-2 space-y-sp-1">
        {appointments.slice(0, 5).map((appointment) => {
          const isToday = appointment.dateTime.toDateString() === today;
          const isSoon = isWithin(appointment.dateTime, 30);
          const minutes_past = minutesPast(appointment.dateTime);
          const isLate = minutes_past > 5 && minutes_past <= 30;
          const isOverdue = minutes_past > 30;

          return (
            <li key={appointment.id} className={`flex justify-between items-center border-b border-gray-200 py-2 ${
              isToday ? 'bg-blue-50' : ''
            }`}>
              <span className="text-fs-2">{appointment.timeSlot}</span>
              <span className="text-fs-2 font-medium">{appointment.customer}</span>
              {isSoon && <span className="text-xs text-orange-500">⚠️ Soon</span>}
              {isLate && <span className="text-xs text-amber-500">Running Late</span>}
              {isOverdue && <span className="text-xs text-red-500">Overdue</span>}
            </li>
          );
        })}
      </ul>
      {appointments.length > 5 && (
        <a href="#" className="text-fs-2 text-blue-600 hover:underline mt-2 block">View all</a>
      )}
    </div>
  );
}
