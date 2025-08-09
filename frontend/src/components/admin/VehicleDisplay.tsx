import React from 'react';

export const VehicleDisplay = ({
  year,
  make,
  model,
  mileage,
  vehicle,
}: {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  mileage?: number | null;
  vehicle?: string | null;
}) => {
  const label = [year, make, model].filter(Boolean).join(' ');
  const final = label || vehicle || 'Vehicle';
  return (
    <div className="text-sm text-neutral-600">
      <span>🚗 {final}</span>
      {typeof mileage === 'number' && (
        <span className="ml-2 text-neutral-500">• {mileage.toLocaleString()} mi</span>
      )}
    </div>
  );
};

export default VehicleDisplay;
