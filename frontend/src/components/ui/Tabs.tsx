import React from 'react';

interface TabsProps {
  value: string;
  onValueChange: (v: string) => void;
  tabs: { value: string; label: string }[];
}

export function Tabs({ value, onValueChange, tabs }: TabsProps) {
  return (
    <div role="tablist" aria-label="Tabs" className="flex gap-2 border-b border-gray-200">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          className={`px-3 py-2 text-sm font-medium border-b-2 focus:outline-none focus:ring rounded-t ${
            value === t.value ? 'border-primary text-primary' : 'border-transparent text-gray-600'
          }`}
          onClick={() => onValueChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
