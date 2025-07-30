import React from 'react';
import { CheckCircle } from 'lucide-react';

interface ArrivalButtonProps {
  onClick: () => void;
  disabled: boolean;
}

export default function ArrivalButton({ onClick, disabled }: ArrivalButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1 rounded-full text-sm font-medium transition-colors flex items-center gap-1
        bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <CheckCircle className="h-4 w-4" />
      Arrived
    </button>
  );
}
