import React, { useState, useEffect } from 'react';
import { useAppointments } from '@/contexts/AppointmentContext';
import { getGreeting } from '@/lib/time';
import { Skeleton } from '@/components/ui/Skeleton';
import NextActionCard from './NextActionCard';
import TodaysSchedule from './TodaysSchedule';
import type { UIAppointment } from '../../admin/Dashboard';

interface DailyFocusHeroProps {
  nextAppointment: UIAppointment | null;
  appointments: UIAppointment[];
}

export default function DailyFocusHero({ nextAppointment, appointments }: DailyFocusHeroProps) {
  const { stats } = useAppointments();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const handleNextActionClick = () => {
    // Handle click event, e.g., open the appointment details
    if (nextAppointment) {
      console.log('Next action clicked:', nextAppointment.id);
    }
  };

  return (
    <div className="p-sp-3 bg-neutral-light rounded-lg">
      <h1 className="text-fs-5">Daily Focus</h1>
      <div className="mt-4">
        {greeting ? (
          <h2 className="text-fs-4">{greeting}, Edgar</h2>
        ) : (
          <Skeleton className="h-8 w-48" />
        )}
        {stats ? (
          <p className="text-fs-3 mt-2">
            Revenue so far: ${stats.unpaidTotal.toFixed(2)}
          </p>
        ) : (
          <Skeleton className="h-6 w-32 mt-2" />
        )}
      </div>
      {nextAppointment && (
        <NextActionCard
          taskTitle={`Confirm appointment for ${nextAppointment.customer}`}
          dueTime={nextAppointment.timeSlot}
          onClick={handleNextActionClick}
        />
      )}
      <TodaysSchedule appointments={appointments} />
    </div>
  );
}
