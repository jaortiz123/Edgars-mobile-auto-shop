import React from 'react';

interface TabsProps {
  value: string;
  onValueChange: (v: string) => void;
  tabs: { value: string; label: string }[];
}

export function Tabs({ value, onValueChange, tabs }: TabsProps) {
  const handleKeyDown = (e: React.KeyboardEvent, tabValue: string) => {
    const currentIndex = tabs.findIndex(tab => tab.value === value);
    let nextIndex = currentIndex;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        nextIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = tabs.length - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onValueChange(tabValue);
        return;
      default:
        return;
    }

    if (nextIndex !== currentIndex) {
      onValueChange(tabs[nextIndex].value);
    }
  };

  return (
    <div role="tablist" aria-label="Tabs" className="flex gap-2 border-b border-gray-200">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          tabIndex={value === t.value ? 0 : -1}
          className={`px-3 py-2 text-sm font-medium border-b-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-t ${
            value === t.value ? 'border-primary text-primary' : 'border-transparent text-gray-600'
          }`}
          onClick={() => onValueChange(t.value)}
          onKeyDown={(e) => handleKeyDown(e, t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
