/**
 * Sprint 4A-T-001: Completion Animations Integration Example
 *
 * This example shows how to integrate completion animations with
 * existing Dashboard and StatusBoard components.
 */

import React, { useState, useCallback } from 'react';
import AppointmentCard from '@/components/admin/AppointmentCard';
import { safeAnimateCompletion } from '@/animations/completionAnimations';

// Example usage in Dashboard.tsx
export function DashboardCompletionExample() {
  const [appointments, setAppointments] = useState([
    {
      id: 'apt-1',
      customerName: 'John Doe',
      vehicle: '2020 Honda Civic',
      servicesSummary: 'Oil Change, Brake Inspection',
      status: 'IN_PROGRESS',
      price: 85.00,
      start: '2025-01-20T14:00:00Z'
    }
  ]);

  const [completingIds, setCompletingIds] = useState(new Set());

  // Sprint 4A-T-001: Handle job completion with animation
  const handleCompleteJob = useCallback(async (appointmentId: string) => {
    try {
      // Prevent double completion
      if (completingIds.has(appointmentId)) return;

      // Start completing state
      setCompletingIds(prev => new Set(prev).add(appointmentId));

      // Simulate API call to complete appointment
      await fetch(`/api/appointments/${appointmentId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' })
      });

      // Update appointment status (triggers automatic animation)
      setAppointments(prev =>
        prev.map(apt =>
          apt.id === appointmentId
            ? { ...apt, status: 'COMPLETED' }
            : apt
        )
      );

    } catch (error) {
      console.error('Failed to complete appointment:', error);
      // Remove from completing state on error
      setCompletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(appointmentId);
        return newSet;
      });
    }
  }, [completingIds]);

  // Sprint 4A-T-001: Remove card from DOM after animation
  const handleCardRemoved = useCallback((appointmentId: string) => {
    setAppointments(prev => prev.filter(apt => apt.id !== appointmentId));
    setCompletingIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(appointmentId);
      return newSet;
    });
  }, []);

  return (
    <div className="appointment-cards-grid">
      {appointments.map(appointment => (
        <AppointmentCard
          key={appointment.id}
          card={appointment}
          onOpen={(id) => console.log('Opening appointment:', id)}
          onMove={(id) => console.log('Moving appointment:', id)}
          onQuickReschedule={(id) => console.log('Rescheduling:', id)}
          // Sprint 4A-T-001: Completion animation props
          onCompleteJob={handleCompleteJob}
          isCompleting={completingIds.has(appointment.id)}
          onCardRemoved={handleCardRemoved}
        />
      ))}
    </div>
  );
}

// Example usage in StatusBoard.tsx
export function StatusBoardCompletionExample() {
  const [columns, setColumns] = useState({
    'IN_PROGRESS': [
      {
        id: 'apt-2',
        customerName: 'Jane Smith',
        vehicle: '2019 Ford F-150',
        status: 'IN_PROGRESS'
      }
    ],
    'COMPLETED': []
  });

  // Handle card drop to completed column
  const handleCardDrop = useCallback((cardId: string, targetColumn: string) => {
    if (targetColumn === 'COMPLETED') {
      // Move card to completed column
      setColumns(prev => {
        const sourceColumn = Object.keys(prev).find(col =>
          prev[col].some(card => card.id === cardId)
        );

        if (!sourceColumn) return prev;

        const card = prev[sourceColumn].find(c => c.id === cardId);
        if (!card) return prev;

        return {
          ...prev,
          [sourceColumn]: prev[sourceColumn].filter(c => c.id !== cardId),
          [targetColumn]: [...prev[targetColumn], { ...card, status: 'COMPLETED' }]
        };
      });

      // Animation will automatically trigger when card status becomes 'COMPLETED'
      // Card will be removed from DOM via onCardRemoved callback
    }
  }, []);

  const handleCardRemoved = useCallback((cardId: string) => {
    setColumns(prev => ({
      ...prev,
      COMPLETED: prev.COMPLETED.filter(card => card.id !== cardId)
    }));
  }, []);

  return (
    <div className="status-board">
      {Object.entries(columns).map(([status, cards]) => (
        <div key={status} className="status-column">
          <h3>{status}</h3>
          {cards.map(card => (
            <AppointmentCard
              key={card.id}
              card={card}
              onOpen={(id) => console.log('Opening:', id)}
              onMove={(id) => console.log('Moving:', id)}
              onQuickReschedule={(id) => console.log('Rescheduling:', id)}
              onCardRemoved={handleCardRemoved}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Manual animation trigger example (for custom use cases)
export function ManualAnimationExample() {
  const triggerManualAnimation = (cardElement: HTMLElement) => {
    safeAnimateCompletion(cardElement, () => {
      console.log('Animation completed - card can be removed from DOM');
      // Custom cleanup logic here
    });
  };

  return (
    <div>
      <button
        onClick={(e) => {
          const cardElement = document.querySelector('[data-testid="appointment-card-example"]');
          if (cardElement) {
            triggerManualAnimation(cardElement as HTMLElement);
          }
        }}
      >
        Trigger Manual Animation
      </button>

      <div
        data-testid="appointment-card-example"
        className="appointment-card"
        style={{ padding: '1rem', border: '1px solid #ccc', margin: '1rem' }}
      >
        Example Card - Click button above to animate
      </div>
    </div>
  );
}
