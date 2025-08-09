import React from 'react';
import type { Part } from '@/types/models';

export const PartsIndicator = ({ parts }: { parts?: Part[] }) => {
  if (!parts || parts.length === 0) return null;
  const missing = parts.filter(p => !p.inStock);
  const color = missing.length > 0 ? 'text-warning-800 bg-warning-100' : 'text-success-800 bg-success-100';
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      <span className="mr-1">📦</span>
      {missing.length > 0 ? `${missing.length} part${missing.length>1?'s':''} missing` : 'All parts ready'}
    </span>
  );
};

export default PartsIndicator;
