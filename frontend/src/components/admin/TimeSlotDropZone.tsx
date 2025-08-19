// Sprint 3B T3: Time Slot Drop Zone for Drag-and-Drop Rescheduling
import React, { useRef } from 'react';
import { useDrop } from 'react-dnd';
import { Clock, Calendar } from 'lucide-react';

interface TimeSlotDropZoneProps {
  time: string;
  date: string;
  isAvailable: boolean;
  onDropAppointment: (appointmentId: string, newTime: string, newDate: string) => void;
  className?: string;
}

export default function TimeSlotDropZone({
  time,
  date,
  isAvailable,
  onDropAppointment,
  className = ''
}: TimeSlotDropZoneProps) {
  const dropRef = useRef<HTMLDivElement>(null);

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'card',
    drop: (item: { id: string; status: string; position: number }) => {
      if (isAvailable) {
        onDropAppointment(item.id, time, date);
      }
    },
    canDrop: () => isAvailable,
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [time, date, isAvailable, onDropAppointment]);

  // Connect drop to ref
  drop(dropRef);

  const getDropZoneClasses = () => {
    const baseClasses = `min-h-[60px] border-2 border-dashed rounded-lg p-3 transition-all duration-200 ${className}`;

    if (!isAvailable) {
      return `${baseClasses} border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed`;
    }

    if (isOver && canDrop) {
      return `${baseClasses} border-green-500 bg-green-50 shadow-lg scale-105`;
    }

    if (canDrop) {
      return `${baseClasses} border-blue-300 bg-blue-50 hover:border-blue-500 hover:bg-blue-100 cursor-pointer`;
    }

    return `${baseClasses} border-gray-300 bg-gray-50`;
  };

  return (
    <div
      ref={dropRef}
      className={getDropZoneClasses()}
      role="button"
      tabIndex={isAvailable ? 0 : -1}
      aria-label={
        isAvailable
          ? `Available time slot at ${time} on ${date}. Drop appointment here to reschedule.`
          : `Time slot at ${time} on ${date} is not available.`
      }
    >
      <div className="flex items-center justify-center gap-2 text-sm">
        <Clock className="h-4 w-4" />
        <span className="font-medium">{time}</span>
        <Calendar className="h-4 w-4" />
        <span>{new Date(date).toLocaleDateString()}</span>
      </div>

      {isOver && canDrop && (
        <div className="mt-2 text-center text-green-600 font-medium text-xs">
          Drop to reschedule
        </div>
      )}

      {!isAvailable && (
        <div className="mt-1 text-center text-gray-500 text-xs">
          Not available
        </div>
      )}
    </div>
  );
}
