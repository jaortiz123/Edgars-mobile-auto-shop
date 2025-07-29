import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Download, FileSpreadsheet, DollarSign, Calendar, Filter, ChevronDown, AlertTriangle } from 'lucide-react';

interface ReportsDropdownProps {
  /** Feature flag to show/hide the reports functionality */
  ffReports?: boolean;
  /** Optional CSS classes */
  className?: string;
}

interface ExportOptions {
  from?: string;
  to?: string;
  status?: string;
}

export const ReportsDropdown: React.FC<ReportsDropdownProps> = ({ 
  ffReports = true,
  className = '' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<'appointments' | 'payments' | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Don't render if feature flag is disabled
  if (!ffReports) {
    return null;
  }

  const handleExport = async (type: 'appointments' | 'payments') => {
    setIsExporting(type);
    
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (exportOptions.from) params.append('from', exportOptions.from);
      if (exportOptions.to) params.append('to', exportOptions.to);
      if (type === 'appointments' && exportOptions.status) {
        params.append('status', exportOptions.status);
      }

      const endpoint = type === 'appointments' 
        ? `/api/admin/reports/appointments.csv`
        : `/api/admin/reports/payments.csv`;
      
      const url = params.toString() ? `${endpoint}?${params}` : endpoint;

      // Get the auth token from localStorage or wherever it's stored
      const token = localStorage.getItem('authToken'); // Adjust based on your auth implementation
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Export rate limit exceeded. Please wait before trying again.');
        } else if (response.status === 403) {
          throw new Error('You do not have permission to export data.');
        } else {
          throw new Error(`Export failed: ${response.statusText}`);
        }
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || 
        `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;

      // Download the file
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      // Close dropdown on successful export
      setIsOpen(false);
      
    } catch (error) {
      console.error(`${type} export failed:`, error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setIsExporting(null);
    }
  };

  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getDatePreset = (preset: 'today' | 'week' | 'month' | 'quarter') => {
    const now = new Date();
    const today = formatDateForInput(now);
    
    switch (preset) {
      case 'today':
        return { from: today, to: today };
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { from: formatDateForInput(weekAgo), to: today };
      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        return { from: formatDateForInput(monthAgo), to: today };
      case 'quarter':
        const quarterAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        return { from: formatDateForInput(quarterAgo), to: today };
      default:
        return {};
    }
  };

  const applyDatePreset = (preset: 'today' | 'week' | 'month' | 'quarter') => {
    const dates = getDatePreset(preset);
    setExportOptions(prev => ({ ...prev, ...dates }));
  };

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
        disabled={isExporting !== null}
      >
        {isExporting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
            Exporting...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Export Reports
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Export Data</h3>
            
            {/* Quick Export Options */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-medium">Appointments</div>
                    <div className="text-sm text-gray-500">Export appointment data</div>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => handleExport('appointments')}
                  disabled={isExporting !== null}
                >
                  {isExporting === 'appointments' ? 'Exporting...' : 'CSV'}
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium">Payments</div>
                    <div className="text-sm text-gray-500">Export payment records</div>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => handleExport('payments')}
                  disabled={isExporting !== null}
                >
                  {isExporting === 'payments' ? 'Exporting...' : 'CSV'}
                </Button>
              </div>
            </div>

            {/* Advanced Options Toggle */}
            <div className="border-t pt-3">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <Filter className="h-4 w-4" />
                Advanced Options
                <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-4">
                  {/* Date Range Presets */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Quick Date Ranges</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'today', label: 'Today' },
                        { key: 'week', label: 'Last 7 days' },
                        { key: 'month', label: 'Last 30 days' },
                        { key: 'quarter', label: 'Last 90 days' }
                      ].map(({ key, label }) => (
                        <Button
                          key={key}
                          variant="outline"
                          size="sm"
                          onClick={() => applyDatePreset(key as any)}
                          className="text-xs"
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Date Range */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">From Date</label>
                      <input
                        type="date"
                        value={exportOptions.from || ''}
                        onChange={(e) => setExportOptions(prev => ({ ...prev, from: e.target.value }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">To Date</label>
                      <input
                        type="date"
                        value={exportOptions.to || ''}
                        onChange={(e) => setExportOptions(prev => ({ ...prev, to: e.target.value }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>

                  {/* Status Filter (Appointments only) */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Status Filter (Appointments)</label>
                    <select
                      value={exportOptions.status || ''}
                      onChange={(e) => setExportOptions(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="">All Statuses</option>
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="READY">Ready</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="NO_SHOW">No Show</option>
                      <option value="CANCELED">Canceled</option>
                    </select>
                  </div>

                  {/* Clear Filters */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExportOptions({})}
                    className="w-full text-sm"
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>

            {/* Rate Limit Warning */}
            <div className="mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                <span className="font-medium">Rate Limited:</span>
              </div>
              <div className="mt-1">Maximum 5 exports per hour per user</div>
            </div>

            {/* Close Button */}
            <div className="mt-4 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsDropdown;
