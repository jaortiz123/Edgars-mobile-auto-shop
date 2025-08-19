import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Download, FileText, Table, Calendar, CheckCircle, AlertCircle } from 'lucide-react';

interface Appointment {
  id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  service: string;
  scheduled_at?: string;
  status: string;
  location_address?: string;
  notes?: string;
  created_at?: string;
  price?: number;
}

interface ExportOptions {
  format: 'csv' | 'json' | 'excel';
  includeFields: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  groupBy?: 'none' | 'status' | 'service' | 'date';
}

interface DataExportProps {
  appointments: Appointment[];
  selectedAppointments: string[];
  onClose?: () => void;
}

const DataExport: React.FC<DataExportProps> = ({
  appointments,
  selectedAppointments,
  onClose
}) => {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    includeFields: [
      'customer_name',
      'customer_phone',
      'service',
      'scheduled_at',
      'status',
      'location_address'
    ],
    groupBy: 'none'
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const availableFields = [
    { key: 'customer_name', label: 'Customer Name', required: true },
    { key: 'customer_email', label: 'Customer Email' },
    { key: 'customer_phone', label: 'Customer Phone' },
    { key: 'service', label: 'Service Type', required: true },
    { key: 'scheduled_at', label: 'Appointment Date & Time', required: true },
    { key: 'status', label: 'Status' },
    { key: 'location_address', label: 'Service Address' },
    { key: 'notes', label: 'Notes' },
    { key: 'created_at', label: 'Created Date' },
    { key: 'price', label: 'Price' }
  ];

  const getDataToExport = () => {
    let dataToExport = selectedAppointments.length > 0
      ? appointments.filter(apt => selectedAppointments.includes(apt.id))
      : appointments;

    // Apply date range filter if specified
    if (exportOptions.dateRange?.start || exportOptions.dateRange?.end) {
      dataToExport = dataToExport.filter(apt => {
        const aptDate = new Date(apt.scheduled_at || '');
        const startDate = exportOptions.dateRange?.start ? new Date(exportOptions.dateRange.start) : null;
        const endDate = exportOptions.dateRange?.end ? new Date(exportOptions.dateRange.end) : null;

        if (startDate && aptDate < startDate) return false;
        if (endDate && aptDate > endDate) return false;
        return true;
      });
    }

    return dataToExport;
  };

  const formatFieldValue = (appointment: Appointment, field: string): string => {
    const value = appointment[field as keyof Appointment];

    if (field.includes('_at') && value) {
      // Format dates
      return new Date(value as string).toLocaleString();
    }

    if (field === 'price' && value) {
      return `$${(value as number).toFixed(2)}`;
    }

    return String(value || '');
  };

  const exportToCSV = (data: Appointment[]) => {
    const headers = exportOptions.includeFields.map(field =>
      availableFields.find(f => f.key === field)?.label || field
    );

    const rows = data.map(appointment =>
      exportOptions.includeFields.map(field => {
        const value = formatFieldValue(appointment, field);
        // Escape quotes and wrap in quotes if contains comma or quote
        return value.includes(',') || value.includes('"')
          ? `"${value.replace(/"/g, '""')}"`
          : value;
      })
    );

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    return blob;
  };

  const exportToJSON = (data: Appointment[]) => {
    const exportData = data.map(appointment => {
      const filtered: any = {};
      exportOptions.includeFields.forEach(field => {
        filtered[field] = appointment[field as keyof Appointment];
      });
      return filtered;
    });

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    return blob;
  };

  const groupData = (data: Appointment[]) => {
    if (exportOptions.groupBy === 'none') return { 'All Appointments': data };

    const grouped: { [key: string]: Appointment[] } = {};

    data.forEach(appointment => {
      let groupKey = '';

      switch (exportOptions.groupBy) {
        case 'status':
          groupKey = appointment.status || 'Unknown';
          break;
        case 'service':
          groupKey = appointment.service || 'Unknown';
          break;
        case 'date':
          groupKey = appointment.scheduled_at ? new Date(appointment.scheduled_at).toDateString() : 'No Date';
          break;
        default:
          groupKey = 'All';
      }

      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(appointment);
    });

    return grouped;
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportStatus('idle');

    try {
      const dataToExport = getDataToExport();
      const groupedData = groupData(dataToExport);

      let blob: Blob;
      let filename: string;

      if (exportOptions.format === 'csv') {
        // For CSV, flatten grouped data or export each group separately
        if (exportOptions.groupBy === 'none') {
          blob = exportToCSV(dataToExport);
          filename = `appointments-${new Date().toISOString().split('T')[0]}.csv`;
        } else {
          // Create a combined CSV with group headers
          const allRows: string[] = [];
          for (const [groupName, appointments] of Object.entries(groupedData)) {
            allRows.push(`\n--- ${groupName} ---`);
            const csvData = exportToCSV(appointments);
            const csvText = await csvData.text();
            allRows.push(csvText);
          }

          blob = new Blob([allRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
          filename = `appointments-grouped-${new Date().toISOString().split('T')[0]}.csv`;
        }
      } else {
        // JSON export with grouping
        const exportData = exportOptions.groupBy === 'none'
          ? dataToExport.map(appointment => {
              const filtered: any = {};
              exportOptions.includeFields.forEach(field => {
                filtered[field] = appointment[field as keyof Appointment];
              });
              return filtered;
            })
          : groupedData;

        blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json;charset=utf-8;'
        });
        filename = `appointments-${new Date().toISOString().split('T')[0]}.json`;
      }

      // Download the file
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportStatus('success');
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus('error');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleField = (fieldKey: string) => {
    const field = availableFields.find(f => f.key === fieldKey);
    if (field?.required) return; // Can't toggle required fields

    const newFields = exportOptions.includeFields.includes(fieldKey)
      ? exportOptions.includeFields.filter(f => f !== fieldKey)
      : [...exportOptions.includeFields, fieldKey];

    setExportOptions({ ...exportOptions, includeFields: newFields });
  };

  const dataToExport = getDataToExport();

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Appointments
          </CardTitle>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              ×
            </Button>
          )}
        </div>
        <p className="text-sm text-gray-600">
          Exporting {dataToExport.length} appointment{dataToExport.length !== 1 ? 's' : ''}
          {selectedAppointments.length > 0 && ` (${selectedAppointments.length} selected)`}
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Export Format */}
        <div>
          <label className="block text-sm font-medium mb-3">Export Format</label>
          <div className="flex gap-2">
            {[
              { value: 'csv', label: 'CSV', icon: Table },
              { value: 'json', label: 'JSON', icon: FileText }
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setExportOptions({ ...exportOptions, format: value as 'csv' | 'json' })}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  exportOptions.format === value
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range Filter */}
        <div>
          <label className="block text-sm font-medium mb-3">Date Range (Optional)</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Start Date</label>
              <input
                type="date"
                value={exportOptions.dateRange?.start || ''}
                onChange={(e) => setExportOptions({
                  ...exportOptions,
                  dateRange: {
                    start: e.target.value,
                    end: exportOptions.dateRange?.end || ''
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">End Date</label>
              <input
                type="date"
                value={exportOptions.dateRange?.end || ''}
                onChange={(e) => setExportOptions({
                  ...exportOptions,
                  dateRange: {
                    start: exportOptions.dateRange?.start || '',
                    end: e.target.value
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Group By */}
        <div>
          <label className="block text-sm font-medium mb-3">Group By</label>
          <select
            value={exportOptions.groupBy}
            onChange={(e) => setExportOptions({
              ...exportOptions,
              groupBy: e.target.value as 'none' | 'status' | 'service' | 'date'
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="none">No Grouping</option>
            <option value="status">Status</option>
            <option value="service">Service Type</option>
            <option value="date">Date</option>
          </select>
        </div>

        {/* Include Fields */}
        <div>
          <label className="block text-sm font-medium mb-3">Include Fields</label>
          <div className="grid grid-cols-1 gap-2">
            {availableFields.map((field) => (
              <label key={field.key} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={exportOptions.includeFields.includes(field.key)}
                  onChange={() => toggleField(field.key)}
                  disabled={field.required}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`text-sm ${field.required ? 'font-medium' : ''}`}>
                  {field.label}
                  {field.required && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Required
                    </Badge>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Export Status */}
        {exportStatus !== 'idle' && (
          <div className={`p-3 rounded-lg flex items-center gap-2 ${
            exportStatus === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {exportStatus === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span className="text-sm">
              {exportStatus === 'success'
                ? 'Export completed successfully!'
                : 'Export failed. Please try again.'
              }
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleExport}
            disabled={isExporting || exportOptions.includeFields.length === 0}
            className="flex-1"
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {dataToExport.length} Records
              </>
            )}
          </Button>

          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DataExport;
