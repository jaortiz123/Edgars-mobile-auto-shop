import React from 'react';

export const CustomerAvatar = ({ photo, name, isRepeat }: {
  photo?: string | null;
  name: string;
  isRepeat?: boolean;
}) => {
  const initials = (name || '')
    .split(' ')
    .filter(Boolean)
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'C';

  return (
    <div className="relative" aria-label={`Customer ${name}`}>
      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
        {photo ? (
          <img src={photo} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-primary-700 font-semibold text-sm">{initials}</span>
        )}
      </div>

      {isRepeat && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-success-500 rounded-full flex items-center justify-center">
          <span className="text-white text-[10px] leading-none">✓</span>
        </div>
      )}
    </div>
  );
};

export default CustomerAvatar;
