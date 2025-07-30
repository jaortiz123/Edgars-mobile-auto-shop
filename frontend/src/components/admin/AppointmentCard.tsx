import React, { useState, useEffect, useMemo } from 'react';
import type { BoardCard } from '@/types/models';
import { useDrag } from 'react-dnd';
import { RefreshCw } from 'lucide-react';
import { getMinutesUntil, minutesPast, getCountdownText, isStartingSoon, isRunningLate, isOverdue } from '@/utils/time';
import ArrivalButton from './ArrivalButton';
import { markArrived } from '@/lib/api';
import { notifyLate, notifyOverdue, notifyArrival } from '@/services/notificationService';
import '@/styles/appointment-reminders.css';

interface AppointmentCardProps {
  card: BoardCard;
  onOpen: (id: string) => void;
  onMove: (id: string) => void;
  onQuickReschedule: (id: string) => void;
}

export default function AppointmentCard({ card, onOpen, onMove, onQuickReschedule }: AppointmentCardProps) {
  // Use card.start instead of card.dateTime since that's what the backend returns
  const appointmentTime = useMemo(() => 
    card.start ? new Date(card.start) : new Date(), 
    [card.start]
  );
  
  // Enhanced urgency system for Sprint 1B
  const getUrgencyLevel = () => {
    if (!card.start) return 'normal';
    if (card.urgency === 'urgent' || isOverdue(appointmentTime)) return 'urgent';
    if (card.urgency === 'soon' || isRunningLate(appointmentTime)) return 'soon';
    return 'normal';
  };
  
  const urgencyLevel = getUrgencyLevel();
  
  const [minutesUntil, setMinutesUntil] = useState(() => getMinutesUntil(appointmentTime));
  const [hasArrived, setHasArrived] = useState(false);
  const [notifiedLate, setNotifiedLate] = useState(false);
  const [notifiedOverdue, setNotifiedOverdue] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const newMinutesUntil = getMinutesUntil(appointmentTime);
      setMinutesUntil(newMinutesUntil);

      // Check for running late notifications (only if not arrived)
      if (!hasArrived && card.start) {
        const minutes_past = minutesPast(appointmentTime);
        
        // Running late notification (10+ minutes past start)
        if (minutes_past > 10 && !notifiedLate) {
          notifyLate(card.id, 'running late', {
            customer: card.customerName,
            service: card.servicesSummary || 'Service'
          });
          setNotifiedLate(true);
        }
        
        // Overdue notification (30+ minutes past start)
        if (minutes_past > 30 && !notifiedOverdue) {
          notifyOverdue(card.id, {
            customer: card.customerName,
            service: card.servicesSummary || 'Service'
          });
          setNotifiedOverdue(true);
        }
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [appointmentTime, card.id, card.customerName, card.servicesSummary, card.start, hasArrived, notifiedLate, notifiedOverdue]);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'card',
    item: { id: card.id, status: card.status, position: card.position },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const handleMarkArrived = async () => {
    try {
      await markArrived(card.id);
      setHasArrived(true);
      // Notify arrival
      notifyArrival(card.id, {
        customer: card.customerName,
        service: card.servicesSummary || 'Service'
      });
    } catch (error) {
      console.error('Error marking arrived:', error);
      alert('Failed to mark as arrived.');
    }
  };

  // Determine if card needs urgent visual indicator
  const hasUrgentNotification = useMemo(() => {
    if (!card.start) return false;
    return isOverdue(appointmentTime) || (isRunningLate(appointmentTime) && !hasArrived);
  }, [appointmentTime, hasArrived, card.start]);

  return (
    <div
      ref={drag}
      className={`appointment-card relative group ${isDragging ? 'opacity-50' : 'opacity-100'} ${
        hasUrgentNotification ? 'has-urgent-notification' : ''
      }`}
    >
      <button
        className={`card-base w-full text-left cursor-pointer focus:outline-none ${
          hasUrgentNotification ? 'card-urgent' : ''
        } ${card.urgency === 'urgent' ? 'card-urgent' : card.urgency === 'soon' ? 'card-warning' : ''}`}
        data-card-id={card.id}
        data-testid={`board-card-${card.id}`}
        onClick={() => onOpen(card.id)}
        aria-label={`Open appointment for ${card.customerName}, ${card.vehicle}`}
      >
        <div className="card-content">
          {card.urgency && (
            <span className={`urgency-badge ${urgencyLevel}`}></span>
          )}
          <div className="flex items-center justify-between gap-sp-1">
            <h3 className="text-fs-3 font-semibold text-gray-900">{card.customerName}</h3>
            <span className="text-fs-0 text-gray-500">⋮</span>
          </div>
          <div className="text-fs-1 text-gray-600 mt-sp-1 font-normal">{card.vehicle}</div>
          {card.servicesSummary && (
            <div className="text-fs-1 text-gray-600 mt-sp-1 font-normal">{card.servicesSummary}</div>
          )}
          {typeof card.price === 'number' && (
            <div className="text-fs-2 mt-sp-2 font-medium text-gray-900">
              ${card.price.toFixed(2)}
            </div>
          )}
          
          {/* Urgency Status Line - Sprint 1B T4 */}
          {urgencyLevel !== 'normal' && (
            <div className={`urgency-status ${urgencyLevel}`}>
              <span className={`urgency-icon ${urgencyLevel}`}></span>
              {urgencyLevel === 'urgent' ? 'Urgent' : urgencyLevel === 'soon' ? 'Starting Soon' : ''}
            </div>
          )}
          
          {/* Sprint 3C: Live Countdown Timer with Status Styling */}
          <div className={`countdown mt-sp-2 ${
            !card.start ? 'normal' :
            isOverdue(appointmentTime) ? 'overdue' :
            isRunningLate(appointmentTime) ? 'running-late' :
            isStartingSoon(appointmentTime) ? 'starting-soon' :
            'normal'
          }`}>
            <span className="live-indicator"></span>
            {getCountdownText(minutesUntil)}
          </div>
          
          {/* Sprint 3C: Customer Arrived Check-in */}
          {!hasArrived && minutesUntil < 60 && minutesUntil > -30 && (
            <div className="mt-sp-2">
              <ArrivalButton onClick={handleMarkArrived} disabled={false} />
            </div>
          )}
        </div> {/* Close card-content */}
      </button>
      
      <button
        className="absolute top-sp-2 right-sp-2 text-fs-0 text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded p-sp-1 hover:bg-gray-100"
        aria-label={`Move appointment for ${card.customerName} to different status`}
        onClick={(e) => {
          e.stopPropagation();
          onMove(card.id);
        }}
      >
        ⋮
      </button>
      
      <button
        className="absolute bottom-sp-2 right-sp-2 p-sp-1 bg-blue-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onQuickReschedule(card.id)}
        aria-label="Quick reschedule"
      >
        <RefreshCw className="h-4 w-4" />
      </button>
    </div>
  );
}