import React, { useEffect, useState } from 'react';
import { getCustomerHistory, type CustomerHistoryResponse, type CustomerHistoryAppointment } from '@/lib/api';

interface CustomerHistoryProps {
  customerId: string;
  onAppointmentClick: (appointmentId: string) => void;
}

interface YearGroup {
  year: number;
  appointments: CustomerHistoryAppointment[];
  totalAmount: number;
  paidAmount: number;
}

export default function CustomerHistory({ customerId, onAppointmentClick }: CustomerHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<CustomerHistoryResponse | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set([new Date().getFullYear()]));
  const [unauthorized, setUnauthorized] = useState(false);

  // Single data loader (deduped – previously duplicated logic)
  const fetchHistory = async () => {
    if (!customerId) return;
    try {
      setLoading(true);
      setError(null);
      setUnauthorized(false);
      if (import.meta.env.DEV) {
        console.log('[history][debug] fetchHistory start', { customerId });
      }
      const data = await getCustomerHistory(customerId);
      setHistoryData(data);
    } catch (err) {
      const msg = (err as Error)?.message || '';
      // Heuristic: backend returns this message for missing / invalid token
      if (/missing or invalid authorization token/i.test(msg) || /403/.test(msg)) {
        setUnauthorized(true);
      }
      console.error('Error fetching customer history:', err);
      setError('Failed to load customer history');
    } finally {
      setLoading(false);
      if (import.meta.env.DEV) {
        console.log('[history][debug] fetchHistory end', { customerId, error });
      }
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const handleRetry = () => fetchHistory();

  const toggleYear = (year: number) => {
    const newExpanded = new Set(expandedYears);
    if (newExpanded.has(year)) {
      newExpanded.delete(year);
    } else {
      newExpanded.add(year);
    }
    setExpandedYears(newExpanded);
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'text-green-600';
      case 'canceled':
        return 'text-red-600';
      case 'no_show':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  // Group appointments by year
  const groupedByYear = React.useMemo(() => {
    if (!historyData?.data?.pastAppointments) return [];

    const groups: { [year: number]: YearGroup } = {};

    historyData.data.pastAppointments.forEach(appointment => {
      const appointmentDate = new Date(appointment.start);
      const year = appointmentDate.getFullYear();

      if (!groups[year]) {
        groups[year] = {
          year,
          appointments: [],
          totalAmount: 0,
          paidAmount: 0
        };
      }

      groups[year].appointments.push(appointment);
      groups[year].totalAmount += appointment.total_amount || 0;
      groups[year].paidAmount += appointment.paid_amount || 0;
    });

    return Object.values(groups).sort((a, b) => b.year - a.year);
  }, [historyData]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {/* Skeleton loader */}
        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        <div className="space-y-2">
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-8 bg-gray-100 rounded"></div>
          <div className="h-8 bg-gray-100 rounded"></div>
        </div>
        <div className="space-y-2">
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-8 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">{error}</div>
        {unauthorized && (
          <div className="text-sm text-gray-500 mb-4 max-w-md mx-auto px-4">
            You appear to be unauthorized to view history. Ensure you are logged in as an Advisor. If this is a
            local dev environment you can set <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">DEV_ALLOW_UNAUTH_HISTORY=1</code>{' '}
            on the backend for temporary bypass (never in production).
          </div>
        )}
        <button
          onClick={handleRetry}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          disabled={loading}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!historyData?.data?.pastAppointments?.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-lg mb-2">No appointment history</div>
        <div className="text-sm">This customer has no completed appointments yet.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-gray-700">
        {historyData.data.pastAppointments.length} past appointment{historyData.data.pastAppointments.length !== 1 ? 's' : ''}
      </div>

      <div className="space-y-2">
        {groupedByYear.map(yearGroup => (
          <div key={yearGroup.year} className="border rounded">
            {/* Year header - clickable to expand/collapse */}
            <button
              onClick={() => toggleYear(yearGroup.year)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between border-b transition-colors"
            >
              <div className="flex items-center space-x-3">
                <span className="font-medium">{yearGroup.year}</span>
                <span className="text-sm text-gray-600">
                  {yearGroup.appointments.length} appointment{yearGroup.appointments.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  {formatCurrency(yearGroup.totalAmount)} total
                </span>
                <svg
                  className={`w-4 h-4 transition-transform ${
                    expandedYears.has(yearGroup.year) ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Appointments list - shown when expanded */}
            {expandedYears.has(yearGroup.year) && (
              <div className="divide-y">
                {yearGroup.appointments.map(appointment => (
                  <div
                    key={appointment.id}
                    onClick={() => onAppointmentClick(appointment.id)}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-medium">
                            {new Date(appointment.start).toLocaleDateString()}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(appointment.status)} bg-opacity-10 bg-current`}>
                            {appointment.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        {appointment.payments.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {appointment.payments.length} payment{appointment.payments.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {formatCurrency(appointment.total_amount || 0)}
                        </div>
                        {appointment.paid_amount > 0 && (
                          <div className="text-xs text-green-600">
                            {formatCurrency(appointment.paid_amount)} paid
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
