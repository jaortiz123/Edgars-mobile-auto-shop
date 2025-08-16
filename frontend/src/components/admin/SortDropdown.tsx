import React from 'react';

export type CustomerSort = 'relevance' | 'name_asc' | 'name_desc' | 'most_recent_visit' | 'highest_lifetime_spend';

interface SortDropdownProps {
  value: CustomerSort;
  onChange: (v: CustomerSort) => void;
}

const optionClasses = 'text-sm';

const LABELS: Record<CustomerSort, string> = {
  relevance: 'Relevance',
  name_asc: 'Name A–Z',
  name_desc: 'Name Z–A',
  most_recent_visit: 'Most Recent Visit',
  highest_lifetime_spend: 'Highest Lifetime Spend',
};

export const SortDropdown: React.FC<SortDropdownProps> = ({ value, onChange }) => {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-gray-600" data-testid="customers-sort-wrapper">
      <span>Sort:</span>
      <select
        className="border rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        value={value}
        onChange={e => onChange(e.target.value as CustomerSort)}
        data-testid="customers-sort-select"
      >
        {(Object.keys(LABELS) as CustomerSort[]).map(k => (
          <option key={k} value={k} className={optionClasses} data-testid={`customers-sort-option-${k}`}>{LABELS[k]}</option>
        ))}
      </select>
    </label>
  );
};

export default SortDropdown;
