// Simple Switch Component for Feature Flags
import React from 'react';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  className = ''
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Toggle switch"
      disabled={disabled}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2
        focus:ring-blue-500 focus:ring-offset-2
        ${checked ? 'bg-blue-600' : 'bg-gray-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      onClick={() => !disabled && onCheckedChange(!checked)}
    >
      <span
        className={`
          inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out
          ${checked ? 'translate-x-6' : 'translate-x-1'}
        `}
      />
    </button>
  );
};
