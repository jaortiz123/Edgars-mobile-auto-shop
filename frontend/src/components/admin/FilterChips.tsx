import React from 'react';

export type CustomerFilter = 'all' | 'vip' | 'overdue';

interface FilterChipsProps {
  active: CustomerFilter;
  onChange: (f: CustomerFilter) => void;
}

const CHIP_BASE = 'text-xs px-3 py-1 rounded-full border transition-colors cursor-pointer select-none';

function chipClasses(active: boolean) {
  return active
    ? `${CHIP_BASE} bg-blue-600 text-white border-blue-600 shadow-sm`
    : `${CHIP_BASE} bg-white text-gray-600 border-gray-300 hover:bg-gray-100`;
}

export const FilterChips: React.FC<FilterChipsProps> = ({ active, onChange }) => {
  return (
    <div className="flex gap-2 flex-wrap" data-testid="customer-filters">
      <button
        type="button"
        className={chipClasses(active === 'all')}
        onClick={() => onChange('all')}
        data-testid="filter-chip-all"
      >All</button>
      <button
        type="button"
        className={chipClasses(active === 'vip')}
        onClick={() => onChange('vip')}
        data-testid="filter-chip-vip"
      >⭐ VIP</button>
      <button
        type="button"
        className={chipClasses(active === 'overdue')}
        onClick={() => onChange('overdue')}
        data-testid="filter-chip-overdue"
      >⚠️ Overdue</button>
    </div>
  );
};

export default FilterChips;
