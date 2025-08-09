import React from 'react';

export const ServiceComplexityIndicator = ({ complexity }: { complexity?: 'simple' | 'moderate' | 'complex' }) => {
  if (!complexity) return null;
  const map: Record<string, { bg: string; text: string; icon: string }> = {
    simple: { bg: 'bg-success-50 border-success-200', text: 'text-success-800', icon: '✅' },
    moderate: { bg: 'bg-warning-50 border-warning-200', text: 'text-warning-800', icon: '🛠️' },
    complex: { bg: 'bg-danger-50 border-danger-200', text: 'text-danger-800', icon: '⚠️' },
  };
  const s = map[complexity] || map.moderate;
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${s.bg} ${s.text}`}>
      <span className="mr-1">{s.icon}</span>
      {complexity}
    </span>
  );
};

export default ServiceComplexityIndicator;
