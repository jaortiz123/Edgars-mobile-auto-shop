import React from 'react';
import { Plus } from 'lucide-react';

interface FABProps {
  onClick: () => void;
}

export default function FloatingActionButton({ onClick }: FABProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-sp-4 right-sp-4 bg-primary text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:scale-105 focus:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-transform"
      aria-label="Add new appointment"
    >
      <Plus className="h-8 w-8" />
    </button>
  );
}
