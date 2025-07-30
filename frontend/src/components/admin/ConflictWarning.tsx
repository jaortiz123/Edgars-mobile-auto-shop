import React from 'react';

interface ConflictWarningProps {
  conflictingAppointment: any;
  onOverride: () => void;
}

export default function ConflictWarning({ conflictingAppointment, onOverride }: ConflictWarningProps) {
  return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
      <strong className="font-bold">Conflict Detected!</strong>
      <span className="block sm:inline"> This appointment overlaps with an existing appointment for {conflictingAppointment.customerName} at {conflictingAppointment.appointmentTime}.</span>
      <div className="mt-2">
        <button
          onClick={onOverride}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-xs"
        >
          Proceed Anyway
        </button>
      </div>
    </div>
  );
}
