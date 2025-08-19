import React, { useState, useEffect } from 'react';
import { useBoardStore } from '@/state/useBoardStore';
import { getGreeting } from '@/lib/time';
import { Skeleton } from '@/components/ui/Skeleton';
import NextActionCard from './NextActionCard';
import TodaysSchedule from './TodaysSchedule';

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

interface DailyFocusHeroProps {
  nextAppointment: UIAppointment | null;
  appointments: UIAppointment[];
}

export default function DailyFocusHero({ nextAppointment, appointments }: DailyFocusHeroProps) {
  const cards = useBoardStore(s => s.cardIds.map(id => s.cardsById[id]));
  interface MinimalStats { unpaidTotal: number; scheduled: number; inProgress: number; ready: number; completed: number; }
  const stats: MinimalStats | null = cards.length ? {
    unpaidTotal: 0,
    scheduled: cards.filter(c => c.status === 'SCHEDULED').length,
    inProgress: cards.filter(c => c.status === 'IN_PROGRESS').length,
    ready: cards.filter(c => c.status === 'READY').length,
    completed: cards.filter(c => c.status === 'COMPLETED').length,
  } : null;
  const [greeting, setGreeting] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Set initial greeting
    setGreeting(getGreeting());

    // Update time every minute to keep greeting fresh
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      setGreeting(getGreeting());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleNextActionClick = () => {
    // Handle click event, e.g., open the appointment details
    if (nextAppointment) {
      console.log('Next action clicked:', nextAppointment.id);
    }
  };

  // Format today's date for display
  const formatTodaysDate = () => {
    return currentTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Calculate total revenue including estimates
  const getTotalRevenue = () => {
    if (!stats) return 0;

    // Sum up confirmed revenue + estimated revenue from scheduled appointments
    const confirmedRevenue = stats.unpaidTotal || 0;
    const estimatedRevenue = appointments.reduce((total, apt) => {
      // Add estimated revenue for today's pending appointments
      const estimatedAmount = 150; // Default estimate - could be pulled from service data
      return total + (apt.status === 'scheduled' ? estimatedAmount : 0);
    }, 0);

    return confirmedRevenue + estimatedRevenue;
  };

  return (
    <div className="p-sp-4 bg-gradient-to-br from-neutral-light to-neutral-50 rounded-lg border border-neutral-200 shadow-sm">
      {/* Header Section with Enhanced Greeting */}
      <div className="mb-sp-4">
        <div className="flex items-center justify-between mb-sp-2">
          <h1 className="text-fs-6 font-semibold text-gray-900">Daily Focus</h1>
          <span className="text-fs-1 text-gray-500 font-medium">
            {formatTodaysDate()}
          </span>
        </div>

        {/* Enhanced Good Morning Anchor */}
        <div className="bg-white rounded-lg p-sp-3 border border-neutral-200 shadow-sm">
          {greeting ? (
            <div className="space-y-sp-2">
              <h2 className="text-fs-5 font-semibold text-gray-900">
                {greeting}, Edgar! 👋
              </h2>
              <div className="flex items-center gap-sp-4">
                <div className="flex-1">
                  <p className="text-fs-2 text-gray-600 mb-sp-1">
                    Today's Revenue Progress
                  </p>
                  {stats ? (
                    <div className="space-y-sp-1">
                      <p className="text-fs-4 font-semibold text-green-600">
                        ${getTotalRevenue().toFixed(2)}
                      </p>
                      <div className="flex items-center gap-sp-2 text-fs-1">
                        <span className="text-gray-500">Confirmed: ${stats.unpaidTotal.toFixed(2)}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-500">
                          Scheduled: {appointments.filter(apt => apt.status === 'scheduled').length} appointments
                        </span>
                      </div>
                    </div>
                  ) : (
                    <Skeleton className="h-6 w-32" />
                  )}
                </div>

                {/* Quick Stats */}
                <div className="text-right">
                  <p className="text-fs-1 text-gray-500 mb-sp-1">Today's Schedule</p>
                  <p className="text-fs-3 font-semibold text-blue-600">
                    {appointments.length} appointments
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-sp-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-6 w-32" />
            </div>
          )}
        </div>
      </div>
      {/* Next Action Section - T3 */}
      {nextAppointment && (
        <div className="mb-sp-4">
          <NextActionCard
            taskTitle={`Confirm appointment for ${nextAppointment.customer}`}
            dueTime={nextAppointment.timeSlot}
            onClick={handleNextActionClick}
          />
        </div>
      )}

      {/* Today's Schedule Section - T4 */}
      <TodaysSchedule appointments={appointments} />
    </div>
  );
}
