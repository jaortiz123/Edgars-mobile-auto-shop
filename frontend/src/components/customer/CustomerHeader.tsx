import React from 'react';
import { CustomerProfileResponse } from '@/lib/customerProfileApi';

interface Props {
  customer: CustomerProfileResponse['customer'];
  metrics: CustomerProfileResponse['metrics'];
  onEdit?: () => void;
  onBook?: () => void;
}

export function CustomerHeader({ customer, metrics, onEdit, onBook }: Props) {
  const badges: Array<{ label: string; color: string }> = [];
  if (customer.isVip) badges.push({ label: 'VIP', color: 'bg-yellow-500 text-white' });
  if (metrics.isOverdueForService) badges.push({ label: 'Overdue', color: 'bg-red-500 text-white' });

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between" data-testid="customer-header">
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          {/* data-testid kept as customer-profile-name to satisfy existing tests; alias retained in comment for clarity */}
          <h1 className="text-2xl font-bold" data-testid="customer-profile-name">{customer.name}</h1>
          <div className="flex gap-2">
            {badges.map(b => (
              <span key={b.label} className={`px-2 py-0.5 text-xs font-semibold rounded-full ${b.color}`} data-testid={`customer-badge-${b.label.toLowerCase()}`}>{b.label}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-gray-600" data-testid="customer-header-contact">
          {customer.phone && (
            <span className="flex items-center gap-1" data-testid="customer-phone">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.72 19.72 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.72 19.72 0 0 1 2.11 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.81.37 1.6.72 2.34a2 2 0 0 1-.45 2.18L8.09 9.91a16 16 0 0 0 6 6l1.67-1.28a2 2 0 0 1 2.18-.45c.74.35 1.53.6 2.34.72A2 2 0 0 1 22 16.92z" /></svg>
              {customer.phone}
            </span>
          )}
          {customer.email && (
            <span className="flex items-center gap-1" data-testid="customer-email">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              {customer.email}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-3" data-testid="customer-header-actions">
        <button type="button" onClick={onEdit} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50" data-testid="customer-edit-btn">Edit Customer</button>
        <button type="button" onClick={onBook} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500" data-testid="customer-book-btn">Book New Appointment</button>
      </div>
    </div>
  );
}

export default CustomerHeader;
